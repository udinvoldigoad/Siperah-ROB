import { useState } from "react";
import { Icon } from "../../shared/components/Icon";
import { api } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
  };
}

export function LoginPage() {
  const toast = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);

  // Form Fields
  const [email, setEmail] = useState("andi.saputra@bpbd.lampung.go.id");
  const [password, setPassword] = useState("password");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState("warga");
  const [regInstitution, setRegInstitution] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Email dan kata sandi wajib diisi.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("siperah-token", res.access_token);
      localStorage.setItem("siperah-user", JSON.stringify(res.user));

      toast.success(`Selamat datang kembali, ${res.user.name}!`);
      
      // Dynamic redirect based on role
      setTimeout(() => {
        if (res.user.role === "admin") {
          window.location.hash = "#/admin";
        } else if (res.user.role === "bpbd_operator") {
          window.location.hash = "#/operator";
        } else if (res.user.role === "bpbd_provinsi") {
          window.location.hash = "#/province";
        } else if (res.user.role === "peneliti") {
          window.location.hash = "#/research";
        } else {
          window.location.hash = "#/";
        }
      }, 500);

    } catch (err: any) {
      toast.error(err.message || "Gagal masuk. Silakan cek kredensial Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      toast.error("Nama, email, dan kata sandi wajib diisi.");
      return;
    }

    setIsLoading(true);
    try {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          role: regRole,
          institution: regInstitution,
        }),
      });

      toast.success("Pendaftaran berhasil! Permintaan akun menunggu persetujuan admin.");
      setMode("login");
      setEmail(regEmail);
      setPassword("");
    } catch (err: any) {
      toast.error(err.message || "Pendaftaran gagal. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-layout">
      {/* Visual Left Banner */}
      <section style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius)", background: "linear-gradient(160deg, #0f172a, #1e3a5f)", color: "#fff", padding: 48, minHeight: 640 }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <a className="brand" href="#/" style={{ color: "#fff", marginBottom: 28 }}><Icon name="water_drop" />SIPERAH-RoB</a>
          <h1 style={{ color: "#fff", fontSize: 56, maxWidth: 420, lineHeight: 1.1, fontWeight: 900 }}>Pantau ancaman banjir rob secara real-time</h1>
          <p style={{ color: "rgba(255,255,255,.72)", maxWidth: 480, fontSize: 16, marginBottom: 36, lineHeight: 1.5 }}>Akses peta risiko pesisir Lampung, prediksi model AI, dan laporan validasi lapangan terpadu.</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {[
              ["7", "Kabupaten dipantau"],
              ["283", "Kelurahan pesisir"],
              ["87%", "Akurasi model"],
            ].map(([value, label]) => (
              <div key={label} style={{ background: "rgba(255,255,255,.08)", borderRadius: "var(--radius)", padding: 14 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#bfdbfe" }}>{value}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,.56)", marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form Right Panel */}
      <section className="panel" style={{ padding: 40, borderRadius: "var(--radius)" }}>
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
          <form className="form" style={{ gap: 16 }} onSubmit={handleLogin}>
            <h2>Selamat datang</h2>
            <label>
              Email
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="email@instansi.go.id" 
                required
              />
            </label>
            <label>
              Kata sandi
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required
              />
            </label>
            
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" style={{ accentColor: "var(--accent)" }} />
                Ingat saya
              </label>
              <a href="#" style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700 }}>Lupa kata sandi?</a>
            </div>

            <button className="btn primary" type="submit" style={{ width: "100%" }} disabled={isLoading}>
              {isLoading ? "Memproses..." : "Masuk"}
            </button>

            <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-soft)" }}>
              Belum punya akun? <button type="button" onClick={() => setMode("register")} style={{ border: "none", background: "none", color: "var(--accent)", fontWeight: 800, cursor: "pointer", padding: 0 }}>Daftar sekarang</button>
            </div>
          </form>
        ) : (
          <form className="form" style={{ gap: 16 }} onSubmit={handleRegister}>
            <h2>Buat akun baru</h2>
            <label>
              Nama lengkap
              <input 
                type="text" 
                placeholder="Nama Lengkap Anda" 
                value={regName} 
                onChange={(e) => setRegName(e.target.value)} 
                required
              />
            </label>
            <label>
              Instansi / wilayah kerja
              <input 
                type="text" 
                placeholder="BPBD Provinsi Lampung / Pusdalops" 
                value={regInstitution} 
                onChange={(e) => setRegInstitution(e.target.value)} 
              />
            </label>
            <label>
              Role Akses
              <select value={regRole} onChange={(e) => setRegRole(e.target.value)} required>
                <option value="warga">Warga Biasa</option>
                <option value="bpbd_operator">Operator BPBD Kabupaten/Kota</option>
                <option value="bpbd_provinsi">BPBD Provinsi</option>
                <option value="peneliti">Peneliti (Dataset API)</option>
              </select>
            </label>
            <label>
              Email
              <input 
                type="email" 
                placeholder="email@instansi.go.id" 
                value={regEmail} 
                onChange={(e) => setRegEmail(e.target.value)} 
                required
              />
            </label>
            <label>
              Kata sandi
              <input 
                type="password" 
                placeholder="Minimal 6 karakter" 
                value={regPassword} 
                onChange={(e) => setRegPassword(e.target.value)} 
                required
              />
            </label>
            <button className="btn primary" type="submit" style={{ width: "100%" }} disabled={isLoading}>
              {isLoading ? "Memproses..." : "Daftar"}
            </button>
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink-soft)" }}>
              Sudah punya akun? <button type="button" onClick={() => setMode("login")} style={{ border: "none", background: "none", color: "var(--accent)", fontWeight: 800, cursor: "pointer", padding: 0 }}>Masuk</button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
