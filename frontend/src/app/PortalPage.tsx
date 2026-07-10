import { Icon } from "../shared/components/Icon";
import { MapPreview } from "../shared/components/MapPreview";

export function PortalPage() {
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
          background: linear-gradient(135deg, #1e40af, #3b82f6);
          color: #fff;
          border-radius: 6px;
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
            radial-gradient(circle at 50% 30%, rgba(37, 99, 235, 0.04) 0%, transparent 60%),
            linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px);
          background-size: 100% 100%, 80px 80px, 80px 80px;
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
        .card-span-8 { grid-column: span 8; }
        .card-span-4 { grid-column: span 4; }
        
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
      `}</style>

      {/* Grid Ambient Background Pattern */}
      <div className="ambient-grid"></div>

      {/* Full-Width Header */}
      <header className="landing-header-full">
        <a className="brand-link" href="#/">
          <div className="brand-logo-icon">
            <Icon name="water_drop" />
          </div>
          SIPERAH-RoB
        </a>
        <nav className="nav-links-wrap">
          <a href="#/map">Peta Publik</a>
          <a href="#/awam">Mode Awam</a>
          <a href="#/onboarding">Panduan Warga</a>
          <a href="#/research">Portal Peneliti</a>
        </nav>
        <div className="header-actions">
          <a className="btn-link-login" href="#/login">Masuk</a>
          <a className="btn-nav-primary" href="#/map">Buka Peta</a>
        </div>
      </header>

      {/* Cinematic Center Hero */}
      <section className="hero-section">
        <span className="hero-kicker">WebGIS Kebencanaan Provinsi Lampung</span>
        <h1>
          Building better mitigation
          <span className="inline-pill-img"></span>
          against tidal floods.
        </h1>
        <p>
          Portal informasi geografis terpadu pesisir Lampung. Menyajikan prediksi risiko berbasis machine learning, visualisasi kerentanan kelurahan, dan wadah verifikasi data lapangan.
        </p>
        <div className="hero-actions">
          <a className="btn-hero-primary" href="#/map">
            Buka Peta Risiko
          </a>
          <a className="btn-hero-secondary" href="#/awam">
            Akses Mode Awam
          </a>
        </div>
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
          <div className="bento-card-el card-span-8">
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
          </div>

          {/* Card 2: Dashboard BPBD (col-span-4) - Dark Theme for Contrast */}
          <div className="bento-card-el card-span-4 dark-theme">
            <div>
              <span className="card-meta-title">BPBD Command Center</span>
              <h3>Dashboard BPBD</h3>
              <p>
                Pusat kendali dan monitoring prediksi risiko, analisis dampak, dan manajemen logistik untuk operator dan pengambil keputusan.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", margin: "24px 0" }}>
                <div style={{ background: "rgba(255,255,255,0.06)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontWeight: 700 }}>Kelurahan Pantau</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "4px", color: "var(--accent-soft)" }}>283</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.06)", padding: "16px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontWeight: 700 }}>Akurasi Model</div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "4px", color: "#10B981" }}>87%</div>
                </div>
              </div>
            </div>
            <div className="card-links-row">
              <a className="card-action-link" href="#/login">Masuk Dashboard <Icon name="arrow_forward" /></a>
            </div>
          </div>

          {/* Card 3: Portal Peneliti & API (col-span-4) */}
          <div className="bento-card-el card-span-4">
            <div>
              <span className="card-meta-title">Research Archive & API</span>
              <h3>Portal Peneliti & API</h3>
              <p>
                Akses repositori dataset riwayat, unduh data prediksi, dan manajemen kunci API untuk kebutuhan penelitian.
              </p>

              <div style={{ background: "rgba(18,19,20,0.03)", padding: "14px", borderRadius: "12px", border: "1px solid var(--border-color)", fontFamily: "monospace", fontSize: "0.75rem", margin: "24px 0", color: "var(--ink-muted)" }}>
                <div>GET /v1/predictions</div>
                <div style={{ color: "#1E40AF", marginTop: "2px" }}>Authorization: Bearer key_api...</div>
              </div>
            </div>
            <div className="card-links-row">
              <a className="card-action-link" href="#/research">Akses Data <Icon name="arrow_forward" /></a>
            </div>
          </div>

          {/* Card 4: Administrator (col-span-8) */}
          <div className="bento-card-el card-span-8">
            <div>
              <span className="card-meta-title">System Administration</span>
              <h3>Administrator</h3>
              <p>
                Kelola akses pengguna, konfigurasi sistem, dan pantau log aktivitas (audit log) sistem secara keseluruhan.
              </p>

              <div className="card-preview-container" style={{ padding: "20px", background: "var(--surface-soft)", minHeight: "100px", display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ background: "#fff", width: "42px", height: "42px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--line)" }}>
                  <Icon name="security" style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: "0.95rem" }}>Sistem Keamanan & Akuntabilitas Terjamin</strong>
                  <span style={{ fontSize: "0.84rem", color: "var(--ink-soft)" }}>Seluruh perubahan hak akses, enkripsi log aktivitas, dan tindakan admin dicatat ke dalam database.</span>
                </div>
              </div>
            </div>
            <div className="card-links-row">
              <a className="card-action-link" href="#/admin">Kelola Sistem <Icon name="arrow_forward" /></a>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Mitigation Help Trigger */}
      <a className="mitigasi-trigger" href="#/onboarding" title="Panduan Mitigasi">
        <Icon name="help" />
      </a>

      {/* Minimal Landing Footer */}
      <footer className="landing-footer">
        <div className="footer-brand">
          SIPERAH-RoB &copy; 2026. Institut Teknologi Sumatera
        </div>
        <div className="footer-links">
          <a href="#/map">Peta Publik</a>
          <a href="#/awam">Mode Awam</a>
          <a href="#/research">Akses API</a>
          <a href="#/login">Login Petugas</a>
        </div>
      </footer>
    </div>
  );
}
