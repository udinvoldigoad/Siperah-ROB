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

  // Aggregate stats per regency
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
    <AppShell active="province" title="Dashboard Kebencanaan Provinsi" subtitle="Visualisasi sebaran indeks risiko banjir rob, tren bulanan, dan koordinasi logistik taktis.">
      <div className="stack province-dashboard" style={{ display: "grid", gap: "28px" }}>
        
        <section className="alert status-menunggu" style={{ display: "grid", gap: "6px", border: "1px solid var(--accent)", borderRadius: "12px", padding: "16px" }}>
          <strong style={{ fontSize: "1rem" }}>Peringatan BMKG Pesisir Aktif</strong>
          <span style={{ fontSize: "0.85rem" }}>Tinggi gelombang laut pasang di atas batas normal. Seluruh daerah kabupaten pesisir teluk lampung masuk klasifikasi waspada tingkat tinggi.</span>
        </section>

        <div className="metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
          <MetricCard metric={{ label: "Wilayah Kabupaten Pantau", value: String(summary.monitored_regencies), note: "Aktif integrasi data" }} />
          <MetricCard metric={{ label: "Kelurahan Risiko Tinggi+", value: String(summary.high_risk_villages), note: "Butuh kesiapan tanggap", tone: "critical" }} />
          <MetricCard metric={{ label: "Populasi Terdampak", value: summary.risk_population.toLocaleString("id-ID"), note: "Jiwa terancam banjir rob" }} />
          <MetricCard metric={{ label: "Laporan Tervalidasi", value: String(summary.validated_reports_this_month), note: "Ground truth bulan ini", tone: "success" }} />
        </div>

        {/* Tren Risiko Section */}
        <section className="panel" style={{ padding: "28px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Tren Tingkat Ancaman 30 Hari</h2>
              <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", margin: "4px 0 0 0" }}>Distribusi wilayah pesisir dengan potensi luapan air pasang ekstrem harian.</p>
            </div>
            <span className="badge severity-parah" style={{ padding: "6px 12px", borderRadius: "100px" }}>Random Forest v1.2.0</span>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ height: 200, display: "flex", alignItems: "end", gap: 10, paddingBottom: 4, borderBottom: "1px solid var(--line)" }}>
              {[22, 31, 38, 34, 42, 47, summary.high_risk_villages].map((value, index) => (
                <div key={index} style={{ flex: 1, display: "flex", alignItems: "end", justifyContent: "center", minHeight: 180 }}>
                  <div
                    title={`${value} kelurahan`}
                    style={{
                      width: "100%",
                      maxWidth: 24,
                      height: `${Math.min(value * 3, 170)}px`,
                      borderRadius: "12px 12px 0 0",
                      background: value >= 40 ? "var(--critical)" : value >= 30 ? "var(--warning)" : "var(--accent)",
                      opacity: 0.9,
                      transition: "height 0.5s ease",
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--ink-soft)", fontWeight: 600 }}>
              <span>Awal Bulan</span>
              <span style={{ color: "var(--critical)", fontWeight: 800 }}>Pasang Maksimum Hari Ini</span>
              <span>Akhir Bulan</span>
            </div>
          </div>
        </section>

        {/* Tabel Risiko Lintas Kabupaten */}
        <section className="panel" style={{ padding: 0, overflow: "hidden", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Potensi Kerawanan per Kabupaten</h2>
              <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: "4px 0 0 0" }}>Grup klasifikasi dampak banjir rob untuk koordinasi kebencanaan daerah.</p>
            </div>
            <button className="btn secondary" type="button" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Icon name="download" /> Ekspor CSV
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--line)" }}>
                  <th style={{ textAlign: "left", padding: "12px 28px" }}>Kabupaten / Kota</th>
                  <th style={{ textAlign: "left", padding: "12px" }}>Kelas Kerawanan</th>
                  <th style={{ textAlign: "left", padding: "12px" }}>Probabilitas Maksimum</th>
                  <th style={{ textAlign: "left", padding: "12px" }}>Status Pemantauan</th>
                  <th style={{ textAlign: "right", padding: "12px 28px" }}>Aksi Koordinasi</th>
                </tr>
              </thead>
              <tbody>
                {regenciesData.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "28px", color: "var(--ink-soft)" }}>
                      Memuat rincian kabupaten...
                    </td>
                  </tr>
                ) : (
                  regenciesData.map((item) => (
                    <tr key={item.name} style={{ borderBottom: "1px solid var(--surface-muted)" }}>
                      <td style={{ padding: "16px 28px", fontWeight: 700 }}>{item.name}</td>
                      <td style={{ padding: "16px 12px" }}>
                        <span className={`badge severity-${item.riskClass}`}>{item.riskClass.replace("_", " ")}</span>
                      </td>
                      <td style={{ padding: "16px 12px", fontFamily: "monospace" }}>{item.probability}</td>
                      <td style={{ padding: "16px 12px", color: "var(--ink-soft)" }}>{item.villagesCount} terpantau</td>
                      <td style={{ padding: "16px 28px", textAlign: "right", fontSize: "0.85rem", fontWeight: 600, color: "var(--accent)" }}>
                        {item.priority}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tabel Kelurahan Prioritas */}
        <section className="panel" style={{ padding: 0, overflow: "hidden", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--line)" }}>
            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>Kelurahan Prioritas Utama Dampak Rob</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: "4px 0 0 0" }}>Daftar wilayah pesisir dengan skor probabilitas banjir tertinggi menurut kalkulasi spasial.</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--line)" }}>
                  <th style={{ width: 60, padding: "12px 28px" }}>No</th>
                  <th style={{ textAlign: "left", padding: "12px" }}>Kelurahan / Desa</th>
                  <th style={{ textAlign: "left", padding: "12px" }}>Kabupaten</th>
                  <th style={{ textAlign: "left", padding: "12px" }}>Skor Risiko</th>
                  <th style={{ textAlign: "right", padding: "12px" }}>Maks Pasang</th>
                  <th style={{ textAlign: "right", padding: "12px" }}>Waktu Puncak</th>
                  <th style={{ textAlign: "right", padding: "12px 28px" }}>Kepercayaan</th>
                </tr>
              </thead>
              <tbody>
                {predictions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "28px", color: "var(--ink-soft)" }}>
                      Tidak ada prediksi prioritas saat ini.
                    </td>
                  </tr>
                ) : (
                  predictions.slice(0, 5).map((p, index) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--surface-muted)" }}>
                      <td style={{ padding: "16px 28px", color: "var(--ink-soft)" }}>{index + 1}</td>
                      <td style={{ padding: "16px 12px", fontWeight: 700 }}>{p.village}</td>
                      <td style={{ padding: "16px 12px" }}>{p.regency}</td>
                      <td style={{ padding: "16px 12px" }}>
                        <span className={`badge severity-${p.risk_class}`}>{p.risk_class}</span>
                      </td>
                      <td style={{ padding: "16px 12px", textAlign: "right", fontWeight: 600 }}>
                        {p.max_tidal_height ? `${p.max_tidal_height} m` : "-"}
                      </td>
                      <td style={{ padding: "16px 12px", textAlign: "right", color: "var(--ink-soft)" }}>
                        {p.peak_time ? p.peak_time.substring(0, 5) : "-"}
                      </td>
                      <td style={{ padding: "16px 28px", textAlign: "right", fontWeight: 800, color: "var(--accent)" }}>
                        {p.confidence_score ? `${p.confidence_score}%` : "80%"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
