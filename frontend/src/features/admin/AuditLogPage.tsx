import { useCallback, useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { api, apiUrl } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";
import { motion, AnimatePresence } from "framer-motion";

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

const actionLabels: Record<string, string> = {
  create_report: "Membuat Laporan",
  update_report_status: "Update Status Laporan",
  validate_report: "Memvalidasi Laporan",
  reject_report: "Menolak Laporan",
  approve_user: "Menyetujui Pengguna",
  reject_user: "Menolak Pengguna",
  update_user_role: "Ubah Role Pengguna",
  update_user_region: "Ubah Wilayah Pengguna",
  update_user_status: "Ubah Status Pengguna",
  auth_login: "Sistem Login",
  auth_logout: "Sistem Logout",
  export_audit: "Ekspor Audit",
  export_reports: "Ekspor Laporan",
  export_provincial_reports: "Ekspor Laporan Provinsi",
  generate_api_key: "Buat API Key",
  download_dataset: "Unduh Dataset",
  update_notification_settings: "Update Konfigurasi Notifikasi",
};

const payloadKeyLabels: Record<string, string> = {
  report_code: "Kode Laporan",
  water_height_cm: "Tinggi Air (cm)",
  is_within_monitoring_area: "Masuk Area Pantauan",
  severity: "Tingkat Keparahan",
  region_id: "ID Wilayah",
  old_role: "Role Lama",
  new_role: "Role Baru",
  old_status: "Status Lama",
  new_status: "Status Baru",
  old_region: "Wilayah Lama",
  new_region: "Wilayah Baru",
  dataset_year: "Tahun Dataset",
  dataset_type: "Jenis Dataset",
  rejection_reason: "Alasan Penolakan",
};

function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string") {
    // Capitalize simple strings like "parah", "sedang", etc.
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return String(value);
}

function formatTargetResource(target: string | null): string {
  if (!target) return "-";
  return target.replace("ground_truth_reports:", "ID Laporan: ")
               .replace("users:", "ID Pengguna: ")
               .replace("api_keys:", "ID API Key: ");
}

export function AuditLogPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLogData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    setExpandedId(null);
  };

  const changePage = (next: number) => {
    if (!meta || next < 1 || next > meta.last_page || next === page) return;
    setExpandedId(null);
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
        .audit-row-toggle { cursor: pointer; }
        .audit-row-toggle:hover { background: var(--surface-soft); }
        .audit-detail dl { display: grid; gap: 12px 20px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); margin: 0; }
        .audit-detail dt { color: var(--ink-soft); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 3px; }
        .audit-detail dd { color: var(--ink); font-size: 13px; margin: 0; word-break: break-word; }
        .audit-pagination { align-items: center; border-top: 1px solid var(--line); display: flex; gap: 8px; justify-content: space-between; padding: 16px 24px; flex-wrap: wrap; }
        .audit-page-btn { align-items: center; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; color: var(--ink); cursor: pointer; display: inline-flex; height: 36px; justify-content: center; min-width: 36px; padding: 0 10px; }
        .audit-page-btn:hover:not(:disabled) { background: var(--surface-soft); border-color: var(--accent); }
        .audit-page-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 800; }
        .audit-page-btn:disabled { cursor: not-allowed; opacity: .45; }
      `}</style>
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="content" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>

        {/* KPI Grid */}
        <motion.div variants={itemVariants} className="metric-grid" style={{ marginBottom: 32 }}>
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
            <button type="button" className="btn secondary" onClick={handleExportAudit}><Icon name="download" /> Export Audit CSV</button>
          </div>

          {/* Filter Bar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "16px 24px", background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
            <select
              value={action}
              onChange={(e) => onFilterChange(setAction)(e.target.value)}
              style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", minWidth: 160 }}
            >
              <option value="">Semua Aksi</option>
              <option value="approve_user">Approve User</option>
              <option value="reject_user">Reject User</option>
              <option value="reports.validate">Validasi Laporan</option>
              <option value="auth.login">Login</option>
            </select>

            <select
              value={outcome}
              onChange={(e) => onFilterChange(setOutcome)(e.target.value)}
              style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", minWidth: 160 }}
            >
              <option value="">Semua Hasil</option>
              <option value="success">Berhasil</option>
              <option value="fail">Gagal</option>
              <option value="denied">Ditolak</option>
              <option value="partial">Sebagian</option>
            </select>

            <div style={{ flex: 1, position: "relative", minWidth: 200 }}>
              <Icon name="search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)", fontSize: 18 }} />
              <input
                type="text"
                placeholder="Cari aktor, target..."
                value={search}
                onChange={(e) => onFilterChange(setSearch)(e.target.value)}
                style={{ fontSize: 13, padding: "8px 12px 8px 36px", width: "100%", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}
              />
            </div>
          </div>

          {/* Audit Logs Table */}
          <div>
            {isLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--ink-soft)" }}>Memuat log audit...</div>
            ) : error ? (
              <div style={{ padding: "56px 20px", textAlign: "center", color: "var(--ink-soft)", display: "grid", justifyItems: "center", gap: 4 }}>
                <Icon name="error" style={{ fontSize: 48, color: "var(--critical)", opacity: 0.85, marginBottom: 8 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Gagal memuat log</div>
                <div style={{ fontSize: 13, margin: "0 0 12px" }}>{error}</div>
                <button type="button" className="btn secondary" onClick={fetchLogs}><Icon name="refresh" /> Coba lagi</button>
              </div>
            ) : logs.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--ink-soft)" }}>
                <Icon name="history_toggle_off" style={{ fontSize: 48, color: "var(--line)", marginBottom: 16 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Log Kosong</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Tidak ada log aktivitas yang cocok dengan filter pencarian.</div>
              </div>
            ) : (
            <div className="table-responsive">
              <table className="data-table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, width: 32 }}></th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Waktu Kejadian</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Aktor</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Role</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Aksi</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Target</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, textAlign: "right" }}>Hasil</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const isExpanded = expandedId === log.id;
                    const payloadEntries = log.payload && typeof log.payload === "object" ? Object.entries(log.payload) : [];
                    return (
                      <AnimatePresence key={log.id}>
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="audit-row-toggle"
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          aria-expanded={isExpanded}
                          style={{ borderBottom: isExpanded ? "none" : "1px solid var(--line)" }}
                        >
                          <td style={{ padding: "16px 24px", color: "var(--ink-soft)" }}>
                            <Icon name={isExpanded ? "expand_less" : "expand_more"} style={{ fontSize: 18 }} />
                          </td>
                          <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13 }}>{formatDate(log.created_at)}</td>
                          <td style={{ padding: "16px 24px", fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{log.actor_name}</td>
                          <td style={{ padding: "16px 24px" }}>
                            <span className="badge" style={{ background: "var(--surface-muted)", color: "var(--ink-soft)", textTransform: "capitalize", fontSize: 11, padding: "4px 8px" }}>
                              {log.actor_role.replace("bpbd_", "BPBD ").replace("_", " ")}
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
                        {isExpanded && (
                          <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ borderBottom: "1px solid var(--line)" }}>
                            <td colSpan={7} style={{ padding: "0 24px 20px", background: "var(--surface-soft)" }}>
                              <div className="audit-detail" style={{ paddingTop: 16 }}>
                                <dl>
                                  <div><dt>Alamat IP</dt><dd>{log.ip_address || "—"}</dd></div>
                                  <div><dt>Waktu (lengkap)</dt><dd>{formatDate(log.created_at)}</dd></div>
                                  {payloadEntries.map(([key, value]) => (
                                    <div key={key}><dt>{payloadKeyLabels[key] || key.replace(/_/g, " ")}</dt><dd>{formatPayloadValue(value)}</dd></div>
                                  ))}
                                </dl>
                                {payloadEntries.length === 0 && (
                                  <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>Tidak ada detail payload tambahan untuk aktivitas ini.</p>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    );
                  })}
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
