import { FormEvent, useState } from "react";
import { api } from "../../shared/api/client";
import { AppShell } from "../../shared/components/AppShell";
import { useToast } from "../../shared/components/Toast";

type ReportResponse = {
  message: string;
  data: {
    report_code: string;
  };
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
      const response = await api<ReportResponse>("/reports", { method: "POST", body: payload });
      toast.success(`Laporan terkirim. Kode verifikasi: ${response.data.report_code}.`);
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
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <div className="step-strip" aria-label="Tahap laporan ground truth" style={{ marginBottom: 28, maxWidth: 640 }}>
          <span><b>1</b> Pilih lokasi</span>
          <span><b>2</b> Detail kejadian</span>
          <span><b>3</b> Foto & kirim</span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 32, alignItems: "start" }}>
          <input type="hidden" name="coordinates" value="-5.4500, 105.266667" />
          <input type="hidden" name="severity" value={selectedSeverity} />

          {/* Left Column: Form Fields */}
          <div className="panel" style={{ display: "grid", gap: 24, padding: 32 }}>
            <h2 style={{ fontSize: "1.25rem", margin: 0, paddingBottom: 16, borderBottom: "1px solid var(--line)" }}>Detail Informasi</h2>

            <section style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Lokasi dipilih</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "var(--surface-soft)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
                <span className="material-symbols-outlined" style={{ color: "var(--accent)", fontSize: 20 }}>location_on</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Kel. Panjang Utara, Kec. Panjang</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>-5.4500°, 105.266667° · Bandar Lampung</div>
                </div>
                <button type="button" className="btn secondary" style={{ marginLeft: "auto", minHeight: 32, padding: "6px 12px", fontSize: 12 }}>Ubah Lokasi</button>
              </div>
            </section>

            <section style={{ display: "grid", gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Peta lokasi</label>
              <div style={{ height: 240, position: "relative", overflow: "hidden", borderRadius: 16, background: "linear-gradient(160deg, #a8d0e6, #c8e4f0)", border: "1px solid var(--line)" }}>
                <svg width="100%" height="100%" viewBox="0 0 640 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                  <defs>
                    <linearGradient id="sea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#bfdced" />
                      <stop offset="100%" stopColor="#a7d0e5" />
                    </linearGradient>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#sea)" />
                  <path d="M0,20 C80,10 200,15 300,25 C400,35 500,20 640,18 L640,180 C540,195 400,200 280,190 C160,180 80,185 0,190Z" fill="#dde8c0" />
                  <circle cx="320" cy="120" r="10" fill="#1d4ed8" opacity="0.8" />
                  <circle cx="320" cy="120" r="24" fill="#1d4ed8" opacity="0.22" />
                  <text x="336" y="118" style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fill: "#1e3a5f", fontWeight: 600 }}>Panjang Utara</text>
                </svg>
                <button type="button" className="btn secondary" style={{ position: "absolute", top: 12, right: 12, padding: "8px 12px", fontSize: 12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span> Edit pin
                </button>
              </div>
            </section>

            <section style={{ display: "grid", gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Tingkat keparahan</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
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
                        padding: 16,
                        textAlign: "center",
                        cursor: "pointer",
                        boxShadow: isSelected ? `0 0 0 3px ${option.tone}26` : "none",
                        transition: "all 0.2s"
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ color: option.tone, fontSize: 24, display: "block", margin: "0 auto 8px" }}>
                        water_drop
                      </span>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? option.tone : "var(--ink)" }}>
                        {option.label}{isSelected ? " ✓" : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>{option.note}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <label htmlFor="water_height_cm" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Estimasi ketinggian air (cm)</label>
                <input id="water_height_cm" name="water_height_cm" type="number" min="0" max="500" defaultValue="45" required />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <label htmlFor="incident_time" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Waktu kejadian</label>
                <input id="incident_time" name="incident_time" type="time" defaultValue="09:30" required />
              </div>
            </div>

            <section style={{ display: "grid", gap: 8 }}>
              <label htmlFor="description" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                Deskripsi kejadian <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>(opsional)</span>
              </label>
              <textarea
                id="description"
                name="description"
                placeholder="Deskripsikan kondisi banjir rob yang Anda amati…"
                defaultValue="Air masuk ke jalan setinggi lutut, beberapa rumah terendam di RT 03."
              />
            </section>

            <section style={{ display: "grid", gap: 8 }}>
              <label htmlFor="photos" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Foto dokumentasi</label>
              <input id="photos" name="photos" type="file" accept="image/png,image/jpeg" multiple style={{ padding: "12px 14px" }} />
              <p className="form-note" style={{ marginTop: 8 }}>Laporan diverifikasi BPBD maksimal 1x24 jam sebelum dipakai sebagai ground truth.</p>
            </section>
          </div>

          {/* Right Column: Summary & Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 100 }}>
            <div className="panel" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
              <h2 style={{ fontSize: "1.1rem", marginBottom: 20 }}>Ringkasan Laporan</h2>
              <div className="summary-grid" style={{ display: "grid", gap: 14 }}>
                {[
                  ["Lokasi", "Kel. Panjang Utara"],
                  ["Keparahan", "Parah"],
                  ["Ketinggian air", "±45 cm"],
                  ["Waktu kejadian", "09:30 WIB"],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
                    <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>{label}</span>
                    <strong style={{ fontSize: 14 }}>{value}</strong>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Foto dilampirkan</span>
                  <strong style={{ fontSize: 14 }}>2 foto</strong>
                </div>
              </div>
            </div>

            <div style={{ background: "var(--accent-soft)", border: "1px solid rgba(99, 102, 241, 0.2)", borderRadius: 16, padding: 16, display: "flex", alignItems: "start", gap: 12 }}>
              <input type="checkbox" defaultChecked style={{ marginTop: 4, width: 16, height: 16, accentColor: "var(--accent)", flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.6 }}>Saya menyatakan bahwa data yang dilaporkan adalah informasi nyata yang saya saksikan sendiri. Data ini akan digunakan untuk meningkatkan model prediksi banjir rob SIPERAH-RoB.</span>
            </div>

            <button className="btn primary" type="submit" disabled={isSubmitting} style={{ padding: "14px 24px", fontSize: 15 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              {isSubmitting ? "Mengirim..." : "Kirim laporan sekarang"}
            </button>
            <button type="button" className="btn secondary" style={{ padding: "14px 24px", fontSize: 14, border: "none", background: "transparent" }}>
              Batal
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
