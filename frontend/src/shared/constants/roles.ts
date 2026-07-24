/**
 * Sumber tunggal label peran pengguna. Dipakai sidebar akun, manajemen
 * pengguna, dan audit log agar peran yang sama tampil sama di semua halaman
 * (sebelumnya AppShell pakai "Operator BPBD" sementara halaman lain pakai
 * ".replace()" ad-hoc yang menghasilkan "BPBD operator" — beda urutan & huruf).
 */
export const roleLabels: Record<string, string> = {
  warga: "Warga",
  bpbd_operator: "Operator BPBD",
  bpbd_provinsi: "BPBD Provinsi",
  admin: "Admin Sistem",
  peneliti: "Peneliti",
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "-";
  return roleLabels[role] ?? role;
}

/**
 * Rute dashboard tujuan setelah login sesuai peran. Dipakai login
 * email/password maupun callback Google OAuth agar keduanya konsisten
 * mengarahkan langsung ke dashboard peran (bukan balik ke landing).
 * Warga & peran tak dikenal jatuh ke peta risiko (#/map).
 */
export function dashboardHashForRole(role: string | null | undefined): string {
  switch (role) {
    case "admin":
      return "#/admin";
    case "bpbd_operator":
      return "#/operator";
    case "bpbd_provinsi":
      return "#/province";
    case "peneliti":
      return "#/research";
    case "warga":
      return "#/map";
    default:
      return "#/map";
  }
}
