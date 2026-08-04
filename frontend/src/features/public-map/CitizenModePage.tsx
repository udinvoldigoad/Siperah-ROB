import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { api } from "../../shared/api/client";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { useToast } from "../../shared/components/Toast";
import { getCurrentUser } from "../../shared/auth/session";
import { motion } from "framer-motion";
import type { RiskClass } from "../../shared/types/domain";
import {
  CITIZEN_SHARED_STYLES,
  CitizenActionCard,
  ErrorBanner,
  ForecastDayColumn,
  GuidanceText,
  ModelInfoPanel,
  PredictionNotice,
  ReportSeverityBadge,
  ReportValidatedBadge,
  ShareWarningButtons,
  StatusBadge,
  containerVariants,
  itemVariants,
  reportRegionLabel,
  reportTimeLabel,
  type ActionCard,
  type ForecastDay,
  type ModeAwamData,
  type NearbyReport,
  type WilayahOption,
} from "./CitizenModeParts";

type ModeAwamResponse = {
  data: ModeAwamData | null;
  /** Terisi saat backend tak punya data untuk koordinat itu (bukan galat HTTP). */
  message?: string;
};

/** Bentuk minimum `/public/map` yang benar-benar dibaca halaman ini: centroid & nama wilayah. */
type PublicMapResponse = {
  data?: {
    regions?: {
      features?: Array<{
        geometry?: { coordinates?: unknown };
        properties?: { village?: string | null; district?: string | null; regency?: string | null };
      }>;
    };
  };
};

/**
 * Props `CitizenModeDesktop` & `CitizenModeMobile` â€” keduanya menerima
 * PERSIS daftar yang sama (lihat `commonProps` di bawah).
 *
 * Sebelumnya keduanya diketik `: any`, sehingga 6 callback `.map()` di dalamnya
 * ikut terpaksa `: any` dan salah ketik nama prop tidak pernah tertangkap tsc.
 * Bagian JSX yang sama persis kini dipindah ke `./CitizenModeParts` (AU-15);
 * yang tersisa di sini murni struktur tata letak masing-masing view.
 */
type CitizenModeViewProps = {
  data: ModeAwamData | undefined;
  error: string;
  dataLoaded: boolean;
  locationNote: string;
  coordinates: { lat: number; lon: number } | null;
  setCoordinates: Dispatch<SetStateAction<{ lat: number; lon: number } | null>>;
  setLocationNote: Dispatch<SetStateAction<string>>;
  requestGpsLocation: () => void;
  wilayahOptions: WilayahOption[];
  risk: string;
  cardStyle: ReturnType<typeof getCardStyle>;
  forecastDays: ForecastDay[];
  currentLocation: string;
  actionCards: ActionCard[];
  handleShareWhatsApp: () => void;
  handleCopyWarning: () => Promise<void>;
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

// Titik tengah bounding box dari geometry GeoJSON (Polygon/MultiPolygon) â†’ [lon, lat].
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
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kelurahan atau kabupatenâ€¦" aria-label="Cari wilayah" />
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
  .wilayah-picker.hero { max-width: 320px; width: 100%; flex: 1 1 240px; }
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
  requestGpsLocation, wilayahOptions, risk, cardStyle, forecastDays, currentLocation, actionCards,
  handleShareWhatsApp, handleCopyWarning
}: CitizenModeViewProps) {
  return (
    <AppShell active="awam" title="Status Bahaya Saya" subtitle="Panduan mitigasi dan peringatan dini disajikan dalam bahasa yang mudah dipahami.">
      <style>{`
        ${WILAYAH_PICKER_STYLES}
        ${CITIZEN_SHARED_STYLES}
        .citizen-mode-layout { grid-template-columns: minmax(0, 1fr) 340px; max-width: 1280px; padding-top: 24px; }
        .citizen-status-card { border-radius: 16px !important; padding: 34px !important; }
        .citizen-location-controls { align-items: center; display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; margin-bottom: 28px; }
        .citizen-location-name { align-items: center; display: flex; font-size: .9rem; font-weight: 650; gap: 8px; min-width: 0; flex: 1 1 auto; }
        .citizen-location-name span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .citizen-location-controls select { background: rgba(255,255,255,.96); flex: 0 0 auto; max-width: 300px; }
        .citizen-status-title { font-size: clamp(2.4rem, 5vw, 3.5rem) !important; }
        .citizen-status-metrics { border-top: 1px solid rgba(255,255,255,.22); display: grid; gap: 12px; grid-template-columns: repeat(3,minmax(0,1fr)); margin-top: 30px; padding-top: 22px; }
        .citizen-status-metric { background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.16); border-radius: 12px; min-width: 0; padding: 16px; }
        .citizen-forecast-grid { display: grid; gap: 10px; grid-template-columns: repeat(7,minmax(84px,1fr)); overflow-x: auto; padding: 24px; -ms-overflow-style: none; scrollbar-width: none; }
        .citizen-forecast-grid::-webkit-scrollbar { display: none; }
        .citizen-forecast-day { background: var(--surface-soft); border: 1px solid var(--line); border-radius: 12px; padding: 14px 8px; }
        .citizen-recommendations { display: grid; gap: 10px !important; }
        .citizen-action-card { background: var(--surface-soft); border: 1px solid var(--line); border-radius: 12px !important; padding: 14px; }
        .citizen-action-card:hover { border-color: rgba(99,102,241,.35); background: var(--surface); }
        .citizen-share-actions { display: grid; gap: 10px; }
        .citizen-model-row { align-items: flex-start; border-bottom: 1px solid var(--line); display: grid !important; gap: 10px; grid-template-columns: 105px 1fr; padding: 9px 0; }
        .citizen-model-row:last-child { border-bottom: 0; }
        .citizen-model-row strong { text-align: right; }

        @media (max-width: 1080px) {
          .citizen-mode-layout {
            grid-template-columns: 1fr !important;
            gap: 24px;
          }
          .citizen-status-card {
            padding: 24px !important;
          }
          .citizen-status-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 640px) {
          .citizen-status-metrics {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      {error && <ErrorBanner error={error} marginBottom={24} />}

      <motion.div className="detail-layout citizen-mode-layout" variants={containerVariants} initial="hidden" animate="show">
        <div className="stack" style={{ minWidth: 0 }}>
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

              {data?.status_label && <StatusBadge data={data} />}

              <PredictionNotice data={data} tone="amber" />

              <GuidanceText data={data} dataLoaded={dataLoaded} />

              <div className="citizen-status-metrics">
                {[
                  ["Kemungkinan Rob", data?.risk_probability != null ? `${Math.round(Number(data.risk_probability))}%` : "-", data ? (data.risk_probability != null ? risk : "Prediksi belum tersedia") : (dataLoaded ? "Tidak tersedia" : "Memuat...")],
                  ["Puncak Pasang (di atas muka laut rata-rata)", data?.max_tidal_height != null ? `${meters.format(data.max_tidal_height)} meter` : "-", data?.peak_time ? `Pukul ${data.peak_time} WIB` : (dataLoaded ? "Tidak tersedia" : "Menunggu Data")],
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
              <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "14px" }}>Sumber: model prediksi SAIBAR. Waspada saat indikator merah mendominasi.</p>
            </div>

            {forecastDays.length === 0 ? (
              <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--ink-soft)", fontSize: 14 }}>
                Prakiraan belum tersedia untuk lokasi ini
                {dataLoaded ? "." : " â€” memuat data..."}
              </div>
            ) : (
            <div className="citizen-forecast-grid">
              {forecastDays.map(({ day, label, percent, color }, i) => (
                <ForecastDayColumn key={day} day={day} label={label} percent={percent} color={color} index={i} className="citizen-forecast-day" />
              ))}
            </div>
            )}
          </motion.section>

          {/* Laporan Warga Sekitar */}
          <motion.section variants={itemVariants} className="panel flush">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ flex: "1 1 300px" }}>
                <h2 style={{ fontSize: "1.25rem", margin: 0, marginBottom: 4 }}>Laporan Warga di Sekitar Anda</h2>
                <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "14px" }}>Informasi lapangan dari masyarakat untuk meningkatkan kewaspadaan.</p>
              </div>
              {(() => {
                return getCurrentUser()?.role !== "admin" ? (
                  <a className="btn secondary" href="#/reports" style={{ whiteSpace: "nowrap" }}>Laporkan Genangan</a>
                ) : null;
              })()}
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
                {data?.nearby_reports.map((report) => {
                  return <tr key={report.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "16px 24px", fontWeight: 600, color: "var(--ink)" }}>{reportRegionLabel(report, true)}</td>
                    <td style={{ padding: "16px 24px" }}>
                      <ReportSeverityBadge report={report} />
                    </td>
                    <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: "14px" }}>{reportTimeLabel(report)}</td>
                    <td style={{ padding: "16px 24px" }}>
                      <ReportValidatedBadge label="Divalidasi BPBD" />
                    </td>
                  </tr>;
                })}
              </tbody>
            </table></div>
          </motion.section>
        </div>

        {/* Sidebar */}
        <aside className="stack citizen-sidebar" style={{ minWidth: 0 }}>
          {/* Tindakan Card */}
          <motion.section variants={itemVariants} className="panel flush" style={{ border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "32px 24px" }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "var(--ink-primary)", display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                <Icon name="verified_user" style={{ fontSize: 24, color: "var(--accent-blue)" }} />
                Rekomendasi Tindakan
              </div>
              <div className="citizen-recommendations">
                {actionCards.map((card) => (
                  <CitizenActionCard key={card[0]} card={card} variant="desktop" />
                ))}
              </div>
            </div>
          </motion.section>

          {/* Bagikan Panel */}
          <motion.section variants={itemVariants} className="panel">
            <h2 style={{ fontSize: "1.15rem", margin: "0 0 16px 0" }}>Sebarkan Peringatan</h2>
            <ShareWarningButtons onWhatsApp={handleShareWhatsApp} onCopy={handleCopyWarning} />
          </motion.section>

          {/* Model Info Panel */}
          <ModelInfoPanel data={data} />
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
  requestGpsLocation, wilayahOptions, risk, cardStyle, forecastDays, currentLocation, actionCards,
  handleShareWhatsApp, handleCopyWarning
}: CitizenModeViewProps) {

  return (
    <AppShell active="awam" title="Status Bahaya Saya">
      <style>{`
        ${WILAYAH_PICKER_STYLES}
        ${CITIZEN_SHARED_STYLES}
        /* MOBILE NATIVE STYLES */
        .mobile-native-hero {
          background: ${cardStyle.background};
          color: white;
          padding: 32px 20px 40px 20px;
          margin: -24px -24px 24px -24px; /* Assume app-content has 24px padding */
          position: relative;
          overflow: visible;
          box-shadow: ${cardStyle.boxShadow};
          border-radius: 0;
        }
        .mobile-native-hero-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: 0;
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
      
      {error && <ErrorBanner error={error} marginBottom={16} />}

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

          {data?.status_label && <StatusBadge data={data} compact />}

          <PredictionNotice data={data} tone="frost" />

          <h1 style={{ fontSize: "2.5rem", fontWeight: 900, lineHeight: 1.1, margin: "0 0 12px 0", letterSpacing: "-0.03em" }}>
            Status<br />{risk}
          </h1>

          <GuidanceText data={data} dataLoaded={dataLoaded} compact />

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, background: "rgba(0,0,0,0.15)", borderRadius: 16, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>Peluang</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{data?.risk_probability != null ? `${Math.round(Number(data.risk_probability))}%` : "-"}</div>
            </div>
            <div style={{ flex: 1, background: "rgba(0,0,0,0.15)", borderRadius: 16, padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>Pasang (vs MSL)</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{data?.max_tidal_height != null ? `${meters.format(data.max_tidal_height)}m` : "-"}</div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 2. Horizontal Scroll Forecast */}
      <motion.section variants={itemVariants} initial="hidden" animate="show" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 4px 0", fontWeight: 700 }}>Prakiraan 7 Hari</h2>
        <p style={{ margin: "0 0 16px 0", color: "var(--ink-soft)", fontSize: "13px" }}>Geser untuk melihat hari berikutnya</p>
        
        {forecastDays.length === 0 && (
          <div style={{ padding: "20px 0", color: "var(--ink-soft)", fontSize: 13 }}>
            Prakiraan belum tersedia untuk lokasi ini{dataLoaded ? "." : " â€” memuat data..."}
          </div>
        )}
        <div className="mobile-forecast-scroller">
          {forecastDays.map(({ day, label, percent, color }, i) => (
            <ForecastDayColumn key={day} day={day} label={label} percent={percent} color={color} index={i} className="mobile-forecast-card" compact />
          ))}
        </div>
      </motion.section>

      {/* 3. Bento Grid Actions */}
      <motion.section variants={itemVariants} initial="hidden" animate="show" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 16px 0", fontWeight: 700 }}>Langkah Mitigasi</h2>
        <div className="mobile-bento-grid">
          {actionCards.map((card) => (
            <CitizenActionCard key={card[0]} card={card} variant="mobile" />
          ))}
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
          {data?.nearby_reports.map((report) => {
            return (
              <div key={report.id} className="mobile-report-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <strong style={{ fontSize: 14, color: "var(--ink-primary)" }}>{reportRegionLabel(report, false)}</strong>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{reportTimeLabel(report)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <ReportSeverityBadge report={report} dense />
                  <ReportValidatedBadge label="BPBD" dense />
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Bottom Share Buttons */}
      <motion.section variants={itemVariants} initial="hidden" animate="show" style={{ marginBottom: 32, paddingBottom: 24 }}>
        <h2 style={{ fontSize: "1.1rem", margin: "0 0 4px 0", fontWeight: 700 }}>Sebarkan Peringatan</h2>
        <p style={{ margin: "0 0 16px 0", color: "var(--ink-soft)", fontSize: "13px" }}>Bantu kerabat bersiap dengan membagikan informasi ini</p>

        <ShareWarningButtons onWhatsApp={handleShareWhatsApp} onCopy={handleCopyWarning} compact />
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

  const toast = useToast();
  const isMobile = useIsMobile();

  // Daftar wilayah pesisir yang dipantau, diambil dari peta publik (centroid tiap zona).
  useEffect(() => {
    let alive = true;
    api<PublicMapResponse>("/public/map")
      .then((response) => {
        if (!alive) return;
        const features = response.data?.regions?.features ?? [];
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
    setLocationNote("Mencari lokasi perangkatâ€¦");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setCoordinates({ lat, lon });
        
        // Nominatim = layanan pihak ketiga gratis: bisa lambat, bisa membalas
        // 429, dan tak menjanjikan SLA apa pun. Karena namanya cuma pemanis di
        // atas koordinat yang SUDAH didapat, kegagalan apa pun tak boleh
        // menggantung UI â€” batasi 8 detik lalu jatuh ke label generik.
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        try {
          // accept-language=id agar nama wilayah tak kembali dalam bahasa Inggris.
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=id`,
            { signal: controller.signal },
          );
          // 429 (kena rate limit) & 5xx tetap punya body JSON, jadi status
          // harus diperiksa eksplisit â€” bukan diserahkan ke parse error.
          if (!res.ok) throw new Error(`Nominatim ${res.status}`);

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
        } finally {
          window.clearTimeout(timeout);
        }
      },
      (error) => {
        let errorMessage = "Gagal mendapatkan lokasi Anda.";
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = "Izin lokasi ditolak. Silakan izinkan akses GPS di browser Anda atau pilih wilayah secara manual.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = "Informasi lokasi GPS tidak tersedia saat ini. Silakan coba lagi nanti.";
        } else if (error.code === error.TIMEOUT) {
          errorMessage = "Waktu pencarian lokasi habis (timeout). Silakan pastikan sinyal GPS stabil.";
        }
        setError(errorMessage);
        setLocationNote("Pilih wilayah manual");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    let alive = true;
    setDataLoaded(false);

    const params = coordinates ? `?lat=${coordinates.lat}&lon=${coordinates.lon}` : "";
    api<ModeAwamResponse>(`/public/mode-awam${params}`)
      .then((response) => {
        if (alive) {
          setData(response.data ?? undefined);
          setDataLoaded(true);
          
          // Haptic Feedback for Mobile Elite UX
          if (response.data && response.data.risk_class === "sangat_tinggi" && typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
          
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

  // Jangan pernah memicu dialog izin tanpa gestur pengguna â€” dulu halaman ini
  // langsung meminta GPS saat dibuka, dan penolakan memunculkan banner error
  // sebelum warga sempat melihat isinya. GPS kini hanya berjalan otomatis bila
  // izinnya SUDAH diberikan sebelumnya (query ini tidak memunculkan dialog);
  // selebihnya menunggu tombol "Gunakan lokasi perangkat".
  useEffect(() => {
    let alive = true;
    if (!navigator.permissions?.query) return;

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (alive && status.state === "granted") requestGpsLocation();
      })
      // Browser lama tak mengenal nama izin ini â€” biarkan manual saja.
      .catch(() => undefined);

    return () => { alive = false; };
  }, []);

  const risk = data?.risk_class ? riskLabels[data.risk_class] : (dataLoaded || data ? "Tidak Tersedia" : "Memuat...");
  const cardStyle = getCardStyle(data?.risk_class ?? undefined);
  // If we are showing dummy data, or if data is not available, we should prioritize the actual locationNote (which now holds the real geocoded name)
  // rather than the dummy region's name.
  const isDummyData = data?.region?.provenance_status === "demo" || risk === "Tidak Tersedia";
  const currentLocation = (data?.region && !isDummyData) 
    ? [data.region.village, data.region.district, data.region.regency].filter(Boolean).join(", ") 
    : locationNote;

  // Prakiraan menampilkan data apa adanya bila wilayah terpantau â€” status
  // "stale" cukup ditandai lewat prediction_notice, TIDAK dengan menolkan
  // grafik (dulu hero bisa "Sangat Tinggi" sementara 7 bar di bawahnya
  // dipaksa "Rendah 0%": kontradiksi di layar peringatan).
  const forecastDays = data && data.is_monitored
    ? (Array.isArray(data.forecast) ? data.forecast : data.forecast.data).map((item) => {
        const rawDate = item.prediction_date.split("T")[0].split(" ")[0]; // YYYY-MM-DD
        const riskClass = item.risk_class as RiskClass;
        return {
          day: new Date(`${rawDate}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
          label: riskLabels[riskClass] ?? riskClass,
          percent: Math.round(Number(item.risk_probability ?? 0)),
          color: riskClass === "sangat_tinggi" ? "var(--critical)" : riskClass === "tinggi" ? "var(--high)" : riskClass === "sedang" ? "var(--medium)" : "var(--low)",
        };
      })
    : [];
  // Tidak ada data prakiraan â†’ biarkan kosong; bagian render menampilkan
  // pesan "belum tersedia", BUKAN tujuh hari "Rendah 0%" karangan.

  const user = getCurrentUser();

  const actionCards = [
    ["Jauhi area rendah", "Hindari jalan pesisir dan area yang mudah tergenang.", "priority_high"],
    ["Siapkan barang penting", "Amankan dokumen dan barang elektronik sebelum puncak pasang.", "inventory_2"],
    ["Ikuti arahan BPBD", "Jika kondisi memburuk, ikuti informasi resmi dari petugas.", "campaign"],
    ...(user?.role !== "admin" ? [["Laporkan kejadian", "Tambahkan foto dan lokasi bila melihat genangan di sekitar Anda.", "add_location_alt"]] : []),
  ];

  const shareText = [
    "âš ï¸ Peringatan Banjir Rob â€” SAIBAR",
    `Lokasi: ${currentLocation}`,
    `Status: ${risk}`,
    ...(data ? [
      ...(data.guidance_message ? [data.guidance_message] : []),
      ...(data.risk_probability != null
        ? [`Peluang rob ${Math.round(Number(data.risk_probability))}%${data.peak_time ? `, puncak pasang ${data.peak_time} WIB` : ""}.`]
        : []),
    ] : []),
    "Sumber: SAIBAR",
  ].join("\n");

  const handleShareWhatsApp = () => {
    // Skema "teruskan pesan": buka WhatsApp dengan teks peringatan sudah terisi,
    // pengguna memilih sendiri kontak/grup tujuan (tanpa nomor tetap).
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

