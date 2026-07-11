import { useState } from "react";
import { Icon } from "../shared/components/Icon";
import { MapPreview } from "../shared/components/MapPreview";
import { motion, AnimatePresence } from "framer-motion";

const faqData = [
  {
    q: "Seberapa akurat prediksi banjir rob SIPERAH-RoB?",
    a: "Prediksi digunakan sebagai alat kewaspadaan, bukan kepastian kejadian. Selalu gunakan informasi risiko bersama arahan resmi BPBD dan kondisi nyata di lapangan."
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
    a: "Peta menampilkan data prediksi terbaru yang tersedia di sistem. Jadwal pembaruan mengikuti import data dan pipeline prediksi yang dikelola operator."
  }
];

export function PortalPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const userStr = localStorage.getItem("siperah-user");
  let dashboardRoute = "#/login";
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const roleMap: Record<string, string> = {
        admin: "#/admin/users",
        bpbd_operator: "#/operator",
        bpbd_provinsi: "#/province",
        warga: "#/map",
        peneliti: "#/research"
      };
      dashboardRoute = roleMap[user.role] || "#/login";
    } catch (e) {}
  }

  return (
    <div className="siperah-landing-root">
      {/* Google Fonts Load */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

      <style>{`
        /* Elite Design System Styles */
        .siperah-landing-root {
          --bg-primary: #f1f5f9;
          --bg-card: #FFFFFF;
          --bg-card-dark: #0f172a;
          --ink-primary: #0f172a;
          --ink-muted: #475569;
          --border-color: #e2e8f0;
          --accent-blue: #1d4ed8;
          --accent-blue-soft: #eff6ff;
          
          background-color: var(--bg-primary);
          color: var(--ink-primary);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          width: 100%;
          position: relative;
          overflow-x: hidden;
          padding-bottom: 120px;
        }

        /* Full-Width Editorial Header */
        .landing-header-full {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          height: 72px;
          padding: 0 60px;
          background: rgba(241, 245, 249, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-color);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.01);
        }
        .brand-link {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          font-size: 1.15rem;
          letter-spacing: -0.02em;
          color: var(--ink-primary);
          text-decoration: none;
        }
        .brand-logo-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          background: #ffffff;
          color: #2563eb;
          border: 2px solid #2563eb;
          border-radius: 8px;
          font-size: 1.1rem;
        }
        .nav-links-wrap {
          display: flex;
          align-items: center;
          gap: 40px;
        }
        .nav-links-wrap a {
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--ink-muted);
          text-decoration: none;
          transition: color 0.2s ease;
          position: relative;
        }
        .nav-links-wrap a:hover {
          color: var(--ink-primary);
        }
        .nav-links-wrap a::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: var(--accent-blue);
          transition: width 0.2s ease;
        }
        .nav-links-wrap a:hover::after {
          width: 100%;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .btn-link-login {
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--ink-primary);
          text-decoration: none;
          padding: 8px 16px;
          transition: opacity 0.2s ease;
        }
        .btn-link-login:hover {
          opacity: 0.8;
        }
        .btn-nav-primary {
          font-size: 0.92rem;
          font-weight: 600;
          color: #fff;
          background: var(--ink-primary);
          border: 1px solid var(--ink-primary);
          border-radius: 100px;
          padding: 10px 24px;
          text-decoration: none;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(18, 19, 20, 0.08);
        }
        .btn-nav-primary:hover {
          background: transparent;
          color: var(--ink-primary);
        }

        /* Cinematic Hero Section */
        .hero-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 180px 40px 100px;
          text-align: center;
          position: relative;
          z-index: 10;
        }
        .hero-section h1 {
          font-size: clamp(2.8rem, 5.5vw, 5.2rem);
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: -0.04em;
          color: var(--ink-primary);
          max-width: 1050px;
          margin: 0 auto 28px;
        }
        .hero-section h1 span.highlight {
          color: var(--accent-blue);
        }
        /* Inline Typography Image Pill */
        .inline-pill-img {
          display: inline-block;
          width: 90px;
          height: 48px;
          border-radius: 100px;
          align-middle: middle;
          background-image: url('https://picsum.photos/seed/coastal/400/200');
          background-size: cover;
          background-position: center;
          margin: 0 12px;
          border: 1.5px solid rgba(255,255,255,0.8);
          box-shadow: 0 4px 15px rgba(0,0,0,0.08);
          transform: translateY(6px);
        }
        .hero-section p {
          font-size: clamp(1rem, 1.8vw, 1.25rem);
          line-height: 1.55;
          color: var(--ink-muted);
          max-width: 720px;
          margin: 0 auto 40px;
        }
        .hero-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 120px;
        }
        .btn-hero-primary {
          font-size: 0.95rem;
          font-weight: 600;
          color: #fff;
          background: var(--ink-primary);
          border: 1px solid var(--ink-primary);
          border-radius: 100px;
          padding: 14px 36px;
          text-decoration: none;
          transition: all 0.2s ease;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
        }
        .btn-hero-primary:hover {
          background: transparent;
          color: var(--ink-primary);
          transform: translateY(-2px);
        }
        .btn-hero-secondary {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--ink-primary);
          background: #fff;
          border: 1px solid var(--border-color);
          border-radius: 100px;
          padding: 14px 36px;
          text-decoration: none;
          transition: all 0.2s ease;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
        }
        .btn-hero-secondary:hover {
          border-color: var(--ink-primary);
          transform: translateY(-2px);
        }

        /* Abstract Grid / Radial Background Details */
        .siperah-landing-root .ambient-grid {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          background-image: 
            linear-gradient(rgba(241, 245, 249, 0.6), rgba(241, 245, 249, 1)),
            linear-gradient(rgba(148, 163, 184, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.2) 1px, transparent 1px),
            url('/bg-laut.jpg');
          background-size: 100% 100%, 80px 80px, 80px 80px, cover;
          background-position: center;
          z-index: 1;
          pointer-events: none;
        }

        /* Infinite Horizontal Marquee (Partners) */
        .marquee-container {
          width: 100%;
          overflow: hidden;
          border-top: 1px solid var(--border-color);
          border-bottom: 1px solid var(--border-color);
          background: rgba(241, 245, 249, 0.5);
          padding: 24px 0;
          margin-bottom: 140px;
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee-scroll 25s linear infinite;
        }
        .marquee-content {
          display: flex;
          align-items: center;
          gap: 80px;
          padding-right: 80px;
        }
        .marquee-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 800;
          font-size: 0.95rem;
          color: var(--ink-primary);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .marquee-item span {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: rgba(18, 19, 20, 0.06);
          border-radius: 4px;
          color: var(--ink-primary);
        }
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        /* Gapless Bento Grid Section */
        .bento-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 40px;
          position: relative;
          z-index: 10;
        }
        .bento-header-wrap {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 48px;
        }
        .bento-header-wrap h2 {
          font-size: 2.2rem;
          font-weight: 850;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin: 0;
        }
        .bento-header-wrap p {
          font-size: 0.98rem;
          color: var(--ink-muted);
          max-width: 420px;
          margin: 0;
          line-height: 1.5;
        }
        .bento-container-grid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          grid-auto-flow: dense;
          gap: 20px;
        }
        .bento-card-el {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 24px;
          padding: 36px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          position: relative;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bento-card-el:hover {
          transform: translateY(-4px);
          border-color: var(--ink-primary);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.03);
        }

        /* Bento Grid Math Span allocations (Zero-Gap Interlock) */
        .card-span-7 { grid-column: span 7; }
        .card-span-5 { grid-column: span 5; }
        
        .bento-card-el.dark-theme {
          background: var(--bg-card-dark);
          color: #fff;
          border-color: var(--bg-card-dark);
        }
        .bento-card-el.dark-theme h3 { color: #fff; }
        .bento-card-el.dark-theme p { color: rgba(255, 255, 255, 0.7); }
        .bento-card-el.dark-theme:hover {
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }

        /* Card Content Inner details */
        .card-meta-title {
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--accent-blue);
          margin-bottom: 24px;
          display: block;
        }
        .dark-theme .card-meta-title {
          color: #60A5FA;
        }
        .bento-card-el h3 {
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.2;
          margin-bottom: 14px;
          color: var(--ink-primary);
        }
        .bento-card-el p {
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--ink-muted);
          margin-bottom: 32px;
          max-width: 500px;
        }
        .card-links-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 24px;
          margin-top: auto;
          border-top: 1px solid var(--border-color);
          padding-top: 24px;
        }
        .dark-theme .card-links-row {
          border-color: rgba(255, 255, 255, 0.1);
        }
        .card-action-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.88rem;
          font-weight: 600;
          color: inherit;
          text-decoration: none;
          transition: transform 0.2s ease;
        }
        .card-action-link:hover {
          transform: translateX(4px);
        }
        .card-action-link span {
          font-size: 1rem;
        }

        /* Inline visuals in Bento Cards */
        .card-preview-container {
          margin-bottom: 28px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border-color);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
        }
        .dark-theme .card-preview-container {
          border-color: rgba(255, 255, 255, 0.1);
        }

        /* Large Mock Table/Stats for Admin Bento Grid card */
        .mock-logs-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
          text-align: left;
          background: var(--bg-primary);
          border-radius: 12px;
          overflow: hidden;
        }
        .mock-logs-table th, .mock-logs-table td {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(18, 19, 20, 0.05);
        }
        .mock-logs-table th {
          background: rgba(18, 19, 20, 0.03);
          font-weight: 700;
        }
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .status-badge.success { background: #DCFCE7; color: #15803D; }
        .status-badge.fail { background: #FEE2E2; color: #B91C1C; }

        /* Floating Mitigasi Help Trigger */
        .mitigasi-trigger {
          position: fixed;
          bottom: 36px;
          right: 36px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--ink-primary);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
          text-decoration: none;
          z-index: 99;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .mitigasi-trigger:hover {
          transform: scale(1.1);
        }
        .mitigasi-trigger span {
          font-size: 1.5rem;
        }

        /* Large Footer Section */
        .landing-footer {
          max-width: 1200px;
          margin: 140px auto 0;
          padding: 0 40px;
          border-top: 1px solid var(--border-color);
          padding-top: 60px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .footer-brand {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--ink-muted);
        }
        .footer-links {
          display: flex;
          gap: 32px;
          font-size: 0.88rem;
          color: var(--ink-muted);
        }
        .footer-links a {
          text-decoration: none;
          transition: color 0.2s ease;
        }
        .footer-links a:hover {
          color: var(--ink-primary);
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .bento-container-grid { display: flex; flex-direction: column; }
          .hero-section { padding: 100px 24px 60px; }
          .hero-section h1 { font-size: 3.5rem; }
          .marquee-container { margin-bottom: 80px; }
          .landing-footer { flex-direction: column; gap: 24px; text-align: center; }
        }
        @media (max-width: 768px) {
          .nav-links-wrap { display: none !important; }
          .header-actions .btn-link-login { display: none; }
          .hero-section { padding: 100px 16px 40px !important; }
          .hero-section h1 { font-size: 2.2rem !important; line-height: 1.15; margin-bottom: 20px; }
          .hero-section p { font-size: 1rem !important; margin-bottom: 24px; padding: 0 10px; }
          .hero-actions { flex-direction: column; gap: 12px !important; margin-bottom: 60px !important; }
          .hero-actions > a { width: 100%; box-sizing: border-box; text-align: center; }
          .inline-pill-img { display: none; }
          .marquee-container { height: 160px; }
          .bento-card-el { padding: 24px; }
          .landing-header-full { padding: 0 20px; background: rgba(255, 255, 255, 0.7) !important; backdrop-filter: blur(12px); }
          .bento-header-wrap { flex-direction: column; align-items: flex-start !important; gap: 16px; margin-bottom: 32px !important; }
          .bento-header-wrap h2 { font-size: 1.8rem !important; }
        }
      `}</style>

      {/* Grid Ambient Background Pattern */}
      <div className="ambient-grid"></div>

      {/* Full-Width Header */}
        <header className="landing-header-full">
          <a className="brand-link" href="#/" style={{ gap: "12px" }}>
            <img src="/logo.png" alt="Logo SIPERAH" style={{ width: "48px", height: "48px", objectFit: "contain", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }} />
            SIPERAH-RoB
          </a>
        <nav className="nav-links-wrap">
          <a href="#/map">Peta Publik</a>
          <a href="#/awam">Mode Awam</a>
          <a href="#panduan">Panduan</a>
        </nav>
        <div className="header-actions">
          {localStorage.getItem("siperah-token") ? (
            <a className="btn-link-login" href={dashboardRoute}>Dashboard</a>
          ) : (
            <a className="btn-link-login" href="#/login">Login</a>
          )}
          <a className="btn-nav-primary" href="#/map">Buka Peta</a>
        </div>
      </header>

      {/* Cinematic Center Hero */}
      <section className="hero-section">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="hero-kicker"
          style={{ display: "inline-block", padding: "6px 16px", background: "rgba(37, 99, 235, 0.1)", color: "var(--accent-blue)", borderRadius: "100px", fontSize: "0.85rem", fontWeight: 700, marginBottom: "24px" }}
        >
          WebGIS Kebencanaan Provinsi Lampung
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        >
          Sistem Prediksi Cerdas<br />
          Banjir Rob Lampung.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          Peta digital interaktif untuk memantau prediksi risiko dan melaporkan kejadian banjir rob di kawasan pesisir Provinsi Lampung secara langsung.
        </motion.p>
        <motion.div
          className="hero-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        >
          <a className="btn-hero-primary" href="#/map">
            Buka Peta Risiko
          </a>
          <a className="btn-hero-secondary" href="#/awam">
            Akses Mode Awam
          </a>
        </motion.div>
      </section>

      {/* Infinite Scrolling Marquee Row */}
      <section className="marquee-container">
        <div className="marquee-track">
          <div className="marquee-content">
            <div className="marquee-item"><span><Icon name="radar" /></span> BMKG Pasang Surut</div>
            <div className="marquee-item"><span><Icon name="map" /></span> Geospasial BIG</div>
            <div className="marquee-item"><span><Icon name="analytics" /></span> Sensus Penduduk BPS</div>
            <div className="marquee-item"><span><Icon name="security" /></span> Pusdalops BPBD Lampung</div>
          </div>
          <div className="marquee-content">
            <div className="marquee-item"><span><Icon name="radar" /></span> BMKG Pasang Surut</div>
            <div className="marquee-item"><span><Icon name="map" /></span> Geospasial BIG</div>
            <div className="marquee-item"><span><Icon name="analytics" /></span> Sensus Penduduk BPS</div>
            <div className="marquee-item"><span><Icon name="security" /></span> Pusdalops BPBD Lampung</div>
          </div>
        </div>
      </section>

      {/* Bento Layout Grid */}
      <section className="bento-section">
        <div className="bento-header-wrap">
          <div>
            <h2>Portal Sistem Terpadu</h2>
          </div>
          <div>
            <p>Satu basis data untuk berbagai peran. Pilih modul operasional di bawah untuk melanjutkan aktivitas.</p>
          </div>
        </div>

        <div className="bento-container-grid">
          {/* Card 1: Portal Publik (col-span-8) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="bento-card-el card-span-7"
          >
            <div>
              <span className="card-meta-title">Public Access</span>
              <h3>Portal Publik</h3>
              <p>
                Akses peta interaktif peringatan dini bahaya rob, panduan mitigasi, dan laporan ground truth untuk masyarakat umum.
              </p>

              <div className="card-preview-container">
                <MapPreview />
              </div>
            </div>
            <div className="card-links-row">
              <a className="card-action-link" href="#/map">Akses Sistem <Icon name="arrow_forward" /></a>
              <a className="card-action-link" href="#/onboarding">Panduan Mitigasi <Icon name="arrow_forward" /></a>
            </div>
          </motion.div>

          {/* Card 2: Dashboard BPBD (col-span-4) - Dark Theme for Contrast */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="bento-card-el card-span-5 dark-theme"
          >
            <div>
              <span className="card-meta-title">BPBD Command Center</span>
              <h3>Dashboard BPBD</h3>
              <p>
                Pusat kendali dan monitoring prediksi risiko, analisis dampak, dan manajemen logistik untuk operator dan pengambil keputusan.
              </p>
              
              <div style={{ marginTop: 40, width: "100%", height: 180, background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", padding: 16, gap: 12 }}>
                <div style={{ display: "flex", gap: 8 }}>
                   <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                   <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                   <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981" }} />
                </div>
                <div style={{ display: "flex", gap: 12, flex: 1 }}>
                   <div style={{ width: "35%", height: "100%", background: "rgba(255,255,255,0.06)", borderRadius: 8 }} />
                   <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                     <div style={{ width: "100%", height: "35%", background: "rgba(255,255,255,0.06)", borderRadius: 8 }} />
                     <div style={{ width: "100%", flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: 8 }} />
                   </div>
                </div>
              </div>
            </div>
            <div className="card-links-row">
              <a className="card-action-link" href="#/login">Masuk Dashboard <Icon name="arrow_forward" /></a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Panduan Section */}
      <section id="panduan" className="guide-section" style={{ maxWidth: '1200px', margin: '100px auto', padding: '0 40px' }}>
        <motion.div
          className="bento-header-wrap"
          style={{ marginBottom: '60px' }}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2>Panduan</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "60px", alignItems: "center", marginBottom: "120px" }}
        >
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "var(--accent-blue-soft)", padding: "8px 16px", borderRadius: "100px", fontSize: "13px", fontWeight: 700, color: "var(--accent-blue)", marginBottom: "24px", textTransform: "uppercase", letterSpacing: "1px" }}>
              <Icon name="warning" /> Faktor Utama
            </div>
            <ul style={{ margin: 0, padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "16px" }}>
              <li style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "1.15rem", fontWeight: 600, color: "var(--ink-primary)" }}>
                <Icon name="check_circle" style={{ color: "var(--accent-blue)" }} /> Pasang tinggi (Perigee)
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "1.15rem", fontWeight: 600, color: "var(--ink-primary)" }}>
                <Icon name="check_circle" style={{ color: "var(--accent-blue)" }} /> Angin darat kencang
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "1.15rem", fontWeight: 600, color: "var(--ink-primary)" }}>
                <Icon name="check_circle" style={{ color: "var(--accent-blue)" }} /> Fase bulan purnama
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "1.15rem", fontWeight: 600, color: "var(--ink-primary)" }}>
                <Icon name="check_circle" style={{ color: "var(--accent-blue)" }} /> Penurunan muka tanah
              </li>
            </ul>
          </div>
          <div>
            <h2 style={{ fontSize: "3rem", fontWeight: 800, color: "var(--ink-primary)", marginBottom: "24px", letterSpacing: "-0.03em", lineHeight: 1.1 }}>Apa itu <span style={{ color: "#0284c7" }}>Banjir Rob?</span></h2>
            <p style={{ fontSize: "1.15rem", color: "var(--ink-muted)", lineHeight: 1.8, marginBottom: "40px" }}>
              Banjir rob adalah genangan air laut yang meluap ke daratan, sering kali terjadi secara berulang. Di pesisir Lampung, fenomena ini tidak hanya dipicu oleh pasang surut astronomis, tetapi juga diperparah oleh cuaca ekstrem dan aktivitas manusia yang menyebabkan penurunan permukaan tanah.
            </p>
            <motion.a 
              href="#/map" 
              whileHover={{ y: -3, boxShadow: "0 15px 35px rgba(15,23,42,0.3)" }}
              style={{ background: "#0f172a", color: "#fff", padding: "18px 36px", borderRadius: "100px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "12px", boxShadow: "0 10px 25px rgba(15,23,42,0.2)", fontSize: "1.05rem" }}
            >
              Lihat Peta Risiko <Icon name="arrow_forward" />
            </motion.a>
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
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "40px", padding: "60px", marginBottom: "80px", textAlign: "center" }}
        >
          <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink-primary)", marginBottom: "16px", letterSpacing: "-0.02em" }}>Cara Melaporkan Kejadian</h2>
          <p style={{ fontSize: "1.05rem", color: "var(--ink-muted)", lineHeight: 1.7, maxWidth: 700, margin: "0 auto 48px" }}>
            Bantu kami memvalidasi model AI dengan membagikan kondisi riil di wilayah Anda. Prosesnya sangat mudah dan terintegrasi langsung dengan dashboard BPBD.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "24px", maxWidth: 900, margin: "0 auto" }}>
            <div style={{ background: "var(--bg-primary)", padding: "32px", borderRadius: 8, border: "1px solid var(--border-color)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--accent-blue-soft)", color: "var(--accent-blue)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontWeight: 800, fontSize: "1.2rem" }}>1</div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "12px", color: "var(--ink-primary)" }}>Tentukan Lokasi</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--ink-muted)" }}>Pin lokasi Anda pada peta interaktif yang disediakan.</p>
            </div>
            <div style={{ background: "var(--bg-primary)", padding: "32px", borderRadius: 8, border: "1px solid var(--border-color)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--accent-blue-soft)", color: "var(--accent-blue)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontWeight: 800, fontSize: "1.2rem" }}>2</div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "12px", color: "var(--ink-primary)" }}>Isi Detail Keparahan</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--ink-muted)" }}>Tulis tinggi genangan dan kondisi cuaca saat kejadian berlangsung.</p>
            </div>
            <div style={{ background: "var(--bg-primary)", padding: "32px", borderRadius: 8, border: "1px solid var(--border-color)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--accent-blue-soft)", color: "var(--accent-blue)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontWeight: 800, fontSize: "1.2rem" }}>3</div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "12px", color: "var(--ink-primary)" }}>Unggah & Kirim</h3>
              <p style={{ fontSize: "0.9rem", color: "var(--ink-muted)" }}>Sertakan foto bukti agar validasi oleh BPBD dapat berjalan cepat.</p>
            </div>
          </div>
          <div style={{ marginTop: "40px" }}>
            <a href="#/reports" className="btn solid" style={{ background: "var(--ocean-dark, #0f172a)", color: "#fff", padding: "14px 32px", borderRadius: "100px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px" }}>
              Mulai Melapor Sekarang <Icon name="add_circle" />
            </a>
          </div>
        </motion.div>

        {/* Modern FAQ Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "60px", alignItems: "flex-start", marginBottom: "100px" }}
        >
          <div>
            <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink-primary)", marginBottom: "16px", letterSpacing: "-0.02em" }}>FAQ</h2>
            <p style={{ fontSize: "1.05rem", color: "var(--ink-muted)", lineHeight: 1.7 }}>
              Pertanyaan umum mengenai penggunaan portal SIPERAH-RoB dan akurasi model prediksinya.
            </p>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {faqData.map((item, i) => (
              <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden" }}>
                <div 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", padding: "24px", background: openFaq === i ? "var(--accent-blue-soft)" : "transparent", transition: "background 0.3s" }}
                >
                  <strong style={{ fontSize: "1.05rem", color: openFaq === i ? "var(--accent-blue)" : "var(--ink-primary)" }}>{item.q}</strong>
                  <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }}>
                    <Icon name="expand_more" style={{ color: openFaq === i ? "var(--accent-blue)" : "var(--ink-muted)" }} />
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
                      <div style={{ padding: "0 24px 24px", color: "var(--ink-muted)", lineHeight: 1.7, fontSize: "1rem" }}>
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Minimal Landing Footer */}
      <footer className="landing-footer">
        <div className="footer-brand" style={{ lineHeight: '1.6' }}>
          <strong style={{ fontSize: '1.1rem', color: 'var(--ink-primary)' }}>SIPERAH-RoB</strong><br />
          Sistem Informasi Prediksi Risiko Banjir Rob Terpadu<br />
          SIPERAH-RoB &copy; 2026. Institut Teknologi Sumatera
        </div>
        <div className="footer-links" style={{ flexDirection: 'column', gap: '8px', textAlign: 'right' }}>
          <span><strong>Pusdalops BPBD Provinsi Lampung</strong></span>
          <span>Jl. Beringin Raya No. 1, Teluk Betung, Bandar Lampung</span>
          <span>Email: tanggap@bpbd.lampungprov.go.id</span>
          <span>Hotline: (0721) 123456</span>
        </div>
      </footer>
    </div>
  );
}
