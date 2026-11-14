import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { PageLoading } from "@/components/ui/LoadingState";
import { ToastProvider } from "@/components/ui/ToastProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InOutTrack — Sistem Pemantauan Barang Masuk & Keluar",
  description:
    "Aplikasi pemantauan pergerakan barang masuk dan keluar di lingkungan perusahaan manufaktur.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900">
        <ToastProvider>
          <AuthProvider>
            <Suspense fallback={<PageLoading message="Menyiapkan InOutTrack..." />}>
              {children}
            </Suspense>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
