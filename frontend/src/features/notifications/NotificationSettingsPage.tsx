import { AppShell } from "../../shared/components/AppShell";

const events = [
  "Bahaya sangat tinggi",
  "Laporan baru wilayah kerja",
  "Update model prediksi",
  "Ringkasan harian",
  "BMKG pasang ekstrem",
];

const regions = ["Panjang Utara", "Kalianda", "Teluk Betung", "Pesisir Barat"];

export function NotificationSettingsPage() {
  return (
    <AppShell active="notifications" title="Pengaturan Notifikasi" subtitle="Kanal, event, jam sunyi, dan wilayah pantau.">
      <div className="stack">
        <section className="alert" style={{ display: "grid", gap: 6 }}>
          <strong>Notifikasi aktif untuk wilayah pantau yang dipilih</strong>
          <span>Pilih kanal dan event yang benar-benar dibutuhkan agar peringatan tetap jelas, tidak berlebihan, dan mudah dipantau.</span>
        </section>

        <div className="settings-grid">
          <section className="panel form">
            <h2>Kanal</h2>
            {[
              "Push browser",
              "Email",
              "WhatsApp",
              "SMS khusus operator",
            ].map((item) => (
              <label className="row" key={item} style={{ justifyContent: "space-between" }}>
                <span>{item}</span>
                <input type="checkbox" defaultChecked={item !== "SMS khusus operator"} />
              </label>
            ))}

            <h2>Jam sunyi</h2>
            <label>Mulai<input type="time" defaultValue="22:00" /></label>
            <label>Selesai<input type="time" defaultValue="05:00" /></label>
            <button className="btn primary" type="button">Simpan pengaturan</button>
          </section>

          <section className="panel">
            <h2>Event yang dikirim</h2>
            <div className="simple-list compact">
              {events.map((event) => (
                <label className="row" key={event} style={{ justifyContent: "space-between" }}>
                  <span>{event}</span>
                  <input type="checkbox" defaultChecked />
                </label>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Wilayah pantau</h2>
            <div className="chip-list">
              {regions.map((region) => <span className="badge status-menunggu" key={region}>{region}</span>)}
            </div>
            <p>Operator menerima laporan baru dan peringatan pasang ekstrem sesuai wilayah kerja.</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
