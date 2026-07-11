import { useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { motion, AnimatePresence } from "framer-motion";

const faqData = [
  {
    q: "Seberapa akurat prediksi banjir rob SIPERAH-RoB?",
    a: "Model Random Forest SIPERAH-RoB mencapai akurasi 87% dengan precision 0.89 dan recall 0.85 berdasarkan evaluasi pada data historis 2018–2024. Performa tertinggi untuk jangkauan 0–3 hari ke depan."
  },
  {
    q: "Data apa yang digunakan model prediksi?",
    a: "Model mengintegrasikan data pasang surut dari BMKG, data batimetri dari BIG, data kependudukan BPS, data historis banjir rob 2018–2024, dan laporan ground truth dari warga yang telah divalidasi BPBD."
  },
  {
    q: "Siapa saja yang bisa menggunakan SIPERAH-RoB?",
    a: "Peta publik dapat diakses oleh siapa saja tanpa login. Fitur pelaporan tersedia untuk warga terdaftar. Dashboard BPBD dikhususkan untuk operator kabupaten/kota dan BPBD Provinsi Lampung."
  },
  {
    q: "Seberapa sering peta diperbarui?",
    a: "Peta prediksi diperbarui setiap hari pukul 05:00 WIB menggunakan data pasang surut terkini dari BMKG. Saat terdapat peristiwa astronomi signifikan (perigee, ekuinoks), pembaruan dilakukan 2 kali sehari."
  }
];

export function OnboardingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <AppShell active="onboarding" title="Panduan Pengguna">
      <div className="content" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 100px" }}>
        
        {/* Modern Cinematic Hero */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1 }}
          style={{ 
            textAlign: "center", 
            padding: "80px 24px 60px",
            background: "linear-gradient(180deg, var(--ocean-light, #e0f2fe) 0%, transparent 100%)",
            borderRadius: "0 0 40px 40px",
            marginBottom: "60px"
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(14, 165, 233, 0.1)", color: "var(--ocean-dark, #0284c7)", padding: "6px 16px", borderRadius: "100px", fontSize: "0.85rem", fontWeight: 700, marginBottom: "24px" }}>
            <Icon name="school" style={{ fontSize: "16px" }} /> Edukasi Mitigasi Pesisir
          </div>
          <h1 style={{ fontSize: "clamp(2.5rem, 4vw, 3.5rem)", fontWeight: 900, margin: "0 auto 20px", color: "var(--ink)", maxWidth: 800, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Memahami Risiko, Mengambil Tindakan.
          </h1>
          <p style={{ fontSize: "1.1rem", color: "var(--ink-soft)", maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
            Pelajari anatomi banjir rob di pesisir Lampung, cara membaca peta probabilitas harian kami, serta peran Anda dalam melaporkan kejadian aktual di lapangan.
          </p>
        </motion.div>

        {/* Feature 1: Alternating Layout Left */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "center", marginBottom: "80px" }}
        >
          <div style={{ background: "linear-gradient(135deg, #f1f5f9, #e2e8f0)", borderRadius: 8, padding: "40px", height: "400px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
            {/* Abstract Graphic */}
            <div style={{ width: "200px", height: "200px", background: "var(--ocean-primary)", borderRadius: "50%", filter: "blur(60px)", opacity: 0.3, position: "absolute", top: 0, right: 0 }}></div>
            <div style={{ width: "250px", height: "250px", background: "#3b82f6", borderRadius: "50%", filter: "blur(80px)", opacity: 0.2, position: "absolute", bottom: "-50px", left: "-50px" }}></div>
            
            <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", padding: "24px", borderRadius: 8, boxShadow: "0 20px 40px rgba(0,0,0,0.05)", position: "relative", zIndex: 10 }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--ocean-dark)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Faktor Penyebab</div>
              <ul style={{ margin: 0, padding: "0 0 0 20px", color: "var(--ink)", lineHeight: 1.8, fontWeight: 500 }}>
                <li>Pasang tinggi (Perigee)</li>
                <li>Angin darat kencang</li>
                <li>Fase bulan purnama</li>
                <li>Penurunan muka tanah</li>
              </ul>
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink)", marginBottom: "20px", letterSpacing: "-0.02em" }}>Apa itu Banjir Rob?</h2>
            <p style={{ fontSize: "1.05rem", color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: "32px" }}>
              Banjir rob adalah genangan air laut yang meluap ke daratan, sering kali terjadi secara berulang. Di pesisir Lampung, fenomena ini tidak hanya dipicu oleh pasang surut astronomis, tetapi juga diperparah oleh cuaca ekstrem dan aktivitas manusia yang menyebabkan penurunan permukaan tanah.
            </p>
            <a href="#/map" className="btn solid" style={{ background: "var(--ocean-primary)", color: "#fff", padding: "12px 24px", borderRadius: "100px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px", boxShadow: "0 8px 24px rgba(14,165,233,0.3)" }}>
              Lihat Peta Risiko <Icon name="arrow_forward" />
            </a>
          </div>
        </motion.div>

        {/* Feature 2: Alternating Layout Right */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "center", marginBottom: "100px" }}
        >
          <div style={{ order: 1 }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink)", marginBottom: "20px", letterSpacing: "-0.02em" }}>Cara Membaca Peta Prediksi</h2>
            <p style={{ fontSize: "1.05rem", color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: "32px" }}>
              Sistem AI kami memproyeksikan probabilitas banjir ke dalam empat kelas warna yang intuitif. Hal ini memudahkan Anda dan pengambil kebijakan untuk memprioritaskan tindakan mitigasi pada area yang paling berisiko.
            </p>
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444" }}></div><strong style={{ minWidth: "120px" }}>Sangat Tinggi</strong><span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>(&gt;75% Probabilitas)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f97316" }}></div><strong style={{ minWidth: "120px" }}>Tinggi</strong><span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>(50–75% Probabilitas)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f59e0b" }}></div><strong style={{ minWidth: "120px" }}>Sedang</strong><span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>(25–50% Probabilitas)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#10b981" }}></div><strong style={{ minWidth: "120px" }}>Rendah</strong><span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>(&lt;25% Probabilitas)</span></div>
            </div>
          </div>
          <div style={{ order: 2, background: "var(--ocean-primary)", borderRadius: 8, padding: "40px", height: "400px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ width: "80%", height: "80%", background: "url('https://maps.wikimedia.org/osm-intl/12/3246/2117.png')", backgroundSize: "cover", borderRadius: 8, border: "4px solid rgba(255,255,255,0.2)", position: "absolute", filter: "grayscale(30%) sepia(20%) hue-rotate(180deg)" }}></div>
            <div style={{ position: "absolute", width: "40px", height: "40px", background: "#ef4444", borderRadius: "50%", top: "40%", left: "45%", boxShadow: "0 0 0 10px rgba(239,68,68,0.3)" }}></div>
            <div style={{ position: "absolute", width: "30px", height: "30px", background: "#f97316", borderRadius: "50%", top: "55%", left: "60%", boxShadow: "0 0 0 8px rgba(249,115,22,0.3)" }}></div>
          </div>
        </motion.div>

        {/* Feature 3: Full Width Interactive Style */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "40px", padding: "60px", marginBottom: "80px", textAlign: "center" }}
        >
          <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink)", marginBottom: "16px", letterSpacing: "-0.02em" }}>Cara Melaporkan Kejadian</h2>
          <p style={{ fontSize: "1.05rem", color: "var(--ink-soft)", lineHeight: 1.7, maxWidth: 700, margin: "0 auto 48px" }}>
            Bantu kami memvalidasi model AI dengan membagikan kondisi riil di wilayah Anda. Prosesnya sangat mudah dan terintegrasi langsung dengan dashboard BPBD.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", maxWidth: 900, margin: "0 auto" }}>
            <div style={{ background: "var(--bg)", padding: "32px", borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--ocean-light)", color: "var(--ocean-dark)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontWeight: 800, fontSize: "1.2rem" }}>1</div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "12px" }}>Tentukan Lokasi</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)" }}>Pin lokasi Anda pada peta interaktif yang disediakan.</p>
            </div>
            <div style={{ background: "var(--bg)", padding: "32px", borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--ocean-light)", color: "var(--ocean-dark)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontWeight: 800, fontSize: "1.2rem" }}>2</div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "12px" }}>Isi Detail Keparahan</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)" }}>Tulis tinggi genangan dan kondisi cuaca saat kejadian berlangsung.</p>
            </div>
            <div style={{ background: "var(--bg)", padding: "32px", borderRadius: 8, border: "1px solid var(--line)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--ocean-light)", color: "var(--ocean-dark)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontWeight: 800, fontSize: "1.2rem" }}>3</div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "12px" }}>Unggah & Kirim</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)" }}>Sertakan foto bukti agar validasi oleh BPBD dapat berjalan cepat.</p>
            </div>
          </div>
          <div style={{ marginTop: "40px" }}>
            <a href="#/reports/new" className="btn solid" style={{ background: "var(--ocean-dark)", color: "#fff", padding: "14px 32px", borderRadius: "100px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px" }}>
              Mulai Melapor Sekarang <Icon name="add_circle" />
            </a>
          </div>
        </motion.div>

        {/* Modern FAQ Section */}
        <motion.div 
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
