import { useEffect, useRef, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { useToast } from "../../shared/components/Toast";
import { fetchOperatorReports, severityLabels, updateOperatorReportStatus, type OperatorReport, type ReportSeverity } from "../reports/reportData";
import { api, apiBase } from "../../shared/api/client";
import { Icon } from "../../shared/components/Icon";
import { motion, AnimatePresence } from "framer-motion";

const containerVariants: any = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, ease: "easeOut" }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

type OperatorSummary = {
  monitored_villages: number;
  critical_villages: number;
  pending_reports: number;
  monthly_validations: number;
  operator_regency?: string | null;
  region_statuses: {
    id: string;
    village: string | null;
    district: string | null;
    regency: string | null;
    population: number | null;
    risk_class: string;
    risk_probability: number;
  }[];
};

type OperatorSummaryResponse = { data: OperatorSummary };

export function OperatorDashboardPage() {
  const [reports, setReports] = useState<OperatorReport[]>([]);
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ currentPage: 1, lastPage: 1, total: 0, from: 0, to: 0 });
  const [summary, setSummary] = useState<OperatorSummary>({
    monitored_villages: 0,
    critical_villages: 0,
    pending_reports: 0,
    monthly_validations: 0,
    region_statuses: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<ReportSeverity | "">("");
  const [slaOverdue, setSlaOverdue] = useState(false);
  const [activeTab, setActiveTab] = useState<"antrean" | "riwayat">("antrean");
  // Untuk mendeteksi kedatangan laporan baru antar polling (null = belum ada baseline).
  const prevPendingRef = useRef<number | null>(null);
  // Panel antrean — target scroll dari tombol "Lihat laporan" di banner.
  const queueRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const loadReports = async (targetPage = page) => {
    setIsLoading(true);
    try {
      const statusFilter = activeTab === "riwayat" ? "divalidasi,ditolak" : "menunggu,perlu_review";
      const [data, summaryRes] = await Promise.all([
        fetchOperatorReports(targetPage, 20, { severity: severityFilter, slaOverdue, status: statusFilter }),
        api<OperatorSummaryResponse>("/dashboard/operator/summary"),
      ]);

      // Alert laporan baru: bila jumlah antrean bertambah sejak polling terakhir
      // (bukan pemuatan pertama), beri tahu operator tanpa refresh manual.
      const newPending = summaryRes.data.pending_reports;
      if (prevPendingRef.current !== null && newPending > prevPendingRef.current) {
        const delta = newPending - prevPendingRef.current;
        toast.info(`${delta} laporan baru masuk ke antrean.`);
      }
      prevPendingRef.current = newPending;
      // Kalau laporan di halaman ini habis tervalidasi/tolak dan halaman jadi kosong
      // (bukan halaman pertama), mundur satu halaman alih-alih menampilkan antrean kosong palsu.
      if (data.reports.length === 0 && data.currentPage > 1 && data.total > 0) {
        return loadReports(data.currentPage - 1);
      }
      setReports(data.reports);
      setPage(data.currentPage);
      setPageMeta({ currentPage: data.currentPage, lastPage: data.lastPage, total: data.total, from: data.from, to: data.to });
      setSummary(summaryRes.data);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat antrean laporan.");
    } finally {
      setIsLoading(false);
    }
  };

  // Muat ulang & reset polling saat filter berubah; polling menyegarkan halaman 1
  // (laporan terbaru tampil di atas berdasarkan created_at desc).
  useEffect(() => {
    loadReports(1);
    const timer = window.setInterval(() => loadReports(1), 30000);
    return () => window.clearInterval(timer);
  }, [severityFilter, slaOverdue, activeTab]);

  const changePage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > pageMeta.lastPage || nextPage === page) return;
    void loadReports(nextPage);
  };

  const handleValidate = async (report: OperatorReport) => {
    try {
      await updateOperatorReportStatus(report.id, "divalidasi");
      await loadReports();
      toast.success(`Laporan ${report.code} berhasil divalidasi ke database.`);
    } catch (err: any) {
      toast.error("Gagal melakukan validasi laporan.");
    }
  };

  const handleReject = async (report: OperatorReport) => {
    try {
      await updateOperatorReportStatus(report.id, "ditolak", "Ditolak oleh operator BPBD");
      await loadReports();
      toast.info(`Laporan ${report.code} telah ditolak.`);
    } catch (err: any) {
      toast.error("Gagal melakukan penolakan laporan.");
    }
  };

  // Total antrean sebenarnya dari backend (summary.pending_reports), bukan hitungan
  // halaman ini saja -- dengan paginasi, `reports` cuma memuat laporan halaman aktif.
  const pendingCount = summary.pending_reports;
  const triageCountOnPage = reports.filter((r) => !r.isWithinMonitoringArea || r.status === "perlu_review").length;
  const operatorArea = summary.operator_regency ?? "wilayah kerja operator";

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("siperah-token");
      const response = await fetch(`${apiBase}/dashboard/operator/reports/export`, {
        headers: {
          Accept: "text/csv",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error("Gagal mengunduh export laporan.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "dashboard-operator-laporan.csv";
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Export laporan operator berhasil diunduh.");
    } catch (err: any) {
      toast.error(err.message || "Gagal export laporan operator.");
    }
  };

  return (
    <AppShell active="operator" title="Dashboard Operator BPBD">
      <style>{`
        .operator-pagination { align-items: center; border-top: 1px solid var(--line); display: flex; gap: 8px; justify-content: space-between; padding: 14px 24px; flex-wrap: wrap; }
        .operator-page-btn { align-items: center; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; color: var(--ink); cursor: pointer; display: inline-flex; height: 34px; justify-content: center; min-width: 34px; padding: 0 10px; }
        .operator-page-btn:hover:not(:disabled) { background: var(--surface-soft); border-color: var(--accent); }
        .operator-page-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 800; }
        .operator-page-btn:disabled { cursor: not-allowed; opacity: .45; }
        .dashboard-split-layout { display: grid; gap: 24px; }

        /* KPI operator: kartu lebih ringkas & angka berukuran standar/modern
           (bukan 3rem tipis). Di-scope ke .operator-kpis agar dashboard lain
           tak ikut berubah. */
        .metric-grid.operator-kpis .metric-card { min-height: 0; padding: 18px 20px; gap: 6px; }
        .metric-grid.operator-kpis .metric-card span { font-size: 12px; font-weight: 600; }
        .metric-grid.operator-kpis .metric-card strong { font-size: 1.8rem; font-weight: 700; }
        .metric-grid.operator-kpis .metric-card small { font-size: 11px; }
        /* 2 kolom di mobile (override aturan global 1fr !important di ≤768px);
           spesifisitas .metric-grid.operator-kpis + !important memenangkannya. */
        @media (max-width: 768px) {
          .metric-grid.operator-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px; }
        }

        /* Header panel antrean: switcher + subjudul + filter, ditumpuk rapi. */
        .op-panel-head { padding: 18px 20px; border-bottom: 1px solid var(--line); display: grid; gap: 14px; }

        /* Switcher tab modern (segmented control). */
        .op-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: var(--surface-soft); border: 1px solid var(--line); border-radius: 12px; padding: 4px; width: 100%; max-width: 400px; }
        .op-tab { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; background: transparent; color: var(--ink-soft); font: inherit; font-size: 0.9rem; font-weight: 600; padding: 9px 10px; border-radius: 9px; cursor: pointer; transition: background .15s, color .15s, box-shadow .15s; }
        .op-tab:hover { color: var(--ink); }
        .op-tab.active { background: var(--surface); color: var(--accent); box-shadow: 0 1px 3px rgba(15, 23, 42, .12); }
        .op-tab-count { font-size: 11px; font-weight: 800; line-height: 1; background: var(--critical); color: #fff; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; }

        .op-subtitle { color: var(--ink-soft); font-size: 12px; }

        /* Filter 3 kolom satu baris; Export CSV hijau. */
        .op-filter-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; max-width: 520px; }
        .op-filter-select, .op-filter-btn { min-width: 0; width: 100%; height: 40px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 600; padding: 0 10px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
        .op-filter-btn { white-space: nowrap; overflow: hidden; }
        .op-filter-btn .op-btn-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .op-filter-btn:hover { border-color: var(--accent); }
        .op-filter-btn.active { background: var(--critical); border-color: var(--critical); color: #fff; }
        .op-filter-btn.export { background: var(--low); border-color: var(--low); color: #fff; }
        .op-filter-btn.export:hover { border-color: var(--low); filter: brightness(0.94); }

        /* Baris laporan: rapi & proporsional. */
        .op-report-row { padding: 18px 20px; }
        .op-report-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .op-report-head > div:first-child { min-width: 0; }
        .op-report-badges { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .op-report-desc { font-size: 14px; color: var(--ink); margin: 12px 0 0; padding: 14px 16px; background: var(--surface-soft); border-radius: var(--radius); }
        .op-report-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }

        @media (max-width: 768px) {
          .op-panel-head { padding: 16px; }
          .op-tabs { max-width: none; }
          /* Label tombol filter diringkas ("SLA"/"Export") agar muat 3 kolom. */
          .op-btn-suffix { display: none; }
          .op-report-row { padding: 16px; }
          /* Badge severity/SLA turun ke bawah judul (chip) agar tak menekan judul. */
          .op-report-head { flex-direction: column; }
          .op-report-badges { flex-direction: row; flex-wrap: wrap; align-items: flex-start; }
          /* Aksi proporsional: Validasi full-width, Tolak & Detail berbagi baris. */
          .op-report-actions { flex-wrap: wrap; justify-content: stretch; }
          .op-report-actions .btn { flex: 1 1 calc(50% - 5px); min-width: 0; justify-content: center; padding: 11px 12px; }
          .op-report-actions .op-act-primary { flex-basis: 100%; }
        }
      `}</style>
      <motion.div
        className="content"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Alert Banner */}
        <motion.div variants={itemVariants} className="alert" style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: "1 1 300px" }}>
            <motion.div 
              animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }} 
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              style={{ flexShrink: 0 }}
            >
              <Icon name="warning" style={{ fontSize: "24px", color: "#7a1a13" }} />
            </motion.div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "15px", fontWeight: 600 }}>
                {pendingCount} laporan baru/review di {operatorArea} · dicek otomatis tiap 30 detik
              </div>
              <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "2px" }}>
                {triageCountOnPage > 0 ? `${triageCountOnPage} dari ${reports.length} laporan pada halaman ini berada di luar wilayah pantauan rob.` : "Utamakan validasi laporan dengan tingkat keparahan Sangat Parah."}
              </div>
            </div>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="btn primary"
            style={{ background: "#7a1a13", borderColor: "#7a1a13", fontSize: "13px", whiteSpace: "nowrap" }}
          >
            Lihat laporan <Icon name="arrow_downward" style={{ fontSize: "16px" }} />
          </motion.button>
        </motion.div>

        {/* KPI Grid */}
        <motion.div variants={containerVariants} className="metric-grid operator-kpis" style={{ marginBottom: "32px" }}>
          {[
            { title: "Kelurahan pantau aktif", val: summary.monitored_villages, sub: "wilayah pesisir", cls: "" },
            { title: "Bahaya Sangat Tinggi", val: summary.critical_villages, sub: "kelurahan hari ini", cls: "critical" },
            { title: "Laporan menunggu", val: summary.pending_reports, sub: "perlu validasi", cls: "medium", customColor: "var(--medium)" },
            { title: "Validasi bulan ini", val: summary.monthly_validations, sub: "laporan disetujui", cls: "success" }
          ].map((kpi, idx) => (
            <motion.div 
              key={idx}
              variants={itemVariants} 
              whileHover={{ y: -6, boxShadow: "0 12px 32px rgba(0,0,0,0.08)" }}
              className={`metric-card ${kpi.cls}`}
            >
              <span style={{ color: kpi.customColor ? "var(--ink-soft)" : undefined }}>{kpi.title}</span>
              <motion.strong 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 + (idx * 0.1), type: "spring", stiffness: 200 }}
                style={{ color: kpi.customColor }}
              >
                {kpi.val}
              </motion.strong>
              <small style={{ color: kpi.customColor ? "var(--ink-soft)" : undefined }}>{kpi.sub}</small>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Content Layout */}
        <motion.div variants={itemVariants} className="dashboard-split-layout">
          {/* Antrean Moderasi */}
          <div className="panel flush" ref={queueRef} style={{ scrollMarginTop: 16 }}>
            <div className="op-panel-head">
              <div className="op-tabs" role="tablist" aria-label="Tampilan laporan">
                <button
                  type="button" role="tab" aria-selected={activeTab === "antrean"}
                  className={`op-tab ${activeTab === "antrean" ? "active" : ""}`}
                  onClick={() => setActiveTab("antrean")}
                >
                  Laporan Masuk
                  {pendingCount > 0 && <span className="op-tab-count">{pendingCount}</span>}
                </button>
                <button
                  type="button" role="tab" aria-selected={activeTab === "riwayat"}
                  className={`op-tab ${activeTab === "riwayat" ? "active" : ""}`}
                  onClick={() => setActiveTab("riwayat")}
                >
                  Riwayat Validasi
                </button>
              </div>
              <span className="op-subtitle">
                {operatorArea} · {pageMeta.total === 0 ? "tidak ada laporan pada filter ini" : `menampilkan ${pageMeta.from}-${pageMeta.to} dari ${pageMeta.total} laporan`}
                {(severityFilter || slaOverdue) && <> · <button type="button" onClick={() => { setSeverityFilter(""); setSlaOverdue(false); }} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, padding: 0, fontWeight: 600 }}>reset filter</button></>}
              </span>
              <div className="op-filter-row">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as ReportSeverity | "")}
                  aria-label="Filter keparahan laporan"
                  className="op-filter-select"
                >
                  <option value="">Semua keparahan</option>
                  <option value="sangat_parah">Sangat parah</option>
                  <option value="parah">Parah</option>
                  <option value="sedang">Sedang</option>
                  <option value="ringan">Ringan</option>
                </select>
                <button
                  type="button"
                  className={`op-filter-btn ${slaOverdue ? "active" : ""}`}
                  aria-pressed={slaOverdue}
                  onClick={() => setSlaOverdue((v) => !v)}
                >
                  <Icon name="schedule" style={{ fontSize: 18 }} /> <span className="op-btn-label">SLA<span className="op-btn-suffix"> terlambat</span></span>
                </button>
                <motion.button whileHover={{ y: -1 }} type="button" className="op-filter-btn export" onClick={handleExport}>
                  <Icon name="download" style={{ fontSize: 18 }} /> <span className="op-btn-label">Export<span className="op-btn-suffix"> CSV</span></span>
                </motion.button>
              </div>
            </div>

            <div className="report-list" style={{ border: "none", borderRadius: 0, maxHeight: "500px", overflowY: "auto" }}>
              {isLoading ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-soft)" }}>Memuat laporan...</div>
              ) : reports.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="report-empty" style={{ textAlign: "center", padding: "64px 20px" }}>
                  <Icon name="verified_user" style={{ fontSize: "48px", color: "var(--low)", margin: "0 auto 16px" }} />
                  <strong>Antrean Bersih</strong>
                  <span>Semua laporan telah diverifikasi.</span>
                </motion.div>
              ) : (
                <AnimatePresence>
                  {reports.map((report) => (
                    <motion.div
                      key={report.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className={`report-row op-report-row severity-left-${report.severity}`}
                      style={{ display: "block" }}
                    >
                      <div className="op-report-head">
                        <div>
                          <div className="report-title" style={{ fontSize: "15px" }}>Kel. {report.village} &bull; Kec. {report.district}</div>
                          <p>Dilaporkan: {report.submittedAt} &bull; oleh warga ({report.waterHeightCm ? `${report.waterHeightCm} cm` : "-"})</p>
                          {!report.isWithinMonitoringArea && <p style={{ color: "var(--medium)", fontWeight: 700 }}>Triase: lokasi di luar wilayah pantauan rob, tetapi masih dalam {report.regency}.</p>}
                        </div>
                        <div className="op-report-badges">
                          <span className={`badge severity-${report.severity}`}>
                            {severityLabels[report.severity]}
                          </span>
                          {report.slaStatus === "terlambat" && (
                            <span className="badge" style={{ background: "var(--critical)", color: "#fff", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Icon name="schedule" style={{ fontSize: 14 }} /> SLA terlambat
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="op-report-desc">
                        "{report.description}"
                      </div>
                      <div className="op-report-actions">
                        {activeTab === "antrean" && (
                          <>
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn primary op-act-primary" style={{ background: "var(--low)", padding: "10px 20px", color: "#fff", border: "none" }} onClick={() => handleValidate(report)}>
                              <Icon name="check_circle" /> Validasi Laporan
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn secondary" style={{ color: "var(--critical)", padding: "10px 20px" }} onClick={() => handleReject(report)}>
                              <Icon name="close" /> Tolak
                            </motion.button>
                          </>
                        )}
                        <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} href={`#/operator/reports/${report.id}`} className="btn secondary" style={{ padding: "10px 20px" }}>
                          <Icon name="visibility" /> Detail
                        </motion.a>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {!isLoading && pageMeta.lastPage > 1 && (
              <nav className="operator-pagination" aria-label="Navigasi halaman antrean laporan">
                <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>Halaman {pageMeta.currentPage} dari {pageMeta.lastPage}</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button type="button" className="operator-page-btn" disabled={page <= 1} onClick={() => changePage(page - 1)} aria-label="Halaman sebelumnya">
                    <Icon name="chevron_left" />
                  </button>
                  {Array.from({ length: pageMeta.lastPage }, (_, i) => i + 1)
                    .filter((n) => pageMeta.lastPage <= 7 || n === 1 || n === pageMeta.lastPage || Math.abs(n - pageMeta.currentPage) <= 1)
                    .map((n, i, arr) => (
                      <span key={n} style={{ display: "contents" }}>
                        {i > 0 && n - arr[i - 1] > 1 && <span style={{ alignSelf: "center", padding: "0 3px" }}>…</span>}
                        <button type="button" className={`operator-page-btn ${n === pageMeta.currentPage ? "active" : ""}`} onClick={() => changePage(n)} aria-current={n === pageMeta.currentPage ? "page" : undefined}>{n}</button>
                      </span>
                    ))}
                  <button type="button" className="operator-page-btn" disabled={page >= pageMeta.lastPage} onClick={() => changePage(page + 1)} aria-label="Halaman berikutnya">
                    <Icon name="chevron_right" />
                  </button>
                </div>
              </nav>
            )}
          </div>

          {/* Status Kelurahan */}
          <div className="panel flush">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Status Kelurahan {operatorArea}</h2>
              <motion.a whileHover={{ x: 5 }} href="#/map" style={{ fontSize: "0.9rem", color: "var(--accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}><Icon name="map" /> Buka peta</motion.a>
            </div>
              <div className="table-responsive" style={{ maxHeight: "500px", overflowY: "auto" }}>
                <table className="data-table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--surface-soft)" }}>
                  <th style={{ padding: "14px 24px", fontWeight: 600, color: "var(--ink-soft)", fontSize: "0.85rem" }}>Kecamatan / Kelurahan</th>
                  <th style={{ padding: "14px 24px", fontWeight: 600, color: "var(--ink-soft)", fontSize: "0.85rem" }}>Bahaya</th>
                  <th style={{ padding: "14px 24px", fontWeight: 600, color: "var(--ink-soft)", fontSize: "0.85rem", textAlign: "right" }}>Pop. risiko</th>
                </tr>
              </thead>
              <tbody>
                {summary.region_statuses.map((row, idx) => {
                  const severityClass = row.risk_class === "sangat_tinggi" ? "sangat_parah" : row.risk_class === "tinggi" ? "parah" : row.risk_class === "rendah" ? "ringan" : row.risk_class;
                  const label = row.risk_class === "sangat_tinggi" ? "Sangat Tinggi" : row.risk_class.charAt(0).toUpperCase() + row.risk_class.slice(1);
                  return (
                  <motion.tr 
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + (idx * 0.05) }}
                    
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <td style={{ padding: "16px 24px", fontWeight: 500 }}>{row.village ?? row.district ?? "Wilayah pantau"}<div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>{row.district ?? "-"}, {row.regency ?? "-"}</div></td>
                    <td style={{ padding: "16px 24px" }}><span className={`badge severity-${severityClass}`}>{label}</span></td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>{Number(row.population ?? 0).toLocaleString("id-ID")}</td>
                  </motion.tr>
                );})}
                {summary.region_statuses.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: "16px 24px", color: "var(--ink-soft)" }}>Belum ada data prediksi wilayah operator.</td></tr>
                )}
                </tbody>
              </table>
              </div>
          </div>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}

