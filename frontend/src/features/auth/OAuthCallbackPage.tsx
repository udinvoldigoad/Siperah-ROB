import { useEffect, useState } from "react";
import { Icon } from "../../shared/components/Icon";
import { api } from "../../shared/api/client";
import { dashboardHashForRole } from "../../shared/constants/roles";

export function OAuthCallbackPage() {
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Backend redirects to /#/oauth-callback?token=1|abcdef...
    // Token lives inside the hash fragment, not window.location.search.
    // Also check window.location.search as fallback for non-hash routing.
    const hashQuery = window.location.hash.split("?")[1] || "";
    const params = new URLSearchParams(hashQuery || window.location.search);
    const token = params.get("token");

    if (token) {
      localStorage.setItem("siperah-token", token);
      
      api<{data: any}>("/auth/me")
        .then(res => {
          const user = res.data;
          if (user.status === "menunggu" || user.status === "nonaktif" || user.status === "ditolak") {
            localStorage.removeItem("siperah-token");
            window.location.hash = `#/login?error=${user.status}`;
            return;
          }
          localStorage.setItem("siperah-user", JSON.stringify(user));
          window.location.hash = dashboardHashForRole(user.role);
        })
        .catch((err: any) => {
          console.error(err);
          localStorage.removeItem("siperah-token");
          
          if (err.status === 403 && err.body?.account_status) {
             window.location.hash = `#/login?error=${err.body.account_status}`;
             return;
          }

          setErrorMsg("Gagal mengambil data profil.");
          setTimeout(() => {
            window.location.hash = "#/login?error=oauth_failed";
          }, 2000);
        });
    } else {
      // Missing token, redirect to login with error
      window.location.hash = "#/login?error=oauth_failed";
    }
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
