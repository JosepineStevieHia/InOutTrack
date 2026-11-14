import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export default function ExportsPage() {
  return (
    <ModulePlaceholderPage
      title="Ekspor Laporan"
      subtitle="Ekspor riwayat transaksi ke PDF dan Excel sesuai filter aktif"
      allowedRoles={["admin"]}
      prdReference="PRD FR-010, Bagian 8.5"
      nextStageNote="Fitur ekspor PDF dan Excel (khusus Staf Administrasi, maks 10.000 baris) akan diimplementasikan setelah modul riwayat transaksi tersedia."
    />
  );
}
