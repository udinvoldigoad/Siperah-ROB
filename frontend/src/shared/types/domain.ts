export type Role = "warga" | "bpbd_operator" | "bpbd_provinsi" | "peneliti" | "admin";
export type RiskClass = "rendah" | "sedang" | "tinggi" | "sangat_tinggi";
export type ReportStatus = "menunggu" | "divalidasi" | "ditolak" | "duplikat" | "perlu_review";

export type RegionRisk = {
  id: string;
  regency: string;
  district?: string;
  village?: string;
  riskClass: RiskClass;
  riskProbability: number;
  riskPopulation: number;
  peakTime?: string;
};

export type GroundTruthReport = {
  id: string;
  reportCode: string;
  regionName: string;
  severity: "ringan" | "sedang" | "parah" | "sangat_parah";
  waterHeightCm?: number;
  incidentTime: string;
  description: string;
  status: ReportStatus;
};

export type Metric = {
  label: string;
  value: string;
  note?: string;
  tone?: "neutral" | "critical" | "success";
};
