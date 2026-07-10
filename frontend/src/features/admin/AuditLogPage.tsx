import { AppShell } from "../../shared/components/AppShell";
import { MetricCard } from "../../shared/components/MetricCard";

const logs = [
  ["09 Jul 2026 06:44", "Herman Wijaya", "bpbd_operator", "reports.validate", "GT-LPG-881", "success"],
  ["09 Jul 2026 06:20", "Warga Mode Awam", "warga", "reports.create", "ROB-20260708-230944-T3GM", "success"],
  ["09 Jul 2026 05:58", "Siti Aminah", "peneliti", "api.datasets.export", "Ground Truth Tervalidasi", "success"],
  ["08 Jul 2026 23:10", "Budi Santoso", "admin", "users.approve", "akun peneliti", "partial"],
  ["08 Jul 2026 22:41", "Anonim", "public", "auth.login", "admin@siperah.local", "denied"],
];

const outcomes: Record<string, string> = {
  success: "Berhasil",
  fail: "Gagal",
  denied: "Ditolak",
  partial: "Sebagian",
};

export function AuditLogPage() {
  const successCount = logs.filter(([, , , , , outcome]) => outcome === "success").length;
  const deniedCount = logs.filter(([, , , , , outcome]) => outcome === "denied").length;
  const partialCount = logs.filter(([, , , , , outcome]) => outcome === "partial").length;

  return (
    <AppShell active="audit" title="Audit Log" subtitle="Jejak aksi penting untuk keamanan, validasi, dan kepatuhan operasional.">
      <div className="stack">
        <div className="metric-grid">
          <MetricCard metric={{ label: "Berhasil", value: String(successCount), note: "Aktivitas aman", tone: "success" }} />
          <MetricCard metric={{ label: "Ditolak", value: String(deniedCount), note: "Perlu cek akses", tone: "critical" }} />
          <MetricCard metric={{ label: "Sebagian", value: String(partialCount), note: "Perlu review" }} />
          <MetricCard metric={{ label: "Total log", value: String(logs.length), note: "Entri terbaru" }} />
        </div>

        <section className="panel" style={{ display: "grid", gap: 14 }}>
          <div className="section-head">
            <div>
              <h2>Aktivitas terbaru</h2>
              <p>Payload detail disimpan untuk investigasi, tetapi hanya ringkasan yang ditampilkan di daftar utama.</p>
            </div>
          </div>

          <section className="filter-bar" style={{ marginBottom: 2 }}>
            <label>Cari<input defaultValue="" placeholder="Actor, action, target" /></label>
            <label>Outcome<select defaultValue=""><option value="">Semua</option><option>success</option><option>fail</option><option>denied</option><option>partial</option></select></label>
            <label>Aksi<select defaultValue=""><option value="">Semua aksi</option><option>reports.validate</option><option>users.approve</option><option>auth.login</option></select></label>
          </section>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: 820 }}>
              <thead><tr><th>Waktu</th><th>Actor</th><th>Role</th><th>Action</th><th>Target</th><th>Outcome</th></tr></thead>
              <tbody>
                {logs.map(([time, actor, role, action, target, outcome]) => (
                  <tr key={`${time}-${action}`}>
                    <td>{time}</td>
                    <td>{actor}</td>
                    <td><span className="badge status-menunggu" style={{ minHeight: 26, padding: "4px 8px" }}>{role}</span></td>
                    <td>{action}</td>
                    <td>{target}</td>
                    <td><span className={`badge outcome-${outcome}`}>{outcomes[outcome]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
