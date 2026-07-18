import { Skeleton } from "./Skeleton";

/**
 * Placeholder memuat yang konsisten untuk daftar/tabel: beberapa baris skeleton
 * bershimmer, menggantikan teks "Memuat..." ad-hoc. Sertakan label tersembunyi
 * untuk pembaca layar.
 */
export function LoadingBlock({
  rows = 5,
  rowHeight = 44,
  gap = 12,
  label = "Memuat data…",
}: {
  rows?: number;
  rowHeight?: number | string;
  gap?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap, padding: "8px 0" }}>
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={rowHeight} />
      ))}
    </div>
  );
}
