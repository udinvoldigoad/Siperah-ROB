import { useState, useRef, useEffect } from "react";
import { Icon } from "../../shared/components/Icon";
import { api } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { motion, AnimatePresence } from "framer-motion";

type Step = "email" | "otp" | "password";

export function ForgotPasswordPage() {
  const toast = useToast();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [otpFromServer, setOtpFromServer] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ── Step 1: Kirim email ──
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Email wajib diisi."); return; }

    setIsLoading(true);
    try {
      const res: any = await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setOtpFromServer(res?.otp || "");
      setStep("otp");
      setCooldown(60);
      toast.success("Kode OTP berhasil dibuat!");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim kode OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: Verifikasi OTP (lokal) lalu lanjut ke password ──
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) { toast.error("Masukkan 6 digit kode OTP."); return; }

    if (otpFromServer && code !== otpFromServer) {
      toast.error("Kode OTP tidak sesuai. Periksa kembali.");
      return;
    }
    setStep("password");
  };

  // ── Step 3: Set password baru ──
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Kata sandi minimal 8 karakter."); return; }
    if (password !== confirm) { toast.error("Konfirmasi kata sandi tidak cocok."); return; }

    setIsLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email,
          otp: otp.join(""),
          password,
        }),
      });
      toast.success("Kata sandi berhasil diperbarui!");
      setTimeout(() => { window.location.hash = "#/login"; }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Gagal mereset kata sandi.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Resend OTP ──
  const handleResend = async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    try {
      const res: any = await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setOtpFromServer(res?.otp || "");
      setOtp(["", "", "", "", "", ""]);
      setCooldown(60);
      toast.success("Kode OTP baru telah dibuat.");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim ulang OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── OTP input handlers ──
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const data = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!data) return;
    const next = [...otp];
    for (let i = 0; i < 6; i++) next[i] = data[i] || "";
    setOtp(next);
    const focusIdx = Math.min(data.length, 5);
    otpRefs.current[focusIdx]?.focus();
  };

  const stepTitles: Record<Step, string> = {
    email: "Reset Kata Sandi",
    otp: "Verifikasi Kode OTP",
    password: "Buat Sandi Baru",
  };

  const stepDescriptions: Record<Step, string> = {
    email: "Masukkan email yang terdaftar untuk mendapatkan kode verifikasi.",
    otp: `Masukkan kode 6 digit yang ditampilkan di bawah.`,
    password: "Masukkan kata sandi baru untuk akun Anda.",
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
            Reset Kata Sandi via Kode OTP
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem", lineHeight: 1.6, marginBottom: "48px" }}
          >
            Masukkan kode verifikasi 6 digit yang dikirim ke email Anda untuk mengatur ulang kata sandi.
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

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "32px", justifyContent: "center" }}>
            {(["email", "otp", "password"] as Step[]).map((s, i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 700,
                  transition: "all 0.3s",
                  background: step === s ? "var(--accent)" : (["email", "otp", "password"].indexOf(step) > i ? "var(--low)" : "var(--surface-soft)"),
                  color: step === s ? "#fff" : (["email", "otp", "password"].indexOf(step) > i ? "#fff" : "var(--ink-soft)"),
                  border: step === s ? "none" : "1px solid var(--line)",
                }}>
                  {["email", "otp", "password"].indexOf(step) > i ? <Icon name="check" style={{ fontSize: "16px" }} /> : i + 1}
                </div>
                {i < 2 && <div style={{ width: "32px", height: "2px", background: ["email", "otp", "password"].indexOf(step) > i ? "var(--low)" : "var(--line)", borderRadius: "1px", transition: "background 0.3s" }}></div>}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="auth-header-text" style={{ marginBottom: "28px", textAlign: "center" }}>
                <h2 style={{ fontSize: "1.6rem", fontWeight: 800, margin: "0 0 8px", color: "var(--ink)" }}>{stepTitles[step]}</h2>
                <p style={{ color: "var(--ink-soft)", fontSize: "0.92rem", margin: 0 }}>{stepDescriptions[step]}</p>
              </div>

              {/* ── Step: Email ── */}
              {step === "email" && (
                <form onSubmit={handleSendOtp}>
                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>Alamat Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--line)", background: "var(--surface-soft)", fontSize: "15px", color: "var(--ink)", outline: "none", transition: "all 0.2s", boxSizing: "border-box" }}
                      required
                      autoFocus
                    />
                  </div>
                  <button
                    className="btn solid"
                    type="submit"
                    style={{ width: "100%", background: "var(--accent)", color: "#fff", padding: "14px", borderRadius: 12, fontSize: "15px", fontWeight: 600, border: "none", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer", transition: "all 0.2s" }}
                    disabled={isLoading}
                  >
                    <Icon name="send" style={{ fontSize: "18px" }} />
                    {isLoading ? "Mengirim..." : "Kirim Kode OTP"}
                  </button>
                </form>
              )}

              {/* ── Step: OTP ── */}
              {step === "otp" && (
                <form onSubmit={handleVerifyOtp}>
                  {/* OTP display card */}
                  {otpFromServer && (
                    <div style={{
                      background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(59, 130, 246, 0.12) 100%)",
                      border: "1px solid rgba(37, 99, 235, 0.2)",
                      borderRadius: "16px",
                      padding: "20px",
                      marginBottom: "24px",
                      textAlign: "center",
                    }}>
                      <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Kode OTP Anda</p>
                      <p style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "0.4em", color: "var(--ink)", margin: "0", fontFamily: "monospace" }}>{otpFromServer}</p>
                      <p style={{ fontSize: "12px", color: "var(--ink-soft)", margin: "8px 0 0", lineHeight: 1.5 }}>Berlaku 10 menit. Masukkan kode di bawah.</p>
                    </div>
                  )}

                  {/* OTP input boxes */}
                  <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "24px" }} onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        autoFocus={i === 0}
                        style={{
                          width: "48px",
                          height: "56px",
                          textAlign: "center",
                          fontSize: "22px",
                          fontWeight: 800,
                          borderRadius: "12px",
                          border: digit ? "2px solid var(--accent)" : "1px solid var(--line)",
                          background: "var(--surface-soft)",
                          color: "var(--ink)",
                          outline: "none",
                          transition: "all 0.2s",
                          caretColor: "var(--accent)",
                        }}
                      />
                    ))}
                  </div>

                  <button
                    className="btn solid"
                    type="submit"
                    style={{ width: "100%", background: "var(--accent)", color: "#fff", padding: "14px", borderRadius: 12, fontSize: "15px", fontWeight: 600, border: "none", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer", transition: "all 0.2s" }}
                    disabled={otp.join("").length !== 6}
                  >
                    <Icon name="verified" style={{ fontSize: "18px" }} />
                    Verifikasi Kode
                  </button>

                  <div style={{ textAlign: "center", marginTop: "16px" }}>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={cooldown > 0 || isLoading}
                      style={{
                        background: "none",
                        border: "none",
                        color: cooldown > 0 ? "var(--ink-soft)" : "var(--accent)",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: cooldown > 0 ? "default" : "pointer",
                        padding: "8px 12px",
                      }}
                    >
                      {cooldown > 0 ? `Kirim ulang dalam ${cooldown}s` : "Kirim Ulang Kode"}
                    </button>
                  </div>
                </form>
              )}

              {/* ── Step: New Password ── */}
              {step === "password" && (
                <form onSubmit={handleResetPassword}>
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>Kata Sandi Baru</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 8 karakter"
                        style={{ width: "100%", padding: "14px 48px 14px 16px", borderRadius: "12px", border: "1px solid var(--line)", background: "var(--surface-soft)", fontSize: "15px", color: "var(--ink)", outline: "none", transition: "all 0.2s", boxSizing: "border-box" }}
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", display: "flex", padding: "4px" }}
                      >
                        <Icon name={showPassword ? "visibility_off" : "visibility"} style={{ fontSize: "20px" }} />
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: "24px" }}>
                    <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>Konfirmasi Sandi</label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Ulangi kata sandi baru"
                      style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: `1px solid ${confirm && confirm !== password ? "var(--critical)" : "var(--line)"}`, background: "var(--surface-soft)", fontSize: "15px", color: "var(--ink)", outline: "none", transition: "all 0.2s", boxSizing: "border-box" }}
                      required
                    />
                    {confirm && confirm !== password && (
                      <p style={{ color: "var(--critical)", fontSize: "12px", margin: "6px 0 0", fontWeight: 500 }}>Kata sandi tidak cocok</p>
                    )}
                  </div>

                  <button
                    className="btn solid"
                    type="submit"
                    style={{ width: "100%", background: "var(--accent)", color: "#fff", padding: "14px", borderRadius: 12, fontSize: "15px", fontWeight: 600, border: "none", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer", transition: "all 0.2s" }}
                    disabled={isLoading || password.length < 8 || password !== confirm}
                  >
                    <Icon name="lock_reset" style={{ fontSize: "18px" }} />
                    {isLoading ? "Menyimpan..." : "Simpan Sandi Baru"}
                  </button>
                </form>
              )}
            </motion.div>
          </AnimatePresence>

          <div style={{ marginTop: "28px", textAlign: "center", fontSize: "14px", color: "var(--ink-soft)" }}>
            <a href="#/login" className="link-btn" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Kembali ke Halaman Login</a>
          </div>
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
          .auth-card-wrapper .auth-header-text p, .auth-card-wrapper .or-text {
            color: rgba(255, 255, 255, 0.7) !important;
          }
          .auth-card-wrapper input {
            background: rgba(255, 255, 255, 0.1) !important;
            border-color: rgba(255, 255, 255, 0.2) !important;
            color: #ffffff !important;
          }
          .auth-card-wrapper .link-btn {
            color: #60a5fa !important;
          }
        }
      `}</style>
    </main>
  );
}
