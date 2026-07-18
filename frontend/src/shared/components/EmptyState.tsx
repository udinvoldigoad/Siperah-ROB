import { type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Tampilan "kosong" yang konsisten di seluruh halaman: ikon + judul + deskripsi
 * opsional + aksi opsional. Menggantikan teks empty-state ad-hoc.
 */
export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  compact = false,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 10,
        padding: compact ? "28px 20px" : "56px 24px",
        color: "var(--ink-soft, #64748b)",
      }}
    >
      <Icon name={icon} style={{ fontSize: compact ? 32 : 44, opacity: 0.55 }} aria-hidden="true" />
      <div style={{ fontSize: compact ? "0.98rem" : "1.1rem", fontWeight: 700, color: "var(--ink, #1e293b)" }}>{title}</div>
      {description && (
        <div style={{ fontSize: "0.88rem", maxWidth: 420, lineHeight: 1.55 }}>{description}</div>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
