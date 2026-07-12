import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { api } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";
import { motion, AnimatePresence } from "framer-motion";

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

const containerVariants: any = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [isPermissionReview, setPermissionReview] = useState(false);

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
  const researchAccessCount = users.filter((u) => u.role === "peneliti" && u.status === "menunggu").length;

  return (
    <AppShell active="admin" title="Manajemen Pengguna & Perizinan">
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="content" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        
        {/* Pending Alerts Banner */}
        <AnimatePresence>
          {pendingCount > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="alert" 
              style={{ display: "flex", alignItems: "center", gap: 14, borderLeftColor: "var(--warning)" }}
            >
              <Icon name="notification_important" style={{ fontSize: 24, color: "var(--warning)" }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
                  {pendingCount} Pendaftaran Baru Membutuhkan Persetujuan
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                  Tinjau dan lakukan tindakan approve/reject pada tabel daftar pengguna di bawah.
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isPermissionReview && <motion.section variants={itemVariants} className="panel" style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 8, background: "var(--accent-soft)", color: "var(--accent-dark)", display: "grid", placeItems: "center" }}><Icon name="key" /></div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1rem" }}>Perizinan akses data</h2>
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>{researchAccessCount} permohonan akun peneliti menunggu keputusan admin.</p>
            </div>
          </div>
          <button type="button" className="btn secondary" onClick={() => { setPermissionReview(true); setRole("peneliti"); setStatus("menunggu"); setSearch(""); }}>
            <Icon name="policy" /> Tinjau perizinan
          </button>
        </motion.section>}

        {isPermissionReview && (
          <motion.div variants={itemVariants} className="permission-review-bar">
            <div>
              <strong>Perizinan Peneliti</strong>
              <span>Menampilkan akun peneliti yang menunggu persetujuan akses data.</span>
            </div>
            <button type="button" className="btn secondary" onClick={() => { setPermissionReview(false); setRole(""); setStatus(""); setSearch(""); }}>
              <Icon name="arrow_back" /> Kembali ke Manajemen Pengguna
            </button>
          </motion.div>
        )}

        {/* KPI Grid */}
        <motion.div variants={itemVariants} className="metric-grid" style={{ marginBottom: 32 }}>
          {[
            { title: "Pengguna Aktif", val: activeCount, sub: "Dapat masuk ke dashboard", cls: "success" },
            { title: "Menunggu Approval", val: pendingCount, sub: "Butuh validasi admin", cls: pendingCount > 0 ? "warning" : "" },
            { title: "Akses Nonaktif", val: inactiveCount, sub: "Akses ditutup", cls: "" },
            { title: "Total Terdaftar", val: users.length, sub: "Seluruh role pengguna", cls: "" }
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

        {/* Filters and List */}
        <motion.div variants={itemVariants} className="panel flush" style={{ overflow: "hidden", marginBottom: 32 }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Daftar Pengguna Sistem</h2>
            <motion.a 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              href="#/audit" 
              className="btn secondary" 
              style={{ fontSize: 12, padding: "8px 16px" }}
            >
              <Icon name="history" style={{ fontSize: 16 }} /> Lihat Audit Log
            </motion.a>
          </div>

          {/* Filters Bar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: "16px 24px", background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
            <select 
              value={role} 
              onChange={(e) => setRole(e.target.value)} 
              style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", minWidth: 160 }}
            >
              <option value="">Semua Role</option>
              <option value="admin">Admin</option>
              <option value="bpbd_operator">BPBD Operator</option>
              <option value="bpbd_provinsi">BPBD Provinsi</option>
              <option value="peneliti">Peneliti</option>
              <option value="warga">Warga</option>
            </select>

            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)} 
              style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--surface)", minWidth: 160 }}
            >
              <option value="">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="menunggu">Menunggu</option>
              <option value="nonaktif">Nonaktif</option>
              <option value="ditolak">Ditolak</option>
            </select>

            <div style={{ flex: 1, position: "relative", minWidth: 200 }}>
              <Icon name="search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)", fontSize: 18 }} />
              <input 
                type="text" 
                placeholder="Cari nama, email..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: 13, padding: "8px 12px 8px 36px", width: "100%", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}
              />
            </div>
          </div>

          {/* Table container */}
          <div>
            {isLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--ink-soft)" }}>Memuat daftar pengguna...</div>
            ) : users.length === 0 ? (
              <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--ink-soft)" }}>
                <Icon name="person_off" style={{ fontSize: 48, color: "var(--line)", marginBottom: 16 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Tidak Ditemukan</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Tidak ada pengguna yang cocok dengan filter pencarian Anda.</div>
              </div>
            ) : (
            <div className="table-responsive">
              <table className="data-table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Nama Lengkap</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Email</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Role</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600 }}>Instansi / Wilayah</th>
                    <th style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {users.map((user, idx) => (
                      <motion.tr 
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 + (idx * 0.05) }}
                        
                        style={{ borderBottom: "1px solid var(--line)" }}
                      >
                        <td style={{ padding: "16px 24px", fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{user.name}</td>
                        <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13 }}>{user.email}</td>
                        <td style={{ padding: "16px 24px" }}>
                          <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)", textTransform: "capitalize", fontSize: 11, padding: "4px 8px" }}>
                            {user.role.replace("bpbd_", "BPBD ").replace("_", " ")}
                          </span>
                        </td>
                        <td style={{ padding: "16px 24px" }}>
                          <span className={`badge ${
                            user.status === "aktif" ? "status-divalidasi" :
                            user.status === "menunggu" ? "status-menunggu" : ""
                          }`} style={{ fontSize: 11, padding: "4px 8px", background: user.status === "nonaktif" || user.status === "ditolak" ? "var(--surface-muted)" : undefined }}>
                            {user.status}
                          </span>
                        </td>
                        <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13 }}>{user.institution || user.region_name || "-"}</td>
                        <td style={{ padding: "16px 24px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end" }}>
                            {user.status === "menunggu" ? (
                              <>
                                <motion.button 
                                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                  style={{ background: "var(--success)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 600 }}
                                  onClick={() => handleApprove(user.id, user.name)}
                                >
                                  Setujui
                                </motion.button>
                                <motion.button 
                                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                  style={{ background: "var(--critical)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 600 }}
                                  onClick={() => handleReject(user.id, user.name)}
                                >
                                  Tolak
                                </motion.button>
                              </>
                            ) : (
                              <motion.button 
                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                className="btn secondary"
                                style={{ fontSize: 12, padding: "6px 12px" }}
                              >
                                Kelola
                              </motion.button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
