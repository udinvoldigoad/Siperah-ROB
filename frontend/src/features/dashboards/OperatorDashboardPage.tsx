import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { MetricCard } from "../../shared/components/MetricCard";
import { useToast } from "../../shared/components/Toast";
import { Skeleton } from "../../shared/components/Skeleton";
import { fetchOperatorReports, severityLabels, updateOperatorReportStatus, type OperatorReport } from "../reports/reportData";
import { Icon } from "../../shared/components/Icon";

export function OperatorDashboardPage() {
  const [reports, setReports] = useState<OperatorReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const data = await fetchOperatorReports();
      setUsersReport(data);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat antrean laporan.");
    } finally {
      setIsLoading(false);
    }
  };

  const setUsersReport = (data: any) => {
    const mapped = data.map((item: any) => ({
      id: item.id || item.db_id,
      code: item.report_code,
      village: item.village,
      district: item.district,
      regency: item.regency,
      severity: item.severity,
      status: item.status,
      incidentTime: item.incident_time,
      submittedAt: item.created_at ? new Date(item.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "Baru",
      waterHeightCm: item.water_height_cm,
      description: item.description,
    }));
    setReports(mapped);
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleValidate = async (report: OperatorReport) => {
    try {
      await updateOperatorReportStatus(report.id, "divalidasi");
      setReports((current) => current.filter((item) => item.id !== report.id));
      toast.success(`Laporan ${report.code} berhasil divalidasi ke database.`);
    } catch (err: any) {
      toast.error("Gagal melakukan validasi laporan.");
    }
  };

  const handleReject = async (report: OperatorReport) => {
    try {
      await updateOperatorReportStatus(report.id, "ditolak", "Ditolak oleh operator BPBD");
      setReports((current) => current.filter((item) => item.id !== report.id));
      toast.info(`Laporan ${report.code} telah ditolak.`);
    } catch (err: any) {
      toast.error("Gagal melakukan penolakan laporan.");
    }
  };

  const pendingCount = reports.filter((r) => r.status === "menunggu").length;
  const criticalCount = reports.filter((r) => r.severity === "parah" || r.severity === "sangat_parah").length;

  return (
    <AppShell active="operator" title="Dashboard Operator BPBD">
      {/* Alert Banner */}
      <div className="alert-banner alert-red" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Icon name="warning" style={{ fontSize: "18px", color: "#b91c1c" }} />
          <div>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#7f1d1d" }}>
              {pendingCount} laporan baru masuk · perlu verifikasi segera
            </div>
            <div style={{ fontSize: "11px", color: "#991b1b", marginTop: "1px" }}>
              Utamakan validasi laporan dengan tingkat keparahan Sangat Parah.
            </div>
          </div>
        </div>
        <a className="btn-primary" href="#/province" style={{ fontSize: "11px", padding: "6px 12px" }}>
          Ringkasan Provinsi <Icon name="arrow_forward" style={{ fontSize: "12px" }} />
        </a>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid kpi-grid-4" style={{ marginBottom: "20px" }}>
        <div className="kpi">
          <small>Kelurahan pantau aktif</small>
          <div className="kpi-num">24</div>
          <div className="kpi-sub">kecamatan pesisir</div>
        </div>
        <div className="kpi">
          <small>Bahaya Sangat Tinggi</small>
          <div className="kpi-num" style={{ color: "#b91c1c" }}>{criticalCount}</div>
          <div className="kpi-sub">kelurahan hari ini</div>
        </div>
        <div className="kpi">
          <small>Laporan menunggu</small>
          <div className="kpi-num" style={{ color: "#d97706" }}>{pendingCount}</div>
          <div className="kpi-sub">perlu validasi</div>
        </div>
        <div className="kpi">
          <small>Validasi bulan ini</small>
          <div className="kpi-num" style={{ color: "#15803d" }}>47</div>
          <div className="kpi-sub">laporan disetujui</div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Antrean Moderasi */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="card-title" style={{ margin: 0 }}>Antrian Laporan Masuk</div>
            <span className="badge b-vhi">{pendingCount} baru</span>
          </div>

          <div>
            {isLoading ? (
              <div style={{ padding: "20px" }}>Memuat laporan...</div>
            ) : reports.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--tx3)" }}>
                <Icon name="verified_user" style={{ fontSize: "32px", color: "var(--green)" }} />
                <div style={{ fontWeight: 600, marginTop: "8px" }}>Antrean Bersih</div>
                <div style={{ fontSize: "12px" }}>Semua laporan telah diverifikasi.</div>
              </div>
            ) : (
              reports.map((report) => (
                <div key={report.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--bd)", background: report.severity === "sangat_parah" || report.severity === "parah" ? "#fef9f9" : "transparent" }}>
                  <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600 }}>Kel. {report.village} &bull; Kec. {report.district}</div>
                      <div style={{ fontSize: "11px", color: "var(--tx2)", marginTop: "2px" }}>Dilaporkan: {report.submittedAt} &bull; oleh warga ({report.waterHeightCm ? `${report.waterHeightCm} cm` : "-"})</div>
                    </div>
                    <span className={`badge ${
                      report.severity === "sangat_parah" ? "b-vhi" :
                      report.severity === "parah" ? "b-hi" :
                      report.severity === "sedang" ? "b-med" : "b-low"
                    }`}>
                      {report.severity.replace("_", " ")}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--tx2)", marginBottom: "10px", padding: "8px", background: "var(--bg1)", borderRadius: "var(--radius)" }}>
                    "{report.description}"
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button 
                      style={{ background: "#15803d", color: "#fff", borderColor: "#15803d", fontSize: "11px", flex: 1, justifyContent: "center" }}
                      onClick={() => handleValidate(report)}
                    >
                      <Icon name="check" style={{ fontSize: "12px" }} /> Validasi
                    </button>
                    <button 
                      style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626", fontSize: "11px", flex: 1, justifyContent: "center" }}
                      onClick={() => handleReject(report)}
                    >
                      <Icon name="close" style={{ fontSize: "12px" }} /> Tolak
                    </button>
                    <a href={`#/operator/reports/${report.id}`} style={{ textDecoration: "none" }}>
                      <button style={{ fontSize: "11px", padding: "6px 10px" }}>
                        <Icon name="visibility" style={{ fontSize: "12px" }} /> Detail
                      </button>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Status Kelurahan */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="card-title" style={{ margin: 0 }}>Status Kelurahan Bandar Lampung</div>
            <a href="#/map" style={{ fontSize: "11px", color: "var(--blue)", textDecoration: "none" }}><Icon name="map" style={{ fontSize: "12px" }} /> Buka peta</a>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Kecamatan / Kelurahan</th>
                <th>Bahaya</th>
                <th style={{ textAlign: "right" }}>Pop. risiko</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 500 }}>Telukbetung Selatan</td>
                <td><span className="badge b-vhi">Sangat Tinggi</span></td>
                <td style={{ textAlign: "right" }}>23,140</td>
                <td><span style={{ fontSize: "11px", color: "var(--tx3)" }}>05:00</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Panjang</td>
                <td><span className="badge b-hi">Tinggi</span></td>
                <td style={{ textAlign: "right" }}>9,800</td>
                <td><span style={{ fontSize: "11px", color: "var(--tx3)" }}>05:00</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Kangkung</td>
                <td><span className="badge b-hi">Tinggi</span></td>
                <td style={{ textAlign: "right" }}>7,200</td>
                <td><span style={{ fontSize: "11px", color: "var(--tx3)" }}>05:00</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Way Halim Permai</td>
                <td><span className="badge b-vhi">Sangat Tinggi</span></td>
                <td style={{ textAlign: "right" }}>11,200</td>
                <td><span style={{ fontSize: "11px", color: "var(--tx3)" }}>05:00</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Sukaraja</td>
                <td><span className="badge b-vhi">Sangat Tinggi</span></td>
                <td style={{ textAlign: "right" }}>8,760</td>
                <td><span style={{ fontSize: "11px", color: "var(--tx3)" }}>05:00</span></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>Labuhan Ratu</td>
                <td><span className="badge b-med">Sedang</span></td>
                <td style={{ textAlign: "right" }}>5,400</td>
                <td><span style={{ fontSize: "11px", color: "var(--tx3)" }}>05:00</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
