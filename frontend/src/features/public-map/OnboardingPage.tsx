import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../shared/api/client";
import { MapPreview } from "../../shared/components/MapPreview";

type Prediction = { risk_class: string; risk_probability: number; region?: { village?: string | null; regency?: string | null } | null };
type PredictionResponse = { data: Prediction[] };

const faqData = [
  {
    q: "Seberapa akurat prediksi banjir rob SIPERAH-RoB?",
    a: "Prediksi adalah alat kewaspadaan, bukan kepastian kejadian. Gunakan informasi risiko bersama arahan resmi BPBD dan kondisi nyata di lapangan."
  },
  {
    q: "Data apa yang digunakan model prediksi?",
    a: "Model memadukan data cuaca dan gelombang laut historis dari Open-Meteo (reanalisis ERA5), proyeksi pasang surut berbasis model harmonik, estimasi populasi wilayah pesisir, serta laporan lapangan warga yang telah divalidasi BPBD. Integrasi sumber resmi seperti pasang surut BIG/Pushidrosal dan prakiraan BMKG sedang disiapkan secara bertahap."
  },
  {
    q: "Siapa saja yang bisa menggunakan SIPERAH-RoB?",
    a: "Peta publik dapat diakses oleh siapa saja tanpa login. Fitur pelaporan tersedia untuk warga terdaftar. Dashboard BPBD dikhususkan untuk operator kabupaten/kota dan BPBD Provinsi Lampung."
  },
  {
    q: "Seberapa sering peta diperbarui?",
    a: "Prediksi diperbarui otomatis setiap hari sekitar pukul 06:00 WIB melalui pipeline model, dan dapat dijalankan ulang oleh operator saat ada pembaruan data penting. Laporan warga yang telah divalidasi BPBD langsung tampil di peta."
  }
];

export function OnboardingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  // CTA "Mulai Melapor" harus mengarah ke login bila belum autentikasi.
  let reportHref = "#/login";
  try {
    const user = JSON.parse(localStorage.getItem("siperah-user") || "null") as { role?: string } | null;
    const isLoggedIn = !!localStorage.getItem("siperah-token") && !!user;
    if (isLoggedIn) reportHref = user?.role === "warga" || user?.role === "admin" ? "#/reports" : "#/map";
  } catch { /* fallback ke #/login */ }

  useEffect(() => {
    void api<PredictionResponse>("/public/predictions").then((response) => setPredictions(response.data)).catch(() => undefined);
  }, []);

  const highestRisk = useMemo(() => predictions.reduce<Prediction | null>((highest, item) => {
    const rank: Record<string, number> = { rendah: 1, sedang: 2, tinggi: 3, sangat_tinggi: 4 };
    return !highest || (rank[item.risk_class] ?? 0) > (rank[highest.risk_class] ?? 0) ? item : highest;
  }, null), [predictions]);
  const highRiskCount = predictions.filter((item) => ["tinggi", "sangat_tinggi"].includes(item.risk_class)).length;

  return (
    <AppShell active="onboarding" title="Panduan Pengguna">
      <div className="content" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 100px" }}>
        <style>{`
          .citizen-guide-grid { display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:stretch; margin-bottom:110px; }
          .citizen-warning-box { background:var(--surface-soft); border:1px solid var(--line); border-radius:16px; box-shadow:0 16px 40px rgba(0,0,0,.05); display:flex; flex-direction:column; justify-content:center; padding:28px; }
          .citizen-warning-label { align-items:center; background:rgba(245, 158, 11, 0.15); border:1px solid rgba(245, 158, 11, 0.3); border-radius:8px; color:var(--medium); display:inline-flex; font-size:12px; font-weight:800; gap:8px; letter-spacing:.08em; margin-bottom:18px; padding:8px 11px; text-transform:uppercase; }
          .citizen-warning-list { display:grid; list-style:none; margin:0; padding:0; }
          .citizen-warning-list li { align-items:center; border-bottom:1px solid var(--line); display:flex; font-size:1rem; font-weight:650; gap:11px; padding:13px 2px; }
          .citizen-warning-list li:last-child { border:0; }
          .citizen-warning-list .material-symbols-outlined, .citizen-warning-label .material-symbols-outlined { color:var(--medium); font-size:20px; }
          .citizen-map-frame { background:var(--surface-soft); border:1px solid var(--line); border-radius:16px; min-height:400px; overflow:hidden; padding:8px; }
          .citizen-report-flow { display:grid; gap:28px; grid-template-columns:repeat(3,minmax(0,1fr)); margin:0 auto; max-width:940px; }
          .citizen-report-step { background:var(--surface); border:1px solid var(--line); border-radius:16px; min-height:260px; padding:30px 26px 28px; text-align:center; }
          .citizen-step-number { align-items:center; background:var(--accent); border:5px solid var(--surface); border-radius:999px; box-shadow:0 0 0 1px var(--line); color:#fff; display:flex; font-size:15px; font-weight:850; height:54px; justify-content:center; margin:0 auto 28px; width:54px; }
          .citizen-step-icon { align-items:center; background:var(--accent-soft); border-radius:9px; color:var(--accent); display:flex; height:38px; justify-content:center; margin:0 auto 14px; width:38px; }
          .citizen-report-step h3 { font-size:1.05rem; margin:0 0 9px; }
          .citizen-report-step p { font-size:.9rem; line-height:1.55; margin:0 auto; max-width:28ch; }
          @media(max-width:768px){ .citizen-guide-grid,.citizen-report-flow,.citizen-faq-grid{grid-template-columns:1fr!important;gap:24px!important}.citizen-map-frame{min-height:300px}.citizen-hero-metrics{grid-template-columns:1fr!important} }
        `}</style>
        
        {/* Modern Cinematic Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1 }}
          style={{ 
            textAlign: "center", 
            padding: "80px 24px 60px",
            background: "linear-gradient(180deg, var(--accent-soft) 0%, transparent 100%)",
            borderRadius: "0 0 40px 40px",
            marginBottom: "60px"
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--accent-soft)", color: "var(--accent)", padding: "6px 16px", borderRadius: "100px", fontSize: "0.85rem", fontWeight: 700, margin: "0 auto 24px" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent)" }} /> WebGIS Kebencanaan Provinsi Lampung
          </div>
          <h1 style={{ fontSize: "clamp(2.5rem, 4vw, 3.5rem)", fontWeight: 900, margin: "0 auto 20px", color: "var(--ink)", maxWidth: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Sistem Informasi Prediksi Risiko<br />Banjir Rob Terpadu Provinsi Lampung.
          </h1>
          <p style={{ fontSize: "1.1rem", color: "var(--ink-soft)", maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
            Peta digital interaktif untuk memantau prediksi risiko dan melaporkan kejadian banjir rob di kawasan pesisir Provinsi Lampung secara langsung.
          </p>
          <div className="citizen-hero-metrics" style={{ margin: "24px auto 0", maxWidth: 620, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="panel" style={{ padding: 14, textAlign: "left" }}><span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)" }}>Zona risiko tinggi dipantau</span><strong style={{ fontSize: 22 }}>{highRiskCount}</strong></div>
            <div className="panel" style={{ padding: 14, textAlign: "left" }}><span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)" }}>Risiko tertinggi saat ini</span><strong style={{ fontSize: 14 }}>{highestRisk ? `${highestRisk.region?.village ?? "Wilayah pesisir"} · ${Math.round(highestRisk.risk_probability)}%` : "Memuat data…"}</strong></div>
          </div>
        </motion.div>

        {/* Feature 1: Alternating Layout Left */}
        <motion.div className="citizen-guide-grid"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{}}
        >
          <div className="citizen-warning-box">
            <div className="citizen-warning-label"><Icon name="warning" /> Faktor Utama</div>
            <ul className="citizen-warning-list">
              <li><Icon name="warning_amber" /> Pasang laut sangat tinggi</li>
              <li><Icon name="air" /> Angin darat kencang</li>
              <li><Icon name="brightness_3" /> Fase bulan purnama</li>
              <li><Icon name="vertical_align_bottom" /> Penurunan muka tanah</li>
            </ul>
          </div>
          <div>
            <h2 style={{ fontSize: "3rem", fontWeight: 800, color: "var(--ink)", marginBottom: "20px", letterSpacing: "-0.03em", lineHeight: 1.1 }}>Apa itu <span style={{ color: "#0284c7" }}>Banjir Rob?</span></h2>
            <p style={{ fontSize: "1.05rem", color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: "32px" }}>
              Banjir rob adalah genangan air laut yang meluap ke daratan, sering kali terjadi secara berulang. Di pesisir Lampung, fenomena ini tidak hanya dipicu oleh pasang surut astronomis, tetapi juga diperparah oleh cuaca ekstrem dan aktivitas manusia yang menyebabkan penurunan permukaan tanah.
            </p>
            <a href="#/map" className="btn solid" style={{ background: "#0f172a", color: "#fff", padding: "16px 28px", borderRadius: "10px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px", boxShadow: "0 10px 25px rgba(15,23,42,.2)" }}>
              Lihat Peta Risiko <Icon name="arrow_forward" />
            </a>
          </div>
        </motion.div>

        {/* Feature 2: Alternating Layout Right */}
        <motion.div className="citizen-guide-grid"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{}}
        >
          <div style={{ order: 1 }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink)", marginBottom: "20px", letterSpacing: "-0.02em" }}>Cara Membaca Peta Prediksi</h2>
            <p style={{ fontSize: "1.05rem", color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: "32px" }}>
              Sistem prediksi cerdas kami mengubah kemungkinan banjir menjadi empat warna yang mudah dipahami. Ini memudahkan Anda dan petugas untuk mengutamakan tindakan pada area yang paling berisiko.
            </p>
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444" }}></div><strong style={{ minWidth: "120px" }}>Sangat Tinggi</strong><span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>(&gt;75% Probabilitas)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f97316" }}></div><strong style={{ minWidth: "120px" }}>Tinggi</strong><span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>(50–75% Probabilitas)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f59e0b" }}></div><strong style={{ minWidth: "120px" }}>Sedang</strong><span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>(25–50% Probabilitas)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#10b981" }}></div><strong style={{ minWidth: "120px" }}>Rendah</strong><span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>(&lt;25% Probabilitas)</span></div>
            </div>
          </div>
          <div className="citizen-map-frame" style={{ order: 2 }}>
            <MapPreview />
          </div>
        </motion.div>

        {/* Feature 3: Full Width Interactive Style */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "16px", padding: "60px", marginBottom: "80px", textAlign: "center" }}
        >
          <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink)", marginBottom: "16px", letterSpacing: "-0.02em" }}>Cara Melaporkan Kejadian</h2>
          <p style={{ fontSize: "1.05rem", color: "var(--ink-soft)", lineHeight: 1.7, maxWidth: 700, margin: "0 auto 48px" }}>
            Bantu kami menyempurnakan prediksi dengan membagikan kondisi nyata di wilayah Anda. Prosesnya sangat mudah dan langsung terhubung dengan dashboard BPBD.
          </p>
          <div className="citizen-report-flow">
            <div className="citizen-report-step">
              <div className="citizen-step-number">01</div><span className="citizen-step-icon"><Icon name="location_on" /></span>
              <h3>Tentukan Lokasi</h3><p>Letakkan pin pada titik kejadian agar wilayah administratif dapat dikenali secara tepat.</p>
            </div>
            <div className="citizen-report-step">
              <div className="citizen-step-number">02</div><span className="citizen-step-icon"><Icon name="waves" /></span>
              <h3>Isi Detail Keparahan</h3><p>Catat tinggi genangan, waktu kejadian, serta kondisi yang Anda lihat di lapangan.</p>
            </div>
            <div className="citizen-report-step">
              <div className="citizen-step-number">03</div><span className="citizen-step-icon"><Icon name="add_a_photo" /></span>
              <h3>Unggah & Kirim</h3><p>Lampirkan foto pendukung lalu kirim laporan untuk ditinjau oleh operator BPBD.</p>
            </div>
          </div>
          <div style={{ marginTop: "40px" }}>
            <a href={reportHref} className="btn solid" style={{ background: "#0f172a", color: "#fff", padding: "14px 32px", borderRadius: "10px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px" }}>
              Mulai Melapor Sekarang <Icon name="add_circle" />
            </a>
          </div>
        </motion.div>

        {/* Modern FAQ Section */}
        <motion.div className="citizen-faq-grid"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "60px", alignItems: "flex-start" }}
        >
          <div>
            <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink)", marginBottom: "16px", letterSpacing: "-0.02em" }}>FAQ</h2>
            <p style={{ fontSize: "1.05rem", color: "var(--ink-soft)", lineHeight: 1.7 }}>
              Pertanyaan umum mengenai penggunaan portal SIPERAH-RoB dan akurasi model prediksinya.
            </p>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {faqData.map((item, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
                <div 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "24px", background: openFaq === i ? "var(--ocean-light)" : "transparent", transition: "background 0.3s" }}
                >
                  <strong style={{ fontSize: "1.05rem", color: openFaq === i ? "var(--ocean-dark)" : "var(--ink)" }}>{item.q}</strong>
                  <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }}>
                    <Icon name="expand_more" style={{ color: openFaq === i ? "var(--ocean-dark)" : "var(--ink-soft)" }} />
                  </motion.div>
                </div>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }} 
                      animate={{ height: "auto", opacity: 1 }} 
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{ padding: "0 24px 24px", color: "var(--ink-soft)", lineHeight: 1.7, fontSize: "1rem" }}>
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </AppShell>
  );
}
