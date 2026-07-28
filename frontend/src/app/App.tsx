import { Suspense, lazy, useEffect, useState } from "react";
import { LoginPage } from "../features/auth/LoginPage";
import { PortalPage } from "./PortalPage";
import { navItems } from "./navigation";
import { ToastProvider } from "../shared/components/Toast";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";
import { PageFallback } from "../shared/components/PageFallback";

import { OAuthCallbackPage } from "../features/auth/OAuthCallbackPage";
import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage";

// Halaman fitur di-lazy-load agar bundle awal ringan: library berat (maplibre-gl
// pada peta/laporan) & kode tiap rute hanya diunduh saat halamannya dibuka.
// LoginPage & PortalPage tetap eager karena jadi titik masuk paling umum.
const AuditLogPage = lazy(() => import("../features/admin/AuditLogPage").then(m => ({ default: m.AuditLogPage })));
const AdminUsersPage = lazy(() => import("../features/admin/AdminUsersPage").then(m => ({ default: m.AdminUsersPage })));
const OperatorDashboardPage = lazy(() => import("../features/dashboards/OperatorDashboardPage").then(m => ({ default: m.OperatorDashboardPage })));
const ProvinceDashboardPage = lazy(() => import("../features/dashboards/ProvinceDashboardPage").then(m => ({ default: m.ProvinceDashboardPage })));
const NotificationSettingsPage = lazy(() => import("../features/notifications/NotificationSettingsPage").then(m => ({ default: m.NotificationSettingsPage })));
const PublicMapPage = lazy(() => import("../features/public-map/PublicMapPage").then(m => ({ default: m.PublicMapPage })));
const OnboardingPage = lazy(() => import("../features/public-map/OnboardingPage").then(m => ({ default: m.OnboardingPage })));
const ReportDetailPage = lazy(() => import("../features/reports/ReportDetailPage").then(m => ({ default: m.ReportDetailPage })));
const CitizenModePage = lazy(() => import("../features/public-map/CitizenModePage").then(m => ({ default: m.CitizenModePage })));
const ReportWizardPage = lazy(() => import("../features/reports/ReportWizardPage").then(m => ({ default: m.ReportWizardPage })));
const ReportHistoryPage = lazy(() => import("../features/reports/ReportHistoryPage").then(m => ({ default: m.ReportHistoryPage })));
const ResearchPortalPage = lazy(() => import("../features/research/ResearchPortalPage").then(m => ({ default: m.ResearchPortalPage })));

function currentRoute() {
  if (window.location.pathname.startsWith('/oauth-callback')) {
    return "oauth-callback";
  }
  // Buang query string dari hash (mis. "#/login?error=menunggu") — tanpa ini
  // route "login?error=..." tidak cocok dengan cabang mana pun dan pengguna
  // OAuth yang gagal terlempar ke portal tanpa pesan apa pun.
  return (window.location.hash.replace("#/", "") || "").split("?")[0];
}

/**
 * Rute tujuan bila pengguna tak berhak membuka `route`; null berarti boleh
 * lanjut. Fungsi ini MURNI menghitung — tidak pernah menyentuh
 * `window.location`. Mutasinya dilakukan di `useEffect` (lihat App), karena
 * mengubah hash saat render memicu render ulang di tengah render.
 */
function guardRedirect(route: string): string | null {
  if (route === "reset-password") return "#/forgot-password";

  let user: { role: string } | null = null;
  try {
    const userStr = localStorage.getItem("siperah-user");
    if (userStr) user = JSON.parse(userStr);
  } catch {}

  const isUserLoggedIn = !!localStorage.getItem("siperah-token") && !!user;

  const baseRoute = route.split("/")[0];
  const navItem = navItems.find(item => item.href === `#/${baseRoute}`);

  // Melapor genangan terbuka untuk SEMUA pengguna yang sudah login (termasuk
  // petugas BPBD, demi pelaporan darurat) — beda dari menu "Lapor" di nav yang
  // sengaja tetap khusus warga. Tamu diarahkan login lebih dulu.
  if (baseRoute === "reports") {
    return isUserLoggedIn ? null : "#/login";
  }

  if (navItem?.roles) {
    if (!isUserLoggedIn || !user) {
      return navItem.roles.includes("guest") ? null : "#/login";
    }
    if (!navItem.roles.includes(user.role)) return "#/";
  }

  return null;
}

function routeComponent(route: string) {
  if (route === "login") return <LoginPage />;
  if (route === "forgot-password") return <ForgotPasswordPage />;
  if (route === "oauth-callback") return <OAuthCallbackPage />;
  if (route === "map") return <PublicMapPage />;
  if (route === "awam") return <CitizenModePage />;
  if (route === "onboarding") return <OnboardingPage />;
  if (route === "reports") return <ReportWizardPage />;
  if (route === "history") return <ReportHistoryPage />;
  if (route.startsWith("operator/reports/")) return <ReportDetailPage reportId={route.replace("operator/reports/", "")} />;
  if (route === "operator") return <OperatorDashboardPage />;
  if (route === "province") return <ProvinceDashboardPage />;
  if (route === "research") return <ResearchPortalPage />;
  if (route === "notifications") return <NotificationSettingsPage />;
  if (route === "admin") return <AdminUsersPage />;
  if (route === "audit") return <AuditLogPage />;
  return <PortalPage />;
}

export function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const syncRoute = () => setRoute(currentRoute());
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  const redirectTo = guardRedirect(route);

  // `route` ikut jadi dependensi: dua rute terlarang berbeda bisa menghasilkan
  // tujuan yang sama (mis. sama-sama "#/login"), dan tanpa itu efeknya tak
  // berjalan lagi untuk rute kedua.
  useEffect(() => {
    if (redirectTo) window.location.hash = redirectTo;
  }, [redirectTo, route]);

  return (
    <ToastProvider>
      {/* key={route} agar error di satu halaman otomatis pulih saat pindah rute */}
      <ErrorBoundary key={route}>
        <Suspense fallback={<PageFallback />}>
          {/* Selagi menunggu efek redirect berjalan, tampilkan placeholder —
              jangan render halaman yang memang tak boleh dilihat. */}
          {redirectTo ? <PageFallback /> : routeComponent(route)}
        </Suspense>
      </ErrorBoundary>
    </ToastProvider>
  );
}
