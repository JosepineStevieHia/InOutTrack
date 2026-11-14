"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { UserRole } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { LockShieldIcon } from "@/components/ui/Icons";
import { PageLoading } from "@/components/ui/LoadingState";
import { useAuth } from "./AuthProvider";

export type RoleGuardProps = {
  allowedRoles?: UserRole[];
  children: ReactNode;
};

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return <PageLoading message="Memverifikasi sesi autentikasi..." />;
  }

  if (!user) {
    return <PageLoading message="Mengalihkan ke halaman login..." />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <LockShieldIcon className="h-7 w-7" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-red-600">
            403 • Akses Ditolak
          </p>
          <h1 className="mt-1.5 text-lg font-bold text-slate-900">
            Halaman Khusus Staf Administrasi
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Akun Anda saat ini masuk sebagai{" "}
            <span className="font-semibold text-slate-800">
              {user.role_label}
            </span>
            . Anda tidak memiliki hak akses untuk membuka halaman pengelolaan ini.
          </p>
          <div className="mt-6 flex justify-center">
            <Link href="/dashboard">
              <Button variant="primary">Kembali ke Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
