import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { panelPlacement } from "../utils/panelPlacement";

export function RegionCombobox({ value, options, onChange, placeholder, currentLabel }: {
  value: string;
  options: { id: string; regency: string }[];
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
    setQuery("");
  };

  const selected = options.find((o) => o.id === value) ?? null;
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
      <style>{`
        .admin-combo { position: relative; }
        .admin-combo-trigger { align-items: center; background-color: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-sizing: border-box; color: var(--ink); cursor: pointer; display: flex; font: inherit; font-size: 14px; gap: 8px; height: 46px; justify-content: space-between; padding: 0 14px; transition: border-color 0.15s ease, box-shadow 0.15s ease; width: 100%; }
        .admin-combo-trigger:hover { border-color: var(--accent); }
        .admin-combo.open .admin-combo-trigger { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
        .admin-combo-trigger > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .admin-combo-placeholder { color: var(--ink-soft); opacity: 0.7; }
        .admin-combo-panel { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18); display: flex; flex-direction: column; overflow: hidden; z-index: 10001; }
        .admin-combo-search { align-items: center; border-bottom: 1px solid var(--line); display: flex; flex: 0 0 auto; gap: 8px; padding: 10px 12px; }
        .admin-combo-search input { background: transparent; border: 0; color: var(--ink); flex: 1; font: inherit; font-size: 13px; outline: none; min-width: 0; }
        .admin-combo-list { flex: 1 1 auto; max-height: 220px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 6px; }
        .admin-combo-option { align-items: center; background: transparent; border: 0; border-radius: 8px; color: var(--ink); cursor: pointer; display: flex; font: inherit; font-size: 13.5px; gap: 8px; justify-content: space-between; padding: 10px 12px; text-align: left; width: 100%; }
        .admin-combo-option:hover { background: var(--surface-soft); }
        .admin-combo-option.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
        .admin-combo-empty { color: var(--ink-soft); font-size: 13px; padding: 14px 12px; text-align: center; }
      `}</style>
    </div>
  );
}
