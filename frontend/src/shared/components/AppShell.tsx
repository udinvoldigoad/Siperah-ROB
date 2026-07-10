import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { navItems } from "../../app/navigation";
import { Icon } from "./Icon";
import { Breadcrumbs, type BreadcrumbItem } from "./Breadcrumbs";

const SIDEBAR_STORAGE_KEY = "siperah-sidebar";

export function AppShell({ active, title, subtitle, breadcrumbs, children }: {
  active: string;
  title: string;
  subtitle: string;
  breadcrumbs?: BreadcrumbItem[];
  children: ReactNode;
}) {
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

  // Static user state for demonstration purposes
  const isUserLoggedIn = active !== "map" && active !== "onboarding" && active !== "reports" && active !== "awam";

  return (
    <div className={`app-shell ${isSidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <a className="brand-block" href="#/">
            <span className="brand-mark"><Icon name="water_drop" /></span>
            <span className="brand-copy">
              <strong>SIPERAH-RoB</strong>
              <span>Prediksi Risiko Banjir Rob Lampung</span>
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
        <nav>
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
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          
          {isUserLoggedIn ? (
            <div className="user-profile-menu" ref={userMenuRef}>
              <button 
                type="button" 
                className="user-trigger"
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                <div className="user-avatar">BP</div>
                <div className="user-info">
                  <strong>Operator BPBD</strong>
                  <span>Prov. Lampung</span>
                </div>
                <Icon name={isUserMenuOpen ? "expand_less" : "expand_more"} />
              </button>
              
              {isUserMenuOpen && (
                <div style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  minWidth: "180px",
                  display: "grid",
                  padding: "8px",
                  zIndex: 10
                }}>
                  <a href="#/profile" className="btn secondary" style={{ justifyContent: "flex-start", border: "none", background: "transparent" }}>Profil Saya</a>
                  <a href="#/login" className="btn secondary" style={{ justifyContent: "flex-start", border: "none", color: "var(--critical)", background: "transparent" }}>Keluar</a>
                </div>
              )}
            </div>
          ) : (
            <a className="btn secondary topbar-action" href="#/login">Masuk</a>
          )}
        </header>
        <section className="content">{children}</section>
      </main>
    </div>
  );
}
