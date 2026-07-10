import { useEffect, useRef, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { MetricCard } from "../../shared/components/MetricCard";
import { useToast } from "../../shared/components/Toast";
import { Skeleton } from "../../shared/components/Skeleton";
import { fetchOperatorReports, operatorReports, severityLabels, statusLabels, updateOperatorReportStatus, type OperatorReport } from "../reports/reportData";

export function OperatorDashboardPage() {
  const [reports, setReports] = useState<OperatorReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchOperatorReports()
      .then((data) => {
        if (!cancelled) setReports(data);
      })
      .catch(() => {
        if (!cancelled) {
          setReports(operatorReports);
          toastRef.current.info("Backend belum tersedia. Menampilkan data contoh.");
        }
      })
      .finally(() => {
        if (!cancelled) setTimeout(() => setIsLoading(false), 800);
      });
    return () => { cancelled = true; };
  }, []);

  async function handleValidate(report: OperatorReport) {
    try {
      await updateOperatorReportStatus(report.id, "divalidasi");
      setReports((current) => current.filter((item) => item.id !== report.id));
      toast.success(`Laporan ${report.code} berhasil divalidasi.`);
    } catch {
      toast.error("Status laporan belum tersimpan. Cek koneksi backend.");
    }
  }

  const pendingCount = reports.filter((report) => report.status === "menunggu").length;
  const criticalCount = reports.filter((report) => report.severity === "parah" || report.severity === "sangat_parah").length;

  return (
    <AppShell active="operator" title="Dashboard Operator BPBD" subtitle="Validasi laporan, pemantauan wilayah kerja, dan respon cepat untuk laporan ground truth.">
      <div className="stack">
        <div className="alert" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <strong style={{ display: "block", marginBottom: 3 }}>Peringatan aktif</strong>
            <span>Pasang puncak diprediksi 21-23 Mei 2026. Prioritaskan laporan yang bertanda sangat tinggi.</span>
          </div>
          <a className="btn secondary" href="#/province">Lihat ringkasan provinsi</a>
        </div>

        <div className="metric-grid">
          <MetricCard metric={{ label: "Laporan menunggu", value: String(pendingCount), note: `${reports.length} total laporan`, tone: "critical" }} />
          <MetricCard metric={{ label: "Laporan divalidasi", value: "128", note: "Hari ini", tone: "success" }} />
          <MetricCard metric={{ label: "Prioritas tinggi", value: String(criticalCount), note: "Perlu respons cepat" }} />
          <MetricCard metric={{ label: "Respons rata-rata", value: "12 m", note: "Di bawah SLA" }} />
        </div>

        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Antrean laporan warga</h2>
              <p>Laporan terbaru yang perlu diverifikasi operator wilayah.</p>
            </div>
            <div className="queue-tools">
              <span>{reports.length} laporan terbaru</span>
              <a className="btn secondary" href="#/reports">Tambah laporan</a>
            </div>
          </div>
          <div className="report-list" role="list" aria-label="Antrean laporan warga">
            {isLoading ? (
              <div style={{ display: "grid", gap: 1, background: "var(--line)" }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ background: "#fff", padding: "14px 16px", display: "grid", gridTemplateColumns: "minmax(280px, 1fr) 112px 96px auto", gap: 14 }}>
                    <div>
                      <Skeleton width="180px" height="20px" style={{ marginBottom: "8px" }} />
                      <Skeleton width="240px" height="14px" style={{ marginBottom: "12px" }} />
                      <div style={{ display: "flex", gap: "8px" }}>
                        <Skeleton width="60px" height="24px" borderRadius="12px" />
                        <Skeleton width="80px" height="24px" borderRadius="12px" />
                      </div>
                    </div>
                    <div>
                      <Skeleton width="60px" height="12px" style={{ marginBottom: "6px" }} />
                      <Skeleton width="40px" height="18px" />
                    </div>
                    <div>
                      <Skeleton width="40px" height="12px" style={{ marginBottom: "6px" }} />
                      <Skeleton width="50px" height="18px" />
                    </div>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <Skeleton width="70px" height="36px" borderRadius="var(--radius)" />
                      <Skeleton width="86px" height="36px" borderRadius="var(--radius)" />
                    </div>
                  </div>
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="report-empty">
                <strong>Tidak ada antrean</strong>
                <span>Semua laporan prioritas sudah diproses.</span>
              </div>
            ) : (
              reports.map((report) => (
                <article className={`report-row severity-left-${report.severity}`} key={report.id} role="listitem">
                  <div className="report-main">
                    <a className="report-title" href={`#/operator/reports/${report.id}`}>{report.code} {report.village}</a>
                    <p>{report.district}, {report.regency}. {report.submittedAt}</p>
                    <div className="report-chips">
                      <span className={`badge severity-${report.severity}`}>{severityLabels[report.severity]}</span>
                      <span className={`badge status-${report.status}`}>{statusLabels[report.status]}</span>
                    </div>
                  </div>
                  <div className="report-measure">
                    <span>Tinggi air</span>
                    <strong>{report.waterHeightCm === null ? "-" : `${report.waterHeightCm} cm`}</strong>
                  </div>
                  <div className="report-measure">
                    <span>SLA</span>
                    <strong>{report.status === "menunggu" ? "20 m" : "Review"}</strong>
                  </div>
                  <div className="report-actions">
                    <a className="btn secondary" href={`#/operator/reports/${report.id}`}>Detail</a>
                    <button className="btn primary" type="button" onClick={() => handleValidate(report)}>Validasi</button>
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


