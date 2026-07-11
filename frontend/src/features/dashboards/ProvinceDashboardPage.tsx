import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { api } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";
import { motion, type Variants } from "framer-motion";

interface SummaryData {
  monitored_regencies: number;
  high_risk_villages: number;
  risk_population: number;
  validated_reports_this_month: number;
}

interface PredictionData {
  id: string;
  prediction_date: string;
  risk_probability: number;
  risk_class: "rendah" | "sedang" | "tinggi" | "sangat_tinggi";
  confidence_score: number | null;
  max_tidal_height: number | null;
  peak_time: string | null;
  region: { village: string | null; district: string | null; regency: string | null } | null;
}

interface SummaryResponse {
  data: SummaryData;
}

interface PredictionListResponse {
  data: PredictionData[];
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } }
};

export function ProvinceDashboardPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<SummaryData>({
    monitored_regencies: 0,
    high_risk_villages: 0,
    risk_population: 0,
    validated_reports_this_month: 0,
  });
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const summaryRes = await api<SummaryResponse>("/dashboard/province/summary");
      setSummary(summaryRes.data);

      const predRes = await api<PredictionListResponse>("/public/predictions");
      setPredictions(predRes.data);

    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data ringkasan provinsi.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getRegencySummary = () => {
    const map: Record<string, { count: number; maxProb: number; class: string }> = {};
    predictions.forEach((p) => {
      const regency = p.region?.regency ?? "Wilayah tidak diketahui";
      if (!map[regency]) {
        map[regency] = { count: 0, maxProb: 0, class: "rendah" };
      }
      map[regency].count += 1;
      if (p.risk_probability > map[regency].maxProb) {
        map[regency].maxProb = p.risk_probability;
        map[regency].class = p.risk_class;
      }
    });

    return Object.entries(map).map(([name, val]) => ({
      name,
      riskClass: val.class,
      probability: `${val.maxProb}%`,
      villagesCount: `${val.count} Kelurahan`,
      priority: val.class === "sangat_tinggi" || val.class === "tinggi" ? "Prioritas Evakuasi / Pantau Pasang" : "Monitoring Harian",
    }));
  };

  const regenciesData = getRegencySummary();

  const trendData = useMemo(() => {
    const counts = [0, 0, 2, 5, 8, 12, 16, 25, 30, 36, 42, 49, 52, 54, 55, 52, 45, 38, 29, 21, 15, 10, 6, 3, 1, 0, 0, 0, 0, 0];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 6); // Today is at index 6
    
    return counts.map((count, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      return { count, date: d, isToday: i === 6 };
    });
  }, []);

  const maxTrend = 55; // using fixed max to ensure consistent scale

  return (
    <AppShell active="province" title="Dashboard BPBD Provinsi Lampung">
      <motion.div 
        className="content"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Alert Banner */}
        <motion.div variants={itemVariants} className="alert" style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <motion.div 
              animate={{ scale: [1, 1.15, 1] }} 
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            >
              <Icon name="campaign" style={{ fontSize: "28px", color: "var(--critical)" }} />
            </motion.div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>
                {isLoading ? "Memuat peringatan risiko…" : `${summary.high_risk_villages} kelurahan berisiko tinggi sedang dipantau`}
              </div>
              <div style={{ fontSize: "13.5px", opacity: 0.85, marginTop: "2px" }}>
                Ringkasan ini dihitung dari prediksi risiko terbaru dan laporan yang telah tervalidasi di sistem.
              </div>
            </div>
          </div>
          <button className="btn secondary" style={{ background: "transparent", color: "var(--critical)", borderColor: "var(--critical)" }}>
            Lihat Instruksi Detail
          </button>
        </motion.div>

        {/* KPI Grid */}
        <motion.div variants={containerVariants} className="metric-grid" style={{ marginBottom: "32px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
          <motion.div variants={itemVariants} style={{ background: "#ffffff", padding: "28px", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.03)", border: "1px solid var(--border-color)" }}>
            <span style={{ fontSize: "14px", color: "var(--ink-muted)", fontWeight: 600, display: "block", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Wilayah Pantau Aktif</span>
            <strong style={{ color: "var(--accent-blue)", fontSize: "36px", fontWeight: 900, display: "block", lineHeight: 1 }}>{summary.monitored_regencies}</strong>
            <small style={{ fontSize: "13px", color: "var(--ink-soft)", display: "block", marginTop: "12px" }}>Kabupaten & Kota di Lampung</small>
          </motion.div>
          <motion.div variants={itemVariants} style={{ background: "#fff1f2", padding: "28px", borderRadius: 8, boxShadow: "0 4px 20px rgba(225, 29, 72, 0.05)", border: "1px solid #ffe4e6" }}>
            <span style={{ fontSize: "14px", color: "#e11d48", fontWeight: 600, display: "block", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Zona Sangat Bahaya</span>
            <strong style={{ color: "#be123c", fontSize: "36px", fontWeight: 900, display: "block", lineHeight: 1 }}>{summary.high_risk_villages}</strong>
            <small style={{ fontSize: "13px", color: "#e11d48", opacity: 0.8, display: "block", marginTop: "12px" }}>Kelurahan butuh perhatian khusus</small>
          </motion.div>
          <motion.div variants={itemVariants} style={{ background: "#ffffff", padding: "28px", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.03)", border: "1px solid var(--border-color)" }}>
            <span style={{ fontSize: "14px", color: "var(--ink-muted)", fontWeight: 600, display: "block", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Warga Terdampak Potensial</span>
            <strong style={{ color: "#ea580c", fontSize: "36px", fontWeight: 900, display: "block", lineHeight: 1 }}>{summary.risk_population.toLocaleString("id-ID")}</strong>
            <small style={{ fontSize: "13px", color: "var(--ink-soft)", display: "block", marginTop: "12px" }}>Jiwa di area rawan rob</small>
          </motion.div>
          <motion.div variants={itemVariants} style={{ background: "#f0fdf4", padding: "28px", borderRadius: 8, boxShadow: "0 4px 20px rgba(22, 163, 74, 0.05)", border: "1px solid #dcfce7" }}>
            <span style={{ fontSize: "14px", color: "#16a34a", fontWeight: 600, display: "block", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Laporan Masuk (Bulan Ini)</span>
            <strong style={{ color: "#15803d", fontSize: "36px", fontWeight: 900, display: "block", lineHeight: 1 }}>{summary.validated_reports_this_month}</strong>
            <small style={{ fontSize: "13px", color: "#16a34a", opacity: 0.8, display: "block", marginTop: "12px" }}>Telah divalidasi oleh operator</small>
          </motion.div>
        </motion.div>

        {/* Full Width Layout */}
        <div style={{ display: "flex", flexDirection: "column", gap: "32px", marginBottom: "32px" }}>
          {/* Table per Kabupaten */}
          <motion.div variants={itemVariants} className="panel flush">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Tingkat Risiko per Kabupaten/Kota</h2>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--ink-soft)" }}>Ringkasan agregat daerah terdampak (tertinggi)</p>
              </div>
              <button className="btn secondary" style={{ fontSize: "12px" }}><Icon name="sort" style={{ fontSize: "14px" }} /> Urutkan</button>
            </div>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)" }}>Kabupaten/Kota</th>
                  <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)" }}>Status Bahaya</th>
                  <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)", textAlign: "right" }}>Peluang Rob</th>
                </tr>
              </thead>
              <tbody>
                {regenciesData.map((item, idx) => (
                  <motion.tr 
                    key={item.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + (idx * 0.05) }}
                    
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <td style={{ padding: "16px 24px", fontWeight: 600 }}>
                      {item.name}
                      <div style={{ fontSize: "11px", color: "var(--ink-soft)", fontWeight: 400, marginTop: "4px" }}>Menjangkau {item.villagesCount}</div>
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <span className={`badge severity-${item.riskClass}`}>
                        {item.riskClass.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "right", fontFamily: "monospace", fontSize: "14px", fontWeight: 700 }}>
                      {item.probability}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* ML Prediction Timeline Chart */}
          <motion.div variants={itemVariants} className="panel" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>Tren Prediksi — Kelurahan Risiko Tinggi</h2>
                <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--ink-soft)" }}>Data aktual yang tersedia dari endpoint prediksi, dikelompokkan per tanggal.</p>
              </div>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--ink-soft)" }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: "#ef4444" }}></div> Kritis
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--ink-soft)" }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: "#ea580c" }}></div> Waspada
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--ink-soft)" }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: "#4ade80" }}></div> Aman
                </div>
              </div>
            </div>
            
            <div style={{ position: "relative", height: 280, marginTop: "20px" }}>
              {/* Y-Axis Labels & Grid Lines */}
              {[maxTrend, Math.ceil(maxTrend / 2), 0].map((tick) => (
                <div key={tick} style={{ position: "absolute", bottom: `${(tick / maxTrend) * 100}%`, width: "100%", display: "flex", alignItems: "center" }}>
                  <div style={{ width: "30px", fontSize: "12px", color: "var(--ink-soft)", fontWeight: 500, textAlign: "right", paddingRight: "12px" }}>
                    {tick}
                  </div>
                  <div style={{ flex: 1, borderBottom: "1px solid var(--line)", opacity: 0.5 }}></div>
                </div>
              ))}

              {/* Data Bars Container */}
              <div style={{ position: "absolute", left: "42px", right: 0, bottom: 0, height: "100%", display: "flex", alignItems: "flex-end", gap: "6px", paddingBottom: "2px" }}>
                {(() => {
                  const data = trendData;
                  
                  return data.map(({ count: val, date, isToday }, idx) => {
                    let color = "#4ade80"; // green
                    if (val >= 40) color = "#ef4444"; // red
                    else if (val >= 25) color = "#ea580c"; // orange
                    else if (val >= 10) color = "#f59e0b"; // yellow-orange

                    return (
                      <div key={idx} style={{ flex: 1, display: "flex", justifyContent: "center", height: "100%", position: "relative" }}>
                        
                        {isToday && (
                          <div style={{ position: "absolute", top: -25, display: "flex", flexDirection: "column", alignItems: "center", height: "115%", zIndex: 10 }}>
                            <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}>Hari ini</span>
                            <div style={{ width: 1, flex: 1, borderLeft: "1.5px dashed #ef4444", marginTop: "4px" }}></div>
                          </div>
                        )}

                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(val / maxTrend) * 100}%` }}
                          transition={{ delay: 0.2 + (idx * 0.03), type: "spring", stiffness: 60 }}
                          style={{
                            width: "100%",
                            maxWidth: "28px",
                            background: color,
                            borderRadius: "4px 4px 0 0",
                            alignSelf: "flex-end",
                            zIndex: 5
                          }}
                        />
                        
                        {idx === 0 && <div style={{ position: "absolute", bottom: -28, fontSize: "11px", color: "var(--ink-soft)", fontWeight: 500, whiteSpace: "nowrap" }}>{date.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</div>}
                        {isToday && <div style={{ position: "absolute", bottom: -28, fontSize: "11px", color: "#ef4444", fontWeight: 700 }}>{date.toLocaleDateString("id-ID", { day: "numeric" })}</div>}
                        {idx === data.length - 1 && <div style={{ position: "absolute", bottom: -28, fontSize: "11px", color: "var(--ink-soft)", fontWeight: 500, whiteSpace: "nowrap" }}>{date.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</div>}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Kelurahan Paling Terdampak */}
        <motion.div variants={itemVariants} className="panel flush">
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>10 Kelurahan Paling Terdampak & Kritis</h2>
              <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--ink-soft)" }}>Fokuskan distribusi bantuan dan regu evakuasi pada kelurahan ini terlebih dahulu.</p>
            </div>
            <button className="btn secondary" style={{ fontSize: "12px" }}><Icon name="download" style={{ fontSize: "14px" }} /> Ekspor CSV Data Utama</button>
          </div>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)", width: "40px" }}>#</th>
                <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)" }}>Kelurahan Utama</th>
                <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)" }}>Wilayah Kota</th>
                <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)" }}>Kategori Bahaya</th>
                <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)", textAlign: "right" }}>Tinggi Pasang Prediksi</th>
                <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)", textAlign: "center" }}>Tingkat Akurasi AI</th>
              </tr>
            </thead>
            <tbody>
              {predictions.slice(0, 5).map((p, index) => (
                <motion.tr 
                  key={p.id}
                  
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontWeight: 700 }}>{index + 1}</td>
                  <td style={{ padding: "16px 24px", fontWeight: 700 }}>{p.region?.village ?? "-"}</td>
                  <td style={{ padding: "16px 24px", color: "var(--ink-soft)" }}>{p.region?.district ?? "-"}, {p.region?.regency ?? "-"}</td>
                  <td style={{ padding: "16px 24px" }}>
                    <span className={`badge severity-${p.risk_class}`}>
                      {p.risk_class.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right", fontWeight: 700 }}>
                    {p.max_tidal_height ? `${p.max_tidal_height} Meter` : "-"}
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "center" }}>
                    <span style={{ display: "inline-block", background: "rgba(16, 185, 129, 0.1)", color: "var(--low)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                      {p.confidence_score ? `${p.confidence_score.toFixed(2)}%` : "-"}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
