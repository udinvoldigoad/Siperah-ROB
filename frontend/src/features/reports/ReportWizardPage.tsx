import { FormEvent, useState } from "react";
import { api } from "../../shared/api/client";
import { AppShell } from "../../shared/components/AppShell";
import { useToast } from "../../shared/components/Toast";

type ReportResponse = {
  message: string;
  report_code: string;
};

const panjangUtaraRegionId = "11111111-1111-4111-8111-111111111111";

const severityOptions = [
  { key: "ringan", label: "Ringan", note: "Genangan <10cm", tone: "#16a34a", className: "sel-low" },
  { key: "sedang", label: "Sedang", note: "10-30 cm", tone: "#d97706", className: "sel-med" },
  { key: "parah", label: "Parah", note: "30-80 cm", tone: "#ea580c", className: "sel-hi" },
  { key: "sangat_parah", label: "Sangat Parah", note: ">80 cm", tone: "#dc2626", className: "sel-vhi" },
] as const;

function splitCoordinates(value: string) {
  const [latitude, longitude] = value.split(",").map((part) => part.trim());
  return { latitude, longitude };
}

function toIncidentDateTime(value: string) {
  if (value.includes("T")) {
    return value;
  }

  const [hours = "00", minutes = "00"] = value.split(":");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
}

export function ReportWizardPage() {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<(typeof severityOptions)[number]["key"]>("parah");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const form = event.currentTarget;
    const input = new FormData(form);
    const { latitude, longitude } = splitCoordinates(String(input.get("coordinates") ?? ""));
    const incidentTime = toIncidentDateTime(String(input.get("incident_time") ?? "").trim());
    const payload = new FormData();

    payload.set("region_id", panjangUtaraRegionId);
    payload.set("latitude", latitude);
    payload.set("longitude", longitude);
    payload.set("severity", selectedSeverity);
    payload.set("water_height_cm", String(input.get("water_height_cm") ?? ""));
    payload.set("incident_time", incidentTime);
    payload.set("description", String(input.get("description") ?? ""));

    for (const photo of input.getAll("photos")) {
      if (photo instanceof File && photo.size > 0) payload.append("photos[]", photo);
    }

    try {
      const response = await api<ReportResponse>("/public/reports", { method: "POST", body: payload });
      toast.success(`Laporan terkirim. Kode verifikasi: ${response.report_code}.`);
      form.reset();
      setSelectedSeverity("parah");
    } catch {
      toast.error("Laporan belum terkirim. Cek isian dan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell 
      active="reports" 
      title="Form Laporan Ground Truth" 
      subtitle="Pilih lokasi, isi detail kejadian, unggah foto, lalu kirim."
      breadcrumbs={[
        { label: "Dashboard", href: "#/" },
        { label: "Pelaporan" }
      ]}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div className="step-strip" aria-label="Tahap laporan ground truth" style={{ marginBottom: 28 }}>
          <span><b>1</b> Pilih lokasi</span>
          <span><b>2</b> Detail kejadian</span>
          <span><b>3</b> Foto & kirim</span>
        </div>

        <form className="panel" onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <input type="hidden" name="coordinates" value="-5.4458, 105.2673" />
          <input type="hidden" name="severity" value={selectedSeverity} />

          <section style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>Lokasi dipilih</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--surface-soft)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
              <span className="material-symbols-outlined" style={{ color: "var(--accent)", fontSize: 18 }}>location_on</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Kel. Sukaraja, Kec. Telukbetung Selatan</div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 2 }}>-5.4458°, 105.2673° · Bandar Lampung</div>
              </div>
              <button type="button" className="btn secondary" style={{ marginLeft: "auto", minHeight: 32, padding: "6px 10px", fontSize: 11 }}>Ubah</button>
            </div>
          </section>

          <section style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>Peta lokasi</label>
            <div style={{ height: 200, position: "relative", overflow: "hidden", borderRadius: 16, background: "linear-gradient(160deg, #a8d0e6, #c8e4f0)", border: "1px solid var(--line)" }}>
              <svg width="100%" height="100%" viewBox="0 0 640 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <defs>
                  <linearGradient id="sea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#bfdced" />
                    <stop offset="100%" stopColor="#a7d0e5" />
                  </linearGradient>
                </defs>
                <rect width="640" height="200" fill="url(#sea)" />
                <path d="M0,20 C80,10 200,15 300,25 C400,35 500,20 640,18 L640,130 C540,145 400,150 280,140 C160,130 80,135 0,140Z" fill="#dde8c0" />
                <circle cx="320" cy="100" r="10" fill="#1d4ed8" opacity="0.8" />
                <circle cx="320" cy="100" r="20" fill="#1d4ed8" opacity="0.22" />
                <text x="336" y="98" style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fill: "#1e3a5f", fontWeight: 600 }}>Kel. Sukaraja</text>
              </svg>
              <button type="button" className="btn secondary" style={{ position: "absolute", top: 10, right: 10, minHeight: 30, padding: "5px 8px", fontSize: 11 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                Edit pin
              </button>
            </div>
          </section>

          <section style={{ display: "grid", gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>Tingkat keparahan</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              {severityOptions.map((option) => {
                const isSelected = selectedSeverity === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedSeverity(option.key)}
                    style={{
                      border: `2px solid ${isSelected ? option.tone : "var(--line)"}`,
                      background: isSelected ? `${option.tone}12` : "var(--surface)",
                      borderRadius: 16,
                      padding: 12,
                      textAlign: "center",
                      cursor: "pointer",
                      boxShadow: isSelected ? `0 0 0 2px ${option.tone}26` : "none",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ color: option.tone, fontSize: 22, display: "block", margin: "0 auto 6px" }}>
                      water_drop
                    </span>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? option.tone : "var(--ink)" }}>
                      {option.label}{isSelected ? " ✓" : ""}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 2 }}>{option.note}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={{ display: "grid", gap: 6 }}>
            <label htmlFor="description" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
              Deskripsi kejadian <span style={{ color: "var(--ink-soft)" }}>(opsional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              placeholder="Deskripsikan kondisi banjir rob yang Anda amati…"
              defaultValue="Air masuk ke jalan setinggi lutut, beberapa rumah terendam di RT 03."
            />
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label htmlFor="water_height_cm" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>Estimasi ketinggian air (cm)</label>
              <input id="water_height_cm" name="water_height_cm" type="number" min="0" max="500" defaultValue="45" required />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label htmlFor="incident_time" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>Waktu kejadian</label>
              <input id="incident_time" name="incident_time" type="time" defaultValue="09:30" required />
            </div>
          </div>

          <section style={{ display: "grid", gap: 6 }}>
            <label htmlFor="photos" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>Foto dokumentasi</label>
            <input id="photos" name="photos" type="file" accept="image/png,image/jpeg" multiple />
            <p className="form-note">Laporan diverifikasi BPBD maksimal 1x24 jam sebelum dipakai sebagai ground truth.</p>
          </section>

          <div className="panel" style={{ background: "var(--surface-soft)", borderColor: "var(--line)" }}>
            <h2>Ringkasan laporan</h2>
            <div className="summary-grid" style={{ display: "grid", gap: 10 }}>
              {[
                ["Lokasi", "Kel. Sukaraja, Telukbetung Selatan"],
                ["Keparahan", "Parah"],
                ["Ketinggian air", "±45 cm"],
                ["Waktu kejadian", "09:30 WIB"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
                  <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>{label}</span>
                  <strong style={{ fontSize: 13 }}>{value}</strong>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>Foto dilampirkan</span>
                <strong style={{ fontSize: 13 }}>2 foto</strong>
              </div>
            </div>
          </div>

          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 14, padding: 14, display: "flex", alignItems: "start", gap: 10 }}>
            <input type="checkbox" defaultChecked style={{ marginTop: 2, accentColor: "var(--accent)", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>Saya menyatakan bahwa data yang dilaporkan adalah informasi nyata yang saya saksikan sendiri. Data ini akan digunakan untuk meningkatkan model prediksi banjir rob SIPERAH-RoB.</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 4 }}>
            <button type="button" className="btn secondary" style={{ background: "var(--surface-soft)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_left</span>
              Kembali
            </button>
            <button className="btn primary" type="submit" disabled={isSubmitting}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
              {isSubmitting ? "Mengirim..." : "Kirim laporan"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
