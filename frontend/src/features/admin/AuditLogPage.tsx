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
    <AppShell active="audit" title="Audit Log Aktivitas">
      {/* KPI Grid */}
      <div className="kpi-grid kpi-grid-4" style={{ marginBottom: "20px" }}>
        <div className="kpi">
          <small>Berhasil</small>
          <div className="kpi-num" style={{ color: "#16a34a" }}>{successCount}</div>
          <div className="kpi-sub">Aktivitas berjalan aman</div>
        </div>
        <div className="kpi">
          <small>Akses Ditolak</small>
          <div className="kpi-num" style={{ color: "#dc2626" }}>{deniedCount}</div>
          <div className="kpi-sub">Potensi masalah keamanan</div>
        </div>
        <div className="kpi">
          <small>Sebagian Berhasil</small>
          <div className="kpi-num">{partialCount}</div>
          <div className="kpi-sub">Perlu pemeriksaan berkala</div>
        </div>
        <div className="kpi">
          <small>Total Catatan</small>
          <div className="kpi-num">{logs.length}</div>
          <div className="kpi-sub">Entri log tersimpan</div>
        </div>
      </div>

      {/* Audit Log Card */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: "20px" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bd)" }}>
          <div className="card-title" style={{ margin: 0 }}>Jejak Aktivitas Sistem</div>
        </div>

        {/* Filter Bar */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", padding: "12px 16px", background: "var(--bg1)", borderBottom: "1px solid var(--bd)" }}>
          <select value={action} onChange={(e) => setAction(e.target.value)} style={{ fontSize: "12px", padding: "6px 10px" }}>
            <option value="">Semua Aksi</option>
            <option value="approve_user">Approve User</option>
            <option value="reject_user">Reject User</option>
            <option value="reports.validate">Validasi Laporan</option>
            <option value="auth.login">Login</option>
          </select>

          <select value={outcome} onChange={(e) => setOutcome(e.target.value)} style={{ fontSize: "12px", padding: "6px 10px" }}>
            <option value="">Semua Hasil</option>
            <option value="success">Berhasil</option>
            <option value="fail">Gagal</option>
            <option value="denied">Ditolak</option>
            <option value="partial">Sebagian</option>
          </select>

          <input 
            type="text" 
            placeholder="Cari aktor, target..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: "12px", padding: "6px 10px", flex: 1, border: "1px solid var(--bd)", borderRadius: "var(--radius)" }}
          />
        </div>

        {/* Audit Logs Table */}
        <div>
          {isLoading ? (
            <div style={{ padding: "20px" }}>Memuat log audit...</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--tx3)" }}>
              <Icon name="history_toggle_off" style={{ fontSize: "32px" }} />
              <div style={{ fontWeight: 600, marginTop: "8px" }}>Log Kosong</div>
              <div style={{ fontSize: "12px" }}>Tidak ada log yang cocok.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Waktu Kejadian</th>
                  <th>Aktor</th>
                  <th>Role</th>
                  <th>Aksi</th>
                  <th>Target</th>
                  <th style={{ textAlign: "right" }}>Hasil</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td><span style={{ fontSize: "12px" }}>{formatDate(log.created_at)}</span></td>
                    <td style={{ fontWeight: 500 }}>{log.actor_name}</td>
                    <td>
                      <span className="badge b-neutral" style={{ textTransform: "capitalize" }}>
                        {log.actor_role.replace("bpbd_", "BPBD ").replace("_", " ")}
                      </span>
                    </td>
                    <td><code style={{ fontSize: "11px" }}>{log.action}</code></td>
                    <td><span style={{ fontSize: "12px" }}>{log.target_resource || "-"}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <span className={`badge ${
                        log.outcome === "success" ? "b-done" :
                        log.outcome === "denied" ? "b-vhi" :
                        log.outcome === "fail" ? "b-vhi" : "b-pending"
                      }`}>
                        {outcomes[log.outcome] || log.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
