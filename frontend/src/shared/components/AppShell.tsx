import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { navItems } from "../../app/navigation";
import { Icon } from "./Icon";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";
import { useToast } from "./Toast";
import { api } from "../api/client";
import { roleLabels } from "../constants/roles";

const SIDEBAR_STORAGE_KEY = "siperah-sidebar";

type InboxItem = { id: string; title: string; body: string; read_at: string | null; created_at: string };
type InboxResponse = { data: InboxItem[] };

export function AppShell({ active, title, subtitle, breadcrumbs, children }: {
  active: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
}) {
  const toast = useToast();
  const [isSidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "closed");
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isNotificationOpen, setNotificationOpen] = useState(false);
  const [isDarkMode, setDarkMode] = useState(() => localStorage.getItem("siperah-theme") === "dark");
  const [notifications, setNotifications] = useState<InboxItem[]>([]);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("siperah-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("siperah-theme", "light");
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, isSidebarOpen ? "open" : "closed");
  }, [isSidebarOpen]);

  const closeMenu = useCallback((e: MouseEvent) => {
    if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
      setNotificationOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isNotificationOpen) {
      document.addEventListener("mousedown", closeMenu);
      return () => document.removeEventListener("mousedown", closeMenu);
    }
  }, [isNotificationOpen, closeMenu]);

  useEffect(() => {
    const handleAuthExpired = () => {
      toast.error("Sesi Anda telah habis. Silakan login kembali.");
    };
    window.addEventListener("siperah-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("siperah-auth-expired", handleAuthExpired);
  }, []);

  let user: { name: string; role: string; region_id: string | null } | null = null;
  try {
    const userStr = localStorage.getItem("siperah-user");
    if (userStr) user = JSON.parse(userStr);
  } catch {}

  const isUserLoggedIn = !!localStorage.getItem("siperah-token") && !!user;

  useEffect(() => {
    if (!isUserLoggedIn) return;
    api<InboxResponse>("/notifications")
      .then((response) => setNotifications(response.data))
      .catch(() => setNotifications([]));
  }, [isUserLoggedIn]);

  const markNotificationRead = async (item: InboxItem) => {
    if (!item.read_at) {
      await api(`/notifications/${item.id}/read`, { method: "PATCH" });
      setNotifications((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry));
    }
  };

  const markAllNotificationsRead = async () => {
    await api("/notifications/read-all", { method: "PATCH" });
    setNotifications((current) => current.map((entry) => ({ ...entry, read_at: entry.read_at || new Date().toISOString() })));
    toast.success("Semua notifikasi ditandai sudah dibaca.");
  };

  const allowedNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    if (!isUserLoggedIn || !user) return item.roles.includes("guest");
    return item.roles.includes(user.role) || (item.roles.includes("guest") && user.role === "warga");
  });

  return (
    <div className={`app-shell ${isSidebarOpen ? "" : "sidebar-collapsed"}`}>
      {/* Skip-link a11y: onClick + focus (bukan hash-anchor) agar tak bentrok
          dengan hash routing aplikasi. */}
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          const el = document.getElementById("main-content");
          if (el) { el.focus(); el.scrollIntoView(); }
        }}
      >
        Lewati ke konten utama
      </a>
      {isMobileSidebarOpen && (
        <div 
          className="mobile-sidebar-overlay" 
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${isMobileSidebarOpen ? "mobile-open" : ""}`} style={{ display: "flex", flexDirection: "column" }}>
        <div className="sidebar-top">
          <a className="brand-block" href="#/">
            <img src="/logo.png" alt="Logo SIPERAH" style={{ width: "32px", height: "32px", objectFit: "contain", borderRadius: "8px" }} />
            <span className="brand-copy">
              <strong>SIPERAH-RoB</strong>
            </span>
          </a>
          <button
            aria-expanded={isSidebarOpen}
            aria-label={isSidebarOpen ? "Tutup sidebar" : "Buka sidebar"}
            className="sidebar-toggle"
            type="button"
            onClick={() => setSidebarOpen((value) => !value)}
          >
            <Icon name={isSidebarOpen ? "menu_open" : "menu"} />
          </button>
        </div>
        <nav style={{ flexGrow: 1 }}>
          {allowedNavItems.map((item) => (
            <a
              key={item.href}
              aria-label={item.label}
              className={item.href.includes(active) ? "active" : ""}
              href={item.href}
              title={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        {isUserLoggedIn && user && (
          <div className="sidebar-user-card" style={{ marginTop: "auto", borderRadius: 8, padding: "16px", display: "flex", flexDirection: "column", gap: "12px", overflow: "hidden" }}>
            <div className="sidebar-user-meta" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <strong style={{ fontSize: "14px", color: "var(--ink-primary)", lineHeight: 1.2 }}>{user.name}</strong>
              <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>{roleLabels[user.role] || user.role}</span>
            </div>
              <a
                className="sidebar-user-logout"
                title="Logout"
                aria-label="Logout"
                href="#/"
                onClick={() => {
                  localStorage.removeItem("siperah-token");
                  localStorage.removeItem("siperah-user");
                }}
                style={{ color: "var(--critical)", display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px", textDecoration: "none", marginTop: "4px" }}
              >
                <Icon name="logout" style={{ fontSize: "18px" }} />
                <span>Logout</span>
              </a>
          </div>
        )}
      </aside>
      <div className="app-main">
        <div className="app-topbar">
          <div className="breadcrumb" style={{ display: "flex", alignItems: "center" }}>
            <button 
              className="mobile-menu-toggle"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Buka Menu"
            >
              <Icon name="menu" />
            </button>
            <Icon name="dashboard" style={{ fontSize: "16px", color: "var(--tx2)" }} />
            <span className="breadcrumb-sep"><Icon name="chevron_right" style={{ fontSize: "10px" }} /></span>
            <span className="breadcrumb-current">{title}</span>
          </div>
          
          <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button 
              type="button" 
              className="notification-trigger" 
              aria-label="Ganti Tema" 
              onClick={() => setDarkMode(!isDarkMode)}
            >
              <Icon name={isDarkMode ? "light_mode" : "dark_mode"} />
            </button>
            {isUserLoggedIn ? (
              <div className="notification-menu" ref={notificationRef}>
                <button
                  type="button"
                  className="notification-trigger"
                  aria-label="Buka notifikasi"
                  aria-expanded={isNotificationOpen}
                  onClick={() => setNotificationOpen((value) => !value)}
                >
                  <Icon name="notifications" />
                  {notifications.some((item) => !item.read_at) && <span className="notification-dot" />}
                </button>
                {isNotificationOpen && (
                  <div className="notification-dropdown">
                    <div className="notification-dropdown-head">
                      <div><strong>Notifikasi</strong><span>{notifications.filter((item) => !item.read_at).length} belum dibaca</span></div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button type="button" onClick={markAllNotificationsRead} style={{ fontSize: "12px", background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>Tandai Semua</button>
                        <a href="#/notifications" onClick={() => setNotificationOpen(false)}>Pengaturan</a>
                      </div>
                    </div>
                    <div className="notification-list">
                      {notifications.length === 0 ? <p className="notification-empty">Belum ada notifikasi.</p> : notifications.slice(0, 6).map((item) => (
                        <button type="button" key={item.id} className={item.read_at ? "" : "unread"} onClick={() => void markNotificationRead(item)}>
                          <strong>{item.title}</strong><span>{item.body}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <a className="btn-primary" href="#/login">Login</a>
            )}
          </div>
        </div>
        <motion.div
          className="app-content"
          id="main-content"
          tabIndex={-1}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </div>
      
      {/* Mobile Bottom Pill Navigation */}
      <nav className="mobile-bottom-pill">
        {allowedNavItems.slice(0, allowedNavItems.length > 4 ? 4 : allowedNavItems.length).map((item) => (
          <a
            key={item.href}
            className={`pill-nav-item ${item.href.includes(active) ? "active" : ""}`}
            href={item.href}
            title={item.label}
          >
            <Icon name={item.icon} style={{ fontSize: "24px", marginBottom: "4px" }} />
            <span>{item.label}</span>
          </a>
        ))}
        {(allowedNavItems.length > 4 || isUserLoggedIn) && (
          <button type="button" className={`pill-nav-item ${isMoreMenuOpen ? "active" : ""}`} onClick={() => setIsMoreMenuOpen(true)} style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            <Icon name="more_horiz" style={{ fontSize: "24px", marginBottom: "4px" }} />
            <span>Lainnya</span>
          </button>
        )}
      </nav>

      <AnimatePresence>
        {isMoreMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreMenuOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9998 }}
            />
            {/* Action Sheet Menu */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              style={{
                position: "fixed",
                bottom: "80px",
                left: "16px",
                right: "16px",
                background: "var(--surface)",
                borderRadius: "24px",
                padding: "24px 16px",
                zIndex: 9999,
                boxShadow: "0 -10px 40px rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                maxHeight: "70vh",
                overflowY: "auto"
              }}
            >
              <div className="drag-handle" style={{ width: 40, height: 4, background: "var(--line)", borderRadius: 99, margin: "0 auto 16px" }} />
              
              {isUserLoggedIn && user && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "0 12px 12px 12px", borderBottom: "1px solid var(--line)" }}>
                  <strong style={{ fontSize: "16px", color: "var(--ink-primary)", lineHeight: 1.2 }}>{user.name}</strong>
                  <span style={{ fontSize: "13px", color: "var(--ink-soft)" }}>{roleLabels[user.role] || user.role}</span>
                </div>
              )}

              {allowedNavItems.slice(4).map(item => (
                <a 
                  key={item.href} 
                  href={item.href} 
                  onClick={() => setIsMoreMenuOpen(false)} 
                  style={{ display: "flex", alignItems: "center", gap: 16, color: "var(--ink)", textDecoration: "none", fontSize: "15px", fontWeight: 600, padding: "12px", borderRadius: "12px", background: item.href.includes(active) ? "var(--accent-soft)" : "transparent" }}
                >
                  <Icon name={item.icon} style={{ fontSize: 24, color: item.href.includes(active) ? "var(--accent)" : "var(--ink-soft)" }} />
                  {item.label}
                </a>
              ))}

              {isUserLoggedIn && (
                <a
                  href="#/"
                  onClick={() => {
                    localStorage.removeItem("siperah-token");
                    localStorage.removeItem("siperah-user");
                    setIsMoreMenuOpen(false);
                    window.location.hash = "/";
                    window.location.reload();
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 16, color: "var(--critical)", textDecoration: "none", fontSize: "15px", fontWeight: 600, padding: "12px", borderRadius: "12px", marginTop: "8px" }}
                >
                  <Icon name="logout" style={{ fontSize: 24, color: "var(--critical)" }} />
                  <span>Logout</span>
                </a>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
