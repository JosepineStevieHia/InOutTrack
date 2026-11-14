"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import type { AuthUser } from "@/lib/api";
import { BrandLogoIcon, CloseIcon } from "@/components/ui/Icons";
import { getNavItemsForRole, type NavItem } from "./navigation";

type SidebarProps = {
  user: AuthUser;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

function NavSection({
  title,
  items,
  pathname,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon
                  className={`h-4.5 w-4.5 shrink-0 ${
                    isActive
                      ? "text-white"
                      : "text-slate-400 group-hover:text-slate-700"
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SidebarContent({
  user,
  pathname,
  onCloseMobile,
  isDrawer = false,
}: {
  user: AuthUser;
  pathname: string;
  onCloseMobile?: () => void;
  isDrawer?: boolean;
}) {
  const navItems = getNavItemsForRole(user.role);
  const operasionalItems = navItems.filter(
    (item) => item.section === "operasional",
  );
  const administrasiItems = navItems.filter(
    (item) => item.section === "administrasi",
  );

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4">
        <Link
          href="/dashboard"
          onClick={onCloseMobile}
          className="flex items-center gap-2.5"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <BrandLogoIcon className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-slate-900">
              InOutTrack
            </span>
            <span className="block text-[11px] font-medium text-slate-500">
              Logistik Manufaktur
            </span>
          </div>
        </Link>

        {isDrawer && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            autoFocus
            aria-label="Tutup menu navigasi"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav
        aria-label="Navigasi utama"
        className="flex-1 space-y-6 overflow-y-auto px-3 py-5"
      >
        <NavSection
          title="Operasional"
          items={operasionalItems}
          pathname={pathname}
          onNavigate={onCloseMobile}
        />

        {user.role === "admin" && (
          <NavSection
            title="Administrasi (Admin)"
            items={administrasiItems}
            pathname={pathname}
            onNavigate={onCloseMobile}
          />
        )}
      </nav>

      <div className="border-t border-slate-200 p-3.5">
        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                user.role === "admin"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() ?? "")
                .join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900">
                {user.name}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                @{user.username}
              </p>
            </div>
          </div>
          <div className="mt-2.5">
            <span
              className={`inline-flex w-full items-center justify-center rounded-lg px-2 py-1 text-[11px] font-semibold ${
                user.role === "admin"
                  ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70"
                  : "bg-amber-50 text-amber-800 ring-1 ring-amber-200/70"
              }`}
            >
              {user.role_label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ user, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drawerLabelId = useId();

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;

    if (mobileOpen && !dialog.open) {
      dialog.showModal();
    } else if (!mobileOpen && dialog.open) {
      dialog.close();
    }
  }, [mobileOpen]);

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;

    const handleClose = () => {
      if (mobileOpen) {
        onMobileClose();
      }
    };

    const handleBackdropClick = (event: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(event.target as Node)) {
        onMobileClose();
      }
    };

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("click", handleBackdropClick);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("click", handleBackdropClick);
    };
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col">
        <SidebarContent user={user} pathname={pathname} />
      </aside>

      {/* Mobile & tablet navigation drawer menggunakan native modal <dialog> */}
      <dialog
        ref={drawerRef}
        id="mobile-sidebar-drawer"
        aria-labelledby={drawerLabelId}
        className="nav-drawer lg:hidden"
      >
        <span id={drawerLabelId} className="sr-only">
          Menu Navigasi InOutTrack
        </span>
        <div ref={sheetRef} className="h-full w-full">
          <SidebarContent
            user={user}
            pathname={pathname}
            onCloseMobile={onMobileClose}
            isDrawer
          />
        </div>
      </dialog>
    </>
  );
}
