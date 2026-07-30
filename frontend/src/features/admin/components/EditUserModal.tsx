import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../../../shared/components/Icon";
import { RegionCombobox } from "../../../shared/components/RegionCombobox";
import { api, errorMessage } from "../../../shared/api/client";
import { useToast } from "../../../shared/components/Toast";
import type { UserData } from "../types";

const ROLE_OPTIONS = [
  { v: "warga", l: "Warga" },
  { v: "peneliti", l: "Peneliti" },
  { v: "admin", l: "Admin" },
] as const;

export function EditUserModal({ user, onClose, regions, onSaved }: {
  user: UserData | null;
  onClose: () => void;
  regions: { id: string; regency: string }[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const [isActing, setActing] = useState(false);
  const [editDraft, setEditDraft] = useState({ role: "", institution: "", region_id: "" });

  useEffect(() => {
    if (user) {
      setEditDraft({ role: user.role, institution: user.institution ?? "", region_id: user.region_id ?? "" });
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [user, onClose]);

  const saveEdit = async () => {
    if (!user) return;
    const payload: Record<string, unknown> = {};
    if (editDraft.role !== user.role) payload.role = editDraft.role;
    if (editDraft.role === "peneliti") {
      const nextInstitution = editDraft.institution.trim();
      if (nextInstitution !== (user.institution ?? "")) payload.institution = nextInstitution || null;
    }
    const nextRegion = editDraft.role === "peneliti" ? "" : editDraft.region_id;
    if (nextRegion !== (user.region_id ?? "")) payload.region_id = nextRegion || null;

    if (Object.keys(payload).length === 0) { onClose(); return; }

    setActing(true);
    try {
      await api(`/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      toast.success(`Akun "${user.name}" berhasil diperbarui.`);
      onClose();
      onSaved();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Gagal memperbarui akun."));
    } finally {
      setActing(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {user && (
        <motion.div
          className="admin-confirm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => !isActing && onClose()}
        >
          <motion.div
            key={user.id}
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
                <p>{user.name} \u00b7 {user.email}</p>
              </div>
              <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Tutup">
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); saveEdit(); }} autoComplete="off">
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
                      placeholder={regions.length ? "Pilih wilayah\u2026" : "Memuat wilayah\u2026"}
                      currentLabel={user.region_name ?? undefined}
                    />
                  </div>
                )}
              </div>
              <div className="admin-create-footer">
                <span className="admin-create-hint">
                  <Icon name="info" /> Status akun (aktif/nonaktif) diatur lewat tombol di daftar. Di sini hanya peran & wilayah/instansi.
                </span>
                <button type="submit" className="btn primary" disabled={isActing} data-loading={isActing || undefined}><Icon name="save" /> Simpan Perubahan</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
