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
      <div className="onboarding-page-container">
        {/* Decorative background blobs for premium feel */}
        <div className="onboarding-blob blob-1" />
        <div className="onboarding-blob blob-2" />
        
        <div className="content" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 100px", position: "relative", zIndex: 1 }}>
          <style>{`
            .app-content:has(.onboarding-page-container) {
              padding: 0 !important;
            }
            .onboarding-page-container {
              min-height: 100vh;
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%);
              position: relative;
              overflow: hidden;
            }
            :root[data-theme="dark"] .onboarding-page-container {
              background: linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e293b 100%);
            }
            .onboarding-blob {
              position: absolute;
              border-radius: 50%;
              z-index: 0;
            }
            .blob-1 {
              top: -10%; right: -5%; width: 40vw; height: 40vw;
              background: radial-gradient(circle, rgba(2,132,199,0.15) 0%, rgba(255,255,255,0) 70%);
              filter: blur(60px);
            }
            .blob-2 {
              bottom: -10%; left: -10%; width: 50vw; height: 50vw;
              background: radial-gradient(circle, rgba(14,165,233,0.2) 0%, rgba(255,255,255,0) 70%);
              filter: blur(80px);
            }
            :root[data-theme="dark"] .blob-1 {
              background: radial-gradient(circle, rgba(56,189,248,0.1) 0%, rgba(0,0,0,0) 70%);
            }
            :root[data-theme="dark"] .blob-2 {
              background: radial-gradient(circle, rgba(14,165,233,0.1) 0%, rgba(0,0,0,0) 70%);
            }
            
            .citizen-guide-grid { display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:stretch; margin-bottom:110px; }
            .citizen-warning-box { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.08); display:flex; flex-direction:column; justify-content:center; padding:32px; transition: transform 0.3s ease; }
            :root[data-theme="dark"] .citizen-warning-box { background: rgba(30, 41, 59, 0.6); border-color: rgba(255,255,255,0.05); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
            .citizen-warning-box:hover { transform: translateY(-5px); }
            .citizen-warning-label { align-items:center; background:rgba(245, 158, 11, 0.15); border:1px solid rgba(245, 158, 11, 0.3); border-radius:12px; color:#d97706; display:inline-flex; font-size:13px; font-weight:800; gap:8px; letter-spacing:.08em; margin-bottom:20px; padding:8px 14px; text-transform:uppercase; }
            :root[data-theme="dark"] .citizen-warning-label { color: #f59e0b; background: rgba(245, 158, 11, 0.2); }
            .citizen-warning-list { display:grid; list-style:none; margin:0; padding:0; }
            .citizen-warning-list li { align-items:center; border-bottom:1px solid rgba(0,0,0,0.05); display:flex; font-size:1.05rem; font-weight:600; color: #1e293b; gap:12px; padding:16px 4px; }
            :root[data-theme="dark"] .citizen-warning-list li { color: #f8fafc; border-bottom-color: rgba(255,255,255,0.05); }
            .citizen-warning-list li:last-child { border:0; }
            .citizen-warning-list .material-symbols-outlined, .citizen-warning-label .material-symbols-outlined { color:#d97706; font-size:22px; }
            .citizen-map-frame { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(16px); border:1px solid rgba(255, 255, 255, 0.5); border-radius:24px; min-height:400px; overflow:hidden; padding:12px; box-shadow: 0 20px 40px rgba(0,0,0,0.08); }
            :root[data-theme="dark"] .citizen-map-frame { background: rgba(30, 41, 59, 0.6); border-color: rgba(255,255,255,0.05); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
            .citizen-report-flow { display:grid; gap:28px; grid-template-columns:repeat(3,minmax(0,1fr)); margin:0 auto; max-width:940px; }
            .citizen-report-step { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(12px); border:1px solid rgba(255, 255, 255, 0.6); border-radius:24px; min-height:260px; padding:32px 26px; text-align:center; box-shadow: 0 10px 30px rgba(0,0,0,0.05); transition: all 0.3s ease; }
            :root[data-theme="dark"] .citizen-report-step { background: rgba(30, 41, 59, 0.6); border-color: rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
            .citizen-report-step:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,100,200,0.1); border-color: rgba(255,255,255,0.9); background: rgba(255, 255, 255, 0.85); }
            :root[data-theme="dark"] .citizen-report-step:hover { background: rgba(30, 41, 59, 0.9); border-color: rgba(255,255,255,0.15); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
            .citizen-step-number { align-items:center; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color:#fff; border-radius:50%; box-shadow: 0 8px 20px rgba(2,132,199,0.3); display:flex; font-size:16px; font-weight:800; height:54px; justify-content:center; margin:0 auto 28px; width:54px; }
            .citizen-step-icon { align-items:center; background:rgba(2,132,199,0.1); border-radius:12px; color:#0284c7; display:flex; height:42px; justify-content:center; margin:0 auto 16px; width:42px; }
            :root[data-theme="dark"] .citizen-step-icon { background: rgba(56,189,248,0.15); color: #38bdf8; }
            .citizen-report-step h3 { font-size:1.15rem; font-weight: 700; color: #0f172a; margin:0 0 12px; }
            :root[data-theme="dark"] .citizen-report-step h3 { color: #f8fafc; }
            .citizen-report-step p { font-size:0.95rem; color: #475569; line-height:1.6; margin:0 auto; max-width:28ch; }
            :root[data-theme="dark"] .citizen-report-step p { color: #94a3b8; }
            .citizen-feature-box { background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border:1px solid rgba(255, 255, 255, 0.6); border-radius:32px; padding:70px; margin-bottom:80px; text-align:center; box-shadow: 0 24px 50px rgba(0,0,0,0.06); }
            :root[data-theme="dark"] .citizen-feature-box { background: rgba(30, 41, 59, 0.5); border-color: rgba(255,255,255,0.05); }
            .citizen-hero-metrics .panel { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 16px; transition: transform 0.2s ease; }
            :root[data-theme="dark"] .citizen-hero-metrics .panel { background: rgba(30, 41, 59, 0.6); border-color: rgba(255,255,255,0.05); }
            .citizen-hero-metrics .panel:hover { transform: scale(1.03); background: rgba(255, 255, 255, 0.85); }
            :root[data-theme="dark"] .citizen-hero-metrics .panel:hover { background: rgba(30, 41, 59, 0.9); }
            .faq-item { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 16px; overflow: hidden; margin-bottom: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); transition: all 0.3s ease; }
            :root[data-theme="dark"] .faq-item { background: rgba(30, 41, 59, 0.5); border-color: rgba(255,255,255,0.05); }
            .faq-item:hover { background: rgba(255, 255, 255, 0.85); border-color: rgba(255, 255, 255, 0.8); box-shadow: 0 8px 25px rgba(0,0,0,0.06); }
            :root[data-theme="dark"] .faq-item:hover { background: rgba(30, 41, 59, 0.8); border-color: rgba(255,255,255,0.1); }
            .dark-text { color: var(--ink); }
            .dark-text-soft { color: var(--ink-soft); }
            .faq-q-text { font-size: 1.1rem; font-weight: 700; color: #0f172a; }
            :root[data-theme="dark"] .faq-q-text { color: #f8fafc; }
            .faq-q-text.active { color: #0284c7; }
            :root[data-theme="dark"] .faq-q-text.active { color: #38bdf8; }
            .faq-a-text { color: #475569; }
            :root[data-theme="dark"] .faq-a-text { color: #cbd5e1; }
            
            @media(max-width:768px){ 
              .citizen-guide-grid,.citizen-report-flow,.citizen-faq-grid{grid-template-columns:1fr!important;gap:32px!important}
              .citizen-map-frame{min-height:300px}
              .citizen-hero-metrics{grid-template-columns:1fr!important} 
              .citizen-feature-box{padding:32px!important; margin-bottom:40px!important; border-radius: 24px;}
              .citizen-report-step p { max-width:100%!important; }
              .onboarding-hero { padding: 40px 16px 40px !important; margin-bottom: 24px !important; }
            }
          `}</style>
          
          {/* Modern Cinematic Hero */}
          <motion.div
            className="onboarding-hero"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ 
              textAlign: "center", 
              padding: "90px 24px 70px",
              marginBottom: "40px"
            }}
          >
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--accent-soft)", color: "var(--accent)", padding: "6px 16px", borderRadius: "100px", fontSize: "0.85rem", fontWeight: 700, margin: "0 auto 24px" }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent)" }} /> WebGIS Kebencanaan Provinsi Lampung
          </div>
          <h1 className="dark-text" style={{ fontSize: "clamp(2.5rem, 4vw, 3.5rem)", fontWeight: 900, margin: "0 auto 20px", maxWidth: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Sistem Informasi Prediksi Risiko<br />Banjir Rob Terpadu Provinsi Lampung.
          </h1>
          <p className="dark-text-soft" style={{ fontSize: "1.1rem", maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
            Peta digital interaktif untuk memantau prediksi risiko dan melaporkan kejadian banjir rob di kawasan pesisir Provinsi Lampung secara langsung.
          </p>
          <div className="citizen-hero-metrics" style={{ margin: "24px auto 0", maxWidth: 620, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="panel" style={{ padding: 14, textAlign: "left" }}><span className="dark-text-soft" style={{ display: "block", fontSize: 12 }}>Zona risiko tinggi dipantau</span><strong className="dark-text" style={{ fontSize: 22 }}>{highRiskCount}</strong></div>
            <div className="panel" style={{ padding: 14, textAlign: "left" }}><span className="dark-text-soft" style={{ display: "block", fontSize: 12 }}>Risiko tertinggi saat ini</span><strong className="dark-text" style={{ fontSize: 14 }}>{highestRisk ? `${highestRisk.region?.village ?? "Wilayah pesisir"} · ${Math.round(highestRisk.risk_probability)}%` : "Memuat data…"}</strong></div>
          </div>
        </motion.div>

        {/* Feature 1: Alternating Layout Left */}
        <motion.div className="citizen-guide-grid"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
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
            <h2 className="dark-text" style={{ fontSize: "3rem", fontWeight: 800, marginBottom: "20px", letterSpacing: "-0.03em", lineHeight: 1.1 }}>Apa itu <span style={{ color: "#0ea5e9" }}>Banjir Rob?</span></h2>
            <p className="dark-text-soft" style={{ fontSize: "1.05rem", lineHeight: 1.7, marginBottom: "32px" }}>
              Banjir rob adalah genangan air laut yang meluap ke daratan, sering kali terjadi secara berulang. Di pesisir Lampung, fenomena ini tidak hanya dipicu oleh pasang surut astronomis, tetapi juga diperparah oleh cuaca ekstrem dan aktivitas manusia yang menyebabkan penurunan permukaan tanah.
            </p>
            <a href="#/map" className="btn primary" style={{ padding: "16px 28px", borderRadius: "10px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px", boxShadow: "0 10px 25px rgba(2,132,199,.2)" }}>
              Lihat Peta Risiko <Icon name="arrow_forward" />
            </a>
          </div>
        </motion.div>

        {/* Feature 2: Alternating Layout Right */}
        <motion.div className="citizen-guide-grid"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <div style={{ order: 1 }}>
            <h2 className="dark-text" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "20px", letterSpacing: "-0.02em" }}>Cara Membaca Peta Prediksi</h2>
            <p className="dark-text-soft" style={{ fontSize: "1.05rem", lineHeight: 1.7, marginBottom: "32px" }}>
              Sistem prediksi cerdas kami mengubah kemungkinan banjir menjadi empat warna yang mudah dipahami. Ini memudahkan Anda dan petugas untuk mengutamakan tindakan pada area yang paling berisiko.
            </p>
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444" }}></div><strong className="dark-text" style={{ minWidth: "120px" }}>Sangat Tinggi</strong><span className="dark-text-soft" style={{ fontSize: "0.95rem" }}>(&gt;75% Probabilitas)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f97316" }}></div><strong className="dark-text" style={{ minWidth: "120px" }}>Tinggi</strong><span className="dark-text-soft" style={{ fontSize: "0.95rem" }}>(50–75% Probabilitas)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f59e0b" }}></div><strong className="dark-text" style={{ minWidth: "120px" }}>Sedang</strong><span className="dark-text-soft" style={{ fontSize: "0.95rem" }}>(25–50% Probabilitas)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#10b981" }}></div><strong className="dark-text" style={{ minWidth: "120px" }}>Rendah</strong><span className="dark-text-soft" style={{ fontSize: "0.95rem" }}>(&lt;25% Probabilitas)</span></div>
            </div>
          </div>
          <div className="citizen-map-frame" style={{ order: 2 }}>
            <MapPreview />
          </div>
        </motion.div>

        {/* Feature 3: Full Width Interactive Style */}
        <motion.div 
          className="citizen-feature-box"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
        >
          <h2 className="dark-text" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "16px", letterSpacing: "-0.02em" }}>Cara Melaporkan Kejadian</h2>
          <p className="dark-text-soft" style={{ fontSize: "1.05rem", lineHeight: 1.7, maxWidth: 700, margin: "0 auto 48px" }}>
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
            <a href={reportHref} className="btn primary" style={{ padding: "14px 32px", borderRadius: "10px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px", boxShadow: "0 10px 25px rgba(2,132,199,.2)" }}>
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
            <h2 className="dark-text" style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "16px", letterSpacing: "-0.02em" }}>FAQ</h2>
            <p className="dark-text-soft" style={{ fontSize: "1.05rem", lineHeight: 1.7 }}>
              Pertanyaan umum mengenai penggunaan portal SIPERAH-RoB dan akurasi model prediksinya.
            </p>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {faqData.map((item, i) => (
              <div key={i} className="faq-item">
                <div 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "24px", transition: "background 0.3s" }}
                >
                  <strong className={`faq-q-text ${openFaq === i ? 'active' : ''}`}>{item.q}</strong>
                  <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.3 }}>
                    <Icon name="expand_more" style={{ color: openFaq === i ? "#0ea5e9" : "var(--ink-soft)", fontSize: "24px" }} />
                  </motion.div>
                </div>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }} 
                      animate={{ height: "auto", opacity: 1 }} 
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="faq-a-text" style={{ padding: "0 24px 24px", lineHeight: 1.7, fontSize: "1.05rem" }}>
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
      </div>
    </AppShell>
  );
}
