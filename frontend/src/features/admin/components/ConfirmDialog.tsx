import { createPortal } from "react-dom";
import { Icon } from "../../../shared/components/Icon";

export interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  tone: "danger" | "default";
  onConfirm: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, tone, onConfirm, onClose, isActing }: ConfirmState & {
  onClose: () => void;
  isActing: boolean;
}) {
  return createPortal(
    <div className="admin-confirm-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={() => !isActing && onClose()}>
      <div className="admin-confirm-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Icon name={tone === "danger" ? "warning" : "help"} style={{ fontSize: 24, color: tone === "danger" ? "var(--critical)" : "var(--accent)" }} />
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{title}</h2>
        </div>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="btn secondary" disabled={isActing} onClick={onClose}>Batal</button>
          <button
            type="button"
            className="btn primary"
            disabled={isActing}
            onClick={onConfirm}
            style={tone === "danger" ? { background: "var(--critical)", borderColor: "var(--critical)" } : undefined}
          >
            {isActing ? "Memproses\u2026" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
