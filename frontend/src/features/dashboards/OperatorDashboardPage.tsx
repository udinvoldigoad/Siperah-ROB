import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { MetricCard } from "../../shared/components/MetricCard";
import { useToast } from "../../shared/components/Toast";
import { Skeleton } from "../../shared/components/Skeleton";
import { fetchOperatorReports, severityLabels, statusLabels, updateOperatorReportStatus, type OperatorReport } from "../reports/reportData";
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
    // Map backend array to OperatorReport fields
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
    <AppShell active="operator" title="Dashboard Pusdalops" subtitle="Lakukan verifikasi laporan partisipatif warga secara real-time.">
      <div className="stack" style={{ display: "grid", gap: "28px" }}>
        
        <div className="alert status-menunggu" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", border: "1px solid var(--accent)", borderRadius: "12px", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Icon name="warning" style={{ color: "var(--accent)", fontSize: "1.4rem" }} />
            <div>
              <strong>Kesiapsiagaan Pasang Maksimum</strong>
              <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>Rekomendasi model menunjukkan curah pasang pesisir tinggi. Berikan prioritas pada laporan status "sangat parah".</div>
            </div>
          </div>
          <a className="btn secondary" href="#/province" style={{ whiteSpace: "nowrap" }}>Ringkasan Provinsi</a>
        </div>

        <div className="metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
          <MetricCard metric={{ label: "Laporan Menunggu", value: String(pendingCount), note: `${reports.length} dalam antrean`, tone: "critical" }} />
          <MetricCard metric={{ label: "Prioritas Parah", value: String(criticalCount), note: "Butuh validasi mendesak", tone: "critical" }} />
          <MetricCard metric={{ label: "SLA Verifikasi", value: "8 Menit", note: "Respons rata-rata" }} />
          <MetricCard metric={{ label: "Total Terproses", value: "348", note: "Bulan ini" }} />
        </div>

        <section className="panel" style={{ padding: "28px", borderRadius: "16px", background: "var(--surface)", border: "1px solid var(--line)", display: "grid", gap: "20px" }}>
          <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Antrean Laporan Lapangan</h2>
              <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)", margin: "4px 0 0 0" }}>Verifikasi kesesuaian koordinat, foto genangan, dan klasifikasi tingkat keparahan banjir rob.</p>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>{reports.length} laporan baru</span>
              <button className="btn secondary" type="button" onClick={loadReports} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Icon name="refresh" /> Segarkan
              </button>
            </div>
          </div>

          <div className="report-list" style={{ display: "grid", gap: "12px" }}>
            {isLoading ? (
              <div style={{ display: "grid", gap: "12px" }}>
                {[1, 2].map((i) => (
                  <div key={i} style={{ background: "var(--surface-soft)", padding: "20px", borderRadius: "12px", border: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr auto", gap: "20px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <Skeleton width="140px" height="20px" />
                      <Skeleton width="280px" height="14px" />
                      <Skeleton width="80px" height="24px" borderRadius="100px" />
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <Skeleton width="80px" height="36px" borderRadius="8px" />
                      <Skeleton width="80px" height="36px" borderRadius="8px" />
                    </div>
                  </div>
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-soft)", border: "1px dashed var(--line)", borderRadius: "12px" }}>
                <Icon name="verified_user" style={{ fontSize: "2.5rem", marginBottom: "8px", color: "var(--accent)" }} />
                <strong>Antrean Bersih</strong>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem" }}>Semua laporan masuk telah divalidasi dan dipetakan.</p>
              </div>
            ) : (
              reports.map((report) => (
                <article 
                  className={`report-row severity-left-${report.severity}`} 
                  key={report.id} 
                  style={{
                    background: "var(--surface-soft)",
                    border: "1px solid var(--line)",
                    borderRadius: "12px",
                    padding: "20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "20px",
                    flexWrap: "wrap",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "260px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                      <a href={`#/operator/reports/${report.id}`} style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--ink)", textDecoration: "none" }}>
                        {report.code} &mdash; {report.village}
                      </a>
                      <span className={`badge severity-${report.severity}`}>{severityLabels[report.severity]}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                      Kec. {report.district}, Kab. {report.regency} &bull; Waktu Lapor: {report.submittedAt}
                    </p>
                    <p style={{ margin: "10px 0 0 0", fontSize: "0.88rem", color: "var(--ink)", lineHeight: 1.4, fontStyle: "italic" }}>
                      "{report.description}"
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "28px", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tinggi Air</span>
                      <strong style={{ fontSize: "1.2rem", fontWeight: 800 }}>{report.waterHeightCm === null ? "-" : `${report.waterHeightCm} cm`}</strong>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button 
                        className="btn primary" 
                        type="button" 
                        style={{ padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                        onClick={() => handleValidate(report)}
                      >
                        <Icon name="check" /> Validasi
                      </button>
                      <button 
                        className="btn secondary" 
                        type="button" 
                        style={{ padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--critical)" }}
                        onClick={() => handleReject(report)}
                      >
                        <Icon name="block" /> Tolak
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
