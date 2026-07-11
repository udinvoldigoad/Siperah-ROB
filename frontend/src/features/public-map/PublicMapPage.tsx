import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { motion } from "framer-motion";

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

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function PublicMapPage() {
  return (
    <AppShell active="map" title="Peta Bahaya Rob" subtitle="Peringatan aktif, layer bahaya, laporan warga, dan ekspor data untuk operator maupun publik.">
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="stack" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
        <motion.div variants={itemVariants} className="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, borderLeftColor: "var(--critical)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Icon name="warning" style={{ fontSize: 24, color: "var(--critical)" }} />
            <div>
              <strong style={{ display: "block", marginBottom: 3, color: "var(--ink)" }}>Peringatan BMKG aktif</strong>
              <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Pasang puncak diprediksi 21-23 Mei 2026. 4 kabupaten masuk kelas Sangat Tinggi.</span>
            </div>
          </div>
          <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn secondary" href="#/awam">Lihat mode awam</motion.a>
        </motion.div>

        <motion.div variants={itemVariants} style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>
          <div className="panel flush" style={{ position: "relative", minHeight: "calc(100dvh - 228px)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", background: "var(--surface-soft)" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <select defaultValue="7" style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", fontSize: 13, color: "var(--ink)" }}>
                  <option value="0">Hari ini</option>
                  <option value="1">+1 hari</option>
                  <option value="3">+3 hari</option>
                  <option value="7">+7 hari</option>
                </select>
                <select defaultValue="all" style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface)", fontSize: 13, color: "var(--ink)" }}>
                  <option value="all">Semua kabupaten</option>
                  <option>Bandar Lampung</option>
                  <option>Lampung Selatan</option>
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)", fontWeight: 500, cursor: "pointer" }}>
                <input type="checkbox" defaultChecked style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
                Tampilkan laporan
              </label>
            </div>

            <svg width="100%" height="100%" viewBox="0 0 820 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ display: "block", minHeight: 520, background: "#b8d8ea" }}>
              <motion.path 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}
                d="M60,120 C100,100 180,90 260,95 C340,100 400,110 460,100 C520,90 580,80 640,85 C700,90 760,100 800,110 L820,140 L820,340 C780,360 720,370 660,355 C600,340 540,310 480,320 C420,330 360,350 300,340 C240,330 180,300 120,290 C80,285 40,295 20,310 L0,310 L0,200 Z" fill="#dde8c0" 
              />
              <motion.path initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 0.55 }} transition={{ delay: 0.2 }} d="M80,200 L160,190 L200,220 L170,260 L100,255 Z" fill="#16a34a" />
              <motion.path initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 0.6 }} transition={{ delay: 0.3 }} d="M200,180 L300,170 L340,205 L305,245 L215,238 Z" fill="#d97706" />
              <motion.path initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 0.68 }} transition={{ delay: 0.4 }} d="M300,220 L400,210 L440,248 L405,288 L315,282 Z" fill="#ea580c" />
              <motion.path initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 0.7 }} transition={{ delay: 0.5 }} d="M400,245 L490,235 L525,276 L488,318 L408,312 Z" fill="#dc2626" />
              <motion.path initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 0.55 }} transition={{ delay: 0.6 }} d="M650,160 L730,150 L760,185 L730,220 L665,215 Z" fill="#16a34a" />
              
              <g style={{ cursor: "pointer" }}>
                <circle cx="350" cy="255" r="18" fill="#dc2626" stroke="#fff" strokeWidth="2.5" opacity="0.95" />
                <text x="350" y="259" textAnchor="middle" style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fill: "#fff", fontWeight: 800 }}>5</text>
              </g>
              <g style={{ cursor: "pointer" }}>
                <circle cx="420" cy="270" r="14" fill="#ea580c" stroke="#fff" strokeWidth="2.5" opacity="0.95" />
                <text x="420" y="274" textAnchor="middle" style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fill: "#fff", fontWeight: 800 }}>3</text>
              </g>
              <g style={{ cursor: "pointer" }}>
                <circle cx="290" cy="300" r="10" fill="#d97706" stroke="#fff" strokeWidth="2" opacity="0.95" />
                <text x="290" y="304" textAnchor="middle" style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fill: "#fff", fontWeight: 800 }}>2</text>
              </g>
              <g style={{ cursor: "pointer" }}>
                <circle cx="480" cy="310" r="10" fill="#16a34a" stroke="#fff" strokeWidth="2" opacity="0.95" />
                <text x="480" y="314" textAnchor="middle" style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fill: "#fff", fontWeight: 800 }}>1</text>
              </g>
              
              <text x="360" y="245" style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fill: "#1e3a5f", fontWeight: 700, filter: "drop-shadow(0 1px 2px rgba(255,255,255,0.8))" }}>Bandar Lampung</text>
              <text x="465" y="235" style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fill: "#1e3a5f", fontWeight: 700, filter: "drop-shadow(0 1px 2px rgba(255,255,255,0.8))" }}>Lampung Selatan</text>
            </svg>

            <div style={{ position: "absolute", top: 80, right: 16, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden", boxShadow: "var(--sh-md)", display: "grid" }}>
              <button type="button" style={{ width: 36, height: 36, border: "none", borderBottom: "1px solid var(--line)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Zoom in">
                <Icon name="add" style={{ fontSize: 20, color: "var(--ink)" }} />
              </button>
              <button type="button" style={{ width: 36, height: 36, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Zoom out">
                <Icon name="remove" style={{ fontSize: 20, color: "var(--ink)" }} />
              </button>
            </div>

            <div style={{ position: "absolute", bottom: 16, left: 16, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)", border: "1px solid var(--line)", borderRadius: 16, padding: "16px", boxShadow: "var(--sh-md)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--ink)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Legenda Area</div>
              <div style={{ display: "grid", gap: 10 }}>
                {[
                  ["var(--critical)", "Risiko Sangat Parah"],
                  ["var(--high)", "Risiko Parah"],
                  ["var(--medium)", "Risiko Sedang"],
                  ["var(--low)", "Risiko Ringan"],
                ].map(([color, label]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, fontWeight: 500, color: "var(--ink-soft)" }}>
                    <span style={{ width: 14, height: 14, borderRadius: "4px", background: color as string, flexShrink: 0, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)" }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="stack" style={{ gap: 24 }}>
            <motion.div variants={itemVariants} className="panel flush" style={{ overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid var(--line)", background: "var(--surface-soft)" }}>
                {[
                  ["11", "Total Laporan", "var(--ink)"],
                  ["8", "Divalidasi", "var(--low)"],
                  ["3", "Menunggu", "var(--medium)"],
                ].map(([value, label, color]) => (
                  <div key={label} style={{ padding: "16px 12px", textAlign: "center", borderRight: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: color as string, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6, fontWeight: 500 }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: 0.5 }}>Laporan Terkini</span>
                <a href="#/reports" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>Lihat Semua</a>
              </div>

              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {reportItems.map((item, idx) => (
                  <motion.article 
                    key={item.village} 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + (idx * 0.1) }}
                    whileHover={{ backgroundColor: "var(--surface-soft)" }}
                    style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "start", gap: 14, cursor: "pointer" }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", background: item.severity, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                      {item.count}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{item.village}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{item.district}</div>
                      <div style={{ marginTop: 8 }}>
                        <span className={`badge ${item.status === "Menunggu" ? "status-menunggu" : "status-divalidasi"}`} style={{ fontSize: 11, minHeight: 24, padding: "4px 8px", borderRadius: 6 }}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                    <Icon name="chevron_right" style={{ color: "var(--ink-soft)", fontSize: 18, marginTop: 4 }} />
                  </motion.article>
                ))}
              </div>

              <div style={{ padding: 16, background: "var(--surface-soft)" }}>
                <a className="btn primary" href="#/reports" style={{ width: "100%", justifyContent: "center" }}>
                  <Icon name="add" /> Tambah Laporan Baru
                </a>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="panel">
              <h2 style={{ fontSize: "1.1rem", margin: "0 0 16px" }}>Layer Peta</h2>
              <div style={{ display: "grid", gap: 14 }}>
                {layers.map(([label, checked]) => (
                  <label key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, color: "var(--ink)", cursor: "pointer", padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-soft)" }}>
                    <span style={{ fontWeight: 500 }}>{label}</span>
                    <input type="checkbox" defaultChecked={checked as boolean} style={{ accentColor: "var(--accent)", width: 18, height: 18 }} />
                  </label>
                ))}
              </div>
            </motion.div>
          </aside>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
