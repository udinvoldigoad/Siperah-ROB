import { useEffect, useState } from "react";
import { AppShell } from "../../shared/components/AppShell";
import { useToast } from "../../shared/components/Toast";
import { fetchOperatorReports, updateOperatorReportStatus, type OperatorReport } from "../reports/reportData";
import { Icon } from "../../shared/components/Icon";
import { motion, AnimatePresence } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, ease: "easeOut" }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function OperatorDashboardPage() {
  const [reports, setReports] = useState<OperatorReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const data = await fetchOperatorReports();
      setReports(data);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat antrean laporan.");
    } finally {
      setIsLoading(false);
    }
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
      <motion.div 
        className="content"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Alert Banner */}
        <motion.div variants={itemVariants} className="alert" style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <motion.div 
              animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }} 
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              <Icon name="warning" style={{ fontSize: "24px", color: "#7a1a13" }} />
            </motion.div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 600 }}>
                {pendingCount} laporan baru masuk · perlu verifikasi segera
              </div>
              <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "2px" }}>
                Utamakan validasi laporan dengan tingkat keparahan Sangat Parah.
              </div>
            </div>
          </div>
          <motion.a 
            whileHover={{ scale: 1.03, backgroundColor: "#5f140f" }}
            whileTap={{ scale: 0.97 }}
            className="btn primary" 
            href="#/province" 
            style={{ background: "#7a1a13", borderColor: "#7a1a13", fontSize: "13px" }}
          >
            Ringkasan Provinsi <Icon name="arrow_forward" style={{ fontSize: "16px" }} />
          </motion.a>
        </motion.div>

        {/* KPI Grid */}
        <motion.div variants={containerVariants} className="metric-grid" style={{ marginBottom: "32px" }}>
          {[
            { title: "Kelurahan pantau aktif", val: "24", sub: "kecamatan pesisir", cls: "" },
            { title: "Bahaya Sangat Tinggi", val: criticalCount, sub: "kelurahan hari ini", cls: "critical" },
            { title: "Laporan menunggu", val: pendingCount, sub: "perlu validasi", cls: "medium", customColor: "var(--medium)" },
            { title: "Validasi bulan ini", val: "47", sub: "laporan disetujui", cls: "success" }
          ].map((kpi, idx) => (
            <motion.div 
              key={idx}
              variants={itemVariants} 
              whileHover={{ y: -6, boxShadow: "0 12px 32px rgba(0,0,0,0.08)" }}
              className={`metric-card ${kpi.cls}`}
            >
              <span style={{ color: kpi.customColor ? "var(--ink-soft)" : undefined }}>{kpi.title}</span>
              <motion.strong 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 + (idx * 0.1), type: "spring", stiffness: 200 }}
                style={{ color: kpi.customColor }}
              >
                {kpi.val}
              </motion.strong>
              <small style={{ color: kpi.customColor ? "var(--ink-soft)" : undefined }}>{kpi.sub}</small>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Content Layout */}
        <motion.div variants={itemVariants} style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "24px" }}>
          {/* Antrean Moderasi */}
          <div className="panel flush">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Antrian Laporan Masuk</h2>
              <motion.span 
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                className="badge severity-sangat_parah"
              >
                {pendingCount} baru
              </motion.span>
            </div>

            <div className="report-list" style={{ border: "none", borderRadius: 0 }}>
              {isLoading ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-soft)" }}>Memuat laporan...</div>
              ) : reports.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="report-empty" style={{ textAlign: "center", padding: "64px 20px" }}>
                  <Icon name="verified_user" style={{ fontSize: "48px", color: "var(--low)", margin: "0 auto 16px" }} />
                  <strong>Antrean Bersih</strong>
                  <span>Semua laporan telah diverifikasi.</span>
                </motion.div>
              ) : (
                <AnimatePresence>
                  {reports.map((report) => (
                    <motion.div 
                      key={report.id} 
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className={`report-row severity-left-${report.severity}`} 
                      style={{ gridTemplateColumns: "1fr", padding: "24px" }}
                    >
                      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", marginBottom: "12px" }}>
                        <div>
                          <div className="report-title" style={{ fontSize: "15px" }}>Kel. {report.village} &bull; Kec. {report.district}</div>
                          <p>Dilaporkan: {report.submittedAt} &bull; oleh warga ({report.waterHeightCm ? `${report.waterHeightCm} cm` : "-"})</p>
                        </div>
                        <span className={`badge severity-${report.severity}`}>
                          {report.severity.replace("_", " ")}
                        </span>
                      </div>
                      <div style={{ fontSize: "14px", color: "var(--ink)", marginBottom: "20px", padding: "16px", background: "var(--surface-soft)", borderRadius: "var(--radius)" }}>
                        "{report.description}"
                      </div>
                      <div className="report-actions" style={{ justifyContent: "flex-start" }}>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn primary" style={{ background: "var(--low)", borderColor: "var(--low)", padding: "10px 20px" }} onClick={() => handleValidate(report)}>
                          <Icon name="check" /> Validasi
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn secondary" style={{ color: "var(--critical)", padding: "10px 20px" }} onClick={() => handleReject(report)}>
                          <Icon name="close" /> Tolak
                        </motion.button>
                        <motion.a whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} href={`#/operator/reports/${report.id}`} className="btn secondary" style={{ padding: "10px 20px" }}>
                          <Icon name="visibility" /> Detail
                        </motion.a>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Status Kelurahan */}
          <div className="panel flush">
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Status Kelurahan Bandar Lampung</h2>
              <motion.a whileHover={{ x: 5 }} href="#/map" style={{ fontSize: "0.9rem", color: "var(--accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}><Icon name="map" /> Buka peta</motion.a>
            </div>
            <table className="data-table" style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)", background: "var(--surface-soft)" }}>
                  <th style={{ padding: "14px 24px", fontWeight: 600, color: "var(--ink-soft)", fontSize: "0.85rem" }}>Kecamatan / Kelurahan</th>
                  <th style={{ padding: "14px 24px", fontWeight: 600, color: "var(--ink-soft)", fontSize: "0.85rem" }}>Bahaya</th>
                  <th style={{ padding: "14px 24px", fontWeight: 600, color: "var(--ink-soft)", fontSize: "0.85rem", textAlign: "right" }}>Pop. risiko</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Telukbetung Selatan", sev: "sangat_parah", label: "Sangat Tinggi", pop: "23,140" },
                  { name: "Panjang", sev: "parah", label: "Tinggi", pop: "9,800" },
                  { name: "Kangkung", sev: "parah", label: "Tinggi", pop: "7,200" },
                  { name: "Way Halim Permai", sev: "sangat_parah", label: "Sangat Tinggi", pop: "11,200" },
                  { name: "Sukaraja", sev: "sangat_parah", label: "Sangat Tinggi", pop: "8,760" },
                  { name: "Labuhan Ratu", sev: "sedang", label: "Sedang", pop: "5,400" },
                ].map((row, idx) => (
                  <motion.tr 
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + (idx * 0.05) }}
                    whileHover={{ backgroundColor: "var(--surface-soft)" }}
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <td style={{ padding: "16px 24px", fontWeight: 500 }}>{row.name}</td>
                    <td style={{ padding: "16px 24px" }}><span className={`badge severity-${row.sev}`}>{row.label}</span></td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>{row.pop}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
