import { useState, useEffect } from "react";
import { Icon } from "../../shared/components/Icon";
import { api, apiUrl, ApiError } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { dashboardHashForRole } from "../../shared/constants/roles";
import { setSession } from "../../shared/auth/session";
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
  const [mode, setMode] = useState<"login" | "register" | "verify">("login");
  // Email yang sedang menunggu verifikasi OTP (dari registrasi ATAU dari
  // login yang ditolak karena belum terverifikasi).
  const [verifyEmail, setVerifyEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginNotice, setLoginNotice] = useState<{ message: string; status?: string } | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=menunggu")) {
      // Pendaftaran mandiri (email maupun Google) kini langsung aktif, jadi
      // status "menunggu" hanya muncul untuk akun yang SENGAJA dibuat admin
      // dalam keadaan menunggu — pesannya tak boleh lagi menyebut pendaftaran.
      setLoginNotice({ message: "Akun Anda masih menunggu persetujuan admin.", status: "menunggu" });
    } else if (hash.includes("error=nonaktif")) {
      setLoginNotice({ message: "Akun Anda telah dinonaktifkan.", status: "nonaktif" });
    } else if (hash.includes("error=ditolak")) {
      setLoginNotice({ message: "Pendaftaran Anda ditolak oleh admin.", status: "ditolak" });
    } else if (hash.includes("error=google_auth_failed") || hash.includes("error=oauth_failed")) {
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
  // Jenis akun yang dimohon. Warga langsung aktif setelah verifikasi email;
  // peneliti berhenti di antrean admin karena perannya membuka data penelitian.
  const [accountType, setAccountType] = useState<"warga" | "peneliti">("warga");
  const [regPurpose, setRegPurpose] = useState("");
  // Diisi dari respons registrasi: menentukan apakah layar OTP menutup dengan
  // "silakan masuk" atau "menunggu persetujuan admin".
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const isPeneliti = accountType === "peneliti";

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

      setSession(res.access_token, res.user);

      toast.success(`Selamat datang kembali, ${res.user.name}!`);

      // Redirect langsung ke dashboard sesuai peran (bukan balik ke landing).
      // isLoading sengaja TIDAK di-reset di sini: tombol tetap nonaktif selama
      // jeda redirect 500ms agar tidak bisa submit ganda.
      setTimeout(() => {
        window.location.hash = dashboardHashForRole(res.user.role);
      }, 500);

    } catch (err: any) {
      // Akun belum aktif (menunggu/nonaktif/ditolak) → tampilkan panel status
      // yang jelas & persisten, bukan sekadar toast sesaat.
      // Belum verifikasi email punya jalan keluar sendiri (masukkan OTP),
      // jadi jangan disamakan dengan panel status "tunggu admin".
      if (err instanceof ApiError && err.status === 403 && err.body?.requires_email_verification) {
        setVerifyEmail(email);
        setOtp("");
        // Akun yang belum terverifikasi DAN masih ditahan admin = permohonan
        // peneliti; layar OTP perlu menyebut langkah persetujuan berikutnya.
        setAwaitingApproval(err.body.account_status === "menunggu");
        setMode("verify");
        toast.info("Email Anda belum diverifikasi. Masukkan kode yang kami kirim.");
      } else if (err instanceof ApiError && err.status === 403 && err.body?.account_status) {
        setLoginNotice({ message: err.message, status: err.body.account_status });
      } else {
        toast.error(err.message || "Gagal masuk. Silakan cek kredensial Anda.");
      }
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      toast.error("Nama, email, dan kata sandi wajib diisi.");
      return;
    }
    // Dicegat di sini supaya pemohon tak kehilangan isian panjangnya hanya
    // untuk membaca pesan validasi server. Batas 30 karakter sama dengan
    // aturan `research_purpose` di RegisterRequest.
    if (isPeneliti && regPurpose.trim().length < 30) {
      toast.error("Jelaskan tujuan penggunaan data minimal satu kalimat utuh (30 karakter).");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api<{ requires_admin_approval?: boolean }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          account_type: accountType,
          name: regName,
          email: regEmail,
          password: regPassword,
          institution: regInstitution,
          ...(isPeneliti ? { research_purpose: regPurpose } : {}),
        }),
      });

      setAwaitingApproval(res.requires_admin_approval === true);
      toast.success("Kode verifikasi 6 digit telah dikirim ke email Anda.");
      setVerifyEmail(regEmail);
      setEmail(regEmail);
      setPassword("");
      setOtp("");
      setMode("verify");
    } catch (err: any) {
      toast.error(err.message || "Pendaftaran gagal. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      toast.error("Kode verifikasi terdiri dari 6 digit.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api<{ message?: string }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email: verifyEmail, otp: otp.trim() }),
      });
      // Pesan datang dari server karena hanya server yang tahu akun ini
      // langsung aktif (warga) atau masih menunggu admin (peneliti).
      toast.success(res.message || "Email terverifikasi. Silakan masuk.");
      setMode("login");
      setEmail(verifyEmail);
      setOtp("");
    } catch (err: any) {
      toast.error(err.message || "Kode verifikasi salah atau kedaluwarsa.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      await api("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: verifyEmail }),
      });
      // Pesan backend sengaja generik (anti-enumeration) — diteruskan apa adanya.
      toast.info("Jika email tersebut belum terverifikasi, kode baru telah dikirim.");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim ulang kode.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "12px",
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
    <main className="login-main">
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
      <section className="auth-form-section">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="auth-card-wrapper"
        >
          {/* Logo for mobile */}
          <div className="mobile-only mobile-only-header">
            <div className="mobile-logo-badge">
              <Icon name="water_drop" style={{ fontSize: "26px" }} />
            </div>
            <h2 className="mobile-brand-title">SIPERAH-RoB</h2>
          </div>


          <AnimatePresence mode="wait">
            {mode === "verify" ? null : mode === "login" ? (
              <motion.form 
                key="login"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleLogin}
              >
                <div className="auth-header-text" style={{ marginBottom: "32px" }}>
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
                {/* "Ingat saya" dihapus: checkbox lama tidak tersambung ke
                    apa pun (sesi selalu tersimpan di localStorage) — kontrol
                    mati hanya menyesatkan. */}
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "32px" }}>
                  <a href="#/forgot-password" className="link-btn" style={{ fontSize: "14px", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Lupa sandi?</a>
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
                <div className="divider-line" style={{ flex: 1, height: "1px", background: "var(--line)" }}></div>
                <span className="or-text" style={{ padding: "0 16px", color: "var(--ink-soft)", fontSize: "13px" }}>atau</span>
                <div className="divider-line" style={{ flex: 1, height: "1px", background: "var(--line)" }}></div>
              </div>

                <a 
                  className="google-btn"
                  href={apiUrl("/api/auth/google/redirect")}
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

              {/* DEV ONLY: Quick Login Shortcuts — hanya tampil saat `npm run dev`.
                  import.meta.env.DEV = false di build produksi, sehingga blok ini
                  di-tree-shake (tidak ikut ke bundle & password demo tak terekspos). */}
              {import.meta.env.DEV && (
              <details style={{ marginTop: "32px" }}>
                <summary className="dev-shortcut-summary" style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600, textAlign: "center", cursor: "pointer", padding: "8px" }}>
                  ⚡ DEV SHORTCUTS
                </summary>
                <div className="dev-shortcut-box" style={{ marginTop: "12px", padding: "16px", background: "var(--surface-soft)", borderRadius: "12px", border: "1px dashed var(--line)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button type="button" onClick={() => { setEmail("warga@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>👤 Warga</button>
                    <button type="button" onClick={() => { setEmail("admin@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>⚙️ Admin</button>
                    <button type="button" onClick={() => { setEmail("peneliti@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>🔬 Peneliti</button>
                    <button type="button" onClick={() => { setEmail("demo@siperah.local"); setPassword("password"); }} style={{ padding: "8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>⚙️ Admin 2</button>
                  </div>
                </div>
              </details>
              )}

                <div style={{ marginTop: "40px", textAlign: "center", fontSize: "14px", color: "var(--ink-soft)" }}>
                  <span className="or-text">Belum punya akun?</span>{" "}
                  <button 
                    type="button" 
                    className="link-btn"
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
                <div className="auth-header-text" style={{ marginBottom: "24px" }}>
                  <h2 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 12px", color: "var(--ink)" }}>Buat Akun Baru</h2>
                  <p style={{ color: "var(--ink-soft)", fontSize: "1rem", lineHeight: "1.6", margin: 0 }}>Pilih jenis akun yang sesuai. Kami akan mengirim kode verifikasi ke email Anda.</p>
                </div>

                {/* Pilihan jenis akun. Keduanya lewat endpoint yang sama; server
                    yang memetakannya ke peran & status, jadi pemohon tak bisa
                    memilih "peneliti + langsung aktif" dari sisi klien. */}
                <div role="radiogroup" aria-label="Jenis akun" className="acct-type-grid" style={{ marginBottom: "20px" }}>
                  {([
                    { v: "warga", icon: "groups", title: "Warga", desc: "Melaporkan kejadian rob di sekitar Anda. Aktif setelah verifikasi email." },
                    { v: "peneliti", icon: "science", title: "Peneliti", desc: "Mengunduh dataset & akses API. Ditinjau admin sebelum aktif." },
                  ] as const).map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      role="radio"
                      aria-checked={accountType === opt.v}
                      onClick={() => setAccountType(opt.v)}
                      className="acct-type-card"
                      data-selected={accountType === opt.v || undefined}
                    >
                      <Icon name={opt.icon} style={{ fontSize: "22px" }} />
                      <span className="acct-type-title">{opt.title}</span>
                      <span className="acct-type-desc">{opt.desc}</span>
                    </button>
                  ))}
                </div>

                <div style={{ marginBottom: "24px", padding: "12px 16px", borderRadius: "10px", background: "var(--surface-soft)", border: "1px solid var(--line)", fontSize: "13px", color: "var(--ink-soft)", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <Icon name={isPeneliti ? "gavel" : "info"} style={{ fontSize: "18px", color: "#3b82f6", flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ lineHeight: "1.5" }}>
                    {isPeneliti
                      ? "Akun peneliti membuka data mentah laporan & prediksi, jadi permohonan Anda ditinjau admin lebih dulu. Isi keterangan di bawah selengkap mungkin — admin memakainya untuk memastikan kepentingan Anda."
                      : "Butuh akun BPBD? Hubungi admin — akun instansi dibuat & diverifikasi langsung oleh admin."}
                  </span>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={labelStyle} htmlFor="reg-name">Nama Lengkap</label>
                  <input
                    id="reg-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>

                {/* Satu kolom, dua makna: catatan wilayah bagi warga, dan
                    identitas lembaga yang wajib bagi peneliti. */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={labelStyle} htmlFor="reg-institution">
                    {isPeneliti ? "Instansi / Universitas" : (
                      <>Desa / Wilayah <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>(Opsional)</span></>
                    )}
                  </label>
                  <input
                    id="reg-institution"
                    name="institution"
                    type="text"
                    autoComplete="organization"
                    value={regInstitution}
                    onChange={(e) => setRegInstitution(e.target.value)}
                    placeholder={isPeneliti ? "mis. Universitas Lampung — Fakultas Teknik" : ""}
                    style={inputStyle}
                    required={isPeneliti}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={labelStyle} htmlFor="reg-email">Alamat Email</label>
                  <input
                    id="reg-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    style={inputStyle}
                    required
                  />
                  {isPeneliti && (
                    <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                      Sebisa mungkin pakai email resmi instansi — alamat institusional mempercepat admin memastikan permohonan Anda.
                    </p>
                  )}
                </div>

                {isPeneliti && (
                  <div style={{ marginBottom: "20px" }}>
                    <label style={labelStyle} htmlFor="reg-purpose">Tujuan Penggunaan Data</label>
                    <textarea
                      id="reg-purpose"
                      name="research_purpose"
                      value={regPurpose}
                      onChange={(e) => setRegPurpose(e.target.value)}
                      rows={4}
                      maxLength={1000}
                      placeholder="Contoh: Penelitian skripsi tentang pola banjir rob di pesisir Bandar Lampung. Data laporan tervalidasi & prediksi harian akan dipakai untuk memvalidasi model genangan."
                      style={{ ...inputStyle, resize: "vertical", minHeight: "110px", fontFamily: "inherit", lineHeight: 1.55 }}
                      required
                    />
                    <p style={{ margin: "6px 0 0", fontSize: "12.5px", color: regPurpose.trim().length > 0 && regPurpose.trim().length < 30 ? "var(--critical)" : "var(--ink-soft)", lineHeight: 1.5 }}>
                      Sebutkan judul/topik penelitian dan data apa yang dibutuhkan. Minimal 30 karakter ({regPurpose.trim().length}/1000).
                    </p>
                  </div>
                )}

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
                  {isLoading ? "Memproses..." : isPeneliti ? "Kirim Permohonan Akun Peneliti" : "Daftar Akun"}
                </button>

                <div style={{ marginTop: "40px", textAlign: "center", fontSize: "14px", color: "var(--ink-soft)" }}>
                  <span className="or-text">Sudah punya akun?</span>{" "}
                  <button 
                    type="button" 
                    className="link-btn"
                    onClick={() => setMode("login")}
                    style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", padding: 0 }}
                  >
                    Masuk ke Dashboard
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {mode === "verify" && (
            <form onSubmit={handleVerifyOtp}>
              <div className="auth-header-text" style={{ marginBottom: "32px" }}>
                <h2 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 8px", color: "var(--ink)" }}>Verifikasi email</h2>
                <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", margin: 0 }}>
                  Kami mengirim kode 6 digit ke <strong style={{ color: "var(--ink)" }}>{verifyEmail}</strong>.{" "}
                  {awaitingApproval
                    ? "Masukkan kodenya untuk membuktikan alamat ini milik Anda."
                    : "Masukkan kodenya untuk mengaktifkan akun."}
                </p>
              </div>

              {/* Permohonan peneliti punya SATU langkah lagi setelah OTP.
                  Tanpa keterangan ini pemohon mengira verifikasi gagal saat
                  loginnya tetap ditolak. */}
              {awaitingApproval && (
                <div role="status" style={{ marginBottom: "24px", padding: "14px 16px", borderRadius: 10, background: "var(--surface-soft)", border: "1px solid var(--line)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Icon name="hourglass_top" style={{ fontSize: 20, color: "var(--ink)", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: "0.85rem", color: "var(--ink)", lineHeight: 1.5 }}>
                    Setelah email terverifikasi, permohonan akun peneliti Anda masuk ke antrean admin. Anda akan bisa masuk begitu admin menyetujuinya.
                  </div>
                </div>
              )}

              <div style={{ marginBottom: "24px" }}>
                <label style={labelStyle} htmlFor="otp">Kode Verifikasi</label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  autoFocus
                  style={{ ...inputStyle, letterSpacing: "0.5em", textAlign: "center", fontSize: "20px", fontWeight: 700 }}
                />
              </div>

              <button
                className="btn solid"
                type="submit"
                style={{ width: "100%", background: "var(--accent)", color: "#fff", padding: "14px", borderRadius: "10px", fontSize: "15px", fontWeight: 600, border: "none", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer" }}
                disabled={isLoading}
                data-loading={isLoading || undefined}
              >
                {isLoading ? "Memverifikasi..." : "Verifikasi & Aktifkan"}
              </button>

              <div style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "var(--ink-soft)" }}>
                <span className="or-text">Tidak menerima kode?</span>{" "}
                <button
                  type="button"
                  className="link-btn"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", padding: 0 }}
                >
                  Kirim ulang
                </button>
              </div>

              <div style={{ marginTop: "16px", textAlign: "center", fontSize: "14px", color: "var(--ink-soft)" }}>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setMode("login")}
                  style={{ background: "none", border: "none", color: "var(--ink-soft)", fontWeight: 600, cursor: "pointer", padding: 0 }}
                >
                  Kembali ke halaman masuk
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </section>
      <style>{`
        .login-main {
          display: flex;
          width: 100%;
          min-height: 100vh;
          font-family: var(--font);
          justify-content: center;
          background: var(--bg);
        }
        .auth-form-section {
          flex: 1 1 100%;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          min-height: 100vh;
          box-sizing: border-box;
        }
        .auth-card-wrapper {
          width: 100%;
          max-width: 440px;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .mobile-only-header {
          margin-bottom: 32px;
          text-align: center;
        }
        .mobile-logo-badge {
          display: inline-flex;
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(14, 165, 233, 0.25) 100%);
          color: var(--accent);
          border-radius: 16px;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.15);
        }
        .mobile-brand-title {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 850;
          letter-spacing: -0.02em;
          color: var(--ink);
        }

        /* Pilihan jenis akun. Dua kartu sejajar; pada layar sempit menumpuk
           agar deskripsinya tetap terbaca dan tidak terpotong. */
        .acct-type-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 420px) {
          .acct-type-grid { grid-template-columns: 1fr; }
        }
        .acct-type-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--ink-soft);
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        .acct-type-card:hover { border-color: var(--accent); }
        .acct-type-card:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .acct-type-card[data-selected] {
          border-color: var(--accent);
          background: var(--accent-soft, rgba(2, 132, 199, 0.08));
          color: var(--accent);
        }
        .acct-type-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
        }
        .acct-type-desc {
          font-size: 12px;
          line-height: 1.45;
          color: var(--ink-soft);
        }

        @media (min-width: 1024px) {
          .desktop-flex {
            display: flex !important;
            flex: 1 1 50% !important;
          }
          .auth-form-section {
            flex: 1 1 50% !important;
          }
          .mobile-only {
            display: none !important;
          }
        }

        @media (max-width: 1023px) {
          .login-main {
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.90) 0%, rgba(30, 64, 175, 0.85) 100%), url('/bg-laut.jpg') center/cover no-repeat !important;
            background-attachment: fixed !important;
          }
          .auth-form-section {
            flex: 1 1 100% !important;
            width: 100% !important;
            padding: 24px 20px !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            min-height: 100dvh !important;
          }
          .auth-card-wrapper {
            width: 100% !important;
            max-width: 440px !important;
            margin: 0 auto !important;
            background: rgba(255, 255, 255, 0.05) !important;
            backdrop-filter: blur(24px) !important;
            -webkit-backdrop-filter: blur(24px) !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            border-radius: 28px !important;
            padding: 40px 28px !important;
            box-shadow: 0 30px 60px rgba(0,0,0,0.3) !important;
          }
          .auth-header-text {
            text-align: center !important;
          }
          .mobile-only-header {
            margin-bottom: 24px !important;
          }
          .mobile-logo-badge {
            width: 44px !important;
            height: 44px !important;
            border-radius: 14px !important;
            background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(14, 165, 233, 0.3) 100%) !important;
            color: #38bdf8 !important;
          }
          .mobile-brand-title, .auth-card-wrapper h2, .auth-card-wrapper label {
            color: #ffffff !important;
          }
          .auth-card-wrapper .auth-header-text p, .auth-card-wrapper .or-text, .auth-card-wrapper .dev-shortcut-summary {
            color: rgba(255, 255, 255, 0.7) !important;
          }
          .auth-card-wrapper input {
            background: rgba(255, 255, 255, 0.1) !important;
            border-color: rgba(255, 255, 255, 0.2) !important;
            color: #ffffff !important;
          }
          .auth-card-wrapper input:focus {
            background: rgba(255, 255, 255, 0.15) !important;
            border-color: #60a5fa !important;
            box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.2) !important;
          }
          .auth-card-wrapper .google-btn {
            background: rgba(255, 255, 255, 0.1) !important;
            border-color: rgba(255, 255, 255, 0.2) !important;
            color: #ffffff !important;
          }
          .auth-card-wrapper .google-btn:hover {
            background: rgba(255, 255, 255, 0.15) !important;
          }
          .auth-card-wrapper .divider-line {
            background: rgba(255, 255, 255, 0.2) !important;
          }
          .auth-card-wrapper .dev-shortcut-box {
            background: rgba(255, 255, 255, 0.05) !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
          }
          .auth-card-wrapper .dev-shortcut-box button {
            background: rgba(255, 255, 255, 0.1) !important;
            border-color: rgba(255, 255, 255, 0.15) !important;
            color: #ffffff !important;
          }
          .auth-card-wrapper .link-btn {
            color: #60a5fa !important;
          }
          .auth-card-wrapper input[type="checkbox"] {
            accent-color: #60a5fa !important;
          }
          .auth-card-wrapper [role="alert"] {
            background: rgba(0, 0, 0, 0.3) !important;
            border-color: rgba(255, 255, 255, 0.2) !important;
          }
          .auth-card-wrapper [role="alert"] div, .auth-card-wrapper [role="alert"] .material-symbols-outlined {
            color: #ffffff !important;
          }
          .auth-card-wrapper button[title] {
            color: rgba(255, 255, 255, 0.6) !important;
          }
        }
      `}</style>
    </main>
  );
}
