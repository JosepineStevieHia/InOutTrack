import type { ComponentType, SVGProps } from "react";
import type { UserRole } from "@/lib/api";
import {
  AuditIcon,
  DashboardIcon,
  ExportIcon,
  HistoryIcon,
  InboundIcon,
  OutboundIcon,
  UsersIcon,
  WorkTypeIcon,
} from "@/components/ui/Icons";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  roles: UserRole[];
  section: "operasional" | "administrasi";
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Ringkasan pencatatan dan akses cepat operasional",
    roles: ["admin", "petugas"],
    section: "operasional",
    icon: DashboardIcon,
  },
  {
    href: "/transactions/in",
    label: "Barang Masuk",
    description: "Pencatatan penerimaan barang beserta foto bukti",
    roles: ["admin", "petugas"],
    section: "operasional",
    icon: InboundIcon,
  },
  {
    href: "/transactions/out",
    label: "Barang Keluar",
    description: "Pencatatan pengeluaran barang beserta foto bukti",
    roles: ["admin", "petugas"],
    section: "operasional",
    icon: OutboundIcon,
  },
  {
    href: "/transactions",
    label: "Riwayat Transaksi",
    description: "Penelusuran gabungan barang masuk dan keluar",
    roles: ["admin", "petugas"],
    section: "operasional",
    icon: HistoryIcon,
  },
  {
    href: "/exports",
    label: "Ekspor Laporan",
    description: "Unduh riwayat transaksi ke PDF dan Excel",
    roles: ["admin"],
    section: "administrasi",
    icon: ExportIcon,
  },
  {
    href: "/work-types",
    label: "Jenis Pekerjaan",
    description: "Kelola master daftar jenis pekerjaan transaksi",
    roles: ["admin"],
    section: "administrasi",
    icon: WorkTypeIcon,
  },
  {
    href: "/users",
    label: "Manajemen Akun",
    description: "Kelola akun Admin, Petugas, dan status aktif",
    roles: ["admin"],
    section: "administrasi",
    icon: UsersIcon,
  },
  {
    href: "/audit-logs",
    label: "Log Audit",
    description: "Jejak perubahan dan penghapusan transaksi",
    roles: ["admin"],
    section: "administrasi",
    icon: AuditIcon,
  },
];

export function getNavItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function findNavItemByPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === pathname);
}
