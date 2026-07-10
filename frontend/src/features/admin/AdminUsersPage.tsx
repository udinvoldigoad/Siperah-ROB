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
      fetchUsers(); // reload list
    } catch (err: any) {
      toast.error(err.message || "Gagal menyetujui akun.");
    }
  };

  const handleReject = async (id: string, name: string) => {
    try {
      await api(`/admin/users/${id}/reject`, { method: "POST" });
      toast.info(`Akun "${name}" ditolak.`);
      fetchUsers(); // reload list
    } catch (err: any) {
      toast.error(err.message || "Gagal menolak akun.");
    }
  };

  const activeCount = users.filter((u) => u.status === "aktif").length;
  const pendingCount = users.filter((u) => u.status === "menunggu").length;
  const inactiveCount = users.filter((u) => u.status === "nonaktif").length;

  return (
    <AppShell active="admin" title="Manajemen Pengguna" subtitle="Approval akun petugas, pembagian peran role, dan status akses.">
      <div className="stack" style={{ gap: "28px" }}>
        
        {pendingCount > 0 && (
          <section className="alert status-menunggu" style={{ display: "flex", alignItems: "center", gap: "12px", border: "1px solid var(--accent)", borderRadius: "12px", padding: "16px" }}>
            <Icon name="notification_important" style={{ fontSize: "1.5rem" }} />
            <div>
              <strong>Ada {pendingCount} permintaan akun menunggu persetujuan</strong>
              <div style={{ fontSize: "0.82rem", opacity: 0.9 }}>Tinjau dan lakukan tindakan approve/reject pada tabel daftar pengguna di bawah.</div>
            </div>
          </section>
        )}

        <div className="metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
          <MetricCard metric={{ label: "Pengguna Aktif", value: String(activeCount), note: "Dapat masuk ke dashboard" }} />
          <MetricCard metric={{ label: "Menunggu Approval", value: String(pendingCount), note: "Butuh validasi admin", tone: "critical" }} />
          <MetricCard metric={{ label: "Akses Nonaktif", value: String(inactiveCount), note: "Akses ditutup" }} />
          <MetricCard metric={{ label: "Total Terdaftar", value: String(users.length), note: "Seluruh role pengguna" }} />
        </div>

        <section className="panel" style={{ padding: "28px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--line)", display: "grid", gap: "20px" }}>
          <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Daftar Pengguna Sistem</h2>
              <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", margin: "4px 0 0 0" }}>Kelola persetujuan akun, ubah role akses, dan pantau instansi terkait.</p>
            </div>
            <a className="btn secondary" href="#/audit" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Icon name="history" /> Lihat Audit Log
            </a>
          </div>

          {/* Filters Bar */}
          <section className="filter-bar" style={{ display: "flex", flexWrap: "wrap", gap: "16px", background: "var(--surface-soft)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexGrow: 1, minWidth: "150px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-soft)" }}>Role Akses</span>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
                <option value="">Semua Role</option>
                <option value="admin">Admin</option>
                <option value="bpbd_operator">BPBD Operator</option>
                <option value="bpbd_provinsi">BPBD Provinsi</option>
                <option value="peneliti">Peneliti</option>
                <option value="warga">Warga</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexGrow: 1, minWidth: "150px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-soft)" }}>Status Akun</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}>
                <option value="">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="menunggu">Menunggu</option>
                <option value="nonaktif">Nonaktif</option>
                <option value="ditolak">Ditolak</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexGrow: 2, minWidth: "220px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-soft)" }}>Pencarian Cepat</span>
              <div style={{ position: "relative" }}>
                <input 
                  type="text" 
                  placeholder="Cari nama, email, atau wilayah..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ padding: "8px 12px 8px 36px", width: "100%", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" }}
                />
                <Icon name="search" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)" }} />
              </div>
            </div>
          </section>

          {/* Users Table */}
          <div style={{ overflowX: "auto" }}>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-soft)" }}>
                <Icon name="progress_activity" style={{ animation: "spin 1s linear infinite", fontSize: "2rem", marginBottom: "8px" }} />
                <div>Memuat daftar pengguna...</div>
              </div>
            ) : users.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-soft)", border: "1px dashed var(--line)", borderRadius: "12px" }}>
                <Icon name="person_off" style={{ fontSize: "2.5rem", marginBottom: "8px" }} />
                <div>Tidak ada data pengguna ditemukan.</div>
              </div>
            ) : (
              <table className="data-table" style={{ minWidth: 760, width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)" }}>
                    <th style={{ textAlign: "left", padding: "12px" }}>Nama Lengkap</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Email</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Role</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Instansi / Wilayah</th>
                    <th style={{ textAlign: "right", padding: "12px" }}>Aksi Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} style={{ borderBottom: "1px solid var(--surface-muted)", transition: "background 0.2s ease" }}>
                      <td style={{ padding: "14px 12px", fontWeight: 600 }}>{user.name}</td>
                      <td style={{ padding: "14px 12px", color: "var(--ink-soft)" }}>{user.email}</td>
                      <td style={{ padding: "14px 12px" }}>
                        <span className="badge badge-neutral" style={{ textTransform: "capitalize" }}>{user.role.replace("_", " ")}</span>
                      </td>
                      <td style={{ padding: "14px 12px" }}>
                        <span className={`badge user-${user.status}`}>{user.status}</span>
                      </td>
                      <td style={{ padding: "14px 12px", color: "var(--ink-soft)" }}>
                        {user.institution || user.region_name || "-"}
                      </td>
                      <td style={{ padding: "14px 12px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px", justifyContent: "flex-end" }}>
                          {user.status === "menunggu" ? (
                            <>
                              <button 
                                className="btn primary" 
                                type="button" 
                                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                                onClick={() => handleApprove(user.id, user.name)}
                              >
                                Setujui
                              </button>
                              <button 
                                className="btn critical" 
                                type="button" 
                                style={{ padding: "6px 12px", fontSize: "0.8rem", background: "var(--critical-soft)", color: "var(--critical)", border: "none" }}
                                onClick={() => handleReject(user.id, user.name)}
                              >
                                Tolak
                              </button>
                            </>
                          ) : (
                            <button 
                              className="btn secondary" 
                              type="button" 
                              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                            >
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
        </section>
      </div>
    </AppShell>
  );
}
