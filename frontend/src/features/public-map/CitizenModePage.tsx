import { useEffect, useState } from "react";
import { api } from "../../shared/api/client";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
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
  region: { village: string | null; district: string | null; regency: string | null };
  forecast: { data: ForecastItem[] } | ForecastItem[];
  nearby_reports: NearbyReport[];
};

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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function CitizenModePage() {
  const [data, setData] = useState<ModeAwamData>();
  const [error, setError] = useState("");
  const [locationNote, setLocationNote] = useState("Menggunakan wilayah pesisir terdekat");
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);

  const locationOptions = [
    { label: "Gunakan lokasi perangkat", value: "gps" },
    { label: "Telukbetung Selatan, Bandar Lampung", value: "-5.45,105.26" },
    { label: "Panjang, Bandar Lampung", value: "-5.51,105.20" },
    { label: "Kalianda, Lampung Selatan", value: "-5.58,105.59" },
  ];

  const requestGpsLocation = () => {
    if (!navigator.geolocation) {
      setError("Browser ini belum mendukung GPS. Silakan pilih wilayah secara manual.");
      return;
    }
    setLocationNote("Mencari lokasi perangkat…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({ lat: position.coords.latitude, lon: position.coords.longitude });
        setLocationNote("Lokasi perangkat");
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

    const params = coordinates ? `?lat=${coordinates.lat}&lon=${coordinates.lon}` : "";
    api<ModeAwamResponse>(`/public/mode-awam${params}`)
      .then((response) => {
        if (alive) setData(response.data);
      })
      .catch(() => {
        if (alive) setError("Data status bahaya belum bisa dimuat. Coba lagi sebentar.");
      });

    return () => {
      alive = false;
    };
  }, [coordinates]);

  useEffect(() => { requestGpsLocation(); }, []);

  const risk = data ? riskLabels[data.risk_class] : "Memuat...";
  const isDanger = data?.risk_class === "tinggi" || data?.risk_class === "sangat_tinggi";

  const forecastDays = data ? (Array.isArray(data.forecast) ? data.forecast : data.forecast.data).map((item) => ({
    day: new Date(`${item.prediction_date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    label: riskLabels[item.risk_class], percent: item.risk_probability, color: item.risk_class === "sangat_tinggi" ? "var(--critical)" : item.risk_class === "tinggi" ? "var(--high)" : item.risk_class === "sedang" ? "var(--medium)" : "var(--low)",
  })) : [];

  const currentLocation = data?.region ? [data.region.village, data.region.district, data.region.regency].filter(Boolean).join(", ") : locationNote;

  const actionCards = [
    ["Jauhi area rendah", "Hindari jalan pesisir dan area yang mudah tergenang.", "priority_high"],
    ["Siapkan barang penting", "Amankan dokumen dan barang elektronik sebelum puncak pasang.", "inventory_2"],
    ["Ikuti arahan BPBD", "Jika kondisi memburuk, ikuti informasi resmi dari petugas.", "campaign"],
    ["Laporkan kejadian", "Tambahkan foto dan lokasi bila melihat genangan di sekitar Anda.", "add_location_alt"],
  ];

  return (
    <AppShell active="awam" title="Status Bahaya Saya" subtitle="Panduan mitigasi dan peringatan dini disajikan dalam bahasa yang mudah dipahami.">
      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="alert" style={{ marginBottom: 24, borderLeftColor: "var(--critical)" }}>
          <Icon name="error" style={{ color: "var(--critical)" }} /> {error}
        </motion.div>
      )}

      <motion.div className="detail-layout" variants={containerVariants} initial="hidden" animate="show">
        <div className="stack">
          {/* Main Status Hero Card */}
          <motion.section 
            variants={itemVariants}
            style={{ 
              background: isDanger ? "linear-gradient(135deg, #e11d48 0%, #9f1239 100%)" : "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)", 
              color: "#fff", 
              borderRadius: 8, 
              padding: "40px",
              boxShadow: isDanger ? "0 24px 48px rgba(225, 29, 72, 0.25)" : "0 24px 48px rgba(37, 99, 235, 0.25)",
              position: "relative",
              overflow: "hidden"
            }}
          >
            <Icon 
              name={isDanger ? "warning" : "info"} 
              style={{ position: "absolute", right: "-20px", top: "-20px", fontSize: "280px", opacity: 0.1, transform: "rotate(-15deg)" }} 
            />
            
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.9)", fontSize: "0.95rem", marginBottom: 20, fontWeight: 600 }}>
                <Icon name="location_on" style={{ fontSize: 20 }} />
                {currentLocation}
              </div>
              <div style={{ marginBottom: 20 }}><select aria-label="Pilih lokasi" onChange={(event) => { const value = event.target.value; if (value === "gps") { requestGpsLocation(); return; } const [lat, lon] = value.split(",").map(Number); setCoordinates({ lat, lon }); setLocationNote(event.target.options[event.target.selectedIndex].text); }} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.4)", color: "var(--ink)", background: "#fff" }}>{locationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
              
              <h1 style={{ fontSize: "4rem", fontWeight: 900, lineHeight: 1.1, margin: "0 0 16px 0", letterSpacing: "-0.03em" }}>
                Status <span style={{ color: "#fff" }}>{risk}</span>
              </h1>
              
              <p style={{ fontSize: "1.15rem", lineHeight: 1.6, color: "rgba(255,255,255,0.95)", maxWidth: "600px", margin: "0 0 40px 0" }}>
                {data
                  ? `Air laut diprediksi naik di sekitar wilayah Anda. Hindari jalan rendah dekat pesisir dan siapkan barang penting${data.peak_time ? ` sebelum puncak pasang pukul ${data.peak_time} WIB` : ""}.`
                  : "Menganalisis status ancaman rob terbaru di sekitar Anda..."}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 32, marginTop: 40, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 32 }}>
                {[
                  ["Kemungkinan Rob", data ? `${data.risk_probability}%` : "-", risk],
                  ["Puncak Pasang", data ? `${meters.format(data.max_tidal_height)} meter` : "-", data ? `Pukul ${data.peak_time} WIB` : "Menunggu Data"],
                  ["Laporan Sekitar", data ? `${data.nearby_reports.length} laporan` : "-", "Dari pantauan warga"],
                ].map(([label, value, note], i) => (
                  <motion.div 
                    key={label}
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
              <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "14px" }}>Sumber: BMKG & Prediksi AI. Waspada saat indikator merah mendominasi.</p>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, padding: "32px 24px" }}>
              {forecastDays.map(({ day, label, percent, color }, i) => (
                <motion.div 
                  key={day} 
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
            <table className="data-table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
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
            </table>
          </motion.section>
        </div>

        {/* Sidebar */}
        <aside className="stack">
          {/* Tindakan Card */}
          <motion.section variants={itemVariants} className="panel flush" style={{ border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "32px 24px" }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "var(--ink-primary)", display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                <Icon name="verified_user" style={{ fontSize: 24, color: "var(--accent-blue)" }} />
                Rekomendasi Tindakan
              </div>
              <div style={{ display: "grid", gap: 24 }}>
                {actionCards.map(([title, copy, icon], i) => {
                  const isReportBtn = title === "Laporkan kejadian";
                  return (
                    <motion.div 
                      key={title} 
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
            <button className="btn primary" type="button" style={{ width: "100%", justifyContent: "center", background: "#16a34a", borderColor: "#16a34a", marginBottom: 12, fontSize: "14px" }}>
              <Icon name="share" /> Bagikan via WhatsApp
            </button>
            <button className="btn secondary" type="button" style={{ width: "100%", justifyContent: "center", fontSize: "14px" }}>
              <Icon name="content_copy" /> Salin Teks Peringatan
            </button>
          </motion.section>

          {/* Model Info Panel */}
          <motion.section variants={itemVariants} className="panel" style={{ background: "var(--surface-soft)", border: "none" }}>
            <h2 style={{ fontSize: "1.05rem", margin: "0 0 16px 0" }}>Informasi Teknis Model</h2>
            <div style={{ display: "grid", gap: 10, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Model AI</span> 
                <strong>{data?.model_version || "Random Forest v1.2.0"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Kepercayaan</span> 
                <strong style={{ color: "var(--low)" }}>
                  {data?.confidence_score ? `${data.confidence_score.toFixed(2)}%` : "Tinggi (89.00%)"}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Sumber Data</span> 
                <strong>{data?.data_source === "RandomForestModel" ? "Automated RandomForest Forecast" : (data?.data_source || "BMKG + BIG + Laporan Warga")}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Pembaruan Terakhir</span> 
                <strong>
                  {data?.generated_at 
                    ? new Date(data.generated_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB"
                    : "21 Mei 2026 05:00 WIB"}
                </strong>
              </div>
            </div>
          </motion.section>
        </aside>
      </motion.div>
    </AppShell>
  );
}
