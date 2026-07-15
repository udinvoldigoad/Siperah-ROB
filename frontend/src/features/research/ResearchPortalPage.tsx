import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { api, apiUrl } from "../../shared/api/client";
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
  coverage_regencies: string[] | null;
}

interface ApiKeyData {
  id: string;
  key_prefix: string;
  status: string;
  created_at: string;
}

interface DatasetResponse {
  data: DatasetData[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    available_regencies?: string[];
  };
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

interface EndpointUsage {
  endpoint: string;
  total: number;
  success: number;
  failed: number;
}

interface DayUsage {
  day: string;
  total: number;
  failed: number;
}

interface UsageResponse {
  data: {
    window_days: number;
    since: string;
    total_calls: number;
    per_endpoint: EndpointUsage[];
    per_day: DayUsage[];
  };
}

interface ApiEndpointDoc {
  method: string;
  path: string;
  description: string;
  scope: string;
  query: Record<string, string>;
  example_request?: string;
  example_response?: unknown;
}

interface ApiReferenceResponse {
  data: {
    base_path: string;
    authentication: { header: string; alternative: string };
    rate_limit?: { per_minute: number; scope: string; headers: string[]; note: string };
    error_format?: { shape: Record<string, unknown>; codes: Record<string, string> };
    endpoints: ApiEndpointDoc[];
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
  const [usage, setUsage] = useState<UsageResponse["data"] | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [datasetFilters, setDatasetFilters] = useState({ year: "", type: "", search: "", regency: "" });
  const [datasetPage, setDatasetPage] = useState(1);
  const [datasetMeta, setDatasetMeta] = useState<DatasetResponse["meta"] | null>(null);
  const [availableRegencies, setAvailableRegencies] = useState<string[]>([]);

  const datasetDownloadUrl = (dataset: DatasetData, format: "csv" | "json" | "xlsx") => (
    apiUrl(`/api/research/datasets/${dataset.id}/download?format=${format}`)
  );

  const handleDatasetDownload = async (dataset: DatasetData, format: "csv" | "json" | "xlsx") => {
    try {
      const token = localStorage.getItem("siperah-token");
      const response = await fetch(datasetDownloadUrl(dataset, format), {
        headers: {
          Accept: format === "csv" ? "text/csv" : format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error(`Download gagal (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${dataset.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(`Dataset ${format.toUpperCase()} mulai diunduh.`);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunduh dataset.");
    }
  };

  const loadResearchData = async (page = datasetPage) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ per_page: "10", page: String(page) });
      if (datasetFilters.year) params.set("year", datasetFilters.year);
      if (datasetFilters.type) params.set("type", datasetFilters.type);
      if (datasetFilters.regency) params.set("regency", datasetFilters.regency);
      if (datasetFilters.search.trim()) params.set("search", datasetFilters.search.trim());

      const dsRes = await api<DatasetResponse>(`/research/datasets?${params.toString()}`);
      setDatasets(dsRes.data);
      setDatasetMeta(dsRes.meta ?? null);
      if (dsRes.meta?.available_regencies) setAvailableRegencies(dsRes.meta.available_regencies);

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

  const loadUsage = async () => {
    if (!isResearcher) return;
    setUsageLoading(true);
    try {
      const res = await api<UsageResponse>("/research/usage");
      setUsage(res.data);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat statistik penggunaan API.");
    } finally {
      setUsageLoading(false);
    }
  };

  // Muat statistik penggunaan saat tab "Penggunaan API" dibuka pertama kali.
  useEffect(() => {
    if (activeTab === 2 && isResearcher && !usage && !usageLoading) {
      loadUsage();
    }
  }, [activeTab]);

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
  const availableYears = ["2026", "2025", "2024", "2023", "2022", "2021", "2020"];
  const availableTypes = Array.from(new Set(datasets.map((item) => item.dataset_type))).sort();
  const applyDatasetFilters = () => {
    setDatasetPage(1);
    loadResearchData(1);
  };
  const changeDatasetPage = (nextPage: number) => {
    if (datasetMeta && (nextPage < 1 || nextPage > datasetMeta.last_page)) return;
    setDatasetPage(nextPage);
    loadResearchData(nextPage);
  };

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
        <div className="metric-grid" style={{ marginBottom: "32px", gap: "20px" }}>
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
          {(isResearcher ? ["Arsip Data", "Referensi API", "Penggunaan API", "Lisensi Data"] : ["Arsip Data", "Lisensi Data"]).map((tab, idx) => (
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
                <select value={datasetFilters.year} onChange={(event) => setDatasetFilters((current) => ({ ...current, year: event.target.value }))} style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "var(--surface)", color: "var(--ink)" }}>
                  <option value="">Semua Tahun</option>
                  {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
                <select value={datasetFilters.regency} onChange={(event) => setDatasetFilters((current) => ({ ...current, regency: event.target.value }))} style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "var(--surface)", color: "var(--ink)" }}>
                  <option value="">Semua Kabupaten</option>
                  {availableRegencies.map((regency) => <option key={regency} value={regency}>{regency}</option>)}
                </select>
                <select value={datasetFilters.type} onChange={(event) => setDatasetFilters((current) => ({ ...current, type: event.target.value }))} style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "var(--surface)", color: "var(--ink)" }}>
                  <option value="">Semua Jenis</option>
                  {availableTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <div style={{ flex: 1, position: "relative", minWidth: "200px" }}>
                  <Icon name="search" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "18px", color: "var(--ink-soft)" }} />
                  <input type="text" value={datasetFilters.search} onChange={(event) => setDatasetFilters((current) => ({ ...current, search: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") applyDatasetFilters(); }} placeholder="Cari dataset..." style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", background: "var(--surface)", color: "var(--ink)", boxSizing: "border-box" }} />
                </div>
                <button className="btn secondary" style={{ padding: "10px 16px" }} onClick={applyDatasetFilters}><Icon name="filter_list" style={{ fontSize: "18px" }} /> Filter</button>
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
                            <button type="button" onClick={() => handleDatasetDownload(ds, "csv")} className="btn primary" style={{ fontSize: "11px", padding: "6px 12px", background: "var(--ocean-dark, #0284c7)", color: "#fff", textDecoration: "none", borderRadius: "6px" }}>
                              <Icon name="download" style={{ fontSize: "14px" }} /> CSV
                            </button>
                            <button type="button" onClick={() => handleDatasetDownload(ds, "xlsx")} className="btn primary" style={{ fontSize: "11px", padding: "6px 12px", background: "#15803d", color: "#fff", textDecoration: "none", borderRadius: "6px", border: "1px solid #166534" }}>
                              <Icon name="table_view" style={{ fontSize: "14px" }} /> EXCEL
                            </button>
                            <button type="button" onClick={() => handleDatasetDownload(ds, "json")} className="btn secondary" style={{ fontSize: "11px", padding: "6px 12px", textDecoration: "none", borderRadius: "6px" }}>
                              <Icon name="code" style={{ fontSize: "14px" }} /> JSON
                            </button>
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

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--ink-soft)" }}>
                <div>Menampilkan {datasetMeta?.from ?? (datasets.length ? 1 : 0)}–{datasetMeta?.to ?? datasets.length} dari {datasetMeta?.total ?? datasets.length} dataset</div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button className="btn secondary" style={{ padding: "6px 10px" }} disabled={(datasetMeta?.current_page ?? 1) <= 1} onClick={() => changeDatasetPage((datasetMeta?.current_page ?? 1) - 1)}>‹</button>
                  <button className="btn primary" aria-current="page" style={{ padding: "6px 12px", minWidth: 36, background: "#0284c7", borderColor: "#0369a1", color: "#fff", fontWeight: 700 }}>{datasetMeta?.current_page ?? 1}</button>
                  <button className="btn secondary" style={{ padding: "6px 10px" }} disabled={(datasetMeta?.current_page ?? 1) >= (datasetMeta?.last_page ?? 1)} onClick={() => changeDatasetPage((datasetMeta?.current_page ?? 1) + 1)}>›</button>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "40px" }}>
                {(apiReference?.endpoints ?? []).map((ep, i) => (
                  <div key={i} style={{ padding: "20px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: ep.example_request ? "14px" : 0 }}>
                      <div style={{ background: "#dcfce7", color: "#15803d", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, fontFamily: "monospace" }}>{ep.method}</div>
                      <div>
                        <div style={{ fontFamily: "monospace", fontSize: "13px", color: "var(--ocean-dark, #0284c7)", marginBottom: "6px", fontWeight: 600 }}>{ep.path}</div>
                        <div style={{ fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.5 }}>{ep.description} Scope: <code>{ep.scope}</code></div>
                        {ep.query && Object.keys(ep.query).length > 0 && (
                          <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {Object.entries(ep.query).map(([key, val]) => (
                              <span key={key} style={{ fontSize: "11px", fontFamily: "monospace", background: "var(--surface-muted)", color: "var(--ink)", padding: "2px 8px", borderRadius: "4px" }}>{key}=<span style={{ color: "var(--ink-soft)" }}>{val}</span></span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {ep.example_request && (
                      <details style={{ marginTop: "12px" }}>
                        <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--ocean-dark, #0284c7)" }}>Lihat contoh request &amp; response</summary>
                        <div style={{ marginTop: "10px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", marginBottom: "6px" }}>Request</div>
                          <pre style={{ background: "#0f172a", borderRadius: 6, padding: "14px", color: "#e2e8f0", fontFamily: "monospace", fontSize: "12px", lineHeight: 1.5, overflowX: "auto", margin: 0 }}>{ep.example_request}</pre>
                          {ep.example_response != null && (
                            <>
                              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", margin: "12px 0 6px" }}>Response (200)</div>
                              <pre style={{ background: "#0f172a", borderRadius: 6, padding: "14px", color: "#e2e8f0", fontFamily: "monospace", fontSize: "12px", lineHeight: 1.5, overflowX: "auto", margin: 0 }}>{JSON.stringify(ep.example_response, null, 2)}</pre>
                            </>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>

              {apiReference?.rate_limit && (
                <div style={{ marginBottom: "32px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--ink)" }}>Batas Permintaan (Rate Limit)</div>
                  <div style={{ padding: "16px 20px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.6 }}>
                    <strong style={{ color: "var(--ink)" }}>{apiReference.rate_limit.per_minute} permintaan / menit</strong> ({apiReference.rate_limit.scope}). {apiReference.rate_limit.note}
                    <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {apiReference.rate_limit.headers.map((h) => <code key={h} style={{ fontSize: "11px", background: "var(--surface-muted)", padding: "2px 8px", borderRadius: "4px" }}>{h}</code>)}
                    </div>
                  </div>
                </div>
              )}

              {apiReference?.error_format && (
                <div style={{ marginBottom: "32px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--ink)" }}>Format Error</div>
                  <div style={{ padding: "16px 20px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}>
                    <pre style={{ background: "#0f172a", borderRadius: 6, padding: "12px", color: "#e2e8f0", fontFamily: "monospace", fontSize: "12px", margin: "0 0 12px", overflowX: "auto" }}>{JSON.stringify(apiReference.error_format.shape, null, 2)}</pre>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {Object.entries(apiReference.error_format.codes).map(([code, desc]) => (
                        <div key={code} style={{ fontSize: "13px", color: "var(--ink-soft)" }}><code style={{ fontWeight: 700, color: "var(--critical)" }}>{code}</code> — {desc}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--ink)" }}>Contoh Request</div>
              <div style={{ background: "#0f172a", borderRadius: 8, padding: "20px", color: "#e2e8f0", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.6, overflowX: "auto" }}>
                <span style={{ color: "#93c5fd" }}>curl</span> -H <span style={{ color: "#86efac" }}>"{apiReference?.authentication.header ?? "X-API-Key: spr_xxx"}"</span> \<br />
                &nbsp;&nbsp;<span style={{ color: "#86efac" }}>"{apiReference?.base_path ?? "/api/v1"}/predictions/daily?from=2026-05-21&amp;to=2026-05-21"</span>
              </div>
              {apiReference?.license_note && <p style={{ marginTop: 16, color: "var(--ink-soft)", fontSize: 13 }}>{apiReference.license_note}</p>}
            </motion.div>
          )}

          {/* Tab 2: Penggunaan API (per endpoint, 30 hari terakhir) */}
          {isResearcher && activeTab === 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: "900px" }}>
              {usageLoading && (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--ink-soft)", fontSize: "13px" }}>
                  <Icon name="hourglass_empty" style={{ fontSize: "20px" }} /> Memuat statistik penggunaan…
                </div>
              )}

              {!usageLoading && usage && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "20px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>
                      Total {usage.total_calls.toLocaleString("id-ID")} panggilan API dalam {usage.window_days} hari terakhir
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--ink-soft)" }}>Sejak {usage.since}</div>
                  </div>

                  {/* Tren harian */}
                  <div style={{ padding: "20px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)", marginBottom: "24px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", marginBottom: "16px" }}>Tren Harian</div>
                    {(() => {
                      const maxTotal = Math.max(1, ...usage.per_day.map((d) => d.total));
                      return (
                        <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "120px" }}>
                          {usage.per_day.map((d) => {
                            const h = Math.round((d.total / maxTotal) * 100);
                            const failH = d.total > 0 ? Math.round((d.failed / d.total) * h) : 0;
                            return (
                              <div key={d.day} title={`${d.day}: ${d.total} panggilan (${d.failed} gagal)`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", position: "relative" }}>
                                <div style={{ height: `${h}%`, background: "var(--ocean-light, #bae6fd)", borderRadius: "3px 3px 0 0", display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: d.total > 0 ? "2px" : 0 }}>
                                  {failH > 0 && <div style={{ height: `${failH}%`, background: "var(--critical, #dc2626)", borderRadius: "3px 3px 0 0" }} />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <div style={{ display: "flex", gap: "16px", marginTop: "12px", fontSize: "11px", color: "var(--ink-soft)" }}>
                      <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--ocean-light, #bae6fd)", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />Berhasil</span>
                      <span><span style={{ display: "inline-block", width: 10, height: 10, background: "var(--critical, #dc2626)", borderRadius: 2, marginRight: 4, verticalAlign: "middle" }} />Gagal</span>
                    </div>
                  </div>

                  {/* Per endpoint */}
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", marginBottom: "12px" }}>Penggunaan per Endpoint</div>
                  <div className="panel flush" style={{ overflow: "hidden", border: "1px solid var(--line)" }}>
                    <div className="table-responsive">
                      <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--surface-soft)" }}>
                            <th style={{ padding: "14px 20px", fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)" }}>Endpoint</th>
                            <th style={{ padding: "14px 20px", fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)", textAlign: "right" }}>Total</th>
                            <th style={{ padding: "14px 20px", fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)", textAlign: "right" }}>Berhasil</th>
                            <th style={{ padding: "14px 20px", fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)", textAlign: "right" }}>Gagal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usage.per_endpoint.map((row, i) => (
                            <tr key={row.endpoint} style={{ borderBottom: i === usage.per_endpoint.length - 1 ? "none" : "1px solid var(--line)" }}>
                              <td style={{ padding: "14px 20px", fontSize: "13px", fontFamily: "monospace", color: "var(--ocean-dark, #0284c7)" }}>{row.endpoint}</td>
                              <td style={{ padding: "14px 20px", fontSize: "13px", color: "var(--ink)", textAlign: "right", fontWeight: 600 }}>{row.total.toLocaleString("id-ID")}</td>
                              <td style={{ padding: "14px 20px", fontSize: "13px", color: "var(--ink)", textAlign: "right" }}>{row.success.toLocaleString("id-ID")}</td>
                              <td style={{ padding: "14px 20px", fontSize: "13px", textAlign: "right", color: row.failed > 0 ? "var(--critical, #dc2626)" : "var(--ink-soft)", fontWeight: row.failed > 0 ? 600 : 400 }}>{row.failed.toLocaleString("id-ID")}</td>
                            </tr>
                          ))}
                          {usage.per_endpoint.length === 0 && (
                            <tr><td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "var(--ink-soft)" }}>Belum ada panggilan API tercatat dalam 30 hari terakhir.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {!usageLoading && !usage && (
                <div className="alert info"><Icon name="info" /> Statistik penggunaan belum tersedia.</div>
              )}
            </motion.div>
          )}

          {/* Tab Lisensi Data — tab terpisah (peneliti: idx 3, non-peneliti: idx 1) */}
          {((isResearcher && activeTab === 3) || (!isResearcher && activeTab === 1)) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: "900px" }}>
              <div style={{ marginBottom: "20px", fontSize: "13px", color: "var(--ink-soft)", lineHeight: 1.6 }}>
                Ketentuan lisensi dan perizinan untuk setiap dataset yang tersedia di portal. Pastikan mencantumkan atribusi sesuai lisensi ketika menggunakan atau menerbitkan ulang data.
              </div>

              {(() => {
                const groups = datasets.reduce<Record<string, DatasetData[]>>((acc, ds) => {
                  const key = (ds.license && ds.license.trim()) || "Lisensi tidak dicantumkan";
                  (acc[key] ||= []).push(ds);
                  return acc;
                }, {});
                const entries = Object.entries(groups);

                if (entries.length === 0) {
                  return <div className="alert info"><Icon name="info" /> Belum ada dataset untuk ditampilkan lisensinya.</div>;
                }

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {entries.map(([license, items]) => (
                      <div key={license} style={{ padding: "20px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surface)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                          <Icon name="gavel" style={{ fontSize: "18px", color: "var(--ocean-dark, #0284c7)" }} />
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink)" }}>{license}</div>
                          <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>({items.length} dataset)</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {items.map((ds) => (
                            <div key={ds.id} style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "13px", padding: "6px 0", borderTop: "1px solid var(--line)" }}>
                              <div style={{ color: "var(--ink)", fontWeight: 500 }}>{ds.name}</div>
                              <div style={{ color: "var(--ink-soft)", fontSize: "12px", whiteSpace: "nowrap" }}>
                                {(ds.coverage_regencies && ds.coverage_regencies.length > 0) ? ds.coverage_regencies.join(", ") : "Cakupan provinsi"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <p style={{ marginTop: "20px", fontSize: "12px", color: "var(--ink-soft)", lineHeight: 1.6 }}>
                Data mentah (pasang surut, batas wilayah) mengikuti ketentuan sumber resmi seperti BIG/BMKG. Dataset turunan yang dihasilkan sistem mengikuti lisensi yang tercantum di atas.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
