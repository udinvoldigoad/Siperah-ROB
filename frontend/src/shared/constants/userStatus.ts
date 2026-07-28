/**
 * Sumber tunggal label status akun pengguna. Nilai mentahnya huruf kecil
 * ('aktif', 'menunggu', …) karena berasal dari enum Postgres; tanpa peta ini
 * badge di tabel pengguna menampilkan teks mentah sementara filter, tombol, dan
 * kartu KPI di halaman yang sama sudah berkapitalisasi.
 *
 * Sejajar dengan `roleLabels` di [roles.ts](./roles.ts).
 */
export const userStatusLabels: Record<string, string> = {
  aktif: "Aktif",
  menunggu: "Menunggu",
  nonaktif: "Nonaktif",
  ditolak: "Ditolak",
};

/** Urutan tampil untuk dropdown filter. */
export const userStatusOptions = Object.entries(userStatusLabels);

export function userStatusLabel(status: string | null | undefined): string {
  if (!status) return "-";
  return userStatusLabels[status] ?? status;
}
