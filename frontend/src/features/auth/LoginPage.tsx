import { useState } from "react";
import { Icon } from "../../shared/components/Icon";

export function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <main className="login-layout">
      <section style={{ position: "relative", overflow: "hidden", borderRadius: 28, background: "linear-gradient(160deg, #0f172a, #1e3a5f)", color: "#fff", padding: 48, minHeight: 640 }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <a className="brand" href="#/" style={{ color: "#fff", marginBottom: 28 }}><Icon name="water_drop" />SIPERAH-RoB</a>
          <h1 style={{ color: "#fff", fontSize: 56, maxWidth: 420 }}>Pantau ancaman banjir rob di Lampung secara real-time</h1>
          <p style={{ color: "rgba(255,255,255,.72)", maxWidth: 480, fontSize: 16, marginBottom: 36 }}>Akses peta risiko, prediksi AI, dan laporan ground truth dari seluruh wilayah pesisir Lampung.</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {[
              ["7", "Kabupaten dipantau"],
              ["283", "Kelurahan pesisir"],
              ["87%", "Akurasi model"],
            ].map(([value, label]) => (
              <div key={label} style={{ background: "rgba(255,255,255,.08)", borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#bfdbfe" }}>{value}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.56)", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel" style={{ padding: 40, borderRadius: 28 }}>
        <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "2px solid var(--line)" }}>
          {[
            ["login", "Masuk"],
            ["register", "Daftar"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value as "login" | "register")}
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 800,
                color: mode === value ? "var(--accent)" : "var(--ink-soft)",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${mode === value ? "var(--accent)" : "transparent"}`,
                marginBottom: -2,
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "login" ? (
          <form className="form" style={{ gap: 16 }}>
            <h2>Selamat datang</h2>
            <label>Email<input type="email" defaultValue="andi.saputra@bpbd.lampung.go.id" placeholder="email@instansi.go.id" /></label>
            <label>Kata sandi<input type="password" defaultValue="password" /></label>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" style={{ accentColor: "var(--accent)" }} />
                Ingat saya
              </label>
              <a href="#" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>Lupa kata sandi?</a>
            </div>
            <a className="btn primary" href="#/province" style={{ width: "100%" }}>Masuk</a>
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-soft)" }}>
              Belum punya akun? <button type="button" onClick={() => setMode("register")} style={{ border: "none", background: "none", color: "var(--accent)", fontWeight: 800, cursor: "pointer", padding: 0 }}>Daftar sekarang</button>
            </div>
          </form>
        ) : (
          <form className="form" style={{ gap: 16 }}>
            <h2>Buat akun baru</h2>
            <label>Nama lengkap<input type="text" placeholder="Nama Anda" /></label>
            <label>Instansi / wilayah<input type="text" placeholder="BPBD Provinsi Lampung" /></label>
            <label>Role<select defaultValue=""><option value="">Pilih role</option><option>BPBD Provinsi</option><option>BPBD Operator</option><option>Peneliti</option><option>Warga</option></select></label>
            <label>Email<input type="email" placeholder="email@instansi.go.id" /></label>
            <label>Kata sandi<input type="password" placeholder="Buat kata sandi" /></label>
            <button className="btn primary" type="button" style={{ width: "100%" }} onClick={() => setMode("login")}>Daftar</button>
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-soft)" }}>
              Sudah punya akun? <button type="button" onClick={() => setMode("login")} style={{ border: "none", background: "none", color: "var(--accent)", fontWeight: 800, cursor: "pointer", padding: 0 }}>Masuk</button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
