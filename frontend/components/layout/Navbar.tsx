"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { AuthUser } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LogoutIcon, MenuIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/ToastProvider";
import { findNavItemByPath } from "./navigation";

type NavbarProps = {
  user: AuthUser;
  pageTitle?: string;
  pageSubtitle?: string;
  mobileMenuOpen: boolean;
  onOpenMobileMenu: () => void;
};

export function Navbar({
  user,
  pageTitle,
  pageSubtitle,
  mobileMenuOpen,
  onOpenMobileMenu,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const toast = useToast();

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navInfo = findNavItemByPath(pathname);
  const title = pageTitle ?? navInfo?.label ?? "InOutTrack";
  const subtitle = pageSubtitle ?? navInfo?.description;

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      setLogoutDialogOpen(false);
      toast.success("Logout berhasil", "Sesi Anda telah diakhiri dengan aman.");
      router.replace("/login");
    } catch {
      toast.error(
        "Gagal keluar",
        "Terjadi kendala saat mengakhiri sesi. Silakan coba lagi.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Buka menu navigasi"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-sidebar-drawer"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
            >
              <MenuIcon className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                {title}
              </h1>
              {subtitle && (
                <p className="hidden truncate text-xs text-slate-500 sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 md:flex">
              <span
                className={`h-2 w-2 rounded-full ${
                  user.role === "admin" ? "bg-indigo-600" : "bg-amber-500"
                }`}
              />
              <span className="text-xs font-semibold text-slate-700">
                {user.name}
              </span>
              <span className="text-slate-300">•</span>
              <span
                className={`text-xs font-semibold ${
                  user.role === "admin" ? "text-indigo-700" : "text-amber-700"
                }`}
              >
                {user.role === "admin" ? "Admin" : "Petugas"}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogoutDialogOpen(true)}
              leftIcon={<LogoutIcon className="h-4 w-4" />}
            >
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      <ConfirmDialog
        open={logoutDialogOpen}
        onCancel={() => setLogoutDialogOpen(false)}
        onConfirm={handleConfirmLogout}
        title="Keluar dari InOutTrack?"
        description="Sesi Anda akan diakhiri. Anda perlu login kembali untuk mencatat atau memantau transaksi barang."
        confirmLabel="Ya, Keluar"
        cancelLabel="Batal"
        variant="danger"
        isLoading={isLoggingOut}
      />
    </>
  );
}
