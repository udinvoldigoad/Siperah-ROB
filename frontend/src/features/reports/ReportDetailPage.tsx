import { useEffect, useState, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { fetchOperatorReport, findOperatorReport, severityLabels, statusLabels, updateOperatorReportStatus, type OperatorReport, type ReportStatus } from "./reportData";

export function ReportDetailPage({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<OperatorReport | undefined>(() => findOperatorReport(reportId));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setReport(findOperatorReport(reportId));
    fetchOperatorReport(reportId)
      .then((data) => {
        setReport(data);
        setError("");
      })
      .catch(() => setError("Backend belum tersedia. Menampilkan data contoh jika ada."));
  }, [reportId]);

  async function saveStatus(status: ReportStatus) {
    const rejectionReason = status === "ditolak" ? window.prompt("Alasan penolakan laporan")?.trim() : undefined;
    if (status === "ditolak" && !rejectionReason) return;

    try {
      setIsSaving(true);
      setReport(await updateOperatorReportStatus(reportId, status, rejectionReason));
      setError("");
    } catch {
      setError("Status laporan belum tersimpan. Cek koneksi backend.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!report) {
    return (
      <AppShell active="operator" title="Detail Laporan" subtitle="Laporan tidak ditemukan.">
        <section className="panel empty-state">
          <h2>Laporan tidak ditemukan</h2>
          <p>Kembali ke dashboard operator untuk memilih laporan yang tersedia.</p>
          <a className="btn primary" href="#/operator">Kembali</a>
        </section>
      </AppShell>
    );
  }

  const validationChecks = [
    ["Lokasi", report.coordinates],
    ["Tinggi air", `${report.waterHeightCm === null ? "-" : `${report.waterHeightCm} cm`} (${severityLabels[report.severity]})`],
    ["Bukti lapangan", `${report.photos.length} lampiran foto`],
  ];

  return (
    <AppShell active="operator" title={`${report.code} ${report.village}`} subtitle="Detail laporan ground truth untuk validasi BPBD.">
      <div className="detail-layout">
        <section className="panel report-detail">
          {error && <div className="alert">{error}</div>}
          <section className="alert" style={{ display: "grid", gap: 6 }}>
            <strong>{report.code}</strong>
            <span>{report.village}, {report.district}, {report.regency} · kejadian {report.incidentTime}</span>
          </section>

          <div className="section-head">
            <div>
              <h2>Ringkasan kejadian</h2>
              <p>{report.description}</p>
            </div>
            <div className="report-chips align-end">
              <span className={`badge ${report.isWithinMonitoringArea ? "b-done" : "b-pending"}`}>{report.isWithinMonitoringArea ? "Wilayah pantauan" : "Di luar cakupan prediksi"}</span>
              <span className={`badge severity-${report.severity}`}>{severityLabels[report.severity]}</span>
              <span className={`badge status-${report.status}`}>{statusLabels[report.status]}</span>
            </div>
          </div>

          <dl className="detail-grid">
            <div><dt>Pelapor</dt><dd>{report.reporter}</dd></div>
            <div><dt>Wilayah</dt><dd>{report.village}, {report.district}, {report.regency}</dd></div>
            <div><dt>Waktu kejadian</dt><dd>{report.incidentTime}</dd></div>
            <div><dt>Tinggi air</dt><dd>{report.waterHeightCm === null ? "-" : `${report.waterHeightCm} cm`}</dd></div>
            <div><dt>Koordinat</dt><dd>{report.coordinates}</dd></div>
            <div><dt>Status</dt><dd>{report.status === "menunggu" ? "Menunggu validasi" : report.status === "perlu_review" ? "Perlu review" : statusLabels[report.status]}</dd></div>
          </dl>

          <section style={{ display: "grid", gap: 10 }}>
            <h2 style={{ marginBottom: 0 }}>Foto dokumentasi</h2>
            <div className="photo-grid">
              {report.photos.map((photo, i) => (
                <figure className="report-photo" key={i} style={{ margin: 0, overflow: "hidden", borderRadius: "var(--radius)", border: "1px solid var(--line)", background: "var(--surface-soft)", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 120 }}>
                  {photo.url ? (
                    <img src={photo.url} alt={photo.name} style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>{photo.name}</span>
                  )}
                </figure>
              ))}
            </div>
          </section>
          <div className="actions detail-actions" style={{ marginTop: 4 }}>
            <button className="btn primary" type="button" disabled={isSaving} onClick={() => saveStatus("divalidasi")}>Validasi laporan</button>
            <button className="btn secondary" type="button" disabled={isSaving} onClick={() => saveStatus("ditolak")}>Tolak</button>
            <a className="btn secondary" href="#/operator">Kembali</a>
          </div>
        </section>
        <aside className="report-side">
          <section className="panel validation-panel">
            <div className="section-head" style={{ marginBottom: 4 }}>
              <div>
                <h2>Validasi operator</h2>
                <p>Cocokkan informasi inti sebelum menekan tombol validasi.</p>
              </div>
            </div>
            <div className="validation-list">
              {validationChecks.map(([label, value]) => (
                <div className="validation-item" key={label}>
                  <Icon name="task_alt" />
                  <div>
                    <strong>{label}</strong>
                    <span>{value}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="validation-note">Cocokkan laporan dengan peta risiko dan bukti foto sebelum mengubah status validasi.</p>
          </section>
          <div className="panel flush" style={{ overflow: "hidden", minHeight: 400 }}><ReportMap coordinates={report.coordinates} severity={report.severity} /></div>
        </aside>
      </div>
    </AppShell>
  );
}

function ReportMap({ coordinates, severity }: { coordinates: string, severity: string }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    
    const [latStr, lngStr] = coordinates.split(",");
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (isNaN(lat) || isNaN(lng)) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      center: [lng, lat],
      zoom: 14,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");
    map.current.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");

    const color = severity === "sangat_parah" ? "#ef4444" : severity === "parah" ? "#f97316" : severity === "sedang" ? "#eab308" : "#22c55e";
    
    new maplibregl.Marker({ color })
      .setLngLat([lng, lat])
      .addTo(map.current);

    return () => { map.current?.remove(); map.current = null; };
  }, [coordinates, severity]);

  return <div ref={mapContainer} style={{ width: "100%", height: "100%", minHeight: "400px" }} />;
}
