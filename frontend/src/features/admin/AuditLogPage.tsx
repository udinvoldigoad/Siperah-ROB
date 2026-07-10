import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { api } from "../../shared/api/client";
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
  created_at: string;
}

interface AuditLogResponse {
  data: AuditLogData[];
}

const outcomes: Record<string, string> = {
  success: "Berhasil",
  fail: "Gagal",
  denied: "Ditolak",
  partial: "Sebagian",
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function AuditLogPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLogData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      if (action) query.append("action", action);
      if (outcome) query.append("outcome", outcome);
      if (search) query.append("search", search);

      const res = await api<AuditLogResponse>(`/admin/audit-logs?${query.toString()}`);
      setLogs(res.data);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat log audit.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [action, outcome, search]);

  const successCount = logs.filter((l) => l.outcome === "success").length;
  const deniedCount = logs.filter((l) => l.outcome === "denied").length;
  const partialCount = logs.filter((l) => l.outcome === "partial").length;

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <AppShell active="audit" title="Audit Log Aktivitas">
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="content" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        
        {/* KPI Grid */}
        <motion.div variants={itemVariants} className="metric-grid" style={{ marginBottom: 32 }}>
          {[
            { title: "Aktivitas Berhasil", val: successCount, sub: "Berjalan aman tanpa error", cls: "success" },
            { title: "Akses Ditolak", val: deniedCount, sub: "Potensi masalah keamanan", cls: deniedCount > 0 ? "critical" : "" },
            { title: "Sebagian Berhasil", val: partialCount, sub: "Perlu pemeriksaan berkala", cls: "" },
            { title: "Total Catatan", val: logs.length, sub: "Entri log yang tersimpan", cls: "" }
          ].map((kpi, idx) => (
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
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Jejak Aktivitas Sistem (Audit Trail)</h2>
          </div>

          {/* Filter Bar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "16px 24px", background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
            <select 
              value={action} 
              onChange={(e) => setAction(e.target.value)} 
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
              onChange={(e) => setOutcome(e.target.value)} 
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
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: 13, padding: "8px 12px 8px 36px", width: "100%", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}
              />
            </div>
          </div>

          {/* Audit Logs Table */}
          <div>
            {isLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--ink-soft)" }}>Memuat log audit...</div>
            ) : logs.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--ink-soft)" }}>
                <Icon name="history_toggle_off" style={{ fontSize: 48, color: "var(--line)", marginBottom: 16 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Log Kosong</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Tidak ada log aktivitas yang cocok dengan filter pencarian.</div>
              </div>
            ) : (
              <table className="data-table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
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
                  <AnimatePresence>
                    {logs.map((log, idx) => (
                      <motion.tr 
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + (idx * 0.05) }}
                        whileHover={{ backgroundColor: "var(--surface-soft)" }}
                        style={{ borderBottom: "1px solid var(--line)" }}
                      >
                        <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13 }}>{formatDate(log.created_at)}</td>
                        <td style={{ padding: "16px 24px", fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{log.actor_name}</td>
                        <td style={{ padding: "16px 24px" }}>
                          <span className="badge" style={{ background: "var(--surface-muted)", color: "var(--ink-soft)", textTransform: "capitalize", fontSize: 11, padding: "4px 8px" }}>
                            {log.actor_role.replace("bpbd_", "BPBD ").replace("_", " ")}
                          </span>
                        </td>
                        <td style={{ padding: "16px 24px" }}>
                          <code style={{ fontSize: 12, color: "var(--accent)", background: "var(--accent-soft)", padding: "4px 8px", borderRadius: 6, fontWeight: 600 }}>{log.action}</code>
                        </td>
                        <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13 }}>{log.target_resource || "-"}</td>
                        <td style={{ padding: "16px 24px", textAlign: "right" }}>
                          <span className={`badge ${
                            log.outcome === "success" ? "status-divalidasi" :
                            log.outcome === "denied" || log.outcome === "fail" ? "status-ditolak" : "status-menunggu"
                          }`} style={{ fontSize: 11, padding: "4px 8px" }}>
                            {outcomes[log.outcome] || log.outcome}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
