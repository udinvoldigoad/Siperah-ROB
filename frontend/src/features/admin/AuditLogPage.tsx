import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { api, apiUrl } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";
import { LoadingBlock } from "../../shared/components/LoadingBlock";
import { EmptyState } from "../../shared/components/EmptyState";
import { roleLabel } from "../../shared/constants/roles";
import { motion } from "framer-motion";

interface AuditLogData {
  id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  target_resource: string | null;
  outcome: "success" | "fail" | "denied" | "partial";
  ip_address: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface AuditMeta {
  current_page: number;
  last_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface AuditSummary {
  total: number;
  success: number;
  denied: number;
  fail: number;
  partial: number;
}

interface AuditLogResponse {
  data: AuditLogData[];
  meta?: AuditMeta;
  summary?: AuditSummary;
}

const outcomes: Record<string, string> = {
  success: "Berhasil",
  fail: "Gagal",
  denied: "Ditolak",
  partial: "Sebagian",
};

const containerVariants: any = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

// Label ramah untuk action string yang benar-benar dicatat backend
// (AuditService::write / EnsureRole / AuthenticateApiKey). Kunci harus PERSIS
// sama dengan yang disimpan, jika tidak label mentah yang tampil.
const actionLabels: Record<string, string> = {
  login: "Login",
  logout: "Logout",
  register: "Registrasi Akun",
  create_report: "Membuat Laporan",
  validate_report: "Memvalidasi Laporan",
  reject_report: "Menolak Laporan",
  update_report_status: "Update Status Laporan",
  create_user: "Membuat Pengguna",
  approve_user: "Menyetujui Pengguna",
  reject_user: "Menolak Pengguna",
  update_user: "Ubah Data Pengguna",
  delete_user: "Hapus Pengguna",
  export_users: "Ekspor Pengguna",
  export_operator_reports: "Ekspor Laporan Operator",
  export_province_dashboard: "Ekspor Dashboard Provinsi",
  download_research_dataset: "Unduh Dataset Riset",
  regenerate_api_key: "Regenerasi API Key",
  api_key_request: "Permintaan API Key",
  access_denied: "Akses Ditolak",
  update_notification_settings: "Update Konfigurasi Notifikasi",
};

function formatTargetResource(target: string | null): string {
  if (!target) return "-";
  return target.replace("ground_truth_reports:", "ID Laporan: ")
               .replace("datasets:", "ID Dataset: ")
               .replace("users:", "ID Pengguna: ")
               .replace("api_keys:", "ID API Key: ");
}

export function AuditLogPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLogData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<AuditMeta | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);

  // Filters
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(() => {
    setIsLoading(true);
    setError(null);
    const query = new URLSearchParams();
    if (action) query.append("action", action);
    if (outcome) query.append("outcome", outcome);
    if (search) query.append("search", search);
    query.append("page", String(page));

    api<AuditLogResponse>(`/admin/audit-logs?${query.toString()}`)
      .then((res) => {
        setLogs(res.data);
        setMeta(res.meta ?? null);
        setSummary(res.summary ?? null);
      })
      .catch((err: unknown) => {
        setLogs([]);
        setError(err instanceof Error ? err.message : "Log audit belum bisa dimuat.");
      })
      .finally(() => setIsLoading(false));
  }, [action, outcome, search, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Ubah filter → kembali ke halaman 1 (setPage(1) tanpa efek ganda saat sudah di 1).
  const onFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const changePage = (next: number) => {
    if (!meta || next < 1 || next > meta.last_page || next === page) return;
    setPage(next);
  };

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleString("id-ID", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const handleExportAudit = async () => {
    try {
      const query = new URLSearchParams();
      if (action) query.append("action", action);
      if (outcome) query.append("outcome", outcome);
      if (search) query.append("search", search);
      query.append("format", "csv");
      const token = localStorage.getItem("siperah-token");
      const response = await fetch(apiUrl(`/api/admin/audit-logs?${query.toString()}`), {
        headers: { Accept: "text/csv", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) throw new Error(`Export gagal (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "audit_logs.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Export audit log berhasil diunduh.");
    } catch (err: any) {
      toast.error(err.message || "Gagal export audit log.");
    }
  };

  const kpis = [
    { title: "Aktivitas Berhasil", val: summary?.success ?? 0, sub: "Berjalan aman tanpa error", cls: "success" },
    { title: "Akses Ditolak", val: summary?.denied ?? 0, sub: "Potensi masalah keamanan", cls: (summary?.denied ?? 0) > 0 ? "critical" : "" },
    { title: "Gagal / Sebagian", val: (summary?.fail ?? 0) + (summary?.partial ?? 0), sub: "Perlu pemeriksaan berkala", cls: "" },
    { title: "Total Catatan", val: summary?.total ?? 0, sub: "Seluruh entri log tersimpan", cls: "" },
  ];

  const pageNumbers = meta
    ? Array.from({ length: meta.last_page }, (_, i) => i + 1).filter(
        (n) => meta.last_page <= 7 || n === 1 || n === meta.last_page || Math.abs(n - meta.current_page) <= 1,
      )
    : [];

  return (
    <AppShell active="audit" title="Audit Log Aktivitas">
      <style>{`
        .audit-pagination { align-items: center; border-top: 1px solid var(--line); display: flex; gap: 8px; justify-content: space-between; padding: 16px 24px; flex-wrap: wrap; }
        .audit-page-btn { align-items: center; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; color: var(--ink); cursor: pointer; display: inline-flex; height: 36px; justify-content: center; min-width: 36px; padding: 0 10px; }
        .audit-page-btn:hover:not(:disabled) { background: var(--surface-soft); border-color: var(--accent); }
        .audit-page-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 800; }
        .audit-page-btn:disabled { cursor: not-allowed; opacity: .45; }

        /* Rapikan jarak kolom: tabel menyusut ke isi (bukan direntang 100%)
           supaya tiap kolom rapat ke kontennya — tak ada kolom lebar dengan
           teks pendek rata-kiri yang tampak seperti celah menganga. Tetap
           bisa digeser horizontal di layar sempit. */
        .table-responsive .audit-table { width: max-content !important; min-width: 0 !important; }
        .audit-table thead th { padding: 14px 18px !important; }
        .audit-table tbody td { padding: 13px 18px !important; }
        .audit-table thead th:first-child, .audit-table tbody td:first-child { padding-left: 22px !important; }
        .audit-table thead th:last-child, .audit-table tbody td:last-child { padding-right: 22px !important; }

        /* Filter modern: kontrol seragam, grid rapi di mobile. */
        .audit-filter { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
        .audit-control { height: 42px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: inherit; font-size: 13px; padding: 0 12px; box-sizing: border-box; }
        select.audit-control { cursor: pointer; min-width: 170px; }
        .audit-control:focus, .audit-search input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37, 99, 235, .15); }
        .audit-search { position: relative; flex: 1; min-width: 200px; }
        .audit-search input { height: 42px; width: 100%; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: inherit; font-size: 13px; padding: 0 12px 0 38px; box-sizing: border-box; }

        @media (max-width: 768px) {
          .audit-filter { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .audit-control { width: 100%; min-width: 0 !important; padding: 0 10px; }
          .audit-search { grid-column: 1 / -1; min-width: 0; }

          /* KPI jadi 2 kolom di mobile (override aturan global 1fr !important). */
          .metric-grid.audit-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px !important; }
          .metric-grid.audit-kpis .metric-card { padding: 18px !important; }
          .metric-grid.audit-kpis .metric-card span { font-size: 12px !important; }
          .metric-grid.audit-kpis .metric-card strong { font-size: 28px !important; }
          .metric-grid.audit-kpis .metric-card small { font-size: 11px !important; }
        }
      `}</style>
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="content" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>

        {/* KPI Grid */}
        <motion.div variants={itemVariants} className="metric-grid audit-kpis" style={{ marginBottom: 32 }}>
          {kpis.map((kpi, idx) => (
            <motion.div
              key={idx}
              whileHover={{ y: -6, boxShadow: "0 12px 32px rgba(0,0,0,0.08)" }}
              className={`metric-card ${kpi.cls}`}
            >
              <span>{kpi.title}</span>
              <motion.strong
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 + (idx * 0.1), type: "spring", stiffness: 200 }}
              >
                {kpi.val}
              </motion.strong>
              <small>{kpi.sub}</small>
            </motion.div>
          ))}
        </motion.div>

        {/* Audit Log Panel */}
        <motion.div variants={itemVariants} className="panel flush" style={{ overflow: "hidden", marginBottom: 32 }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Jejak Aktivitas Sistem (Audit Trail)</h2>
            <button type="button" className="btn" onClick={handleExportAudit} style={{ background: "var(--low)", color: "#fff", border: "none", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="download" /> Export Audit CSV</button>
          </div>

          {/* Filter Bar */}
          <div className="audit-filter" style={{ padding: "16px 24px", background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
            <select
              className="audit-control"
              value={action}
              onChange={(e) => onFilterChange(setAction)(e.target.value)}
              aria-label="Filter aksi"
            >
              <option value="">Semua Aksi</option>
              <option value="login">Login</option>
              <option value="validate_report">Validasi Laporan</option>
              <option value="reject_report">Tolak Laporan</option>
              <option value="approve_user">Setujui Pengguna</option>
              <option value="reject_user">Tolak Pengguna</option>
              <option value="download_research_dataset">Unduh Dataset Riset</option>
              <option value="regenerate_api_key">Regenerasi API Key</option>
            </select>

            <select
              className="audit-control"
              value={outcome}
              onChange={(e) => onFilterChange(setOutcome)(e.target.value)}
              aria-label="Filter hasil"
            >
              <option value="">Semua Hasil</option>
              <option value="success">Berhasil</option>
              <option value="fail">Gagal</option>
              <option value="denied">Ditolak</option>
              <option value="partial">Sebagian</option>
            </select>

            <div className="audit-search">
              <Icon name="search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)", fontSize: 18 }} />
              <input
                type="text"
                placeholder="Cari aktor, target..."
                value={search}
                onChange={(e) => onFilterChange(setSearch)(e.target.value)}
              />
            </div>
          </div>

          {/* Audit Logs Table */}
          <div>
            {isLoading ? (
              <div style={{ padding: "16px 24px" }}><LoadingBlock rows={6} label="Memuat log audit…" /></div>
            ) : error ? (
              <div style={{ padding: "56px 20px", textAlign: "center", color: "var(--ink-soft)", display: "grid", justifyItems: "center", gap: 4 }}>
                <Icon name="error" style={{ fontSize: 48, color: "var(--critical)", opacity: 0.85, marginBottom: 8 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Gagal memuat log</div>
                <div style={{ fontSize: 13, margin: "0 0 12px" }}>{error}</div>
                <button type="button" className="btn secondary" onClick={fetchLogs}><Icon name="refresh" /> Coba lagi</button>
              </div>
            ) : logs.length === 0 ? (
              <EmptyState
                icon="history_toggle_off"
                title="Log kosong"
                description="Tidak ada log aktivitas yang cocok dengan filter pencarian."
              />
            ) : (
            <div className="table-responsive">
              <table className="data-table audit-table" style={{ textAlign: "left", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Waktu Kejadian</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Aktor</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Role</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Aksi</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Target</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, textAlign: "right" }}>Hasil</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13 }}>{formatDate(log.created_at)}</td>
                      <td style={{ padding: "16px 24px", fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{log.actor_name}</td>
                      <td style={{ padding: "16px 24px" }}>
                        <span className="badge" style={{ background: "var(--surface-muted)", color: "var(--ink-soft)", fontSize: 11, padding: "4px 8px" }}>
                          {roleLabel(log.actor_role)}
                        </span>
                      </td>
                      <td style={{ padding: "16px 24px" }}>
                        <span style={{ fontSize: 12, color: "var(--accent)", background: "var(--accent-soft)", padding: "4px 8px", borderRadius: 6, fontWeight: 600 }}>
                          {actionLabels[log.action] || log.action}
                        </span>
                      </td>
                      <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, wordBreak: "break-all" }}>
                        {formatTargetResource(log.target_resource)}
                      </td>
                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <span className={`badge outcome-${log.outcome}`} style={{ fontSize: 11, padding: "4px 8px" }}>
                          {outcomes[log.outcome] || log.outcome}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Pagination */}
          {!isLoading && !error && meta && meta.last_page > 1 && (
            <nav className="audit-pagination" aria-label="Navigasi halaman log audit">
              <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>
                Menampilkan {meta.from ?? 0}–{meta.to ?? 0} dari {meta.total} entri
              </span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" className="audit-page-btn" disabled={page <= 1} onClick={() => changePage(page - 1)} aria-label="Halaman sebelumnya">
                  <Icon name="chevron_left" />
                </button>
                {pageNumbers.map((n, i) => (
                  <span key={n} style={{ display: "contents" }}>
                    {i > 0 && n - pageNumbers[i - 1] > 1 && <span style={{ alignSelf: "center", padding: "0 3px" }}>…</span>}
                    <button type="button" className={`audit-page-btn ${n === meta.current_page ? "active" : ""}`} onClick={() => changePage(n)} aria-current={n === meta.current_page ? "page" : undefined}>{n}</button>
                  </span>
                ))}
                <button type="button" className="audit-page-btn" disabled={page >= meta.last_page} onClick={() => changePage(page + 1)} aria-label="Halaman berikutnya">
                  <Icon name="chevron_right" />
                </button>
              </div>
            </nav>
          )}
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
