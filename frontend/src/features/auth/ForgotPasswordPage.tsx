import { useState } from "react";
import { Icon } from "../../shared/components/Icon";
import { api } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { motion } from "framer-motion";

export function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Email wajib diisi.");
      return;
    }

    setIsLoading(true);
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setIsSuccess(true);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim link reset.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-main">
      {/* Visual Left Banner (Reused from LoginPage logic) */}
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
            Lupa Kata Sandi?
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.1rem", lineHeight: 1.6, marginBottom: "48px" }}
          >
            Jangan khawatir! Masukkan email Anda dan kami akan mengirimkan instruksi untuk mereset kata sandi Anda.
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

          <form onSubmit={handleSubmit}>
            <div className="auth-header-text" style={{ marginBottom: "32px" }}>
              <h2 style={{ fontSize: "1.8rem", fontWeight: 800, margin: "0 0 8px", color: "var(--ink)" }}>Reset Sandi</h2>
              <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", margin: 0 }}>
                {isSuccess 
                  ? "Tautan reset telah dikirim ke email Anda. (Periksa laravel.log di lingkungan lokal)"
                  : "Masukkan email yang terdaftar untuk mengatur ulang sandi Anda."
                }
              </p>
            </div>

            {!isSuccess && (
              <>
                <div style={{ marginBottom: "32px" }}>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "var(--ink)", marginBottom: "8px" }}>Alamat Email</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
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
                  {isLoading ? "Mengirim..." : "Kirim Link Reset"}
                </button>
              </>
            )}

            <div style={{ marginTop: "32px", textAlign: "center", fontSize: "14px", color: "var(--ink-soft)" }}>
              <a href="#/login" className="link-btn" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Kembali ke Halaman Login</a>
            </div>
          </form>
        </motion.div>
      </section>
      
      {/* Reusing styles from LoginPage, so we just import the global classes or define them in index.css */}
      {/* Since they are scoped locally in LoginPage.tsx previously, we can duplicate the necessary responsive styles here for isolation. */}
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
