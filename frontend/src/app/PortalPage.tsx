import { Icon } from "../shared/components/Icon";
import { MapPreview } from "../shared/components/MapPreview";

const entryPoints = [
  ["#/map", "map", "Portal Publik", "Peta risiko, horizon prediksi, layer, detail wilayah, dan ekspor."],
  ["#/awam", "person_pin_circle", "Mode Awam", "Status bahaya lokasi dengan bahasa sederhana dan prakiraan 7 hari."],
  ["#/onboarding", "help", "Panduan Warga", "FAQ rob, arti kelas risiko, dan langkah pelaporan."],
  ["#/reports", "add_a_photo", "Lapor Kejadian", "Laporan ground truth 3 langkah dengan unggah foto."],
  ["#/operator", "assignment_turned_in", "BPBD Operator", "Validasi laporan dan pantau kelurahan wilayah kerja."],
  ["#/province", "monitoring", "BPBD Provinsi", "Ringkasan lintas kabupaten, tren, dan prioritas respons."],
  ["#/research", "database", "Peneliti & API", "Dataset historis, metadata, lisensi, dan API key."],
  ["#/admin", "manage_accounts", "Administrator", "Kelola akun, role, approval, status, dan audit log."],
  ["#/audit", "policy", "Audit Log", "Jejak aksi, outcome, actor, target, dan payload ringkas."]
];

export function PortalPage() {
  return (
    <main className="portal">
      <header className="portal-nav">
        <a className="brand" href="#/"><Icon name="water_drop" />SIPERAH-RoB</a>
        <div className="actions">
          <a className="btn secondary" href="#/login">Masuk</a>
          <a className="btn primary" href="#/map">Buka peta</a>
        </div>
      </header>
      <section className="hero-grid">
        <div className="portal-intro">
          <span className="portal-kicker">WebGIS Rob Lampung</span>
          <h1>SIPERAH-RoB</h1>
          <p>Satu sistem untuk prediksi rob, laporan warga, validasi BPBD, dan distribusi data peneliti di pesisir Lampung.</p>
          <div className="actions">
            <a className="btn primary" href="#/map">Buka peta risiko</a>
            <a className="btn secondary" href="#/awam">Mode awam</a>
          </div>
        </div>
        <div className="map-frame"><MapPreview /></div>
      </section>
      <section className="entry-grid">
        {entryPoints.map(([href, icon, title, copy]) => (
          <a className="entry-card" href={href} key={href}>
            <Icon name={icon} />
            <strong>{title}</strong>
            <p>{copy}</p>
          </a>
        ))}
      </section>
    </main>
  );
}
