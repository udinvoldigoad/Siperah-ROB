import { useState, useEffect } from "react";
import { Icon } from "../../shared/components/Icon";
import { api } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { motion } from "framer-motion";

export function ResetPasswordPage() {
  const toast = useToast();
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Extract token and email from hash URL: #/reset-password?token=xxx&email=yyy
    const hash = window.location.hash;
    const queryStr = hash.split("?")[1];
    if (queryStr) {
      const params = new URLSearchParams(queryStr);
      if (params.has("token")) setToken(params.get("token") || "");
      if (params.has("email")) setEmail(params.get("email") || "");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password !== passwordConfirmation) {
      toast.error("Kata sandi dan konfirmasi tidak cocok.");
      return;
    }
    if (password.length < 8) {
      toast.error("Kata sandi minimal 8 karakter.");
      return;
    }

    setIsLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          email,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      setIsSuccess(true);
      toast.success("Kata sandi berhasil diatur ulang.");
      setTimeout(() => {
        window.location.hash = "#/login";
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengatur ulang sandi. Token mungkin tidak valid atau kedaluwarsa.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-main">
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

          <form onSubmit={handleSubmit}>
            <div className="auth-header-text" style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 8px", color: "var(--ink)" }}>Kata Sandi Baru</h2>
              <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", margin: 0 }}>
                {isSuccess 
                  ? "Sandi Anda berhasil diubah! Mengarahkan ke halaman login..."
                  : "Silakan buat kata sandi baru untuk akun Anda."
                }
              </p>
            </div>

            {!isSuccess && (
              <>
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>Email</label>
                  <input 
                    type="email" 
                    value={email} 
                    disabled
                    style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--line)", background: "var(--surface-soft)", fontSize: "15px", color: "var(--ink-soft)", outline: "none", boxSizing: "border-box", opacity: 0.7 }}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>Sandi Baru</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--line)", background: "var(--surface-soft)", fontSize: "15px", color: "var(--ink)", outline: "none", transition: "all 0.2s", boxSizing: "border-box" }}
                    required
                  />
                </div>

                <div style={{ marginBottom: "32px" }}>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>Konfirmasi Sandi Baru</label>
                  <input 
                    type="password" 
                    value={passwordConfirmation} 
                    onChange={(e) => setPasswordConfirmation(e.target.value)} 
                    style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: "1px solid var(--line)", background: "var(--surface-soft)", fontSize: "15px", color: "var(--ink)", outline: "none", transition: "all 0.2s", boxSizing: "border-box" }}
                    required
                  />
                </div>

                <button 
                  className="btn solid" 
                  type="submit" 
                  style={{ width: "100%", background: "var(--accent)", color: "#fff", padding: "14px", borderRadius: 8, fontSize: "15px", fontWeight: 600, border: "none", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", cursor: "pointer", transition: "background 0.2s" }} 
                  disabled={isLoading}
                >
                  {isLoading ? "Menyimpan..." : "Simpan Sandi Baru"}
                </button>
              </>
            )}

            <div style={{ marginTop: "32px", textAlign: "center", fontSize: "14px", color: "var(--ink-soft)" }}>
              <a href="#/login" className="link-btn" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Kembali ke Halaman Login</a>
            </div>
          </form>
        </motion.div>
      </section>

      {/* Copy styles from ForgotPasswordPage */}
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
          display: none;
        }
        @media (max-width: 1023px) {
          .login-main {
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.90) 0%, rgba(30, 64, 175, 0.85) 100%), url('/bg-laut.jpg') center/cover no-repeat !important;
            background-attachment: fixed !important;
          }
          .mobile-only-header {
            display: block !important;
          }
          .mobile-logo-badge {
            display: inline-flex;
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(14, 165, 233, 0.3) 100%) !important;
            color: #38bdf8 !important;
            border-radius: 14px;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
          }
          .mobile-brand-title {
            margin: 0;
            font-size: 1.35rem;
            font-weight: 850;
            color: #ffffff !important;
          }
          .auth-card-wrapper {
            background: rgba(255, 255, 255, 0.05) !important;
            backdrop-filter: blur(24px) !important;
            -webkit-backdrop-filter: blur(24px) !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            border-radius: 28px !important;
            padding: 40px 28px !important;
            box-shadow: 0 30px 60px rgba(0,0,0,0.3) !important;
          }
          .auth-header-text { text-align: center; }
          .auth-header-text h2, .auth-card-wrapper label { color: #ffffff !important; }
          .auth-header-text p { color: rgba(255, 255, 255, 0.7) !important; }
          .auth-card-wrapper input {
            background: rgba(255, 255, 255, 0.1) !important;
            border-color: rgba(255, 255, 255, 0.2) !important;
            color: #ffffff !important;
          }
          .auth-card-wrapper input:disabled {
            background: rgba(255, 255, 255, 0.05) !important;
            color: rgba(255, 255, 255, 0.5) !important;
          }
          .auth-card-wrapper .link-btn { color: #60a5fa !important; }
        }
      `}</style>
    </main>
  );
}
