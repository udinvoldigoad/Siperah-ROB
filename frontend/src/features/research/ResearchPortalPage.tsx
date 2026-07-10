import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { MetricCard } from "../../shared/components/MetricCard";
import { api } from "../../shared/api/client";
import { useToast } from "../../shared/components/Toast";
import { Icon } from "../../shared/components/Icon";

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

const endpoints = [
  ["GET", "/api/v1/predictions/daily", "Prediksi harian spasial per kelurahan pesisir"],
  ["GET", "/api/v1/reports", "Laporan ground truth warga pesisir yang tervalidasi"],
  ["GET", "/api/v1/tidal", "Data pasang surut real-time stasiun BMKG Panjang"],
];

export function ResearchPortalPage() {
  const toast = useToast();
  const [datasets, setDatasets] = useState<DatasetData[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([]);
  const [rawGeneratedKey, setRawGeneratedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadResearchData = async () => {
    setIsLoading(true);
    try {
      const dsRes = await api<DatasetResponse>("/research/datasets");
      setDatasets(dsRes.data);

      const keysRes = await api<ApiKeyResponse>("/research/api-keys");
      setApiKeys(keysRes.data);
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
    <AppShell active="research" title="Portal Penelitian & API" subtitle="Akses data terverifikasi untuk riset akademis, pemodelan spasial, dan integrasi API.">
      <div className="stack" style={{ gap: "40px", padding: "12px 0" }}>
        
        {/* Metric Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px" }}>
          <MetricCard metric={{ label: "Dataset Terbuka", value: String(datasets.length), note: "Format CSV & JSON siap unduh" }} />
          <MetricCard metric={{ label: "Endpoint API", value: String(endpoints.length), note: "Terintegrasi sistem" }} />
          <MetricCard metric={{ label: "Total Record Data", value: "53.764", note: "Entri pasang dan mitigasi" }} />
          <MetricCard metric={{ label: "Status Kunci API", value: activeKey ? "Aktif" : "Nonaktif", note: activeKey ? "Siap digunakan" : "Belum digenerasi", tone: activeKey ? "success" : "neutral" }} />
        </div>

        {/* API Key Panel - Redesigned to look like a high-end console */}
        <section 
          className="panel" 
          style={{ 
            padding: "36px", 
            borderRadius: "20px", 
            background: "var(--surface)", 
            border: "1px solid var(--line)", 
            boxShadow: "0 12px 40px rgba(18, 19, 20, 0.02)",
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "20px", marginBottom: "28px" }}>
            <div style={{ maxWidth: "600px" }}>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>Kredensial API Akses Penelitian</h2>
              <p style={{ fontSize: "0.92rem", color: "var(--ink-soft)", margin: "6px 0 0 0", lineHeight: 1.5 }}>Gunakan kunci ini untuk mengambil data secara dinamis ke dalam skrip Python, R, atau aplikasi pihak ketiga.</p>
            </div>
            <button 
              className="btn primary" 
              type="button" 
              onClick={handleRegenerateKey}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", borderRadius: "100px", padding: "12px 28px", fontSize: "0.9rem", fontWeight: 700 }}
            >
              <Icon name="refresh" /> Regenerasi Key
            </button>
          </div>

          {/* Console Mock Visualizer */}
          <div 
            style={{ 
              background: "#121314", 
              borderRadius: "16px", 
              padding: "24px", 
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)", 
              fontFamily: "monospace",
              position: "relative",
              overflow: "hidden"
            }}
          >
            {/* Terminal Top Window Dots */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#FF5F56" }}></span>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#FFBD2E" }}></span>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#27C93F" }}></span>
            </div>

            {rawGeneratedKey ? (
              <div style={{ animation: "bounce-in 0.3s ease" }}>
                <div style={{ color: "#E6E4DF", fontSize: "0.85rem", opacity: 0.5, marginBottom: "8px" }}># SALIN KUNCI API ANDA SEKARANG (HANYA DITAMPILKAN SEKALI)</div>
                <code style={{ fontSize: "1.15rem", fontWeight: 800, color: "#38BDF8", wordBreak: "break-all", display: "block", background: "rgba(255,255,255,0.04)", padding: "14px", borderRadius: "8px", border: "1px dashed rgba(56, 189, 248, 0.4)" }}>
                  {rawGeneratedKey}
                </code>
              </div>
            ) : activeKey ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
                <div>
                  <div style={{ color: "#E6E4DF", fontSize: "0.85rem", opacity: 0.5, marginBottom: "6px" }}># KUNCI API AKTIF SAAT INI</div>
                  <code style={{ fontSize: "1.1rem", fontWeight: 800, color: "#4ADE80", letterSpacing: "1px" }}>
                    {activeKey.key_prefix}
                  </code>
                </div>
                <div style={{ fontSize: "0.82rem", color: "#94A3B8" }}>
                  Dibuat pada {new Date(activeKey.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
            ) : (
              <div style={{ color: "#94A3B8", textAlign: "center", padding: "20px 0", fontSize: "0.9rem" }}>
                # BELUM ADA KUNCI API AKTIF. SILAKAN KLIK REGENERASI KEY.
              </div>
            )}
          </div>
        </section>

        {/* Dataset Table Panel - Borderless editorial catalog */}
        <section 
          className="panel" 
          style={{ 
            padding: "36px", 
            borderRadius: "20px", 
            background: "var(--surface)", 
            border: "1px solid var(--line)", 
            boxShadow: "0 12px 40px rgba(18, 19, 20, 0.02)"
          }}
        >
          <div style={{ marginBottom: "28px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>Katalog Dataset Pesisir Lampung</h2>
            <p style={{ fontSize: "0.92rem", color: "var(--ink-soft)", margin: "6px 0 0 0", lineHeight: 1.5 }}>Unduh data mentah historis atau gunakan format JSON untuk melakukan analisis kebencanaan spasial.</p>
          </div>

          <div style={{ overflowX: "auto" }}>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "64px 0", color: "var(--ink-soft)" }}>
                <Icon name="progress_activity" style={{ animation: "spin 1s linear infinite", fontSize: "2.2rem", marginBottom: "12px", color: "var(--accent)" }} />
                <div>Memuat katalog dataset penelitian...</div>
              </div>
            ) : (
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 840 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)", fontSize: "0.88rem", fontWeight: 800, color: "var(--ink-soft)" }}>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Nama Dataset</th>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Rentang Waktu</th>
                    <th style={{ textAlign: "left", padding: "14px 16px" }}>Resolusi</th>
                    <th style={{ textAlign: "right", padding: "14px 16px" }}>Baris Data</th>
                    <th style={{ textAlign: "left", padding: "14px 24px" }}>Lisensi Penggunaan</th>
                    <th style={{ textAlign: "right", padding: "14px 16px" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((ds) => (
                    <tr 
                      key={ds.id} 
                      style={{ 
                        borderBottom: "1px solid var(--line)", 
                        transition: "background 0.2s ease" 
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: "20px 16px" }}>
                        <strong style={{ display: "block", color: "var(--ink)", fontSize: "1rem", fontWeight: 700 }}>{ds.name}</strong>
                        <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)", marginTop: "4px", display: "block", maxWidth: "420px", lineHeight: 1.4 }}>{ds.description}</span>
                      </td>
                      <td style={{ padding: "20px 16px", whiteSpace: "nowrap", fontSize: "0.88rem", color: "var(--ink)" }}>
                        {ds.period_start} s/d {ds.period_end}
                      </td>
                      <td style={{ padding: "20px 16px", fontSize: "0.88rem", color: "var(--ink)" }}>
                        <div>{ds.dataset_type}</div>
                        <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{ds.resolution}</span>
                      </td>
                      <td style={{ padding: "20px 16px", textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>
                        {ds.record_count.toLocaleString("id-ID")}
                      </td>
                      <td style={{ padding: "20px 16px 20px 24px", fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                        {ds.license}
                      </td>
                      <td style={{ padding: "20px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <a 
                            href={`http://127.0.0.1:8000${ds.csv_url}`} 
                            className="btn secondary" 
                            style={{ padding: "8px 16px", borderRadius: "100px", fontSize: "0.8rem", textDecoration: "none", minHeight: "34px" }} 
                            download
                          >
                            CSV
                          </a>
                          <a 
                            href={`http://127.0.0.1:8000${ds.json_url}`} 
                            className="btn secondary" 
                            style={{ padding: "8px 16px", borderRadius: "100px", fontSize: "0.8rem", textDecoration: "none", minHeight: "34px" }} 
                            download
                          >
                            JSON
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* API Reference Panel - Clean typography */}
        <section 
          className="panel" 
          style={{ 
            padding: "36px", 
            borderRadius: "20px", 
            background: "var(--surface)", 
            border: "1px solid var(--line)", 
            boxShadow: "0 12px 40px rgba(18, 19, 20, 0.02)"
          }}
        >
          <div style={{ marginBottom: "28px" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>Referensi REST API</h2>
            <p style={{ fontSize: "0.92rem", color: "var(--ink-soft)", margin: "6px 0 0 0", lineHeight: 1.5 }}>Integrasikan data prediksi langsung ke sistem luar. Pastikan menyertakan parameter autentikasi.</p>
          </div>
          
          <div style={{ display: "grid", gap: "20px" }}>
            {endpoints.map(([method, path, note]) => (
              <article 
                key={path} 
                style={{ 
                  background: "var(--surface-soft)", 
                  border: "1px solid var(--line)", 
                  borderRadius: "12px", 
                  padding: "20px" 
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", flexWrap: "wrap" }}>
                  <span className="badge status-menunggu" style={{ fontSize: "0.72rem", padding: "4px 10px", borderRadius: "100px" }}>{method}</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "1rem", color: "var(--ink)" }}>{path}</strong>
                </div>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink-soft)", lineHeight: 1.4 }}>{note}</p>
              </article>
            ))}
          </div>
        </section>

      </div>
    </AppShell>
  );
}
