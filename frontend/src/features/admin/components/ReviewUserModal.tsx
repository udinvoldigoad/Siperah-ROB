import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../../../shared/components/Icon";
import type { UserData } from "../types";

export function ReviewUserModal({ user, onClose, onApprove, onReject, isActing }: {
  user: UserData | null;
  onClose: () => void;
  onApprove: (id: string, name: string) => void;
  onReject: (id: string, name: string) => void;
  isActing: boolean;
}) {
  useEffect(() => {
    if (!user) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [user, onClose]);

  return createPortal(
    <AnimatePresence>
      {user && (
        <motion.div
          className="admin-confirm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => onClose()}
        >
          <motion.div
            className="admin-modal-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Tinjau permohonan akun peneliti ${user.name}`}
          >
            <div className="admin-modal-head">
              <div>
                <h2>Permohonan Akun Peneliti</h2>
                <p>Periksa keterangan pemohon sebelum memutuskan.</p>
              </div>
              <button type="button" className="admin-modal-close" onClick={() => onClose()} aria-label="Tutup">
                <Icon name="close" style={{ fontSize: 18 }} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>{user.name}</div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)", wordBreak: "break-word" }}>{user.email}</div>
              </div>

              {user.permission_workflow?.email_verified ? (
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
                    {user.permission_workflow?.reason || "\u2014 (permohonan lama, tanpa keterangan)"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <div>
                    <div className="review-label">Instansi</div>
                    <div style={{ color: "var(--ink)", fontSize: 13.5, marginTop: 4 }}>{user.institution || "\u2014"}</div>
                  </div>
                  <div>
                    <div className="review-label">Diajukan</div>
                    <div style={{ color: "var(--ink)", fontSize: 13.5, marginTop: 4 }}>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "\u2014"}
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
                  onClick={() => { onClose(); onReject(user.id, user.name); }}
                >
                  <Icon name="close" style={{ fontSize: 16 }} /> Tolak
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={isActing}
                  data-loading={isActing || undefined}
                  style={{ fontSize: 12.5 }}
                  onClick={() => { onClose(); onApprove(user.id, user.name); }}
                >
                  <Icon name="check" style={{ fontSize: 16 }} /> Setujui Akun Peneliti
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
