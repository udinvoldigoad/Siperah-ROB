export type NavItem = {
  href: string;
  icon: string;
  label: string;
  roles?: string[];
};

export const navItems: NavItem[] = [
  { href: "#/map", icon: "map", label: "Peta Risiko", roles: ["warga", "bpbd_operator", "bpbd_provinsi", "peneliti", "admin"] },
  { href: "#/awam", icon: "person_pin_circle", label: "Mode Awam", roles: ["warga"] },
  { href: "#/onboarding", icon: "help", label: "Panduan", roles: ["warga"] },
  { href: "#/reports", icon: "add_location_alt", label: "Lapor", roles: ["warga"] },
  { href: "#/history", icon: "history", label: "Riwayat Laporan", roles: ["warga"] },
  { href: "#/operator", icon: "assignment_turned_in", label: "Operator", roles: ["bpbd_operator"] },
  { href: "#/province", icon: "monitoring", label: "Provinsi", roles: ["bpbd_provinsi"] },
  { href: "#/research", icon: "database", label: "Data & API", roles: ["peneliti", "bpbd_provinsi"] },
  { href: "#/notifications", icon: "notifications", label: "Notifikasi", roles: ["warga", "bpbd_operator", "bpbd_provinsi", "admin"] },
  { href: "#/admin", icon: "manage_accounts", label: "Manajemen Pengguna", roles: ["admin"] },
  { href: "#/audit", icon: "policy", label: "Audit", roles: ["admin"] }
];
