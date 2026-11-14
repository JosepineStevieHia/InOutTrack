import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export default function TransactionsPage() {
  return (
    <ModulePlaceholderPage
      title="Riwayat Transaksi"
      subtitle="Penelusuran riwayat gabungan barang masuk dan keluar"
      allowedRoles={["admin", "petugas"]}
      prdReference="PRD FR-007, FR-008"
      nextStageNote="Tabel riwayat gabungan, pencarian teks bebas, filter multi-kriteria, dan detail foto transaksi akan diimplementasikan pada modul transaksi."
    />
  );
}
