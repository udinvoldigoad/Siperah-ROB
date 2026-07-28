import { api, apiUrl } from "../../shared/api/client";

export type ReportSeverity = "ringan" | "sedang" | "parah" | "sangat_parah";
export type ReportStatus = "menunggu" | "perlu_review" | "divalidasi" | "ditolak" | "duplikat";

export type OperatorReport = {
  id: string;
  code: string;
  village: string;
  district: string;
  regency: string;
  severity: ReportSeverity;
  status: ReportStatus;
  incidentTime: string;
  submittedAt: string;
  waterHeightCm: number | null;
  reporter: string;
  coordinates: string;
  description: string;
  photos: { name: string; url?: string }[];
  isWithinMonitoringArea: boolean;
  slaStatus: "berjalan" | "terlambat" | "selesai";
};

type BackendReport = {
  id: string;
  report_code: string;
  latitude: number;
  longitude: number;
  severity: ReportSeverity;
  status: ReportStatus;
  incident_time: string;
  created_at: string;
  sla_status?: "berjalan" | "terlambat" | "selesai";
  is_within_monitoring_area?: boolean;
  water_height_cm: number | null;
  description: string;
  region?: { village?: string; district?: string; regency?: string; coastal_flag?: boolean; is_monitored?: boolean };
  reporter?: { name?: string };
  photos?: { name?: string; url?: string }[];
};

type ReportResponse = { data: BackendReport };
type ReportHistoryResponse = {
  data: BackendReport[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null };
};

export type ReportHistoryPageData = {
  reports: OperatorReport[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  from: number;
  to: number;
};

export const severityLabels: Record<ReportSeverity, string> = {
  ringan: "Ringan",
  sedang: "Sedang",
  parah: "Parah",
  sangat_parah: "Sangat parah",
};

export const statusLabels: Record<ReportStatus, string> = {
  menunggu: "Menunggu validasi",
  perlu_review: "Perlu review",
  divalidasi: "Divalidasi",
  ditolak: "Ditolak",
  duplikat: "Duplikat",
};

function parseApiDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();
  if (dateStr.endsWith("Z") || dateStr.includes("+")) return new Date(dateStr);
  return new Date(dateStr.replace(" ", "T") + "Z");
}

function mapReport(report: BackendReport): OperatorReport {
  // Tampilkan dalam zona waktu perangkat pengguna agar konsisten dengan jam
  // yang mereka lihat saat melapor (tidak dipaksa ke satu offset tetap).
  const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return {
    id: report.id,
    code: report.report_code,
    village: report.region?.village ?? "Wilayah tidak diketahui",
    district: report.region?.district ?? "-",
    regency: report.region?.regency ?? "-",
    severity: report.severity,
    status: report.status,
    incidentTime: dateTimeFormatter.format(parseApiDate(report.incident_time)),
    submittedAt: dateTimeFormatter.format(parseApiDate(report.created_at)),
    waterHeightCm: report.water_height_cm,
    reporter: report.reporter?.name ?? "Warga",
    coordinates: `${report.latitude}, ${report.longitude}`,
    description: report.description,
    photos: (report.photos ?? []).map((photo) => ({
      name: photo.name ?? "Foto laporan",
      url: photo.url ? apiUrl(photo.url) : undefined,
    })),
    isWithinMonitoringArea: Boolean(report.is_within_monitoring_area ?? report.region?.is_monitored ?? report.region?.coastal_flag),
    slaStatus: report.sla_status ?? "berjalan",
  };
}

export type OperatorReportsPageData = {
  reports: OperatorReport[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  from: number;
  to: number;
};

export type OperatorReportFilters = { severity?: ReportSeverity | ""; slaOverdue?: boolean; status?: string };

export async function fetchOperatorReports(page = 1, perPage = 20, filters: OperatorReportFilters = {}): Promise<OperatorReportsPageData> {
  const statusParam = filters.status || "menunggu,perlu_review";
  const params = new URLSearchParams({ status: statusParam, per_page: String(perPage), page: String(page) });
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.slaOverdue) params.set("sla", "overdue");
  const response = await api<ReportHistoryResponse>(`/reports?${params.toString()}`);
  return {
    reports: response.data.map(mapReport),
    currentPage: response.meta.current_page,
    lastPage: response.meta.last_page,
    perPage: response.meta.per_page,
    total: response.meta.total,
    from: response.meta.from ?? 0,
    to: response.meta.to ?? 0,
  };
}

export async function fetchOperatorReport(id: string) {
  const response = await api<ReportResponse>(`/reports/${id}`);
  return mapReport(response.data);
}

export async function updateOperatorReportStatus(id: string, status: ReportStatus, rejectionReason?: string) {
  const response = await api<ReportResponse>(`/reports/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, rejection_reason: rejectionReason }),
  });

  return mapReport(response.data);
}

export async function fetchUserHistoryReports(page = 1): Promise<ReportHistoryPageData> {
  const response = await api<ReportHistoryResponse>(`/reports?page=${page}`);
  return {
    reports: response.data.map(mapReport),
    currentPage: response.meta.current_page,
    lastPage: response.meta.last_page,
    perPage: response.meta.per_page,
    total: response.meta.total,
    from: response.meta.from ?? 0,
    to: response.meta.to ?? 0,
  };
}
