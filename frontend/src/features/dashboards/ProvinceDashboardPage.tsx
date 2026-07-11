import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { api } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";
import { motion } from "framer-motion";
import { getLampungMarineData, TideDataPoint, getMLPrediction } from "../../shared/api/weatherClient";

interface SummaryData {
  monitored_regencies: number;
  high_risk_villages: number;
  risk_population: number;
  validated_reports_this_month: number;
}

interface PredictionData {
  id: string;
  region_id: string;
  prediction_date: string;
  risk_probability: number;
  risk_class: "rendah" | "sedang" | "tinggi" | "sangat_tinggi";
  confidence_score: number | null;
  max_tidal_height: number | null;
  peak_time: string | null;
  village: string;
  district: string;
  regency: string;
}

interface SummaryResponse {
  data: SummaryData;
}

interface PredictionListResponse {
  data: PredictionData[];
}

const containerVariants: any = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } }
};

const itemVariants: any = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } }
};

export function ProvinceDashboardPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<SummaryData>({
    monitored_regencies: 15,
    high_risk_villages: 42,
    risk_population: 284000,
    validated_reports_this_month: 1204,
  });
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [tideData, setTideData] = useState<TideDataPoint[]>([]);
  const [mlData, setMlData] = useState<number[]>([8, 12, 15, 20, 26, 34, 49, 45, 41, 34, 26, 20, 14, 8, 4, 3, 2, 3, 4, 7, 10, 12, 15, 11, 9, 6]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const summaryRes = await api<SummaryResponse>("/dashboard/province/summary");
      setSummary(summaryRes.data);

      const predRes = await api<PredictionListResponse>("/public/predictions");
      setPredictions(predRes.data);

      const marineData = await getLampungMarineData();
      setTideData(marineData);

      const predictionData = await getMLPrediction();
      if (predictionData && predictionData.length > 0) {
        setMlData(predictionData);
      }
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
      if (!map[p.regency]) {
        map[p.regency] = { count: 0, maxProb: 0, class: "rendah" };
      }
      map[p.regency].count += 1;
      if (p.risk_probability > map[p.regency].maxProb) {
        map[p.regency].maxProb = p.risk_probability;
        map[p.regency].class = p.risk_class;
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
  const chartData = [22, 31, 38, 34, 42, 47, summary.high_risk_villages];

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
                Siaga 1: Peringatan Dini BMKG Aktif Hari Ini
              </div>
              <div style={{ fontSize: "13.5px", opacity: 0.85, marginTop: "2px" }}>
                Diprediksi terjadi pasang laut maksimum di pesisir Teluk Lampung. Seluruh Posko BPBD harap bersiaga penuh.
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
            <div className="table-responsive">
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
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
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
            </div>
          </motion.div>

          {/* ML Prediction Timeline Chart */}
          <motion.div variants={itemVariants} className="panel" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700, color: "var(--ink)" }}>Prediksi 30 Hari — Jumlah Kelurahan Sangat Tinggi</h2>
                <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--ink-soft)" }}>Model Machine Learning (AI) memprediksi lonjakan pasang maksimum di minggu ketiga.</p>
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
              {[50, 30, 10, 0].map((tick) => (
                <div key={tick} style={{ position: "absolute", bottom: `${(tick / 55) * 100}%`, width: "100%", display: "flex", alignItems: "center" }}>
                  <div style={{ width: "30px", fontSize: "12px", color: "var(--ink-soft)", fontWeight: 500, textAlign: "right", paddingRight: "12px" }}>
                    {tick}
                  </div>
                  <div style={{ flex: 1, borderBottom: "1px solid var(--line)", opacity: 0.5 }}></div>
                </div>
              ))}

              {/* Data Bars Container */}
              <div style={{ position: "absolute", left: "42px", right: 0, bottom: 0, height: "100%", display: "flex", alignItems: "flex-end", gap: "6px", paddingBottom: "2px" }}>
                {(() => {
                  const data = mlData;
                  const todayIndex = 6; // Peak at 49
                  
                  return data.map((val, idx) => {
                    let color = "#4ade80"; // green
                    if (val >= 40) color = "#ef4444"; // red
                    else if (val >= 25) color = "#ea580c"; // orange
                    else if (val >= 10) color = "#f59e0b"; // yellow-orange

                    const isToday = idx === todayIndex;

                    return (
                      <div key={idx} style={{ flex: 1, display: "flex", justifyContent: "center", height: "100%", position: "relative" }}>
                        
                        {/* Hari ini Marker */}
                        {isToday && (
                          <div style={{ position: "absolute", top: -25, display: "flex", flexDirection: "column", alignItems: "center", height: "115%", zIndex: 10 }}>
                            <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}>Hari ini</span>
                            <div style={{ width: 1, flex: 1, borderLeft: "1.5px dashed #ef4444", marginTop: "4px" }}></div>
                          </div>
                        )}

                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(val / 55) * 100}%` }}
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
                        
                        {/* X-Axis Labels placed exactly under specific bars */}
                        {idx === 0 && <div style={{ position: "absolute", bottom: -28, fontSize: "12px", color: "var(--ink-soft)", fontWeight: 500, whiteSpace: "nowrap" }}>1 Mei</div>}
                        {idx === todayIndex && <div style={{ position: "absolute", bottom: -28, fontSize: "12px", color: "#ef4444", fontWeight: 700 }}>21</div>}
                        {idx === 14 && <div style={{ position: "absolute", bottom: -28, fontSize: "12px", color: "var(--ink-soft)", fontWeight: 500, whiteSpace: "nowrap" }}>Mei 30</div>}
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
          <div className="table-responsive">
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
                  <td style={{ padding: "16px 24px", fontWeight: 700 }}>{p.village}</td>
                  <td style={{ padding: "16px 24px", color: "var(--ink-soft)" }}>{p.district}, {p.regency}</td>
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
                      {p.confidence_score ? `${(p.confidence_score / 100).toFixed(2)}` : "0.80"}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          </div>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
