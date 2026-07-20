import { useState } from "react";
import { Icon } from "../../shared/components/Icon";
import { api, ApiError } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { motion, AnimatePresence } from "framer-motion";

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
  // Status akun (pending/nonaktif/ditolak) untuk panel penjelas saat login gagal.
  const [loginNotice, setLoginNotice] = useState<{ message: string; status?: string } | null>(null);

  // Form Fields
  const [email, setEmail] = useState("andi.saputra@bpbd.lampung.go.id");
  const [password, setPassword] = useState("password");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regInstitution, setRegInstitution] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Email dan kata sandi wajib diisi.");
      return;
    }

    setIsLoading(true);
    setLoginNotice(null);
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
      // Akun belum aktif (menunggu/nonaktif/ditolak) → tampilkan panel status
      // yang jelas & persisten, bukan sekadar toast sesaat.
      if (err instanceof ApiError && err.status === 403 && err.body?.account_status) {
        setLoginNotice({ message: err.message, status: err.body.account_status });
      } else {
        toast.error(err.message || "Gagal masuk. Silakan cek kredensial Anda.");
      }
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

  const inputStyle = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 8,
    border: "1px solid var(--line)",
    background: "var(--bg)",
    fontSize: "14px",
    color: "var(--ink)",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--ink-soft)",
    marginBottom: "8px"
  };

  return (
    <main style={{ display: "flex", minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font)" }}>
      {/* Visual Left Banner */}
      <section style={{ 
        flex: "1 1 50%", 
        display: "none", 
        position: "relative", 
        overflow: "hidden", 
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 64, 175, 0.75) 100%), url('/bg-laut.jpg') center/cover no-repeat", 
        color: "#fff", 
        padding: "60px",
        flexDirection: "column",
        justifyContent: "space-between"
      }} className="desktop-flex">
        
        {/* Abstract Oceanic Background */}
        <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "50%", height: "50%", background: "#3b82f6", borderRadius: "50%", filter: "blur(120px)", opacity: 0.5 }}></div>
        <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "60%", height: "60%", background: "#60a5fa", borderRadius: "50%", filter: "blur(140px)", opacity: 0.3 }}></div>

        <div style={{ position: "relative", zIndex: 10 }}>
          <a href="#/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: "1.2rem", letterSpacing: "0.5px" }}>
            <div style={{ width: "36px", height: "36px", background: "rgba(255,255,255,0.2)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" }}>
              <Icon name="water_drop" style={{ fontSize: "20px" }} />
            </div>
            SIPERAH-RoB
          </a>
        </div>

        <div style={{ position: "relative", zIndex: 10, maxWidth: "500px" }}>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={{ color: "#fff", fontSize: "clamp(1.7rem, 2.7vw, 2.35rem)", lineHeight: 1.2, fontWeight: 900, margin: "0 0 24px", letterSpacing: "-0.02em" }}
          >
            Sistem Informasi Prediksi Risiko <br/><span style={{ color: "var(--ocean-light)" }}>Banjir Rob Terpadu Provinsi Lampung.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem", lineHeight: 1.6, marginBottom: "48px" }}
          >
            Akses platform terpadu untuk memantau ancaman banjir rob secara real-time, 
            dilengkapi dengan prediksi Machine Learning tingkat lanjut dan validasi data berbasis komunitas.
          </motion.p>


        </div>
      </section>

      {/* Form Right Panel */}
      <section style={{ flex: "1 1 50%", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1 }}
          style={{ width: "100%", maxWidth: "440px" }}
        >
          {/* Logo for mobile */}
          <div className="mobile-only" style={{ marginBottom: "40px", textAlign: "center" }}>
            <div style={{ display: "inline-flex", width: "48px", height: "48px", background: "var(--ocean-light)", color: "var(--ocean-dark)", borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <Icon name="water_drop" style={{ fontSize: "28px" }} />
            </div>
            <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>SIPERAH-RoB</h2>
          </div>

          <div style={{ display: "flex", gap: "24px", marginBottom: "40px", borderBottom: "2px solid var(--line)" }}>
            {[
              ["login", "Masuk Akun"],
              ["register", "Daftar Baru"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value as "login" | "register")}
                style={{
                  padding: "0 0 16px",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: mode === value ? "var(--ocean-dark)" : "var(--ink-soft)",
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${mode === value ? "var(--ocean-dark)" : "transparent"}`,
                  marginBottom: "-2px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.form 
                key="login"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleLogin}
              >
                <div style={{ marginBottom: "32px" }}>
                  <h2 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 8px", color: "var(--ink)" }}>Selamat datang</h2>
                  <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", margin: 0 }}>Silakan masukkan kredensial Anda untuk melanjutkan.</p>
                </div>

                {loginNotice && (() => {
                  const isPending = loginNotice.status === "menunggu";
                  const tone = isPending
                    ? { bg: "#fffbeb", border: "#fcd34d", ink: "#92400e", icon: "hourglass_top", title: "Akun menunggu persetujuan" }
                    : { bg: "#fef2f2", border: "#fca5a5", ink: "#991b1b", icon: "block",
                        title: loginNotice.status === "ditolak" ? "Pendaftaran ditolak" : "Akun dinonaktifkan" };
                  return (
                    <div role="alert" style={{ marginBottom: "24px", padding: "14px 16px", borderRadius: 10, background: tone.bg, border: `1px solid ${tone.border}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <Icon name={tone.icon} style={{ fontSize: 20, color: tone.ink, flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.92rem", color: tone.ink, marginBottom: 2 }}>{tone.title}</div>
                        <div style={{ fontSize: "0.85rem", color: tone.ink, lineHeight: 1.5, opacity: 0.9 }}>{loginNotice.message}</div>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ marginBottom: "20px" }}>
                  <label style={labelStyle}>Alamat Email</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="email@instansi.go.id" 
                    style={inputStyle}
                    required
                  />
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label style={labelStyle}>Kata Sandi</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    placeholder="••••••••"
                    style={inputStyle}
                    required
                  />
                </div>

                <button
                  className="btn solid" 
                  type="submit" 
                  style={{ width: "100%", background: "#1e40af", color: "#fff", padding: "16px", borderRadius: 8, fontSize: "15px", fontWeight: 700, border: "none", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", boxShadow: "0 8px 24px rgba(2, 132, 199, 0.25)", cursor: "pointer" }} 
                  disabled={isLoading}
                >
                  {isLoading ? "Memproses..." : "Masuk ke Dashboard"}
                </button>

                {/* DEV ONLY: Quick Login Shortcuts */}
                <div style={{ marginTop: "32px", padding: "16px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px dashed var(--line)" }}>
                  <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600, textAlign: "center" }}>⚡ DEV SHORTCUTS (Hapus saat Production)</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button type="button" onClick={() => { setEmail("warga@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff", cursor: "pointer", fontWeight: 600 }}>👤 Warga</button>
                    <button type="button" onClick={() => { setEmail("operator@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff", cursor: "pointer", fontWeight: 600 }}>🛡️ Operator BPBD</button>
                    <button type="button" onClick={() => { setEmail("provinsi@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff", cursor: "pointer", fontWeight: 600 }}>🏢 Provinsi</button>
                    <button type="button" onClick={() => { setEmail("admin@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff", cursor: "pointer", fontWeight: 600 }}>⚙️ Admin</button>
                    <button type="button" onClick={() => { setEmail("peneliti@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff", cursor: "pointer", fontWeight: 600 }}>🔬 Peneliti</button>
                    <button type="button" onClick={() => { setEmail("demo@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "#fff", cursor: "pointer", fontWeight: 600 }}>⭐ Super Demo</button>
                  </div>
                </div>
              </motion.form>
            ) : (
              <motion.form 
                key="register"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleRegister}
              >
                <div style={{ marginBottom: "24px" }}>
                  <h2 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 8px", color: "var(--ink)" }}>Buat Akun Baru</h2>
                  <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", margin: 0 }}>Daftar sebagai warga untuk melaporkan kejadian rob. Akun sesudah didaftar berstatus menunggu persetujuan admin.</p>
                </div>

                {/* Pendaftaran mandiri selalu menghasilkan akun WARGA (backend memaksa
                    role=warga, status=menunggu). Akun instansi (Operator/Provinsi/
                    Peneliti) dibuat oleh admin lewat menu Pengguna & Perizinan — jadi
                    form ini tidak lagi menawarkan pilihan role yang tak akan diberikan. */}
                <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: 8, background: "var(--surface-soft)", border: "1px solid var(--line)", fontSize: "12.5px", color: "var(--ink-soft)", display: "flex", gap: 8, alignItems: "center" }}>
                  <Icon name="info" style={{ fontSize: 16, flexShrink: 0 }} />
                  <span>Butuh akun BPBD atau Peneliti? Hubungi admin — akun instansi dibuat & diverifikasi oleh admin.</span>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Nama Lengkap</label>
                  <input
                    type="text"
                    placeholder="Nama sesuai identitas"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Desa / Wilayah <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>(Opsional)</span></label>
                  <input
                    type="text"
                    placeholder="Contoh: Desa Kangkung, Bumi Waras"
                    value={regInstitution}
                    onChange={(e) => setRegInstitution(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Alamat Email</label>
                  <input 
                    type="email" 
                    placeholder="email@instansi.go.id" 
                    value={regEmail} 
                    onChange={(e) => setRegEmail(e.target.value)} 
                    style={inputStyle}
                    required
                  />
                </div>

                <div style={{ marginBottom: "32px" }}>
                  <label style={labelStyle}>Kata Sandi</label>
                  <input 
                    type="password" 
                    placeholder="Minimal 6 karakter" 
                    value={regPassword} 
                    onChange={(e) => setRegPassword(e.target.value)} 
                    style={inputStyle}
                    required
                  />
                </div>

                <button 
                  className="btn solid" 
                  type="submit" 
                  style={{ width: "100%", background: "#1e40af", color: "#fff", padding: "16px", borderRadius: 8, fontSize: "15px", fontWeight: 700, border: "none", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", boxShadow: "0 8px 24px rgba(2, 132, 199, 0.25)", cursor: "pointer" }} 
                  disabled={isLoading}
                >
                  {isLoading ? "Memproses..." : "Daftar Akun"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </section>
      <style>{`
        @media (min-width: 1024px) {
          .desktop-flex {
            display: flex !important;
          }
          .mobile-only {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
