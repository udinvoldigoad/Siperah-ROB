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
  return window.location.hash.replace("#/", "") || "";
}

export function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const syncRoute = () => setRoute(currentRoute());
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  const renderRoute = () => {
    let user: { role: string } | null = null;
    try {
      const userStr = localStorage.getItem("siperah-user");
      if (userStr) user = JSON.parse(userStr);
    } catch {}

    const isUserLoggedIn = !!localStorage.getItem("siperah-token") && !!user;

    const baseRoute = route.split("/")[0];
    const navItem = navItems.find(item => item.href === `#/${baseRoute}`);
    
    if (navItem && navItem.roles) {
      if (!isUserLoggedIn || !user) {
        if (!navItem.roles.includes("guest")) {
          window.location.hash = "#/login";
          return null;
        }
      } else if (!navItem.roles.includes(user.role)) {
        window.location.hash = "#/";
        return null;
      }
    }

    let Component;
    if (route === "login") Component = <LoginPage />;
    else if (route === "forgot-password") Component = <ForgotPasswordPage />;
    else if (route === "reset-password") { window.location.hash = "#/forgot-password"; return null; }
    else if (route === "oauth-callback") Component = <OAuthCallbackPage />;
    else if (route === "map") Component = <PublicMapPage />;
    else if (route === "awam") Component = <CitizenModePage />;
    else if (route === "onboarding") Component = <OnboardingPage />;
    else if (route === "reports") Component = <ReportWizardPage />;
    else if (route === "history") Component = <ReportHistoryPage />;
    else if (route.startsWith("operator/reports/")) Component = <ReportDetailPage reportId={route.replace("operator/reports/", "")} />;
    else if (route === "operator") Component = <OperatorDashboardPage />;
    else if (route === "province") Component = <ProvinceDashboardPage />;
    else if (route === "research") Component = <ResearchPortalPage />;
    else if (route === "notifications") Component = <NotificationSettingsPage />;
    else if (route === "admin") Component = <AdminUsersPage />;
    else if (route === "audit") Component = <AuditLogPage />;
    else Component = <PortalPage />;

    return Component;
  };

  return (
    <ToastProvider>
      {/* key={route} agar error di satu halaman otomatis pulih saat pindah rute */}
      <ErrorBoundary key={route}>
        <Suspense fallback={<PageFallback />}>
          {renderRoute()}
        </Suspense>
      </ErrorBoundary>
    </ToastProvider>
  );
}
