import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export default function AuditLogsPage() {
  return (
    <ModulePlaceholderPage
      title="Log Audit"
      subtitle="Catatan perubahan dan penghapusan transaksi oleh Admin"
      allowedRoles={["admin"]}
      prdReference="PRD FR-012, Bagian 7"
      nextStageNote="Daftar log audit (pengguna, waktu, jenis aksi, dan perbandingan old/new values) akan diimplementasikan bersama fitur ubah/hapus transaksi."
    />
  );
}
