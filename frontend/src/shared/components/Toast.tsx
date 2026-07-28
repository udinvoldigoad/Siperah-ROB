import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

/**
 * Pesan error umumnya lebih panjang dan menuntut tindakan (cek isian, coba
 * lagi), jadi diberi waktu baca jauh lebih lama daripada konfirmasi sukses.
 */
const DISMISS_MS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  error: 12000,
};

/** Sisa waktu minimal setelah kursor pergi, agar toast tak langsung lenyap. */
const RESUME_FLOOR_MS = 2000;

interface ToastContextValue {
  toasts: ToastMessage[];
  addToast: (type: ToastType, message: string) => void;
  success: (message: string) => void;
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
  const timerRef = useRef<number | null>(null);
  const remainingRef = useRef(DISMISS_MS[toast.type]);
  const startedAtRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    clearTimer();
    startedAtRef.current = Date.now();
    timerRef.current = window.setTimeout(() => onDismiss(toast.id), remainingRef.current);
  }, [clearTimer, onDismiss, toast.id]);

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
    <div
      className={`toast toast-${toast.type}`}
      role={toast.type === "error" ? "alert" : "status"}
      onMouseEnter={pause}
      onMouseLeave={resume}
      // Capture agar fokus keyboard ke tombol tutup di dalamnya ikut menjeda.
      onFocusCapture={pause}
      onBlurCapture={resume}
    >
      <Icon name={toast.type === "success" ? "check_circle" : toast.type === "error" ? "error" : "info"} />
      <span>{toast.message}</span>
      <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Tutup notifikasi">
        <Icon name="close" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const success = useCallback((message: string) => addToast("success", message), [addToast]);
  const error = useCallback((message: string) => addToast("error", message), [addToast]);
  const info = useCallback((message: string) => addToast("info", message), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, success, error, info, removeToast }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
