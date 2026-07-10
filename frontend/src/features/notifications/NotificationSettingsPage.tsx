import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { useToast } from "../../shared/components/Toast";
import { api } from "../../shared/api/client";

interface NotificationSettings {
  channels: string[];
  event_types: string[];
  quiet_start: string | null;
  quiet_end: string | null;
  monitored_regions: string[];
}

interface NotificationSettingsResponse {
  data: NotificationSettings;
}

export function NotificationSettingsPage() {
  const toast = useToast();
  
  // Theme state
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  // Settings state (CRUD)
  const [channels, setChannels] = useState<string[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("05:00");
  const [monitoredRegions, setMonitoredRegions] = useState<string[]>([]);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [newRegion, setNewRegion] = useState("");
  const [activePreviewTab, setActivePreviewTab] = useState<"push" | "email" | "whatsapp">("push");

  // Load settings from backend database (Read)
  const fetchSettings = async () => {
    try {
      const res = await api<NotificationSettingsResponse>("/notifications/settings");
      const data = res.data;
      setChannels(data.channels || []);
      setEventTypes(data.event_types || []);
      setMonitoredRegions(data.monitored_regions || []);
      
      if (data.quiet_start) {
        // Strip seconds if present
        setQuietStart(data.quiet_start.substring(0, 5));
        setQuietHoursEnabled(true);
      } else {
        setQuietHoursEnabled(false);
      }
      if (data.quiet_end) {
        setQuietEnd(data.quiet_end.substring(0, 5));
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat pengaturan notifikasi.");
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Update theme globally
  const handleThemeChange = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    const html = document.documentElement;
    if (newTheme === "dark") {
      html.classList.remove("light");
      html.classList.add("dark");
      html.style.colorScheme = "dark";
    } else {
      html.classList.remove("dark");
      html.classList.add("light");
      html.style.colorScheme = "light";
    }
  };

  // Toggle switch handlers
  const handleChannelToggle = (channel: string) => {
    setChannels((prev) => 
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const handleEventToggle = (event: string) => {
    setEventTypes((prev) => 
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  // Create (Add Region)
  const handleAddRegion = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRegion = newRegion.trim();
    if (!cleanRegion) return;
    
    if (monitoredRegions.includes(cleanRegion)) {
      toast.info(`Wilayah "${cleanRegion}" sudah ada di daftar.`);
      return;
    }

    setMonitoredRegions((prev) => [...prev, cleanRegion]);
    setNewRegion("");
    toast.success(`Berhasil menambahkan wilayah "${cleanRegion}".`);
  };

  // Delete (Remove Region)
  const handleRemoveRegion = (regionToDelete: string) => {
    setMonitoredRegions((prev) => prev.filter((r) => r !== regionToDelete));
    toast.info(`Wilayah "${regionToDelete}" dihapus dari antrean simpan.`);
  };

  // Update (Save back to database)
  const handleSave = async () => {
    setIsLoading(true);
    try {
      await api("/notifications/settings", {
        method: "PUT",
        body: JSON.stringify({
          channels,
          event_types: eventTypes,
          quiet_start: quietHoursEnabled ? quietStart + ":00" : null,
          quiet_end: quietHoursEnabled ? quietEnd + ":00" : null,
          monitored_regions: monitoredRegions,
        }),
      });
      toast.success("Pengaturan notifikasi berhasil disimpan ke database!");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan pengaturan.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell active="notifications" title="Pengaturan Notifikasi" subtitle="Sesuaikan kanal, event, jam sunyi, dan wilayah pantau Anda.">
      <div className="notif-settings-layout">
        <style>{`
          .notif-settings-layout {
            display: grid;
            grid-template-columns: 1.2fr 0.8fr;
            gap: 28px;
            max-width: 1200px;
            margin: 0 auto;
            width: 100%;
          }

          /* General Settings Panels */
          .settings-section-panel {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 16px;
            padding: 28px;
            margin-bottom: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            transition: border-color 0.2s ease;
          }
          .settings-section-panel:hover {
            border-color: var(--ink-soft);
          }
          .settings-section-panel h2 {
            font-size: 1.15rem;
            font-weight: 700;
            margin-bottom: 8px;
            color: var(--ink);
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .settings-section-panel .panel-desc {
            font-size: 0.88rem;
            color: var(--ink-soft);
            margin-bottom: 24px;
            line-height: 1.4;
          }

          /* Theme toggle styling cards */
          .theme-toggle-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-top: 12px;
          }
          .theme-card-option {
            border: 2px solid var(--line);
            border-radius: 12px;
            padding: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: all 0.2s ease;
            background: var(--surface-soft);
          }
          .theme-card-option.active {
            border-color: var(--accent);
            background: var(--accent-soft);
          }
          .theme-card-option strong {
            font-size: 0.95rem;
            font-weight: 600;
          }

          /* Custom Toggle Switch styling */
          .switch-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 0;
            border-bottom: 1px solid var(--surface-muted);
          }
          .switch-row:last-child {
            border-bottom: none;
          }
          .switch-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .switch-info strong {
            font-size: 0.95rem;
            font-weight: 600;
            color: var(--ink);
          }
          .switch-info span {
            font-size: 0.82rem;
            color: var(--ink-soft);
          }

          /* Toggle switch button */
          .toggle-switch-input {
            position: relative;
            width: 46px;
            height: 24px;
            -webkit-appearance: none;
            background: #cbd5e1;
            outline: none;
            border-radius: 20px;
            cursor: pointer;
            transition: background 0.2s ease;
          }
          .dark .toggle-switch-input {
            background: #475569;
          }
          .toggle-switch-input:checked {
            background: var(--accent);
          }
          .toggle-switch-input::before {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            top: 2px;
            left: 2px;
            background: #fff;
            transition: transform 0.2s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          }
          .toggle-switch-input:checked::before {
            transform: translateX(22px);
          }

          /* Quiet hours styling */
          .quiet-hours-form {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-top: 16px;
          }
          .quiet-input-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .quiet-input-group label {
            font-size: 0.82rem;
            font-weight: 600;
            color: var(--ink-soft);
          }
          .quiet-input-group input[type="time"] {
            border: 1px solid var(--line);
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 0.9rem;
            background: var(--surface);
            color: var(--ink);
          }

          /* Region Tags CRUD styling */
          .regions-tag-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 16px;
          }
          .region-badge-tag {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: var(--surface-soft);
            border: 1px solid var(--line);
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 0.88rem;
            font-weight: 500;
            color: var(--ink);
          }
          .region-badge-tag button {
            border: none;
            background: transparent;
            padding: 0;
            display: flex;
            align-items: center;
            color: var(--ink-soft);
            cursor: pointer;
            font-size: 1rem;
          }
          .region-badge-tag button:hover {
            color: var(--critical);
          }
          .add-region-form-wrap {
            display: flex;
            gap: 10px;
          }
          .add-region-form-wrap input {
            flex-grow: 1;
            border: 1px solid var(--line);
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 0.9rem;
            background: var(--surface);
            color: var(--ink);
          }
          .add-region-form-wrap input:focus {
            outline: 2px solid var(--accent);
          }
          .btn-add-region {
            border: 1px solid var(--ink);
            background: var(--ink);
            color: #fff;
            border-radius: 8px;
            padding: 10px 18px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .btn-add-region:hover {
            opacity: 0.9;
          }

          /* Live Notification Preview (Mock Device) */
          .preview-panel-device {
            position: sticky;
            top: 96px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.01);
            height: fit-content;
          }
          .device-tabs {
            display: flex;
            background: var(--surface-soft);
            border: 1px solid var(--line);
            border-radius: 100px;
            padding: 4px;
            margin-bottom: 24px;
          }
          .device-tabs button {
            flex: 1;
            border: none;
            background: transparent;
            font-size: 0.82rem;
            font-weight: 600;
            padding: 8px;
            border-radius: 100px;
            cursor: pointer;
            color: var(--ink-soft);
            transition: all 0.2s ease;
          }
          .device-tabs button.active {
            background: var(--surface);
            color: var(--ink);
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          }

          /* Simulated Notifications UI */
          .notification-mock-screen {
            background: #0f172a;
            border-radius: 16px;
            padding: 16px;
            min-height: 260px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            position: relative;
            overflow: hidden;
            box-shadow: inset 0 0 100px rgba(0,0,0,0.5);
          }
          .notification-mock-screen.email-theme {
            background: #f8fafc;
            box-shadow: none;
            border: 1px solid #e2e8f0;
          }
          .notification-mock-screen.whatsapp-theme {
            background: #efeae2;
            box-shadow: none;
            border: 1px solid #d1d5db;
          }
          
          /* Phone lockscreen overlay */
          .lockscreen-time {
            color: #fff;
            font-size: 2.2rem;
            font-weight: 300;
            margin-bottom: 24px;
          }

          /* Push Notification Card */
          .mock-push-bubble {
            width: 100%;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 14px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            display: flex;
            gap: 12px;
            animation: bounce-in 0.4s ease;
          }
          .dark .mock-push-bubble {
            background: rgba(30, 41, 59, 0.85);
          }
          .push-icon-circle {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: #1e40af;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.1rem;
          }
          .push-content {
            flex-grow: 1;
            text-align: left;
          }
          .push-content h4 {
            font-size: 0.88rem;
            font-weight: 700;
            margin: 0 0 2px 0;
            color: #0f172a;
            display: flex;
            justify-content: space-between;
          }
          .dark .push-content h4 { color: #f8fafc; }
          .push-content p {
            font-size: 0.78rem;
            color: #334155;
            margin: 0;
            line-height: 1.3;
          }
          .dark .push-content p { color: #cbd5e1; }

          /* Mock Email Card */
          .mock-email-card {
            width: 100%;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            text-align: left;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
            animation: bounce-in 0.4s ease;
          }
          .mock-email-card h4 {
            font-size: 0.9rem;
            font-weight: 700;
            margin: 0 0 6px 0;
            color: #1e293b;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 6px;
          }
          .mock-email-card .email-meta {
            font-size: 0.75rem;
            color: #64748b;
            margin-bottom: 12px;
          }
          .mock-email-card p {
            font-size: 0.8rem;
            color: #334155;
            line-height: 1.4;
            margin: 0;
          }

          /* Mock WhatsApp Message */
          .mock-wa-bubble {
            align-self: flex-start;
            max-width: 85%;
            background: #fff;
            border-radius: 0 12px 12px 12px;
            padding: 12px;
            text-align: left;
            position: relative;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            font-size: 0.82rem;
            color: #111;
            line-height: 1.4;
            animation: bounce-in 0.4s ease;
          }
          .mock-wa-bubble::before {
            content: '';
            position: absolute;
            top: 0;
            left: -8px;
            width: 0;
            height: 0;
            border: 8px solid transparent;
            border-top-color: #fff;
            border-right-color: #fff;
          }
          .wa-tag {
            font-weight: 700;
            color: #075e54;
            display: block;
            margin-bottom: 4px;
            font-size: 0.78rem;
          }

          /* Animation classes */
          @keyframes bounce-in {
            0% { transform: scale(0.95); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }

          /* Bottom sticky save bar */
          .sticky-save-bar {
            display: flex;
            justify-content: flex-end;
            margin-top: 24px;
          }
          .btn-save-settings {
            border: 1px solid var(--ink);
            background: var(--ink);
            color: #fff;
            border-radius: 100px;
            padding: 14px 40px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }
          .btn-save-settings:hover {
            opacity: 0.9;
          }

          /* Disabled/Greyed states */
          .disabled-preview-overlay {
            color: #cbd5e1;
            font-size: 0.85rem;
            text-align: center;
            max-width: 200px;
            line-height: 1.4;
          }

          @media (max-width: 1024px) {
            .notif-settings-layout {
              grid-template-columns: 1fr;
            }
            .preview-panel-device {
              position: static;
            }
          }
        `}</style>

        {/* Left: Input Forms (Database CRUD) */}
        <div>
          {/* Card: Tema Tampilan */}
          <div className="settings-section-panel">
            <h2><Icon name="palette" /> Mode Tampilan</h2>
            <div className="panel-desc">Ganti antara mode terang dan mode malam untuk antarmuka sistem.</div>
            
            <div className="theme-toggle-grid">
              <div 
                className={`theme-card-option ${theme === "light" ? "active" : ""}`}
                onClick={() => handleThemeChange("light")}
              >
                <strong>Mode Terang</strong>
                <Icon name="light_mode" />
              </div>
              
              <div 
                className={`theme-card-option ${theme === "dark" ? "active" : ""}`}
                onClick={() => handleThemeChange("dark")}
              >
                <strong>Mode Malam</strong>
                <Icon name="dark_mode" />
              </div>
            </div>
          </div>

          {/* Card: Kanal Notifikasi */}
          <div className="settings-section-panel">
            <h2><Icon name="settings_input_antenna" /> Kanal Penerimaan</h2>
            <div className="panel-desc">Tentukan kanal mana saja yang Anda inginkan untuk menerima notifikasi peringatan.</div>
            
            <div className="switch-row">
              <div className="switch-info">
                <strong>Push Browser</strong>
                <span>Dapatkan pemberitahuan langsung di layar peramban Anda.</span>
              </div>
              <input 
                type="checkbox" 
                className="toggle-switch-input" 
                checked={channels.includes("push_browser")}
                onChange={() => handleChannelToggle("push_browser")}
              />
            </div>

            <div className="switch-row">
              <div className="switch-info">
                <strong>Email</strong>
                <span>Kirim ringkasan harian dan notifikasi kritis ke email terdaftar.</span>
              </div>
              <input 
                type="checkbox" 
                className="toggle-switch-input" 
                checked={channels.includes("email")}
                onChange={() => handleChannelToggle("email")}
              />
            </div>

            <div className="switch-row">
              <div className="switch-info">
                <strong>WhatsApp</strong>
                <span>Terima pesan peringatan instan secara instan ke nomor WhatsApp.</span>
              </div>
              <input 
                type="checkbox" 
                className="toggle-switch-input" 
                checked={channels.includes("whatsapp")}
                onChange={() => handleChannelToggle("whatsapp")}
              />
            </div>

            <div className="switch-row">
              <div className="switch-info">
                <strong>SMS Khusus Operator BPBD</strong>
                <span>Kanal cadangan darurat SMS (hanya untuk petugas BPBD).</span>
              </div>
              <input 
                type="checkbox" 
                className="toggle-switch-input" 
                checked={channels.includes("sms_operator")}
                onChange={() => handleChannelToggle("sms_operator")}
              />
            </div>
          </div>

          {/* Card: Event Kategori */}
          <div className="settings-section-panel">
            <h2><Icon name="notifications" /> Kategori Peringatan</h2>
            <div className="panel-desc">Pilih peristiwa apa saja yang ingin Anda pantau.</div>
            
            <div className="switch-row">
              <div className="switch-info">
                <strong>Peringatan Puncak Pasang Sangat Tinggi</strong>
                <span>Peringatan ketika pasang diprediksi masuk level bahaya ekstrem.</span>
              </div>
              <input 
                type="checkbox" 
                className="toggle-switch-input" 
                checked={eventTypes.includes("event_bahaya")}
                onChange={() => handleEventToggle("event_bahaya")}
              />
            </div>

            <div className="switch-row">
              <div className="switch-info">
                <strong>Laporan Baru dari Warga di Wilayah Kerja</strong>
                <span>Notifikasi ketika ada warga yang melaporkan genangan rob baru.</span>
              </div>
              <input 
                type="checkbox" 
                className="toggle-switch-input" 
                checked={eventTypes.includes("event_laporan")}
                onChange={() => handleEventToggle("event_laporan")}
              />
            </div>

            <div className="switch-row">
              <div className="switch-info">
                <strong>Pembaruan Model Prediksi</strong>
                <span>Pemberitahuan ketika model prediksi berhasil diperbarui sistem.</span>
              </div>
              <input 
                type="checkbox" 
                className="toggle-switch-input" 
                checked={eventTypes.includes("event_update_model")}
                onChange={() => handleEventToggle("event_update_model")}
              />
            </div>

            <div className="switch-row">
              <div className="switch-info">
                <strong>Ringkasan Prediksi Harian</strong>
                <span>Rangkuman status kesiapsiagaan harian yang dikirim setiap pagi.</span>
              </div>
              <input 
                type="checkbox" 
                className="toggle-switch-input" 
                checked={eventTypes.includes("event_ringkasan")}
                onChange={() => handleEventToggle("event_ringkasan")}
              />
            </div>

            <div className="switch-row">
              <div className="switch-info">
                <strong>Peringatan Pasang Ekstrem BMKG</strong>
                <span>Pemberitahuan darurat langsung yang disadur dari rilis BMKG.</span>
              </div>
              <input 
                type="checkbox" 
                className="toggle-switch-input" 
                checked={eventTypes.includes("event_pasang_ekstrem")}
                onChange={() => handleEventToggle("event_pasang_ekstrem")}
              />
            </div>
          </div>

          {/* Card: Jam Sunyi */}
          <div className="settings-section-panel">
            <h2><Icon name="do_not_disturb_on" /> Jam Sunyi</h2>
            <div className="panel-desc">Tahan semua pemberitahuan non-kritis selama waktu istirahat Anda. Peringatan bahaya sangat tinggi tetap dikirimkan.</div>
            
            <div className="switch-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
              <div className="switch-info">
                <strong>Aktifkan Jam Sunyi</strong>
                <span>Aktifkan mode senyap sesuai jam yang diatur.</span>
              </div>
              <input 
                type="checkbox" 
                className="toggle-switch-input" 
                checked={quietHoursEnabled}
                onChange={() => setQuietHoursEnabled(!quietHoursEnabled)}
              />
            </div>

            {quietHoursEnabled && (
              <div className="quiet-hours-form">
                <div className="quiet-input-group">
                  <label>Mulai Jam Sunyi</label>
                  <input 
                    type="time" 
                    value={quietStart} 
                    onChange={(e) => setQuietStart(e.target.value)} 
                  />
                </div>
                <div className="quiet-input-group">
                  <label>Selesai Jam Sunyi</label>
                  <input 
                    type="time" 
                    value={quietEnd} 
                    onChange={(e) => setQuietEnd(e.target.value)} 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card: Wilayah Pantau */}
          <div className="settings-section-panel">
            <h2><Icon name="map" /> Wilayah Pantauan Anda</h2>
            <div className="panel-desc">Kelola kelurahan atau wilayah pesisir Lampung yang ingin Anda pantau khusus untuk notifikasi.</div>
            
            <div className="regions-tag-list">
              {monitoredRegions.map((region) => (
                <span className="region-badge-tag" key={region}>
                  {region}
                  <button type="button" onClick={() => handleRemoveRegion(region)} aria-label={`Hapus ${region}`}>
                    <Icon name="close" />
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={handleAddRegion} className="add-region-form-wrap">
              <input 
                type="text" 
                placeholder="Tambahkan kelurahan pantau baru..."
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
              />
              <button type="submit" className="btn-add-region">Tambah</button>
            </form>
          </div>

          {/* Actions Save Bar */}
          <div className="sticky-save-bar">
            <button 
              type="button" 
              className="btn-save-settings" 
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Icon name="progress_activity" /> Menyimpan...
                </>
              ) : (
                <>
                  <Icon name="save" /> Simpan Pengaturan
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Live Interactive Mock Device Preview */}
        <div>
          <div className="preview-panel-device">
            <h2><Icon name="visibility" /> Live Preview</h2>
            <div className="panel-desc">Simulasi visual bagaimana peringatan bencana rob akan tampil di perangkat Anda.</div>
            
            <div className="device-tabs">
              <button 
                type="button" 
                className={activePreviewTab === "push" ? "active" : ""}
                onClick={() => setActivePreviewTab("push")}
              >
                Push Browser
              </button>
              <button 
                type="button" 
                className={activePreviewTab === "email" ? "active" : ""}
                onClick={() => setActivePreviewTab("email")}
              >
                Email
              </button>
              <button 
                type="button" 
                className={activePreviewTab === "whatsapp" ? "active" : ""}
                onClick={() => setActivePreviewTab("whatsapp")}
              >
                WhatsApp
              </button>
            </div>

            {/* Simulated UI Screen */}
            <div className={`notification-mock-screen ${activePreviewTab === "email" ? "email-theme" : activePreviewTab === "whatsapp" ? "whatsapp-theme" : ""}`}>
              {activePreviewTab === "push" && (
                channels.includes("push_browser") ? (
                  <>
                    <div className="lockscreen-time">19:30</div>
                    <div className="mock-push-bubble">
                      <div className="push-icon-circle">
                        <Icon name="water_drop" />
                      </div>
                      <div className="push-content">
                        <h4>
                          <span>SIPERAH-RoB Peringatan</span>
                          <span style={{ fontSize: "0.68rem", color: "var(--ink-muted)" }}>sekarang</span>
                        </h4>
                        <p>
                          <strong>Bahaya Sangat Tinggi:</strong> Tinggi air pasang di wilayah <strong>{monitoredRegions[0] || "Kalianda"}</strong> diprediksi mencapai level maksimal pada pukul 21:00 WIB. Segera lakukan mitigasi.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="disabled-preview-overlay">
                    <Icon name="notifications_off" style={{ fontSize: "2rem", marginBottom: "12px" }} />
                    <p>Kanal Push Browser dinonaktifkan di pengaturan Anda.</p>
                  </div>
                )
              )}

              {activePreviewTab === "email" && (
                channels.includes("email") ? (
                  <div className="mock-email-card">
                    <h4>[SIPERAH-RoB] Laporan Mingguan Risiko Rob</h4>
                    <div className="email-meta">Dari: info@siperah.lampungprov.go.id</div>
                    <p>
                      Halo Warga,<br/><br/>
                      Berikut adalah rangkuman prakiraan pasang untuk wilayah pantauan Anda: <strong>{monitoredRegions.join(", ") || "Belum ada wilayah"}</strong>.<br/><br/>
                      Untuk kelurahan <strong>{monitoredRegions[0] || "Kalianda"}</strong> terdeteksi risiko rob level <strong>Sangat Tinggi</strong> pada malam hari ini. Tetap waspada terhadap dampak luapan air pasang.
                    </p>
                  </div>
                ) : (
                  <div className="disabled-preview-overlay" style={{ color: "var(--ink-muted)" }}>
                    <Icon name="mail_lock" style={{ fontSize: "2rem", marginBottom: "12px" }} />
                    <p>Kanal Email dinonaktifkan di pengaturan Anda.</p>
                  </div>
                )
              )}

              {activePreviewTab === "whatsapp" && (
                channels.includes("whatsapp") ? (
                  <div className="mock-wa-bubble">
                    <span className="wa-tag">SIPERAH-RoB Lampung</span>
                    <strong>🚨 PERINGATAN BANJIR ROB 🚨</strong><br/>
                    Wilayah Pantau: {monitoredRegions[0] || "Kalianda"}<br/>
                    Tinggi Puncak: 1.8 meter<br/>
                    Puncak Prediksi: 21:00 WIB<br/>
                    Status: <strong>BAHAYA TINGGI</strong><br/><br/>
                    Mohon amankan dokumen berharga dan persiapkan evakuasi mandiri bila air mulai memasuki pemukiman warga.
                  </div>
                ) : (
                  <div className="disabled-preview-overlay" style={{ color: "#475569" }}>
                    <Icon name="sms_failed" style={{ fontSize: "2rem", marginBottom: "12px" }} />
                    <p>Kanal WhatsApp dinonaktifkan di pengaturan Anda.</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
