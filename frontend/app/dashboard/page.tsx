"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { SelectInput, TextInput } from "@/components/ui/FormField";
import {
  AuditIcon,
  ExportIcon,
  HistoryIcon,
  InboundIcon,
  OutboundIcon,
  SearchIcon,
  UsersIcon,
} from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ui/ToastProvider";

type FoundationPreviewRow = {
  id: string;
  modul: string;
  akses: string;
  status: "Siap" | "Tahap Berikutnya";
};

const FOUNDATION_MODULES: FoundationPreviewRow[] = [
  {
    id: "MOD-1",
    modul: "Autentikasi & Sesi Sanctum SPA",
    akses: "Admin & Petugas",
    status: "Siap",
  },
  {
    id: "MOD-2",
    modul: "Pencatatan Barang Masuk & Keluar",
    akses: "Admin & Petugas",
    status: "Tahap Berikutnya",
  },
  {
    id: "MOD-3",
    modul: "Manajemen Akun & Jenis Pekerjaan",
    akses: "Khusus Admin",
    status: "Tahap Berikutnya",
  },
  {
    id: "MOD-4",
    modul: "Ekspor PDF/Excel & Log Audit",
    akses: "Khusus Admin",
    status: "Tahap Berikutnya",
  },
];

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  // State UI untuk menguji komponen foundation (loading, empty state, modal, konfirmasi, form)
  const [tableLoading, setTableLoading] = useState(false);
  const [showEmptyDemo, setShowEmptyDemo] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!user) return null;

  const filteredRows = showEmptyDemo
    ? []
    : FOUNDATION_MODULES.filter((row) => {
        const matchSearch = row.modul
          .toLowerCase()
          .includes(searchFilter.toLowerCase());
        const matchRole =
          roleFilter === "all" ||
          (roleFilter === "admin" && row.akses.includes("Khusus Admin")) ||
          (roleFilter === "all_roles" && row.akses === "Admin & Petugas");
        return matchSearch && matchRole;
      });

  const columns: TableColumn<FoundationPreviewRow>[] = [
    {
      key: "id",
      header: "Kode",
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-600">
          {row.id}
        </span>
      ),
    },
    {
      key: "modul",
      header: "Komponen / Modul",
      render: (row) => (
        <span className="font-medium text-slate-900">{row.modul}</span>
      ),
    },
    {
      key: "akses",
      header: "Hak Akses (PRD)",
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            row.akses === "Khusus Admin"
              ? "bg-indigo-50 text-indigo-700"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {row.akses}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            row.status === "Siap"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <DashboardShell
      pageTitle="Dashboard"
      pageSubtitle={
        isAdmin
          ? "Ringkasan operasional, kontrol akses, dan pengelolaan administrasi InOutTrack"
          : "Ringkasan pencatatan operasional harian untuk Petugas Store & Security"
      }
    >
      <div className="space-y-6">
        {/* Banner sapaan sesuai role */}
        <Alert
          variant={isAdmin ? "info" : "success"}
          title={`Selamat datang, ${user.name}`}
        >
          Anda masuk sebagai{" "}
          <strong className="font-semibold">{user.role_label}</strong>.{" "}
          {isAdmin
            ? "Menu administrasi (Ekspor PDF/Excel, Jenis Pekerjaan, Manajemen Akun, dan Log Audit) tersedia pada navigasi Anda."
            : "Anda memiliki akses operasional untuk pencatatan Barang Masuk, Barang Keluar, dan penelusuran Riwayat Transaksi."}
        </Alert>

        {/* Kartu Ringkasan (Summary Cards) */}
        <section aria-labelledby="ringkasan-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="ringkasan-heading"
              className="text-sm font-semibold uppercase tracking-wider text-slate-500"
            >
              Ringkasan Pencatatan (Fondasi UI)
            </h2>
            <span className="text-xs text-slate-500">
              Data transaksi aktual akan terhubung pada modul transaksi
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              title="Total Pencatatan"
              value="0"
              badgeText="Periode Aktif"
              subtitle="Gabungan transaksi masuk & keluar tercatat"
              icon={<HistoryIcon className="h-5 w-5" />}
              variant="default"
              isLoading={tableLoading}
            />
            <SummaryCard
              title="Barang Masuk"
              value="0"
              badgeText="MASUK"
              subtitle="Penerimaan barang dari vendor/pengantar"
              icon={<InboundIcon className="h-5 w-5" />}
              variant="inbound"
              isLoading={tableLoading}
            />
            <SummaryCard
              title="Barang Keluar"
              value="0"
              badgeText="KELUAR"
              subtitle="Pengeluaran barang untuk unit kerja/tujuan"
              icon={<OutboundIcon className="h-5 w-5" />}
              variant="outbound"
              isLoading={tableLoading}
            />
          </div>
        </section>

        {/* Aksi Cepat Terpisah Berdasarkan Role */}
        <section
          aria-labelledby="aksi-cepat-heading"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6"
        >
          <h2
            id="aksi-cepat-heading"
            className="text-base font-bold text-slate-900"
          >
            Akses Cepat {isAdmin ? "Staf Administrasi & Operasional" : "Petugas Store / Security"}
          </h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Navigasi dan tombol aksi otomatis menyesuaikan hak akses akun Anda.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/transactions/in"
              className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 transition-colors hover:bg-emerald-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <InboundIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Catat Barang Masuk
                </p>
                <p className="text-xs text-slate-600">Form &amp; foto bukti</p>
              </div>
            </Link>

            <Link
              href="/transactions/out"
              className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 transition-colors hover:bg-amber-50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white">
                <OutboundIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Catat Barang Keluar
                </p>
                <p className="text-xs text-slate-600">Form &amp; foto bukti</p>
              </div>
            </Link>

            <Link
              href="/transactions"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 transition-colors hover:bg-slate-100"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white">
                <SearchIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Riwayat Transaksi
                </p>
                <p className="text-xs text-slate-600">Cari &amp; filter data</p>
              </div>
            </Link>

            {isAdmin && (
              <Link
                href="/exports"
                className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 transition-colors hover:bg-indigo-50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                  <ExportIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Ekspor PDF / Excel
                  </p>
                  <p className="text-xs text-slate-600">Khusus Admin</p>
                </div>
              </Link>
            )}
          </div>

          {isAdmin && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href="/users"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5">
                  <UsersIcon className="h-4.5 w-4.5 text-indigo-600" />
                  Manajemen Akun Pengguna
                </span>
                <span className="text-xs text-indigo-600">Khusus Admin →</span>
              </Link>

              <Link
                href="/audit-logs"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5">
                  <AuditIcon className="h-4.5 w-4.5 text-indigo-600" />
                  Tinjau Log Audit Transaksi
                </span>
                <span className="text-xs text-indigo-600">Khusus Admin →</span>
              </Link>
            </div>
          )}
        </section>

        {/* Pratinjau Komponen Tabel, Form Filter, Modal, Konfirmasi, Notifikasi, Loading & Empty State */}
        <section
          aria-labelledby="komponen-heading"
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="komponen-heading"
                className="text-base font-bold text-slate-900"
              >
                Status Kesiapan Modul &amp; Uji Komponen UI
              </h2>
              <p className="text-xs text-slate-500 sm:text-sm">
                Demonstrasi komponen Tabel, Form, Modal, Konfirmasi, Notifikasi,
                Loading State, dan Empty State.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTableLoading((prev) => !prev)}
              >
                {tableLoading ? "Matikan Loading" : "Simulasi Loading"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmptyDemo((prev) => !prev)}
              >
                {showEmptyDemo ? "Tampilkan Data" : "Simulasi Empty State"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPreviewModalOpen(true)}
              >
                Buka Modal
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmOpen(true)}
              >
                Uji Konfirmasi
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  toast.success(
                    "Notifikasi Berhasil",
                    "Komponen toast notifikasi siap digunakan.",
                  )
                }
              >
                Uji Notifikasi
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput
              label="Pencarian Modul"
              placeholder="Cari nama modul..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
            <SelectInput
              label="Filter Hak Akses"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[
                { value: "all", label: "Semua Hak Akses" },
                { value: "all_roles", label: "Admin & Petugas" },
                { value: "admin", label: "Khusus Admin" },
              ]}
            />
          </div>

          <DataTable
            columns={columns}
            data={filteredRows}
            rowKey={(row) => row.id}
            isLoading={tableLoading}
            skeletonRows={4}
            emptyState={{
              title: "Data tidak ditemukan",
              description:
                "Tidak ada modul yang cocok dengan filter aktif atau sedang dalam simulasi kosong.",
              action: (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowEmptyDemo(false);
                    setSearchFilter("");
                    setRoleFilter("all");
                  }}
                >
                  Reset Filter
                </Button>
              ),
            }}
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>Menampilkan {filteredRows.length} komponen modul</span>
                <span>Role aktif: {user.role_label}</span>
              </div>
            }
          />
        </section>
      </div>

      {/* Modal Detail UI Foundation */}
      <Modal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="Pratinjau Komponen Modal"
        description="Modal ini dibangun menggunakan elemen HTML <dialog> native dengan aksesibilitas penuh dan pencegahan scroll halaman di belakang."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setPreviewModalOpen(false)}
            >
              Tutup
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setPreviewModalOpen(false);
                toast.info("Modal ditutup", "Aksi modal berhasil dijalankan.");
              }}
            >
              Simpan Contoh
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            Komponen modal mendukung tombol <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold">Esc</kbd>,
            klik di luar dialog, serta manajemen fokus otomatis.
          </p>
          <TextInput
            label="Contoh Field Read-Only (Otomatis dari Akun Login)"
            value={`${user.name} (@${user.username})`}
            readOnly
            helperText="Sesuai PRD Bagian 8.1/8.2: nama penerima/pemberi diambil otomatis dan tidak dapat diubah Petugas."
          />
        </div>
      </Modal>

      {/* Dialog Konfirmasi */}
      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          toast.warning(
            "Konfirmasi Diterima",
            "Contoh dialog konfirmasi telah dikonfirmasi.",
          );
        }}
        title="Konfirmasi Tindakan Penting"
        description="Dialog ini akan digunakan untuk konfirmasi penghapusan (soft delete), penonaktifan akun, atau logout."
        confirmLabel="Ya, Konfirmasi"
        cancelLabel="Batal"
        variant="danger"
      />
    </DashboardShell>
  );
}
