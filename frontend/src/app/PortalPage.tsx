import { Icon } from "../shared/components/Icon";

export function PortalPage() {
  return (
    <div className="siperah-portal-root">
      {/* Google Fonts Load */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      <style>{`
        .siperah-portal-root {
          --font: 'Inter', system-ui, -apple-system, sans-serif;
          --bg0: #ffffff;
          --bg1: #f8fafc;
          --bg2: #f1f5f9;
          --bd: #e2e8f0;
          --brand: #1d4ed8;
          --blue: #2563eb;
          --blue-bg: #eff6ff;
          --blue-bd: #bfdbfe;
          --amber: #d97706;
          --amber-bg: #fffbeb;
          --red: #dc2626;
          --red-bg: #fef2f2;
          --green: #16a34a;
          --green-bg: #f0fdf4;
          --tx0: #0f172a;
          --tx1: #334155;
          --tx2: #64748b;
          --tx3: #94a3b8;
          --r-xl: 12px;
          --sh-sm: 0 1px 2px 0 rgba(0,0,0,0.05);
          --sh-md: 0 4px 6px -1px rgba(0,0,0,0.1);
          --sh-lg: 0 10px 15px -3px rgba(0,0,0,0.1);

          font-family: var(--font);
          background: var(--bg2);
          color: var(--tx1);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 40px 20px;
          box-sizing: border-box;
          width: 100%;
        }

        .portal-container {
          max-width: 900px;
          width: 100%;
          margin: 0 auto;
        }

        .portal-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .portal-header .logo-box {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #1e40af, #3b82f6);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          box-shadow: var(--sh-md);
        }

        .portal-header h1 {
          font-size: 28px;
          color: var(--tx0);
          margin: 0 0 8px 0;
          font-weight: 700;
        }

        .portal-header p {
          color: var(--tx2);
          font-size: 15px;
          margin: 0;
        }

        .portal-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .portal-card {
          background: var(--bg0);
          border: 1px solid var(--bd);
          border-radius: var(--r-xl);
          padding: 24px;
          text-decoration: none !important;
          color: var(--tx0);
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          box-shadow: var(--sh-sm);
        }

        .portal-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--sh-lg);
          border-color: var(--blue-bd);
        }

        .portal-card .icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        
        .portal-card .icon-wrap span {
          font-size: 24px;
        }

        .portal-card.publik .icon-wrap { background: var(--blue-bg); color: var(--blue); }
        .portal-card.bpbd .icon-wrap { background: var(--amber-bg); color: var(--amber); }
        .portal-card.admin .icon-wrap { background: var(--red-bg); color: var(--red); }
        .portal-card.peneliti .icon-wrap { background: var(--green-bg); color: var(--green); }

        .portal-card h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 8px 0;
          color: var(--tx0);
        }

        .portal-card p {
          font-size: 13px;
          color: var(--tx2);
          line-height: 1.5;
          margin: 0;
          flex: 1;
        }

        .portal-card .btn-link {
          margin-top: 20px;
          font-size: 13px;
          font-weight: 600;
          color: var(--blue);
          display: flex;
          align-items: center;
          gap: 4px;
        }
      `}</style>

      <div className="portal-container">
        <div className="portal-header">
          <div className="logo-box">
            <Icon name="shield" style={{ fontSize: "32px", color: "#fff" }} />
          </div>
          <h1>Sistem Terpadu SIPERAH-RoB</h1>
          <p>Portal Utama Sistem Informasi Prediksi Risiko Banjir Rob Terpadu Provinsi Lampung</p>
        </div>

        <div className="portal-grid">
          {/* Publik */}
          <a href="#/map" className="portal-card publik">
            <div className="icon-wrap">
              <Icon name="map" />
            </div>
            <h3>Portal Publik</h3>
            <p>Akses peta interaktif peringatan dini bahaya rob, panduan mitigasi, dan laporan ground truth untuk masyarakat umum.</p>
            <div className="btn-link">
              Akses Sistem <Icon name="arrow_forward" style={{ fontSize: "14px" }} />
            </div>
          </a>

          {/* BPBD */}
          <a href="#/login" className="portal-card bpbd">
            <div className="icon-wrap">
              <Icon name="dashboard" />
            </div>
            <h3>Dashboard BPBD</h3>
            <p>Pusat kendali dan monitoring prediksi risiko, analisis dampak, dan manajemen logistik untuk operator dan pengambil keputusan.</p>
            <div className="btn-link">
              Masuk Dashboard <Icon name="arrow_forward" style={{ fontSize: "14px" }} />
            </div>
          </a>

          {/* Admin */}
          <a href="#/admin" className="portal-card admin">
            <div className="icon-wrap">
              <Icon name="group" />
            </div>
            <h3>Administrator</h3>
            <p>Kelola akses pengguna, konfigurasi sistem, dan pantau log aktivitas (audit log) sistem secara keseluruhan.</p>
            <div className="btn-link">
              Kelola Sistem <Icon name="arrow_forward" style={{ fontSize: "14px" }} />
            </div>
          </a>

          {/* Peneliti */}
          <a href="#/research" className="portal-card peneliti">
            <div className="icon-wrap">
              <Icon name="database" />
            </div>
            <h3>Portal Peneliti & API</h3>
            <p>Akses repositori dataset riwayat, unduh data prediksi, dan manajemen kunci API untuk kebutuhan penelitian.</p>
            <div className="btn-link">
              Akses Data <Icon name="arrow_forward" style={{ fontSize: "14px" }} />
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
