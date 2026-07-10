import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { MetricCard } from "../../shared/components/MetricCard";
import { api } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";

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
    <AppShell active="audit" title="Audit Log Aktivitas" subtitle="Rekaman jejak tindakan sistem kebencanaan untuk akuntabilitas keamanan.">
      <div className="stack" style={{ display: "grid", gap: "28px" }}>
        
        <div className="metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
          <MetricCard metric={{ label: "Berhasil", value: String(successCount), note: "Aktivitas berjalan aman", tone: "success" }} />
          <MetricCard metric={{ label: "Akses Ditolak", value: String(deniedCount), note: "Potensi masalah keamanan", tone: "critical" }} />
          <MetricCard metric={{ label: "Sebagian Berhasil", value: String(partialCount), note: "Perlu pemeriksaan berkala" }} />
          <MetricCard metric={{ label: "Total Catatan", value: String(logs.length), note: "Entri log tersimpan" }} />
        </div>

        <section className="panel" style={{ padding: "28px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--line)", display: "grid", gap: "20px" }}>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Jejak Aktivitas Sistem</h2>
            <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", margin: "4px 0 0 0" }}>Menampilkan payload log operasional terbaru untuk pencegahan malfungsi dan pelanggaran otorisasi.</p>
          </div>

          {/* Filter Bar */}
          <section className="filter-bar" style={{ display: "flex", flexWrap: "wrap", gap: "16px", background: "var(--surface-soft)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexGrow: 1, minWidth: "150px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-soft)" }}>Tindakan (Action)</span>
              <select value={action} onChange={(e) => setAction(e.target.value)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
                <option value="">Semua Aksi</option>
                <option value="approve_user">Approve User</option>
                <option value="reject_user">Reject User</option>
                <option value="reports.validate">Validasi Laporan</option>
                <option value="auth.login">Login</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexGrow: 1, minWidth: "150px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-soft)" }}>Status Hasil</span>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
                <option value="">Semua Hasil</option>
                <option value="success">Berhasil</option>
                <option value="fail">Gagal</option>
                <option value="denied">Ditolak</option>
                <option value="partial">Sebagian</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexGrow: 2, minWidth: "220px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-soft)" }}>Pencarian Kata Kunci</span>
              <div style={{ position: "relative" }}>
                <input 
                  type="text" 
                  placeholder="Cari actor, target, atau log ID..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ padding: "8px 12px 8px 36px", width: "100%", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}
                />
                <Icon name="search" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)" }} />
              </div>
            </div>
          </section>

          {/* Audit Logs Table */}
          <div style={{ overflowX: "auto" }}>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-soft)" }}>
                <Icon name="progress_activity" style={{ animation: "spin 1s linear infinite", fontSize: "2rem", marginBottom: "8px" }} />
                <div>Memuat catatan log audit...</div>
              </div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-soft)", border: "1px dashed var(--line)", borderRadius: "12px" }}>
                <Icon name="history_toggle_off" style={{ fontSize: "2.5rem", marginBottom: "8px" }} />
                <div>Tidak ada rekaman log aktivitas terbaru.</div>
              </div>
            ) : (
              <table className="data-table" style={{ minWidth: 820, width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)" }}>
                    <th style={{ textAlign: "left", padding: "12px" }}>Waktu Kejadian</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Pengguna (Actor)</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Akses Role</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Aksi (Action)</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Sumber Daya (Target)</th>
                    <th style={{ textAlign: "right", padding: "12px" }}>Hasil</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--surface-muted)" }}>
                      <td style={{ padding: "14px 12px", fontSize: "0.85rem", color: "var(--ink-soft)" }}>{formatDate(log.created_at)}</td>
                      <td style={{ padding: "14px 12px", fontWeight: 600 }}>{log.actor_name}</td>
                      <td style={{ padding: "14px 12px" }}>
                        <span className="badge status-menunggu" style={{ textTransform: "capitalize" }}>{log.actor_role}</span>
                      </td>
                      <td style={{ padding: "14px 12px", fontFamily: "monospace", fontSize: "0.85rem" }}>{log.action}</td>
                      <td style={{ padding: "14px 12px", color: "var(--ink-soft)" }}>{log.target_resource || "-"}</td>
                      <td style={{ padding: "14px 12px", textAlign: "right" }}>
                        <span className={`badge outcome-${log.outcome}`}>
                          {outcomes[log.outcome] || log.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
