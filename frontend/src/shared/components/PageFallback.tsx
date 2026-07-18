/**
 * Fallback layar-penuh untuk Suspense (lazy route) & sebagai indikator memuat
 * halaman yang konsisten. Ringan, tanpa dependensi berat, sadar tema.
 */
export function PageFallback({ label = "Memuat halaman…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        color: "var(--ink-soft, #64748b)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "3px solid var(--line, #e2e8f0)",
          borderTopColor: "var(--accent, #1e40af)",
          animation: "siperah-spin 0.7s linear infinite",
        }}
      />
      <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
      <style>{"@keyframes siperah-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}
