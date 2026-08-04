import { type FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../../../shared/components/Icon";
import { RegionCombobox } from "../../../shared/components/RegionCombobox";
import { api, errorMessage } from "../../../shared/api/client";
import { useToast } from "../../../shared/components/Toast";

export function CreateUserModal({ isOpen, onClose, regions, onCreated }: {
  isOpen: boolean;
  onClose: () => void;
  regions: { id: string; regency: string }[];
  onCreated: () => void;
}) {
  const toast = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "", email: "", password: "", role: "warga" as string, status: "aktif", institution: "", region_id: "",
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
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
      onClose();
      onCreated();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Gagal membuat pengguna."));
    } finally {
      setIsCreating(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="admin-confirm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
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
              <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Tutup">
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={handleCreate} autoComplete="off">
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
                  <input required type="password" minLength={8} name="saibar-new-user-pw" autoComplete="new-password" data-lpignore="true" data-1p-ignore data-form-type="other" placeholder="Minimal 8 karakter" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} />
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
                      placeholder={regions.length ? "Pilih wilayah\u2026" : "Memuat wilayah\u2026"}
                    />
                  </div>
                )}
              </div>
              <div className="admin-create-footer">
                <span className="admin-create-hint">
                  <Icon name="info" /> Pilih wilayah pantauan bila relevan untuk akun ini.
                </span>
                <button type="submit" className="btn primary" disabled={isCreating} data-loading={isCreating || undefined}><Icon name="save" /> {isCreating ? "Menyimpan..." : "Simpan Pengguna"}</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

