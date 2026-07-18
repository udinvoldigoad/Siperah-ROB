import { type FormEvent, useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AppShell } from "../../shared/components/AppShell";
import { api, apiUrl } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";
import { LoadingBlock } from "../../shared/components/LoadingBlock";
import { EmptyState } from "../../shared/components/EmptyState";
import { roleLabel } from "../../shared/constants/roles";
import { motion, AnimatePresence } from "framer-motion";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  institution: string | null;
  region_id: string | null;
  region_name: string | null;
}

const ROLE_OPTIONS = [
  { v: "warga", l: "Warga" },
  { v: "bpbd_operator", l: "BPBD Operator" },
  { v: "bpbd_provinsi", l: "BPBD Provinsi" },
  { v: "peneliti", l: "Peneliti" },
  { v: "admin", l: "Admin" },
] as const;

const STATUS_OPTIONS = [
  { v: "aktif", l: "Aktif" },
  { v: "menunggu", l: "Menunggu" },
  { v: "nonaktif", l: "Nonaktif" },
  { v: "ditolak", l: "Ditolak" },
] as const;

interface UserMeta {
  current_page: number;
  last_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

interface UserSummary {
  total: number;
  aktif: number;
  menunggu: number;
  nonaktif: number;
  peneliti_menunggu: number;
}

interface UserListResponse {
  data: UserData[];
  meta?: UserMeta;
  summary?: UserSummary;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  tone: "danger" | "default";
  onConfirm: () => void;
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
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<UserMeta | null>(null);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [isActing, setActing] = useState(false);

  // Filters & Search
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [isPermissionReview, setPermissionReview] = useState(false);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "warga",
    status: "aktif",
    institution: "",
    region_id: "",
  });

  const fetchUsers = useCallback(() => {
    setIsLoading(true);
    setError(null);
    const query = new URLSearchParams();
    if (role) query.append("role", role);
    if (status) query.append("status", status);
    if (search) query.append("search", search);
    query.append("page", String(page));

    return api<UserListResponse>(`/admin/users?${query.toString()}`)
      .then((res) => {
        setUsers(res.data);
        setMeta(res.meta ?? null);
        setSummary(res.summary ?? null);
      })
      .catch((err: unknown) => {
        setUsers([]);
        setError(err instanceof Error ? err.message : "Daftar pengguna belum bisa dimuat.");
      })
      .finally(() => setIsLoading(false));
  }, [role, status, search, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Ubah filter → kembali ke halaman 1.
  const onFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const changePage = (next: number) => {
    if (!meta || next < 1 || next > meta.last_page || next === page) return;
    setPage(next);
  };

  const runAction = async (label: string, request: Promise<unknown>, successMsg: string) => {
    setActing(true);
    try {
      await request;
      toast.success(successMsg);
      await fetchUsers();
      setConfirm(null);
    } catch (err: any) {
      toast.error(err.message || `Gagal ${label}.`);
    } finally {
      setActing(false);
    }
  };

  const handleApprove = (id: string, name: string) =>
    runAction("menyetujui akun", api(`/admin/users/${id}/approve`, { method: "POST" }), `Akun "${name}" berhasil disetujui.`);

  const confirmReject = (id: string, name: string) => setConfirm({
    title: "Tolak pendaftaran?",
    message: `Akun "${name}" akan ditandai ditolak dan sesi aktifnya diputus. Tindakan ini dapat diubah lewat "Kelola" nanti.`,
    confirmLabel: "Ya, tolak akun",
    tone: "danger",
    onConfirm: () => runAction("menolak akun", api(`/admin/users/${id}/reject`, { method: "POST" }), `Akun "${name}" ditolak.`),
  });

  const confirmToggleActive = (user: UserData) => {
    const willDeactivate = user.status === "aktif";
    setConfirm({
      title: willDeactivate ? "Nonaktifkan pengguna?" : "Aktifkan kembali pengguna?",
      message: willDeactivate
        ? `Akun "${user.name}" tidak akan bisa masuk lagi dan sesi aktifnya diputus.`
        : `Akun "${user.name}" akan diaktifkan kembali dan dapat masuk ke sistem.`,
      confirmLabel: willDeactivate ? "Ya, nonaktifkan" : "Ya, aktifkan",
      tone: willDeactivate ? "danger" : "default",
      onConfirm: () => runAction(
        willDeactivate ? "menonaktifkan akun" : "mengaktifkan akun",
        api(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ status: willDeactivate ? "nonaktif" : "aktif" }) }),
        willDeactivate ? `Akun "${user.name}" dinonaktifkan.` : `Akun "${user.name}" diaktifkan.`,
      ),
    });
  };

  // ── Edit inline role/status/wilayah (via PATCH) ──────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ role: string; status: string; region_id: string }>({ role: "", status: "", region_id: "" });

  const startEdit = (user: UserData) => {
    setEditingId(user.id);
    setEditDraft({ role: user.role, status: user.status, region_id: user.region_id ?? "" });
  };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (user: UserData) => {
    const payload: Record<string, unknown> = {};
    if (editDraft.role !== user.role) payload.role = editDraft.role;
    if (editDraft.status !== user.status) payload.status = editDraft.status;
    if (editDraft.region_id !== (user.region_id ?? "")) payload.region_id = editDraft.region_id || null;

    if (Object.keys(payload).length === 0) { cancelEdit(); return; }

    setActing(true);
    try {
      await api(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      toast.success(`Akun "${user.name}" berhasil diperbarui.`);
      setEditingId(null);
      await fetchUsers();
    } catch (err: any) {
      // Tetap di mode edit agar admin bisa memperbaiki — mis. mengubah role ke
      // operator tanpa mengisi wilayah akan ditolak backend dengan pesan jelas.
      toast.error(err.message || "Gagal memperbarui akun.");
    } finally {
      setActing(false);
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          ...newUser,
          institution: newUser.institution || null,
          region_id: newUser.region_id || null,
        }),
      });
      toast.success(`Akun "${newUser.name}" berhasil dibuat.`);
      setNewUser({ name: "", email: "", password: "", role: "warga", status: "aktif", institution: "", region_id: "" });
      setCreateOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat pengguna.");
    }
  };

  const handleExportUsers = async () => {
    try {
      const token = localStorage.getItem("siperah-token");
      const response = await fetch(apiUrl("/api/admin/users/export"), {
        headers: { Accept: "text/csv", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!response.ok) throw new Error(`Export gagal (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "admin-users.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Export pengguna berhasil diunduh.");
    } catch (err: any) {
      toast.error(err.message || "Gagal export pengguna.");
    }
  };

  const activeCount = summary?.aktif ?? 0;
  const pendingCount = summary?.menunggu ?? 0;
  const inactiveCount = summary?.nonaktif ?? 0;
  const researchAccessCount = summary?.peneliti_menunggu ?? 0;
  const totalCount = summary?.total ?? users.length;
  const pageNumbers = meta
    ? Array.from({ length: meta.last_page }, (_, i) => i + 1).filter(
        (n) => meta.last_page <= 7 || n === 1 || n === meta.last_page || Math.abs(n - meta.current_page) <= 1,
      )
    : [];

  return (
    <AppShell active="admin" title="Manajemen Pengguna & Perizinan">
      <style>{`
        .admin-pagination { align-items: center; border-top: 1px solid var(--line); display: flex; gap: 8px; justify-content: space-between; padding: 16px 24px; flex-wrap: wrap; }
        .admin-page-btn { align-items: center; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; color: var(--ink); cursor: pointer; display: inline-flex; height: 36px; justify-content: center; min-width: 36px; padding: 0 10px; }
        .admin-page-btn:hover:not(:disabled) { background: var(--surface-soft); border-color: var(--accent); }
        .admin-page-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 800; }
        .admin-page-btn:disabled { cursor: not-allowed; opacity: .45; }
        .admin-confirm-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 1000; }
        .admin-confirm-card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25); max-width: 440px; padding: 26px; width: 100%; animation: adminConfirmIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes adminConfirmIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .admin-create-card { background: var(--surface-soft); border: 1px solid var(--line); border-radius: 16px; margin-top: 18px; overflow: hidden; }
        .admin-create-grid { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 22px; }
        .admin-field { display: grid; gap: 7px; }
        .admin-field.span-2 { grid-column: 1 / -1; }
        .admin-field label { align-items: center; color: var(--ink-soft); display: flex; font-size: 12px; font-weight: 700; gap: 6px; letter-spacing: 0.02em; text-transform: uppercase; }
        .admin-field label .material-symbols-outlined, .admin-field label .material-symbols-rounded { font-size: 15px; }
        .admin-field input, .admin-field select { background: var(--surface); }
        .admin-role-pills { display: flex; flex-wrap: wrap; gap: 8px; }
        .admin-role-pill { align-items: center; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; cursor: pointer; display: inline-flex; font-size: 13px; font-weight: 600; gap: 6px; padding: 8px 14px; transition: all 0.15s ease; }
        .admin-role-pill:hover { border-color: var(--accent); }
        .admin-role-pill.active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .admin-create-footer { align-items: center; background: var(--surface); border-top: 1px solid var(--line); display: flex; gap: 14px; justify-content: space-between; padding: 16px 22px; flex-wrap: wrap; }
        .admin-create-hint { align-items: flex-start; color: var(--ink-soft); display: flex; font-size: 12.5px; gap: 8px; line-height: 1.5; max-width: 480px; }
        .admin-create-hint .material-symbols-outlined, .admin-create-hint .material-symbols-rounded { color: var(--accent); font-size: 17px; }
        @media (max-width: 640px) { .admin-create-grid { grid-template-columns: 1fr; } }
      `}</style>
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="content" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        
        {/* Pending Alerts Banner */}
        <AnimatePresence>
          {pendingCount > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="alert" 
              style={{ display: "flex", alignItems: "center", gap: 14, borderLeftColor: "var(--medium)" }}
            >
              <Icon name="notification_important" style={{ fontSize: 24, color: "var(--medium)" }} />
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

        {!isPermissionReview && (
          <motion.section variants={itemVariants} className="panel" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1rem" }}>Tambah pengguna manual</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-soft)" }}>Gunakan untuk membuat akun admin/operator/provinsi/peneliti saat diperlukan operasional.</p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn secondary" onClick={handleExportUsers}><Icon name="download" /> Export Pengguna</button>
                <button type="button" className="btn primary" onClick={() => setCreateOpen((value) => !value)}><Icon name="person_add" /> {isCreateOpen ? "Tutup Form" : "Tambah Pengguna"}</button>
              </div>
            </div>
            <AnimatePresence>
              {isCreateOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <form onSubmit={handleCreateUser} className="admin-create-card">
                    <div className="admin-create-grid">
                      <div className="admin-field">
                        <label><Icon name="person" /> Nama lengkap</label>
                        <input required placeholder="cth. Siti Amalia" value={newUser.name} onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))} />
                      </div>
                      <div className="admin-field">
                        <label><Icon name="mail" /> Email</label>
                        <input required type="email" placeholder="nama@instansi.go.id" value={newUser.email} onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))} />
                      </div>
                      <div className="admin-field">
                        <label><Icon name="lock" /> Password awal</label>
                        <input required type="password" minLength={8} placeholder="Minimal 8 karakter" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} />
                      </div>
                      <div className="admin-field">
                        <label><Icon name="apartment" /> Instansi</label>
                        <input placeholder="Wajib untuk peneliti" value={newUser.institution} onChange={(e) => setNewUser((u) => ({ ...u, institution: e.target.value }))} />
                      </div>
                      <div className="admin-field span-2">
                        <label><Icon name="badge" /> Peran</label>
                        <div className="admin-role-pills">
                          {[
                            { v: "warga", l: "Warga" },
                            { v: "bpbd_operator", l: "BPBD Operator" },
                            { v: "bpbd_provinsi", l: "BPBD Provinsi" },
                            { v: "peneliti", l: "Peneliti" },
                            { v: "admin", l: "Admin" },
                          ].map((opt) => (
                            <button
                              key={opt.v}
                              type="button"
                              className={`admin-role-pill ${newUser.role === opt.v ? "active" : ""}`}
                              onClick={() => setNewUser((u) => ({ ...u, role: opt.v }))}
                            >
                              {opt.l}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="admin-field">
                        <label><Icon name="toggle_on" /> Status awal</label>
                        <select value={newUser.status} onChange={(e) => setNewUser((u) => ({ ...u, status: e.target.value }))}>
                          <option value="aktif">Aktif</option>
                          <option value="menunggu">Menunggu approval</option>
                          <option value="nonaktif">Nonaktif</option>
                        </select>
                      </div>
                      <div className="admin-field">
                        <label><Icon name="pin_drop" /> Region ID (wilayah operator)</label>
                        <input placeholder="cth. 1801010" value={newUser.region_id} onChange={(e) => setNewUser((u) => ({ ...u, region_id: e.target.value }))} />
                      </div>
                    </div>
                    <div className="admin-create-footer">
                      <span className="admin-create-hint">
                        <Icon name="info" />
                        Operator BPBD wajib punya Region ID. Peneliti wajib punya instansi agar perizinan jelas.
                      </span>
                      <button type="submit" className="btn primary"><Icon name="save" /> Simpan Pengguna</button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

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
            { title: "Total Terdaftar", val: totalCount, sub: "Seluruh role pengguna", cls: "" }
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
              onChange={(e) => onFilterChange(setRole)(e.target.value)}
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
              onChange={(e) => onFilterChange(setStatus)(e.target.value)}
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
                onChange={(e) => onFilterChange(setSearch)(e.target.value)}
                style={{ fontSize: 13, padding: "8px 12px 8px 36px", width: "100%", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}
              />
            </div>
          </div>

          {/* Table container */}
          <div>
            {isLoading ? (
              <div style={{ padding: "16px 24px" }}><LoadingBlock rows={6} label="Memuat daftar pengguna…" /></div>
            ) : error ? (
              <div style={{ padding: "56px 20px", textAlign: "center", color: "var(--ink-soft)", display: "grid", justifyItems: "center", gap: 4 }}>
                <Icon name="error" style={{ fontSize: 48, color: "var(--critical)", opacity: 0.85, marginBottom: 8 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Gagal memuat pengguna</div>
                <div style={{ fontSize: 13, margin: "0 0 12px" }}>{error}</div>
                <button type="button" className="btn secondary" onClick={() => fetchUsers()}><Icon name="refresh" /> Coba lagi</button>
              </div>
            ) : users.length === 0 ? (
              <EmptyState
                icon="person_off"
                title="Tidak ditemukan"
                description="Tidak ada pengguna yang cocok dengan filter pencarian Anda."
              />
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
                    {users.map((user, idx) => {
                      const isEditing = editingId === user.id;
                      const editControlStyle = { padding: "6px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, width: "100%" as const };
                      return (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 + (idx * 0.05) }}
                        style={{ borderBottom: "1px solid var(--line)", ...(isEditing ? { background: "var(--surface-soft)" } : {}) }}
                      >
                        <td style={{ padding: "16px 24px", fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{user.name}</td>
                        <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13 }}>{user.email}</td>
                        <td style={{ padding: "16px 24px" }}>
                          {isEditing ? (
                            <select aria-label="Ubah role" value={editDraft.role} onChange={(e) => setEditDraft((d) => ({ ...d, role: e.target.value }))} style={{ ...editControlStyle, minWidth: 140 }}>
                              {ROLE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          ) : (
                            <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 11, padding: "4px 8px" }}>
                              {roleLabel(user.role)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "16px 24px" }}>
                          {isEditing ? (
                            <select aria-label="Ubah status" value={editDraft.status} onChange={(e) => setEditDraft((d) => ({ ...d, status: e.target.value }))} style={{ ...editControlStyle, minWidth: 120 }}>
                              {STATUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          ) : (
                            <span className={`badge ${
                              user.status === "aktif" ? "status-divalidasi" :
                              user.status === "menunggu" ? "status-menunggu" : ""
                            }`} style={{ fontSize: 11, padding: "4px 8px", background: user.status === "nonaktif" || user.status === "ditolak" ? "var(--surface-muted)" : undefined }}>
                              {user.status}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13 }}>
                          {isEditing ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
                              <input aria-label="Region ID wilayah operator" value={editDraft.region_id} onChange={(e) => setEditDraft((d) => ({ ...d, region_id: e.target.value }))} placeholder="UUID region" style={editControlStyle} />
                              {editDraft.role === "bpbd_operator" && <span style={{ fontSize: 11, color: "var(--medium)", fontWeight: 600 }}>Wajib untuk operator</span>}
                            </div>
                          ) : (
                            user.institution || user.region_name || "-"
                          )}
                        </td>
                        <td style={{ padding: "16px 24px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            {isEditing ? (
                              <>
                                <button type="button" className="btn primary" disabled={isActing} style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => saveEdit(user)}>
                                  <Icon name="save" style={{ fontSize: 16 }} /> Simpan
                                </button>
                                <button type="button" className="btn secondary" disabled={isActing} style={{ fontSize: 12, padding: "6px 12px" }} onClick={cancelEdit}>
                                  Batal
                                </button>
                              </>
                            ) : user.status === "menunggu" ? (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                  style={{ background: "var(--low)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 600 }}
                                  onClick={() => handleApprove(user.id, user.name)}
                                >
                                  Setujui
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                  style={{ background: "var(--critical)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 600 }}
                                  onClick={() => confirmReject(user.id, user.name)}
                                >
                                  Tolak
                                </motion.button>
                                <button type="button" className="btn secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => startEdit(user)} aria-label={`Kelola akun ${user.name}`}>
                                  <Icon name="edit" style={{ fontSize: 16 }} /> Kelola
                                </button>
                              </>
                            ) : (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                  className="btn secondary"
                                  style={{ fontSize: 12, padding: "6px 12px", color: user.status === "aktif" ? "var(--critical)" : "var(--low)" }}
                                  onClick={() => confirmToggleActive(user)}
                                >
                                  <Icon name={user.status === "aktif" ? "block" : "check_circle"} style={{ fontSize: 16 }} />
                                  {user.status === "aktif" ? "Nonaktifkan" : "Aktifkan"}
                                </motion.button>
                                <button type="button" className="btn secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => startEdit(user)} aria-label={`Kelola akun ${user.name}`}>
                                  <Icon name="edit" style={{ fontSize: 16 }} /> Kelola
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );})}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            )}
          </div>

          {!isLoading && !error && meta && meta.last_page > 1 && (
            <nav className="admin-pagination" aria-label="Navigasi halaman pengguna">
              <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>
                Menampilkan {meta.from ?? 0}–{meta.to ?? 0} dari {meta.total} pengguna
              </span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" className="admin-page-btn" disabled={page <= 1} onClick={() => changePage(page - 1)} aria-label="Halaman sebelumnya">
                  <Icon name="chevron_left" />
                </button>
                {pageNumbers.map((n, i) => (
                  <span key={n} style={{ display: "contents" }}>
                    {i > 0 && n - pageNumbers[i - 1] > 1 && <span style={{ alignSelf: "center", padding: "0 3px" }}>…</span>}
                    <button type="button" className={`admin-page-btn ${n === meta.current_page ? "active" : ""}`} onClick={() => changePage(n)} aria-current={n === meta.current_page ? "page" : undefined}>{n}</button>
                  </span>
                ))}
                <button type="button" className="admin-page-btn" disabled={page >= meta.last_page} onClick={() => changePage(page + 1)} aria-label="Halaman berikutnya">
                  <Icon name="chevron_right" />
                </button>
              </div>
            </nav>
          )}
        </motion.div>
      </motion.div>

      {confirm && createPortal(
        <div className="admin-confirm-overlay" role="dialog" aria-modal="true" aria-label={confirm.title} onClick={() => !isActing && setConfirm(null)}>
          <div className="admin-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Icon name={confirm.tone === "danger" ? "warning" : "help"} style={{ fontSize: 24, color: confirm.tone === "danger" ? "var(--critical)" : "var(--accent)" }} />
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{confirm.title}</h2>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6 }}>{confirm.message}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="btn secondary" disabled={isActing} onClick={() => setConfirm(null)}>Batal</button>
              <button
                type="button"
                className="btn primary"
                disabled={isActing}
                onClick={confirm.onConfirm}
                style={confirm.tone === "danger" ? { background: "var(--critical)", borderColor: "var(--critical)" } : undefined}
              >
                {isActing ? "Memproses…" : confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </AppShell>
  );
}
