import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export default function UsersPage() {
  return (
    <ModulePlaceholderPage
      title="Manajemen Akun"
      subtitle="Pengelolaan akun Admin dan Petugas Store/Security"
      allowedRoles={["admin"]}
      prdReference="PRD FR-003, Bagian 8.6"
      nextStageNote="CRUD manajemen akun pengguna (penetapan role Admin/Petugas, aktif/nonaktif akun) akan diimplementasikan pada modul manajemen akun."
    />
  );
}
