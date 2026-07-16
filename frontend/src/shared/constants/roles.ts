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
