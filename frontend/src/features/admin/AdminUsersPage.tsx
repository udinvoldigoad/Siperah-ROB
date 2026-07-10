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
    <AppShell active="admin" title="Manajemen Pengguna" subtitle="Approval akun petugas, pembagian peran role, dan status akses.">
      <div className="stack" style={{ gap: "40px", padding: "12px 0" }}>
        
        {/* Pending Alerts Banner */}
        {pendingCount > 0 && (
          <div 
            className="alert" 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between", 
              gap: "20px", 
              border: "1px solid #FCD34D", 
              background: "#FFFBEB", 
              color: "#92400E",
              borderRadius: "16px", 
              padding: "20px 28px",
              boxShadow: "0 4px 15px rgba(245, 158, 11, 0.03)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ background: "#FEF3C7", width: "42px", height: "42px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="notification_important" style={{ color: "#D97706", fontSize: "1.4rem" }} />
              </div>
              <div>
                <strong style={{ fontSize: "1rem", fontWeight: 800 }}>Ada {pendingCount} permintaan akun menunggu persetujuan</strong>
                <div style={{ fontSize: "0.88rem", opacity: 0.9, marginTop: "2px" }}>Tinjau dan lakukan tindakan approve/reject pada tabel daftar pengguna di bawah.</div>
              </div>
            </div>
          </div>
        )}

        {/* Metric Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px" }}>
          <MetricCard metric={{ label: "Pengguna Aktif", value: String(activeCount), note: "Dapat masuk ke dashboard" }} />
          <MetricCard metric={{ label: "Menunggu Approval", value: String(pendingCount), note: "Butuh validasi admin", tone: "critical" }} />
          <MetricCard metric={{ label: "Akses Nonaktif", value: String(inactiveCount), note: "Akses ditutup" }} />
          <MetricCard metric={{ label: "Total Terdaftar", value: String(users.length), note: "Seluruh role pengguna" }} />
        </div>

        {/* Filters and List */}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "28px" }}>
            <div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>Daftar Pengguna Sistem</h2>
              <p style={{ fontSize: "0.92rem", color: "var(--ink-soft)", margin: "6px 0 0 0", lineHeight: 1.5 }}>Kelola persetujuan akun, ubah role akses, dan pantau instansi terkait.</p>
            </div>
            <a className="btn secondary" href="#/audit" style={{ display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "100px", padding: "10px 20px" }}>
              <Icon name="history" /> Lihat Audit Log
            </a>
          </div>

          {/* Filters Bar */}
          <section style={{ display: "flex", flexWrap: "wrap", gap: "16px", background: "var(--surface-soft)", padding: "20px", borderRadius: "16px", border: "1px solid var(--line)", marginBottom: "28px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexGrow: 1, minWidth: "180px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-soft)" }}>Role Akses</span>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: "10px 14px", borderRadius: "100px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontWeight: 600, fontSize: "0.88rem" }}>
                <option value="">Semua Role</option>
                <option value="admin">Admin</option>
                <option value="bpbd_operator">BPBD Operator</option>
                <option value="bpbd_provinsi">BPBD Provinsi</option>
                <option value="peneliti">Peneliti</option>
                <option value="warga">Warga</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexGrow: 1, minWidth: "180px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-soft)" }}>Status Akun</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "10px 14px", borderRadius: "100px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontWeight: 600, fontSize: "0.88rem" }}>
                <option value="">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="menunggu">Menunggu</option>
                <option value="nonaktif">Nonaktif</option>
                <option value="ditolak">Ditolak</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexGrow: 2, minWidth: "240px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink-soft)" }}>Pencarian Cepat</span>
              <div style={{ position: "relative" }}>
                <input 
                  type="text" 
                  placeholder="Cari nama, email, atau wilayah..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ padding: "10px 14px 10px 42px", width: "100%", borderRadius: "100px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.88rem" }}
                />
                <Icon name="search" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)" }} />
              </div>
            </div>
          </section>

          {/* Table container */}
          <div style={{ overflowX: "auto" }}>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "64px 0", color: "var(--ink-soft)" }}>
                <Icon name="progress_activity" style={{ animation: "spin 1s linear infinite", fontSize: "2.2rem", marginBottom: "12px", color: "var(--accent)" }} />
                <div>Memuat daftar pengguna...</div>
              </div>
            ) : users.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 0", color: "var(--ink-soft)", border: "1px dashed var(--line)", borderRadius: "16px" }}>
                <div style={{ background: "var(--surface-soft)", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <Icon name="person_off" style={{ fontSize: "2rem", color: "var(--ink-soft)" }} />
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 6px 0", color: "var(--ink)" }}>Tidak Ditemukan</h3>
                <p style={{ margin: 0, fontSize: "0.88rem" }}>Tidak ada data pengguna yang cocok dengan kriteria pencarian.</p>
              </div>
            ) : (
              <table className="data-table" style={{ minWidth: 760, width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)", fontSize: "0.88rem", fontWeight: 800, color: "var(--ink-soft)" }}>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Nama Lengkap</th>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Email</th>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Role</th>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Instansi / Wilayah</th>
                    <th style={{ textAlign: "right", padding: "14px 16px" }}>Aksi Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr 
                      key={user.id} 
                      style={{ borderBottom: "1px solid var(--line)", transition: "background 0.2s ease" }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: "20px 16px", fontWeight: 700, color: "var(--ink)" }}>{user.name}</td>
                      <td style={{ padding: "20px 16px", color: "var(--ink-soft)", fontSize: "0.88rem" }}>{user.email}</td>
                      <td style={{ padding: "20px 16px" }}>
                        <span className="badge severity-sedang" style={{ textTransform: "capitalize", fontSize: "0.78rem", fontWeight: 700, background: "var(--accent-soft)", borderColor: "var(--line)", color: "var(--accent-dark)" }}>
                          {user.role.replace("bpbd_", "BPBD ").replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ padding: "20px 16px" }}>
                        <span className={`badge ${user.status === "aktif" ? "severity-ringan" : user.status === "menunggu" ? "status-menunggu" : "severity-sangat_parah"}`} style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                          {user.status}
                        </span>
                      </td>
                      <td style={{ padding: "20px 16px", color: "var(--ink-soft)", fontSize: "0.88rem" }}>
                        {user.institution || user.region_name || "-"}
                      </td>
                      <td style={{ padding: "20px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px", justifyContent: "flex-end" }}>
                          {user.status === "menunggu" ? (
                            <>
                              <button 
                                className="btn primary" 
                                type="button" 
                                style={{ padding: "8px 16px", borderRadius: "100px", fontSize: "0.8rem", fontWeight: 700, minHeight: "34px" }}
                                onClick={() => handleApprove(user.id, user.name)}
                              >
                                Setujui
                              </button>
                              <button 
                                className="btn secondary" 
                                type="button" 
                                style={{ padding: "8px 16px", borderRadius: "100px", fontSize: "0.8rem", fontWeight: 700, minHeight: "34px", color: "var(--critical)", borderColor: "var(--line)" }}
                                onClick={() => handleReject(user.id, user.name)}
                              >
                                Tolak
                              </button>
                            </>
                          ) : (
                            <button 
                              className="btn secondary" 
                              type="button" 
                              style={{ padding: "8px 16px", borderRadius: "100px", fontSize: "0.8rem", fontWeight: 700, minHeight: "34px" }}
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
