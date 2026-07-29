import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppShell } from "../../shared/components/AppShell";
import { api, apiUrl, downloadFile, errorMessage } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";
import { LoadingBlock } from "../../shared/components/LoadingBlock";
import { EmptyState } from "../../shared/components/EmptyState";
import { roleLabel } from "../../shared/constants/roles";
import { userStatusLabel, userStatusOptions } from "../../shared/constants/userStatus";
import { motion, AnimatePresence, type Variants } from "framer-motion";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  institution: string | null;
  region_id: string | null;
  region_name: string | null;
  created_at: string | null;
  // Hanya terisi untuk peneliti — keterangan yang ditulis pemohon saat
  // mendaftar, dipakai admin untuk memutuskan setujui/tolak.
  permission_workflow: {
    status: string;
    institution: string | null;
    reason: string | null;
    email_verified: boolean;
  } | null;
}

const ROLE_OPTIONS = [
  { v: "warga", l: "Warga" },
  { v: "peneliti", l: "Peneliti" },
  { v: "admin", l: "Admin" },
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
  ditolak?: number;
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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

type RegionOption = { id: string; regency: string };

/**
 * Tempatkan panel dropdown relatif terhadap trigger tanpa keluar viewport:
 * buka ke bawah bila muat, jatuhkan ke atas bila ruang bawah sempit, dan
 * batasi tinggi ke ruang yang benar-benar tersedia supaya daftar bisa
 * digulung penuh alih-alih terpotong tepi layar.
 */
function panelPlacement(rect: DOMRect): { top?: number; bottom?: number; left: number; maxHeight: number } {
  const GAP = 6;
  const EDGE = 8;
  const MIN_HEIGHT = 160;

  const below = window.innerHeight - rect.bottom - GAP - EDGE;
  const above = rect.top - GAP - EDGE;
  const dropUp = below < MIN_HEIGHT && above > below;

  return {
    ...(dropUp
      ? { bottom: window.innerHeight - rect.top + GAP }
      : { top: rect.bottom + GAP }),
    left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - rect.width - EDGE)),
    maxHeight: Math.max(MIN_HEIGHT, dropUp ? above : below),
  };
}

type RowAction = {
  key: string;
  label: string;
  icon: string;
  tone?: "primary" | "danger";
  onSelect: () => void;
};

/**
 * Menu titik tiga untuk aksi per baris.
 *
 * Sebelumnya tiap baris memajang 3 tombol sekaligus, sehingga kolom Aksi jauh
 * lebih lebar daripada kolom datanya sendiri dan tabel ikut melebar. Aksinya
 * tetap sama persis — hanya dikumpulkan ke satu pemicu.
 *
 * Panelnya memakai pola yang sama dengan RegionCombobox di bawah: portal +
 * posisi fixed, karena tabel berada di dalam wadah yang menggulung dan menu
 * biasa akan terpotong. Menggulung MEMINDAHKAN panel, bukan menutupnya.
 */
function RowActionsMenu({ actions, label, disabled }: {
  actions: RowAction[];
  label: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const reposition = (e?: Event) => {
      if (e && panelRef.current?.contains(e.target as Node)) return;
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      if (r.bottom < 0 || r.top > window.innerHeight) { setOpen(false); return; }
      setRect(r);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const toggle = () => {
    if (!open) setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setOpen((v) => !v);
  };

  const MENU_WIDTH = 210;
  const placement = rect ? panelPlacement(rect) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="admin-row-menu-trigger"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <Icon name="more_vert" style={{ fontSize: 20 }} />
      </button>
      {open && rect && placement && createPortal(
        <div
          ref={panelRef}
          className="admin-row-menu"
          role="menu"
          aria-label={label}
          style={{
            position: "fixed",
            width: MENU_WIDTH,
            top: placement.top,
            bottom: placement.bottom,
            // Diratakan ke tepi KANAN pemicu: kolom Aksi ada di ujung kanan
            // tabel, jadi membuka ke kiri menjauh dari tepi layar.
            left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
          }}
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              className={`admin-row-menu-item${action.tone ? ` ${action.tone}` : ""}`}
              onClick={() => { setOpen(false); action.onSelect(); }}
            >
              <Icon name={action.icon} style={{ fontSize: 18, flexShrink: 0 }} />
              {action.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * Dropdown wilayah/kabupaten dengan kotak pencarian. Panel di-render lewat
 * portal + posisi fixed agar tidak terpotong oleh modal (overflow-y: auto).
 */
function RegionCombobox({ value, options, onChange, placeholder, currentLabel }: {
  value: string;
  options: RegionOption[];
  onChange: (id: string) => void;
  placeholder: string;
  currentLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    // Panel ini `position: fixed` di luar DOM modal, jadi posisinya harus
    // dihitung ulang tiap kali ada yang menggulung — BUKAN ditutup. Listener
    // scroll pakai fase capture, sehingga menggulung daftar di dalam panel pun
    // ikut tertangkap; dulu itu membuat dropdown menutup sendiri saat dipakai.
    const reposition = (e?: Event) => {
      if (e && panelRef.current?.contains(e.target as Node)) return;
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      // Trigger tergulung keluar layar → panel tak punya jangkar lagi.
      if (r.bottom < 0 || r.top > window.innerHeight) { setOpen(false); return; }
      setRect(r);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const toggle = () => {
    if (!open) setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setOpen((v) => !v);
    setQuery("");
  };

  const selected = options.find((o) => o.id === value) ?? null;
  // Nilai tersimpan bisa berupa region_id lama yang bukan id perwakilan;
  // tampilkan label wilayah saat ini agar trigger tak terlihat kosong.
  const displayLabel = selected ? selected.regency : value && currentLabel ? currentLabel : null;
  const needle = query.trim().toLowerCase();
  const filtered = needle ? options.filter((o) => o.regency.toLowerCase().includes(needle)) : options;

  return (
    <div className={`admin-combo ${open ? "open" : ""}`}>
      <button ref={triggerRef} type="button" className="admin-combo-trigger" onClick={toggle} aria-haspopup="listbox" aria-expanded={open}>
        <span className={displayLabel ? "" : "admin-combo-placeholder"}>{displayLabel ?? placeholder}</span>
        <Icon name="expand_more" style={{ fontSize: 18, opacity: 0.6, flexShrink: 0 }} />
      </button>
      {open && rect && createPortal(
        <div ref={panelRef} className="admin-combo-panel" style={{ position: "fixed", width: rect.width, ...panelPlacement(rect) }}>
          <div className="admin-combo-search">
            <Icon name="search" style={{ fontSize: 16, color: "var(--ink-soft)", flexShrink: 0 }} />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari kabupaten/kota..." />
          </div>
          <div className="admin-combo-list" role="listbox">
            {filtered.length === 0 ? (
              <div className="admin-combo-empty">Tidak ditemukan.</div>
            ) : filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={o.id === value}
                className={`admin-combo-option ${o.id === value ? "active" : ""}`}
                onClick={() => { onChange(o.id); setOpen(false); setQuery(""); }}
              >
                <span>{o.regency}</span>
                {o.id === value && <Icon name="check" style={{ fontSize: 16, flexShrink: 0 }} />}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

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
  const [isCreating, setIsCreating] = useState(false);

  // Filters & Search
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  // Nilai yang benar-benar dikirim ke API. Kotak pencarian tetap responsif
  // (state `search` berubah tiap ketikan) tapi request baru ditembakkan setelah
  // pengetikan berhenti — dulu setiap huruf memicu satu request /admin/users.
  const [appliedSearch, setAppliedSearch] = useState("");
  const [isCreateOpen, setCreateOpen] = useState(false);

  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "warga",
    status: "aktif",
    institution: "",
    region_id: "",
  });

  // Penanda urutan request: pencarian menembak request per ketukan; tanpa ini
  // respons yang datang belakangan (dari kueri lama) menimpa hasil kueri baru.
  const fetchSeqRef = useRef(0);
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

  // Debounce 350ms: cukup untuk menelan satu kata yang diketik cepat tanpa
  // terasa lambat. Timer di-reset tiap ketikan, jadi hanya jeda terakhir yang
  // benar-benar menembak request.
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

  // Daftar kabupaten/kota terpantau untuk dropdown wilayah kerja.
  useEffect(() => {
    api<{ data: RegionOption[] }>("/admin/regions")
      .then((res) => setRegions(res.data))
      .catch(() => setRegions([]));
  }, []);

  // Modal tambah pengguna: Escape menutup & scroll halaman dikunci saat terbuka.
  useEffect(() => {
    if (!isCreateOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCreateOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isCreateOpen]);

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

  // ── Tinjau permohonan akun peneliti ────────────────────────────────
  // Peneliti bisa mengunduh data mentah & memegang kunci API, jadi barisnya
  // TIDAK diberi tombol Setujui/Tolak langsung seperti warga: admin harus
  // membuka keterangan pemohon lebih dulu. Keputusannya diambil dari dalam
  // modal ini agar tak ada jalur "setujui tanpa membaca".
  const [reviewUser, setReviewUser] = useState<UserData | null>(null);

  useEffect(() => {
    if (!reviewUser) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setReviewUser(null); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [reviewUser]);

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

  // Aktifkan/Nonaktifkan lewat PATCH status — sebelumnya UI menjanjikan tombol
  // ini tapi tidak ada, sehingga akun nonaktif/tertolak hanya bisa dihapus.
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

  // ── Kelola pengguna via modal: ubah peran, wilayah/instansi (PATCH).
  //    Status ditangani tombol cepat (Aktifkan/Nonaktifkan/Setujui/Tolak). ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ role: string; institution: string; region_id: string }>({ role: "", institution: "", region_id: "" });

  const startEdit = (user: UserData) => {
    setEditingId(user.id);
    setEditDraft({ role: user.role, institution: user.institution ?? "", region_id: user.region_id ?? "" });
  };
  const cancelEdit = () => setEditingId(null);

  /**
   * Aksi yang berlaku untuk satu baris, urut dari yang paling sering dipakai.
   * Permohonan peneliti sengaja hanya punya "Tinjau Permohonan" — keputusannya
   * diambil di dalam modal supaya keterangan pemohon terbaca lebih dulu.
   */
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

  // Modal kelola: Escape menutup & scroll halaman dikunci saat terbuka.
  useEffect(() => {
    if (!editingId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setEditingId(null); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [editingId]);

  const saveEdit = async (user: UserData) => {
    const payload: Record<string, unknown> = {};
    if (editDraft.role !== user.role) payload.role = editDraft.role;
    // institution hanya disentuh saat field-nya benar-benar tampil (peneliti).
    // Untuk role lain kolom itu berisi "Desa/Wilayah" dari registrasi warga —
    // dulu ikut dinolkan diam-diam setiap kali admin menekan Simpan.
    if (editDraft.role === "peneliti") {
      const nextInstitution = editDraft.institution.trim();
      if (nextInstitution !== (user.institution ?? "")) payload.institution = nextInstitution || null;
    }
    const nextRegion = editDraft.role === "peneliti" ? "" : editDraft.region_id;
    if (nextRegion !== (user.region_id ?? "")) payload.region_id = nextRegion || null;

    if (Object.keys(payload).length === 0) { cancelEdit(); return; }

    setActing(true);
    try {
      await api(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      toast.success(`Akun "${user.name}" berhasil diperbarui.`);
      setEditingId(null);
      await fetchUsers();
    } catch (err: unknown) {
      // Tetap di mode edit agar admin bisa memperbaiki — mis. mengubah role ke
      // operator tanpa mengisi wilayah akan ditolak backend dengan pesan jelas.
      toast.error(errorMessage(err, "Gagal memperbarui akun."));
    } finally {
      setActing(false);
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreating) return;
    setIsCreating(true);
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
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Gagal membuat pengguna."));
    } finally {
      setIsCreating(false);
    }
  };

  const handleExportUsers = async () => {
    try {
      // Bawa filter aktif — tombol export berada tepat di atas bar filter,
      // hasil unduhan harus sama dengan yang sedang dilihat admin.
      await downloadFile("/admin/users/export", "admin-users.csv", { role, status, search: appliedSearch });
      toast.success("Export pengguna berhasil diunduh.");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Gagal export pengguna."));
    }
  };

  const activeCount = summary?.aktif ?? 0;
  const pendingCount = summary?.menunggu ?? 0;
  const penelitiPending = summary?.peneliti_menunggu ?? 0;

  /**
   * Saring tabel ke antrean yang menunggu keputusan. Sengaja memakai tabel yang
   * sudah ada, bukan daftar kedua di dalam modal: aksi "Tinjau Permohonan" di
   * menu tiap baris sudah membuka alasan pemohon, jadi daftar terpisah hanya
   * menduplikasi tempat yang sama dengan aturan filter sendiri.
   */
  const showPendingQueue = () => {
    setRole("");
    setStatus("menunggu");
    setPage(1);
  };
  // Nonaktif + ditolak digabung dalam satu kartu "Akses Ditutup" — tanpa
  // ditolak, aktif+menunggu+nonaktif tidak pernah sama dengan Total Terdaftar.
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
        /* Filter status permohonan API: dropdown ringkas, tak keluar batas modal. */
        .api-filter { display: flex; align-items: center; gap: 10px; padding: 4px 24px 0; }
        .api-filter label { font-size: 12.5px; font-weight: 700; color: var(--ink-soft); flex-shrink: 0; }
        .api-filter select { flex: 1; min-width: 0; height: 40px; padding: 0 36px 0 12px; border: 1px solid var(--line); border-radius: 10px; background-color: var(--surface); color: var(--ink); font-size: 13px; cursor: pointer; }
        .api-filter select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
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
        .admin-combo { position: relative; }
        .admin-combo-trigger { align-items: center; background-color: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-sizing: border-box; color: var(--ink); cursor: pointer; display: flex; font: inherit; font-size: 14px; gap: 8px; height: 46px; justify-content: space-between; padding: 0 14px; transition: border-color 0.15s ease, box-shadow 0.15s ease; width: 100%; }
        .admin-combo-trigger:hover { border-color: var(--accent); }
        .admin-combo.open .admin-combo-trigger { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
        .admin-combo-trigger > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .admin-combo-placeholder { color: var(--ink-soft); opacity: 0.7; }
        /* Kolom flex: kotak cari tetap, daftar yang menyusut mengikuti
           max-height panel (dihitung dari ruang viewport oleh panelPlacement). */
        .admin-combo-panel { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18); display: flex; flex-direction: column; overflow: hidden; z-index: 10001; }
        .admin-combo-search { align-items: center; border-bottom: 1px solid var(--line); display: flex; flex: 0 0 auto; gap: 8px; padding: 10px 12px; }
        .admin-combo-search input { background: transparent; border: 0; color: var(--ink); flex: 1; font: inherit; font-size: 13px; outline: none; min-width: 0; }
        .admin-combo-list { flex: 1 1 auto; max-height: 220px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 6px; }
        .admin-combo-option { align-items: center; background: transparent; border: 0; border-radius: 8px; color: var(--ink); cursor: pointer; display: flex; font: inherit; font-size: 13.5px; gap: 8px; justify-content: space-between; padding: 10px 12px; text-align: left; width: 100%; }
        .admin-combo-option:hover { background: var(--surface-soft); }
        .admin-combo-option.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
        .admin-combo-empty { color: var(--ink-soft); font-size: 13px; padding: 14px 12px; text-align: center; }
        .admin-create-footer { align-items: center; background: var(--surface); border-top: 1px solid var(--line); display: flex; gap: 14px; justify-content: space-between; padding: 16px 22px; flex-wrap: wrap; }
        /* Label ringkas di modal tinjau permohonan peneliti. */
        .review-label { color: var(--ink-soft); font-size: 11.5px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; }

        /* Menu aksi per baris (titik tiga). */
        .admin-row-menu-trigger {
          align-items: center; background: transparent; border: 1px solid transparent;
          border-radius: 10px; color: var(--ink-soft); cursor: pointer; display: inline-flex;
          height: 36px; justify-content: center; transition: all 0.15s ease; width: 36px;
        }
        .admin-row-menu-trigger:hover:not(:disabled) { background: var(--surface-soft); border-color: var(--line); color: var(--ink); }
        .admin-row-menu-trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .admin-row-menu-trigger:disabled { cursor: not-allowed; opacity: 0.45; }
        .admin-row-menu {
          background: var(--surface); border: 1px solid var(--line); border-radius: 12px;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18); overflow: hidden; padding: 6px;
          z-index: 1200;
        }
        .admin-row-menu-item {
          align-items: center; background: transparent; border: none; border-radius: 8px;
          color: var(--ink); cursor: pointer; display: flex; font: inherit; font-size: 13px;
          font-weight: 600; gap: 10px; padding: 9px 10px; text-align: left; width: 100%;
        }
        .admin-row-menu-item:hover { background: var(--surface-soft); }
        .admin-row-menu-item:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
        .admin-row-menu-item.primary { color: var(--accent); }
        .admin-row-menu-item.danger { color: var(--critical); }

        /* Batasi kolom instansi/wilayah agar tabel tak melebar mengikuti teks
           terpanjang. max-width saja tak cukup pada tabel auto-layout — butuh
           width sekaligus untuk mengunci lebarnya. */
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
          /* KPI jadi 2 kolom di mobile (override aturan global 1fr !important). */
          .metric-grid.admin-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px !important; }
          .metric-grid.admin-kpis .metric-card { padding: 18px !important; }
          .metric-grid.admin-kpis .metric-card span { font-size: 12px !important; }
          .metric-grid.admin-kpis .metric-card strong { font-size: 28px !important; }
          .metric-grid.admin-kpis .metric-card small { font-size: 11px !important; }
        }

        /* Header aksi & filter daftar pengguna: kontrol modern + rapi di mobile. */
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
        
        {/* Perizinan akun — SATU-SATUNYA antrean persetujuan di halaman ini.
            Dulu ada dua: banner "pendaftaran baru" plus panel "permohonan akses
            API" yang menanyakan hal serupa (alasan memakai data) di layar
            berbeda, tanpa saling merujuk. Sejak izin diminta sekali saat akun
            dibuat, antreannya ikut jadi satu. */}
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

        {/* KPI Grid */}
        <motion.div variants={itemVariants} className="metric-grid admin-kpis" style={{ marginBottom: 32 }}>
          {[
            { title: "Pengguna Aktif", val: activeCount, sub: "Dapat masuk ke dashboard", cls: "success" },
            // "warning" tak pernah ada di tokens.css sehingga kartu ini tak
            // pernah ter-highlight; kelas amber yang benar adalah "medium".
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

        {/* Modal tambah pengguna — dipicu tombol "Tambah Pengguna" di header Daftar Pengguna Sistem. */}
        {createPortal(
          <AnimatePresence>
            {isCreateOpen && (
              <motion.div
                className="admin-confirm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setCreateOpen(false)}
            >
              <motion.div
                className="admin-modal-card"
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-user-title"
              >
                <div className="admin-modal-head">
                  <div>
                    <h2 id="create-user-title">Tambah Pengguna</h2>
                    <p>Buat akun admin/operator/provinsi/peneliti secara manual.</p>
                  </div>
                  <button type="button" className="admin-modal-close" onClick={() => setCreateOpen(false)} aria-label="Tutup">
                    <Icon name="close" />
                  </button>
                </div>
                <form onSubmit={handleCreateUser} autoComplete="off">
                  <div className="admin-create-grid">
                    <div className="admin-field span-2">
                      <label><Icon name="badge" /> Peran</label>
                      <div className="admin-role-pills">
                        {[
                          { v: "warga", l: "Warga" },
                          { v: "peneliti", l: "Peneliti" },
                          { v: "admin", l: "Admin" },
                        ].map((opt) => (
                          <button
                            key={opt.v}
                            type="button"
                            className={`admin-role-pill ${newUser.role === opt.v ? "active" : ""}`}
                            onClick={() => setNewUser((u) => ({
                              ...u,
                              role: opt.v,
                              // Bersihkan field yang jadi tersembunyi agar tak terkirim data usang.
                              institution: opt.v === "peneliti" ? u.institution : "",
                              region_id: opt.v === "peneliti" ? "" : u.region_id,
                            }))}
                          >
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="admin-field">
                      <label><Icon name="person" /> Nama lengkap</label>
                      <input required autoComplete="off" placeholder="cth. Siti Amalia" value={newUser.name} onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))} />
                    </div>
                    <div className="admin-field">
                      <label><Icon name="mail" /> Email</label>
                      <input required type="email" autoComplete="off" placeholder="nama@instansi.go.id" value={newUser.email} onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))} />
                    </div>
                    <div className="admin-field">
                      <label><Icon name="lock" /> Password awal</label>
                      <input required type="password" minLength={8} name="siperah-new-user-pw" autoComplete="new-password" data-lpignore="true" data-1p-ignore data-form-type="other" placeholder="Minimal 8 karakter" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} />
                    </div>
                    {newUser.role === "peneliti" ? (
                      <div className="admin-field">
                        <label><Icon name="apartment" /> Instansi</label>
                        <input required placeholder="Wajib untuk peneliti" value={newUser.institution} onChange={(e) => setNewUser((u) => ({ ...u, institution: e.target.value }))} />
                      </div>
                    ) : (
                      <div className="admin-field">
                        <label><Icon name="pin_drop" /> Wilayah / kabupaten terpantau (opsional)</label>
                        <RegionCombobox
                          value={newUser.region_id}
                          options={regions}
                          onChange={(id) => setNewUser((u) => ({ ...u, region_id: id }))}
                          placeholder={regions.length ? "Pilih wilayah…" : "Memuat wilayah…"}
                        />
                      </div>
                    )}
                  </div>
                  <div className="admin-create-footer">
                    <span className="admin-create-hint">
                      <Icon name="info" />
                      {"Pilih wilayah pantauan bila relevan untuk akun ini."}
                    </span>
                    <button type="submit" className="btn primary" disabled={isCreating} data-loading={isCreating || undefined}><Icon name="save" /> {isCreating ? "Menyimpan..." : "Simpan Pengguna"}</button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
          </AnimatePresence>,
          document.body
        )}

        {/* Modal kelola pengguna — ubah peran & wilayah/instansi. Status via tombol daftar. */}
        {createPortal(
          <AnimatePresence>
            {editingUser && (
              <motion.div
                className="admin-confirm-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => !isActing && cancelEdit()}
              >
                <motion.div
                  className="admin-modal-card"
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 12 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="edit-user-title"
                >
                  <div className="admin-modal-head">
                    <div>
                      <h2 id="edit-user-title">Kelola Pengguna</h2>
                      <p>{editingUser.name} · {editingUser.email}</p>
                    </div>
                    <button type="button" className="admin-modal-close" onClick={cancelEdit} aria-label="Tutup">
                      <Icon name="close" />
                    </button>
                  </div>
                  <form onSubmit={(e) => { e.preventDefault(); saveEdit(editingUser); }} autoComplete="off">
                    <div className="admin-create-grid">
                      <div className="admin-field span-2">
                        <label><Icon name="badge" /> Peran</label>
                        <div className="admin-role-pills">
                          {ROLE_OPTIONS.map((opt) => (
                            <button
                              key={opt.v}
                              type="button"
                              className={`admin-role-pill ${editDraft.role === opt.v ? "active" : ""}`}
                              onClick={() => setEditDraft((d) => ({
                                ...d,
                                role: opt.v,
                                institution: opt.v === "peneliti" ? d.institution : "",
                                region_id: opt.v === "peneliti" ? "" : d.region_id,
                              }))}
                            >
                              {opt.l}
                            </button>
                          ))}
                        </div>
                      </div>
                      {editDraft.role === "peneliti" ? (
                        <div className="admin-field span-2">
                          <label><Icon name="apartment" /> Instansi</label>
                          <input required value={editDraft.institution} onChange={(e) => setEditDraft((d) => ({ ...d, institution: e.target.value }))} placeholder="Nama instansi / universitas" />
                        </div>
                      ) : (
                        <div className="admin-field span-2">
                          <label><Icon name="pin_drop" /> Wilayah / kabupaten terpantau (opsional)</label>
                          <RegionCombobox
                            value={editDraft.region_id}
                            options={regions}
                            onChange={(id) => setEditDraft((d) => ({ ...d, region_id: id }))}
                            placeholder={regions.length ? "Pilih wilayah…" : "Memuat wilayah…"}
                            currentLabel={editingUser.region_name ?? undefined}
                          />
                        </div>
                      )}
                    </div>
                    <div className="admin-create-footer">
                      <span className="admin-create-hint">
                        <Icon name="info" />
                        Status akun (aktif/nonaktif) diatur lewat tombol di daftar. Di sini hanya peran & wilayah/instansi.
                      </span>
                      <button type="submit" className="btn primary" disabled={isActing} data-loading={isActing || undefined}><Icon name="save" /> Simpan Perubahan</button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {/* Modal tinjau permohonan akun peneliti — satu-satunya jalan untuk
            menyetujui/menolak peneliti, agar keterangan pemohon selalu terbaca
            lebih dulu. */}
        {createPortal(
          <AnimatePresence>
            {reviewUser && (
              <motion.div
                className="admin-confirm-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setReviewUser(null)}
              >
                <motion.div
                  className="admin-modal-card"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Tinjau permohonan akun peneliti ${reviewUser.name}`}
                >
                  <div className="admin-modal-head">
                    <div>
                      <h2>Permohonan Akun Peneliti</h2>
                      <p>Periksa keterangan pemohon sebelum memutuskan.</p>
                    </div>
                    <button type="button" className="admin-modal-close" onClick={() => setReviewUser(null)} aria-label="Tutup">
                      <Icon name="close" style={{ fontSize: 18 }} />
                    </button>
                  </div>

                  <div style={{ padding: "20px 24px", display: "grid", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{reviewUser.name}</div>
                      <div style={{ fontSize: 13, color: "var(--ink-soft)", wordBreak: "break-word" }}>{reviewUser.email}</div>
                    </div>

                    {/* Peringatan keras: menyetujui akun yang alamat emailnya
                        belum terbukti = menyerahkan akses data ke alamat yang
                        mungkin bukan milik pemohon. */}
                    {reviewUser.permission_workflow?.email_verified ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "#166534" }}>
                        <Icon name="verified" style={{ fontSize: 18 }} /> Email sudah diverifikasi pemohon
                      </div>
                    ) : (
                      <div role="alert" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--critical)", color: "#991b1b", fontSize: 12.5, lineHeight: 1.5 }}>
                        <Icon name="warning" style={{ fontSize: 18, flexShrink: 0 }} />
                        <span><strong>Email belum diverifikasi.</strong> Pemohon belum memasukkan kode OTP, jadi belum terbukti alamat ini miliknya. Sebaiknya tunggu verifikasi sebelum menyetujui.</span>
                      </div>
                    )}

                    <div style={{ display: "grid", gap: 14, padding: "16px", borderRadius: 14, background: "var(--surface-soft)", border: "1px solid var(--line)" }}>
                      <div>
                        <div className="review-label">Tujuan penggunaan data</div>
                        <div style={{ color: "var(--ink)", fontSize: 13.5, lineHeight: 1.6, marginTop: 4, whiteSpace: "pre-wrap" }}>
                          {reviewUser.permission_workflow?.reason || "— (permohonan lama, tanpa keterangan)"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                        <div>
                          <div className="review-label">Instansi</div>
                          <div style={{ color: "var(--ink)", fontSize: 13.5, marginTop: 4 }}>{reviewUser.institution || "—"}</div>
                        </div>
                        <div>
                          <div className="review-label">Diajukan</div>
                          <div style={{ color: "var(--ink)", fontSize: 13.5, marginTop: 4 }}>
                            {reviewUser.created_at ? new Date(reviewUser.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn outline"
                        disabled={isActing}
                        data-loading={isActing || undefined}
                        style={{ color: "var(--critical)", borderColor: "var(--critical)", fontSize: 12.5 }}
                        onClick={() => { const u = reviewUser; setReviewUser(null); confirmReject(u.id, u.name); }}
                      >
                        <Icon name="close" style={{ fontSize: 16 }} /> Tolak
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        disabled={isActing}
                        data-loading={isActing || undefined}
                        style={{ fontSize: 12.5 }}
                        onClick={() => { const u = reviewUser; setReviewUser(null); handleApprove(u.id, u.name); }}
                      >
                        <Icon name="check" style={{ fontSize: 16 }} /> Setujui Akun Peneliti
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {/* Filters and List */}
        <motion.div variants={itemVariants} className="panel flush" style={{ overflow: "hidden", marginBottom: 32 }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Daftar Pengguna Sistem</h2>
            <div className="users-actions">
              <button type="button" className="btn secondary" onClick={handleExportUsers}><Icon name="download" /> Export Pengguna</button>
              <button type="button" className="btn primary" onClick={() => setCreateOpen((value) => !value)}><Icon name="person_add" /> {isCreateOpen ? "Tutup Form" : "Tambah Pengguna"}</button>
            </div>
          </div>

          {/* Filters Bar */}
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
                // Reset halaman ditangani efek debounce, bukan di sini —
                // kalau tidak, halaman ikut melompat tiap huruf diketik.
                onChange={(e) => setSearch(e.target.value)}
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
                        {/* Kolom terpanjang di tabel ini: nama wilayah lengkap
                            ("Panjang Utara, Panjang, Kota Bandar Lampung") dulu
                            memaksa seluruh tabel melebihi wadahnya sehingga
                            kolom Aksi terpotong. Dipotong dengan elipsis; teks
                            penuhnya tetap terbaca lewat tooltip. */}
                        <td
                          className="users-org-cell"
                          style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: 13 }}
                          title={user.institution || user.region_name || undefined}
                        >
                          {user.institution || user.region_name || "-"}
                        </td>
                        <td style={{ padding: "16px 24px", textAlign: "right", whiteSpace: "nowrap" }}>
                          {/* Aksinya identik dengan sebelumnya, hanya dikumpulkan
                              ke menu titik tiga. Daftarnya tetap bergantung pada
                              status & peran, jadi tak ada aksi yang tak berlaku
                              (mis. "Setujui" pada akun yang sudah aktif). */}
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
              <button type="button" className="btn secondary" disabled={isActing} data-loading={isActing || undefined} onClick={() => setConfirm(null)}>Batal</button>
              <button
                type="button"
                className="btn primary"
                disabled={isActing}
                data-loading={isActing || undefined}
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
