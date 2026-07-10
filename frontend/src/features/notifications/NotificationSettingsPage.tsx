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
  const [isLoading, setIsLoading] = useState(false);

  // Form States
  const [channels, setChannels] = useState<string[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("06:00");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [monitoredRegions, setMonitoredRegions] = useState<string[]>([]);
  const [newRegion, setNewRegion] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Load Settings (Read)
  const fetchSettings = async () => {
    try {
      const res = await api<NotificationSettingsResponse>("/notifications/settings");
      const data = res.data;
      setChannels(data.channels || []);
      setEventTypes(data.event_types || []);
      setMonitoredRegions(data.monitored_regions || []);
      if (data.quiet_start) {
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

  // Toggle Handlers
  const toggleChannel = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const toggleEventType = (event: string) => {
    setEventTypes((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  // Add Region (Create)
  const handleAddRegion = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRegion = newRegion.trim();
    if (!cleanRegion) return;

    if (monitoredRegions.includes(cleanRegion)) {
      toast.info(`Wilayah "${cleanRegion}" sudah terpantau.`);
      return;
    }

    setMonitoredRegions((prev) => [...prev, cleanRegion]);
    setNewRegion("");
    setShowAddForm(false);
    toast.success(`Menambahkan ${cleanRegion} ke antrean pantau.`);
  };

  // Remove Region (Delete)
  const handleRemoveRegion = (region: string) => {
    setMonitoredRegions((prev) => prev.filter((r) => r !== region));
    toast.info(`Menghapus ${region} dari antrean.`);
  };

  // Save Settings (Update)
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
    <AppShell active="notifications" title="Pengaturan Notifikasi">
      <style>{`
        .settings-wrap {
          max-width: 640px;
          margin: 0 auto;
        }
        .settings-section {
          margin-bottom: 24px;
        }
        .settings-section-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--tx2);
          text-transform: uppercase;
          letter-spacing: .5px;
          margin-bottom: 12px;
        }
        .setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: var(--bg0);
          border: 1px solid var(--bd);
          border-radius: var(--radius);
          margin-bottom: 8px;
        }
        .setting-row:last-child {
          margin-bottom: 0;
        }
        .setting-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .setting-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .setting-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--tx0);
        }
        .setting-desc {
          font-size: 11px;
          color: var(--tx2);
          margin-top: 1px;
        }
        .cb-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--bd);
          font-size: 13px;
        }
        .cb-row:last-child {
          border-bottom: none;
        }
        
        /* Styled switch toggle input */
        .toggle-switch {
          position: relative;
          width: 44px;
          height: 24px;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-track {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--bd);
          transition: .2s;
          border-radius: 24px;
        }
        .toggle-thumb {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .2s;
          border-radius: 50%;
          box-shadow: var(--sh-sm);
        }
        input:checked + .toggle-track {
          background-color: var(--blue);
        }
        input:checked + .toggle-track .toggle-thumb {
          transform: translateX(20px);
        }
      `}</style>

      <div className="settings-wrap">
        {/* Channels */}
        <div className="settings-section">
          <div className="settings-section-title">Saluran Notifikasi</div>
          
          <div className="setting-row">
            <div className="setting-left">
              <div className="setting-icon" style={{ background: "#eff6ff" }}>
                <Icon name="notifications" style={{ color: "#1d4ed8", fontSize: "18px" }} />
              </div>
              <div>
                <div className="setting-label">Push notifikasi browser</div>
                <div className="setting-desc">Notifikasi real-time di browser Anda</div>
              </div>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={channels.includes("browser")} 
                onChange={() => toggleChannel("browser")} 
              />
              <span className="toggle-track"><span className="toggle-thumb"></span></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-left">
              <div className="setting-icon" style={{ background: "#f0fdf4" }}>
                <Icon name="mail" style={{ color: "#15803d", fontSize: "18px" }} />
              </div>
              <div>
                <div className="setting-label">Email</div>
                <div className="setting-desc">andi.saputra@bpbd.lampung.go.id</div>
              </div>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={channels.includes("email")} 
                onChange={() => toggleChannel("email")} 
              />
              <span className="toggle-track"><span className="toggle-thumb"></span></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-left">
              <div className="setting-icon" style={{ background: "#f0fdf4" }}>
                <Icon name="chat" style={{ color: "#25d366", fontSize: "18px" }} />
              </div>
              <div>
                <div className="setting-label">WhatsApp</div>
                <div className="setting-desc">+62 812-xxxx-xxxx</div>
              </div>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={channels.includes("whatsapp")} 
                onChange={() => toggleChannel("whatsapp")} 
              />
              <span className="toggle-track"><span className="toggle-thumb"></span></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-left">
              <div className="setting-icon" style={{ background: "#faf5ff" }}>
                <Icon name="smartphone" style={{ color: "#7c3aed", fontSize: "18px" }} />
              </div>
              <div>
                <div className="setting-label">SMS</div>
                <div className="setting-desc">Tersedia untuk operator BPBD</div>
              </div>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={channels.includes("sms")} 
                onChange={() => toggleChannel("sms")} 
              />
              <span className="toggle-track"><span className="toggle-thumb"></span></span>
            </label>
          </div>
        </div>

        {/* Event Subscriptions */}
        <div className="settings-section">
          <div className="settings-section-title">Berlangganan Peristiwa</div>
          <div className="card" style={{ padding: 0 }}>
            <div className="cb-row">
              <div>
                <div style={{ fontWeight: 500 }}>Peringatan bahaya Sangat Tinggi</div>
                <div style={{ fontSize: "11px", color: "var(--tx2)" }}>Wilayah pantau Anda mencapai kelas Sangat Tinggi</div>
              </div>
              <input 
                type="checkbox" 
                checked={eventTypes.includes("bahaya_sangat_tinggi")} 
                onChange={() => toggleEventType("bahaya_sangat_tinggi")} 
                style={{ accentColor: "var(--blue)", width: "16px", height: "16px" }}
              />
            </div>
            
            <div className="cb-row">
              <div>
                <div style={{ fontWeight: 500 }}>Laporan ground truth baru</div>
                <div style={{ fontSize: "11px", color: "var(--tx2)" }}>Ada laporan warga di wilayah pantau Anda</div>
              </div>
              <input 
                type="checkbox" 
                checked={eventTypes.includes("laporan_ground_truth")} 
                onChange={() => toggleEventType("laporan_ground_truth")} 
                style={{ accentColor: "var(--blue)", width: "16px", height: "16px" }}
              />
            </div>

            <div className="cb-row">
              <div>
                <div style={{ fontWeight: 500 }}>Pemberitahuan pembaruan model</div>
                <div style={{ fontSize: "11px", color: "var(--tx2)" }}>Model diperbarui dengan data pasang surut terbaru</div>
              </div>
              <input 
                type="checkbox" 
                checked={eventTypes.includes("pembaruan_model")} 
                onChange={() => toggleEventType("pembaruan_model")} 
                style={{ accentColor: "var(--blue)", width: "16px", height: "16px" }}
              />
            </div>

            <div className="cb-row">
              <div>
                <div style={{ fontWeight: 500 }}>Ringkasan harian harian</div>
                <div style={{ fontSize: "11px", color: "var(--tx2)" }}>Laporan singkat kondisi risiko pukul 06:00 WIB</div>
              </div>
              <input 
                type="checkbox" 
                checked={eventTypes.includes("ringkasan_harian")} 
                onChange={() => toggleEventType("ringkasan_harian")} 
                style={{ accentColor: "var(--blue)", width: "16px", height: "16px" }}
              />
            </div>

            <div className="cb-row">
              <div>
                <div style={{ fontWeight: 500 }}>Peringatan BMKG pasang ekstrem</div>
                <div style={{ fontSize: "11px", color: "var(--tx2)" }}>Notifikasi dari stasiun cuaca dan pasang BMKG resmi</div>
              </div>
              <input 
                type="checkbox" 
                checked={eventTypes.includes("peringatan_bmkg")} 
                onChange={() => toggleEventType("peringatan_bmkg")} 
                style={{ accentColor: "var(--blue)", width: "16px", height: "16px" }}
              />
            </div>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="settings-section">
          <div className="settings-section-title">Jam Sunyi (Tidak Diganggu)</div>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500 }}>Aktifkan jam sunyi</div>
                <div style={{ fontSize: "11px", color: "var(--tx2)", marginTop: "1px" }}>Notifikasi non-kritis ditahan selama jam ini</div>
              </div>
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={quietHoursEnabled} 
                  onChange={(e) => setQuietHoursEnabled(e.target.checked)} 
                />
                <span className="toggle-track"><span className="toggle-thumb"></span></span>
              </label>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--tx2)", display: "block", marginBottom: "5px" }}>Mulai jam sunyi</label>
                <input 
                  type="time" 
                  value={quietStart} 
                  disabled={!quietHoursEnabled}
                  onChange={(e) => setQuietStart(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--bd)", borderRadius: "var(--radius)", fontSize: "13px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "var(--tx2)", display: "block", marginBottom: "5px" }}>Selesai jam sunyi</label>
                <input 
                  type="time" 
                  value={quietEnd} 
                  disabled={!quietHoursEnabled}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--bd)", borderRadius: "var(--radius)", fontSize: "13px" }}
                />
              </div>
            </div>

            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: "11px", color: "#92400e", display: "flex", alignItems: "center", gap: "8px" }}>
              <Icon name="warning" style={{ fontSize: "14px", color: "#d97706" }} />
              Peringatan Sangat Tinggi dan darurat tetap dikirim meskipun jam sunyi aktif.
            </div>
          </div>
        </div>

        {/* Wilayah Pantau */}
        <div className="settings-section">
          <div className="settings-section-title">Wilayah Pantau</div>
          <div className="card">
            <div style={{ fontSize: "12px", color: "var(--tx2)", marginBottom: "12px" }}>Notifikasi akan dikirim untuk kelurahan/kecamatan berikut:</div>
            
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
              {monitoredRegions.map((region) => (
                <span key={region} style={{ background: "var(--bg1)", border: "1px solid var(--bd)", borderRadius: "999px", padding: "4px 12px", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px" }}>
                  {region} 
                  <button 
                    onClick={() => handleRemoveRegion(region)}
                    style={{ border: "none", background: "none", cursor: "pointer", padding: "0 0 0 2px", fontSize: "12px", color: "var(--tx3)", display: "flex", alignItems: "center" }}
                  >
                    &times;
                  </button>
                </span>
              ))}

              {showAddForm ? (
                <form onSubmit={handleAddRegion} style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                  <input 
                    type="text" 
                    placeholder="Nama wilayah..." 
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    autoFocus
                    style={{ padding: "4px 8px", border: "1px solid var(--bd)", borderRadius: "var(--radius)", fontSize: "11px" }}
                  />
                  <button type="submit" style={{ padding: "4px 8px", fontSize: "11px", background: "var(--blue)", color: "#fff", borderColor: "var(--blue)" }}>Tambah</button>
                  <button type="button" onClick={() => setShowAddForm(false)} style={{ padding: "4px 8px", fontSize: "11px" }}>Batal</button>
                </form>
              ) : (
                <button 
                  onClick={() => setShowAddForm(true)}
                  style={{ background: "none", border: "1px dashed var(--bd)", borderRadius: "999px", padding: "4px 12px", fontSize: "11px", color: "var(--blue)", cursor: "pointer" }}
                >
                  <Icon name="add" style={{ fontSize: "11px", verticalAlign: "middle", marginRight: "3px" }} /> Tambah wilayah
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "4px" }}>
          <button 
            type="button" 
            onClick={fetchSettings}
            style={{ background: "var(--bg1)", borderColor: "var(--bd)", color: "var(--tx2)" }}
          >
            Batal
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSave} 
            disabled={isLoading}
          >
            <Icon name="save" style={{ fontSize: "13px" }} /> {isLoading ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
