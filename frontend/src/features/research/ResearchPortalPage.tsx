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
    <AppShell active="research" title="Portal Peneliti & API">
      {/* KPI Grid */}
      <div className="kpi-grid kpi-grid-4" style={{ marginBottom: "20px" }}>
        <div className="kpi">
          <small>Dataset Terbuka</small>
          <div className="kpi-num">{datasets.length}</div>
          <div className="kpi-sub">Format CSV & JSON siap unduh</div>
        </div>
        <div className="kpi">
          <small>Endpoint API</small>
          <div className="kpi-num">{endpoints.length}</div>
          <div className="kpi-sub">Terintegrasi sistem</div>
        </div>
        <div className="kpi">
          <small>Total Record Data</small>
          <div className="kpi-num">53,764</div>
          <div className="kpi-sub">Entri pasang dan mitigasi</div>
        </div>
        <div className="kpi">
          <small>Status Kunci API</small>
          <div className="kpi-num" style={{ color: activeKey ? "var(--green)" : "var(--tx2)" }}>
            {activeKey ? "Aktif" : "Nonaktif"}
          </div>
          <div className="kpi-sub">{activeKey ? "Siap digunakan" : "Belum digenerasi"}</div>
        </div>
      </div>

      {/* Kredensial API Panel */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "20px", marginBottom: "16px" }}>
          <div>
            <div className="card-title" style={{ margin: 0 }}>Kredensial API Akses Penelitian</div>
            <div style={{ fontSize: "12px", color: "var(--tx2)", marginTop: "4px" }}>
              Gunakan kunci ini untuk mengambil data secara dinamis ke dalam skrip Python, R, atau aplikasi pihak ketiga.
            </div>
          </div>
          <button className="btn-primary" onClick={handleRegenerateKey} style={{ fontSize: "12px" }}>
            <Icon name="refresh" /> Regenerasi Key
          </button>
        </div>

        <div style={{ background: "#000", borderRadius: "var(--radius)", padding: "16px", fontFamily: "monospace", color: "#ededed" }}>
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--red)" }}></span>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--amber)" }}></span>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--green)" }}></span>
          </div>

          {rawGeneratedKey ? (
            <div>
              <div style={{ fontSize: "11px", color: "#888", marginBottom: "6px" }}># SALIN KUNCI API ANDA SEKARANG (HANYA DITAMPILKAN SEKALI)</div>
              <code style={{ fontSize: "13px", fontWeight: 700, color: "#fff", wordBreak: "break-all", display: "block", background: "#111", padding: "10px", borderRadius: "4px", border: "1px solid #333" }}>
                {rawGeneratedKey}
              </code>
            </div>
          ) : activeKey ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#888", marginBottom: "4px" }}># KUNCI API AKTIF SAAT INI</div>
                <code style={{ fontSize: "13px", fontWeight: 700, color: "#fff", letterSpacing: "0.5px" }}>
                  {activeKey.key_prefix}
                </code>
              </div>
              <div style={{ fontSize: "11px", color: "#888" }}>
                Dibuat pada {new Date(activeKey.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
          ) : (
            <div style={{ color: "#888", fontSize: "12px" }}>
              # BELUM ADA KUNCI API AKTIF. SILAKAN KLIK REGENERASI KEY.
            </div>
          )}
        </div>
      </div>

      {/* Katalog Dataset */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: "20px" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bd)" }}>
          <div className="card-title" style={{ margin: 0 }}>Katalog Dataset Pesisir Lampung</div>
        </div>

        {isLoading ? (
          <div style={{ padding: "20px" }}>Memuat dataset...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Dataset</th>
                <th>Rentang Waktu</th>
                <th>Resolusi</th>
                <th style={{ textAlign: "right" }}>Baris Data</th>
                <th>Lisensi</th>
                <th style={{ textAlign: "right" }}>Unduh</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((ds) => (
                <tr key={ds.id}>
                  <td>
                    <strong style={{ color: "var(--tx0)" }}>{ds.name}</strong>
                    <div style={{ fontSize: "11px", color: "var(--tx2)", marginTop: "2px" }}>{ds.description}</div>
                  </td>
                  <td><span style={{ fontSize: "12px" }}>{ds.period_start} s/d {ds.period_end}</span></td>
                  <td>
                    <span style={{ fontSize: "12px" }}>{ds.dataset_type}</span>
                    <div style={{ fontSize: "11px", color: "var(--tx3)" }}>{ds.resolution}</div>
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{ds.record_count.toLocaleString("id-ID")}</td>
                  <td><span style={{ fontSize: "11px", color: "var(--tx2)" }}>{ds.license}</span></td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      <a href={`http://127.0.0.1:8000${ds.csv_url}`} style={{ textDecoration: "none" }} download>
                        <button style={{ padding: "4px 8px", fontSize: "11px" }}>CSV</button>
                      </a>
                      <a href={`http://127.0.0.1:8000${ds.json_url}`} style={{ textDecoration: "none" }} download>
                        <button style={{ padding: "4px 8px", fontSize: "11px" }}>JSON</button>
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Referensi REST API */}
      <div className="card">
        <div className="card-title">Referensi REST API</div>
        <div style={{ display: "grid", gap: "12px" }}>
          {endpoints.map(([method, path, note]) => (
            <div key={path} style={{ background: "var(--bg1)", border: "1px solid var(--bd)", borderRadius: "var(--radius)", padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                <span className="badge b-info" style={{ fontSize: "10px" }}>{method}</span>
                <code style={{ fontSize: "12px", fontWeight: 700, color: "var(--tx0)" }}>{path}</code>
              </div>
              <div style={{ fontSize: "11px", color: "var(--tx2)" }}>{note}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
