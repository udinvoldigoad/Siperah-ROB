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
  ["GET", "/api/v1/predictions/daily", "Prediksi harian spasial per kelurahan"],
  ["GET", "/api/v1/reports", "Laporan ground truth warga tervalidasi"],
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
      
      // Reload keys list
      const keysRes = await api<ApiKeyResponse>("/research/api-keys");
      setApiKeys(keysRes.data);
    } catch (err: any) {
      toast.error(err.message || "Gagal meregenerasi API key.");
    }
  };

  const activeKey = apiKeys.find((k) => k.status === "aktif");

  return (
    <AppShell active="research" title="Portal Penelitian & API" subtitle="Akses data terverifikasi untuk riset akademis, pemodelan spasial, dan integrasi API.">
      <div className="stack" style={{ display: "grid", gap: "28px" }}>
        
        <div className="metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
          <MetricCard metric={{ label: "Dataset Terbuka", value: String(datasets.length), note: "Format CSV & JSON siap unduh" }} />
          <MetricCard metric={{ label: "Endpoint API", value: String(endpoints.length), note: "Terintegrasi sistem" }} />
          <MetricCard metric={{ label: "Total Record Data", value: "53.764", note: "Entri pasang dan mitigasi" }} />
          <MetricCard metric={{ label: "Status Kunci API", value: activeKey ? "Aktif" : "Nonaktif", note: activeKey ? "Siap digunakan" : "Belum digenerasi", tone: activeKey ? "success" : "neutral" }} />
        </div>

        {/* API Key Panel */}
        <section className="panel" style={{ padding: "28px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--line)", display: "grid", gap: "16px" }}>
          <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>API Key Akses Penelitian</h2>
              <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", margin: "4px 0 0 0" }}>Gunakan kunci ini untuk mengambil data secara dinamis ke dalam skrip Python, R, atau aplikasi pihak ketiga.</p>
            </div>
            <button 
              className="btn primary" 
              type="button" 
              onClick={handleRegenerateKey}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Icon name="refresh" /> Regenerasi Key
            </button>
          </div>

          {rawGeneratedKey ? (
            <div style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)", borderRadius: "12px", padding: "16px" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent)", marginBottom: "8px" }}>
                Kunci API Baru (Hanya Ditampilkan Sekali, Segera Salin!):
              </div>
              <code style={{ fontSize: "1.1rem", fontWeight: 800, wordBreak: "break-all", background: "var(--surface)", padding: "10px", borderRadius: "8px", display: "block" }}>
                {rawGeneratedKey}
              </code>
            </div>
          ) : activeKey ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <code style={{ fontSize: "1rem", letterSpacing: "1px", flexGrow: 1, padding: "12px", borderRadius: "8px", border: "1px solid var(--line)", background: "var(--surface-soft)" }}>
                {activeKey.key_prefix}
              </code>
              <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>Dibuat pada {new Date(activeKey.created_at).toLocaleDateString("id-ID")}</span>
            </div>
          ) : (
            <div style={{ padding: "12px", borderRadius: "8px", border: "1px dashed var(--line)", textAlign: "center", color: "var(--ink-soft)" }}>
              Anda belum memiliki API key aktif. Klik tombol Regenerasi Key di atas untuk memulai.
            </div>
          )}
        </section>

        {/* Dataset Table Panel */}
        <section className="panel" style={{ padding: "28px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--line)", display: "grid", gap: "20px" }}>
          <div>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Katalog Dataset Kebencanaan pesisir</h2>
            <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", margin: "4px 0 0 0" }}>Unduh data mentah atau salin skema tabel untuk kepentingan pemodelan prediksi manual.</p>
          </div>

          <div style={{ overflowX: "auto" }}>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--ink-soft)" }}>
                <Icon name="progress_activity" style={{ animation: "spin 1s linear infinite", fontSize: "2rem", marginBottom: "8px" }} />
                <div>Memuat katalog data...</div>
              </div>
            ) : (
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 840 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)" }}>
                    <th style={{ textAlign: "left", padding: "12px" }}>Nama Dataset</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Periode</th>
                    <th style={{ textAlign: "left", padding: "12px" }}>Tipe Data / Resolusi</th>
                    <th style={{ textAlign: "right", padding: "12px" }}>Jumlah Baris</th>
                    <th style={{ textAlign: "left", padding: "12px 24px" }}>Lisensi</th>
                    <th style={{ textAlign: "right", padding: "12px" }}>Aksi Unduh</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((ds) => (
                    <tr key={ds.id} style={{ borderBottom: "1px solid var(--surface-muted)" }}>
                      <td style={{ padding: "16px 12px" }}>
                        <strong style={{ display: "block", color: "var(--ink)", fontSize: "0.95rem" }}>{ds.name}</strong>
                        <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>{ds.description}</span>
                      </td>
                      <td style={{ padding: "16px 12px", whiteSpace: "nowrap", fontSize: "0.88rem" }}>
                        {ds.period_start} s/d {ds.period_end}
                      </td>
                      <td style={{ padding: "16px 12px", fontSize: "0.88rem" }}>
                        <div>{ds.dataset_type}</div>
                        <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>Resolusi: {ds.resolution}</span>
                      </td>
                      <td style={{ padding: "16px 12px", textAlign: "right", fontFamily: "monospace" }}>
                        {ds.record_count.toLocaleString("id-ID")}
                      </td>
                      <td style={{ padding: "16px 12px 16px 24px", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                        {ds.license}
                      </td>
                      <td style={{ padding: "16px 12px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <a href={`http://127.0.0.1:8000${ds.csv_url}`} className="btn secondary" style={{ padding: "6px 12px", fontSize: "0.8rem", textDecoration: "none" }} download>
                            CSV
                          </a>
                          <a href={`http://127.0.0.1:8000${ds.json_url}`} className="btn secondary" style={{ padding: "6px 12px", fontSize: "0.8rem", textDecoration: "none" }} download>
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

        {/* API Reference Panel */}
        <section className="panel" style={{ padding: "28px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--line)" }}>
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Referensi Integrasi REST API</h2>
            <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", margin: "4px 0 0 0" }}>Dokumentasi endpoint dasar yang dapat dipanggil dengan menyertakan header otorisasi API key.</p>
          </div>
          <div className="simple-list compact" style={{ display: "grid", gap: "16px" }}>
            {endpoints.map(([method, path, note]) => (
              <article key={path} style={{ borderBottom: "1px solid var(--surface-muted)", paddingBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <span className="badge status-menunggu" style={{ fontSize: "0.75rem", padding: "3px 8px" }}>{method}</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "0.95rem" }}>{path}</strong>
                </div>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink-soft)" }}>{note}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
