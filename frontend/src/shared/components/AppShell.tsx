import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { navItems } from "../../app/navigation";
import { Icon } from "./Icon";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";
import { useToast } from "./Toast";

const SIDEBAR_STORAGE_KEY = "siperah-sidebar";

export function AppShell({ active, title, subtitle, breadcrumbs, children }: {
  active: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
}) {
  const toast = useToast();
  const [isSidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(SIDEBAR_STORAGE_KEY) !== "closed");
  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, isSidebarOpen ? "open" : "closed");
  }, [isSidebarOpen]);

  const closeMenu = useCallback((e: MouseEvent) => {
    if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
      setUserMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", closeMenu);
      return () => document.removeEventListener("mousedown", closeMenu);
    }
  }, [isUserMenuOpen, closeMenu]);

  useEffect(() => {
    const handleAuthExpired = () => {
      toast.error("Sesi Anda telah habis. Silakan login kembali.");
    };
    window.addEventListener("siperah-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("siperah-auth-expired", handleAuthExpired);
  }, []);

  const isUserLoggedIn = !!localStorage.getItem("siperah-token");

  return (
    <div className={`app-shell ${isSidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="sidebar" style={{ display: "flex", flexDirection: "column" }}>
        <div className="sidebar-top">
          <a className="brand-block" href="#/">
            <span className="brand-mark"><Icon name="water_drop" /></span>
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
          {navItems.map((item) => (
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
        {isUserLoggedIn && (
          <div style={{ marginTop: "auto", background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.05)", borderRadius: 8, padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <strong style={{ fontSize: "14px", color: "var(--ink-primary)", lineHeight: 1.2 }}>Operator BPBD</strong>
              <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>Prov. Lampung</span>
            </div>
            <a 
              href="#/" 
              onClick={() => localStorage.removeItem("siperah-token")}
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
          <div className="breadcrumb">
            <Icon name="dashboard" style={{ fontSize: "16px", color: "var(--tx2)" }} />
            <span className="breadcrumb-sep"><Icon name="chevron_right" style={{ fontSize: "10px" }} /></span>
            <span className="breadcrumb-current">{title}</span>
          </div>
          
          <div className="topbar-actions">
            {isUserLoggedIn ? null : (
              <a className="btn-primary" href="#/login">Login</a>
            )}
          </div>
        </div>
        <motion.div 
          className="app-content"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
