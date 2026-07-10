import { useEffect, useState } from "react";
import { api } from "../../shared/api/client";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { motion } from "framer-motion";
import type { RiskClass } from "../../shared/types/domain";

type ModeAwamData = {
  risk_class: RiskClass;
  risk_probability: number;
  max_tidal_height: number;
  peak_time: string;
  nearby_reports: unknown[];
};

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

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function CitizenModePage() {
  const [data, setData] = useState<ModeAwamData>();
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    api<ModeAwamResponse>("/public/mode-awam")
      .then((response) => {
        if (alive) setData(response.data);
      })
      .catch(() => {
        if (alive) setError("Data status bahaya belum bisa dimuat. Coba lagi sebentar.");
      });

    return () => {
      alive = false;
    };
  }, []);

  const risk = data ? riskLabels[data.risk_class] : "Memuat...";
  const isDanger = data?.risk_class === "tinggi" || data?.risk_class === "sangat_tinggi";

  const forecastDays = [
    ["21 Mei", "S.Tinggi", "87%", "var(--critical)"],
    ["22 Mei", "Tinggi", "74%", "var(--high)"],
    ["23 Mei", "Tinggi", "68%", "var(--high)"],
    ["24 Mei", "Sedang", "45%", "var(--medium)"],
    ["25 Mei", "Rendah", "24%", "var(--low)"],
    ["26 Mei", "Rendah", "18%", "var(--low)"],
    ["27 Mei", "Rendah", "12%", "var(--low)"],
  ];

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
              background: isDanger ? "linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)" : "linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)", 
              color: "#fff", 
              borderRadius: "24px", 
              padding: "36px",
              boxShadow: isDanger ? "0 20px 40px rgba(185, 28, 28, 0.2)" : "0 20px 40px rgba(29, 78, 216, 0.2)",
              position: "relative",
              overflow: "hidden"
            }}
          >
            <Icon 
              name={isDanger ? "warning" : "info"} 
              style={{ position: "absolute", right: "-20px", top: "-20px", fontSize: "240px", opacity: 0.08, transform: "rotate(-15deg)" }} 
            />
            
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 16, fontWeight: 600 }}>
                <Icon name="location_on" style={{ fontSize: 18 }} />
                Telukbetung Selatan, Bandar Lampung
              </div>
              
              <h1 style={{ fontSize: "3.5rem", fontWeight: 900, lineHeight: 1.1, margin: "0 0 16px 0", letterSpacing: "-0.03em" }}>
                Status <span style={{ color: isDanger ? "#fca5a5" : "#93c5fd" }}>{risk}</span>
              </h1>
              
              <p style={{ fontSize: "1.1rem", lineHeight: 1.6, color: "rgba(255,255,255,0.9)", maxWidth: "600px", margin: "0 0 32px 0" }}>
                {data
                  ? `Air laut diprediksi naik secara signifikan malam ini. Hindari jalan rendah dekat pesisir dan siapkan barang penting Anda sebelum puncak pasang pukul ${data.peak_time} WIB.`
                  : "Menganalisis status ancaman rob terbaru di sekitar Anda..."}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
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
                    style={{ background: "rgba(0,0,0,0.2)", borderRadius: 16, padding: 16, border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(10px)" }}
                  >
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 8, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, marginBottom: 6 }}>{value}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{note}</div>
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
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 12, padding: "24px" }}>
              {forecastDays.map(([day, label, percent, color], i) => (
                <motion.div 
                  key={day} 
                  whileHover={{ y: -5 }}
                  style={{ textAlign: "center", padding: "16px 8px", background: "var(--surface-soft)", borderRadius: 16, border: "1px solid var(--line)", display: "flex", flexDirection: "column", alignItems: "center" }}
                >
                  <div style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600, marginBottom: 8 }}>{day}</div>
                  <div style={{ height: 100, width: 8, borderRadius: 999, background: "var(--line)", position: "relative", margin: "8px 0" }}>
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: percent }}
                      transition={{ delay: 0.5 + (i * 0.05), duration: 0.8, type: "spring" }}
                      style={{ position: "absolute", bottom: 0, left: 0, width: "100%", background: color, borderRadius: 999 }} 
                    />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: color as string, marginTop: 8 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{percent}</div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Laporan Warga Sekitar */}
          <motion.section variants={itemVariants} className="panel flush">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", margin: 0, marginBottom: 4 }}>Laporan Warga di Sekitar Anda</h2>
                <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: "14px" }}>Informasi lapangan dari masyarakat untuk meningkatkan kewaspadaan.</p>
              </div>
              <a className="btn secondary" href="#/reports">Laporkan Genangan</a>
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
                {[
                  ["Panjang Utara", "Sangat Tinggi", "09:10", "Divalidasi BPBD"],
                  ["Teluk Betung", "Tinggi", "08:45", "Divalidasi BPBD"],
                  ["Kota Karang", "Sedang", "07:52", "Menunggu Tim"],
                ].map(([region, severity, time, status]) => (
                  <tr key={region} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "16px 24px", fontWeight: 600, color: "var(--ink)" }}>{region}</td>
                    <td style={{ padding: "16px 24px" }}>
                      <span className={`badge severity-${severity === "Sangat Tinggi" ? "sangat_parah" : severity === "Tinggi" ? "parah" : "sedang"}`}>
                        {severity}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontSize: "14px" }}>{time} WIB</td>
                    <td style={{ padding: "16px 24px" }}>
                      <span className={`badge status-${status === "Menunggu Tim" ? "menunggu" : "divalidasi"}`}>
                        <Icon name={status === "Menunggu Tim" ? "pending" : "verified"} style={{ fontSize: 14 }} /> {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.section>
        </div>

        {/* Sidebar */}
        <aside className="stack">
          {/* Tindakan Card */}
          <motion.section variants={itemVariants} className="panel flush">
            <div style={{ padding: "20px", background: isDanger ? "#fef2f2" : "#eff6ff", borderBottom: `1px solid ${isDanger ? "#fecaca" : "#bfdbfe"}` }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: isDanger ? "#991b1b" : "#1e40af", display: "flex", alignItems: "center", gap: 8 }}>
                <Icon name="verified_user" style={{ fontSize: 20 }} />
                Rekomendasi Tindakan
              </div>
            </div>
            <div style={{ padding: "20px", display: "grid", gap: 12 }}>
              {actionCards.map(([title, copy, icon], i) => {
                const isReportBtn = title === "Laporkan kejadian";
                return (
                  <motion.div 
                    key={title} 
                    whileHover={{ x: 4, backgroundColor: "var(--surface-soft)" }}
                    style={{ 
                      border: "1px solid var(--line)", 
                      borderRadius: 16, 
                      padding: "16px", 
                      display: "flex", 
                      gap: 16, 
                      alignItems: "flex-start",
                      background: isReportBtn ? "var(--surface-soft)" : "var(--surface)",
                      cursor: isReportBtn ? "pointer" : "default"
                    }}
                    onClick={() => isReportBtn && (window.location.hash = "#/reports")}
                  >
                    <div style={{ 
                      width: 42, 
                      height: 42, 
                      borderRadius: 12, 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      background: title === "Jauhi area rendah" ? "#fee2e2" : title === "Siapkan barang penting" ? "#fef3c7" : title === "Ikuti arahan BPBD" ? "#dbeafe" : "#d1fae5", 
                      color: title === "Jauhi area rendah" ? "#b91c1c" : title === "Siapkan barang penting" ? "#b45309" : title === "Ikuti arahan BPBD" ? "#1d4ed8" : "#047857",
                      flexShrink: 0
                    }}>
                      <Icon name={icon} style={{ fontSize: 22 }} />
                    </div>
                    <div>
                      <strong style={{ display: "block", marginBottom: 6, fontSize: "14px", color: "var(--ink)" }}>{title}</strong>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.5 }}>{copy}</p>
                    </div>
                  </motion.div>
                );
              })}
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
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Model AI</span> <strong>Random Forest v1.2.0</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Kepercayaan</span> <strong style={{ color: "var(--low)" }}>Tinggi (0.89)</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Sumber Data</span> <strong>BMKG + BIG + Laporan Warga</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Pembaruan Terakhir</span> <strong>21 Mei 2026 05:00 WIB</strong></div>
            </div>
          </motion.section>
        </aside>
      </motion.div>
    </AppShell>
  );
}
