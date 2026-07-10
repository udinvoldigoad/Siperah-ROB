import { AppShell } from "../../shared/components/AppShell";
import { MetricCard } from "../../shared/components/MetricCard";

const datasets = [
  ["Prediksi Risiko Harian", "2024-2026", "Kelurahan", "18.250", "CC BY 4.0"],
  ["Ground Truth Tervalidasi", "2025-2026", "Titik laporan", "1.204", "Internal BPBD"],
  ["Pasang Surut BMKG", "2023-2026", "Jam", "26.880", "BMKG"],
];

const endpoints = [
  ["GET", "/api/v1/predictions/daily", "Prediksi harian per wilayah"],
  ["GET", "/api/v1/reports", "Laporan ground truth tervalidasi"],
  ["GET", "/api/v1/tidal", "Data pasang surut stasiun BMKG"],
];

export function ResearchPortalPage() {
  return (
    <AppShell active="research" title="Portal Peneliti & API" subtitle="Dataset, metadata, lisensi, API key, dan dokumentasi endpoint.">
      <div className="stack">
        <div className="metric-grid">
          <MetricCard metric={{ label: "Dataset", value: String(datasets.length), note: "Set data tersedia" }} />
          <MetricCard metric={{ label: "Endpoint", value: String(endpoints.length), note: "Referensi API" }} />
          <MetricCard metric={{ label: "Rekaman", value: "46.130", note: "Akses penelitian" }} />
          <MetricCard metric={{ label: "Status key", value: "Aktif", note: "Siap digunakan", tone: "success" }} />
        </div>

        <section className="panel" style={{ display: "grid", gap: 14 }}>
          <div className="section-head">
            <div>
              <h2>API key</h2>
              <p>Gunakan key ini untuk akses data penelitian yang sudah disetujui admin.</p>
            </div>
            <button className="btn primary" type="button">Regenerasi key</button>
          </div>
          <code style={{ marginBottom: 0, width: "100%" }}>sk_live_************3a9c</code>
        </section>
        <section className="panel" style={{ display: "grid", gap: 14 }}>
          <div className="section-head">
            <div>
              <h2>Dataset</h2>
              <p>Set data yang paling sering dipakai peneliti, dengan informasi ringkas dan aksi unduh.</p>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: 840 }}>
              <thead><tr><th>Nama</th><th>Periode</th><th>Resolusi</th><th>Rekaman</th><th>Lisensi</th><th>Unduh</th></tr></thead>
              <tbody>{datasets.map(([name, period, resolution, records, license]) => <tr key={name}><td>{name}</td><td>{period}</td><td>{resolution}</td><td>{records}</td><td>{license}</td><td className="table-actions"><button className="btn secondary" type="button">CSV</button><button className="btn secondary" type="button">JSON</button></td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Referensi API</h2>
              <p>Endpoint inti yang umum dipakai untuk integrasi penelitian.</p>
            </div>
          </div>
          <div className="simple-list compact">
            {endpoints.map(([method, path, note]) => (
              <article key={path}>
                <strong><span className="badge status-menunggu">{method}</span> {path}</strong>
                <p>{note}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
