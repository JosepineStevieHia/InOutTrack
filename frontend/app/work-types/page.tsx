import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export default function WorkTypesPage() {
  return (
    <ModulePlaceholderPage
      title="Jenis Pekerjaan"
      subtitle="Pengelolaan master data jenis pekerjaan transaksi"
      allowedRoles={["admin"]}
      prdReference="PRD FR-013, Bagian 8.6"
      nextStageNote="CRUD master jenis pekerjaan (tambah, ubah, aktif/nonaktifkan) khusus Admin akan diimplementasikan pada modul master data."
    />
  );
}
