import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export default function InboundTransactionPage() {
  return (
    <ModulePlaceholderPage
      title="Barang Masuk"
      subtitle="Form pencatatan barang masuk dengan foto kamera atau unggahan"
      allowedRoles={["admin", "petugas"]}
      prdReference="PRD FR-004, FR-006"
      nextStageNote="Form pencatatan barang masuk (asal barang, pengantar, penerima otomatis dari akun login, dan kamera/upload foto) akan diimplementasikan pada modul transaksi."
    />
  );
}
