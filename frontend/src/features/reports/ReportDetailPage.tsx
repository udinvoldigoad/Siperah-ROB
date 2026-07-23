import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { Skeleton } from "../../shared/components/Skeleton";
import { useToast } from "../../shared/components/Toast";
import { fetchOperatorReport, findOperatorReport, severityLabels, statusLabels, updateOperatorReportStatus, type OperatorReport, type ReportStatus } from "./reportData";

export function ReportDetailPage({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<OperatorReport | undefined>(() => findOperatorReport(reportId));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Skeleton hanya saat belum ada data lokal (laporan asli dari API) agar tak
  // ada kedip "tidak ditemukan" sebelum fetch selesai.
  const [isLoading, setIsLoading] = useState(() => !findOperatorReport(reportId));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const toast = useToast();

  useEffect(() => {
    const local = findOperatorReport(reportId);
    setReport(local);
    setIsLoading(!local);
    fetchOperatorReport(reportId)
      .then((data) => { setReport(data); setError(""); })
      .catch(() => setError("Backend belum tersedia. Menampilkan data contoh jika ada."))
      .finally(() => setIsLoading(false));
  }, [reportId]);

  // Tutup modal penolakan dengan Escape.
  useEffect(() => {
    if (!rejectOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setRejectOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [rejectOpen]);

  async function saveStatus(status: ReportStatus, reason?: string) {
    try {
      setIsSaving(true);
      setReport(await updateOperatorReportStatus(reportId, status, reason));
      setError("");
    } catch {
      setError("Status laporan belum tersimpan. Cek koneksi backend.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmReject() {
    const reason = rejectReason.trim();
    if (!reason) return;
    const code = report?.code ?? "";
    try {
      setIsSaving(true);
      await updateOperatorReportStatus(reportId, "ditolak", reason);
      setRejectOpen(false);
      setRejectReason("");
      toast.info(`Laporan ${code} telah ditolak.`);
      // Kembali ke dashboard operator setelah laporan ditolak.
      window.location.hash = "#/operator";
    } catch {
      setError("Status laporan belum tersimpan. Cek koneksi backend.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <DetailSkeleton />;

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
      <style>{`
        /* Indikator status jadi 3 kolom rapi di mobile. */
        @media (max-width: 768px) {
          .rd-status-chips { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
          .rd-status-chips .badge {
            width: 100%; display: flex; align-items: center; justify-content: center;
            text-align: center; white-space: normal; line-height: 1.2;
            font-size: 11px; padding: 8px 6px; min-height: 40px;
          }
        }
        /* Modal alasan penolakan (pengganti window.prompt bawaan browser). */
        .rd-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 1000; }
        .rd-modal-card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25); max-width: 460px; width: 100%; padding: 24px; animation: rdModalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes rdModalIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .rd-modal-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .rd-modal-head h2 { margin: 0; font-size: 1.15rem; }
        .rd-modal-sub { margin: 0 0 16px; font-size: 13.5px; color: var(--ink-soft); line-height: 1.6; }
        .rd-reason { width: 100%; box-sizing: border-box; min-height: 110px; resize: vertical; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: inherit; font-size: 14px; line-height: 1.5; }
        .rd-reason:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
        .rd-reason::placeholder { color: var(--ink-soft); }
        .rd-modal-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; margin-top: 18px; }
        @media (max-width: 520px) {
          .rd-modal-actions .btn { flex: 1 1 auto; justify-content: center; }
        }
      `}</style>
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
            <div className="report-chips align-end rd-status-chips">
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
            <button className="btn secondary" type="button" disabled={isSaving} onClick={() => setRejectOpen(true)} style={{ color: "var(--critical)" }}>Tolak</button>
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

      {rejectOpen && createPortal(
        <div className="rd-modal-overlay" role="dialog" aria-modal="true" aria-label="Tolak laporan" onClick={() => setRejectOpen(false)}>
          <div className="rd-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="rd-modal-head">
              <Icon name="cancel" style={{ fontSize: 24, color: "var(--critical)" }} />
              <h2>Tolak laporan {report.code}</h2>
            </div>
            <p className="rd-modal-sub">Tuliskan alasan penolakan agar tercatat bersama laporan dan bisa ditinjau kembali.</p>
            <textarea
              className="rd-reason"
              autoFocus
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Contoh: foto tidak jelas, lokasi tidak sesuai, atau laporan ganda…"
            />
            <div className="rd-modal-actions">
              <button type="button" className="btn secondary" onClick={() => setRejectOpen(false)}>Batal</button>
              <button
                type="button"
                className="btn primary"
                disabled={!rejectReason.trim() || isSaving}
                onClick={confirmReject}
                style={{ background: "var(--critical)", borderColor: "var(--critical)" }}
              >
                <Icon name="block" /> {isSaving ? "Memproses…" : "Tolak laporan"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </AppShell>
  );
}

// Skeleton saat memuat detail laporan agar transisi terasa mulus, bukan kedip.
function DetailSkeleton() {
  return (
    <AppShell active="operator" title="Detail Laporan" subtitle="Memuat detail laporan…">
      <div className="detail-layout">
        <section className="panel report-detail" style={{ display: "grid", gap: 20 }}>
          <Skeleton height={62} />
          <div style={{ display: "grid", gap: 10 }}>
            <Skeleton width="45%" height={22} />
            <Skeleton width="92%" height={14} />
            <Skeleton width="78%" height={14} />
          </div>
          <div className="report-chips">
            <Skeleton width={130} height={28} borderRadius={999} />
            <Skeleton width={80} height={28} borderRadius={999} />
            <Skeleton width={120} height={28} borderRadius={999} />
          </div>
          <dl className="detail-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gap: 7 }}>
                <Skeleton width="40%" height={12} />
                <Skeleton width="72%" height={16} />
              </div>
            ))}
          </dl>
          <Skeleton width="35%" height={20} />
          <div className="photo-grid">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={120} />)}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Skeleton width={150} height={42} />
            <Skeleton width={90} height={42} />
            <Skeleton width={100} height={42} />
          </div>
        </section>
        <aside className="report-side">
          <section className="panel" style={{ display: "grid", gap: 14 }}>
            <Skeleton width="55%" height={20} />
            <Skeleton height={50} />
            <Skeleton height={50} />
            <Skeleton height={50} />
          </section>
          <div className="panel flush" style={{ overflow: "hidden", minHeight: 400 }}>
            <Skeleton height={400} borderRadius={0} />
          </div>
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
