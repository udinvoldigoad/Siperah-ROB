import { useEffect, useState } from "react";
import { AuditLogPage } from "../features/admin/AuditLogPage";
import { AdminUsersPage } from "../features/admin/AdminUsersPage";
import { LoginPage } from "../features/auth/LoginPage";
import { OperatorDashboardPage } from "../features/dashboards/OperatorDashboardPage";
import { ProvinceDashboardPage } from "../features/dashboards/ProvinceDashboardPage";
import { NotificationSettingsPage } from "../features/notifications/NotificationSettingsPage";
import { PublicMapPage } from "../features/public-map/PublicMapPage";
import { OnboardingPage } from "../features/public-map/OnboardingPage";
import { ReportDetailPage } from "../features/reports/ReportDetailPage";
import { CitizenModePage } from "../features/public-map/CitizenModePage";
import { ReportWizardPage } from "../features/reports/ReportWizardPage";
import { ResearchPortalPage } from "../features/research/ResearchPortalPage";
import { PortalPage } from "./PortalPage";
import { ToastProvider } from "../shared/components/Toast";

function currentRoute() {
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
    if (route === "login") return <LoginPage />;
    if (route === "map") return <PublicMapPage />;
    if (route === "awam") return <CitizenModePage />;
    if (route === "onboarding") return <OnboardingPage />;
    if (route === "reports") return <ReportWizardPage />;
    if (route.startsWith("operator/reports/")) return <ReportDetailPage reportId={route.replace("operator/reports/", "")} />;
    if (route === "operator") return <OperatorDashboardPage />;
    if (route === "province") return <ProvinceDashboardPage />;
    if (route === "research") return <ResearchPortalPage />;
    if (route === "notifications") return <NotificationSettingsPage />;
    if (route === "admin") return <AdminUsersPage />;
    if (route === "audit") return <AuditLogPage />;

    return <PortalPage />;
  };

  return (
    <ToastProvider>
      {renderRoute()}
    </ToastProvider>
  );
}
