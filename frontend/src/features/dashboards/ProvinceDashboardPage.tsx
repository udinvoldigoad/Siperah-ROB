import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { api, apiUrl } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";
import { motion, type Variants } from "framer-motion";

interface SummaryData {
  monitored_regencies: number;
  high_risk_villages: number;
  risk_population: number;
  validated_reports_this_month: number;
  latest_prediction_date?: string | null;
  regencies?: RegencySummary[];
  trend_30_days?: { prediction_date: string; high_risk_count: number }[];
  filters?: { month?: string | null; regency?: string | null };
  available_regencies?: string[];
  top_impacted?: TopImpactedPrediction[];
  population_audit?: {
    total_regions: number;
    with_population: number;
    official_bps_population: number;
    missing_population: number;
    status: "bps_verified" | "region_population_available" | "incomplete";
  };
}

interface RegencySummary {
  regency: string;
  low_count: number;
  medium_count: number;
  high_count: number;
  critical_count: number;
  risk_population: number;
  max_probability: number;
  trend: string;
  previous_high_risk_count?: number;
  high_risk_delta?: number;
}

interface TopImpactedPrediction {
  id: string;
  prediction_date: string;
  risk_probability: number;
  risk_class: "rendah" | "sedang" | "tinggi" | "sangat_tinggi";
  confidence_score: number | null;
  max_tidal_height: number | null;
  village: string | null;
  district: string | null;
  regency: string | null;
  population: number | null;
  population_source?: string | null;
  population_provenance_status?: string | null;
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

function toNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ProvinceDashboardPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<SummaryData>({
    monitored_regencies: 0,
    high_risk_villages: 0,
    risk_population: 0,
    validated_reports_this_month: 0,
    regencies: [],
    trend_30_days: [],
  });
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedRegency, setSelectedRegency] = useState("all");
  const [sortKey, setSortKey] = useState<"risk" | "probability" | "population" | "name" | "trend">("risk");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.set("month", selectedMonth);
      if (selectedRegency !== "all") params.set("regency", selectedRegency);
      const query = params.toString() ? `?${params.toString()}` : "";
      const summaryRes = await api<SummaryResponse>(`/dashboard/province/summary${query}`);
      setSummary(summaryRes.data);

      const predRes = await api<PredictionListResponse>(`/public/predictions${selectedRegency !== "all" ? `?regency=${encodeURIComponent(selectedRegency)}` : ""}`);
      setPredictions(predRes.data);

    } catch (err: any) {
      toast.error(err.message || "Gagal memuat data ringkasan provinsi.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth, selectedRegency]);

  const handleProvinceExport = async () => {
    try {
      const token = localStorage.getItem("siperah-token");
      const params = new URLSearchParams();
      if (selectedMonth) params.set("month", selectedMonth);
      if (selectedRegency !== "all") params.set("regency", selectedRegency);
      const response = await fetch(apiUrl(`/api/dashboard/province/export${params.toString() ? `?${params.toString()}` : ""}`), {
        headers: {
          Accept: "text/csv",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error(`Export gagal (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "dashboard-provinsi-risiko.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Export CSV provinsi mulai diunduh.");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengekspor CSV provinsi.");
    }
  };

  const riskBadgeClass = (riskClass: string) => {
    if (riskClass === "sangat_tinggi") return "sangat_parah";
    if (riskClass === "tinggi") return "parah";
    if (riskClass === "rendah") return "ringan";
    return riskClass;
  };

  const getRegencySummary = () => {
    if (summary.regencies?.length) {
      return summary.regencies.map((item) => {
        const riskClass = item.critical_count > 0 ? "sangat_tinggi" : item.high_count > 0 ? "tinggi" : item.medium_count > 0 ? "sedang" : "rendah";
        return {
          name: item.regency,
          riskClass,
          probability: `${Number(item.max_probability ?? 0).toFixed(0)}%`,
          villagesCount: `${Number(item.low_count) + Number(item.medium_count) + Number(item.high_count) + Number(item.critical_count)} Kelurahan`,
          riskPopulation: toNumber(item.risk_population),
          maxProbability: toNumber(item.max_probability),
          highRiskCount: toNumber(item.high_count) + toNumber(item.critical_count),
          delta: toNumber(item.high_risk_delta),
          priority: item.trend === "naik" ? "Prioritas koordinasi" : item.trend === "turun" ? "Risiko menurun" : "Monitoring Harian",
          trend: item.trend,
        };
      });
    }

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
      riskPopulation: 0,
      maxProbability: val.maxProb,
      highRiskCount: val.class === "sangat_tinggi" || val.class === "tinggi" ? val.count : 0,
      delta: 0,
      trend: val.class === "sangat_tinggi" || val.class === "tinggi" ? "naik" : "stabil",
      priority: val.class === "sangat_tinggi" || val.class === "tinggi" ? "Prioritas Evakuasi / Pantau Pasang" : "Monitoring Harian",
    }));
  };

  const regenciesData = useMemo(() => {
    const riskRank: Record<string, number> = { rendah: 1, sedang: 2, tinggi: 3, sangat_tinggi: 4 };
    const trendRank: Record<string, number> = { turun: 1, stabil: 2, naik: 3 };
    const rows = getRegencySummary();
    return rows.sort((a, b) => {
      const direction = sortDirection === "desc" ? -1 : 1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * direction;
      if (sortKey === "probability") return (a.maxProbability - b.maxProbability) * direction;
      if (sortKey === "population") return (a.riskPopulation - b.riskPopulation) * direction;
      if (sortKey === "trend") return ((trendRank[a.trend] ?? 0) - (trendRank[b.trend] ?? 0)) * direction;
      return ((riskRank[a.riskClass] ?? 0) - (riskRank[b.riskClass] ?? 0) || a.maxProbability - b.maxProbability) * direction;
    });
  }, [summary.regencies, predictions, sortKey, sortDirection]);

  const trendData = useMemo(() => {
    const counts = predictions.reduce<Record<string, number>>((acc, prediction) => {
      if (prediction.risk_class === "tinggi" || prediction.risk_class === "sangat_tinggi") {
        acc[prediction.prediction_date] = (acc[prediction.prediction_date] ?? 0) + 1;
      }
      return acc;
    }, {});

    (summary.trend_30_days ?? []).forEach((item) => {
      counts[item.prediction_date] = toNumber(item.high_risk_count);
    });

    const endDateKey = summary.latest_prediction_date
      ?? Object.keys(counts).sort((a, b) => a.localeCompare(b)).at(-1)
      ?? toDateKey(new Date());
    const endDate = new Date(`${endDateKey}T00:00:00`);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 29);

    if (Number.isNaN(endDate.getTime())) {
      const today = new Date();
      return Array.from({ length: 30 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - 29 + index);
        return { count: 0, date, isToday: index === 29 };
      });
    }

    return Array.from({ length: 30 }, (_, index) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + index);
      const key = toDateKey(d);
      return { count: toNumber(counts[key]), date: d, isToday: key === endDateKey };
    });
  }, [predictions, summary.latest_prediction_date, summary.trend_30_days]);

  const maxTrend = Math.max(1, ...trendData.map((item) => item.count));

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
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} style={{ minWidth: 150 }} />
            <select value={selectedRegency} onChange={(event) => setSelectedRegency(event.target.value)} style={{ minWidth: 220 }}>
              <option value="all">Semua kabupaten/kota</option>
              {(summary.available_regencies ?? []).map((regency) => <option key={regency} value={regency}>{regency}</option>)}
            </select>
            <button className="btn secondary" style={{ background: "transparent", color: "var(--critical)", borderColor: "var(--critical)" }} onClick={() => { setSelectedMonth(""); setSelectedRegency("all"); }}>
              Reset Filter
            </button>
          </div>
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
            <strong style={{ color: "#ea580c", fontSize: "36px", fontWeight: 900, display: "block", lineHeight: 1 }}>{toNumber(summary.risk_population).toLocaleString("id-ID")}</strong>
            <small style={{ fontSize: "13px", color: "var(--ink-soft)", display: "block", marginTop: "12px" }}>
              {summary.population_audit?.status === "bps_verified" ? "BPS terverifikasi" : summary.population_audit?.status === "region_population_available" ? "Berdasarkan data region" : "Data populasi belum lengkap"}
            </small>
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
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--ink-soft)" }}>
                  Ringkasan prediksi terbaru {summary.latest_prediction_date ? `per ${new Date(summary.latest_prediction_date).toLocaleDateString("id-ID")}` : ""}; tren = perubahan jumlah zona tinggi+ dari tanggal prediksi sebelumnya.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={sortKey} onChange={(event) => setSortKey(event.target.value as typeof sortKey)} style={{ minWidth: 170 }}>
                  <option value="risk">Bahaya tertinggi</option>
                  <option value="probability">Peluang rob</option>
                  <option value="population">Populasi risiko</option>
                  <option value="trend">Tren</option>
                  <option value="name">Nama wilayah</option>
                </select>
                <button className="btn secondary" style={{ fontSize: "12px" }} onClick={() => setSortDirection((value) => value === "desc" ? "asc" : "desc")}>
                  <Icon name="sort" style={{ fontSize: "14px" }} /> {sortDirection === "desc" ? "Turun" : "Naik"}
                </button>
              </div>
            </div>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--surface-soft)", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)" }}>Kabupaten/Kota</th>
                  <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)" }}>Status Bahaya</th>
                  <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)", textAlign: "right" }}>Peluang Rob</th>
                  <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)", textAlign: "right" }}>Populasi Risiko</th>
                  <th style={{ padding: "14px 24px", fontSize: "12px", color: "var(--ink-soft)", textAlign: "right" }}>Tren</th>
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
                      <span className={`badge severity-${riskBadgeClass(item.riskClass)}`}>
                        {item.riskClass.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "right", fontFamily: "monospace", fontSize: "14px", fontWeight: 700 }}>
                      {item.probability}
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "right", fontFamily: "monospace", fontSize: "14px", fontWeight: 700 }}>
                      {item.riskPopulation.toLocaleString("id-ID")}
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                      <span className={`badge ${item.trend === "naik" ? "severity-parah" : item.trend === "turun" ? "severity-ringan" : "severity-sedang"}`}>
                        {item.trend} {item.delta !== 0 ? `(${item.delta > 0 ? "+" : ""}${item.delta})` : ""}
                      </span>
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
                        
                        {[0, 14, data.length - 1].includes(idx) && !isToday && (
                          <div style={{ position: "absolute", bottom: -28, fontSize: "11px", color: "var(--ink-soft)", fontWeight: 500, whiteSpace: "nowrap" }}>
                            {date.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                          </div>
                        )}
                        {isToday && (
                          <div style={{ position: "absolute", bottom: -28, fontSize: "11px", color: "#ef4444", fontWeight: 700, whiteSpace: "nowrap" }}>
                            {date.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                          </div>
                        )}
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
              <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--ink-soft)" }}>
                Berdasarkan prediksi terbaru, kelas risiko, peluang rob, dan populasi region. Filter mengikuti pilihan bulan/kabupaten di atas.
              </p>
            </div>
            <button className="btn secondary" style={{ fontSize: "12px" }} onClick={handleProvinceExport}><Icon name="download" style={{ fontSize: "14px" }} /> Ekspor CSV Data Utama</button>
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
              {(summary.top_impacted?.length ? summary.top_impacted : predictions
                .slice()
                .sort((a, b) => b.risk_probability - a.risk_probability)
                .slice(0, 10)
                .map((p) => ({
                  id: p.id,
                  prediction_date: p.prediction_date,
                  risk_probability: p.risk_probability,
                  risk_class: p.risk_class,
                  confidence_score: p.confidence_score,
                  max_tidal_height: p.max_tidal_height,
                  village: p.region?.village ?? null,
                  district: p.region?.district ?? null,
                  regency: p.region?.regency ?? null,
                  population: null,
                })))
                .map((p, index) => (
                <motion.tr 
                  key={p.id}
                  
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <td style={{ padding: "16px 24px", color: "var(--ink-soft)", fontWeight: 700 }}>{index + 1}</td>
                  <td style={{ padding: "16px 24px", fontWeight: 700 }}>
                    {p.village ?? "-"}
                    <div style={{ fontSize: 11, color: "var(--ink-soft)", fontWeight: 500, marginTop: 4 }}>{toNumber(p.population).toLocaleString("id-ID")} jiwa</div>
                  </td>
                  <td style={{ padding: "16px 24px", color: "var(--ink-soft)" }}>{p.district ?? "-"}, {p.regency ?? "-"}</td>
                  <td style={{ padding: "16px 24px" }}>
                    <span className={`badge severity-${riskBadgeClass(p.risk_class)}`}>
                      {p.risk_class.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right", fontWeight: 700 }}>
                    {p.max_tidal_height ? `${toNumber(p.max_tidal_height).toLocaleString("id-ID", { maximumFractionDigits: 2 })} Meter` : "-"}
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "center" }}>
                    <span style={{ display: "inline-block", background: "rgba(16, 185, 129, 0.1)", color: "var(--low)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                      {p.confidence_score ? `${toNumber(p.confidence_score).toFixed(2)}%` : "-"}
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
