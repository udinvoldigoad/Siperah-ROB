import { useState, useEffect } from "react";
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
  const [loginNotice, setLoginNotice] = useState<{ message: string; status?: string } | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=menunggu")) {
      setLoginNotice({ message: "Pendaftaran lewat Google berhasil, namun akun Anda masih menunggu persetujuan admin.", status: "menunggu" });
    } else if (hash.includes("error=nonaktif")) {
      setLoginNotice({ message: "Akun Anda telah dinonaktifkan.", status: "nonaktif" });
    } else if (hash.includes("error=ditolak")) {
      setLoginNotice({ message: "Pendaftaran Anda ditolak oleh admin.", status: "ditolak" });
    } else if (hash.includes("error=google_auth_failed")) {
      toast.error("Gagal masuk dengan Google.");
      window.location.hash = "#/login";
    }
  }, [toast]);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
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
    borderRadius: "10px",
    border: "1px solid var(--line)",
    background: "var(--surface-soft)",
    fontSize: "15px",
    color: "var(--ink)",
    outline: "none",
    transition: "all 0.2s",
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--ink)",
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
                      ? { bg: "var(--surface-soft)", border: "var(--line)", ink: "var(--ink)", icon: "hourglass_top", title: "Akun menunggu persetujuan" }
                      : { bg: "var(--surface-soft)", border: "var(--line)", ink: "var(--ink)", icon: "block",
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
                  <div style={{ marginBottom: "24px" }}>
                    <label style={labelStyle}>Alamat Email</label>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      style={inputStyle}
                      required
                    />
                  </div>
  
                  <div style={{ marginBottom: "24px" }}>
                    <label style={labelStyle}>Kata Sandi</label>
                    <div style={{ position: "relative" }}>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        style={{ ...inputStyle, paddingRight: "48px" }}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", padding: "4px", display: "flex" }}
                        title={showPassword ? "Sembunyikan sandi" : "Tampilkan sandi"}
                      >
                        <Icon name={showPassword ? "visibility_off" : "visibility"} style={{ fontSize: "20px" }} />
                      </button>
                    </div>
                  </div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>                        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--ink-soft)", cursor: "pointer" }}>
                          <input type="checkbox" style={{ accentColor: "var(--accent)", width: "16px", height: "16px", borderRadius: "4px" }} />
                          Ingat saya
                        </label>
                        <a href="#/" style={{ fontSize: "14px", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Lupa sandi?</a>
                      </div>
                <button 
                  className="btn solid" 
                  type="submit" 
                  style={{ width: "100%", background: "var(--accent)", color: "#fff", padding: "14px", borderRadius: 8, fontSize: "15px", fontWeight: 600, border: "none", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer", transition: "background 0.2s" }} 
                  disabled={isLoading}
                >
                {isLoading ? "Memproses..." : "Masuk"}
              </button>

              <div style={{ display: "flex", alignItems: "center", margin: "24px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "var(--line)" }}></div>
                <span style={{ padding: "0 16px", color: "var(--ink-soft)", fontSize: "13px" }}>atau</span>
                <div style={{ flex: 1, height: "1px", background: "var(--line)" }}></div>
              </div>

                <a 
                  href="/api/auth/google/redirect"
                  style={{ width: "100%", background: "var(--surface)", color: "var(--ink)", padding: "14px", borderRadius: 8, fontSize: "15px", fontWeight: 600, border: "1px solid var(--line)", display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", cursor: "pointer", textDecoration: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", transition: "all 0.2s" }}
                >
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Masuk dengan Google
              </a>

              {/* DEV ONLY: Quick Login Shortcuts */}
              <details style={{ marginTop: "32px" }}>
                <summary style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600, textAlign: "center", cursor: "pointer", padding: "8px" }}>
                  ⚡ DEV SHORTCUTS
                </summary>
                <div style={{ marginTop: "12px", padding: "16px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px dashed var(--line)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button type="button" onClick={() => { setEmail("warga@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>👤 Warga</button>
                    <button type="button" onClick={() => { setEmail("operator@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>🛡️ Operator BPBD</button>
                    <button type="button" onClick={() => { setEmail("provinsi@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>🏢 Provinsi</button>
                    <button type="button" onClick={() => { setEmail("admin@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>⚙️ Admin</button>
                    <button type="button" onClick={() => { setEmail("peneliti@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>🔬 Peneliti</button>
                    <button type="button" onClick={() => { setEmail("demo@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>⭐ Super Demo</button>
                  </div>
                </div>
              </details>

                <div style={{ marginTop: "40px", textAlign: "center", fontSize: "14px", color: "var(--ink-soft)" }}>
                  Belum punya akun?{" "}
                  <button 
                    type="button" 
                    onClick={() => setMode("register")}
                    style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", padding: 0 }}
                  >
                  Buat akun baru
                </button>
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
                <div style={{ marginBottom: "32px" }}>
                  <h2 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 12px", color: "var(--ink)" }}>Buat Akun Baru</h2>
                  <p style={{ color: "var(--ink-soft)", fontSize: "1rem", lineHeight: "1.6", margin: 0 }}>Daftar sebagai warga untuk berpartisipasi melaporkan kejadian rob. Akun Anda akan direview oleh admin setelah mendaftar.</p>
                </div>

                <div style={{ marginBottom: "24px", padding: "12px 16px", borderRadius: "10px", background: "var(--surface-soft)", border: "1px solid var(--line)", fontSize: "13px", color: "var(--ink-soft)", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <Icon name="info" style={{ fontSize: "18px", color: "#3b82f6", flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ lineHeight: "1.5" }}>Butuh akun BPBD atau Peneliti? Hubungi admin — akun instansi dibuat & diverifikasi langsung oleh admin.</span>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={labelStyle}>Nama Lengkap</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={labelStyle}>Desa / Wilayah <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>(Opsional)</span></label>
                  <input
                    type="text"
                    value={regInstitution}
                    onChange={(e) => setRegInstitution(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={labelStyle}>Alamat Email</label>
                  <input 
                    type="email" 
                    value={regEmail} 
                    onChange={(e) => setRegEmail(e.target.value)} 
                    style={inputStyle}
                    required
                  />
                </div>

                <div style={{ marginBottom: "32px" }}>
                  <label style={labelStyle}>Kata Sandi</label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type={showRegPassword ? "text" : "password"} 
                      value={regPassword} 
                      onChange={(e) => setRegPassword(e.target.value)} 
                      style={{ ...inputStyle, paddingRight: "48px" }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", padding: "4px", display: "flex" }}
                      title={showRegPassword ? "Sembunyikan sandi" : "Tampilkan sandi"}
                    >
                      <Icon name={showRegPassword ? "visibility_off" : "visibility"} style={{ fontSize: "20px" }} />
                    </button>
                  </div>
                </div>

                  <button 
                    className="btn solid" 
                    type="submit" 
                    style={{ width: "100%", background: "var(--accent)", color: "#fff", padding: "14px", borderRadius: "10px", fontSize: "15px", fontWeight: 600, border: "none", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer", transition: "background 0.2s" }} 
                    disabled={isLoading}
                  >
                  {isLoading ? "Memproses..." : "Daftar Akun"}
                </button>

                <div style={{ marginTop: "40px", textAlign: "center", fontSize: "14px", color: "var(--ink-soft)" }}>
                  Sudah punya akun?{" "}
                  <button 
                    type="button" 
                    onClick={() => setMode("login")}
                    style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", padding: 0 }}
                  >
                    Masuk ke Dashboard
                  </button>
                </div>
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
