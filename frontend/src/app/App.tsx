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
import { motion, AnimatePresence } from "framer-motion";

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
    let Component;
    if (route === "login") Component = <LoginPage />;
    else if (route === "map") Component = <PublicMapPage />;
    else if (route === "awam") Component = <CitizenModePage />;
    else if (route === "onboarding") Component = <OnboardingPage />;
    else if (route === "reports") Component = <ReportWizardPage />;
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
      {renderRoute()}
    </ToastProvider>
  );
}
