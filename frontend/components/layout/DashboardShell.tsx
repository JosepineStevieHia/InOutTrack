"use client";

import { useState, type ReactNode } from "react";
import type { UserRole } from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

export type DashboardShellProps = {
  allowedRoles?: UserRole[];
  pageTitle?: string;
  pageSubtitle?: string;
  children: ReactNode;
};

function AuthenticatedShellContent({
  pageTitle,
  pageSubtitle,
  children,
}: Omit<DashboardShellProps, "allowedRoles">) {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        user={user}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Navbar
          user={user}
          pageTitle={pageTitle}
          pageSubtitle={pageSubtitle}
          mobileMenuOpen={mobileMenuOpen}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({
  allowedRoles,
  pageTitle,
  pageSubtitle,
  children,
}: DashboardShellProps) {
  return (
    <RoleGuard allowedRoles={allowedRoles}>
      <AuthenticatedShellContent
        pageTitle={pageTitle}
        pageSubtitle={pageSubtitle}
      >
        {children}
      </AuthenticatedShellContent>
    </RoleGuard>
  );
}
