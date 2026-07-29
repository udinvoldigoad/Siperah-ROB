import { useEffect } from "react";
import { Icon } from "../../shared/components/Icon";
import { api, ApiError } from "../../shared/api/client";
import { dashboardHashForRole } from "../../shared/constants/roles";
import { clearSession, setSession, type SessionUser } from "../../shared/auth/session";

type ExchangeResponse = { access_token: string; user: SessionUser };

export function OAuthCallbackPage() {
  useEffect(() => {
    // Backend redirects to /#/oauth-callback?code=<sekali-pakai>.
    // Yang dibawa URL hanya kode tukar, bukan token — token Sanctum baru
    // diterima lewat body respons POST /auth/google/exchange sehingga tidak
    // ikut mendarat di riwayat peramban.
    // Kode ada di dalam hash fragment, bukan window.location.search;
    // search tetap dicek sebagai fallback untuk routing non-hash.
    const hashQuery = window.location.hash.split("?")[1] || "";
    const params = new URLSearchParams(hashQuery || window.location.search);
    const code = params.get("code");

    if (!code) {
      window.location.hash = "#/login?error=oauth_failed";
      return;
    }

    api<ExchangeResponse>("/auth/google/exchange", {
      method: "POST",
      body: JSON.stringify({ code }),
    })
      .then((res) => {
        setSession(res.access_token, res.user);
        window.location.hash = dashboardHashForRole(res.user.role);
      })
      .catch((err: unknown) => {
        console.error(err);
        clearSession();

        // Akun belum aktif → panel status di halaman login (bukan toast generik).
        if (err instanceof ApiError && err.status === 403 && err.body?.account_status) {
          window.location.hash = `#/login?error=${err.body.account_status}`;
          return;
        }

        window.location.hash = "#/login?error=oauth_failed";
      });
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)" }}>
      <div style={{ textAlign: "center", padding: "40px" }}>
        <Icon name="progress_activity" className="spin" style={{ fontSize: 48, color: "var(--accent)", marginBottom: 16 }} />
        <h2 style={{ color: "var(--ink)", margin: "0 0 8px" }}>Mengautentikasi...</h2>
        <p style={{ color: "var(--ink-soft)", margin: 0 }}>Mohon tunggu sebentar, Anda sedang dialihkan.</p>
      </div>
    </main>
  );
}
