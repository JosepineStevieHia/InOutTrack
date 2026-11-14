"use client";

import Link from "next/link";
import type { UserRole } from "@/lib/api";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export type ModulePlaceholderPageProps = {
  title: string;
  subtitle: string;
  allowedRoles: UserRole[];
  prdReference: string;
  nextStageNote: string;
};

export function ModulePlaceholderPage({
  title,
  subtitle,
  allowedRoles,
  prdReference,
  nextStageNote,
}: ModulePlaceholderPageProps) {
  const isAdminOnly =
    allowedRoles.length === 1 && allowedRoles[0] === "admin";

  return (
    <DashboardShell
      allowedRoles={allowedRoles}
      pageTitle={title}
      pageSubtitle={subtitle}
    >
      <div className="space-y-5">
        <Alert
          variant={isAdminOnly ? "warning" : "info"}
          title={
            isAdminOnly
              ? "Halaman Terproteksi: Khusus Staf Administrasi (Admin)"
              : "Halaman Operasional: Admin & Petugas Store/Security"
          }
        >
          Hak akses rute ini diverifikasi melalui{" "}
          <code className="font-mono text-xs">RoleGuard</code> pada frontend dan
          akan terhubung ke endpoint backend yang diproteksi middleware{" "}
          <code className="font-mono text-xs">
            role:{allowedRoles.join(",")}
          </code>{" "}
          ({prdReference}).
        </Alert>

        <EmptyState
          title={`Fondasi Halaman "${title}" Siap`}
          description={nextStageNote}
          action={
            <Link href="/dashboard">
              <Button variant="primary">Kembali ke Dashboard</Button>
            </Link>
          }
        />
      </div>
    </DashboardShell>
  );
}
