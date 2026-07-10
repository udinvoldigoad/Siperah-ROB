import { AppShell } from "../../shared/components/AppShell";
import { MetricCard } from "../../shared/components/MetricCard";

const users = [
  ["Budi Santoso", "admin", "aktif", "Provinsi Lampung"],
  ["Herman Wijaya", "bpbd_operator", "aktif", "Bandar Lampung"],
  ["Siti Aminah", "peneliti", "menunggu", "Universitas Lampung"],
  ["Adi Kurniawan", "warga", "aktif", "Panjang Utara"],
  ["Maya Puspita", "bpbd_operator", "nonaktif", "Lampung Selatan"],
];

export function AdminUsersPage() {
  const activeCount = users.filter(([, , status]) => status === "aktif").length;
  const pendingCount = users.filter(([, , status]) => status === "menunggu").length;
  const inactiveCount = users.filter(([, , status]) => status === "nonaktif").length;

  return (
    <AppShell active="admin" title="Manajemen Pengguna" subtitle="Approval akun, role, wilayah kerja, status, dan audit.">
      <div className="stack">
        <section className="alert" style={{ display: "grid", gap: 6 }}>
          <strong>4 permintaan akun baru menunggu persetujuan</strong>
          <span>Kelola role, wilayah kerja, dan status pengguna dari satu tempat tanpa perlu berpindah halaman.</span>
        </section>

        <div className="metric-grid">
          <MetricCard metric={{ label: "Aktif", value: String(activeCount), note: "Akun yang dapat masuk" }} />
          <MetricCard metric={{ label: "Menunggu", value: String(pendingCount), note: "Perlu approval", tone: "critical" }} />
          <MetricCard metric={{ label: "Nonaktif", value: String(inactiveCount), note: "Akses tidak aktif" }} />
          <MetricCard metric={{ label: "Total pengguna", value: String(users.length), note: "Seluruh role" }} />
        </div>

        <section className="panel" style={{ display: "grid", gap: 14 }}>
          <div className="section-head">
            <div>
              <h2>Daftar pengguna</h2>
              <p>Admin menyetujui akun, mengganti role, dan menonaktifkan akses jika diperlukan.</p>
            </div>
            <a className="btn secondary" href="#/audit">Lihat audit</a>
          </div>

          <section className="filter-bar" style={{ marginBottom: 2 }}>
            <label>Role<select defaultValue=""><option value="">Semua role</option><option>admin</option><option>bpbd_operator</option><option>bpbd_provinsi</option><option>peneliti</option><option>warga</option></select></label>
            <label>Status<select defaultValue=""><option value="">Semua status</option><option>aktif</option><option>menunggu</option><option>nonaktif</option><option>ditolak</option></select></label>
            <label>Wilayah<input placeholder="Cari wilayah" /></label>
          </section>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: 760 }}>
              <thead><tr><th>Nama</th><th>Role</th><th>Status</th><th>Wilayah/Instansi</th><th>Aksi</th></tr></thead>
              <tbody>
                {users.map(([name, role, status, region]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td><span className="badge badge-neutral">{role}</span></td>
                    <td><span className={`badge user-${status}`}>{status}</span></td>
                    <td>{region}</td>
                    <td className="table-actions">
                      {status === "menunggu" && <button className="btn primary" type="button">Approve</button>}
                      <button className="btn secondary" type="button">Kelola</button>
                    </td>
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
