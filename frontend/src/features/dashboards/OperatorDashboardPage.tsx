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
    <AppShell active="operator" title="Dashboard Pusdalops" subtitle="Lakukan verifikasi laporan partisipatif warga secara real-time.">
      <div className="stack" style={{ gap: "40px", padding: "12px 0" }}>
        
        {/* Warning Banner */}
        <div 
          className="alert" 
          style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between", 
            gap: "20px", 
            border: "1px solid #FCA5A5", 
            background: "#FEF2F2", 
            color: "#991B1B",
            borderRadius: "16px", 
            padding: "20px 28px",
            boxShadow: "0 4px 15px rgba(239, 68, 68, 0.03)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ background: "#FEE2E2", width: "42px", height: "42px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="warning" style={{ color: "#EF4444", fontSize: "1.4rem" }} />
            </div>
            <div>
              <strong style={{ fontSize: "1rem", fontWeight: 800 }}>Kesiapsiagaan Pasang Maksimum</strong>
              <div style={{ fontSize: "0.88rem", opacity: 0.9, marginTop: "2px" }}>Rekomendasi model menunjukkan curah pasang pesisir tinggi. Berikan prioritas pada laporan status "sangat parah".</div>
            </div>
          </div>
          <a className="btn secondary" href="#/province" style={{ whiteSpace: "nowrap", borderRadius: "100px", padding: "10px 24px", fontWeight: 700, fontSize: "0.85rem" }}>Ringkasan Provinsi</a>
        </div>

        {/* Metric Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px" }}>
          <MetricCard metric={{ label: "Laporan Menunggu", value: String(pendingCount), note: `${reports.length} dalam antrean`, tone: "critical" }} />
          <MetricCard metric={{ label: "Prioritas Parah", value: String(criticalCount), note: "Butuh validasi mendesak", tone: "critical" }} />
          <MetricCard metric={{ label: "SLA Verifikasi", value: "8 Menit", note: "Respons rata-rata" }} />
          <MetricCard metric={{ label: "Total Terproses", value: "348", note: "Bulan ini" }} />
        </div>

        {/* Queue Section */}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "28px" }}>
            <div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0, color: "var(--ink)" }}>Antrean Laporan Lapangan</h2>
              <p style={{ fontSize: "0.92rem", color: "var(--ink-soft)", margin: "6px 0 0 0", lineHeight: 1.5 }}>Verifikasi kesesuaian koordinat, foto genangan, dan klasifikasi tingkat keparahan banjir rob.</p>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--ink-soft)" }}>{reports.length} laporan baru</span>
              <button 
                className="btn secondary" 
                type="button" 
                onClick={loadReports} 
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", borderRadius: "100px", padding: "10px 20px" }}
              >
                <Icon name="refresh" /> Segarkan
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            {isLoading ? (
              <div style={{ display: "grid", gap: "16px" }}>
                {[1, 2].map((i) => (
                  <div key={i} style={{ background: "var(--surface-soft)", padding: "24px", borderRadius: "16px", border: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr auto", gap: "24px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <Skeleton width="160px" height="22px" />
                      <Skeleton width="320px" height="16px" />
                      <Skeleton width="90px" height="26px" borderRadius="100px" />
                    </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <Skeleton width="90px" height="38px" borderRadius="100px" />
                      <Skeleton width="90px" height="38px" borderRadius="100px" />
                    </div>
                  </div>
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 0", color: "var(--ink-soft)", border: "1px dashed var(--line)", borderRadius: "16px" }}>
                <div style={{ background: "var(--surface-soft)", width: "64px", height: "64px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <Icon name="verified_user" style={{ fontSize: "2rem", color: "var(--accent)" }} />
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 6px 0", color: "var(--ink)" }}>Antrean Bersih</h3>
                <p style={{ margin: 0, fontSize: "0.88rem" }}>Semua laporan masuk telah divalidasi dan dipetakan.</p>
              </div>
            ) : (
              reports.map((report) => (
                <article 
                  className={`report-row severity-left-${report.severity}`} 
                  key={report.id} 
                  style={{
                    background: "var(--surface-soft)",
                    border: "1px solid var(--line)",
                    borderRadius: "16px",
                    padding: "24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "24px",
                    flexWrap: "wrap",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "280px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px", flexWrap: "wrap" }}>
                      <a href={`#/operator/reports/${report.id}`} style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--ink)", textDecoration: "none" }}>
                        {report.code} &mdash; {report.village}
                      </a>
                      <span className={`badge severity-${report.severity}`} style={{ fontSize: "0.78rem", fontWeight: 700 }}>{severityLabels[report.severity]}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink-soft)" }}>
                      Kec. {report.district}, Kab. {report.regency} &bull; Waktu Lapor: {report.submittedAt}
                    </p>
                    <p style={{ margin: "12px 0 0 0", fontSize: "0.92rem", color: "var(--ink)", lineHeight: 1.5, fontStyle: "italic" }}>
                      "{report.description}"
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "36px", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>Tinggi Air</span>
                      <strong style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--ink)" }}>{report.waterHeightCm === null ? "-" : `${report.waterHeightCm} cm`}</strong>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <button 
                        className="btn primary" 
                        type="button" 
                        style={{ padding: "10px 24px", borderRadius: "100px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 700 }}
                        onClick={() => handleValidate(report)}
                      >
                        <Icon name="check" /> Validasi
                      </button>
                      <button 
                        className="btn secondary" 
                        type="button" 
                        style={{ padding: "10px 24px", borderRadius: "100px", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", fontWeight: 700, color: "var(--critical)", borderColor: "var(--line)" }}
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
