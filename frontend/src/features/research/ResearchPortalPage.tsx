import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { api } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";
import { motion, AnimatePresence } from "framer-motion";

interface DatasetData {
  id: string;
  name: string;
  description: string;
  dataset_type: string;
  period_start: string;
  period_end: string;
  resolution: string;
  record_count: number;
  license: string;
  csv_url: string;
  json_url: string;
}

interface ApiKeyData {
  id: string;
  key_prefix: string;
  status: string;
  created_at: string;
}

interface DatasetResponse {
  data: DatasetData[];
}

interface ApiKeyResponse {
  data: ApiKeyData[];
}

interface RegenerateKeyResponse {
  message: string;
  raw_key: string;
}

interface ResearchStats {
  dataset_count: number;
  total_records: number;
  downloads_this_month: number;
  api_calls_today: number;
  active_api_keys: number;
}

interface ResearchStatsResponse { data: ResearchStats; }

interface ApiReferenceResponse {
  data: {
    base_path: string;
    authentication: { header: string; alternative: string };
    endpoints: { method: string; path: string; description: string; scope: string; query: Record<string, string> }[];
    license_note: string;
  };
}

export function ResearchPortalPage() {
  const toast = useToast();
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem("siperah-user") || "null") as { role?: string } | null; } catch { return null; } })();
  const isResearcher = currentUser?.role === "peneliti";
  const [datasets, setDatasets] = useState<DatasetData[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([]);
  const [rawGeneratedKey, setRawGeneratedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [stats, setStats] = useState<ResearchStats>({ dataset_count: 0, total_records: 0, downloads_this_month: 0, api_calls_today: 0, active_api_keys: 0 });
  const [apiReference, setApiReference] = useState<ApiReferenceResponse["data"] | null>(null);

  const loadResearchData = async () => {
    setIsLoading(true);
    try {
      const dsRes = await api<DatasetResponse>("/research/datasets");
      setDatasets(dsRes.data);

      if (isResearcher) {
        const [keysRes, statsRes, refRes] = await Promise.all([
          api<ApiKeyResponse>("/research/api-keys"),
          api<ResearchStatsResponse>("/research/stats"),
          api<ApiReferenceResponse>("/research/api-reference"),
        ]);
        setApiKeys(keysRes.data);
        setStats(statsRes.data);
        setApiReference(refRes.data);
      } else {
        setStats((current) => ({ ...current, dataset_count: dsRes.data.length, total_records: dsRes.data.reduce((sum, item) => sum + Number(item.record_count ?? 0), 0) }));
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat portal penelitian.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadResearchData();
  }, []);

  const handleRegenerateKey = async () => {
    try {
      const res = await api<RegenerateKeyResponse>("/research/api-keys", {
        method: "POST",
      });
      setRawGeneratedKey(res.raw_key);
      toast.success("API key baru berhasil dibuat! Segera salin kunci Anda.");
      
      const keysRes = await api<ApiKeyResponse>("/research/api-keys");
      setApiKeys(keysRes.data);
    } catch (err: any) {
      toast.error(err.message || "Gagal meregenerasi API key.");
    }
  };

  const activeKey = apiKeys.find((k) => k.status === "aktif");

  return (
    <AppShell active="research" title={isResearcher ? "Arsip & API Peneliti" : "Arsip Data Provinsi"}>
      <div className="content" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 80px" }}>
        
        {/* API Key Management Header row */}
        {isResearcher && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", background: "var(--surface)", padding: "16px 24px", borderRadius: "var(--radius)", border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--ocean-light, #e0f2fe)", color: "var(--ocean-dark, #0284c7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="vpn_key" style={{ fontSize: "20px" }} />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>Kredensial API Aktif</div>
              {rawGeneratedKey ? (
                <div style={{ fontSize: "13px", color: "var(--ink-soft)", fontFamily: "monospace", marginTop: "2px" }}>{rawGeneratedKey} (Salin sekarang!)</div>
              ) : activeKey ? (
                <div style={{ fontSize: "13px", color: "var(--ink-soft)", fontFamily: "monospace", marginTop: "2px" }}>{activeKey.key_prefix}****************</div>
              ) : (
                <div style={{ fontSize: "13px", color: "var(--critical)", marginTop: "2px" }}>Belum ada kunci API.</div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn secondary" style={{ fontSize: "12px", padding: "8px 16px" }} onClick={() => {
              if (rawGeneratedKey) navigator.clipboard.writeText(rawGeneratedKey);
              toast.success("Tersalin ke clipboard!");
            }}>
              <Icon name="content_copy" style={{ fontSize: "16px" }} /> Salin
            </button>
            <button className="btn outline" style={{ fontSize: "12px", padding: "8px 16px", color: "var(--critical)", borderColor: "var(--critical)" }} onClick={handleRegenerateKey}>
              <Icon name="refresh" style={{ fontSize: "16px" }} /> Regenerasi
            </button>
          </div>
        </div>}

        {/* KPI Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px", marginBottom: "32px" }}>
          {[
            { title: "Dataset Tersedia", val: stats.dataset_count || datasets.length, sub: "set data tervalidasi" },
            { title: "Total Rekaman", val: stats.total_records.toLocaleString("id-ID"), sub: "baris data terdokumentasi" },
            { title: "Unduhan Bulan Ini", val: stats.downloads_this_month.toLocaleString("id-ID"), sub: "request ekspor/API" },
            { title: "API Call Tercatat", val: stats.api_calls_today.toLocaleString("id-ID"), sub: `${stats.active_api_keys} kunci aktif` }
          ].map((kpi, i) => (
            <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--ink-soft)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.02em" }}>{kpi.title}</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--ink)", margin: "8px 0" }}>{kpi.val}</div>
              <div style={{ fontSize: "12px", color: "var(--ink-soft)" }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs Navigation */}
        <div style={{ display: "flex", gap: "24px", borderBottom: "2px solid var(--line)", marginBottom: "32px" }}>
          {(isResearcher ? ["Arsip Data", "Referensi API", "Penggunaan API"] : ["Arsip Data"]).map((tab, idx) => (
            <button 
              key={idx}
              onClick={() => setActiveTab(idx)}
              style={{
                padding: "12px 0",
                fontSize: "14px",
                fontWeight: 600,
                color: activeTab === idx ? "var(--ocean-dark, #0284c7)" : "var(--ink-soft)",
                border: "none",
                background: "none",
                cursor: "pointer",
                borderBottom: activeTab === idx ? "2px solid var(--ocean-dark, #0284c7)" : "2px solid transparent",
                marginBottom: "-2px",
                transition: "all 0.2s"
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ minHeight: "400px" }}>
          
          {/* Tab 0: Arsip Data */}
          {activeTab === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* Filters */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
                <select style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "var(--surface)", color: "var(--ink)" }}>
                  <option>Semua Tahun</option><option>2026</option><option>2025</option>
                </select>
                <select style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "var(--surface)", color: "var(--ink)" }}>
                  <option>Semua Kabupaten</option><option>Bandar Lampung</option>
                </select>
                <select style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "var(--surface)", color: "var(--ink)" }}>
                  <option>Semua Jenis</option><option>Prediksi</option><option>Ground Truth</option>
                </select>
                <div style={{ flex: 1, position: "relative", minWidth: "200px" }}>
                  <Icon name="search" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "18px", color: "var(--ink-soft)" }} />
                  <input type="text" placeholder="Cari dataset..." style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "var(--surface)", color: "var(--ink)", boxSizing: "border-box" }} />
                </div>
                <button className="btn secondary" style={{ padding: "10px 16px" }}><Icon name="filter_list" style={{ fontSize: "18px" }} /> Filter</button>
              </div>

              {/* Table */}
              <div className="panel flush" style={{ overflow: "hidden", border: "1px solid var(--line)", marginBottom: "24px" }}>
              <div className="table-responsive">
                <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--surface-soft)" }}>
                      <th style={{ padding: "16px 20px", fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)" }}>Dataset</th>
                      <th style={{ padding: "16px 20px", fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)" }}>Jenis</th>
                      <th style={{ padding: "16px 20px", fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)" }}>Periode</th>
                      <th style={{ padding: "16px 20px", fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)" }}>Resolusi</th>
                      <th style={{ padding: "16px 20px", fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)", textAlign: "right" }}>Rekaman</th>
                      <th style={{ padding: "16px 20px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {datasets.map((ds, i) => (
                      <tr key={ds.id} style={{ borderBottom: i === datasets.length - 1 ? "none" : "1px solid var(--line)" }}>
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink)" }}>{ds.name}</div>
                          <div style={{ fontSize: "12px", color: "var(--ink-soft)", marginTop: "4px" }}>{ds.description}</div>
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <span style={{ display: "inline-block", background: "var(--surface-muted)", padding: "4px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 600, color: "var(--ink)" }}>{ds.dataset_type}</span>
                        </td>
                        <td style={{ padding: "16px 20px", fontSize: "13px", color: "var(--ink)" }}>
                          {ds.period_start} — {ds.period_end}
                        </td>
                        <td style={{ padding: "16px 20px", fontSize: "13px", color: "var(--ink)" }}>{ds.resolution}</td>
                        <td style={{ padding: "16px 20px", fontSize: "13px", color: "var(--ink)", textAlign: "right", fontWeight: 500 }}>
                          {ds.record_count.toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: "16px 20px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <a href={`http://127.0.0.1:8000${ds.csv_url}`} className="btn primary" style={{ fontSize: "11px", padding: "6px 12px", background: "var(--ocean-dark, #0284c7)", color: "#fff", textDecoration: "none", borderRadius: "6px" }} download>
                              <Icon name="download" style={{ fontSize: "14px" }} /> CSV
                            </a>
                            <a href={`http://127.0.0.1:8000${ds.json_url}`} className="btn secondary" style={{ fontSize: "11px", padding: "6px 12px", textDecoration: "none", borderRadius: "6px" }} download>
                              <Icon name="code" style={{ fontSize: "14px" }} /> JSON
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {datasets.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--ink-soft)" }}>Tidak ada dataset ditemukan.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </div>

              {/* Pagination (Mock) */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--ink-soft)" }}>
                <div>Menampilkan 1–{datasets.length} dari {datasets.length} dataset</div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button className="btn secondary" style={{ padding: "6px 10px" }} disabled>‹</button>
                  <button className="btn primary" aria-current="page" style={{ padding: "6px 12px", minWidth: 36, background: "#0284c7", borderColor: "#0369a1", color: "#fff", fontWeight: 700 }}>1</button>
                  <button className="btn secondary" style={{ padding: "6px 10px" }}>›</button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tab 1: API Reference */}
          {isResearcher && activeTab === 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: "800px" }}>
              <div style={{ marginBottom: "32px" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px", color: "var(--ink)" }}>Base URL</div>
                <div style={{ background: "#0f172a", borderRadius: "8px", padding: "16px", color: "#e2e8f0", fontFamily: "monospace", fontSize: "13px" }}>
                  {apiReference?.base_path ?? "/api/v1"}
                </div>
              </div>

              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "16px", color: "var(--ink)" }}>Endpoint Tersedia</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "40px" }}>
                {(apiReference?.endpoints ?? []).map((ep, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "16px", padding: "20px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}>
                    <div style={{ background: "#dcfce7", color: "#15803d", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, fontFamily: "monospace" }}>{ep.method}</div>
                    <div>
                      <div style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--ocean-dark, #0284c7)", marginBottom: "6px", fontWeight: 600 }}>{ep.path}</div>
                      <div style={{ fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.5 }}>{ep.description} Scope: <code>{ep.scope}</code></div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--ink)" }}>Contoh Request</div>
              <div style={{ background: "#0f172a", borderRadius: 8, padding: "20px", color: "#e2e8f0", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.6, overflowX: "auto" }}>
                <span style={{ color: "#93c5fd" }}>curl</span> -H <span style={{ color: "#86efac" }}>"{apiReference?.authentication.header ?? "X-API-Key: spr_xxx"}"</span> \<br />
                &nbsp;&nbsp;<span style={{ color: "#86efac" }}>"{apiReference?.base_path ?? "/api/v1"}/predictions/daily?from=2026-05-21&amp;to=2026-05-21"</span>
              </div>
              {apiReference?.license_note && <p style={{ marginTop: 16, color: "var(--ink-soft)", fontSize: 13 }}>{apiReference.license_note}</p>}
            </motion.div>
          )}

          {/* Tab 2 & 3 */}
          {isResearcher && activeTab === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="alert info">
              <Icon name="info" /> Grafik penggunaan API akan ditampilkan di sini. Menampilkan metrik per endpoint untuk 30 hari terakhir.
            </motion.div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
