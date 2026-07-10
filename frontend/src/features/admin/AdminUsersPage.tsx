import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { MetricCard } from "../../shared/components/MetricCard";
import { api } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  institution: string | null;
  region_name: string | null;
}

interface UserListResponse {
  data: UserData[];
}

export function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      if (role) query.append("role", role);
      if (status) query.append("status", status);
      if (search) query.append("search", search);

      const res = await api<UserListResponse>(`/admin/users?${query.toString()}`);
      setUsers(res.data);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat daftar pengguna.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [role, status, search]);

  const handleApprove = async (id: string, name: string) => {
    try {
      await api(`/admin/users/${id}/approve`, { method: "POST" });
      toast.success(`Akun "${name}" berhasil disetujui.`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyetujui akun.");
    }
  };

  const handleReject = async (id: string, name: string) => {
    try {
      await api(`/admin/users/${id}/reject`, { method: "POST" });
      toast.info(`Akun "${name}" ditolak.`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Gagal menolak akun.");
    }
  };

  const activeCount = users.filter((u) => u.status === "aktif").length;
  const pendingCount = users.filter((u) => u.status === "menunggu").length;
  const inactiveCount = users.filter((u) => u.status === "nonaktif").length;

  return (
    <AppShell active="admin" title="Manajemen Pengguna">
      {/* Pending Alerts Banner */}
      {pendingCount > 0 && (
        <div className="alert-banner alert-warn" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Icon name="notification_important" style={{ fontSize: "18px", color: "var(--amber)" }} />
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--amber)" }}>
                {pendingCount} Pendaftaran Baru
              </div>
              <div style={{ fontSize: "11px", color: "var(--amber)", marginTop: "1px" }}>
                Tinjau dan lakukan tindakan approve/reject pada tabel daftar pengguna di bawah.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="kpi-grid kpi-grid-4" style={{ marginBottom: "20px" }}>
        <div className="kpi">
          <small>Pengguna Aktif</small>
          <div className="kpi-num">{activeCount}</div>
          <div className="kpi-sub">Dapat masuk ke dashboard</div>
        </div>
        <div className="kpi">
          <small>Menunggu Approval</small>
          <div className="kpi-num" style={{ color: "var(--amber)" }}>{pendingCount}</div>
          <div className="kpi-sub">Butuh validasi admin</div>
        </div>
        <div className="kpi">
          <small>Akses Nonaktif</small>
          <div className="kpi-num">{inactiveCount}</div>
          <div className="kpi-sub">Akses ditutup</div>
        </div>
        <div className="kpi">
          <small>Total Terdaftar</small>
          <div className="kpi-num">{users.length}</div>
          <div className="kpi-sub">Seluruh role pengguna</div>
        </div>
      </div>

      {/* Filters and List */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: "20px" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="card-title" style={{ margin: 0 }}>Daftar Pengguna Sistem</div>
          <a href="#/audit" style={{ textDecoration: "none" }}>
            <button style={{ fontSize: "11px" }}><Icon name="history" style={{ fontSize: "13px" }} /> Lihat Audit Log</button>
          </a>
        </div>

        {/* Filters Bar */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", padding: "12px 16px", background: "var(--bg1)", borderBottom: "1px solid var(--bd)" }}>
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ fontSize: "12px", padding: "6px 10px" }}>
            <option value="">Semua Role</option>
            <option value="admin">Admin</option>
            <option value="bpbd_operator">BPBD Operator</option>
            <option value="bpbd_provinsi">BPBD Provinsi</option>
            <option value="peneliti">Peneliti</option>
            <option value="warga">Warga</option>
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ fontSize: "12px", padding: "6px 10px" }}>
            <option value="">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="menunggu">Menunggu</option>
            <option value="nonaktif">Nonaktif</option>
            <option value="ditolak">Ditolak</option>
          </select>

          <input 
            type="text" 
            placeholder="Cari nama, email..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: "12px", padding: "6px 10px", flex: 1, border: "1px solid var(--bd)", borderRadius: "var(--radius)" }}
          />
        </div>

        {/* Table container */}
        <div>
          {isLoading ? (
            <div style={{ padding: "20px" }}>Memuat daftar pengguna...</div>
          ) : users.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--tx3)" }}>
              <Icon name="person_off" style={{ fontSize: "32px" }} />
              <div style={{ fontWeight: 600, marginTop: "8px" }}>Tidak Ditemukan</div>
              <div style={{ fontSize: "12px" }}>Tidak ada pengguna yang cocok dengan filter.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Lengkap</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Instansi / Wilayah</th>
                  <th style={{ textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 500 }}>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span className="badge b-info" style={{ textTransform: "capitalize" }}>
                        {user.role.replace("bpbd_", "BPBD ").replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        user.status === "aktif" ? "b-done" :
                        user.status === "menunggu" ? "b-pending" : "b-vhi"
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td>{user.institution || user.region_name || "-"}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        {user.status === "menunggu" ? (
                          <>
                            <button 
                              style={{ background: "var(--green)", color: "#fff", borderColor: "var(--green)", fontSize: "11px", padding: "4px 8px" }}
                              onClick={() => handleApprove(user.id, user.name)}
                            >
                              Setujui
                            </button>
                            <button 
                              style={{ background: "var(--red)", color: "#fff", borderColor: "var(--red)", fontSize: "11px", padding: "4px 8px" }}
                              onClick={() => handleReject(user.id, user.name)}
                            >
                              Tolak
                            </button>
                          </>
                        ) : (
                          <button style={{ fontSize: "11px", padding: "4px 8px" }}>
                            Kelola
                          </button>
                        )}
                      </div>
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
