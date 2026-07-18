import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { useToast } from "../../shared/components/Toast";
import { api } from "../../shared/api/client";
import { motion, AnimatePresence, type Variants } from "framer-motion";

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

interface InboxItem { id: string; title: string; body: string; read_at: string | null; created_at: string; }
interface InboxResponse { data: InboxItem[]; }

const lampungRegionOptions = [
  "Bandar Lampung", "Lampung Selatan", "Pesawaran", "Tanggamus", "Pesisir Barat", "Lampung Timur", "Tulang Bawang"
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

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
  const [inbox, setInbox] = useState<InboxItem[]>([]);

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

  const fetchInbox = async () => {
    try {
      const res = await api<InboxResponse>("/notifications");
      setInbox(res.data);
    } catch { /* Kotak masuk bersifat pelengkap; pengaturan tetap dapat digunakan. */ }
  };

  useEffect(() => {
    fetchSettings();
    fetchInbox();
  }, []);

  const markRead = async (item: InboxItem) => {
    if (item.read_at) return;
    await api(`/notifications/${item.id}/read`, { method: "PATCH" });
    setInbox((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry));
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeWebPush = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Izin notifikasi ditolak.');
      
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        const vapidRes = await api<{data: {public_key: string}}>('/webpush/vapid-public-key');
        const publicKey = vapidRes.data.public_key;
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }
      
      const subJSON = subscription.toJSON();
      await api('/webpush/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          keys: subJSON.keys
        })
      });
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengaktifkan push notifikasi browser.');
      return false;
    }
  };

  const toggleChannel = async (channel: string) => {
    if (channel === 'browser' && !channels.includes('browser')) {
      const success = await subscribeWebPush();
      if (!success) return;
    }
    
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    );
  };

  const toggleEventType = (event: string) => {
    setEventTypes((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

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

  const handleRemoveRegion = (region: string) => {
    setMonitoredRegions((prev) => prev.filter((r) => r !== region));
    toast.info(`Menghapus ${region} dari antrean.`);
  };

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
      toast.success("Pengaturan notifikasi berhasil disimpan!");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan pengaturan.");
    } finally {
      setIsLoading(false);
    }
  };

  const activeChannelsCount = channels.length;
  const activeEventsCount = eventTypes.length;

  return (
    <AppShell active="settings" title="Pengaturan Notifikasi" subtitle="Atur saluran peringatan dini dan laporan ground truth yang ingin Anda terima.">
      <style>{`
        .notif-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .notif-time-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--line);
        }
        @media (max-width: 992px) {
          .notif-layout { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .notif-time-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="content" style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 60 }}>
        
        {/* KPI Grid */}
        <motion.div variants={itemVariants} className="metric-grid" style={{ marginBottom: 32 }}>
          <div className={`metric-card ${activeChannelsCount > 0 ? "success" : "warning"}`}>
            <span>Saluran Aktif</span>
            <strong>{activeChannelsCount}</strong>
            <small>Media penerimaan notifikasi</small>
          </div>
          <div className="metric-card">
            <span>Peristiwa Dipantau</span>
            <strong>{activeEventsCount}</strong>
            <small>Jenis peringatan & update</small>
          </div>
          <div className={`metric-card ${quietHoursEnabled ? "critical" : ""}`}>
            <span>Jam Sunyi</span>
            <strong>{quietHoursEnabled ? "Aktif" : "Nonaktif"}</strong>
            <small>{quietHoursEnabled ? `${quietStart} - ${quietEnd}` : "Menerima notif 24/7"}</small>
          </div>
          <div className="metric-card">
            <span>Wilayah Area</span>
            <strong>{monitoredRegions.length}</strong>
            <small>Area spesifik difilter</small>
          </div>
        </motion.div>

        {/* 2-Column Layout for Settings */}
        <div className="notif-layout">
          
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Channels Panel */}
            <motion.div variants={itemVariants} className="panel">
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="cell_tower" style={{ color: "var(--accent)" }} /> Saluran Komunikasi
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--ink-soft)" }}>Pilih media pengiriman notifikasi ke perangkat Anda.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { id: "browser", icon: "notifications", title: "Push Notifikasi Browser", desc: "Notifikasi real-time di desktop/mobile" },
                  { id: "email", icon: "mail", title: "Email Instansi", desc: "Pesan dikirim ke email Anda" },
                  { id: "whatsapp", icon: "chat", title: "WhatsApp Peringatan", desc: "Pesan instan via WhatsApp bot (Segera hadir)" }
                ].map((ch) => (
                  <div key={ch.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--surface-soft)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name={ch.icon} style={{ fontSize: "20px", color: "var(--ink-soft)" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>{ch.title}</div>
                        <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "2px" }}>{ch.desc}</div>
                      </div>
                    </div>
                    {/* Switch */}
                    <label style={{ position: "relative", width: "44px", height: "24px", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={channels.includes(ch.id)} 
                        onChange={() => toggleChannel(ch.id)} 
                        style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
                      />
                      <span style={{ 
                        position: "absolute", top: 0, left: 0, right: 0, bottom: 0, 
                        background: channels.includes(ch.id) ? "var(--accent)" : "var(--line)", 
                        borderRadius: 8, transition: "0.3s" 
                      }}>
                        <span style={{ 
                          position: "absolute", height: "18px", width: "18px", left: "3px", bottom: "3px", 
                          background: "#fff", borderRadius: "50%", transition: "0.3s",
                          transform: channels.includes(ch.id) ? "translateX(20px)" : "translateX(0)" 
                        }} />
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Quiet Hours Panel */}
            <motion.div variants={itemVariants} className="panel">
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="do_not_disturb_on" style={{ color: "var(--critical)" }} /> Jam Sunyi (DND)
                </h3>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>Jeda notifikasi otomatis</div>
                  <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "2px" }}>Tahan notifikasi non-kritis selama periode ini</div>
                </div>
                <label style={{ position: "relative", width: "44px", height: "24px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={quietHoursEnabled} 
                    onChange={(e) => setQuietHoursEnabled(e.target.checked)} 
                    style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
                  />
                  <span style={{ 
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, 
                    background: quietHoursEnabled ? "var(--critical)" : "var(--line)", 
                    borderRadius: 8, transition: "0.3s" 
                  }}>
                    <span style={{ 
                      position: "absolute", height: "18px", width: "18px", left: "3px", bottom: "3px", 
                      background: "#fff", borderRadius: "50%", transition: "0.3s",
                      transform: quietHoursEnabled ? "translateX(20px)" : "translateX(0)" 
                    }} />
                  </span>
                </label>
              </div>

              <AnimatePresence>
                {quietHoursEnabled && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="notif-time-grid">
                      <div>
                        <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: "6px" }}>Mulai (WIB)</label>
                        <input 
                          type="time" 
                          value={quietStart} 
                          onChange={(e) => setQuietStart(e.target.value)}
                          style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: "var(--radius)", fontSize: "14px", color: "var(--ink)", background: "var(--surface)" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: "6px" }}>Selesai (WIB)</label>
                        <input 
                          type="time" 
                          value={quietEnd} 
                          onChange={(e) => setQuietEnd(e.target.value)}
                          style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--line)", borderRadius: "var(--radius)", fontSize: "14px", color: "var(--ink)", background: "var(--surface)" }}
                        />
                      </div>
                      </div>
                      <p style={{ marginTop: "12px", fontSize: "12px", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                        <strong>Catatan:</strong> Peringatan kritis (seperti bencana sangat tinggi atau mendesak) akan tetap dikirimkan dan mengabaikan pengaturan jam sunyi ini.
                      </p>
                    </motion.div>
                  )}
              </AnimatePresence>
              
              <div style={{ background: "var(--warning-soft)", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: "12px 16px", fontSize: "12px", color: "#92400e", display: "flex", gap: "12px", alignItems: "start", marginTop: "8px" }}>
                <Icon name="warning" style={{ fontSize: "18px", color: "#d97706", flexShrink: 0 }} />
                <div style={{ lineHeight: 1.5 }}>
                  Peringatan <strong>Sangat Tinggi</strong> dan darurat evakuasi akan <strong>tetap dikirimkan</strong> meskipun jam sunyi sedang aktif.
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Event Subscriptions Panel */}
            <motion.div variants={itemVariants} className="panel flush">
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="checklist" style={{ color: "var(--success)" }} /> Berlangganan Peristiwa
                </h3>
              </div>
              <div>
                {[
                  { id: "bahaya_sangat_tinggi", title: "Peringatan bahaya Sangat Tinggi", desc: "Wilayah pantau mencapai kelas Sangat Tinggi" },
                  { id: "laporan_ground_truth", title: "Laporan warga (Ground Truth)", desc: "Ada laporan kerusakan baru dari relawan/warga" },
                  { id: "pembaruan_model", title: "Pembaruan model AI", desc: "Model spasial diperbarui dengan data pasang terbaru" },
                  { id: "ringkasan_harian", title: "Ringkasan metrik harian", desc: "Laporan harian kondisi risiko masuk pada 06:00 WIB" },
                  { id: "peringatan_bmkg", title: "Peringatan cuaca ekstrem BMKG", desc: "Peringatan resmi dari stasiun maritim Panjang" },
                ].map((event) => (
                  <label 
                    key={event.id} 
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--line)", cursor: "pointer", transition: "background 0.2s" }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "var(--surface-soft)"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "14px" }}>{event.title}</div>
                      <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "2px" }}>{event.desc}</div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={eventTypes.includes(event.id)} 
                      onChange={() => toggleEventType(event.id)} 
                      style={{ accentColor: "var(--accent)", width: "18px", height: "18px", cursor: "pointer" }}
                    />
                  </label>
                ))}
              </div>
            </motion.div>

            {/* Monitored Regions Panel */}
            <motion.div variants={itemVariants} className="panel">
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                <Icon name="my_location" style={{ color: "var(--brand)" }} /> Wilayah Pantau
              </h3>
              <p style={{ fontSize: "13px", color: "var(--ink-soft)", margin: "0 0 16px 0", lineHeight: 1.5 }}>
                Batasi notifikasi hanya untuk kelurahan atau kecamatan tertentu. Kosongkan untuk menerima notifikasi seluruh area Provinsi.
              </p>
              
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                <AnimatePresence>
                    {monitoredRegions.map((region) => (
                      <motion.span 
                        key={region} 
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                        style={{ background: "var(--brand-soft)", border: "1px solid var(--brand)", borderRadius: 8, padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "var(--brand)", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        {region}
                        <button type="button" onClick={() => handleRemoveRegion(region)} aria-label={`Hapus ${region}`} style={{ background: "transparent", border: "none", color: "var(--brand)", cursor: "pointer", display: "flex", padding: 0 }}>
                          <Icon name="close" style={{ fontSize: "14px" }} />
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                  
                  {showAddForm ? (
                    <form onSubmit={handleAddRegion} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input 
                        list="lampung-regions-list"
                        value={newRegion} 
                        onChange={(e) => setNewRegion(e.target.value)}
                        placeholder="Ketik nama kabupaten/kota..."
                        style={{ padding: "8px 12px", border: "1px solid var(--accent)", borderRadius: "var(--radius)", fontSize: "12px", outline: "none", minWidth: "200px" }}
                        autoFocus
                      />
                      <datalist id="lampung-regions-list">
                        {lampungRegionOptions.filter((region) => !monitoredRegions.includes(region)).map((region) => <option key={region} value={region} />)}
                      </datalist>
                      <button type="submit" className="btn primary" disabled={!newRegion} style={{ padding: "6px 12px", fontSize: "12px", minHeight: "32px" }}>Tambah</button>
                      <button type="button" onClick={() => setShowAddForm(false)} className="btn secondary" style={{ padding: "6px 12px", fontSize: "12px", minHeight: "32px" }}>Batal</button>
                    </form>
                  ) : (
                  <button 
                    onClick={() => setShowAddForm(true)}
                    style={{ background: "none", border: "1px dashed var(--line)", borderRadius: 8, padding: "6px 12px", fontSize: "12px", fontWeight: 500, color: "var(--ink-soft)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s" }}
                    onMouseOver={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.color = "var(--ink-soft)"; e.currentTarget.style.borderColor = "var(--line)"; }}
                  >
                    <Icon name="add" style={{ fontSize: "14px" }} /> Tambah Area Pantau
                  </button>
                )}
              </div>
            </motion.div>

          </div>
        </div>

        {/* Action Buttons */}
        <motion.div variants={itemVariants} style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "32px", paddingTop: "24px", borderTop: "1px solid var(--line)" }}>
          <button type="button" onClick={fetchSettings} className="btn secondary" style={{ minWidth: "100px" }}>Batal</button>
          <button className="btn primary" onClick={handleSave} disabled={isLoading} style={{ minWidth: "160px" }}>
            <Icon name="save" /> {isLoading ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
