/**
 * Sumber tunggal label peran pengguna. Dipakai sidebar akun, manajemen
 * pengguna, dan audit log agar peran yang sama tampil sama di semua halaman.
 */
export const roleLabels: Record<string, string> = {
  warga: "Warga",
  admin: "Admin Sistem",
  peneliti: "Peneliti",
  // AuditService menulis actor_role 'guest' untuk aksi tanpa login
  // (mis. percobaan login gagal) — tanpa entri ini badge tampil "guest" mentah.
  guest: "Tamu",
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
    case "peneliti":
      return "#/research";
    case "warga":
      return "#/map";
    default:
      return "#/map";
  }
}
