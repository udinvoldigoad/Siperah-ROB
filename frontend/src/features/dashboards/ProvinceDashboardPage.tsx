import { AppShell } from "../../shared/components/AppShell";
import { MetricCard } from "../../shared/components/MetricCard";

const regencies = [
  ["Lampung Selatan", "Sangat Tinggi", "82%", "128.400 jiwa", "Prioritas evakuasi"],
  ["Bandar Lampung", "Tinggi", "74%", "84.200 jiwa", "Pantau pasang malam"],
  ["Pesisir Barat", "Tinggi", "68%", "41.700 jiwa", "Koordinasi posko"],
  ["Tanggamus", "Sedang", "46%", "29.900 jiwa", "Monitoring harian"],
] as const;

const trend = [22, 31, 38, 34, 42, 47, 52] as const;

const topVillages = [
  ["Telukbetung Selatan", "Bandar Lampung", "Sangat Tinggi", "23.140", "0.92", "3"],
  ["Kalianda", "Lampung Selatan", "Sangat Tinggi", "12.650", "0.89", "2"],
  ["Way Halim Permai", "Bandar Lampung", "Sangat Tinggi", "11.200", "0.87", "1"],
  ["Panjang Utara", "Bandar Lampung", "Tinggi", "10.430", "0.85", "4"],
] as const;

export function ProvinceDashboardPage() {
  return (
    <AppShell active="province" title="Dashboard BPBD Provinsi" subtitle="Ringkasan lintas kabupaten, tren 30 hari, dan prioritas koordinasi.">
      <div className="stack province-dashboard">
        <section className="alert" style={{ display: "grid", gap: 6 }}>
          <strong>Peringatan BMKG aktif</strong>
          <span>Pasang puncak 21-23 Mei 2026. Empat kabupaten masuk kelas Sangat Tinggi dan perlu koordinasi lintas wilayah.</span>
        </section>

        <div className="metric-grid">
          <MetricCard metric={{ label: "Kab. pantau aktif", value: "7", note: "dari 15 kab/kota Lampung" }} />
          <MetricCard metric={{ label: "Kel. bahaya tinggi+", value: "42", note: "dari 283 kel. pesisir", tone: "critical" }} />
          <MetricCard metric={{ label: "Populasi risiko", value: "148.920", note: "jiwa dalam zona bahaya" }} />
          <MetricCard metric={{ label: "Laporan ground truth", value: "127", note: "divalidasi bulan ini", tone: "success" }} />
        </div>

        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Tren risiko 30 hari</h2>
              <p>Fokus pada kenaikan jumlah kelurahan sangat tinggi, bukan seluruh spektrum kelas bahaya.</p>
            </div>
            <span className="badge severity-parah">Random Forest v1.2.0</span>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ height: 220, display: "flex", alignItems: "end", gap: 10, paddingBottom: 4, borderBottom: "1px solid var(--line)" }}>
              {trend.map((value, index) => (
                <div key={`${value}-${index}`} style={{ flex: 1, display: "flex", alignItems: "end", justifyContent: "center", minHeight: 200 }}>
                  <div
                    title={`${value} kelurahan`}
                    style={{
                      width: "100%",
                      maxWidth: 20,
                      height: `${value * 2.8}px`,
                      borderRadius: "10px 10px 0 0",
                      background: value >= 45 ? "#dc2626" : value >= 35 ? "#ea580c" : value >= 25 ? "#d97706" : "#16a34a",
                      opacity: 0.92,
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-soft)" }}>
              <span>1 Mei</span>
              <span style={{ color: "#dc2626", fontWeight: 800 }}>Puncak 21</span>
              <span>30 Mei</span>
            </div>
          </div>
        </section>

        <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: 14, borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 style={{ marginBottom: 6 }}>Risiko per Kabupaten</h2>
              <p style={{ margin: 0 }}>Ringkasan kabupaten prioritas untuk memudahkan koordinasi dan alokasi respons.</p>
            </div>
            <button className="btn secondary" type="button">Ekspor CSV</button>
          </div>
          <div className="province-table-wrap">
            <table className="data-table province-table">
              <thead>
                <tr><th style={{ width: "24%" }}>Kabupaten</th><th style={{ width: "16%" }}>Kelas</th><th style={{ width: "14%" }}>Probabilitas</th><th style={{ width: "22%" }}>Populasi risiko</th><th style={{ width: "24%" }}>Prioritas</th></tr>
              </thead>
              <tbody>
                {regencies.map(([name, risk, probability, population, priority]) => (
                  <tr key={name}>
                    <td style={{ fontWeight: 700 }}>{name}</td>
                    <td><span className={`badge ${risk === "Sangat Tinggi" ? "severity-sangat_parah" : risk === "Tinggi" ? "severity-parah" : "severity-sedang"}`}>{risk}</span></td>
                    <td>{probability}</td>
                    <td>{population}</td>
                    <td>{priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
            <h2 style={{ marginBottom: 6 }}>Kelurahan prioritas tertinggi</h2>
            <p style={{ margin: 0 }}>Daftar singkat wilayah yang perlu dipantau terlebih dahulu.</p>
          </div>
          <div className="province-table-wrap">
            <table className="data-table province-table">
              <thead>
                <tr><th style={{ width: 44 }}>#</th><th style={{ width: "22%" }}>Kelurahan</th><th style={{ width: "18%" }}>Kabupaten</th><th style={{ width: "16%" }}>Kelas</th><th style={{ width: "16%", textAlign: "right" }}>Populasi risiko</th><th style={{ width: "12%", textAlign: "right" }}>Confidence</th><th style={{ width: "12%" }}>Laporan GT</th></tr>
              </thead>
              <tbody>
                {topVillages.map(([village, regency, severity, population, confidence, reports], index) => (
                  <tr key={village}>
                    <td style={{ color: "var(--ink-soft)" }}>{index + 1}</td>
                    <td style={{ fontWeight: 700 }}>{village}</td>
                    <td>{regency}</td>
                    <td><span className={`badge ${severity === "Sangat Tinggi" ? "severity-sangat_parah" : severity === "Tinggi" ? "severity-parah" : "severity-sedang"}`}>{severity}</span></td>
                    <td style={{ textAlign: "right" }}>{population}</td>
                    <td style={{ textAlign: "right", color: "#15803d" }}>{confidence}</td>
                    <td><span className="badge status-divalidasi">{reports}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
