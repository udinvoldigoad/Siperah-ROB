export type NavItem = {
  href: string;
  icon: string;
  label: string;
  roles?: string[];
};

export const navItems: NavItem[] = [
  { href: "#/map", icon: "map", label: "Peta Risiko", roles: ["guest", "warga", "peneliti", "admin"] },
  { href: "#/awam", icon: "person_pin_circle", label: "Mode Awam", roles: ["guest", "warga", "admin"] },
  { href: "#/onboarding", icon: "help", label: "Panduan", roles: ["guest", "warga", "admin"] },
  { href: "#/reports", icon: "add_location_alt", label: "Lapor", roles: ["warga", "admin"] },
  { href: "#/history", icon: "history", label: "Riwayat Laporan", roles: ["warga", "peneliti", "admin"] },
  { href: "#/operator", icon: "assignment_turned_in", label: "Operator", roles: ["admin"] },
  // Peran bpbd_provinsi dihapus saat penyederhanaan 5 peran -> 3, dan halaman
  // ini sempat ikut kehilangan rutenya. Pantauannya masih dibutuhkan, jadi
  // dikembalikan sebagai menu admin (endpoint-nya memang sudah role:admin).
  { href: "#/province", icon: "monitoring", label: "Pantauan Provinsi", roles: ["admin"] },
  { href: "#/research", icon: "database", label: "Arsip Data", roles: ["peneliti", "admin"] },
  { href: "#/admin", icon: "manage_accounts", label: "Pengguna & Perizinan", roles: ["admin"] },
  { href: "#/audit", icon: "policy", label: "Audit", roles: ["admin"] }
];

