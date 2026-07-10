import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";

const topics = [
  ["Rob itu apa?", "Banjir rob terjadi saat muka air laut naik dan masuk ke area rendah dekat pesisir."],
  ["Arti kelas risiko", "Rendah sampai sangat tinggi menunjukkan peluang kejadian dan dampak ke warga."],
  ["Kapan harus waspada?", "Saat status tinggi atau sangat tinggi, terutama menjelang puncak pasang BMKG."],
  ["Cara melapor", "Pilih lokasi, isi tinggi air, tulis kondisi lapangan, lalu unggah foto pendukung."],
];

const faq = [
  ["Apakah laporan langsung tampil di peta?", "Belum. Laporan diverifikasi BPBD maksimal 1x24 jam sebelum dipakai sebagai ground truth."],
  ["Kenapa prediksi bisa berubah?", "Model membaca data pasang surut, cuaca, wilayah pesisir, dan laporan terbaru."],
  ["Apa yang harus dilakukan warga?", "Amankan dokumen penting, hindari jalan rendah, dan ikuti arahan BPBD setempat."],
];

export function OnboardingPage() {
  return (
    <AppShell active="onboarding" title="Panduan Mode Awam" subtitle="Penjelasan singkat untuk warga pesisir sebelum memakai peta dan laporan.">
      <div className="stack">
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Mulai dari sini</h2>
              <p>Mode awam menerjemahkan prediksi teknis menjadi arahan yang mudah dipahami warga.</p>
            </div>
            <a className="btn primary" href="#/awam">Cek status saya</a>
          </div>
          <div className="info-grid">
            {topics.map(([title, copy]) => (
              <article className="info-item" key={title}>
                <Icon name="task_alt" />
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>FAQ warga</h2>
          <div className="simple-list">
            {faq.map(([question, answer]) => (
              <article key={question}>
                <strong>{question}</strong>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
