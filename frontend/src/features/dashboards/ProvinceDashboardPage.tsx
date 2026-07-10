import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { MetricCard } from "../../shared/components/MetricCard";
import { api } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";

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

export function ProvinceDashboardPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<SummaryData>({
    monitored_regencies: 15,
    high_risk_villages: 42,
    risk_population: 284000,
    validated_reports_this_month: 1204,
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

  return (
    <AppShell active="province" title="Dashboard BPBD Provinsi">
      {/* Alert Banner */}
      <div className="alert-banner alert-red" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Icon name="warning" style={{ fontSize: "18px", color: "#b91c1c" }} />
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#7f1d1d" }}>
              Peringatan BMKG aktif · pasang puncak harian
            </div>
            <div style={{ fontSize: "11px", color: "#991b1b", marginTop: "1px" }}>
              Seluruh daerah kabupaten pesisir teluk lampung masuk klasifikasi waspada tingkat tinggi.
            </div>
          </div>
        </div>
        <button style={{ background: "#fff", color: "#b91c1c", borderColor: "#fecaca", fontSize: "11px" }}>
          Lihat detail <Icon name="arrow_forward" style={{ fontSize: "12px" }} />
        </button>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid kpi-grid-4" style={{ marginBottom: "20px" }}>
        <div className="kpi">
          <small>Kab. pantau aktif</small>
          <div className="kpi-num">{summary.monitored_regencies}</div>
          <div className="kpi-sub">dari 15 kab/kota Lampung</div>
        </div>
        <div className="kpi">
          <small>Kelurahan bahaya tinggi+</small>
          <div className="kpi-num" style={{ color: "#b91c1c" }}>{summary.high_risk_villages}</div>
          <div className="kpi-sub">dari 283 kel. pesisir</div>
        </div>
        <div className="kpi">
          <small>Populasi risiko</small>
          <div className="kpi-num">{summary.risk_population.toLocaleString("id-ID")}</div>
          <div className="kpi-sub">jiwa dalam zona bahaya</div>
        </div>
        <div className="kpi">
          <small>Laporan ground truth</small>
          <div className="kpi-num" style={{ color: "#15803d" }}>{summary.validated_reports_this_month}</div>
          <div className="kpi-sub">divalidasi bulan ini</div>
        </div>
      </div>

      {/* 2-Column Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        {/* Table per Kabupaten */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="card-title" style={{ margin: 0 }}>Risiko per Kabupaten</div>
            <button style={{ fontSize: "11px" }}><Icon name="sort" style={{ fontSize: "13px" }} />Urutkan</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Kabupaten</th>
                <th style={{ textAlign: "right" }}>Kelas Kerawanan</th>
                <th style={{ textAlign: "right" }}>Probabilitas</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {regenciesData.map((item) => (
                <tr key={item.name}>
                  <td style={{ fontWeight: 500 }}>{item.name}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className={`badge ${
                      item.riskClass === "sangat_tinggi" ? "b-vhi" :
                      item.riskClass === "tinggi" ? "b-hi" :
                      item.riskClass === "sedang" ? "b-med" : "b-low"
                    }`}>
                      {item.riskClass.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{item.probability}</td>
                  <td><span style={{ fontSize: "11px", color: "var(--tx3)" }}>{item.villagesCount}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Timeline Chart */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <div className="card-title" style={{ margin: 0 }}>Prediksi 30 Hari — Tingkat Ancaman Banjir Rob</div>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ height: 180, display: "flex", alignItems: "end", gap: 16, paddingBottom: 4, borderBottom: "1px solid var(--bd)" }}>
              {[22, 31, 38, 34, 42, 47, summary.high_risk_villages].map((value, index) => (
                <div key={index} style={{ flex: 1, display: "flex", alignItems: "end", justifyContent: "center" }}>
                  <div
                    title={`${value} kelurahan`}
                    style={{
                      width: "100%",
                      maxWidth: 24,
                      height: `${Math.min(value * 2.8, 150)}px`,
                      borderRadius: "4px 4px 0 0",
                      background: value >= 40 ? "#dc2626" : value >= 30 ? "#ea580c" : "#2563eb",
                      opacity: 0.9,
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--tx3)" }}>
              <span>Awal Bulan</span>
              <span style={{ color: "#dc2626", fontWeight: 700 }}>Pasang Maksimum Hari Ini</span>
              <span>Akhir Bulan</span>
            </div>
          </div>
        </div>
      </div>

      {/* Kelurahan Paling Terdampak */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="card-title" style={{ margin: 0 }}>10 Kelurahan Paling Terdampak</div>
          <button style={{ fontSize: "11px" }}><Icon name="download" style={{ fontSize: "13px" }} />Ekspor CSV</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Kelurahan</th>
              <th>Kabupaten</th>
              <th>Kelas Bahaya</th>
              <th style={{ textAlign: "right" }}>Maks Pasang</th>
              <th style={{ textAlign: "right" }}>Confidence</th>
              <th>Laporan GT</th>
            </tr>
          </thead>
          <tbody>
            {predictions.slice(0, 5).map((p, index) => (
              <tr key={p.id}>
                <td style={{ color: "var(--tx3)" }}>{index + 1}</td>
                <td style={{ fontWeight: 500 }}>{p.village}</td>
                <td>{p.regency}</td>
                <td>
                  <span className={`badge ${
                    p.risk_class === "sangat_tinggi" ? "b-vhi" :
                    p.risk_class === "tinggi" ? "b-hi" :
                    p.risk_class === "sedang" ? "b-med" : "b-low"
                  }`}>
                    {p.risk_class.replace("_", " ")}
                  </span>
                </td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{p.max_tidal_height ? `${p.max_tidal_height} m` : "-"}</td>
                <td style={{ textAlign: "right", color: "#15803d" }}>{p.confidence_score ? `${(p.confidence_score / 100).toFixed(2)}` : "0.80"}</td>
                <td><span className="badge b-done">3</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
