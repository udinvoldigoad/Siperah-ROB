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
      <div className="stack" style={{ gap: "40px", padding: "12px 0" }}>
        
        {/* Metric Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px" }}>
          <MetricCard metric={{ label: "Berhasil", value: String(successCount), note: "Aktivitas berjalan aman", tone: "success" }} />
          <MetricCard metric={{ label: "Akses Ditolak", value: String(deniedCount), note: "Potensi masalah keamanan", tone: "critical" }} />
          <MetricCard metric={{ label: "Sebagian Berhasil", value: String(partialCount), note: "Perlu pemeriksaan berkala" }} />
          <MetricCard metric={{ label: "Total Catatan", value: String(logs.length), note: "Entri log tersimpan" }} />
        </div>

        {/* Audit Log Panel */}
        <section 
          className="panel" 
          style={{ 
            padding: "36px", 
            borderRadius: "20px", 
            background: "var(--surface)", 
            border: "1px solid var(--line)", 
            boxShadow: "0 12px 40px rgba(18, 19, 20, 0.02)"
          }}
        >
          <div style={{ marginBottom: "28px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>Jejak Aktivitas Sistem</h2>
            <p style={{ fontSize: "0.92rem", color: "var(--ink-soft)", margin: "6px 0 0 0", lineHeight: 1.5 }}>Menampilkan payload log operasional terbaru untuk pencegahan malfungsi dan pelanggaran otorisasi.</p>
          </div>

          {/* Filter Bar */}
          <section style={{ display: "flex", flexWrap: "wrap", gap: "16px", background: "var(--surface-soft)", padding: "20px", borderRadius: "16px", border: "1px solid var(--line)", marginBottom: "28px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexGrow: 1, minWidth: "180px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-soft)" }}>Tindakan (Action)</span>
              <select value={action} onChange={(e) => setAction(e.target.value)} style={{ padding: "10px 14px", borderRadius: "100px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontWeight: 600, fontSize: "0.88rem" }}>
                <option value="">Semua Aksi</option>
                <option value="approve_user">Approve User</option>
                <option value="reject_user">Reject User</option>
                <option value="reports.validate">Validasi Laporan</option>
                <option value="auth.login">Login</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexGrow: 1, minWidth: "180px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-soft)" }}>Status Hasil</span>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)} style={{ padding: "10px 14px", borderRadius: "100px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontWeight: 600, fontSize: "0.88rem" }}>
                <option value="">Semua Hasil</option>
                <option value="success">Berhasil</option>
                <option value="fail">Gagal</option>
                <option value="denied">Ditolak</option>
                <option value="partial">Sebagian</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexGrow: 2, minWidth: "240px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-soft)" }}>Pencarian Kata Kunci</span>
              <div style={{ position: "relative" }}>
                <input 
                  type="text" 
                  placeholder="Cari actor, target, atau log ID..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ padding: "10px 14px 10px 42px", width: "100%", borderRadius: "100px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.88rem" }}
                />
                <Icon name="search" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)" }} />
              </div>
            </div>
          </section>

          {/* Audit Logs Table */}
          <div style={{ overflowX: "auto" }}>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "64px 0", color: "var(--ink-soft)" }}>
                <Icon name="progress_activity" style={{ animation: "spin 1s linear infinite", fontSize: "2.2rem", marginBottom: "12px", color: "var(--accent)" }} />
                <div>Memuat catatan log audit...</div>
              </div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 0", color: "var(--ink-soft)", border: "1px dashed var(--line)", borderRadius: "16px" }}>
                <div style={{ background: "var(--surface-soft)", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <Icon name="history_toggle_off" style={{ fontSize: "2rem", color: "var(--ink-soft)" }} />
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 6px 0", color: "var(--ink)" }}>Log Kosong</h3>
                <p style={{ margin: 0, fontSize: "0.88rem" }}>Tidak ada catatan log aktivitas yang cocok.</p>
              </div>
            ) : (
              <table className="data-table" style={{ minWidth: 820, width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)", fontSize: "0.88rem", fontWeight: 800, color: "var(--ink-soft)" }}>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Waktu Kejadian</th>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Pengguna (Actor)</th>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Akses Role</th>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Aksi (Action)</th>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Sumber Daya (Target)</th>
                    <th style={{ textAlign: "right", padding: "14px 16px" }}>Hasil</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr 
                      key={log.id} 
                      style={{ borderBottom: "1px solid var(--line)", transition: "background 0.2s ease" }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: "20px 16px", fontSize: "0.88rem", color: "var(--ink-soft)" }}>{formatDate(log.created_at)}</td>
                      <td style={{ padding: "20px 16px", fontWeight: 700, color: "var(--ink)" }}>{log.actor_name}</td>
                      <td style={{ padding: "20px 16px" }}>
                        <span className="badge severity-sedang" style={{ textTransform: "capitalize", fontSize: "0.78rem", fontWeight: 700, background: "var(--accent-soft)", borderColor: "var(--line)", color: "var(--accent-dark)" }}>
                          {log.actor_role.replace("bpbd_", "BPBD ").replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "20px 16px", fontFamily: "monospace", fontSize: "0.85rem", color: "var(--ink)" }}>{log.action}</td>
                      <td style={{ padding: "20px 16px", color: "var(--ink-soft)", fontSize: "0.88rem" }}>{log.target_resource || "-"}</td>
                      <td style={{ padding: "20px 16px", textAlign: "right" }}>
                        <span className={`badge ${log.outcome === "success" ? "severity-ringan" : log.outcome === "denied" ? "severity-sangat_parah" : log.outcome === "fail" ? "severity-parah" : "status-menunggu"}`} style={{ fontSize: "0.78rem", fontWeight: 700 }}>
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
