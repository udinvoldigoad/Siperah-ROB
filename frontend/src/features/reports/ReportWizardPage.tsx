import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "../../shared/api/client";
import { AppShell } from "../../shared/components/AppShell";
import { useToast } from "../../shared/components/Toast";
import { statusLabels, type ReportStatus } from "./reportData";

type ReportResponse = {
  message: string;
  data: {
    report_code: string;
    status: ReportStatus;
    is_within_monitoring_area?: boolean;
  };
};

type ResolvedRegion = { id: string; village: string | null; district: string | null; regency: string | null; coastal_flag: boolean; is_monitored?: boolean };
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

function severityFromWaterHeight(heightCm: number): (typeof severityOptions)[number]["key"] {
  if (heightCm < 10) return "ringan";
  if (heightCm <= 30) return "sedang";
  if (heightCm <= 80) return "parah";
  return "sangat_parah";
}

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Kompres gambar ke WebP di sisi klien agar unggahan ringan.
// Mengembalikan file asli jika browser tidak mendukung atau hasil malah lebih besar.
async function compressToWebp(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== "function") return file;
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1600;
    let { width, height } = bitmap;
    if (width > maxDimension || height > maxDimension) {
      const scale = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) { bitmap.close?.(); return file; }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;
    const newName = `${file.name.replace(/\.[^.]+$/, "")}.webp`;
    return new File([blob], newName, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
}

export function ReportWizardPage() {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [isDeclarationAccepted, setDeclarationAccepted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ code: string; status: ReportStatus; message: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isProcessingPhotos, setProcessingPhotos] = useState(false);
  const [isDraggingPhoto, setDraggingPhoto] = useState(false);
  
  // Form state for summary
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: -5.45, lng: 105.266 });
  const [waterHeight, setWaterHeight] = useState("");
  const [incidentTime, setIncidentTime] = useState(currentTimeValue);
  const [resolvedRegion, setResolvedRegion] = useState<ResolvedRegion | null>(null);
  const [isResolvingRegion, setResolvingRegion] = useState(false);
  const derivedSeverity = severityFromWaterHeight(Number(waterHeight || 0));
  
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

  // Update marker color when water-height-derived severity changes
  useEffect(() => {
    if (!marker.current || !map.current) return;
    const tone = severityOptions.find(o => o.key === derivedSeverity)?.tone || "#ea580c";
    
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
  }, [derivedSeverity]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    if (selectedPhotos.length === 0) {
      toast.error("Mohon lampirkan setidaknya 1 foto dokumentasi kejadian.");
      setIsSubmitting(false);
      return;
    }

    if (!isDeclarationAccepted) {
      toast.error("Anda harus menyetujui pernyataan kebenaran laporan pada kotak di atas.");
      setIsSubmitting(false);
      return;
    }

    const form = event.currentTarget;
    const payload = new FormData();

    payload.set("latitude", String(coords.lat));
    payload.set("longitude", String(coords.lng));
    payload.set("severity", derivedSeverity);
    payload.set("water_height_cm", waterHeight);
    payload.set("incident_time", toIncidentDateTime(incidentTime));
    
    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value;
    payload.set("description", description);

    for (const photo of selectedPhotos) {
      payload.append("photos[]", photo);
    }

    try {
      const response = await api<ReportResponse>("/reports", { method: "POST", body: payload });
      setSubmitResult({ code: response.data.report_code, status: response.data.status, message: response.message });
      toast.success(`Laporan terkirim. Kode verifikasi: ${response.data.report_code}.`);
      form.reset();
      setSelectedPhotos([]);
      setWaterHeight("45");
      setIncidentTime(currentTimeValue());
      setDeclarationAccepted(false);
    } catch (error: any) {
      const message = error.message || "Laporan belum terkirim. Cek isian dan coba lagi.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePhotos(files: FileList | null) {
    const incoming = Array.from(files ?? []);
    if (incoming.length === 0) return;

    const images = incoming.filter((photo) => ACCEPTED_PHOTO_TYPES.includes(photo.type));
    if (images.length !== incoming.length) {
      toast.error("Foto hanya boleh berformat JPG, PNG, atau WebP.");
    }
    if (images.length === 0) return;

    const remainingSlots = MAX_PHOTOS - selectedPhotos.length;
    if (remainingSlots <= 0) {
      toast.error(`Maksimal ${MAX_PHOTOS} foto untuk satu laporan.`);
      return;
    }
    const toProcess = images.slice(0, remainingSlots);
    if (images.length > remainingSlots) {
      toast.error(`Hanya ${remainingSlots} foto lagi yang bisa ditambahkan (maksimal ${MAX_PHOTOS}).`);
    }

    setProcessingPhotos(true);
    try {
      const processed: File[] = [];
      for (const image of toProcess) {
        const compressed = await compressToWebp(image);
        if (compressed.size > MAX_PHOTO_BYTES) {
          toast.error(`"${image.name}" masih di atas 2 MB setelah dikompres dan dilewati.`);
          continue;
        }
        processed.push(compressed);
      }
      if (processed.length === 0) return;
      setSelectedPhotos((previous) => {
        const seen = new Set(previous.map((photo) => `${photo.name}:${photo.size}`));
        const merged = [...previous];
        for (const photo of processed) {
          const key = `${photo.name}:${photo.size}`;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(photo);
          }
        }
        return merged.slice(0, MAX_PHOTOS);
      });
    } finally {
      setProcessingPhotos(false);
    }
  }

  function removePhoto(index: number) {
    setSelectedPhotos((previous) => previous.filter((_, position) => position !== index));
  }

  const selectedSeverityLabel = severityOptions.find(o => o.key === derivedSeverity)?.label || "Parah";
  const isMonitoredRegion = resolvedRegion ? (resolvedRegion.is_monitored ?? resolvedRegion.coastal_flag) : false;
  const photoPreviews = useMemo(() => selectedPhotos.map((file) => ({ file, url: URL.createObjectURL(file) })), [selectedPhotos]);
  useEffect(() => () => { photoPreviews.forEach((preview) => URL.revokeObjectURL(preview.url)); }, [photoPreviews]);

  // Kunci scroll halaman saat modal sukses terbuka agar tampilan tidak rusak.
  useEffect(() => {
    if (!submitResult) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [submitResult]);

  return (
    <AppShell 
      active="reports" 
      title="Form Laporan Ground Truth" 
      subtitle="Pilih lokasi, isi detail kejadian, unggah foto, lalu kirim."
      breadcrumbs={[{ label: "Dashboard", href: "#/" }, { label: "Pelaporan" }]}
    >
      <style>{`
        @keyframes reportSpin { to { transform: rotate(360deg); } }
        .report-spin { animation: reportSpin 0.9s linear infinite; }
        .report-success-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); display: flex; align-items: flex-start; justify-content: center; overflow-y: auto; padding: 24px; z-index: 1000; }
        .report-success-card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25); margin: auto; max-width: 460px; padding: 32px; text-align: center; width: 100%; animation: reportSuccessIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes reportSuccessIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .photo-dropzone { align-items: center; background: var(--surface-soft); border: 2px dashed var(--line); border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 6px; padding: 26px 20px; text-align: center; transition: border-color .2s ease, background .2s ease; }
        .photo-dropzone:hover, .photo-dropzone.dragging { border-color: var(--accent); background: var(--accent-soft); }
        .photo-dropzone.disabled { cursor: not-allowed; opacity: 0.7; }
        .photo-dropzone.disabled:hover { border-color: var(--line); background: var(--surface-soft); }
        .photo-thumb { border: 1px solid var(--line); border-radius: 10px; margin: 0; overflow: hidden; position: relative; }
        .photo-thumb img { display: block; height: 96px; object-fit: cover; width: 100%; }
        .photo-thumb figcaption { background: var(--surface); color: var(--ink-soft); font-size: 11px; padding: 5px 8px; text-align: center; }
        .photo-remove { align-items: center; background: rgba(15, 23, 42, .72); border: 0; border-radius: 999px; color: #fff; cursor: pointer; display: flex; height: 24px; justify-content: center; position: absolute; right: 6px; top: 6px; width: 24px; }
        .photo-remove:hover { background: var(--critical); }
        
        .wizard-layout { display: grid; grid-template-columns: 1.5fr 400px; gap: 32px; align-items: start; justify-content: center; }
        .severity-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 992px) {
          .wizard-layout { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .severity-grid { grid-template-columns: repeat(2, 1fr); }
          .details-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <div className="step-strip" aria-label="Tahap laporan ground truth" style={{ margin: "0 auto 28px", maxWidth: 640 }}>
          <span><b>1</b> Pilih lokasi</span>
          <span><b>2</b> Detail kejadian</span>
          <span><b>3</b> Foto & kirim</span>
        </div>

        <form onSubmit={handleSubmit} className="wizard-layout">
          {/* Left Column: Form Fields */}
          <div className="panel" style={{ display: "grid", gap: 24, padding: "32px clamp(16px, 4vw, 32px)" }}>
            <h2 style={{ fontSize: "1.25rem", margin: 0, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>Detail Informasi</h2>

            <section style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Peta Lokasi (Klik atau geser pin)</label>
              <div ref={mapContainer} style={{ height: 300, borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--surface-soft)", border: "1px solid var(--line)", borderRadius: "var(--radius)", marginTop: 8 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--accent)", fontSize: 20 }}>my_location</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Koordinat Terpilih</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{coords.lat.toFixed(5)}°, {coords.lng.toFixed(5)}°</div>
                  <div style={{ fontSize: 12, color: resolvedRegion ? "var(--ink)" : "var(--medium)", marginTop: 4 }}>
                    {isResolvingRegion ? "Mencari nama wilayah..." : resolvedRegion
                      ? `${resolvedRegion.village ?? "-"}, ${resolvedRegion.district ?? "-"}, ${resolvedRegion.regency ?? "-"}`
                      : "Bukan wilayah administrasi Bandar Lampung."}
                  </div>
                </div>
              </div>
              {resolvedRegion ? (
                <p
                  className="form-note"
                  style={{
                    borderLeftColor: isMonitoredRegion ? "var(--low)" : "var(--medium)",
                    background: isMonitoredRegion ? "rgba(22, 163, 74, 0.08)" : undefined,
                    color: isMonitoredRegion ? "#14532d" : undefined,
                  }}
                >
                  {isMonitoredRegion
                    ? "Lokasi masuk wilayah pantauan prediksi rob. Laporan akan masuk antrean validasi BPBD sesuai wilayah kerja."
                    : "Lokasi berada di luar wilayah pantauan prediksi rob. Laporan tetap dapat dikirim dan akan masuk antrean triase BPBD untuk peninjauan."}
                </p>
              ) : !isResolvingRegion ? (
                <p className="form-note" style={{ borderLeftColor: "var(--medium)" }}>
                  Lokasi berada di luar wilayah administrasi yang terdata. Laporan tetap dapat dikirim dan akan masuk antrean triase BPBD untuk peninjauan.
                </p>
              ) : null}
            </section>

            <section style={{ display: "grid", gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Tingkat keparahan otomatis</label>
              <p className="form-note" style={{ marginTop: 0 }}>Sistem menentukan keparahan dari estimasi tinggi air. Anda cukup isi tinggi genangan, lalu kategori akan berubah otomatis.</p>
              <div className="severity-grid">
                {severityOptions.map((option) => {
                  const isSelected = derivedSeverity === option.key;
                  return (
                    <div
                      key={option.key}
                      style={{
                        border: `2px solid ${isSelected ? option.tone : "var(--line)"}`,
                        background: isSelected ? `${option.tone}12` : "var(--surface)",
                        borderRadius: 8,
                        padding: 16,
                        textAlign: "center",
                        cursor: "default",
                        opacity: isSelected ? 1 : 0.62,
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
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="details-grid">
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
                Deskripsi kejadian
              </label>
              <textarea
                id="description"
                name="description"
                placeholder="Deskripsikan kondisi banjir rob yang Anda amati…"
                required
              />
            </section>

            <section style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Foto dokumentasi</label>
                <span style={{ fontSize: 12, fontWeight: 700, color: photoPreviews.length ? "var(--accent-dark)" : "var(--ink-soft)" }}>{photoPreviews.length}/{MAX_PHOTOS} foto</span>
              </div>

              <label
                className={`photo-dropzone ${isDraggingPhoto ? "dragging" : ""} ${selectedPhotos.length >= MAX_PHOTOS ? "disabled" : ""}`}
                onDragOver={(event) => { event.preventDefault(); if (selectedPhotos.length < MAX_PHOTOS) setDraggingPhoto(true); }}
                onDragLeave={() => setDraggingPhoto(false)}
                onDrop={(event) => { event.preventDefault(); setDraggingPhoto(false); void handlePhotos(event.dataTransfer.files); }}
              >
                <input
                  id="photos"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  disabled={isProcessingPhotos || selectedPhotos.length >= MAX_PHOTOS}
                  onChange={(event) => { void handlePhotos(event.target.files); event.target.value = ""; }}
                  style={{ display: "none" }}
                />
                <span className={`material-symbols-outlined ${isProcessingPhotos ? "report-spin" : ""}`} style={{ fontSize: 34, color: "var(--accent)" }}>
                  {isProcessingPhotos ? "progress_activity" : "add_photo_alternate"}
                </span>
                <strong style={{ fontSize: 14 }}>
                  {isProcessingPhotos ? "Mengompres foto…" : selectedPhotos.length >= MAX_PHOTOS ? "Batas 5 foto tercapai" : "Seret & letakkan atau klik untuk pilih foto"}
                </strong>
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>JPG, PNG, atau WebP · dikompres otomatis · maks {MAX_PHOTOS} foto, 2 MB per foto</span>
              </label>

              <p className="form-note" style={{ marginTop: 0, fontSize: 12, color: "var(--ink-soft)" }}>Foto dikompres ke WebP di perangkat Anda agar unggahan ringan. Laporan diverifikasi BPBD maksimal 1x24 jam.</p>

              {photoPreviews.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                  {photoPreviews.map((preview, index) => (
                    <figure key={preview.url} className="photo-thumb">
                      <img src={preview.url} alt={preview.file.name} />
                      <button type="button" className="photo-remove" aria-label={`Hapus ${preview.file.name}`} onClick={() => removePhoto(index)}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                      </button>
                      <figcaption>{formatBytes(preview.file.size)}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Submission Panel */}
          <div className="panel" style={{ display: "grid", gap: 24, padding: "32px clamp(16px, 4vw, 32px)", position: "sticky", top: 24, height: "fit-content" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", margin: 0, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>Ringkasan Laporan</h2>
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
              <input type="checkbox" checked={isDeclarationAccepted} onChange={(event) => setDeclarationAccepted(event.target.checked)} required aria-label="Setujui pernyataan kebenaran laporan" style={{ marginTop: 4, width: 16, height: 16, accentColor: "var(--accent)", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.6 }}>Saya menyatakan bahwa data yang dilaporkan adalah informasi nyata yang saya saksikan sendiri. Data ini akan digunakan untuk meningkatkan model prediksi banjir rob SIPERAH-RoB.</span>
            </div>

            {submitError && !isSubmitting && (
              <div className="alert" style={{ borderLeftColor: "var(--critical)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--critical)", fontSize: 20 }}>error</span>
                <div style={{ fontSize: 13 }}>
                  <strong style={{ display: "block", color: "var(--ink)", marginBottom: 2 }}>Laporan belum terkirim</strong>
                  <span style={{ color: "var(--ink-soft)" }}>{submitError} Periksa isian, lalu kirim ulang.</span>
                </div>
              </div>
            )}
            <button className="btn primary" type="submit" disabled={isSubmitting} style={{ padding: "14px 24px", fontSize: 15 }}>
              <span className={`material-symbols-outlined ${isSubmitting ? "report-spin" : ""}`} style={{ fontSize: 18 }}>{isSubmitting ? "progress_activity" : (submitError ? "refresh" : "send")}</span>
              {isSubmitting ? "Mengirim..." : (submitError ? "Kirim ulang laporan" : "Kirim laporan sekarang")}
            </button>
            <a href="#/history" className="btn secondary" style={{ padding: "14px 24px", fontSize: 14, border: "none", background: "transparent", justifyContent: "center" }}>
              Batal
            </a>
          </div>
        </form>
      </div>

      {submitResult && createPortal(
        <div className="report-success-overlay" role="dialog" aria-modal="true" aria-label="Laporan terkirim">
          <div className="report-success-card">
            <span className="material-symbols-outlined" style={{ fontSize: 56, color: "var(--low)" }}>check_circle</span>
            <h2 style={{ fontSize: "1.35rem", margin: "12px 0 6px" }}>Laporan Terkirim</h2>
            <p style={{ margin: "0 0 16px", color: "var(--ink-soft)", fontSize: 14 }}>
              Kode verifikasi: <strong style={{ color: "var(--ink)" }}>{submitResult.code}</strong>
            </p>
            <span className={`badge status-${submitResult.status}`}>{statusLabels[submitResult.status] ?? submitResult.status}</span>
            <p style={{ margin: "16px 0 24px", fontSize: 14, lineHeight: 1.6 }}>{submitResult.message}</p>
            <div style={{ display: "grid", gap: 10 }}>
              <a className="btn primary" href="#/history" style={{ justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>history</span> Lihat Riwayat Laporan
              </a>
              <button type="button" className="btn secondary" onClick={() => setSubmitResult(null)} style={{ justifyContent: "center" }}>
                Buat Laporan Lain
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </AppShell>
  );
}
