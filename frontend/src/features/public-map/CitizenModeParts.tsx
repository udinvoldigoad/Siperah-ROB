/**
 * Sub-komponen bersama untuk CitizenModePage (mode awam).
 *
 * `CitizenModeDesktop` & `CitizenModeMobile` (dulu ~300 baris JSX tiap
 * komponen) menduplikasi blok forecast, kartu tindakan, laporan sekitar, dan
 * tombol bagikan — setiap perubahan harus ditulis dua kali. Bagian yang sama
 * persis dipindahkan ke sini (AU-15); kedua view tinggal memilih varian
 * (desktop vs compact/mobile) lewat prop `compact`/`variant`.
 */

import { motion, type Variants } from "framer-motion";
import { Icon } from "../../shared/components/Icon";
import { severityLabels, type ReportSeverity } from "../reports/reportData";
import type { RiskClass } from "../../shared/types/domain";

// ─── Tipe data bersama (dipakai halaman & bagian-bagian ini) ────────────────

export type WilayahOption = { label: string; lat: number; lon: number };

export type ForecastItem = { id: string; prediction_date: string; risk_class: RiskClass; risk_probability: number };
export type NearbyReport = { id: string; report_code: string; severity: "ringan" | "sedang" | "parah" | "sangat_parah"; water_height_cm: number | null; incident_time: string; status: string; region?: { village?: string | null; district?: string | null; regency?: string | null } | null };

export type ModeAwamData = {
  // null saat prediksi tidak tersedia — backend tidak lagi mengarang "rendah/0".
  risk_class: RiskClass | null;
  risk_probability: number | null;
  max_tidal_height: number | null;
  peak_time: string | null;
  model_version: string | null;
  confidence_score: number | null;
  data_source: string | null;
  generated_at: string | null;
  is_monitored: boolean;
  monitoring_status: string | null;
  status_label: string | null;
  guidance_message: string | null;
  prediction_status?: "fresh" | "stale" | "unavailable" | null;
  last_generated_at?: string | null;
  prediction_notice?: string | null;
  // `provenance_status` memang dikirim backend (PublicMapController::modeAwam)
  // dan dipakai menandai data contoh; sebelumnya absen dari tipe ini sehingga
  // pembacanya harus lewat `as any`.
  region: {
    id?: string;
    village: string | null;
    district: string | null;
    regency: string | null;
    provenance_status?: string | null;
    data_source?: string | null;
  };
  forecast: { data: ForecastItem[] } | ForecastItem[];
  nearby_reports: NearbyReport[];
};

export type ForecastDay = { day: string; label: string; percent: number; color: string };
/** Kartu tindakan: `[judul, penjelasan, nama ikon]`. */
export type ActionCard = string[];

// ─── Helper bersama ─────────────────────────────────────────────────────────

export function confidenceLabel(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "—";
  const normalized = score > 1 ? score / 100 : score;
  const label = normalized >= 0.8 ? "Tinggi" : normalized >= 0.6 ? "Sedang" : "Rendah";
  return `${label} (${normalized.toFixed(2)})`;
}

export function formatGeneratedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  // timeZone eksplisit: tanpa ini perangkat WITA/WIT menampilkan jam lokalnya
  // sendiri tapi tetap dilabeli "WIB".
  return `${date.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`;
}

/** Nama wilayah laporan; desktop ikut menampilkan kabupaten, mobile tidak. */
export function reportRegionLabel(report: NearbyReport, includeRegency: boolean): string {
  const parts = includeRegency
    ? [report.region?.village, report.region?.district, report.region?.regency]
    : [report.region?.village, report.region?.district];
  return parts.filter(Boolean).join(", ") || "Wilayah pesisir";
}

export function reportTimeLabel(report: NearbyReport): string {
  const time = new Date(report.incident_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
  return `${time} WIB`;
}

// ─── Animasi bersama ────────────────────────────────────────────────────────

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

// ─── Bagian yang sama antara tampilan desktop & mobile ──────────────────────

export function ErrorBanner({ error, marginBottom }: { error: string; marginBottom: number }) {
  if (!error) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert" style={{ marginBottom, borderLeftColor: "var(--critical)" }}>
      <Icon name="error" style={{ color: "var(--critical)" }} /> {error}
    </motion.div>
  );
}

export function StatusBadge({ data, compact }: { data: ModeAwamData | undefined; compact?: boolean }) {
  if (!data?.status_label) return null;
  return (
    <span className="citizen-status-badge" data-compact={compact ? "" : undefined}>
      <Icon name={data.is_monitored ? "radar" : "info"} style={{ fontSize: compact ? 14 : 16 }} /> {data.status_label}
    </span>
  );
}

export function PredictionNotice({ data, tone }: { data: ModeAwamData | undefined; tone: "amber" | "frost" }) {
  if (!data?.prediction_notice) return null;
  return (
    <div className={`citizen-prediction-notice ${tone}`}>
      <Icon name={data.prediction_status === "unavailable" ? "schedule" : "update"} style={{ fontSize: tone === "frost" ? 16 : 17, flexShrink: 0, marginTop: 1 }} />
      <span>{data.prediction_notice}</span>
    </div>
  );
}

export function GuidanceText({ data, dataLoaded, compact }: { data: ModeAwamData | undefined; dataLoaded: boolean; compact?: boolean }) {
  const message = data
    ? (data.guidance_message ?? "Pantau kondisi rob di sekitar Anda dan ikuti arahan BPBD.")
    : (dataLoaded
        ? (compact ? "Lokasi di luar wilayah pantauan Lampung. Pilih lokasi dari daftar." : "Lokasi Anda berada di luar wilayah pantauan Lampung. Pilih lokasi lain dari daftar di atas untuk melihat status bahaya rob.")
        : (compact ? "Menganalisis status rob..." : "Menganalisis status ancaman rob terbaru di sekitar Anda..."));
  return <p className={compact ? "citizen-guidance compact" : "citizen-guidance"}>{message}</p>;
}

/**
 * Kolom grafik prakiraan (bar animasi). Desktop memakai `.citizen-forecast-day`
 * dalam grid 7 kolom; mobile memakai `.mobile-forecast-card` dalam scroller.
 * Prop `className` dibawa dari view; `compact` hanya mengubah ukuran/animasinya.
 */
export function ForecastDayColumn({ day, label, percent, color, index, className, compact }: {
  day: string;
  label: string;
  percent: number;
  color: string;
  index: number;
  className: string;
  compact?: boolean;
}) {
  return (
    <motion.div
      className={className}
      whileHover={compact ? undefined : { y: -5 }}
      style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <div style={compact
        ? { fontSize: 12, color: "var(--ink-soft)", fontWeight: 700, marginBottom: 12 }
        : { fontSize: 13, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 12 }}>{day}</div>
      <div style={compact
        ? { height: 100, width: 14, borderRadius: 999, background: "var(--line)", position: "relative", margin: "0 auto 12px auto" }
        : { height: 120, width: 12, borderRadius: 999, background: "var(--line)", position: "relative", margin: "8px 0" }}>
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: `${Math.min(percent, 100)}%` }}
          transition={{ delay: (compact ? 0.3 : 0.5) + (index * (compact ? 0.1 : 0.05)), duration: 0.8, type: "spring" }}
          style={{ position: "absolute", bottom: 0, left: 0, width: "100%", background: color, borderRadius: 999 }}
        />
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: color as string, marginTop: compact ? 0 : 12 }}>{label}</div>
      <div style={compact
        ? { fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }
        : { fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>{percent}%</div>
    </motion.div>
  );
}

/** Kartu tindakan mitigasi; tombol "Laporkan kejadian" mengarah ke form laporan. */
export function CitizenActionCard({ card, variant }: { card: ActionCard; variant: "desktop" | "mobile" }) {
  const [title, copy, icon] = card;
  const isReportBtn = title === "Laporkan kejadian";
  const compact = variant === "mobile";
  const handleClick = () => { if (isReportBtn) window.location.hash = "#/reports"; };
  return (
    <motion.div
      className={compact ? "mobile-action-card" : "citizen-action-card"}
      whileHover={compact ? undefined : { x: 4 }}
      onClick={handleClick}
      style={{
        cursor: isReportBtn ? "pointer" : "default",
        ...(compact ? { border: isReportBtn ? "1px solid var(--accent-blue)" : undefined } : { borderRadius: 8, display: "flex", gap: 16, alignItems: "flex-start" }),
      }}
    >
      <div style={compact
        ? { width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: isReportBtn ? "rgba(37,99,235,0.1)" : "var(--surface-soft)", color: isReportBtn ? "var(--accent-blue)" : "var(--ink-soft)" }
        : { width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-soft)", color: isReportBtn ? "var(--accent-blue)" : "var(--ink-soft)", flexShrink: 0 }}>
        <Icon name={icon} style={{ fontSize: compact ? 20 : 24 }} />
      </div>
      <div style={compact ? {} : { paddingTop: 2 }}>
        <strong style={compact
          ? { display: "block", fontSize: "13px", lineHeight: 1.3, marginBottom: 4, color: isReportBtn ? "var(--accent-blue)" : "var(--ink-primary)" }
          : { display: "block", marginBottom: 6, fontSize: "15px", color: isReportBtn ? "var(--accent-blue)" : "var(--ink-primary)" }}>{title}</strong>
        <p style={compact
          ? { margin: 0, fontSize: "12px", color: "var(--ink-soft)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }
          : { margin: 0, fontSize: "14px", color: "var(--ink-soft)", lineHeight: 1.6 }}>{copy}</p>
      </div>
    </motion.div>
  );
}

export function ReportSeverityBadge({ report, dense }: { report: NearbyReport; dense?: boolean }) {
  return (
    <span className={`badge severity-${report.severity}`} style={dense ? { padding: "4px 8px", fontSize: 11 } : undefined}>
      {report.water_height_cm ? `${report.water_height_cm} cm` : severityLabels[report.severity as ReportSeverity]}
    </span>
  );
}

export function ReportValidatedBadge({ label, dense }: { label: string; dense?: boolean }) {
  return (
    <span className="badge status-divalidasi" style={dense ? { padding: "4px 8px", fontSize: 11 } : undefined}>
      <Icon name="verified" style={{ fontSize: dense ? 12 : 14 }} /> {label}
    </span>
  );
}

export function ShareWarningButtons({ onWhatsApp, onCopy, compact }: {
  onWhatsApp: () => void;
  onCopy: () => void;
  compact?: boolean;
}) {
  const btnStyle = compact
    ? { width: "100%", justifyContent: "center", fontSize: "13.5px", padding: "12px", gap: 8 }
    : { width: "100%", justifyContent: "center", fontSize: "14px" };
  return (
    <div className={compact ? "citizen-share-actions compact" : "citizen-share-actions"}>
      <button className="btn primary" type="button" onClick={onWhatsApp} style={{ background: "#16a34a", borderColor: "#16a34a", ...btnStyle }}>
        <Icon name="share" style={compact ? { fontSize: 18 } : undefined} /> Bagikan via WhatsApp
      </button>
      <button className="btn secondary" type="button" onClick={onCopy} style={btnStyle}>
        <Icon name="content_copy" style={compact ? { fontSize: 18 } : undefined} /> Salin Teks Peringatan
      </button>
    </div>
  );
}

export function ModelInfoPanel({ data }: { data: ModeAwamData | undefined }) {
  return (
    <motion.section variants={itemVariants} className="panel" style={{ background: "var(--surface-soft)", border: "none" }}>
      <h2 style={{ fontSize: "1.05rem", margin: "0 0 16px 0" }}>Informasi Teknis Model</h2>
      <div style={{ display: "grid", gap: 10, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Model AI</span> <strong style={{ textAlign: "right" }}>{data?.model_version ?? "—"}</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Kepercayaan</span> <strong style={{ textAlign: "right", color: "var(--low)" }}>{confidenceLabel(data?.confidence_score)}</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Sumber Data</span> <strong style={{ textAlign: "right" }}>{data?.data_source ?? "—"}</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Pembaruan</span> <strong style={{ textAlign: "right" }}>{formatGeneratedAt(data?.generated_at)}</strong></div>
      </div>
    </motion.section>
  );
}

// ─── CSS yang wajib ikut disuntikkan kedua view (via tag <style>) ───────────

export const CITIZEN_SHARED_STYLES = `
  .citizen-status-badge {
    align-items: center;
    background: rgba(255, 255, 255, 0.16);
    border: 1px solid rgba(255, 255, 255, 0.24);
    border-radius: 999px;
    display: inline-flex;
    font-size: 13px;
    font-weight: 650;
    gap: 6px;
    margin-bottom: 16px;
    padding: 5px 12px;
  }
  .citizen-status-badge[data-compact] { font-size: 12px; margin-bottom: 12px; padding: 4px 10px; }

  .citizen-prediction-notice {
    align-items: flex-start;
    background: rgba(245, 158, 11, 0.18);
    border: 1px solid rgba(245, 158, 11, 0.5);
    border-radius: 12px;
    display: flex;
    font-size: 13.5px;
    gap: 8px;
    line-height: 1.5;
    margin-bottom: 16px;
    max-width: 600px;
    padding: 10px 14px;
  }
  .citizen-prediction-notice.frost {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: white;
    font-size: 13px;
    max-width: none;
  }

  .citizen-guidance {
    color: rgba(255, 255, 255, 0.95);
    font-size: 1.15rem;
    line-height: 1.6;
    margin: 0 0 40px 0;
    max-width: 600px;
  }
  .citizen-guidance.compact {
    color: rgba(255, 255, 255, 0.9);
    font-size: 1rem;
    line-height: 1.5;
    margin: 0 0 24px 0;
    max-width: none;
  }

  .citizen-share-actions.compact { display: flex; flex-direction: column; gap: 10px; }
`;
