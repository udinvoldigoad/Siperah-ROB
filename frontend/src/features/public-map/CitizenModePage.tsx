import { useEffect, useState } from "react";
import { api } from "../../shared/api/client";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
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
  rendah: "rendah",
  sedang: "sedang",
  tinggi: "tinggi",
  sangat_tinggi: "sangat tinggi",
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

  const risk = data ? riskLabels[data.risk_class] : "memuat";

  const forecastDays = [
    ["21 Mei", "S.Tinggi", "87%", "#dc2626"],
    ["22 Mei", "Tinggi", "74%", "#ea580c"],
    ["23 Mei", "Tinggi", "68%", "#ea580c"],
    ["24 Mei", "Sedang", "45%", "#d97706"],
    ["25 Mei", "Rendah", "24%", "#16a34a"],
    ["26 Mei", "Rendah", "18%", "#16a34a"],
    ["27 Mei", "Rendah", "12%", "#16a34a"],
  ];

  const nearbyReports = [
    ["Panjang Utara", "Genangan 31 cm masuk 1 menit lalu."],
    ["Teluk Betung", "Air masuk gang rendah, warga memindahkan barang."],
    ["Kota Karang", "Laporan warga menunggu validasi BPBD."],
  ];

  const actionCards = [
    ["Jauhi area rendah", "Hindari jalan pesisir dan area yang mudah tergenang.", "priority_high"],
    ["Siapkan barang penting", "Amankan dokumen dan barang elektronik sebelum puncak pasang.", "inventory_2"],
    ["Ikuti arahan BPBD", "Jika kondisi memburuk, ikuti informasi resmi dari petugas.", "campaign"],
    ["Laporkan kejadian", "Tambahkan foto dan lokasi bila melihat genangan di sekitar Anda.", "add_location_alt"],
  ];

  return (
    <AppShell active="awam" title="Status Bahaya Saya" subtitle="Bahasa sederhana untuk warga pesisir tanpa istilah teknis.">
      {error && <div className="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="detail-layout">
        <div className="stack">
          <section className="status-hero" style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", color: "#fff", borderColor: "#dc2626", borderLeftColor: "#7f1d1d" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
              <div>
                <span style={{ color: "rgba(255,255,255,.78)", fontSize: 12, marginBottom: 8 }}>Lokasi: Telukbetung Selatan, Bandar Lampung</span>
                <strong style={{ color: "#fff", fontSize: 3.4 + "rem" }}>Bahaya {risk}</strong>
                <p style={{ color: "rgba(255,255,255,.82)", marginTop: 14, maxWidth: 560 }}>
                  {data
                    ? `Air laut diprediksi naik malam ini. Hindari jalan rendah dekat pesisir dan siapkan barang penting sebelum puncak pasang ${data.peak_time} WIB.`
                    : "Mengambil status bahaya terbaru dari API SIPERAH-RoB."}
                </p>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 68, opacity: 0.32 }}>warning</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {[
                ["Probabilitas", data ? `${data.risk_probability}%` : "-", risk],
                ["Pasang maksimum", data ? `${meters.format(data.max_tidal_height)} m` : "-", data ? `Puncak ${data.peak_time} WIB` : "Menunggu API"],
                ["Laporan sekitar", data ? String(data.nearby_reports.length) : "-", "Dari laporan warga"],
              ].map(([label, value, note]) => (
                <div key={label} style={{ background: "rgba(255,255,255,.12)", borderRadius: 16, padding: 12 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.72)", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,.72)", marginTop: 5 }}>{note}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <h2>Prakiraan 7 hari ke depan</h2>
                <p>Sumber: BMKG + model AI. Waspada saat nilai merah dan oranye mendominasi.</p>
              </div>
            </div>
            <div className="forecast" style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}>
              {forecastDays.map(([day, label, percent, color]) => (
                <div key={day} style={{ textAlign: "center", padding: 10, background: `${color}12`, borderRadius: 14, border: `2px solid ${color}22` }}>
                  <div style={{ fontSize: 10, color: "var(--ink-soft)", marginBottom: 4 }}>{day}</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: color as string, marginBottom: 4 }}>{label}</div>
                  <div style={{ height: 8, borderRadius: 999, background: "var(--surface-muted)", overflow: "hidden" }}>
                    <div style={{ width: percent as string, height: "100%", background: color as string, borderRadius: 999 }} />
                  </div>
                  <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 4 }}>{percent}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: 14, borderBottom: "1px solid var(--line)" }}>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <div>
                  <h2>Laporan warga di sekitar Anda</h2>
                  <p>Ringkasan kejadian terdekat membantu warga memahami kondisi lapangan terbaru.</p>
                </div>
                <a className="btn secondary" href="#/onboarding">Baca panduan</a>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Kelurahan</th><th>Keparahan</th><th>Waktu</th><th>Status</th></tr>
              </thead>
              <tbody>
                {[
                  ["Panjang Utara", "Sangat Tinggi", "09:10", "divalidasi"],
                  ["Teluk Betung", "Tinggi", "08:45", "divalidasi"],
                  ["Kota Karang", "Sedang", "07:52", "menunggu"],
                ].map(([region, severity, time, status]) => (
                  <tr key={region}>
                    <td style={{ fontWeight: 700 }}>{region}</td>
                    <td><span className={`badge ${severity === "Sangat Tinggi" ? "severity-sangat_parah" : severity === "Tinggi" ? "severity-parah" : "severity-sedang"}`}>{severity}</span></td>
                    <td style={{ color: "var(--ink-soft)" }}>{time} WIB</td>
                    <td><span className={`badge ${status === "divalidasi" ? "status-divalidasi" : "status-menunggu"}`}>{status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="stack">
          <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: 14, background: "#fef2f2", borderBottom: "1px solid #fecaca" }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#7f1d1d", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="priority_high" />
                Rekomendasi tindakan
              </div>
            </div>
            <div style={{ padding: 12, display: "grid", gap: 8 }}>
              {actionCards.map(([title, copy, icon]) => (
                <div key={title} style={{ background: title === "Laporkan kejadian" ? "var(--surface-soft)" : "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 14, display: "flex", gap: 12, alignItems: "start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: title === "Jauhi area rendah" ? "#fee2e2" : title === "Siapkan barang penting" ? "#fff7ed" : title === "Ikuti arahan BPBD" ? "#eff6ff" : "#ecfdf3", color: title === "Jauhi area rendah" ? "#b91c1c" : title === "Siapkan barang penting" ? "#c2410c" : title === "Ikuti arahan BPBD" ? "#1d4ed8" : "#15803d" }}>
                    <Icon name={icon} />
                  </div>
                  <div>
                    <strong style={{ display: "block", marginBottom: 4 }}>{title}</strong>
                    <p style={{ margin: 0 }}>{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Bagikan peringatan</h2>
            <button className="btn primary" type="button" style={{ width: "100%", justifyContent: "center", background: "#25d366", borderColor: "#25d366", marginBottom: 8 }}>
              <Icon name="share" />
              Bagikan via WhatsApp
            </button>
            <button className="btn secondary" type="button" style={{ width: "100%", justifyContent: "center" }}>
              <Icon name="content_copy" />
              Salin teks peringatan
            </button>
          </section>

          <section className="panel" style={{ background: "var(--surface-soft)" }}>
            <h2>Informasi model</h2>
            <div style={{ display: "grid", gap: 6, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8 }}>
              <div>Model: Random Forest v1.2.0</div>
              <div>Confidence: <strong style={{ color: "#15803d" }}>0.89</strong></div>
              <div>Data: BMKG + BIG + laporan GT</div>
              <div>Diperbarui: 21 Mei 2026 05:00 WIB</div>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
