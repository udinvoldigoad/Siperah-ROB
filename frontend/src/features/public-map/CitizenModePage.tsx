import { useEffect, useRef, useState } from "react";
import { api } from "../../shared/api/client";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { useToast } from "../../shared/components/Toast";
import { motion, type Variants } from "framer-motion";
import type { RiskClass } from "../../shared/types/domain";

type ModeAwamData = {
  risk_class: RiskClass;
  risk_probability: number;
  max_tidal_height: number;
  peak_time: string | null;
  model_version: string | null;
  confidence_score: number | null;
  data_source: string | null;
  generated_at: string | null;
  is_monitored: boolean;
  monitoring_status: string | null;
  status_label: string | null;
  guidance_message: string | null;
  region: { village: string | null; district: string | null; regency: string | null };
  forecast: { data: ForecastItem[] } | ForecastItem[];
  nearby_reports: NearbyReport[];
};

type WilayahOption = { label: string; lat: number; lon: number };

type ForecastItem = { id: string; prediction_date: string; risk_class: RiskClass; risk_probability: number };
type NearbyReport = { id: string; report_code: string; severity: "ringan" | "sedang" | "parah" | "sangat_parah"; water_height_cm: number | null; incident_time: string; status: string; region?: { village?: string | null; district?: string | null; regency?: string | null } | null };

type ModeAwamResponse = {
  data: ModeAwamData;
};

const meters = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const riskLabels: Record<RiskClass, string> = {
  rendah: "Rendah",
  sedang: "Sedang",
  tinggi: "Tinggi",
  sangat_tinggi: "Sangat Tinggi",
};

const getCardStyle = (riskClass?: RiskClass) => {
  switch (riskClass) {
    case "sangat_tinggi":
      return {
        background: "linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)",
        boxShadow: "0 24px 48px rgba(220, 38, 38, 0.3)",
        icon: "warning"
      };
    case "tinggi":
      return {
        background: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)",
        boxShadow: "0 24px 48px rgba(249, 115, 22, 0.3)",
        icon: "warning"
      };
    case "sedang":
      return {
        background: "linear-gradient(135deg, #eab308 0%, #a16207 100%)",
        boxShadow: "0 24px 48px rgba(234, 179, 8, 0.3)",
        icon: "warning"
      };
    case "rendah":
    default:
      return {
        background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
        boxShadow: "0 24px 48px rgba(37, 99, 235, 0.25)",
        icon: "info"
      };
  }
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

function confidenceLabel(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "—";
  const normalized = score > 1 ? score / 100 : score;
  const label = normalized >= 0.8 ? "Tinggi" : normalized >= 0.6 ? "Sedang" : "Rendah";
  return `${label} (${normalized.toFixed(2)})`;
}

function formatGeneratedAt(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} WIB`;
}

// Titik tengah bounding box dari geometry GeoJSON (Polygon/MultiPolygon) → [lon, lat].
function bboxCenter(coordinates: unknown): [number, number] | null {
  const points: [number, number][] = [];
  const collect = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      points.push([value[0], value[1]]);
      return;
    }
    value.forEach(collect);
  };
  collect(coordinates);
  if (!points.length) return null;
  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  return [(Math.min(...lons) + Math.max(...lons)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}

// Combobox pemilih wilayah dengan pencarian (autocomplete) + opsi GPS.
function WilayahPicker({ options, currentLocation, onSelectWilayah, onRequestGps, variant }: {
  options: WilayahOption[];
  currentLocation: string;
  onSelectWilayah: (option: WilayahOption) => void;
  onRequestGps: () => void;
  variant: "hero" | "mobile";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const needle = query.trim().toLowerCase();
  const filtered = (needle ? options.filter((option) => option.label.toLowerCase().includes(needle)) : options).slice(0, 60);

  return (
    <div className={`wilayah-picker ${variant}`} ref={ref}>
      <button type="button" className="wilayah-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Icon name="location_on" style={{ fontSize: 18, flexShrink: 0 }} />
        <span className="wilayah-trigger-label">{currentLocation}</span>
        <Icon name="expand_more" style={{ fontSize: 18, flexShrink: 0 }} />
      </button>
      {open && (
        <div className="wilayah-popover" role="listbox">
          <div className="wilayah-search">
            <Icon name="search" style={{ fontSize: 18, color: "var(--ink-soft)" }} />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kelurahan atau kabupaten…" aria-label="Cari wilayah" />
          </div>
          <button type="button" className="wilayah-option gps" onClick={() => { onRequestGps(); setOpen(false); }}>
            <Icon name="my_location" style={{ fontSize: 18 }} /> Gunakan lokasi perangkat
          </button>
          <div className="wilayah-list">
            {filtered.length === 0 && <div className="wilayah-empty">Wilayah tidak ditemukan.</div>}
            {filtered.map((option) => (
              <button type="button" key={`${option.label}-${option.lat}-${option.lon}`} className="wilayah-option" onClick={() => { onSelectWilayah(option); setOpen(false); setQuery(""); }}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const WILAYAH_PICKER_STYLES = `
  .wilayah-picker { position: relative; min-width: 0; }
  .wilayah-picker.hero { max-width: 320px; width: 100%; }
  .wilayah-picker.mobile { width: 100%; }
  .wilayah-picker.mobile .wilayah-trigger { background: rgba(255, 255, 255, 0.16); border: 1px solid rgba(255, 255, 255, 0.28); color: #fff; }
  .wilayah-trigger {
    align-items: center;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    color: var(--ink);
    cursor: pointer;
    display: flex;
    font-size: 0.9rem;
    font-weight: 600;
    gap: 8px;
    min-height: 42px;
    padding: 8px 12px;
    width: 100%;
  }
  .wilayah-trigger-label { flex: 1; min-width: 0; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
  .wilayah-popover {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.22);
    color: var(--ink);
    display: flex;
    flex-direction: column;
    left: 0;
    max-height: 340px;
    overflow: hidden;
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    z-index: 40;
  }
  .wilayah-search { align-items: center; border-bottom: 1px solid var(--line); display: flex; gap: 8px; padding: 10px 12px; }
  .wilayah-search input { border: 0; flex: 1; font-size: 0.9rem; min-height: 0; outline: none; padding: 0; width: 100%; }
  .wilayah-list { max-height: 240px; overflow-y: auto; }
  .wilayah-option {
    background: transparent;
    border: 0;
    color: var(--ink);
    cursor: pointer;
    display: flex;
    font-size: 0.88rem;
    gap: 8px;
    padding: 11px 14px;
    text-align: left;
    width: 100%;
  }
  .wilayah-option:hover { background: var(--surface-soft); }
  .wilayah-option.gps { align-items: center; border-bottom: 1px solid var(--line); color: var(--accent-dark); font-weight: 650; }
  .wilayah-empty { color: var(--ink-soft); font-size: 0.86rem; padding: 16px 14px; text-align: center; }
`;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return isMobile;
}

// ==========================================
// DESKTOP VIEW
// ==========================================
function CitizenModeDesktop({
  data, error, dataLoaded, setCoordinates, setLocationNote,
  requestGpsLocation, wilayahOptions, risk, cardStyle, forecastDays, currentLocation, actionCards
}: any) {
  return (
    <AppShell active="awam" title="Status Bahaya Saya" subtitle="Panduan mitigasi dan peringatan dini disajikan dalam bahasa yang mudah dipahami.">
      <style>{`
        ${WILAYAH_PICKER_STYLES}
        .citizen-mode-layout { grid-template-columns: minmax(0, 1fr) 340px; max-width: 1280px; padding-top: 24px; }
        .citizen-status-card { border-radius: 16px !important; padding: 34px !important; }
        .citizen-location-controls { align-items: center; display: flex; gap: 16px; justify-content: space-between; margin-bottom: 28px; }
        .citizen-location-name { align-items: center; display: flex; font-size: .9rem; font-weight: 650; gap: 8px; min-width: 0; }
        .citizen-location-name span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .citizen-location-controls select { background: rgba(255,255,255,.96); flex: 0 0 auto; max-width: 300px; }
        .citizen-status-title { font-size: clamp(2.4rem, 5vw, 3.5rem) !important; }
        .citizen-status-metrics { border-top: 1px solid rgba(255,255,255,.22); display: grid; gap: 12px; grid-template-columns: repeat(3,minmax(0,1fr)); margin-top: 30px; padding-top: 22px; }
        .citizen-status-metric { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.16); border-radius: 12px; min-width: 0; padding: 16px; }
        .citizen-forecast-grid { display: grid; gap: 10px; grid-template-columns: repeat(7,minmax(84px,1fr)); overflow-x: auto; padding: 24px; }
        .citizen-forecast-day { background: var(--surface-soft); border: 1px solid var(--line); border-radius: 12px; padding: 14px 8px; }
        .citizen-recommendations { display: grid; gap: 10px !important; }
        .citizen-action-card { background: var(--surface-soft); border: 1px solid var(--line); border-radius: 12px !important; padding: 14px; }
        .citizen-action-card:hover { border-color: rgba(99,102,241,.35); background: var(--surface); }
        .citizen-share-actions { display: grid; gap: 10px; }
        .citizen-model-row { align-items: flex-start; border-bottom: 1px solid var(--line); display: grid !important; gap: 10px; grid-template-columns: 105px 1fr; padding: 9px 0; }
        .citizen-model-row:last-child { border-bottom: 0; }
        .citizen-model-row strong { text-align: right; }
      `}</style>
      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert" style={{ marginBottom: 24, borderLeftColor: "var(--critical)" }}>
          <Icon name="error" style={{ color: "var(--critical)" }} /> {error}
        </motion.div>
      )}

      <motion.div className="detail-layout citizen-mode-layout" variants={containerVariants} initial="hidden" animate="show">
        <div className="stack">
          {/* Main Status Hero Card */}
          <motion.section
            variants={itemVariants}
            className="citizen-status-card"
            style={{
              background: cardStyle.background,
              color: "#fff",
              borderRadius: 8,
              padding: "40px",
              boxShadow: cardStyle.boxShadow,
              position: "relative",
              overflow: "visible"
            }}
          >
            <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 16, pointerEvents: "none", zIndex: 0 }}>
              <Icon
                name={cardStyle.icon}
                style={{ position: "absolute", right: "-20px", top: "-20px", fontSize: "280px", opacity: 0.1, transform: "rotate(-15deg)" }}
              />
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
              <div className="citizen-location-controls">
                <div className="citizen-location-name">
                  <Icon name="location_on" style={{ fontSize: 20 }} /><span>{currentLocation}</span>
                </div>
                <WilayahPicker
                  variant="hero"
                  options={wilayahOptions}
                  currentLocation={currentLocation}
                  onRequestGps={requestGpsLocation}
                  onSelectWilayah={(option: WilayahOption) => { setCoordinates({ lat: option.lat, lon: option.lon }); setLocationNote(option.label); }}
                />
              </div>

              <h1 className="citizen-status-title" style={{ fontWeight: 900, lineHeight: 1.1, margin: "0 0 12px 0", letterSpacing: "-0.03em" }}>
                Status <span style={{ color: "#fff" }}>{risk}</span>
              </h1>

              {data?.status_label && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.24)", borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 650, marginBottom: 16 }}>
                  <Icon name={data.is_monitored ? "radar" : "info"} style={{ fontSize: 16 }} /> {data.status_label}
                </span>
              )}

              <p style={{ fontSize: "1.15rem", lineHeight: 1.6, color: "rgba(255,255,255,0.95)", maxWidth: "600px", margin: "0 0 40px 0" }}>
                {data
                  ? (data.guidance_message ?? "Pantau kondisi rob di sekitar Anda dan ikuti arahan BPBD.")
                  : (dataLoaded ? "Lokasi Anda berada di luar wilayah pantauan Lampung. Pilih lokasi lain dari daftar di atas untuk melihat status bahaya rob." : "Menganalisis status ancaman rob terbaru di sekitar Anda...")}
              </p>

              <div className="citizen-status-metrics">
                {[
                  ["Kemungkinan Rob", data ? `${data.risk_probability}%` : "-", data ? risk : (dataLoaded ? "Tidak tersedia" : "Memuat...")],
                  ["Puncak Pasang", data ? `${meters.format(data.max_tidal_height)} meter` : "-", data ? `Pukul ${data.peak_time} WIB` : (dataLoaded ? "Tidak tersedia" : "Menunggu Data")],
                  ["Laporan Sekitar", data ? `${data.nearby_reports.length} laporan` : "-", data ? "Dari pantauan warga" : (dataLoaded ? "Tidak tersedia" : "Dari pantauan warga")],
                ].map(([label, value, note], i) => (
                  <motion.div
                    key={label}
                    className="citizen-status-metric"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + (i * 0.1) }}
                  >
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                    <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, marginBottom: 8 }}>{value}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{note}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* Forecast 7 Days */}
          <motion.section variants={itemVariants} className="panel flush">
            <div style={{ padding: "24px", borderBottom: "1px solid var(--line)" }}>
              <h2 style={{ fontSize: "1.25rem", margin: 0, marginBottom: 4 }}>Prakiraan 7 Hari ke Depan</h2>
              <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "14px" }}>Sumber: model prediksi SIPERAH-RoB. Waspada saat indikator merah mendominasi.</p>
            </div>

            <div className="citizen-forecast-grid">
              {forecastDays.map(({ day, label, percent, color }: any, i: number) => (
                <motion.div
                  key={day}
                  className="citizen-forecast-day"
                  whileHover={{ y: -5 }}
                  style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}
                >
                  <div style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 12 }}>{day}</div>
                  <div style={{ height: 120, width: 12, borderRadius: 999, background: "var(--line)", position: "relative", margin: "8px 0" }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.min(percent, 100)}%` }}
                      transition={{ delay: 0.5 + (i * 0.05), duration: 0.8, type: "spring" }}
                      style={{ position: "absolute", bottom: 0, left: 0, width: "100%", background: color, borderRadius: 999 }}
                    />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: color as string, marginTop: 12 }}>{label}</div>
                  <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>{percent}%</div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Laporan Warga Sekitar */}
          <motion.section variants={itemVariants} className="panel flush">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ flex: "1 1 300px" }}>
                <h2 style={{ fontSize: "1.25rem", margin: 0, marginBottom: 4 }}>Laporan Warga di Sekitar Anda</h2>
                <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "14px" }}>Informasi lapangan dari masyarakat untuk meningkatkan kewaspadaan.</p>
              </div>
              <a className="btn secondary" href="#/reports" style={{ whiteSpace: "nowrap" }}>Laporkan Genangan</a>
            </div>
            <div className="table-responsive"><table className="data-table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "14px 24px", color: "var(--ink-soft)", fontSize: "13px", fontWeight: 600 }}>Kelurahan</th>
                  <th style={{ padding: "14px 24px", color: "var(--ink-soft)", fontSize: "13px", fontWeight: 600 }}>Tingkat Air</th>
                  <th style={{ padding: "14px 24px", color: "var(--ink-soft)", fontSize: "13px", fontWeight: 600 }}>Waktu</th>
                  <th style={{ padding: "14px 24px", color: "var(--ink-soft)", fontSize: "13px", fontWeight: 600 }}>Status Validasi</th>
                </tr>
              </thead>
              <tbody>
                {data?.nearby_reports.length === 0 && <tr><td colSpan={4} style={{ padding: "16px 24px", color: "var(--ink-soft)" }}>Belum ada laporan tervalidasi di sekitar lokasi ini.</td></tr>}
                {data?.nearby_reports.map((report: any) => {
                  const region = [report.region?.village, report.region?.district, report.region?.regency].filter(Boolean).join(", ") || "Wilayah pesisir";
                  const time = new Date(report.incident_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                  return <tr key={report.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "16px 24px", fontWeight: 600, color: "var(--ink)" }}>{region}</td>
                    <td style={{ padding: "16px 24px" }}>
                      <span className={`badge severity-${report.severity}`}>
                        {report.water_height_cm ? `${report.water_height_cm} cm` : report.severity.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: "14px" }}>{time} WIB</td>
                    <td style={{ padding: "16px 24px" }}>
                      <span className="badge status-divalidasi">
                        <Icon name="verified" style={{ fontSize: 14 }} /> Divalidasi BPBD
                      </span>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table></div>
          </motion.section>
        </div>

        {/* Sidebar */}
        <aside className="stack citizen-sidebar">
          {/* Tindakan Card */}
          <motion.section variants={itemVariants} className="panel flush" style={{ border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "32px 24px" }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "var(--ink-primary)", display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                <Icon name="verified_user" style={{ fontSize: 24, color: "var(--accent-blue)" }} />
                Rekomendasi Tindakan
              </div>
              <div className="citizen-recommendations">
                {actionCards.map(([title, copy, icon]: any) => {
                  const isReportBtn = title === "Laporkan kejadian";
                  return (
                    <motion.div
                      key={title}
                      className="citizen-action-card"
                      whileHover={{ x: 4 }}
                      style={{
                        borderRadius: 8,
                        display: "flex",
                        gap: 16,
                        alignItems: "flex-start",
                        cursor: isReportBtn ? "pointer" : "default"
                      }}
                      onClick={() => isReportBtn && (window.location.hash = "#/reports")}
                    >
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--surface-soft)",
                        color: isReportBtn ? "var(--accent-blue)" : "var(--ink-soft)",
                        flexShrink: 0
                      }}>
                        <Icon name={icon} style={{ fontSize: 24 }} />
                      </div>
                      <div style={{ paddingTop: 2 }}>
                        <strong style={{ display: "block", marginBottom: 6, fontSize: "15px", color: isReportBtn ? "var(--accent-blue)" : "var(--ink-primary)" }}>{title}</strong>
                        <p style={{ margin: 0, fontSize: "14px", color: "var(--ink-soft)", lineHeight: 1.6 }}>{copy}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.section>

          {/* Bagikan Panel */}
          <motion.section variants={itemVariants} className="panel">
            <h2 style={{ fontSize: "1.15rem", margin: "0 0 16px 0" }}>Sebarkan Peringatan</h2>
            <div className="citizen-share-actions">
              <button className="btn primary" type="button" style={{ width: "100%", justifyContent: "center", background: "#16a34a", borderColor: "#16a34a", fontSize: "14px" }}>
                <Icon name="share" /> Bagikan via WhatsApp
              </button>
              <button className="btn secondary" type="button" style={{ width: "100%", justifyContent: "center", fontSize: "14px" }}>
                <Icon name="content_copy" /> Salin Teks Peringatan
              </button>
            </div>
          </motion.section>

          {/* Model Info Panel */}
          <motion.section variants={itemVariants} className="panel" style={{ background: "var(--surface-soft)", border: "none" }}>
            <h2 style={{ fontSize: "1.05rem", margin: "0 0 16px 0" }}>Informasi Teknis Model</h2>
            <div style={{ display: "grid", gap: 10, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Model AI</span> <strong style={{ textAlign: "right" }}>{data?.model_version ?? "—"}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Kepercayaan</span> <strong style={{ textAlign: "right", color: "var(--low)" }}>{confidenceLabel(data?.confidence_score)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Sumber Data</span> <strong style={{ textAlign: "right" }}>{data?.data_source ?? "—"}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Pembaruan</span> <strong style={{ textAlign: "right" }}>{formatGeneratedAt(data?.generated_at)}</strong></div>
            </div>
          </motion.section>
        </aside>
      </motion.div>
    </AppShell>
  );
}

// ==========================================
// MOBILE NATIVE VIEW
// ==========================================
function CitizenModeMobile({
  data, error, dataLoaded, setCoordinates, setLocationNote,
  requestGpsLocation, wilayahOptions, risk, cardStyle, forecastDays, currentLocation, actionCards
}: any) {

  return (
    <AppShell active="awam" title="Status Bahaya Saya">
      <style>{`
        ${WILAYAH_PICKER_STYLES}
        /* MOBILE NATIVE STYLES */
        .mobile-native-hero {
          background: ${cardStyle.background};
          color: white;
          padding: 32px 20px 40px 20px;
          margin: -24px -24px 24px -24px; /* Assume app-content has 24px padding */
          position: relative;
          overflow: visible;
          box-shadow: ${cardStyle.boxShadow};
          border-radius: 0 0 32px 32px;
        }
        .mobile-native-hero-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: 0 0 32px 32px;
          pointer-events: none;
          z-index: 0;
        }
        
        .mobile-location-pill {
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 99px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 24px;
        }
        
        .mobile-forecast-scroller {
          display: flex;
          overflow-x: auto;
          gap: 12px;
          padding: 8px 24px 24px 24px;
          margin: 0 -24px;
          scroll-snap-type: x mandatory;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .mobile-forecast-scroller::-webkit-scrollbar { display: none; }
        
        .mobile-forecast-card {
          scroll-snap-align: center;
          flex: 0 0 110px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 16px 12px;
          text-align: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
        }
        
        .mobile-bento-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        
        .mobile-action-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        
        .mobile-report-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .mobile-report-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        /* Overriding AppShell padding on mobile */
        @media(max-width: 768px) {
          .app-content { padding: 16px !important; }
          .mobile-native-hero { margin: -16px -16px 24px -16px !important; }
          .mobile-forecast-scroller { padding: 8px 16px 24px 16px !important; margin: 0 -16px !important; }
        }
      `}</style>
      
      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert" style={{ marginBottom: 16, borderLeftColor: "var(--critical)" }}>
          <Icon name="error" style={{ color: "var(--critical)" }} /> {error}
        </motion.div>
      )}

      {/* 1. Mobile Edge-to-Edge Hero */}
      <motion.section 
        className="mobile-native-hero"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="mobile-native-hero-bg">
          <Icon
            name={cardStyle.icon}
            style={{ position: "absolute", right: "-30px", top: "-10px", fontSize: "240px", opacity: 0.1, transform: "rotate(-15deg)" }}
          />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ marginBottom: 20 }}>
            <WilayahPicker
              variant="mobile"
              options={wilayahOptions}
              currentLocation={currentLocation}
              onRequestGps={requestGpsLocation}
              onSelectWilayah={(option: WilayahOption) => { setCoordinates({ lat: option.lat, lon: option.lon }); setLocationNote(option.label); }}
            />
          </div>

          {data?.status_label && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.24)", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 650, marginBottom: 12 }}>
              <Icon name={data.is_monitored ? "radar" : "info"} style={{ fontSize: 14 }} /> {data.status_label}
            </span>
          )}

          <h1 style={{ fontSize: "2.5rem", fontWeight: 900, lineHeight: 1.1, margin: "0 0 12px 0", letterSpacing: "-0.03em" }}>
            Status<br />{risk}
          </h1>

          <p style={{ fontSize: "1rem", lineHeight: 1.5, color: "rgba(255,255,255,0.9)", margin: "0 0 24px 0" }}>
            {data
              ? (data.guidance_message ?? "Pantau kondisi rob di sekitar Anda dan ikuti arahan BPBD.")
              : (dataLoaded ? "Lokasi di luar wilayah pantauan Lampung. Pilih lokasi dari daftar." : "Menganalisis status rob...")}
          </p>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, background: "rgba(0,0,0,0.15)", borderRadius: 16, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>Peluang</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{data ? `${data.risk_probability}%` : "-"}</div>
            </div>
            <div style={{ flex: 1, background: "rgba(0,0,0,0.15)", borderRadius: 16, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>Tinggi Air</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{data ? `${meters.format(data.max_tidal_height)}m` : "-"}</div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 2. Horizontal Scroll Forecast */}
      <motion.section variants={itemVariants} initial="hidden" animate="show" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 4px 0", fontWeight: 700 }}>Prakiraan 7 Hari</h2>
        <p style={{ margin: "0 0 16px 0", color: "var(--ink-soft)", fontSize: "13px" }}>Geser untuk melihat hari berikutnya</p>
        
        <div className="mobile-forecast-scroller">
          {forecastDays.map(({ day, label, percent, color }: any, i: number) => (
            <div key={day} className="mobile-forecast-card">
              <div style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 700, marginBottom: 12 }}>{day}</div>
              <div style={{ height: 100, width: 14, borderRadius: 999, background: "var(--line)", position: "relative", margin: "0 auto 12px auto" }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.min(percent, 100)}%` }}
                  transition={{ delay: 0.3 + (i * 0.1), duration: 0.8, type: "spring" }}
                  style={{ position: "absolute", bottom: 0, left: 0, width: "100%", background: color, borderRadius: 999 }}
                />
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: color as string }}>{label}</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{percent}%</div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 3. Bento Grid Actions */}
      <motion.section variants={itemVariants} initial="hidden" animate="show" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 16px 0", fontWeight: 700 }}>Langkah Mitigasi</h2>
        <div className="mobile-bento-grid">
          {actionCards.map(([title, copy, icon]: any, i: number) => {
            const isReportBtn = title === "Laporkan kejadian";
            return (
              <div 
                key={title} 
                className="mobile-action-card"
                onClick={() => isReportBtn && (window.location.hash = "#/reports")}
                style={{ cursor: isReportBtn ? "pointer" : "default", border: isReportBtn ? "1px solid var(--accent-blue)" : undefined }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: isReportBtn ? "rgba(37,99,235,0.1)" : "var(--surface-soft)", color: isReportBtn ? "var(--accent-blue)" : "var(--ink-soft)" }}>
                  <Icon name={icon} style={{ fontSize: 20 }} />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "13px", lineHeight: 1.3, marginBottom: 4, color: isReportBtn ? "var(--accent-blue)" : "var(--ink-primary)" }}>{title}</strong>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--ink-soft)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{copy}</p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* 4. Card-Based Reports List */}
      <motion.section variants={itemVariants} initial="hidden" animate="show" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: "1.1rem", margin: "0 0 4px 0", fontWeight: 700 }}>Laporan Warga</h2>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "13px" }}>Kondisi lapangan saat ini</p>
          </div>
        </div>
        
        <div className="mobile-report-list">
          {data?.nearby_reports.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", background: "var(--surface-soft)", borderRadius: 12, color: "var(--ink-soft)", fontSize: 13 }}>
              Belum ada laporan di sekitar Anda.
            </div>
          )}
          {data?.nearby_reports.map((report: any) => {
            const region = [report.region?.village, report.region?.district].filter(Boolean).join(", ") || "Wilayah pesisir";
            const time = new Date(report.incident_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
            return (
              <div key={report.id} className="mobile-report-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <strong style={{ fontSize: 14, color: "var(--ink-primary)" }}>{region}</strong>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{time} WIB</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <span className={`badge severity-${report.severity}`} style={{ padding: "4px 8px", fontSize: 11 }}>
                    {report.water_height_cm ? `${report.water_height_cm} cm` : report.severity.replace("_", " ")}
                  </span>
                  <span className="badge status-divalidasi" style={{ padding: "4px 8px", fontSize: 11 }}>
                    <Icon name="verified" style={{ fontSize: 12 }} /> BPBD
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Bottom Share Buttons */}
      <motion.section variants={itemVariants} initial="hidden" animate="show" style={{ display: "flex", gap: 10, paddingBottom: 24 }}>
        <button className="btn primary" type="button" style={{ flex: 1, justifyContent: "center", background: "#16a34a", borderColor: "#16a34a", fontSize: "13px", padding: "12px" }}>
          <Icon name="share" style={{ fontSize: 18 }} /> WA
        </button>
        <button className="btn secondary" type="button" style={{ flex: 1, justifyContent: "center", fontSize: "13px", padding: "12px" }}>
          <Icon name="content_copy" style={{ fontSize: 18 }} /> Salin
        </button>
      </motion.section>
      
    </AppShell>
  );
}

// ==========================================
// MAIN EXPORT (RESPONSIVE SWITCHER)
// ==========================================
export function CitizenModePage() {
  const [data, setData] = useState<ModeAwamData>();
  const [error, setError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [locationNote, setLocationNote] = useState("Menggunakan wilayah pesisir terdekat");
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [wilayahOptions, setWilayahOptions] = useState<WilayahOption[]>([]);

  const isMobile = useIsMobile();

  // Daftar wilayah pesisir yang dipantau, diambil dari peta publik (centroid tiap zona).
  useEffect(() => {
    let alive = true;
    api<any>("/public/map")
      .then((response) => {
        if (!alive) return;
        const features: any[] = response.data?.regions?.features ?? [];
        const seen = new Set<string>();
        const options: WilayahOption[] = [];
        for (const feature of features) {
          const center = bboxCenter(feature.geometry?.coordinates);
          if (!center) continue;
          const label = [feature.properties?.village, feature.properties?.district, feature.properties?.regency].filter(Boolean).join(", ") || "Wilayah pesisir";
          if (seen.has(label)) continue;
          seen.add(label);
          options.push({ label, lat: center[1], lon: center[0] });
        }
        options.sort((a, b) => a.label.localeCompare(b.label, "id"));
        setWilayahOptions(options);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const requestGpsLocation = () => {
    if (!navigator.geolocation) {
      setError("Browser ini belum mendukung GPS. Silakan pilih wilayah secara manual.");
      return;
    }
    setLocationNote("Mencari lokasi perangkat…");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setCoordinates({ lat, lon });
        
        try {
          // Reverse geocode to get actual user location name, enforce Indonesian language
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=id`);
          const geo = await res.json();
          if (geo && geo.address) {
            const locName = [
              geo.address.residential || geo.address.neighbourhood || geo.address.road || geo.address.village || geo.address.suburb, 
              geo.address.city || geo.address.town || geo.address.county || geo.address.state
            ].filter(Boolean).join(", ");
            setLocationNote(locName || "Lokasi Anda");
          } else {
            setLocationNote("Lokasi perangkat");
          }
        } catch {
          setLocationNote("Lokasi perangkat");
        }
      },
      () => {
        setError("Izin lokasi tidak tersedia. Menampilkan wilayah pesisir terdekat; Anda tetap bisa memilih wilayah manual.");
        setLocationNote("Wilayah pesisir terdekat");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  useEffect(() => {
    let alive = true;
    setDataLoaded(false);

    const params = coordinates ? `?lat=${coordinates.lat}&lon=${coordinates.lon}` : "";
    api<any>(`/public/mode-awam${params}`)
      .then((response) => {
        if (alive) {
          setData(response.data ?? undefined);
          setDataLoaded(true);
          if (!response.data && response.message) {
            setError(response.message);
          } else {
            setError("");
          }
        }
      })
      .catch(() => {
        if (alive) {
          setDataLoaded(true);
          setError("Data status bahaya belum bisa dimuat. Coba lagi sebentar.");
        }
      });

    return () => {
      alive = false;
    };
  }, [coordinates]);
  useEffect(() => { requestGpsLocation(); }, []);

  const risk = data ? riskLabels[data.risk_class] : (dataLoaded ? "Tidak Tersedia" : "Memuat...");
  const cardStyle = getCardStyle(data?.risk_class);
  // If we are showing dummy data, or if data is not available, we should prioritize the actual locationNote (which now holds the real geocoded name)
  // rather than the dummy region's name.
  const isDummyData = (data?.region as any)?.provenance_status === "demo" || risk === "Tidak Tersedia";
  const currentLocation = (data?.region && !isDummyData) 
    ? [data.region.village, data.region.district, data.region.regency].filter(Boolean).join(", ") 
    : locationNote;

  const forecastDays = data ? (Array.isArray(data.forecast) ? data.forecast : data.forecast.data).map((item: any) => {
    const rawDate = item.prediction_date.split("T")[0].split(" ")[0]; // Get only YYYY-MM-DD
    return {
      day: new Date(`${rawDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      label: riskLabels[item.risk_class as RiskClass],
      percent: item.risk_probability, 
      color: item.risk_class === "sangat_tinggi" ? "var(--critical)" : item.risk_class === "tinggi" ? "var(--high)" : item.risk_class === "sedang" ? "var(--medium)" : "var(--low)",
    };
  }) : [];

  const actionCards = [
    ["Jauhi area rendah", "Hindari jalan pesisir and area yang mudah tergenang.", "priority_high"],
    ["Siapkan barang penting", "Amankan dokumen dan barang elektronik sebelum puncak pasang.", "inventory_2"],
    ["Ikuti arahan BPBD", "Jika kondisi memburuk, ikuti informasi resmi dari petugas.", "campaign"],
    ["Laporkan kejadian", "Tambahkan foto dan lokasi bila melihat genangan di sekitar Anda.", "add_location_alt"],
  ];

  const shareText = [
    "⚠️ Peringatan Banjir Rob — SIPERAH-RoB",
    `Lokasi: ${currentLocation}`,
    `Status: ${risk}`,
    ...(data ? [
      ...(data.guidance_message ? [data.guidance_message] : []),
      `Peluang rob ${data.risk_probability}%${data.peak_time ? `, puncak pasang ${data.peak_time} WIB` : ""}.`,
    ] : []),
    "Sumber: SIPERAH-RoB",
  ].join("\n");

  const handleShareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  };
  const handleCopyWarning = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Teks peringatan disalin ke clipboard.");
    } catch {
      toast.error("Gagal menyalin otomatis. Silakan salin manual.");
    }
  };

  const commonProps = {
    data, error, dataLoaded, locationNote, coordinates, setCoordinates, setLocationNote,
    requestGpsLocation, wilayahOptions, risk, cardStyle, forecastDays, currentLocation, actionCards,
    handleShareWhatsApp, handleCopyWarning,
  };

  if (isMobile) {
    return <CitizenModeMobile {...commonProps} />;
  }

  return <CitizenModeDesktop {...commonProps} />;
}
