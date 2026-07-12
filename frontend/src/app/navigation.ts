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
  { href: "#/history", icon: "history", label: "Riwayat Laporan", roles: ["warga"] },
  { href: "#/operator", icon: "assignment_turned_in", label: "Operator", roles: ["bpbd_operator"] },
  { href: "#/province", icon: "monitoring", label: "Provinsi", roles: ["bpbd_provinsi"] },
  { href: "#/research", icon: "database", label: "Arsip Data", roles: ["peneliti", "bpbd_provinsi"] },
  { href: "#/admin", icon: "manage_accounts", label: "Pengguna & Perizinan", roles: ["admin"] },
  { href: "#/audit", icon: "policy", label: "Audit", roles: ["admin"] }
];
