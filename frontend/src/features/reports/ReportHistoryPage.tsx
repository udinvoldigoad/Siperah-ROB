import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { fetchUserHistoryReports, OperatorReport, severityLabels, statusLabels } from "./reportData";
import { Icon } from "../../shared/components/Icon";

export function ReportHistoryPage() {
  const [reports, setReports] = useState<OperatorReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  useEffect(() => {
    fetchUserHistoryReports()
      .then((data) => setReports(data))
      .catch(() => setReports([]))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AppShell active="history" title="Riwayat Laporan" subtitle="Daftar laporan banjir rob yang pernah Anda kirimkan.">
      <div className="panel" style={{ padding: 24 }}>
        {isLoading ? (
          <div className="loading-state" style={{ padding: "40px 0", textAlign: "center", color: "var(--tx3)" }}>
            <Icon name="sync" className="spin" />
            <p style={{ marginTop: 8 }}>Memuat riwayat laporan...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 0", textAlign: "center", color: "var(--tx3)" }}>
            <Icon name="history" style={{ fontSize: 48, opacity: 0.5, marginBottom: 12 }} />
            <p>Belum ada riwayat laporan.</p>
          </div>
        ) : (
          <div className="report-history-list" style={{ display: "grid", gap: 16 }}>
            {reports.map((report) => (
              <div key={report.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1rem" }}>{report.code} - {report.village}</h3>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--tx2)" }}>{report.submittedAt}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className={`badge severity-${report.severity}`}>{severityLabels[report.severity]}</span>
                    <span className={`badge status-${report.status}`}>{statusLabels[report.status]}</span>
                  </div>
                </div>
                
                <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--tx1)" }}>{report.description}</p>
                
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.85rem", color: "var(--tx2)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="water_drop" style={{ fontSize: 16 }} /> {report.waterHeightCm ? `${report.waterHeightCm} cm` : "-"}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="location_on" style={{ fontSize: 16 }} /> {report.coordinates}
                  </span>
                  <span className={`badge ${report.isWithinMonitoringArea ? "b-done" : "b-pending"}`}>{report.isWithinMonitoringArea ? "Wilayah pantauan rob" : "Di luar cakupan prediksi"}</span>
                  {report.photos.length > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Icon name="image" style={{ fontSize: 16 }} /> {report.photos.length} Foto
                    </span>
                  )}
                </div>
                <button type="button" className="btn secondary" aria-expanded={expandedReportId === report.id} onClick={() => setExpandedReportId((current) => current === report.id ? null : report.id)} style={{ alignSelf: "flex-start", boxShadow: "none", marginTop: 4 }}>
                  <Icon name={expandedReportId === report.id ? "expand_less" : "visibility"} />
                  {expandedReportId === report.id ? "Tutup detail" : "Lihat detail"}
                </button>
                {expandedReportId === report.id && (
                  <section className="history-detail" aria-label={`Detail laporan ${report.code}`}>
                    <dl>
                      <div><dt>Waktu kejadian</dt><dd>{report.incidentTime}</dd></div>
                      <div><dt>Lokasi</dt><dd>{report.village}, {report.district}, {report.regency}</dd></div>
                      <div><dt>Koordinat</dt><dd>{report.coordinates}</dd></div>
                      <div><dt>Ketinggian air</dt><dd>{report.waterHeightCm !== null ? `${report.waterHeightCm} cm` : "Tidak dicatat"}</dd></div>
                      <div><dt>Status verifikasi</dt><dd>{statusLabels[report.status]}</dd></div>
                      <div><dt>Pelapor</dt><dd>{report.reporter}</dd></div>
                    </dl>
                    <div className="history-description"><strong>Keterangan kejadian</strong><p>{report.description || "Tidak ada keterangan tambahan."}</p></div>
                    {report.photos.length > 0 && <div className="history-photos">{report.photos.map((photo, index) => photo.url ? <a key={`${photo.name}-${index}`} href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.name} /><span>{photo.name}</span></a> : <span key={`${photo.name}-${index}`}><Icon name="image" /> {photo.name}</span>)}</div>}
                  </section>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
