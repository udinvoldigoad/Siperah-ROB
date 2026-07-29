import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { Icon } from "../../shared/components/Icon";
import { useToast } from "../../shared/components/Toast";
import { api, errorMessage } from "../../shared/api/client";
import { motion, AnimatePresence, type Variants } from "framer-motion";

interface NotificationSettings {
  channels: string[];
  event_types: string[];
  monitored_regions: string[];
}

interface NotificationSettingsResponse {
  data: NotificationSettings;
}

const lampungRegionOptions = [
  "Bandar Lampung", "Lampung Selatan", "Pesawaran", "Tanggamus", "Pesisir Barat", "Lampung Timur", "Tulang Bawang"
];

// Nilai channel & event yang valid saat ini. Data lama bisa menyimpan kode usang
// (mis. "push_browser", "whatsapp", "event_bahaya") yang kini ditolak backend —
// dinormalisasi & disaring saat dimuat agar UI konsisten & simpan tak gagal.
const VALID_CHANNELS = ["browser", "email"];
const VALID_EVENTS = ["bahaya_sangat_tinggi", "laporan_ground_truth", "pembaruan_model", "ringkasan_harian", "peringatan_bmkg"];
const CHANNEL_ALIASES: Record<string, string> = { push_browser: "browser" };
const EVENT_ALIASES: Record<string, string> = {
  event_bahaya: "bahaya_sangat_tinggi",
  event_laporan: "laporan_ground_truth",
  event_pasang_ekstrem: "peringatan_bmkg",
};

function sanitize(values: string[] | undefined, aliases: Record<string, string>, valid: string[]): string[] {
  const mapped = (values ?? []).map((v) => aliases[v] ?? v).filter((v) => valid.includes(v));
  return Array.from(new Set(mapped));
}

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
  const [monitoredRegions, setMonitoredRegions] = useState<string[]>([]);
  const [newRegion, setNewRegion] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await api<NotificationSettingsResponse>("/notifications/settings");
      const data = res.data;
      setChannels(sanitize(data.channels, CHANNEL_ALIASES, VALID_CHANNELS));
      setEventTypes(sanitize(data.event_types, EVENT_ALIASES, VALID_EVENTS));
      setMonitoredRegions(data.monitored_regions || []);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Gagal memuat pengaturan notifikasi."));
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

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
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Gagal mengaktifkan push notifikasi browser.'));
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
          monitored_regions: monitoredRegions,
        }),
      });
      toast.success("Pengaturan notifikasi berhasil disimpan!");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Gagal menyimpan pengaturan."));
    } finally {
      setIsLoading(false);
    }
  };

  const channelOptions = [
    { id: "browser", icon: "notifications", title: "Push Notifikasi Browser", desc: "Notifikasi real-time di desktop & mobile" },
    { id: "email", icon: "mail", title: "Email Instansi", desc: "Pesan dikirim ke alamat email Anda" },
  ];
  // Hanya peristiwa yang BENAR-BENAR punya pengirim di backend. Tiga opsi lama
  // (pembaruan_model, ringkasan_harian, peringatan_bmkg) tidak pernah dikirim
  // oleh sistem — menawarkannya menjanjikan notifikasi yang tak akan datang.
  const eventOptions = [
    { id: "bahaya_sangat_tinggi", title: "Peringatan bahaya Sangat Tinggi", desc: "Wilayah pantau mencapai kelas Sangat Tinggi" },
    { id: "laporan_ground_truth", title: "Laporan warga (Ground Truth)", desc: "Ada laporan kerusakan baru dari relawan/warga" },
  ];

  return (
    <AppShell active="settings" title="Pengaturan Notifikasi" subtitle="Atur saluran peringatan dini dan laporan ground truth yang ingin Anda terima.">
      <style>{`
        .ns-stack { display: flex; flex-direction: column; gap: 18px; max-width: 680px; margin: 0 auto; }
        .ns-card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
        .ns-head { display: flex; align-items: center; gap: 13px; padding: 18px 22px; }
        .ns-head.divider { border-bottom: 1px solid var(--line); }
        .ns-ico { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; background: var(--surface-soft); border: 1px solid var(--line); flex-shrink: 0; }
        .ns-head h3 { font-size: 15px; font-weight: 700; margin: 0; color: var(--ink); line-height: 1.25; }
        .ns-head p { font-size: 12.5px; color: var(--ink-soft); margin: 3px 0 0; line-height: 1.45; }
        .ns-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 15px 22px; transition: background .15s; cursor: pointer; }
        .ns-row:hover { background: var(--surface-soft); }
        .ns-row + .ns-row { border-top: 1px solid var(--line); }
        .ns-row-title { font-size: 14px; font-weight: 600; color: var(--ink); }
        .ns-row-desc { font-size: 12px; color: var(--ink-soft); margin-top: 3px; line-height: 1.4; }
        .ns-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
        .ns-switch { position: relative; width: 42px; height: 24px; flex-shrink: 0; margin: 0; }
        .ns-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
        .ns-track { position: absolute; inset: 0; background: var(--line); border-radius: 999px; transition: .25s; }
        .ns-track::after { content: ""; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: .25s; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
        .ns-switch input:checked + .ns-track { background: var(--accent); }
        .ns-switch input:checked + .ns-track::after { transform: translateX(18px); }
        .ns-check { width: 20px; height: 20px; accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
        .ns-pad { padding: 20px 22px; }
        .ns-chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        /* --accent, bukan --brand: --brand-soft tak pernah didefinisikan (latar
           chip jadi transparan) dan --brand hitam tanpa override tema, sehingga
           chip ini tak terbaca di mode gelap. */
        .ns-chip { background: var(--accent-soft); border: 1px solid var(--accent); border-radius: 999px; padding: 6px 6px 6px 12px; font-size: 12px; font-weight: 600; color: var(--accent); display: flex; align-items: center; gap: 4px; }
        .ns-chip button { background: transparent; border: none; color: var(--accent); cursor: pointer; display: flex; padding: 0; opacity: .65; transition: opacity .15s; }
        .ns-chip button:hover { opacity: 1; }
        .ns-add { background: none; border: 1px dashed var(--line); border-radius: 999px; padding: 7px 14px; font-size: 12px; font-weight: 500; color: var(--ink-soft); cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all .2s; }
        .ns-add:hover { color: var(--accent); border-color: var(--accent); }
        .ns-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 4px; }
        @media (max-width: 560px) { .ns-actions { flex-direction: column-reverse; } .ns-actions .btn { width: 100%; } }
      `}</style>
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="content" style={{ paddingBottom: 60 }}>
        <div className="ns-stack">

          {/* Saluran Komunikasi */}
          <motion.section variants={itemVariants} className="ns-card">
            <div className="ns-head divider">
              <div className="ns-ico"><Icon name="cell_tower" style={{ fontSize: 20, color: "var(--accent)" }} /></div>
              <div>
                <h3>Saluran Komunikasi</h3>
                <p>Pilih media pengiriman notifikasi ke perangkat Anda.</p>
              </div>
            </div>
            {channelOptions.map((ch) => (
              <label key={ch.id} className="ns-row">
                <span className="ns-left">
                  <span className="ns-ico"><Icon name={ch.icon} style={{ fontSize: 19, color: "var(--ink-soft)" }} /></span>
                  <span>
                    <span className="ns-row-title" style={{ display: "block" }}>{ch.title}</span>
                    <span className="ns-row-desc" style={{ display: "block" }}>{ch.desc}</span>
                  </span>
                </span>
                <span className="ns-switch">
                  <input type="checkbox" checked={channels.includes(ch.id)} onChange={() => toggleChannel(ch.id)} />
                  <span className="ns-track" />
                </span>
              </label>
            ))}
          </motion.section>

          {/* Berlangganan Peristiwa */}
          <motion.section variants={itemVariants} className="ns-card">
            <div className="ns-head divider">
              {/* --success tak pernah ada di tokens.css; emerald yang tersedia adalah --low. */}
              <div className="ns-ico"><Icon name="checklist" style={{ fontSize: 20, color: "var(--low)" }} /></div>
              <div>
                <h3>Berlangganan Peristiwa</h3>
                <p>Jenis peringatan & pembaruan yang ingin Anda ikuti.</p>
              </div>
            </div>
            {eventOptions.map((event) => (
              <label key={event.id} className="ns-row">
                <span style={{ minWidth: 0 }}>
                  <span className="ns-row-title" style={{ display: "block" }}>{event.title}</span>
                  <span className="ns-row-desc" style={{ display: "block" }}>{event.desc}</span>
                </span>
                <input type="checkbox" className="ns-check" checked={eventTypes.includes(event.id)} onChange={() => toggleEventType(event.id)} />
              </label>
            ))}
          </motion.section>

          {/* Wilayah Pantau */}
          <motion.section variants={itemVariants} className="ns-card">
            <div className="ns-head">
              <div className="ns-ico"><Icon name="my_location" style={{ fontSize: 20, color: "var(--accent)" }} /></div>
              <div>
                <h3>Wilayah Pantau</h3>
                <p>Batasi notifikasi ke wilayah tertentu. Kosongkan untuk seluruh Provinsi.</p>
              </div>
            </div>
            <div className="ns-pad" style={{ paddingTop: 4 }}>
              <div className="ns-chips">
                <AnimatePresence>
                  {monitoredRegions.map((region) => (
                    <motion.span
                      key={region}
                      className="ns-chip"
                      initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                    >
                      {region}
                      <button type="button" onClick={() => handleRemoveRegion(region)} aria-label={`Hapus ${region}`}>
                        <Icon name="close" style={{ fontSize: 14 }} />
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>

                {showAddForm ? (
                  <form onSubmit={handleAddRegion} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      list="lampung-regions-list"
                      value={newRegion}
                      onChange={(e) => setNewRegion(e.target.value)}
                      placeholder="Ketik nama kabupaten/kota..."
                      style={{ padding: "8px 12px", border: "1px solid var(--accent)", borderRadius: "var(--radius)", fontSize: 12, outline: "none", minWidth: 200, background: "var(--surface)", color: "var(--ink)" }}
                      autoFocus
                    />
                    <datalist id="lampung-regions-list">
                      {lampungRegionOptions.filter((region) => !monitoredRegions.includes(region)).map((region) => <option key={region} value={region} />)}
                    </datalist>
                    <button type="submit" className="btn primary" disabled={!newRegion} style={{ padding: "6px 12px", fontSize: 12, minHeight: 32 }}>Tambah</button>
                    <button type="button" onClick={() => setShowAddForm(false)} className="btn secondary" style={{ padding: "6px 12px", fontSize: 12, minHeight: 32 }}>Batal</button>
                  </form>
                ) : (
                  <button type="button" className="ns-add" onClick={() => setShowAddForm(true)}>
                    <Icon name="add" style={{ fontSize: 14 }} /> Tambah Area Pantau
                  </button>
                )}
              </div>
            </div>
          </motion.section>

          {/* Aksi */}
          <motion.div variants={itemVariants} className="ns-actions">
            <button type="button" onClick={fetchSettings} className="btn secondary" style={{ minWidth: 100 }}>Batal</button>
            <button className="btn primary" onClick={handleSave} disabled={isLoading} data-loading={isLoading || undefined} style={{ minWidth: 160 }}>
              <Icon name="save" /> {isLoading ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </motion.div>
        </div>
      </motion.div>
    </AppShell>
  );
}
