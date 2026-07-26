export type NavItem = {
  href: string;
  icon: string;
  label: string;
  roles?: string[];
};

export const navItems: NavItem[] = [
  { href: "#/map", icon: "map", label: "Peta Risiko", roles: ["guest", "warga", "bpbd_operator", "bpbd_provinsi", "peneliti", "admin"] },
  { href: "#/awam", icon: "person_pin_circle", label: "Mode Awam", roles: ["guest", "warga"] },
  { href: "#/onboarding", icon: "help", label: "Panduan", roles: ["guest", "warga"] },
  { href: "#/reports", icon: "add_location_alt", label: "Lapor", roles: ["warga"] },
  // Riwayat terbuka untuk semua role login: #/reports sengaja dibuka untuk
  // semua pengguna login (pelaporan darurat), jadi CTA "Lihat Riwayat" pasca
  // kirim laporan tidak boleh memantulkan petugas ke landing page.
  { href: "#/history", icon: "history", label: "Riwayat Laporan", roles: ["warga", "bpbd_operator", "bpbd_provinsi", "peneliti", "admin"] },
  { href: "#/operator", icon: "assignment_turned_in", label: "Operator", roles: ["bpbd_operator", "admin"] },
  { href: "#/province", icon: "monitoring", label: "Pantauan Provinsi", roles: ["bpbd_provinsi", "admin"] },
  // bpbd_provinsi memang diizinkan backend mengakses arsip riset (routes/api.php).
  { href: "#/research", icon: "database", label: "Arsip Data", roles: ["peneliti", "bpbd_provinsi", "admin"] },
  { href: "#/admin", icon: "manage_accounts", label: "Pengguna & Perizinan", roles: ["admin"] },
  { href: "#/audit", icon: "policy", label: "Audit", roles: ["admin"] }
];
