import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { api, downloadFile, errorMessage } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";
import { LoadingBlock } from "../../shared/components/LoadingBlock";
import { EmptyState } from "../../shared/components/EmptyState";
import { RowActionsMenu, type RowAction } from "../../shared/components/RowActionsMenu";
import { ConfirmDialog, type ConfirmState } from "./components/ConfirmDialog";
import { CreateUserModal } from "./components/CreateUserModal";
import { EditUserModal } from "./components/EditUserModal";
import { ReviewUserModal } from "./components/ReviewUserModal";
import { roleLabel } from "../../shared/constants/roles";
import { userStatusLabel, userStatusOptions } from "../../shared/constants/userStatus";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import type { UserData, UserMeta, UserSummary, UserListResponse } from "./types";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }
};

const itemVariants: Variants = {
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

  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [isCreateOpen, setCreateOpen] = useState(false);

  const [regions, setRegions] = useState<{ id: string; regency: string }[]>([]);

  const fetchSeqRef = useRef(0);

  const [reviewUser, setReviewUser] = useState<UserData | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    const seq = ++fetchSeqRef.current;
    setIsLoading(true);
    setError(null);
    const query = new URLSearchParams();
    if (role) query.append("role", role);
    if (status) query.append("status", status);
    if (appliedSearch) query.append("search", appliedSearch);
    query.append("page", String(page));

    return api<UserListResponse>(`/admin/users?${query.toString()}`)
      .then((res) => {
        if (seq !== fetchSeqRef.current) return;
        setUsers(res.data);
        setMeta(res.meta ?? null);
        setSummary(res.summary ?? null);
      })
      .catch((err: unknown) => {
        if (seq !== fetchSeqRef.current) return;
        setUsers([]);
        setError(err instanceof Error ? err.message : "Daftar pengguna belum bisa dimuat.");
      })
      .finally(() => { if (seq === fetchSeqRef.current) setIsLoading(false); });
  }, [role, status, appliedSearch, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    api<{ data: { id: string; regency: string }[] }>("/admin/regions")
      .then((res) => setRegions(res.data))
      .catch(() => setRegions([]));
  }, []);

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
    } catch (err: unknown) {
      toast.error(errorMessage(err, `Gagal ${label}.`));
    } finally {
      setActing(false);
    }
  };

  const handleApprove = (id: string, name: string) =>
    runAction("menyetujui akun", api(`/admin/users/${id}/approve`, { method: "POST" }), `Akun "${name}" berhasil disetujui.`);

  const confirmReject = (id: string, name: string) => setConfirm({
    title: "Tolak pendaftaran?",
    message: `Akun "${name}" akan ditandai ditolak dan sesi aktifnya diputus. Bisa dipulihkan lewat tombol "Aktifkan" nanti.`,
    confirmLabel: "Ya, tolak akun",
    tone: "danger",
    onConfirm: () => runAction("menolak akun", api(`/admin/users/${id}/reject`, { method: "POST" }), `Akun "${name}" ditolak.`),
  });

  const confirmDelete = (user: UserData) => setConfirm({
    title: "Hapus pengguna?",
    message: `Akun "${user.name}" akan dihapus dari daftar dan tidak bisa masuk lagi. Jejak audit & laporan lamanya tetap tersimpan untuk keperluan riwayat.`,
    confirmLabel: "Ya, hapus akun",
    tone: "danger",
    onConfirm: () => runAction(
      "menghapus akun",
      api(`/admin/users/${user.id}`, { method: "DELETE" }),
      `Akun "${user.name}" dihapus.`,
    ),
  });

  const handleActivate = (user: UserData) =>
    runAction("mengaktifkan akun", api(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ status: "aktif" }) }), `Akun "${user.name}" diaktifkan.`);

  const confirmDeactivate = (user: UserData) => setConfirm({
    title: "Nonaktifkan akun?",
    message: `Akun "${user.name}" tidak akan bisa masuk dan sesi aktifnya diputus. Bisa diaktifkan kembali kapan saja.`,
    confirmLabel: "Ya, nonaktifkan",
    tone: "danger",
    onConfirm: () => runAction(
      "menonaktifkan akun",
      api(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ status: "nonaktif" }) }),
      `Akun "${user.name}" dinonaktifkan.`,
    ),
  });

  const startEdit = (user: UserData) => {
    setEditingId(user.id);
  };
  const cancelEdit = () => setEditingId(null);

  const rowActions = (user: UserData): RowAction[] => {
    const kelola: RowAction = { key: "kelola", label: "Kelola", icon: "edit", onSelect: () => startEdit(user) };

    if (user.status === "menunggu" && user.role === "peneliti") {
      return [
        { key: "tinjau", label: "Tinjau Permohonan", icon: "fact_check", tone: "primary", onSelect: () => setReviewUser(user) },
        kelola,
      ];
    }

    if (user.status === "menunggu") {
      return [
        { key: "setujui", label: "Setujui", icon: "check_circle", tone: "primary", onSelect: () => handleApprove(user.id, user.name) },
        { key: "tolak", label: "Tolak", icon: "cancel", tone: "danger", onSelect: () => confirmReject(user.id, user.name) },
        kelola,
      ];
    }

    return [
      user.status === "aktif"
        ? { key: "nonaktifkan", label: "Nonaktifkan", icon: "block", onSelect: () => confirmDeactivate(user) }
        : { key: "aktifkan", label: "Aktifkan", icon: "how_to_reg", tone: "primary", onSelect: () => handleActivate(user) },
      kelola,
      { key: "hapus", label: "Hapus", icon: "delete", tone: "danger", onSelect: () => confirmDelete(user) },
    ];
  };

  const handleExportUsers = async () => {
    try {
      await downloadFile("/admin/users/export", "admin-users.csv", { role, status, search: appliedSearch });
      toast.success("Export pengguna berhasil diunduh.");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Gagal export pengguna."));
    }
  };

  const activeCount = summary?.aktif ?? 0;
  const pendingCount = summary?.menunggu ?? 0;
  const penelitiPending = summary?.peneliti_menunggu ?? 0;

  const showPendingQueue = () => {
    setRole("");
    setStatus("menunggu");
    setPage(1);
  };

  const closedCount = (summary?.nonaktif ?? 0) + (summary?.ditolak ?? 0);
  const totalCount = summary?.total ?? users.length;
  const pageNumbers = meta
    ? Array.from({ length: meta.last_page }, (_, i) => i + 1).filter(
        (n) => meta.last_page <= 7 || n === 1 || n === meta.last_page || Math.abs(n - meta.current_page) <= 1,
      )
    : [];

  const editingUser = editingId ? users.find((u) => u.id === editingId) ?? null : null;

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
        .admin-modal-card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28); width: 100%; max-width: 720px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; }
        .admin-modal-head { align-items: flex-start; background: var(--surface); border-bottom: 1px solid var(--line); display: flex; gap: 16px; justify-content: space-between; padding: 20px 24px; position: sticky; top: 0; z-index: 1; }
        .admin-modal-head h2 { margin: 0; font-size: 1.15rem; }
        .admin-modal-head p { color: var(--ink-soft); font-size: 13px; margin: 4px 0 0; }
        .admin-modal-close { align-items: center; background: var(--surface-soft); border: 1px solid var(--line); border-radius: 10px; color: var(--ink-soft); cursor: pointer; display: inline-flex; flex-shrink: 0; height: 36px; justify-content: center; transition: all 0.15s ease; width: 36px; }
        .admin-modal-close:hover { background: var(--surface-muted); border-color: var(--accent); color: var(--ink); }
        .admin-create-grid { display: grid; gap: 16px; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 22px; }
        .admin-field { display: grid; gap: 7px; }
        .admin-field.span-2 { grid-column: 1 / -1; }
        .admin-field label { align-items: center; color: var(--ink-soft); display: flex; font-size: 12px; font-weight: 700; gap: 6px; letter-spacing: 0.02em; text-transform: uppercase; }
        .admin-field label .material-symbols-outlined, .admin-field label .material-symbols-rounded { font-size: 15px; }
        .admin-field input, .admin-field select {
          background-color: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          box-shadow: none;
          box-sizing: border-box;
          color: var(--ink);
          font: inherit;
          font-size: 14px;
          height: 46px;
          padding: 0 14px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          width: 100%;
        }
        .admin-field select { cursor: pointer; padding-right: 38px; }
        .admin-field input::placeholder { color: var(--ink-soft); opacity: 0.7; }
        .admin-field input:hover, .admin-field select:hover { border-color: var(--accent); }
        .admin-field input:focus, .admin-field select:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
          outline: none;
        }
        .admin-role-pills { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
        .admin-role-pill { align-items: center; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; cursor: pointer; display: inline-flex; font-size: 13px; font-weight: 600; gap: 6px; justify-content: center; padding: 10px 14px; text-align: center; transition: all 0.15s ease; width: 100%; }
        .admin-role-pill:hover { border-color: var(--accent); }
        .admin-role-pill.active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .admin-create-footer { align-items: center; background: var(--surface); border-top: 1px solid var(--line); display: flex; gap: 14px; justify-content: space-between; padding: 16px 22px; flex-wrap: wrap; }
        .review-label { color: var(--ink-soft); font-size: 11.5px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; }
        .users-org-cell {
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          width: 220px;
        }
        .admin-create-hint { align-items: flex-start; color: var(--ink-soft); display: flex; font-size: 12.5px; gap: 8px; line-height: 1.5; max-width: 480px; }
        .admin-create-hint .material-symbols-outlined, .admin-create-hint .material-symbols-rounded { color: var(--accent); font-size: 17px; }
        @media (max-width: 640px) { .admin-create-grid { grid-template-columns: 1fr; } }

        @media (max-width: 768px) {
          .metric-grid.admin-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px !important; }
          .metric-grid.admin-kpis .metric-card { padding: 18px !important; }
          .metric-grid.admin-kpis .metric-card span { font-size: 12px !important; }
          .metric-grid.admin-kpis .metric-card strong { font-size: 28px !important; }
          .metric-grid.admin-kpis .metric-card small { font-size: 11px !important; }
        }

        .users-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .users-filter { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
        .users-filter select { height: 42px; border-radius: 10px; border: 1px solid var(--line); background-color: var(--surface); color: var(--ink); font: inherit; font-size: 13px; min-width: 160px; padding: 0 34px 0 12px; box-sizing: border-box; cursor: pointer; }
        .users-search { position: relative; flex: 1; min-width: 200px; }
        .users-search input { height: 42px; width: 100%; border-radius: 10px; border: 1px solid var(--line); background-color: var(--surface); color: var(--ink); font: inherit; font-size: 13px; padding: 0 12px 0 38px; box-sizing: border-box; }
        .users-filter select:focus, .users-search input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }

        @media (max-width: 640px) {
          .users-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; }
          .users-actions .btn { width: 100%; justify-content: center; padding: 10px 8px; font-size: 12.5px; }
          .users-filter { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .users-filter select { min-width: 0; width: 100%; }
          .users-search { grid-column: 1 / -1; min-width: 0; }
        }
      `}</style>
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="content" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>

        <motion.section
          variants={itemVariants}
          className="panel"
          style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", borderLeft: pendingCount > 0 ? "3px solid var(--medium)" : undefined }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 8, background: pendingCount > 0 ? "var(--medium-soft, #fef3c7)" : "var(--ocean-light, #e0f2fe)", color: pendingCount > 0 ? "var(--medium)" : "var(--ocean-dark, #0284c7)", display: "grid", placeItems: "center" }}>
              <Icon name={pendingCount > 0 ? "how_to_reg" : "verified_user"} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1rem" }}>Perizinan akun</h2>
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                {pendingCount > 0 ? (
                  <>
                    <strong>{pendingCount}</strong> akun menunggu keputusan
                    {penelitiPending > 0 && <> — <strong>{penelitiPending}</strong> di antaranya permohonan peneliti dengan alasan tertulis</>}.
                  </>
                ) : (
                  "Tidak ada permohonan yang menunggu. Akses data peneliti diberikan di sini, sekali saat akunnya disetujui."
                )}
              </p>
            </div>
          </div>
          {pendingCount > 0 && (
            <button type="button" className="btn secondary" onClick={showPendingQueue} style={{ position: "relative" }}>
              <Icon name="fact_check" /> Tinjau permohonan
              <span style={{ position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: "var(--critical)", color: "#fff", fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center" }}>{pendingCount}</span>
            </button>
          )}
        </motion.section>

        <motion.div variants={itemVariants} className="metric-grid admin-kpis" style={{ marginBottom: 32 }}>
          {[
            { title: "Pengguna Aktif", val: activeCount, sub: "Dapat masuk ke dashboard", cls: "success" },
            { title: "Menunggu Approval", val: pendingCount, sub: "Butuh validasi admin", cls: pendingCount > 0 ? "medium" : "" },
            { title: "Akses Ditutup", val: closedCount, sub: "Nonaktif & ditolak", cls: "" },
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

        <CreateUserModal
          isOpen={isCreateOpen}
          onClose={() => setCreateOpen(false)}
          regions={regions}
          onCreated={fetchUsers}
        />

        <EditUserModal
          user={editingUser}
          onClose={cancelEdit}
          regions={regions}
          onSaved={fetchUsers}
        />

        <ReviewUserModal
          user={reviewUser}
          onClose={() => setReviewUser(null)}
          onApprove={handleApprove}
          onReject={(id, name) => confirmReject(id, name)}
          isActing={isActing}
        />

        <motion.div variants={itemVariants} className="panel flush" style={{ overflow: "hidden", marginBottom: 32 }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Daftar Pengguna Sistem</h2>
            <div className="users-actions">
              <button type="button" className="btn secondary" onClick={handleExportUsers}><Icon name="download" /> Export Pengguna</button>
              <button type="button" className="btn primary" onClick={() => setCreateOpen((value) => !value)}><Icon name="person_add" /> {isCreateOpen ? "Tutup Form" : "Tambah Pengguna"}</button>
            </div>
          </div>

          <div className="users-filter" style={{ padding: "16px 24px", background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
            <select
              value={role}
              onChange={(e) => onFilterChange(setRole)(e.target.value)}
              aria-label="Filter role"
            >
              <option value="">Semua Role</option>
              <option value="admin">Admin</option>
              <option value="peneliti">Peneliti</option>
              <option value="warga">Warga</option>
            </select>

            <select
              value={status}
              onChange={(e) => onFilterChange(setStatus)(e.target.value)}
              aria-label="Filter status"
            >
              <option value="">Semua Status</option>
              {userStatusOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <div className="users-search">
              <Icon name="search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-soft)", fontSize: 18 }} />
              <input
                type="text"
                placeholder="Cari nama, email..."
                maxLength={100}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div>
            {isLoading ? (
              <div style={{ padding: "16px 24px" }}><LoadingBlock rows={6} label="Memuat daftar pengguna\u2026" /></div>
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
              <table className="data-table" style={{ width: "100%", minWidth: 900, textAlign: "left", borderCollapse: "collapse" }}>
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
                      return (
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
                          <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 11, padding: "4px 8px" }}>
                            {roleLabel(user.role)}
                          </span>
                        </td>
                        <td style={{ padding: "16px 24px" }}>
                          <span className={`badge ${
                            user.status === "aktif" ? "status-divalidasi" :
                            user.status === "menunggu" ? "status-menunggu" : ""
                          }`} style={{ fontSize: 11, padding: "4px 8px", background: user.status === "nonaktif" || user.status === "ditolak" ? "var(--surface-muted)" : undefined }}>
                            {userStatusLabel(user.status)}
                          </span>
                        </td>
                        <td
                          className="users-org-cell"
                          style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13 }}
                          title={user.institution || user.region_name || undefined}
                        >
                          {user.institution || user.region_name || "-"}
                        </td>
                        <td style={{ padding: "16px 24px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <RowActionsMenu
                            label={`Aksi untuk ${user.name}`}
                            disabled={isActing}
                            actions={rowActions(user)}
                          />
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
                Menampilkan {meta.from ?? 0}\u2013{meta.to ?? 0} dari {meta.total} pengguna
              </span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button type="button" className="admin-page-btn" disabled={page <= 1} onClick={() => changePage(page - 1)} aria-label="Halaman sebelumnya">
                  <Icon name="chevron_left" />
                </button>
                {pageNumbers.map((n, i) => (
                  <span key={n} style={{ display: "contents" }}>
                    {i > 0 && n - pageNumbers[i - 1] > 1 && <span style={{ alignSelf: "center", padding: "0 3px" }}>\u2026</span>}
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

        {confirm && (
          <ConfirmDialog
            {...confirm}
            onClose={() => setConfirm(null)}
            isActing={isActing}
          />
        )}
      </motion.div>
    </AppShell>
  );
}
