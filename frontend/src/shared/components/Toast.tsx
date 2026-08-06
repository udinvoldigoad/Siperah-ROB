import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./Icon";

type ToastType = "success" | "warning" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

/**
 * Durasi tampil per jenis toast. Sukses singkat, peringatan agak lama, info
 * netral; error nilainya null = tidak pernah ditutup otomatis, hanya lewat
 * tombol tutup (until acknowledged).
 */
const DISMISS_MS: Record<ToastType, number | null> = {
  success: 4000,
  info: 4000,
  warning: 7000,
  error: null,
};

/** Sisa waktu minimal setelah kursor pergi, agar toast tak langsung lenyap. */
const RESUME_FLOOR_MS = 2000;

/** Maksimal toast yang terlihat bersamaan; tertua di-drop saat menembus batas. */
const MAX_VISIBLE = 3;

/** Pegas untuk animasi masuk/layout: rekat (stiff) tapi stabil (damped). */
const SPRING = { type: "spring", damping: 20, stiffness: 180 } as const;

interface ToastContextValue {
  toasts: ToastMessage[];
  addToast: (type: ToastType, message: string) => void;
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

/**
 * Satu toast beserta timer hitung-mundurnya sendiri. Timernya di sini (bukan di
 * provider) supaya bisa dijeda: selama kursor menyentuh atau fokus keyboard ada
 * di dalam toast, hitungan berhenti — pesan panjang tak lagi hilang di tengah
 * pembacaan. Sisa waktu disimpan agar setelah kursor pergi hitungan lanjut,
 * bukan mengulang dari awal.
 */
function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const dismissMs = DISMISS_MS[toast.type];
  const timerRef = useRef<number | null>(null);
  const remainingRef = useRef(dismissMs ?? 0);
  const startedAtRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    clearTimer();
    // Error tidak punya timer (menunggu dikenali pengguna).
    if (dismissMs === null) return;
    startedAtRef.current = Date.now();
    timerRef.current = window.setTimeout(() => onDismiss(toast.id), remainingRef.current);
  }, [clearTimer, dismissMs, onDismiss, toast.id]);

  const pause = useCallback(() => {
    if (timerRef.current === null) return;
    clearTimer();
    remainingRef.current = Math.max(
      remainingRef.current - (Date.now() - startedAtRef.current),
      RESUME_FLOOR_MS,
    );
  }, [clearTimer]);

  useEffect(() => {
    resume();
    return clearTimer;
  }, [resume, clearTimer]);

  return (
    // Error diumumkan segera (alert/assertive), sukses & info secara sopan (status/polite).
    // layout membuat tumpukan ikut meluncur pegas saat ada toast masuk/keluar.
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15, ease: "easeOut" } }}
      transition={SPRING}
      className={`toast toast-${toast.type}`}
      role={toast.type === "error" ? "alert" : "status"}
      style={{ "--toast-duration": `${dismissMs ?? 0}ms` } as React.CSSProperties}
      onMouseEnter={pause}
      onMouseLeave={resume}
      // Capture agar fokus keyboard ke tombol tutup di dalamnya ikut menjeda.
      onFocusCapture={pause}
      onBlurCapture={resume}
    >
      <Icon name={toast.type === "success" ? "check_circle" : toast.type === "warning" ? "warning" : toast.type === "error" ? "error" : "info"} />
      <span>{toast.message}</span>
      <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Tutup notifikasi">
        <Icon name="close" />
      </button>
      {dismissMs !== null && <div className="toast-progress" />}
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }].slice(-MAX_VISIBLE));
  }, []);

  const success = useCallback((message: string) => addToast("success", message), [addToast]);
  const warning = useCallback((message: string) => addToast("warning", message), [addToast]);
  const error = useCallback((message: string) => addToast("error", message), [addToast]);
  const info = useCallback((message: string) => addToast("info", message), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, success, warning, error, info, removeToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
