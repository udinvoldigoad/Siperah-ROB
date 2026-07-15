import { useEffect, useState } from "react";
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

export function PortalPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isDarkMode, setDarkMode] = useState(() => localStorage.getItem("siperah-theme") === "dark" || document.documentElement.getAttribute("data-theme") === "dark");

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("siperah-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("siperah-theme", "light");
    }
  }, [isDarkMode]);

  const userStr = localStorage.getItem("siperah-user");
  const isLoggedIn = Boolean(localStorage.getItem("siperah-token") && userStr);
  let currentRole = "";
  let dashboardRoute = "#/login";
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      currentRole = user.role || "";
      const roleMap: Record<string, string> = {
        warga: "#/map",
        peneliti: "#/research",
        operator_kabkota: "#/operator",
        operator_provinsi: "#/province",
        admin: "#/admin"
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
          --bg-primary: #f6f9fc;
          --bg-card: #FFFFFF;
          --bg-card-dark: #0f172a;
          --ink-primary: #0f172a;
          --ink-muted: #475569;
          --border-color: #e2e8f0;
          --accent-blue: #1557b0;
          --accent-blue-soft: #eff6ff;
          --bg-header: rgba(246, 249, 252, 0.88);
          --brand-bg: #ffffff;
          --bg-overlay-start: rgba(246, 249, 252, 0.7);
          --bg-overlay-end: rgba(246, 249, 252, 1);
          --bg-marquee: rgba(255, 255, 255, 0.62);
          --ink-inverse: #ffffff;
          --bg-footer: #0f172a;
        }

        [data-theme="dark"] .siperah-landing-root {
          --bg-primary: #020617;
          --bg-card: #0f172a;
          --bg-card-dark: #FFFFFF;
          --ink-primary: #f8fafc;
          --ink-muted: #94a3b8;
          --border-color: #334155;
          --accent-blue: #3b82f6;
          --accent-blue-soft: #1e3a8a;
          --bg-header: rgba(2, 6, 23, 0.88);
          --brand-bg: #0f172a;
          --bg-overlay-start: rgba(2, 6, 23, 0.85);
          --bg-overlay-end: rgba(2, 6, 23, 1);
          --bg-marquee: rgba(15, 23, 42, 0.62);
          --ink-inverse: #020617;
          --bg-footer: #000000;
        }

        /* Component-Specific Dark Mode Overrides */
        [data-theme="dark"] .siperah-landing-root .bento-card-el.dark-theme { background: #1e293b; border-color: #334155; }
        [data-theme="dark"] .siperah-landing-root .warning-factor-box { background: #0f172a; border-color: #1e293b; }
        [data-theme="dark"] .siperah-landing-root .warning-factor-label { background: #451a03; border-color: #78350f; color: #fef3c7; }
        [data-theme="dark"] .siperah-landing-root .reporting-step { background: #0f172a; border-color: #1e293b; }
        [data-theme="dark"] .siperah-landing-root .reporting-step-icon { background: #1e293b; color: #38bdf8; }
        [data-theme="dark"] .siperah-landing-root .landing-map-frame { background: #0f172a; border-color: #1e293b; box-shadow: 0 16px 40px rgba(0, 0, 0, .4); }
        [data-theme="dark"] .siperah-landing-root .reporting-step-number { background: #0284c7; border-color: #0f172a; box-shadow: 0 0 0 1px #0369a1; }

        .siperah-landing-root {
          color: var(--ink-primary);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          width: 100%;
          position: relative;
          overflow-x: hidden;
          display: flex;
          flex-direction: column;
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
          height: 76px;
          padding: 0 clamp(24px, 5vw, 72px);
          background: var(--bg-header);
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
          background: var(--brand-bg);
          color: #2563eb;
          border: 2px solid #2563eb;
          border-radius: 8px;
          font-size: 1.1rem;
        }
        .nav-links-wrap {
          display: flex;
          align-items: center;
          gap: 32px;
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
          color: var(--ink-inverse);
          background: var(--ink-primary);
          border: 1px solid var(--ink-primary);
          border-radius: 10px;
          padding: 10px 22px;
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
          padding: 164px 40px 76px;
          text-align: center;
          position: relative;
          z-index: 10;
        }
        .hero-section h1 {
          font-size: clamp(2.15rem, 4vw, 3.75rem);
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -0.04em;
          color: var(--ink-primary);
          max-width: 920px;
          margin: 0 auto 24px;
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
          max-width: 680px;
          margin: 0 auto 34px;
        }
        .hero-actions {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 72px;
        }
        .btn-hero-primary {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--ink-inverse);
          background: var(--ink-primary);
          border: 1px solid var(--ink-primary);
          border-radius: 10px;
          padding: 13px 28px;
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
          background: var(--brand-bg);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 13px 28px;
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
            radial-gradient(circle at 50% 18%, rgba(37, 99, 235, .12), transparent 34%),
            linear-gradient(var(--bg-overlay-start), var(--bg-overlay-end)),
            linear-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.14) 1px, transparent 1px),
            url('/bg-laut.jpg');
          background-size: 100% 100%, 100% 100%, 80px 80px, 80px 80px, cover;
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
          background: var(--bg-marquee);
          padding: 20px 0;
          margin-bottom: 104px;
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
        .live-kicker-dot {
          animation: live-kicker-pulse 1.4s ease-in-out infinite;
          background: #2563eb;
          border-radius: 999px;
          box-shadow: 0 0 0 0 rgba(37, 99, 235, .38);
          display: inline-block;
          height: 8px;
          margin-right: 7px;
          width: 8px;
        }
        @keyframes live-kicker-pulse {
          0%, 100% { opacity: .55; box-shadow: 0 0 0 0 rgba(37, 99, 235, .35); }
          50% { opacity: 1; box-shadow: 0 0 0 6px rgba(37, 99, 235, 0); }
        }
        @media (prefers-reduced-motion: reduce) { .live-kicker-dot { animation: none; opacity: 1; } }
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
          align-items: flex-start;
          flex-direction: column;
          gap: 12px;
          justify-content: space-between;
          margin-bottom: 34px;
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
          max-width: 620px;
          margin: 0;
          line-height: 1.5;
        }
        .bento-container-grid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          grid-auto-flow: dense;
          gap: 16px;
        }
        .bento-card-el {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 30px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          position: relative;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bento-card-el:hover {
          transform: translateY(-3px);
          border-color: rgba(21, 87, 176, .34);
          box-shadow: 0 18px 44px rgba(15, 23, 42, .08);
        }

        /* Bento Grid Math Span allocations (Zero-Gap Interlock) */
        .card-span-7 { grid-column: span 7; }
        .card-span-5 { grid-column: span 5; }
        
        .bento-card-el.dark-theme {
          background: #eaf3ff;
          color: var(--ink-primary);
          border-color: #cfe2fb;
        }
        .bento-card-el.dark-theme h3 { color: var(--ink-primary); }
        .bento-card-el.dark-theme p { color: var(--ink-muted); }
        .bento-card-el.dark-theme:hover {
          box-shadow: 0 18px 44px rgba(21, 87, 176, .12);
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
          color: var(--accent-blue);
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
          border-color: #cfe2fb;
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

        .warning-factor-box {
          align-self: stretch;
          background: #dbeafe;
          border: 1px solid #7dd3fc;
          border-radius: 16px;
          box-shadow: 0 16px 40px rgba(2, 132, 199, .14);
          display: flex;
          flex-direction: column;
          height: 100%;
          justify-content: center;
          padding: 28px;
        }
        .warning-factor-label {
          align-items: center;
          background: #fef3c7;
          border: 1px solid #f4cf68;
          border-radius: 8px;
          color: #92400e;
          display: inline-flex;
          font-size: 12px;
          font-weight: 800;
          gap: 8px;
          letter-spacing: .08em;
          margin-bottom: 18px;
          padding: 8px 11px;
          text-transform: uppercase;
        }
        .warning-factor-label .material-symbols-outlined { color: #d97706; font-size: 18px; }
        .warning-factor-list { display: grid; list-style: none; margin: 0; padding: 0; }
        .warning-factor-list li {
          align-items: center;
          border-bottom: 1px solid rgba(2, 132, 199, .25);
          color: var(--ink-primary);
          display: flex;
          font-size: 1rem;
          font-weight: 650;
          gap: 11px;
          padding: 13px 2px;
        }
        .warning-factor-list li:last-child { border-bottom: 0; padding-bottom: 2px; }
        .warning-factor-list .material-symbols-outlined { color: #d97706; font-size: 20px; }
        .guide-definition-grid { align-items: stretch !important; }
        .landing-map-frame {
          background: #dbeafe;
          border: 1px solid #bae6fd;
          border-radius: 16px;
          box-shadow: 0 16px 40px rgba(2, 132, 199, .1);
          min-height: 400px;
          overflow: hidden;
          padding: 8px;
        }
        .reporting-flow {
          display: grid;
          gap: 28px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin: 0 auto;
          max-width: 940px;
          position: relative;
        }
        .reporting-step {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          min-height: 260px;
          padding: 30px 26px 28px;
          position: relative;
          text-align: center;
          transition: border-color .25s ease, box-shadow .25s ease, transform .25s ease;
        }
        .reporting-step:hover { border-color: #93c5fd; box-shadow: 0 18px 38px rgba(15, 23, 42, .08); transform: translateY(-4px); }
        .reporting-step-number {
          align-items: center;
          background: #0284c7;
          border: 5px solid #e0f2fe;
          border-radius: 999px;
          box-shadow: 0 0 0 1px #7dd3fc;
          color: #fff;
          display: inline-flex;
          font-size: 15px;
          font-weight: 850;
          height: 54px;
          justify-content: center;
          margin: 0 auto 28px;
          position: relative;
          width: 54px;
          z-index: 4;
        }
        .reporting-step-icon {
          align-items: center;
          background: #e0f2fe;
          border-radius: 9px;
          color: #0284c7;
          display: flex;
          height: 38px;
          justify-content: center;
          margin: 0 auto 14px;
          width: 38px;
        }
        .reporting-step-icon .material-symbols-outlined { font-size: 20px; }
        .reporting-step h3 { font-size: 1.05rem; margin: 0 0 9px; }
        .reporting-step p { font-size: .9rem; line-height: 1.55; margin: 0 auto; max-width: 28ch; }

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
          margin: 104px auto 0;
          padding: 0 40px;
          border-top: 1px solid var(--border-color);
          padding-top: 42px;
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
          .hero-section h1 { font-size: 2.7rem; }
          .marquee-container { margin-bottom: 80px; }
          .guide-definition-grid, .guide-map-grid, .landing-faq-grid { grid-template-columns: 1fr !important; gap: 36px !important; }
          .landing-footer { flex-direction: column; gap: 24px; text-align: center; }
        }
        @media (max-width: 768px) {
          .nav-links-wrap { display: none !important; }
          .header-actions .btn-link-login { display: none; }
          .hero-section { padding: 100px 16px 40px !important; }
          .hero-section h1 { font-size: 1.75rem !important; line-height: 1.2; margin-bottom: 20px; }
          .hero-section p { font-size: 1rem !important; margin-bottom: 24px; padding: 0 10px; }
          .hero-actions { flex-direction: column; gap: 12px !important; margin-bottom: 60px !important; }
          .hero-actions > a { width: 100%; box-sizing: border-box; text-align: center; }
          .inline-pill-img { display: none; }
          .marquee-container { height: 160px; }
          .bento-card-el { padding: 24px; }
          .landing-header-full { padding: 0 20px; background: rgba(255, 255, 255, 0.7) !important; backdrop-filter: blur(12px); }
          .bento-header-wrap { flex-direction: column; align-items: center !important; text-align: center; gap: 16px; margin-bottom: 32px !important; }
          .bento-header-wrap h2 { font-size: 1.8rem !important; }
          .guide-section { margin: 72px auto !important; padding: 0 16px !important; }
          .guide-definition-grid, .guide-map-grid { margin-bottom: 72px !important; }
          .guide-definition-grid h2 { font-size: 2.15rem !important; }
          .guide-map-grid > div:last-child { height: 300px !important; padding: 20px !important; }
          .landing-map-frame { min-height: 300px !important; padding: 6px !important; }
          .reporting-flow { grid-template-columns: 1fr; gap: 16px; }
          .reporting-step { min-height: 0; padding: 24px; }
          .reporting-step-number { margin-bottom: 20px; }
          .landing-faq-grid { margin-bottom: 64px !important; }
          .landing-footer { margin-top: 72px; padding: 36px 20px 0; }
          .footer-links { text-align: center !important; }
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
          {currentRole !== "bpbd_provinsi" && <a href="#/awam">Mode Awam</a>}
          <a href="#panduan">Panduan</a>
        </nav>
        <div className="header-actions">
          <button 
            type="button" 
            aria-label="Ganti Tema" 
            onClick={() => setDarkMode(!isDarkMode)}
            style={{ background: 'transparent', border: 'none', color: 'var(--ink-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={isDarkMode ? "light_mode" : "dark_mode"} />
          </button>
          <a className="btn-nav-primary" href={isLoggedIn ? dashboardRoute : "#/login"}>{isLoggedIn ? "Dashboard" : "Login"}</a>
        </div>
      </header>

      {/* Cinematic Center Hero */}
      <section className="hero-section">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="hero-kicker"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "6px 16px", background: "rgba(37, 99, 235, 0.1)", color: "var(--accent-blue)", borderRadius: "100px", fontSize: "0.85rem", fontWeight: 700, marginBottom: "24px" }}
        >
          <span className="live-kicker-dot" aria-hidden="true" /> WebGIS Kebencanaan Provinsi Lampung
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        >
          Sistem Informasi Prediksi Risiko Banjir Rob Terpadu Provinsi Lampung.
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
          {currentRole !== "bpbd_provinsi" && <a className="btn-hero-secondary" href="#/awam">
            Akses Mode Awam
          </a>}
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
              <h3>Peta & Laporan Warga</h3>
              <p>
                Pantau wilayah mana saja yang diprediksi terkena rob besok, baca panduan keselamatan, dan laporkan langsung jika air mulai naik di lingkungan Anda.
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
              <div style={{ marginTop: 40, width: "100%", height: 180, background: "var(--bg-primary)", borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", padding: 16, gap: 12 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                     <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                     <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
                     <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981" }} />
                  </div>
                  <div style={{ display: "flex", gap: 12, flex: 1 }}>
                     <div style={{ width: "35%", height: "100%", background: "var(--bg-card)", borderRadius: 8 }} />
                     <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                       <div style={{ width: "100%", height: "35%", background: "var(--bg-card)", borderRadius: 8 }} />
                       <div style={{ width: "100%", flex: 1, background: "var(--bg-card)", borderRadius: 8 }} />
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
          className="guide-definition-grid"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "60px", alignItems: "center", marginBottom: "120px" }}
        >
          <div className="warning-factor-box">
            <div className="warning-factor-label">
              <Icon name="warning" /> Faktor Utama
            </div>
            <ul className="warning-factor-list">
              <li>
                <Icon name="warning_amber" /> Pasang tinggi (Perigee)
              </li>
              <li>
                <Icon name="air" /> Angin darat kencang
              </li>
              <li>
                <Icon name="brightness_3" /> Fase bulan purnama
              </li>
              <li>
                <Icon name="vertical_align_bottom" /> Penurunan muka tanah
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
              style={{ background: "#0f172a", color: "#fff", padding: "16px 28px", borderRadius: "10px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "12px", boxShadow: "0 10px 25px rgba(15,23,42,0.2)", fontSize: "1rem" }}
            >
              Lihat Peta Risiko <Icon name="arrow_forward" />
            </motion.a>
          </div>
        </motion.div>

        {/* Feature 2: Alternating Layout Right */}
        <motion.div 
          className="guide-map-grid"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", alignItems: "center", marginBottom: "100px" }}
        >
          <div style={{ order: 1 }}>
            <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink)", marginBottom: "20px", letterSpacing: "-0.02em" }}>Cara Membaca Peta Prediksi</h2>
            <p style={{ fontSize: "1.05rem", color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: "32px" }}>
              Sistem Machine Learning kami memproyeksikan probabilitas banjir ke dalam empat kelas warna yang intuitif. Hal ini memudahkan Anda dan pengambil kebijakan untuk memprioritaskan tindakan mitigasi pada area yang paling berisiko.
            </p>
            <div style={{ display: "grid", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444" }}></div><strong style={{ minWidth: "120px" }}>Sangat Tinggi</strong><span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>(&gt;75% Probabilitas)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f97316" }}></div><strong style={{ minWidth: "120px" }}>Tinggi</strong><span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>(50–75% Probabilitas)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f59e0b" }}></div><strong style={{ minWidth: "120px" }}>Sedang</strong><span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>(25–50% Probabilitas)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}><div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#10b981" }}></div><strong style={{ minWidth: "120px" }}>Rendah</strong><span style={{ color: "var(--ink-soft)", fontSize: "0.95rem" }}>(&lt;25% Probabilitas)</span></div>
            </div>
          </div>
          <div className="landing-map-frame" style={{ order: 2 }}>
            <MapPreview />
          </div>
        </motion.div>

        {/* Feature 3: Full Width Interactive Style */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "16px", padding: "60px", marginBottom: "80px", textAlign: "center" }}
        >
          <h2 style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink-primary)", marginBottom: "16px", letterSpacing: "-0.02em" }}>Cara Melaporkan Kejadian</h2>
          <p style={{ fontSize: "1.05rem", color: "var(--ink-muted)", lineHeight: 1.7, maxWidth: 700, margin: "0 auto 48px" }}>
            Bantu kami memvalidasi model Machine Learning dengan membagikan kondisi riil di wilayah Anda. Prosesnya sangat mudah dan terintegrasi langsung dengan dashboard BPBD.
          </p>
          <div className="reporting-flow">
            <div className="reporting-step">
              <div className="reporting-step-number">01</div>
              <div><span className="reporting-step-icon"><Icon name="location_on" /></span><h3>Tentukan Lokasi</h3></div>
              <p>Letakkan pin pada titik kejadian agar wilayah administratif dapat dikenali secara tepat.</p>
            </div>
            <div className="reporting-step">
              <div className="reporting-step-number">02</div>
              <div><span className="reporting-step-icon"><Icon name="waves" /></span><h3>Isi Detail Keparahan</h3></div>
              <p>Catat tinggi genangan, waktu kejadian, serta kondisi yang Anda lihat di lapangan.</p>
            </div>
            <div className="reporting-step">
              <div className="reporting-step-number">03</div>
              <div><span className="reporting-step-icon"><Icon name="add_a_photo" /></span><h3>Unggah & Kirim</h3></div>
              <p>Lampirkan foto pendukung lalu kirim laporan untuk ditinjau oleh operator BPBD.</p>
            </div>
          </div>
          <div style={{ marginTop: "40px" }}>
            <a href={!isLoggedIn ? "#/login" : currentRole === "warga" ? "#/reports" : dashboardRoute} className="btn solid" style={{ background: "var(--ocean-dark, #0f172a)", color: "#fff", padding: "14px 32px", borderRadius: "10px", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "8px" }}>
              Mulai Melapor Sekarang <Icon name="add_circle" />
            </a>
          </div>
        </motion.div>

        {/* Modern FAQ Section */}
        <motion.div 
          className="landing-faq-grid"
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
      <footer style={{ background: "var(--bg-footer)", color: "#cbd5e1", padding: "60px 40px 40px", marginTop: "auto", borderTop: "1px solid var(--border-color)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "40px", justifyContent: "space-between" }}>
          <div style={{ lineHeight: '1.6', maxWidth: "400px" }}>
            <strong style={{ fontSize: '1.1rem', color: '#fff' }}>SIPERAH-RoB</strong><br />
            Sistem Informasi Prediksi Risiko Banjir Rob Terpadu Provinsi Lampung.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'right', minWidth: "300px" }}>
            <span style={{ color: "#fff" }}><strong>Pusdalops BPBD Provinsi Lampung</strong></span>
            <span>Jl. Beringin Raya No. 1, Teluk Betung, Bandar Lampung</span>
            <span>Email: tanggap@bpbd.lampungprov.go.id</span>
            <span>Hotline: (0721) 123456</span>
          </div>
        </div>
        <div style={{ maxWidth: "1200px", margin: "40px auto 0", paddingTop: "24px", borderTop: "1px solid #1e293b", textAlign: "center", fontSize: "0.9rem", color: "#64748b" }}>
          SIPERAH-RoB &copy; 2026. Institut Teknologi Sumatera
        </div>
      </footer>
    </div>
  );
}
