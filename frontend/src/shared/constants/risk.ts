import type { RiskClass } from "../types/domain";

// Bantu memastikan semua kelas risiko punya entri saat didefinisikan,
// tetapi diekspos sebagai Record<string,string> agar aman diindeks nilai
// sembarang (mis. data lama) dengan pola fallback `?? riskColors.rendah`.
const defineRisk = (map: Record<RiskClass, string>): Record<string, string> => map;

/**
 * Sumber tunggal warna & label kelas risiko rob.
 * Dipakai peta publik, marker, legend, dan badge agar konsisten lintas halaman.
 * (Kartu hero Mode Awam sengaja memakai palet menenangkan tersendiri.)
 */
export const riskColors: Record<string, string> = defineRisk({
  sangat_tinggi: "#e52421",
  tinggi: "#f4510b",
  sedang: "#d97706",
  rendah: "#16a34a",
});

export const riskLabels: Record<string, string> = defineRisk({
  sangat_tinggi: "Sangat Tinggi",
  tinggi: "Tinggi",
  sedang: "Sedang",
  rendah: "Rendah",
});

/** Warna risk dengan fallback aman untuk key sembarang (mis. data lama). */
export function riskColor(value: string | null | undefined): string {
  return riskColors[value as RiskClass] ?? riskColors.rendah;
}
