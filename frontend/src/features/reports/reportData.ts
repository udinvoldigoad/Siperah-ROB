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
  is_within_monitoring_area?: boolean;
  water_height_cm: number | null;
  description: string;
  region?: { village?: string; district?: string; regency?: string; coastal_flag?: boolean; is_monitored?: boolean };
  reporter?: { name?: string };
  photos?: { name?: string; url?: string }[];
};

type ReportListResponse = { data: BackendReport[] };
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

export const operatorReports: OperatorReport[] = [
  {
    id: "gt-lpg-882",
    code: "GT-LPG-882",
    village: "Panjang Utara",
    district: "Panjang",
    regency: "Bandar Lampung",
    severity: "parah",
    status: "menunggu",
    incidentTime: "09 Jul 2026, 02:40",
    submittedAt: "Masuk 12 menit lalu",
    waterHeightCm: 38,
    reporter: "Rudi Hartono",
    coordinates: "-5.450000, 105.266667",
    description: "Genangan masuk ke akses pasar dan menutup sebagian jalan warga. Arus lambat, kendaraan roda dua mulai dialihkan.",
    photos: [{ name: "Akses pasar" }, { name: "Jalan lingkungan" }],
    isWithinMonitoringArea: true,
  },
  {
    id: "gt-lpg-881",
    code: "GT-LPG-881",
    village: "Way Halim",
    district: "Way Halim",
    regency: "Bandar Lampung",
    severity: "sedang",
    status: "perlu_review",
    incidentTime: "09 Jul 2026, 01:58",
    submittedAt: "Masuk 36 menit lalu",
    waterHeightCm: 24,
    reporter: "Maya Puspita",
    coordinates: "-5.382120, 105.274010",
    description: "Air menutup bahu jalan dekat drainase utama. Perlu cek ulang karena lokasi cukup jauh dari pesisir.",
    photos: [{ name: "Drainase" }, { name: "Bahu jalan" }],
    isWithinMonitoringArea: false,
  },
  {
    id: "gt-lpg-879",
    code: "GT-LPG-879",
    village: "Teluk Betung",
    district: "Teluk Betung Selatan",
    regency: "Bandar Lampung",
    severity: "sangat_parah",
    status: "menunggu",
    incidentTime: "08 Jul 2026, 23:20",
    submittedAt: "Masuk 1 jam lalu",
    waterHeightCm: 52,
    reporter: "Nabila Putri",
    coordinates: "-5.447830, 105.262440",
    description: "Air masuk ke rumah warga di gang rendah. Beberapa kepala keluarga memindahkan barang ke lantai atas.",
    photos: [{ name: "Gang rendah" }, { name: "Rumah warga" }],
    isWithinMonitoringArea: true,
  },
];

export function findOperatorReport(id: string) {
  return operatorReports.find((report) => report.id === id);
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
    incidentTime: dateTimeFormatter.format(new Date(report.incident_time)),
    submittedAt: dateTimeFormatter.format(new Date(report.created_at)),
    waterHeightCm: report.water_height_cm,
    reporter: report.reporter?.name ?? "Warga",
    coordinates: `${report.latitude}, ${report.longitude}`,
    description: report.description,
    photos: (report.photos ?? []).map((photo) => ({
      name: photo.name ?? "Foto laporan",
      url: photo.url ? apiUrl(photo.url) : undefined,
    })),
    isWithinMonitoringArea: Boolean(report.is_within_monitoring_area ?? report.region?.is_monitored ?? report.region?.coastal_flag),
  };
}

export async function fetchOperatorReports() {
  const response = await api<ReportListResponse>("/reports?status=menunggu,perlu_review&per_page=100");
  return response.data.map(mapReport);
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
