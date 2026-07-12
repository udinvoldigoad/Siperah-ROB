import { FormEvent, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "../../shared/api/client";
import { AppShell } from "../../shared/components/AppShell";
import { useToast } from "../../shared/components/Toast";

type ReportResponse = {
  message: string;
  data: {
    report_code: string;
  };
};

type ResolvedRegion = { id: string; village: string | null; district: string | null; regency: string | null; coastal_flag: boolean };
type ResolveRegionResponse = { data: ResolvedRegion | null; message?: string | null };

const severityOptions = [
  { key: "ringan", label: "Ringan", note: "Genangan <10cm", tone: "#16a34a" },
  { key: "sedang", label: "Sedang", note: "10-30 cm", tone: "#d97706" },
  { key: "parah", label: "Parah", note: "30-80 cm", tone: "#ea580c" },
  { key: "sangat_parah", label: "Sangat Parah", note: ">80 cm", tone: "#dc2626" },
] as const;

function toIncidentDateTime(value: string) {
  if (value.includes("T")) return new Date(value).toISOString();
  const [hours = "00", minutes = "00"] = value.split(":");
  const now = new Date();
  now.setHours(Number(hours), Number(minutes), 0, 0);
  return now.toISOString();
}

function currentTimeValue() {
  return new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function ReportWizardPage() {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<(typeof severityOptions)[number]["key"]>("parah");
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  
  // Form state for summary
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: -5.45, lng: 105.266 });
  const [waterHeight, setWaterHeight] = useState("45");
  const [incidentTime, setIncidentTime] = useState(currentTimeValue);
  const [resolvedRegion, setResolvedRegion] = useState<ResolvedRegion | null>(null);
  const [isResolvingRegion, setResolvingRegion] = useState(false);
  
  // Map logic
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      center: [coords.lng, coords.lat],
      zoom: 13,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap" } },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
    });
    
    map.current.addControl(new maplibregl.NavigationControl(), "top-right");
    
    marker.current = new maplibregl.Marker({ color: "#ea580c", draggable: true })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map.current);
      
    marker.current.on('dragend', () => {
      const lngLat = marker.current?.getLngLat();
      if (lngLat) setCoords({ lat: lngLat.lat, lng: lngLat.lng });
    });

    map.current.on('click', (e) => {
      marker.current?.setLngLat(e.lngLat);
      setCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    navigator.geolocation?.getCurrentPosition(({ coords: position }) => {
      const next = { lat: position.latitude, lng: position.longitude };
      setCoords(next);
      marker.current?.setLngLat([next.lng, next.lat]);
      map.current?.flyTo({ center: [next.lng, next.lat], zoom: 14 });
    }, () => undefined, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });

    return () => { map.current?.remove(); map.current = null; };
  }, []); // Only init once

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setResolvingRegion(true);
      api<ResolveRegionResponse>(`/public/resolve-region?lat=${coords.lat}&lon=${coords.lng}`)
        .then((response) => setResolvedRegion(response.data))
        .catch(() => setResolvedRegion(null))
        .finally(() => setResolvingRegion(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [coords.lat, coords.lng]);

  // Update marker color when severity changes
  useEffect(() => {
    if (!marker.current || !map.current) return;
    const tone = severityOptions.find(o => o.key === selectedSeverity)?.tone || "#ea580c";
    
    // Create new marker to update color
    const lngLat = marker.current.getLngLat();
    marker.current.remove();
    marker.current = new maplibregl.Marker({ color: tone, draggable: true })
      .setLngLat(lngLat)
      .addTo(map.current);
      
    marker.current.on('dragend', () => {
      const pos = marker.current?.getLngLat();
      if (pos) setCoords({ lat: pos.lat, lng: pos.lng });
    });
  }, [selectedSeverity]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const form = event.currentTarget;
    const payload = new FormData();

    payload.set("latitude", String(coords.lat));
    payload.set("longitude", String(coords.lng));
    payload.set("severity", selectedSeverity);
    payload.set("water_height_cm", waterHeight);
    payload.set("incident_time", toIncidentDateTime(incidentTime));
    
    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
    payload.set("description", description);

    for (const photo of selectedPhotos) {
      payload.append("photos[]", photo);
    }

    try {
      const response = await api<ReportResponse>("/reports", { method: "POST", body: payload });
      toast.success(`Laporan terkirim. Kode verifikasi: ${response.data.report_code}.`);
      form.reset();
      setSelectedSeverity("parah");
      setSelectedPhotos([]);
      setWaterHeight("45");
      setIncidentTime(currentTimeValue());
    } catch (error: any) {
      toast.error(error.message || "Laporan belum terkirim. Cek isian dan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePhotos(files: FileList | null) {
    const photos = Array.from(files ?? []);
    if (photos.length > 5) {
      toast.error("Maksimal 5 foto untuk satu laporan.");
      return;
    }
    if (photos.some((photo) => photo.size > 2 * 1024 * 1024)) {
      toast.error("Setiap foto maksimal berukuran 2 MB.");
      return;
    }
    setSelectedPhotos(photos);
  }

  const selectedSeverityLabel = severityOptions.find(o => o.key === selectedSeverity)?.label || "Parah";

  return (
    <AppShell 
      active="reports" 
      title="Form Laporan Ground Truth" 
      subtitle="Pilih lokasi, isi detail kejadian, unggah foto, lalu kirim."
      breadcrumbs={[{ label: "Dashboard", href: "#/" }, { label: "Pelaporan" }]}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <div className="step-strip" aria-label="Tahap laporan ground truth" style={{ marginBottom: 28, maxWidth: 640 }}>
          <span><b>1</b> Pilih lokasi</span>
          <span><b>2</b> Detail kejadian</span>
          <span><b>3</b> Foto & kirim</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 32, alignItems: "start" }}>
          {/* Left Column: Form Fields */}
          <div className="panel" style={{ display: "grid", gap: 24, padding: 32 }}>
            <h2 style={{ fontSize: "1.25rem", margin: 0, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>Detail Informasi</h2>

            <section style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Peta Lokasi (Klik atau geser pin)</label>
              <div ref={mapContainer} style={{ height: 300, borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--surface-soft)", border: "1px solid var(--line)", borderRadius: "var(--radius)", marginTop: 8 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--accent)", fontSize: 20 }}>my_location</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Koordinat Terpilih</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{coords.lat.toFixed(5)}°, {coords.lng.toFixed(5)}°</div>
                  <div style={{ fontSize: 12, color: resolvedRegion ? "var(--ink)" : "var(--critical)", marginTop: 4 }}>
                    {isResolvingRegion ? "Mencari nama wilayah..." : resolvedRegion
                      ? `${resolvedRegion.village ?? "-"}, ${resolvedRegion.district ?? "-"}, ${resolvedRegion.regency ?? "-"}`
                      : "Wilayah administratif belum ditemukan untuk titik ini."}
                  </div>
                </div>
              </div>
              {resolvedRegion && !resolvedRegion.coastal_flag && <p className="form-note" style={{ borderLeftColor: "var(--medium)" }}>Lokasi berada di luar wilayah pantauan prediksi rob. Laporan tetap dapat dikirim dan akan ditandai untuk peninjauan BPBD.</p>}
            </section>

            <section style={{ display: "grid", gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Tingkat keparahan</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                {severityOptions.map((option) => {
                  const isSelected = selectedSeverity === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setSelectedSeverity(option.key)}
                      style={{
                        border: `2px solid ${isSelected ? option.tone : "var(--line)"}`,
                        background: isSelected ? `${option.tone}12` : "var(--surface)",
                        borderRadius: 8,
                        padding: 16,
                        textAlign: "center",
                        cursor: "pointer",
                        boxShadow: isSelected ? `0 0 0 3px ${option.tone}26` : "none",
                        transition: "all 0.2s"
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: option.tone, fontSize: 24, display: "block", margin: "0 auto 8px" }}>
                        water_drop
                      </span>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? option.tone : "var(--ink)" }}>
                        {option.label}{isSelected ? " ✓" : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>{option.note}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <label htmlFor="water_height_cm" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Estimasi ketinggian air (cm)</label>
                <input id="water_height_cm" name="water_height_cm" type="number" min="0" max="500" value={waterHeight} onChange={e => setWaterHeight(e.target.value)} required />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <label htmlFor="incident_time" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Waktu kejadian</label>
                <input id="incident_time" name="incident_time" type="time" value={incidentTime} onChange={e => setIncidentTime(e.target.value)} required />
              </div>
            </div>

            <section style={{ display: "grid", gap: 8 }}>
              <label htmlFor="description" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                Deskripsi kejadian <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>(opsional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                placeholder="Deskripsikan kondisi banjir rob yang Anda amati…"
                defaultValue="Air masuk ke jalan setinggi lutut, beberapa rumah terendam di RT 03."
              />
            </section>

            <section style={{ display: "grid", gap: 8 }}>
              <label htmlFor="photos" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Foto dokumentasi</label>
              <input id="photos" name="photos" type="file" accept="image/png,image/jpeg" multiple onChange={(event) => handlePhotos(event.target.files)} style={{ padding: "12px 14px" }} />
              <p className="form-note" style={{ marginTop: 8, fontSize: 12, color: "var(--ink-soft)" }}>JPG/PNG, maksimal 5 foto dan 2 MB per foto. Laporan diverifikasi BPBD maksimal 1x24 jam.</p>
              {selectedPhotos.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10, marginTop: 6 }}>
                {selectedPhotos.map((photo) => <figure key={`${photo.name}-${photo.lastModified}`} style={{ margin: 0, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}><img src={URL.createObjectURL(photo)} alt={photo.name} style={{ display: "block", width: "100%", height: 84, objectFit: "cover" }} /><figcaption style={{ padding: 6, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{photo.name}</figcaption></figure>)}
              </div>}
            </section>
          </div>

          {/* Right Column: Summary & Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 100 }}>
            <div className="panel" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: 20 }}>Ringkasan Laporan</h2>
              <div className="summary-grid" style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Koordinat</span>
                  <strong style={{ fontSize: 14 }}>{coords.lat.toFixed(4)}°, {coords.lng.toFixed(4)}°</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Keparahan</span>
                  <strong style={{ fontSize: 14 }}>{selectedSeverityLabel}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Ketinggian air</span>
                  <strong style={{ fontSize: 14 }}>±{waterHeight || 0} cm</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Waktu kejadian</span>
                  <strong style={{ fontSize: 14 }}>{incidentTime || "-"} WIB</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Foto dilampirkan</span>
                  <strong style={{ fontSize: 14 }}>{selectedPhotos.length} foto</strong>
                </div>
              </div>
            </div>

            <div style={{ background: "var(--accent-soft)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: 8, padding: 16, display: "flex", alignItems: "start", gap: 12 }}>
              <input type="checkbox" defaultChecked style={{ marginTop: 4, width: 16, height: 16, accentColor: "var(--accent)", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.6 }}>Saya menyatakan bahwa data yang dilaporkan adalah informasi nyata yang saya saksikan sendiri. Data ini akan digunakan untuk meningkatkan model prediksi banjir rob SIPERAH-RoB.</span>
            </div>

            <button className="btn primary" type="submit" disabled={isSubmitting} style={{ padding: "14px 24px", fontSize: 15 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              {isSubmitting ? "Mengirim..." : "Kirim laporan sekarang"}
            </button>
            <button type="button" className="btn secondary" style={{ padding: "14px 24px", fontSize: 14, border: "none", background: "transparent" }}>
              Batal
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
