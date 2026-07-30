import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { panelPlacement } from "../utils/panelPlacement";

export interface RowAction {
  key: string;
  label: string;
  icon: string;
  tone?: "primary" | "danger";
  onSelect: () => void;
}

const MENU_WIDTH = 210;

export function RowActionsMenu({ actions, label, disabled }: {
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
      <style>{`
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
      `}</style>
    </>
  );
}
