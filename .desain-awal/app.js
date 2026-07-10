const app = document.querySelector("#app");

const navItems = [
  ["portal", "home", "Portal"],
  ["map", "map", "Peta Risiko"],
  ["awam", "person_pin_circle", "Mode Awam"],
  ["report", "add_location_alt", "Lapor"],
  ["operator", "assignment_turned_in", "Operator"],
  ["province", "monitoring", "Provinsi"],
  ["research", "database", "Data & API"],
  ["notifications", "notifications", "Notifikasi"],
  ["admin", "manage_accounts", "Admin"],
  ["audit", "history", "Audit"]
];

const shellTitles = {
  map: ["Peta Risiko Rob", "Prediksi hari ini sampai +7 hari, layer peta, detail wilayah, dan ekspor data."],
  community: ["Peta Komunitas", "Laporan warga tervalidasi dan sinyal ground truth di sekitar pesisir Lampung."],
  awam: ["Status Bahaya Saya", "Bahasa sederhana untuk warga, berbasis lokasi dan laporan terdekat."],
  report: ["Laporan Ground Truth", "Alur 3 langkah: lokasi, detail kejadian, foto, lalu kirim untuk verifikasi BPBD."],
  onboarding: ["Panduan & FAQ", "Cara membaca risiko, memahami banjir rob, dan membuat laporan yang bisa diverifikasi."],
  operator: ["Dashboard Operator BPBD", "Antrean validasi, wilayah siaga, dan SLA laporan untuk Lampung Selatan."],
  province: ["Dashboard BPBD Provinsi", "Ringkasan lintas kabupaten, tren 30 hari, dan prioritas koordinasi."],
  notifications: ["Pengaturan Notifikasi", "Kanal, event, jam sunyi, dan wilayah pantau untuk peringatan rob."],
  admin: ["Manajemen Pengguna", "Approval akun, role, wilayah kerja, status, dan tindakan admin."],
  audit: ["Audit Log Sistem", "Jejak login, validasi laporan, ekspor data, update pengguna, dan outcome."],
  research: ["Portal Peneliti & API", "Dataset historis, metadata, lisensi, API key, dan dokumentasi endpoint."]
};

const metrics = [
  ["15/15", "Kabupaten aktif dipantau"],
  ["283+", "Kelurahan pesisir"],
  ["87%", "Akurasi baseline model"],
  ["1x24", "SLA verifikasi laporan"]
];

const districts = [
  ["Lampung Selatan", "Sangat Tinggi", "45.201 jiwa", "+14.2%", "critical"],
  ["Bandar Lampung", "Tinggi", "122.890 jiwa", "+5.8%", "high"],
  ["Pesisir Barat", "Sedang", "12.403 jiwa", "Stabil", "medium"],
  ["Tanggamus", "Rendah", "8.910 jiwa", "-2.1%", "low"]
];

const reports = [
  ["GT-LPG-882", "Panjang Utara", "80 cm masuk permukiman RT 04. Lansia perlu dievakuasi.", "5 menit lalu", "Sangat Parah", "critical"],
  ["GT-LPG-881", "Way Halim", "Genangan 28 cm di akses pasar. Arus tenang, warga masih melintas.", "18 menit lalu", "Sedang", "medium"],
  ["GT-LPG-879", "Teluk Betung", "Air pasang mencapai halaman rumah dan menutup saluran kecil.", "42 menit lalu", "Parah", "high"]
];

const users = [
  ["Budi Santoso", "budi.santoso@lampung.go.id", "Admin", "Pusdalops Prov", "Aktif", "5 menit lalu"],
  ["Herman Wijaya", "herman.bpbd@lamsel.go.id", "BPBD Operator", "Lampung Selatan", "Aktif", "2 jam lalu"],
  ["Siti Aminah", "siti.aminah@unila.ac.id", "Peneliti", "Bandar Lampung", "Verifikasi", "Kemarin 14:20"],
  ["Adi Kurniawan", "adi.kurniawan@gmail.com", "Warga", "Pesisir Barat", "Aktif", "3 hari lalu"],
  ["Eko Prasetyo", "eko.p@instansi.id", "BPBD Operator", "Mesuji", "Nonaktif", "1 bulan lalu"]
];

const datasets = [
  ["Prediksi Risiko Harian", "2018-2026", "Kelurahan", "1.240.000", "CC-BY 4.0"],
  ["Ground Truth Tervalidasi", "2022-2026", "Titik laporan", "18.450", "Anonim"],
  ["Pasang Surut BMKG", "2020-2026", "Stasiun", "92.300", "Sumber BMKG"]
];

const audits = [
  ["UPDATE_RISK_MAP", "Budi Santoso", "success", "Radius zona bahaya Bandar Lampung diperbarui dari 200 m ke 350 m.", "14:22:10"],
  ["LOGIN_ATTEMPT", "admin_wilayah_1", "fail", "Gagal login 3 kali dari alamat IP tidak dikenal.", "13:05:44"],
  ["EXPORT_DATA", "Riset Perangkat", "success", "Dataset prediksi harian 2023-2024 diekspor sebagai CSV.", "11:48:02"],
  ["UPDATE_USER", "Siti Aminah", "partial", "Role pengguna diubah dan menunggu sinkronisasi wilayah kerja.", "08:00:12"]
];

function icon(name) {
  return `<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;
}

function route() {
  const key = location.hash.replace("#", "") || "portal";
  return shellTitles[key] || key === "portal" || key === "login" ? key : "portal";
}

function badge(text, tone = "info") {
  return `<span class="badge ${tone}">${text}</span>`;
}

function chip(text, tone = "") {
  return `<span class="chip ${tone}">${text}</span>`;
}

function metricCard(label, value, note = "", tone = "") {
  return `
    <article class="metric-card ${tone}">
      <span>${label}</span>
      <b>${value}</b>
      <small>${note}</small>
    </article>
  `;
}

function mapArt(size = "") {
  return `
    <div class="map-art ${size}">
      <div class="coastline"></div>
      <div class="water"></div>
      <div class="hazard medium"></div>
      <div class="hazard high"></div>
      <div class="hazard critical"></div>
      <span class="map-line" style="left:13%;top:42%;width:34%;transform:rotate(18deg)"></span>
      <span class="map-line" style="left:28%;top:58%;width:28%;transform:rotate(-28deg)"></span>
      <span class="map-line" style="left:48%;top:38%;width:26%;transform:rotate(8deg)"></span>
      <span class="pin red" style="left:63%;top:37%">4</span>
      <span class="pin orange" style="left:48%;top:58%">8</span>
      <span class="pin green" style="left:24%;top:52%">2</span>
      <span class="pin" style="left:72%;top:22%">S</span>
      <span class="map-label" style="left:17%;top:31%">Teluk Lampung</span>
      <span class="map-label" style="left:58%;top:66%">Panjang Utara</span>
      <span class="map-label" style="left:36%;top:76%">Way Halim</span>
      <div class="legend" aria-label="Legenda risiko">
        <strong>Legenda risiko</strong>
        <span class="legend-row"><i class="swatch critical"></i>Sangat Tinggi</span>
        <span class="legend-row"><i class="swatch high"></i>Tinggi</span>
        <span class="legend-row"><i class="swatch medium"></i>Sedang</span>
        <span class="legend-row"><i class="swatch low"></i>Rendah</span>
      </div>
    </div>
  `;
}

function topStrip() {
  return `
    <header class="top-strip">
      <a class="brand" href="#portal">
        <span class="brand-mark">${icon("water_drop")}</span>
        <span>SIPERAH-RoB</span>
      </a>
      <nav class="top-links" aria-label="Navigasi utama">
        <a href="#map">Peta Risiko</a>
        <a href="#awam">Mode Awam</a>
        <a href="#report">Lapor</a>
        <a href="#research">Data & API</a>
        <a class="btn dark" href="#login">Masuk</a>
      </nav>
    </header>
  `;
}

function portalPage() {
  const roleCards = [
    ["map", "map", "Portal Publik", "Peta risiko 4 level, horizon prediksi, layer evakuasi, laporan warga, dan ekspor data.", "span-5"],
    ["awam", "person_pin_circle", "Mode Awam", "Status bahaya lokasi warga dengan bahasa non-teknis, prakiraan 7 hari, dan tindakan aman.", "span-7"],
    ["community", "groups", "Peta Komunitas", "Laporan warga pada peta mobile, statistik laporan, filter wilayah, dan daftar laporan terkini.", "span-4"],
    ["report", "add_a_photo", "Lapor Kejadian", "Ground truth 3 langkah dengan lokasi, tingkat genangan, waktu kejadian, deskripsi, dan foto.", "span-4"],
    ["operator", "assignment_turned_in", "BPBD Operator", "Antrean laporan menunggu, validasi atau penolakan, SLA, dan status kelurahan kerja.", "span-4"],
    ["province", "monitoring", "BPBD Provinsi", "Ringkasan lintas kabupaten, populasi risiko, tren 30 hari, dan prioritas koordinasi.", "span-6"],
    ["research", "database", "Peneliti & API", "Dataset historis, metadata, lisensi, API key, dan endpoint REST untuk studi lanjutan.", "span-7"],
    ["admin", "manage_accounts", "Administrator", "Approval akun, role, wilayah kerja, status pengguna, audit log, dan ekspor sistem.", "span-5"]
  ];

  return `
    ${topStrip()}
    <main>
      <section class="hero">
        <div class="hero-grid">
          <div>
            <h1>SIPERAH-RoB</h1>
            <p>Sistem terpadu untuk membaca prediksi rob, menerima laporan warga, dan membantu BPBD memutuskan respons berbasis data Lampung.</p>
            <div class="hero-actions">
              <a class="btn primary" href="#map">${icon("map")}Buka peta risiko</a>
              <a class="btn secondary" href="#onboarding">Pelajari cara membaca risiko</a>
            </div>
          </div>
          <div class="visual-board" aria-label="Preview peta risiko">
            <div class="map-head">
              <span class="status-chip">${icon("warning")}Peringatan BMKG aktif</span>
              <span class="chip">Update 05:00 WIB</span>
            </div>
            ${mapArt()}
          </div>
        </div>
      </section>

      <section class="portal-grid tight">
        <h2>Akses sesuai peran, satu data yang sama.</h2>
        <p>Setiap layar dibangun dari alur PRD/SKPL: warga memahami risiko, BPBD memvalidasi, admin mengendalikan akses, peneliti mengambil data terstruktur.</p>
        <div class="role-grid">
          ${roleCards.map(([href, iconName, title, copy, span]) => `
            <a class="role-card ${span}" href="#${href}">
              <span class="icon-tile">${icon(iconName)}</span>
              <span>
                <strong>${title}</strong>
                <p>${copy}</p>
              </span>
            </a>
          `).join("")}
        </div>
      </section>

      <section class="risk-band">
        <div>
          <h2>Operasional untuk keputusan cepat.</h2>
          <p>Risiko tidak hanya tampil sebagai warna. Setiap status punya probabilitas, estimasi populasi, waktu puncak pasang, laporan lapangan, dan jejak audit.</p>
          <div class="metrics-strip">
            ${metrics.map(([value, label]) => `<span class="metric"><b>${value}</b><span>${label}</span></span>`).join("")}
          </div>
        </div>
        <div>
          ${mapArt()}
        </div>
      </section>
    </main>
  `;
}

function shell(active, content) {
  const [title, subtitle] = shellTitles[active];
  const nav = navItems.map(([key, iconName, label]) => `
    <a class="${key === active ? "active" : ""}" href="#${key}">
      ${icon(iconName)}<span>${label}</span>
    </a>
  `).join("");

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="side-brand" href="#portal">
          <strong>SIPERAH-RoB</strong>
          <span>Prediksi Risiko Banjir Rob Lampung</span>
        </a>
        <nav class="side-nav" aria-label="Navigasi aplikasi">${nav}</nav>
        <div class="side-account">
          <span class="avatar">BP</span>
          <span><strong>Budi Santoso</strong><br><small>BPBD Provinsi Lampung</small></span>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <div>
            <h1>${title}</h1>
            <p>${subtitle}</p>
          </div>
          <div class="top-actions">
            <label class="search">${icon("search")}<span>Cari wilayah atau laporan</span></label>
            <a class="btn secondary icon" href="#notifications" aria-label="Notifikasi">${icon("notifications")}</a>
            <a class="btn secondary icon" href="#login" aria-label="Akun">${icon("account_circle")}</a>
          </div>
        </header>
        <main class="content">${content}</main>
      </div>
      <nav class="mobile-nav" aria-label="Navigasi mobile">
        ${navItems.slice(1, 6).map(([key, iconName, label]) => `
          <a class="${key === active ? "active" : ""}" href="#${key}">${icon(iconName)}<span>${label}</span></a>
        `).join("")}
      </nav>
    </div>
  `;
}

function mapPage() {
  return shell("map", `
    <div class="map-layout">
      <section class="visual-board">
        <div class="map-head">
          <div>
            <strong>Teluk Lampung dan pesisir terdampak</strong><br>
            <small>Prediksi +1 hari, model Random Forest v1.2.0</small>
          </div>
          ${chip("Probabilitas tertinggi 82%", "critical")}
        </div>
        ${mapArt("large")}
      </section>
      <aside class="workspace-grid">
        <div class="alert">${icon("warning")}<span><strong>BMKG: pasang ekstrem.</strong><br>Bandar Lampung dan Lampung Selatan berpotensi terdampak 24-26 Oktober.</span></div>
        <section class="panel">
          <h2>Horizon prediksi</h2>
          <div class="segmented">
            <button>Hari ini</button><button class="active">+1</button><button>+3</button><button>+7</button>
          </div>
        </section>
        <section class="panel">
          <h2>Layer data</h2>
          <div class="control-list">
            <label class="check-row"><span>Zona bahaya rob</span><input checked type="checkbox"></label>
            <label class="check-row"><span>Laporan ground truth</span><input checked type="checkbox"></label>
            <label class="check-row"><span>Jalur evakuasi</span><input type="checkbox"></label>
            <label class="check-row"><span>Stasiun pasang surut BMKG</span><input checked type="checkbox"></label>
          </div>
        </section>
        <section class="panel">
          <h2>Detail wilayah</h2>
          <p><strong>Panjang Utara, Bandar Lampung</strong></p>
          <p>Risiko sangat tinggi. Probabilitas 82%, puncak pasang 21:40 WIB, populasi berisiko 12.890 jiwa.</p>
          <div class="button-row">
            <a class="btn primary" href="#report">${icon("add_location_alt")}Laporkan kejadian</a>
            <button class="btn secondary">${icon("download")}Ekspor data</button>
          </div>
        </section>
      </aside>
    </div>
  `);
}

function communityPage() {
  return shell("community", `
    <div class="split">
      <section class="visual-board">${mapArt("large")}</section>
      <aside class="workspace-grid">
        ${metricCard("Laporan 24 jam", "37", "12 menunggu validasi", "urgent")}
        ${metricCard("Tervalidasi bulan ini", "1.204", "Sumber ground truth")}
        <section class="panel">
          <h2>Laporan terkini</h2>
          <div class="queue">
            ${reports.map(([code, area, text, time, severity, tone]) => `
              <article class="check-row">
                <span><strong>${area}</strong><br><small>${code} - ${text}</small></span>
                <span>${badge(severity, tone)}<br><small>${time}</small></span>
              </article>
            `).join("")}
          </div>
        </section>
      </aside>
    </div>
  `);
}

function awamPage() {
  return shell("awam", `
    <div class="workspace-grid">
      <section class="status-hero">
        <span class="chip high">${icon("location_on")}Lokasi: Panjang Utara</span>
        <strong>Bahaya tinggi</strong>
        <p>Air laut diprediksi naik malam ini. Hindari jalan rendah dekat pesisir dan siapkan barang penting sebelum 20:30 WIB.</p>
        <div class="button-row">
          <a class="btn primary" href="#report">${icon("add_a_photo")}Lapor genangan</a>
          <a class="btn secondary" href="#onboarding">Baca panduan aman</a>
        </div>
      </section>
      <div class="dashboard-grid">
        ${metricCard("Probabilitas", "74%", "Tinggi")}
        ${metricCard("Pasang maksimum", "1,46 m", "Puncak 21:40 WIB")}
        ${metricCard("Laporan sekitar", "8", "3 tervalidasi")}
        ${metricCard("Update", "05:00", "Prediksi harian")}
      </div>
      <section class="panel">
        <h2>Prakiraan 7 hari</h2>
        <div class="forecast-grid">
          ${["Hari ini", "+1", "+2", "+3", "+4", "+5", "+7"].map((day, i) => `
            <span class="forecast"><strong>${day}</strong><br>${badge(i < 2 ? "Tinggi" : i < 4 ? "Sedang" : "Rendah", i < 2 ? "high" : i < 4 ? "medium" : "low")}</span>
          `).join("")}
        </div>
      </section>
      <section class="panel">
        <h2>Tindakan yang disarankan</h2>
        <div class="control-list">
          <span class="check-row">Pindahkan kendaraan dari area rendah sebelum malam.</span>
          <span class="check-row">Simpan dokumen penting di tempat tinggi dan kedap air.</span>
          <span class="check-row">Ikuti arahan RT, kelurahan, dan BPBD setempat.</span>
        </div>
      </section>
    </div>
  `);
}

function reportBody() {
  if (reportStep === 1) {
    return `
      <div class="split">
        <section class="visual-board">${mapArt("large")}</section>
        <section class="panel">
          <h2>Pilih lokasi kejadian</h2>
          <div class="form-grid">
            <label class="field"><span>Kabupaten atau kota</span><select><option>Bandar Lampung</option><option>Lampung Selatan</option></select></label>
            <label class="field"><span>Kelurahan</span><input value="Panjang Utara"></label>
            <label class="field"><span>Koordinat</span><input value="-5.450000, 105.266667"></label>
            <button class="btn primary" data-report-step="2">Lanjut isi detail</button>
          </div>
        </section>
      </div>
    `;
  }
  if (reportStep === 2) {
    return `
      <section class="panel">
        <h2>Detail genangan</h2>
        <div class="severity-grid">
          <button class="severity"><strong>Ringan</strong><br><small>&lt;10 cm</small></button>
          <button class="severity selected"><strong>Sedang</strong><br><small>10-30 cm</small></button>
          <button class="severity"><strong>Parah</strong><br><small>30-80 cm</small></button>
          <button class="severity"><strong>Sangat Parah</strong><br><small>&gt;80 cm</small></button>
        </div>
        <div class="form-grid" style="margin-top:16px">
          <label class="field"><span>Waktu kejadian</span><input type="datetime-local" value="2026-07-09T20:30"></label>
          <label class="field"><span>Estimasi tinggi air</span><input value="28 cm"></label>
          <label class="field"><span>Deskripsi</span><textarea>Genangan masuk ke akses pasar dan menutup sebagian jalan warga.</textarea></label>
          <div class="button-row">
            <button class="btn secondary" data-report-step="1">Kembali</button>
            <button class="btn primary" data-report-step="3">Lanjut unggah foto</button>
          </div>
        </div>
      </section>
    `;
  }
  return `
    <section class="panel">
      <h2>Foto dan review laporan</h2>
      <div class="upload-grid">
        <button class="upload-slot">${icon("add_a_photo")}<br>Tambah foto JPG atau PNG</button>
        <span class="photo-sample" aria-label="Contoh dokumentasi genangan"></span>
        <span class="upload-slot">Maksimal 2 MB per foto</span>
      </div>
      <div class="alert blue" style="margin-top:16px">${icon("info")}<span>Laporan akan berstatus menunggu sampai operator BPBD memverifikasi dalam target 1x24 jam.</span></div>
      <div class="button-row">
        <button class="btn secondary" data-report-step="2">Kembali</button>
        <button class="btn primary">${icon("send")}Kirim laporan</button>
      </div>
    </section>
  `;
}

function reportPage() {
  return shell("report", `
    <div class="workspace-grid">
      <div class="stepper">
        <button class="${reportStep === 1 ? "active" : ""}" data-report-step="1">1. Lokasi</button>
        <button class="${reportStep === 2 ? "active" : ""}" data-report-step="2">2. Detail</button>
        <button class="${reportStep === 3 ? "active" : ""}" data-report-step="3">3. Foto & kirim</button>
      </div>
      ${reportBody()}
    </div>
  `);
}

function operatorPage() {
  return shell("operator", `
    <div class="dashboard-grid">
      ${metricCard("Antrean verifikasi", "14", "+3 baru", "urgent")}
      ${metricCard("Laporan tervalidasi", "128", "Hari ini")}
      ${metricCard("Wilayah siaga", "5", "Kelurahan")}
      ${metricCard("Respons rata-rata", "12 m", "Di bawah SLA")}
      <section class="panel span-7">
        <h2>Antrean laporan warga</h2>
        <div class="queue">
          ${reports.map(([code, area, text, time, severity, tone]) => `
            <article class="queue-item">
              <span class="thumb"></span>
              <span>
                <strong>${area}</strong> ${badge(severity, tone)}<br>
                <small>${code} - ${time}</small>
                <p>${text}</p>
                <span class="queue-actions">
                  <button class="btn primary">${icon("check_circle")}Validasi</button>
                  <button class="btn ghost">${icon("cancel")}Tolak</button>
                  <button class="btn secondary icon" aria-label="Detail">${icon("more_vert")}</button>
                </span>
              </span>
            </article>
          `).join("")}
        </div>
      </section>
      <aside class="workspace-grid span-5">
        <section class="panel">
          <h2>Status bahaya kelurahan</h2>
          <table class="table">
            <tbody>
              <tr><td>Panjang Utara</td><td>${badge("Kritis", "critical")}</td></tr>
              <tr><td>Sukadanaham</td><td>${badge("Waspada", "medium")}</td></tr>
              <tr><td>Way Halim</td><td>${badge("Aman", "low")}</td></tr>
            </tbody>
          </table>
        </section>
        <section class="panel">
          <h2>Empty state terfilter</h2>
          <div class="empty-state">Tidak ada laporan ditolak untuk filter hari ini. Ubah periode untuk melihat riwayat.</div>
        </section>
      </aside>
    </div>
  `);
}

function provincePage() {
  return shell("province", `
    <div class="dashboard-grid">
      ${metricCard("Kabupaten dipantau", "15", "Cakupan penuh")}
      ${metricCard("Bahaya tinggi+", "42", "Kelurahan", "urgent")}
      ${metricCard("Populasi risiko", "284K", "Estimasi BPS")}
      ${metricCard("Validasi bulan ini", "1.204", "Laporan")}
      <section class="panel span-7">
        <h2>Prediksi tren 30 hari</h2>
        <div class="mini-chart">
          ${[48, 56, 42, 63, 58, 72, 66, 84, 78, 90].map(h => `<span class="bar" style="height:${h}%"></span>`).join("")}
        </div>
      </section>
      <section class="visual-board span-5">
        <div class="map-head"><strong>Zona Lampung Selatan</strong>${chip("Tinggi", "high")}</div>
        ${mapArt()}
      </section>
      <section class="table-card span-12">
        <h2 style="padding:18px 18px 0">Indikator risiko per kabupaten</h2>
        <table class="table">
          <thead><tr><th>Kabupaten/Kota</th><th>Tingkat bahaya</th><th>Populasi risiko</th><th>Tren</th><th>Aksi</th></tr></thead>
          <tbody>
            ${districts.map(([name, risk, pop, trend, tone]) => `<tr><td><strong>${name}</strong></td><td>${badge(risk, tone)}</td><td>${pop}</td><td>${trend}</td><td><a href="#map">Detail</a></td></tr>`).join("")}
          </tbody>
        </table>
      </section>
    </div>
  `);
}

function notificationsPage() {
  const channels = ["Push browser", "Email", "WhatsApp", "SMS khusus operator"];
  const events = ["Bahaya sangat tinggi", "Laporan ground truth baru", "Update model prediksi", "Ringkasan harian", "BMKG pasang ekstrem"];
  return shell("notifications", `
    <div class="split">
      <section class="panel">
        <h2>Kanal notifikasi</h2>
        <div class="control-list">
          ${channels.map((item, i) => `<label class="toggle-row"><span>${item}</span><input ${i < 3 ? "checked" : ""} type="checkbox"></label>`).join("")}
        </div>
      </section>
      <section class="panel">
        <h2>Jam sunyi</h2>
        <p>Notifikasi non-kritis ditahan. Peringatan sangat tinggi tetap dikirim.</p>
        <div class="form-grid">
          <label class="field"><span>Mulai</span><input type="time" value="22:00"></label>
          <label class="field"><span>Selesai</span><input type="time" value="05:00"></label>
        </div>
      </section>
      <section class="panel">
        <h2>Jenis peristiwa</h2>
        <div class="control-list">
          ${events.map((item, i) => `<label class="check-row"><span>${item}</span><input ${i !== 3 ? "checked" : ""} type="checkbox"></label>`).join("")}
        </div>
      </section>
      <section class="panel">
        <h2>Wilayah pantau</h2>
        <div class="control-list">
          ${["Panjang Utara", "Teluk Betung", "Way Halim"].map(item => `<span class="check-row"><span>${item}</span>${chip("Aktif", "success")}</span>`).join("")}
          <button class="btn secondary">${icon("add")}Tambah wilayah</button>
        </div>
      </section>
    </div>
  `);
}

function adminPage() {
  return shell("admin", `
    <div class="workspace-grid">
      <div class="alert blue">${icon("person_add")}<span><strong>3 permintaan akun menunggu persetujuan.</strong><br>2 peneliti dan 1 BPBD operator membutuhkan validasi instansi.</span><a class="btn primary" href="#admin">Tinjau</a></div>
      <section class="panel">
        <div class="dashboard-grid">
          <label class="field span-4"><span>Role</span><select><option>Semua role</option></select></label>
          <label class="field span-4"><span>Status</span><select><option>Semua status</option></select></label>
          <label class="field span-4"><span>Wilayah</span><select><option>Provinsi Lampung</option></select></label>
        </div>
      </section>
      <section class="table-card">
        <table class="table">
          <thead><tr><th>Profil pengguna</th><th>Peran</th><th>Wilayah</th><th>Status</th><th>Terakhir login</th><th>Aksi</th></tr></thead>
          <tbody>
            ${users.map(([name, email, roleName, region, status, login]) => `
              <tr>
                <td><strong>${name}</strong><br><small>${email}</small></td>
                <td>${badge(roleName, "info")}</td>
                <td>${region}</td>
                <td>${badge(status, status === "Aktif" ? "success" : status === "Verifikasi" ? "medium" : "critical")}</td>
                <td>${login}</td>
                <td><button class="btn secondary icon" aria-label="Aksi pengguna">${icon("more_vert")}</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>
    </div>
  `);
}

function auditPage() {
  const first = audits[0];
  return shell("audit", `
    <div class="split">
      <section class="panel">
        <div class="tabs"><button class="active">Semua</button><button>Login</button><button>Validasi</button><button>Ekspor</button></div>
        <div class="queue" style="margin-top:16px">
          ${audits.map(([action, actor, outcome, text, time]) => `
            <article class="check-row">
              <span><strong>${action}</strong><br>${actor}<br><small>${text}</small></span>
              <span>${badge(outcome, outcome === "success" ? "success" : outcome === "fail" ? "critical" : "medium")}<br><small>${time}</small></span>
            </article>
          `).join("")}
        </div>
      </section>
      <aside class="workspace-grid">
        <section class="panel">
          <h2>${first[0]} Details</h2>
          <p><strong>Aktor:</strong> ${first[1]}<br><strong>Status:</strong> HTTP 200 OK<br><strong>Timestamp:</strong> 24 Okt 2023 14:22:10 WIB</p>
        </section>
        <pre class="code-block">{
  "action": "UPDATE_RISK_MAP",
  "entity": "hazard_zone_coastal",
  "coordinates": { "lat": -5.450000, "lng": 105.266667 },
  "previous_state": { "radius_meters": 200, "severity_index": 0.65 },
  "new_state": { "radius_meters": 350, "severity_index": 0.82 }
}</pre>
      </aside>
    </div>
  `);
}

function researchPage() {
  return shell("research", `
    <div class="workspace-grid">
      <section class="panel">
        <h2>Manajemen API key</h2>
        <div class="dashboard-grid">
          <span class="api-key span-6"><span><strong>Production_Key_Main</strong><br><code>sk_live_â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢3a9c</code></span>${badge("Aktif", "success")}</span>
          <span class="api-key span-6"><span><strong>Sandbox_Testing</strong><br><code>sk_test_â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢f821</code></span>${badge("Sandbox", "info")}</span>
        </div>
        <div class="button-row"><button class="btn primary">${icon("key")}Generate key baru</button><button class="btn secondary">${icon("content_copy")}Salin key</button></div>
      </section>
      <section class="dashboard-grid">
        ${metricCard("Dataset tersedia", "124", "CSV dan JSON")}
        ${metricCard("Total rekaman", "1.35M", "Prediksi dan laporan")}
        ${metricCard("Unduhan bulan ini", "2.408", "Peneliti terdaftar")}
        ${metricCard("Panggilan API harian", "18.2K", "Rate limit aktif")}
      </section>
      <section class="table-card">
        <table class="table">
          <thead><tr><th>Dataset</th><th>Periode</th><th>Resolusi</th><th>Rekaman</th><th>Lisensi</th><th>Aksi</th></tr></thead>
          <tbody>
            ${datasets.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}<td><button class="btn secondary">CSV</button> <button class="btn secondary">JSON</button></td></tr>`).join("")}
          </tbody>
        </table>
      </section>
      <section class="panel">
        <h2>Referensi API</h2>
        <pre class="code-block">GET /v1/predictions/daily?date=YYYY-MM-DD
GET /v1/reports?status=validated
GET /v1/tidal
Authorization: Bearer sip_â€¢â€¢â€¢â€¢</pre>
      </section>
    </div>
  `);
}

function onboardingPage() {
  return shell("onboarding", `
    <div class="split">
      <section class="panel">
        <h2>Cara membaca peta risiko</h2>
        <div class="control-list">
          <span class="check-row"><span><strong>Rendah</strong><br>Rob tidak diprediksi mengganggu aktivitas utama.</span>${badge("Rendah", "low")}</span>
          <span class="check-row"><span><strong>Sedang</strong><br>Area rendah perlu waspada, terutama saat puncak pasang.</span>${badge("Sedang", "medium")}</span>
          <span class="check-row"><span><strong>Tinggi</strong><br>Siapkan jalur aman, pantau laporan warga, dan hindari area pesisir rendah.</span>${badge("Tinggi", "high")}</span>
          <span class="check-row"><span><strong>Sangat Tinggi</strong><br>Ikuti arahan BPBD dan prioritaskan evakuasi kelompok rentan.</span>${badge("Sangat Tinggi", "critical")}</span>
        </div>
      </section>
      <section class="faq">
        <details open><summary>Seberapa sering peta diperbarui?</summary><p>Prediksi diperbarui harian pukul 05:00 WIB dan dapat naik menjadi 2 kali sehari saat perigee atau kejadian astronomis signifikan.</p></details>
        <details><summary>Apakah warga harus login untuk melapor?</summary><p>Ya. PRD dan SKPL menetapkan laporan ground truth dibuat oleh warga terdaftar agar verifikasi dan privasi dapat dijaga.</p></details>
        <details><summary>Data apa yang dipakai model?</summary><p>Prediksi memakai data BMKG, BIG, BPS, data historis rob, dan laporan ground truth yang sudah divalidasi BPBD.</p></details>
        <details><summary>Apa arti laporan menunggu?</summary><p>Laporan sudah terkirim tetapi belum divalidasi operator BPBD. Target verifikasi adalah 1x24 jam.</p></details>
      </section>
    </div>
  `);
}

function loginPage() {
  return `
    <main class="login-shell">
      <section class="login-brand">
        <div>
          <a class="brand" href="#portal"><span class="brand-mark">${icon("water_drop")}</span><span>SIPERAH-RoB</span></a>
          <h1>Masuk ke sistem pemantauan rob Lampung.</h1>
          <p>Gunakan akun terverifikasi untuk pelaporan warga, dashboard BPBD, administrasi, dan akses data peneliti.</p>
          <div class="metrics-strip">
            ${metrics.map(([value, label]) => `<span class="metric"><b>${value}</b><span>${label}</span></span>`).join("")}
          </div>
        </div>
      </section>
      <section class="login-card">
        <h2>Selamat datang</h2>
        <p>Masuk dengan email instansi atau akun warga terverifikasi.</p>
        <div class="form-grid">
          <label class="field"><span>Alamat email</span><input type="email" value="nama@instansi.go.id"></label>
          <label class="field"><span>Kata sandi</span><input type="password" value="password"></label>
          <label class="check-row"><span>Ingat saya di perangkat ini</span><input type="checkbox"></label>
          <a class="btn primary" href="#province">${icon("login")}Masuk ke dashboard</a>
          <a class="btn secondary" href="#admin">${icon("person_add")}Ajukan registrasi akun</a>
        </div>
      </section>
    </main>
  `;
}

function render() {
  const active = route();
  const pages = {
    portal: portalPage,
    login: loginPage,
    map: mapPage,
    community: communityPage,
    awam: awamPage,
    report: reportPage,
    operator: operatorPage,
    province: provincePage,
    notifications: notificationsPage,
    admin: adminPage,
    audit: auditPage,
    research: researchPage,
    onboarding: onboardingPage
  };
  app.innerHTML = pages[active]();
  document.title = active === "portal" ? "SIPERAH-RoB Redesign" : `${shellTitles[active]?.[0] || "SIPERAH-RoB"} | SIPERAH-RoB`;
}

document.addEventListener("click", event => {
  const stepButton = event.target.closest("[data-report-step]");
  if (!stepButton) return;
  reportStep = Number(stepButton.dataset.reportStep);
  location.hash = "report";
  render();
});

window.addEventListener("hashchange", render);
render();
