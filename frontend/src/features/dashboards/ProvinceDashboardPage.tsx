import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { api, apiUrl } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";
import { riskLabels } from "../../shared/constants/risk";
import { motion, type Variants } from "framer-motion";

interface SummaryData {
  monitored_regencies: number;
  high_risk_villages: number;
  risk_population: number;
  validated_reports_this_month: number;
  latest_prediction_date?: string | null;
  regencies?: RegencySummary[];
  trend_30_days?: { prediction_date: string; critical_count: number; high_count: number; high_risk_count: number }[];
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
  const [trendHoverIdx, setTrendHoverIdx] = useState<number | null>(null);
  const trendSvgRef = useRef<SVGSVGElement>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.set("month", selectedMonth);
      if (selectedRegency !== "all") params.set("regency", selectedRegency);
      const query = params.toString() ? `?${params.toString()}` : "";
      const summaryRes = await api<SummaryResponse>(`/dashboard/province/summary${query}`);
      setSummary(summaryRes.data);

      // Prediksi terbaru untuk fallback tabel "10 kelurahan terdampak" bila
      // top_impacted kosong. Grafik tren TIDAK lagi pakai ini (lihat trendData).
      const predRes = await api<PredictionListResponse>(`/public/predictions?per_page=1000`);
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

  // FR-PROV-3: grafik prediksi 30 hari KE DEPAN — jumlah kelurahan kelas
  // Sangat Tinggi (utama) & Tinggi (sekunder). Sumbernya summary.trend_30_days
  // yang diagregasi server (mengikuti filter kabupaten halaman), BUKAN rata-rata
  // dari /public/predictions — endpoint itu terurut DESC & terbatas 1000 baris
  // sehingga hanya memuat ~3 hari terjauh, bukan 30 hari penuh.
  const trendData = useMemo(() => {
    const byDate = new Map<string, { avgProb: number; maxProb: number }>();
    for (const row of summary.trend_30_days ?? []) {
      const key = row.prediction_date.substring(0, 10);
      byDate.set(key, { avgProb: toNumber(row.avg_probability), maxProb: toNumber(row.max_probability) });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const actualToday = toDateKey(today);

    return Array.from({ length: 30 }, (_, index) => {
      const d = new Date(today);
      d.setDate(today.getDate() + index);
      const key = toDateKey(d);
      const stat = byDate.get(key);
      return {
        date: d,
        avgProb: stat?.avgProb ?? 0,
        maxProb: stat?.maxProb ?? 0,
        isToday: key === actualToday,
      };
    });
  }, [summary.trend_30_days]);

  return (
    <AppShell active="province" title="Dashboard BPBD Provinsi Lampung">
      <motion.div 
        className="content"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Alert Banner */}
        <motion.div variants={itemVariants} className="alert" style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: "1 1 300px" }}>
            <motion.div 
              animate={{ scale: [1, 1.15, 1] }} 
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              style={{ flexShrink: 0 }}
            >
              <Icon name="campaign" style={{ fontSize: "28px", color: "var(--critical)" }} />
            </motion.div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)" }}>
                {isLoading ? "Memuat peringatan risiko..." : `${summary.high_risk_villages} kelurahan berisiko tinggi sedang dipantau`}
              </div>
              <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "4px" }}>
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
        <motion.div variants={containerVariants} className="metric-grid" style={{ marginBottom: "32px", gap: "24px" }}>
          <motion.div variants={itemVariants} className="metric-card" style={{ padding: "28px", borderRadius: 8 }}>
            <span style={{ fontSize: "14px", color: "var(--ink-soft)", fontWeight: 600, display: "block", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Wilayah Pantau Aktif</span>
            <strong style={{ color: "var(--accent)", fontSize: "36px", fontWeight: 900, display: "block", lineHeight: 1 }}>{summary.monitored_regencies}</strong>
            <small style={{ fontSize: "13px", color: "var(--ink-soft)", display: "block", marginTop: "12px" }}>Kabupaten & Kota di Lampung</small>
          </motion.div>
          <motion.div variants={itemVariants} className="metric-card critical" style={{ padding: "28px", borderRadius: 8 }}>
            <span style={{ fontSize: "14px", fontWeight: 600, display: "block", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Zona Sangat Bahaya</span>
            <strong style={{ fontSize: "36px", fontWeight: 900, display: "block", lineHeight: 1 }}>{summary.high_risk_villages}</strong>
            <small style={{ fontSize: "13px", display: "block", marginTop: "12px" }}>Kelurahan butuh perhatian khusus</small>
          </motion.div>
          <motion.div variants={itemVariants} className="metric-card medium" style={{ padding: "28px", borderRadius: 8 }}>
            <span style={{ fontSize: "14px", color: "var(--ink-soft)", fontWeight: 600, display: "block", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Warga Terdampak Potensial</span>
            <strong style={{ fontSize: "36px", fontWeight: 900, display: "block", lineHeight: 1 }}>{toNumber(summary.risk_population).toLocaleString("id-ID")}</strong>
            <small style={{ fontSize: "13px", color: "var(--ink-soft)", display: "block", marginTop: "12px" }}>
              {summary.population_audit?.status === "bps_verified" ? "BPS terverifikasi" : summary.population_audit?.status === "region_population_available" ? "Berdasarkan data region" : "Data populasi belum lengkap"}
            </small>
          </motion.div>
          <motion.div variants={itemVariants} className="metric-card success" style={{ padding: "28px", borderRadius: 8 }}>
            <span style={{ fontSize: "14px", fontWeight: 600, display: "block", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Laporan Masuk (Bulan Ini)</span>
            <strong style={{ fontSize: "36px", fontWeight: 900, display: "block", lineHeight: 1 }}>{summary.validated_reports_this_month}</strong>
            <small style={{ fontSize: "13px", display: "block", marginTop: "12px" }}>Telah divalidasi oleh operator</small>
          </motion.div>
        </motion.div>

        {/* Full Width Layout */}
        <div style={{ display: "flex", flexDirection: "column", gap: "32px", marginBottom: "32px" }}>
          {/* Table per Kabupaten */}
          <motion.div variants={itemVariants} className="panel flush">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
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
            <div className="table-responsive">
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
                        {riskLabels[item.riskClass] ?? item.riskClass}
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
            </div>
          </motion.div>

          {/* ML Prediction Timeline — Line Chart */}
          <motion.div variants={itemVariants} className="panel" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h2 style={{ margin: "0 0 8px", fontSize: "1.25rem", color: "var(--ink)" }}>Prediksi Peluang Rob 30 Hari ke Depan</h2>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.5, maxWidth: "500px" }}>
                    Rata-rata persentase peluang terjadinya banjir rob harian berdasarkan model prediktif (FR-PROV-3).
                  </p>
                </div>
                <div style={{ display: "flex", gap: "16px", fontSize: "11px", fontWeight: 600 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "10px", height: "10px", background: "var(--accent)", borderRadius: "2px" }}></div>
                    <span style={{ color: "var(--ink-soft)" }}>Rata-rata Peluang</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "10px", height: "10px", background: "var(--high)", borderRadius: "2px" }}></div>
                    <span style={{ color: "var(--ink-soft)" }}>Peluang Maksimum</span>
                  </div>
                </div>
              </div>

            {(() => {
              const svgW = 800, svgH = 260;
              const pad = { top: 30, right: 20, bottom: 40, left: 44 };
              const chartW = svgW - pad.left - pad.right;
              const chartH = svgH - pad.top - pad.bottom;
              const data = trendData;

              // Sumbu Y persentase dinamis: 0 - 100%
              const max = 100;
              const uniqueYTicks = [0, 25, 50, 75, 100];

              const xOf = (i: number) => pad.left + (i / Math.max(1, data.length - 1)) * chartW;
              const yOf = (v: number) => pad.top + chartH - (v / max) * chartH;

              const buildLine = (get: (d: typeof data[number]) => number) =>
                data.map((d, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(get(d)).toFixed(1)}`).join(" ");
              const criticalLine = buildLine((d) => d.avgProb);
              const criticalArea = `${criticalLine} L${xOf(data.length - 1).toFixed(1)},${yOf(0).toFixed(1)} L${xOf(0).toFixed(1)},${yOf(0).toFixed(1)} Z`;
              const highLine = buildLine((d) => d.maxProb);

              // X ticks — show ~6 date labels
              const xTickStep = Math.max(1, Math.floor(data.length / 5));
              const xTicks = data.map((_, i) => i).filter((i) => i % xTickStep === 0 || i === data.length - 1);

              // Today index
              const todayIdx = data.findIndex((d) => d.isToday);

              // Hover point
              const hovered = trendHoverIdx !== null ? data[trendHoverIdx] : null;
              const hoverX = trendHoverIdx !== null ? xOf(trendHoverIdx) : 0;
              const hoverY = hovered ? yOf(hovered.avgProb) : 0;
              const hoverColor = "var(--accent)";

              const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
                const svg = trendSvgRef.current;
                if (!svg) return;

                // Gunakan CTM untuk mengkonversi titik layar (mouse) secara akurat ke koordinat internal SVG
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const ctm = svg.getScreenCTM();
                if (!ctm) return;

                const svgP = pt.matrixTransform(ctm.inverse());
                const mouseX = svgP.x;

                const relX = mouseX - pad.left;
                if (relX < -10 || relX > chartW + 10) { setTrendHoverIdx(null); return; }
                const idx = Math.round((relX / chartW) * (data.length - 1));
                setTrendHoverIdx(Math.max(0, Math.min(data.length - 1, idx)));
              };

              return (
                <svg
                  ref={trendSvgRef}
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  style={{ width: "100%", height: "auto", maxHeight: 320, cursor: "crosshair", overflow: "visible" }}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setTrendHoverIdx(null)}
                >
                  <defs>
                    <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Y Grid lines (Persentase) */}
                  {uniqueYTicks.map((t) => (
                    <g key={`y-${t}`}>
                      <line x1={pad.left} y1={yOf(t)} x2={pad.left + chartW} y2={yOf(t)} stroke="var(--line, #e5e7eb)" strokeWidth="0.8" opacity="0.5" />
                      <text x={pad.left - 8} y={yOf(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-soft, #94a3b8)" fontWeight="500">
                        {t}%
                      </text>
                    </g>
                  ))}

                  {/* Area under critical line */}
                  <path d={criticalArea} fill="url(#trendAreaGrad)" />
                  {/* High line */}
                  <path d={highLine} fill="none" stroke="var(--high)" strokeWidth="2.5" />
                  {/* Critical line */}
                  <path d={criticalLine} fill="none" stroke="var(--accent)" strokeWidth="2.5" />

                  {/* Dots for Critical line */}
                  {data.map((d, i) => (
                    <circle 
                      key={`dot-${i}`} 
                      cx={xOf(i)} cy={yOf(d.avgProb)} r="3.5" 
                      fill="var(--accent)" 
                      strokeWidth={d.isToday ? 2 : 0} 
                      opacity={trendHoverIdx === i ? 0 : 1} 
                    />
                  ))}

                  {/* Today vertical marker */}
                  {todayIdx >= 0 && (
                    <g>
                      <line x1={xOf(todayIdx)} y1={pad.top - 14} x2={xOf(todayIdx)} y2={yOf(0)} stroke="var(--critical)" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.6" />
                      <rect x={xOf(todayIdx) - 24} y={pad.top - 26} width="48" height="18" rx="4" fill="var(--critical)" />
                      <text x={xOf(todayIdx)} y={pad.top - 13.5} textAnchor="middle" fontSize="10" fill="var(--surface)" fontWeight="700">Hari ini</text>
                    </g>
                  )}

                  {/* X-Axis labels */}
                  {xTicks.map((i) => (
                    <text key={`x-${i}`} x={xOf(i)} y={svgH - 6} textAnchor="middle" fontSize="10.5" fill={data[i]?.isToday ? "var(--accent)" : "var(--ink-soft)"} fontWeight={data[i]?.isToday ? 700 : 500}>
                      {data[i]?.date.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </text>
                  ))}

                  {/* Hover crosshair & tooltip */}
                  {trendHoverIdx !== null && hovered && (
                    <g>
                      <line x1={hoverX} y1={pad.top} x2={hoverX} y2={yOf(0)} stroke={hoverColor} strokeWidth="1" opacity="0.45" strokeDasharray="3 2" />
                      <circle cx={hoverX} cy={hoverY} r="6" fill={hoverColor} stroke="var(--surface)" strokeWidth="2.5" />
                      <circle cx={hoverX} cy={hoverY} r="10" fill={hoverColor} opacity="0.15" />

                      {/* Tooltip */}
                      {(() => {
                        const tooltipW = 178, tooltipH = 58;
                        let tx = hoverX - tooltipW / 2;
                        if (tx < pad.left) tx = pad.left;
                        if (tx + tooltipW > pad.left + chartW) tx = pad.left + chartW - tooltipW;
                        const ty = Math.max(pad.top - 6, hoverY - tooltipH - 14);
                        return (
                          <g>
                            <rect x={tx} y={ty} width={tooltipW} height={tooltipH} rx="8" fill="var(--surface, #fff)" stroke="var(--line, #e2e8f0)" strokeWidth="1" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.12))" />
                            <text x={tx + tooltipW / 2} y={ty + 20} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--ink, #1e293b)">
                              {hovered.date.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "long" })}
                            </text>
                            <text x={tx + tooltipW / 2} y={ty + 40} textAnchor="middle" fontSize="11.5" fontWeight="600">
                              <tspan fill="var(--accent)">{hovered.avgProb.toFixed(1)}% Rata-rata</tspan>
                              <tspan fill="var(--ink-soft)"> · </tspan>
                              <tspan fill="var(--high)">{hovered.maxProb.toFixed(1)}% Maksimal</tspan>
                            </text>
                          </g>
                        );
                      })()}
                    </g>
                  )}
                </svg>
              );
            })()}
          </motion.div>
        </div>

        {/* Kelurahan Paling Terdampak */}
        <motion.div variants={itemVariants} className="panel flush">
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem" }}>10 Kelurahan Paling Terdampak & Kritis</h2>
              <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--ink-soft)" }}>
                Berdasarkan prediksi terbaru, kelas risiko, peluang rob, dan populasi region. Filter mengikuti pilihan bulan/kabupaten di atas.
              </p>
            </div>
            <button className="btn secondary" style={{ fontSize: "12px" }} onClick={handleProvinceExport}><Icon name="download" style={{ fontSize: "14px" }} /> Ekspor CSV Data Utama</button>
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
                      {riskLabels[p.risk_class] ?? p.risk_class}
                    </span>
                  </td>
                  <td style={{ padding: "16px 24px", textAlign: "right", fontWeight: 700 }}>
                    {p.max_tidal_height ? `${toNumber(p.max_tidal_height).toLocaleString("id-ID", { maximumFractionDigits: 2 })} Meter` : "-"}
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

