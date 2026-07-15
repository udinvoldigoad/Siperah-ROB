import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { fetchUserHistoryReports, OperatorReport, severityLabels, statusLabels } from "./reportData";
import { Icon } from "../../shared/components/Icon";

function HistoryPhoto({ url, name }: { url?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return <span><Icon name="image_not_supported" /> {name}</span>;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      <span>{name}</span>
    </a>
  );
}

export function ReportHistoryPage() {
  const [reports, setReports] = useState<OperatorReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, total: 0, from: 0, to: 0 });

  const loadReports = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetchUserHistoryReports(page)
      .then((data) => {
        setReports(data.reports);
        setPagination({ currentPage: data.currentPage, lastPage: data.lastPage, total: data.total, from: data.from, to: data.to });
      })
      .catch((reason: unknown) => {
        setReports([]);
        setError(reason instanceof Error ? reason.message : "Riwayat laporan belum bisa dimuat.");
      })
      .finally(() => setIsLoading(false));
  }, [page]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const changePage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > pagination.lastPage || nextPage === page) return;
    setExpandedReportId(null);
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pageNumbers = Array.from({ length: pagination.lastPage }, (_, index) => index + 1)
    .filter((value) => pagination.lastPage <= 7 || value === 1 || value === pagination.lastPage || Math.abs(value - pagination.currentPage) <= 1);

  return (
    <AppShell active="history" title="Riwayat Laporan" subtitle="Daftar laporan banjir rob yang pernah Anda kirimkan.">
      <style>{`
        .history-page { margin:0 auto; max-width:1050px; }
        .history-toolbar { align-items:center; display:flex; gap:16px; justify-content:space-between; margin-bottom:18px; }
        .history-toolbar strong { display:block; font-size:14px; }
        .history-toolbar span { color:var(--ink-soft); font-size:12px; }
        .history-report-card { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:20px; transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease; }
        .history-report-card:hover { border-color:#bae6fd; box-shadow:0 14px 32px rgba(15,23,42,.07); transform:translateY(-2px); }
        .history-detail-button { background:#e0f2fe!important; border-color:#7dd3fc!important; color:#0369a1!important; font-weight:700; }
        .history-detail-button:hover { background:#bae6fd!important; border-color:#38bdf8!important; }
        .history-pagination { align-items:center; border-top:1px solid var(--line); display:flex; gap:8px; justify-content:space-between; margin-top:24px; padding-top:20px; }
        .history-page-buttons { display:flex; flex-wrap:wrap; gap:6px; }
        .history-page-button { align-items:center; background:var(--surface); border:1px solid var(--line); border-radius:8px; color:var(--ink); cursor:pointer; display:inline-flex; height:38px; justify-content:center; min-width:38px; padding:0 11px; }
        .history-page-button:hover:not(:disabled) { background:var(--surface-soft); border-color:#7dd3fc; }
        .history-page-button.active { background:#0284c7; border-color:#0284c7; color:#fff; font-weight:800; }
        .history-page-button:disabled { cursor:not-allowed; opacity:.45; }
        .history-badge-monitored { background:#ecfdf3; border-color:#bbf7d0; color:#166534; }
        .history-badge-outside { background:#fffbeb; border-color:#fde68a; color:#92400e; }
        @media(max-width:640px){.history-toolbar,.history-pagination{align-items:stretch;flex-direction:column}.history-page-buttons{justify-content:center}.history-report-card{padding:16px}}
      `}</style>
      <div className="panel history-page" style={{ padding: 24 }}>
        {!isLoading && reports.length > 0 && <div className="history-toolbar"><div><strong>{pagination.total} laporan tersimpan</strong><span>Menampilkan {pagination.from}-{pagination.to} dari {pagination.total} laporan</span></div><span>15 laporan per halaman</span></div>}
        {isLoading ? (
          <div className="loading-state" style={{ padding: "40px 0", textAlign: "center", color: "var(--tx3)" }}>
            <Icon name="sync" className="spin" />
            <p style={{ marginTop: 8 }}>Memuat riwayat laporan...</p>
          </div>
        ) : error ? (
          <div className="empty-state" style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-soft)", display: "grid", justifyItems: "center", gap: 4 }}>
            <Icon name="error" style={{ fontSize: 48, color: "var(--critical)", opacity: 0.85, marginBottom: 8 }} />
            <strong style={{ color: "var(--ink)" }}>Gagal memuat riwayat</strong>
            <p style={{ margin: "0 0 12px" }}>{error}</p>
            <button type="button" className="btn secondary" onClick={loadReports}>
              <Icon name="refresh" /> Coba lagi
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 0", textAlign: "center", color: "var(--tx3)" }}>
            <Icon name="history" style={{ fontSize: 48, opacity: 0.5, marginBottom: 12 }} />
            <p>Belum ada riwayat laporan.</p>
          </div>
        ) : (
          <div className="report-history-list" style={{ display: "grid", gap: 16 }}>
            {reports.map((report) => (
              <div key={report.id} className="history-report-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>KODE: {report.code}</span>
                    <h3 style={{ margin: "4px 0", fontSize: "1.35rem", color: "var(--ink)" }}>{report.village}</h3>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-soft)" }}>Dilaporkan {report.submittedAt}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className={`badge severity-${report.severity}`}>{severityLabels[report.severity]}</span>
                    <span className={`badge status-${report.status}`}>{statusLabels[report.status]}</span>
                  </div>
                </div>
                
                {report.description && (
                  <div style={{ padding: "12px 16px", background: "var(--surface-soft)", borderRadius: 8, borderLeft: "3px solid var(--accent)", fontSize: "0.95rem", color: "var(--ink)", lineHeight: 1.6 }}>
                    {report.description}
                  </div>
                )}
                
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: "0.85rem", color: "var(--ink)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-soft)", padding: "6px 14px", borderRadius: 20 }}>
                    <Icon name="schedule" style={{ fontSize: 16, color: "var(--accent)" }} /> <strong>{report.incidentTime}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-soft)", padding: "6px 14px", borderRadius: 20 }}>
                    <Icon name="water_drop" style={{ fontSize: 16, color: "var(--accent)" }} /> <strong>{report.waterHeightCm ? `${report.waterHeightCm} cm` : "-"}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-soft)", padding: "6px 14px", borderRadius: 20 }}>
                    <Icon name="location_on" style={{ fontSize: 16, color: "var(--accent)" }} /> <span>{report.coordinates}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-soft)", padding: "6px 14px", borderRadius: 20 }}>
                    <Icon name={report.isWithinMonitoringArea ? "my_location" : "location_disabled"} style={{ fontSize: 16, color: report.isWithinMonitoringArea ? "var(--success)" : "var(--ink-soft)" }} />
                    <span style={{ color: report.isWithinMonitoringArea ? "var(--success)" : "var(--ink-soft)", fontWeight: 600 }}>{report.isWithinMonitoringArea ? "Pantauan ROB" : "Di luar area"}</span>
                  </div>
                  {report.photos.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-soft)", padding: "6px 14px", borderRadius: 20 }}>
                      <Icon name="image" style={{ fontSize: 16, color: "var(--accent)" }} /> <strong>{report.photos.length} Foto</strong>
                    </div>
                  )}
                </div>
                <button type="button" className="btn secondary history-detail-button" aria-expanded={expandedReportId === report.id} onClick={() => setExpandedReportId((current) => current === report.id ? null : report.id)} style={{ width: "100%", justifyContent: "center", marginTop: 8, padding: "10px" }}>
                  <Icon name={expandedReportId === report.id ? "expand_less" : "expand_more"} />
                  {expandedReportId === report.id ? "Tutup Detail Laporan" : "Lihat Detail Laporan"}
                </button>
                {expandedReportId === report.id && (
                  <section className="history-detail" aria-label={`Detail laporan ${report.code}`}>
                    <dl>
                      <div><dt>Waktu kejadian</dt><dd>{report.incidentTime}</dd></div>
                      <div><dt>Lokasi</dt><dd>{report.village}, {report.district}, {report.regency}</dd></div>
                      <div><dt>Koordinat</dt><dd>{report.coordinates}</dd></div>
                      <div><dt>Ketinggian air</dt><dd>{report.waterHeightCm !== null ? `${report.waterHeightCm} cm` : "Tidak dicatat"}</dd></div>
                      <div><dt>Status verifikasi</dt><dd><span className={`badge status-${report.status}`}>{statusLabels[report.status]}</span></dd></div>
                      <div><dt>Pelapor</dt><dd>{report.reporter}</dd></div>
                    </dl>
                    <div className="history-description"><strong>Keterangan kejadian</strong><p>{report.description || "Tidak ada keterangan tambahan."}</p></div>
                    {report.photos.length > 0 && <div className="history-photos">{report.photos.map((photo, index) => <HistoryPhoto key={`${photo.name}-${index}`} url={photo.url} name={photo.name} />)}</div>}
                  </section>
                )}
              </div>
            ))}
          </div>
        )}
        {!isLoading && !error && pagination.lastPage > 1 && <nav className="history-pagination" aria-label="Pagination riwayat laporan"><span style={{ color: "var(--ink-soft)", fontSize: 12 }}>Halaman {pagination.currentPage} dari {pagination.lastPage}</span><div className="history-page-buttons"><button type="button" className="history-page-button" disabled={page === 1} onClick={() => changePage(page - 1)} aria-label="Halaman sebelumnya"><Icon name="chevron_left" /></button>{pageNumbers.map((number, index) => <span key={number} style={{ display: "contents" }}>{index > 0 && number - pageNumbers[index - 1] > 1 && <span style={{ alignSelf: "center", padding: "0 3px" }}>…</span>}<button type="button" className={`history-page-button ${number === pagination.currentPage ? "active" : ""}`} onClick={() => changePage(number)} aria-current={number === pagination.currentPage ? "page" : undefined}>{number}</button></span>)}<button type="button" className="history-page-button" disabled={page === pagination.lastPage} onClick={() => changePage(page + 1)} aria-label="Halaman berikutnya"><Icon name="chevron_right" /></button></div></nav>}
      </div>
    </AppShell>
  );
}
