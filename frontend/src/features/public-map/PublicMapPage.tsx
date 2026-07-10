import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";

const reportItems = [
  { severity: "#dc2626", count: "5", village: "Kel. Sukaraja", district: "Telukbetung Selatan", status: "Tervalidasi" },
  { severity: "#ea580c", count: "3", village: "Kel. Keteguhan", district: "Telukbetung Timur", status: "Tervalidasi" },
  { severity: "#d97706", count: "2", village: "Kel. Way Lunik", district: "Panjang", status: "Menunggu" },
  { severity: "#16a34a", count: "1", village: "Kel. Srengsem", district: "Panjang", status: "Tervalidasi" },
] as const;

const layers = [
  ["Zona bahaya rob", true],
  ["Laporan ground truth", true],
  ["Infrastruktur kritis", false],
  ["Jalur evakuasi", false],
  ["Pasang surut BMKG", true],
] as const;

export function PublicMapPage() {
  return (
    <AppShell active="map" title="Peta Bahaya Rob" subtitle="Peringatan aktif, layer bahaya, laporan warga, dan ekspor data untuk operator maupun publik.">
      <div className="stack">
        <div className="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <strong style={{ display: "block", marginBottom: 3 }}>Peringatan BMKG aktif</strong>
            <span>Pasang puncak diprediksi 21-23 Mei 2026. 4 kabupaten masuk kelas Sangat Tinggi.</span>
          </div>
          <a className="btn secondary" href="#/awam">Lihat mode awam</a>
        </div>

        <div className="map-layout">
          <div className="panel flush" style={{ position: "relative", minHeight: "calc(100dvh - 228px)" }}>
            <div style={{ padding: 16, borderBottom: "1px solid var(--line)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <select defaultValue="7">
                  <option value="0">Hari ini</option>
                  <option value="1">+1 hari</option>
                  <option value="3">+3 hari</option>
                  <option value="7">+7 hari</option>
                </select>
                <select defaultValue="all">
                  <option value="all">Semua kabupaten</option>
                  <option>Bandar Lampung</option>
                  <option>Lampung Selatan</option>
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-soft)" }}>
                <input type="checkbox" defaultChecked />
                Tampilkan laporan
              </label>
            </div>

            <svg width="100%" height="100%" viewBox="0 0 820 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: "block", minHeight: 420 }}>
              <rect width="820" height="560" fill="#b8d8ea" />
              <path d="M60,120 C100,100 180,90 260,95 C340,100 400,110 460,100 C520,90 580,80 640,85 C700,90 760,100 800,110 L820,140 L820,340 C780,360 720,370 660,355 C600,340 540,310 480,320 C420,330 360,350 300,340 C240,330 180,300 120,290 C80,285 40,295 20,310 L0,310 L0,200 Z" fill="#dde8c0" />
              <path d="M80,200 L160,190 L200,220 L170,260 L100,255 Z" fill="#16a34a" opacity="0.55" />
              <path d="M200,180 L300,170 L340,205 L305,245 L215,238 Z" fill="#d97706" opacity="0.6" />
              <path d="M300,220 L400,210 L440,248 L405,288 L315,282 Z" fill="#ea580c" opacity="0.68" />
              <path d="M400,245 L490,235 L525,276 L488,318 L408,312 Z" fill="#dc2626" opacity="0.7" />
              <path d="M650,160 L730,150 L760,185 L730,220 L665,215 Z" fill="#16a34a" opacity="0.55" />
              <circle cx="350" cy="255" r="18" fill="#dc2626" stroke="#fff" strokeWidth="2" opacity="0.95" />
              <text x="350" y="260" textAnchor="middle" style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fill: "#fff", fontWeight: 700 }}>5</text>
              <circle cx="420" cy="270" r="14" fill="#ea580c" stroke="#fff" strokeWidth="2" opacity="0.95" />
              <text x="420" y="275" textAnchor="middle" style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fill: "#fff", fontWeight: 700 }}>3</text>
              <circle cx="290" cy="300" r="10" fill="#d97706" stroke="#fff" strokeWidth="2" opacity="0.95" />
              <text x="290" y="305" textAnchor="middle" style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fill: "#fff", fontWeight: 700 }}>2</text>
              <circle cx="480" cy="310" r="10" fill="#16a34a" stroke="#fff" strokeWidth="2" opacity="0.95" />
              <text x="480" y="315" textAnchor="middle" style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fill: "#fff", fontWeight: 700 }}>1</text>
              <text x="360" y="245" style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fill: "#1e3a5f", fontWeight: 600 }}>Bandar Lampung</text>
              <text x="465" y="235" style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fill: "#1e3a5f", fontWeight: 600 }}>Lampung Selatan</text>
            </svg>

            <div style={{ position: "absolute", top: 16, right: 16, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--sh-md)", display: "grid" }}>
              <button type="button" style={{ width: 36, height: 36, border: "none", borderBottom: "1px solid var(--line)", background: "var(--surface)" }} aria-label="Zoom in">
                <Icon name="add" />
              </button>
              <button type="button" style={{ width: 36, height: 36, border: "none", background: "var(--surface)" }} aria-label="Zoom out">
                <Icon name="remove" />
              </button>
            </div>

            <div style={{ position: "absolute", bottom: 16, left: 16, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, padding: 14, boxShadow: "var(--sh-md)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>Legenda</div>
              <div style={{ display: "grid", gap: 7 }}>
                {[
                  ["#dc2626", "Laporan Sangat Parah"],
                  ["#ea580c", "Laporan Parah"],
                  ["#d97706", "Laporan Sedang"],
                  ["#16a34a", "Laporan Ringan"],
                ].map(([color, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: color as string, flexShrink: 0 }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="stack" style={{ gap: 0, borderLeft: "1px solid var(--line)", background: "var(--surface)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid var(--line)" }}>
              {[
                ["11", "Total laporan", "#dc2626"],
                ["8", "Divalidasi", "#15803d"],
                ["3", "Menunggu", "#d97706"],
              ].map(([value, label, color]) => (
                <div key={label} style={{ padding: 14, textAlign: "center", borderRight: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: color as string }}>{value}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: 14, borderBottom: "1px solid var(--line)", fontSize: 11, fontWeight: 800, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: 0.4 }}>Laporan Terkini</div>

            <div style={{ overflowY: "auto" }}>
              {reportItems.map((item) => (
                <article key={item.village} style={{ padding: 14, borderBottom: "1px solid var(--line)", display: "flex", alignItems: "start", gap: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", background: item.severity }}>
                    {item.count}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{item.village}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>{item.district}</div>
                    <div style={{ marginTop: 6 }}>
                      <span className={`badge ${item.status === "Menunggu" ? "status-menunggu" : "status-divalidasi"}`} style={{ fontSize: 10, minHeight: 24, padding: "4px 8px" }}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div style={{ padding: 14, borderTop: "1px solid var(--line)" }}>
              <a className="btn primary" href="#/reports" style={{ width: "100%" }}>
                <Icon name="add" />
                Tambah laporan baru
              </a>
            </div>
          </aside>
        </div>

        <div className="panel" style={{ display: "grid", gap: 12 }}>
          <h2>Layer data</h2>
          {layers.map(([label, checked]) => (
            <label className="row" key={label} style={{ alignItems: "center", justifyContent: "space-between" }}>
              <span>{label}</span>
              <input type="checkbox" defaultChecked={checked} />
            </label>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
