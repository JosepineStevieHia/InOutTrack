"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { TransactionDetailModal } from "@/components/transactions/TransactionDetailModal";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { SelectInput, TextInput } from "@/components/ui/FormField";
import {
  AuditIcon,
  ExportIcon,
  EyeIcon,
  HistoryIcon,
  InboundIcon,
  OutboundIcon,
  RefreshIcon,
  SearchIcon,
  UsersIcon,
  WorkTypeIcon,
} from "@/components/ui/Icons";
import { SummaryCard } from "@/components/ui/SummaryCard";
import {
  ApiError,
  getDashboardSummary,
  type TransactionListSummary,
  type TransactionRecord,
} from "@/lib/api";
import {
  formatTransactionDate,
  formatTransactionTime,
  getCounterpartyInfo,
  getOfficerDisplayName,
  getPeriodDateRange,
  type PeriodPreset,
} from "@/lib/transaction-utils";

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [summary, setSummary] = useState<TransactionListSummary | null>(null);
  const [periodLabel, setPeriodLabel] = useState("Semua Periode");
  const [recentTransactions, setRecentTransactions] = useState<
    TransactionRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<TransactionRecord | null>(
    null,
  );

  const dateRangeWarning =
    dateFrom && dateTo && dateFrom > dateTo
      ? "Tanggal awal lebih besar daripada tanggal akhir."
      : null;

  useEffect(() => {
    if (!user) return;
    let active = true;

    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setIsLoading(true);
        setFetchError(null);
        return getDashboardSummary({
          date_from: dateFrom,
          date_to: dateTo,
        });
      })
      .then((res) => {
        if (!active || !res) return;
        setSummary(res.summary);
        setPeriodLabel(res.period.label);
        setRecentTransactions(res.recent_transactions);
      })
      .catch((err) => {
        if (!active) return;
        setFetchError(
          err instanceof ApiError
            ? err.message
            : "Gagal memuat ringkasan dashboard.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, dateFrom, dateTo, reloadKey]);

  const handlePresetChange = (value: string) => {
    const preset = value as PeriodPreset;
    setPeriodPreset(preset);
    if (preset === "custom") return;

    const range = getPeriodDateRange(preset);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
  };

  const handleResetPeriod = () => {
    setPeriodPreset("all");
    setDateFrom("");
    setDateTo("");
  };

  const columns: TableColumn<TransactionRecord>[] = useMemo(
    () => [
      {
        key: "type",
        header: "Jenis",
        render: (row) =>
          row.type === "MASUK" ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <InboundIcon className="h-3.5 w-3.5 shrink-0" />
              Barang Masuk
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              <OutboundIcon className="h-3.5 w-3.5 shrink-0" />
              Barang Keluar
            </span>
          ),
      },
      {
        key: "datetime",
        header: "Tanggal & Waktu",
        render: (row) => (
          <div className="whitespace-nowrap">
            <p className="font-medium text-slate-900">
              {formatTransactionDate(row.transaction_datetime)}
            </p>
            <p className="text-xs text-slate-500">
              {formatTransactionTime(row.transaction_datetime)}
            </p>
          </div>
        ),
      },
      {
        key: "item",
        header: "Nama Barang & Jumlah",
        render: (row) => (
          <div>
            <p className="font-semibold text-slate-900">{row.item_name}</p>
            <p className="text-xs text-slate-500">
              {row.quantity_formatted} {row.unit} •{" "}
              {row.work_type?.name ?? "-"}
            </p>
          </div>
        ),
      },
      {
        key: "party",
        header: "Asal / Tujuan",
        render: (row) => {
          const info = getCounterpartyInfo(row);
          return (
            <div>
              <p className="font-medium text-slate-800">{info.location}</p>
              <p className="text-xs text-slate-500">
                Petugas: {getOfficerDisplayName(row)}
              </p>
            </div>
          );
        },
      },
      {
        key: "action",
        header: "Detail",
        align: "right",
        render: (row) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDetailTarget(row)}
              leftIcon={<EyeIcon className="h-3.5 w-3.5" />}
            >
              Detail
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  if (!user) return null;

  return (
    <DashboardShell
      pageTitle="Dashboard"
      pageSubtitle={
        isAdmin
          ? "Ringkasan operasional, kontrol akses, dan ekspor laporan InOutTrack"
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
            ? "Anda dapat memantau ringkasan periode, mengelola akun & jenis pekerjaan, serta mengekspor riwayat ke PDF dan Excel."
            : "Anda dapat mencatat Barang Masuk, Barang Keluar, dan memantau riwayat pencatatan sesuai periode."}
        </Alert>

        {/* Filter Periode Dashboard (FR-009 & Bagian 8.5) */}
        <section
          aria-label="Filter Periode Dashboard"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Filter Periode Ringkasan
              </h2>
              <p className="text-xs text-slate-500">
                Periode aktif:{" "}
                <span
                  className="font-semibold text-blue-700"
                  data-testid="dashboard-period-label"
                >
                  {periodLabel}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReloadKey((prev) => prev + 1)}
                leftIcon={<RefreshIcon className="h-4 w-4" />}
              >
                Muat Ulang
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetPeriod}
                disabled={periodPreset === "all" && !dateFrom && !dateTo}
                data-testid="dashboard-reset-period-button"
              >
                Reset Periode
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SelectInput
              label="Pilih Periode"
              value={periodPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              options={[
                { value: "all", label: "Semua Waktu" },
                { value: "today", label: "Hari Ini" },
                { value: "7d", label: "7 Hari Terakhir" },
                { value: "30d", label: "30 Hari Terakhir" },
                { value: "this_month", label: "Bulan Ini" },
                { value: "custom", label: "Rentang Tanggal Kustom" },
              ]}
              data-testid="dashboard-period-preset"
            />

            <TextInput
              type="date"
              label="Dari Tanggal"
              value={dateFrom}
              onChange={(e) => {
                setPeriodPreset("custom");
                setDateFrom(e.target.value);
              }}
              data-testid="dashboard-date-from"
            />

            <TextInput
              type="date"
              label="Sampai Tanggal"
              value={dateTo}
              onChange={(e) => {
                setPeriodPreset("custom");
                setDateTo(e.target.value);
              }}
              data-testid="dashboard-date-to"
            />
          </div>

          {dateRangeWarning && (
            <div className="mt-3">
              <Alert variant="warning" title="Periksa Rentang Tanggal">
                {dateRangeWarning}
              </Alert>
            </div>
          )}
        </section>

        {fetchError && (
          <Alert variant="error" title="Gagal Memuat Ringkasan">
            {fetchError}
          </Alert>
        )}

        {/* Kartu Ringkasan (Total Transaksi, Barang Masuk, Barang Keluar) */}
        <section aria-labelledby="ringkasan-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="ringkasan-heading"
              className="text-sm font-semibold uppercase tracking-wider text-slate-500"
            >
              Ringkasan Transaksi
            </h2>
            <span className="text-xs text-slate-500">{periodLabel}</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div data-testid="summary-card-total">
              <SummaryCard
                title="Total Transaksi"
                value={summary?.total ?? 0}
                badgeText={periodLabel}
                subtitle="Gabungan barang masuk & keluar pada periode"
                icon={<HistoryIcon className="h-5 w-5" />}
                variant="default"
                isLoading={isLoading && !summary}
              />
            </div>
            <div data-testid="summary-card-masuk">
              <SummaryCard
                title="Total Barang Masuk"
                value={summary?.masuk ?? 0}
                badgeText="MASUK"
                subtitle="Penerimaan barang tercatat pada periode"
                icon={<InboundIcon className="h-5 w-5" />}
                variant="inbound"
                isLoading={isLoading && !summary}
              />
            </div>
            <div data-testid="summary-card-keluar">
              <SummaryCard
                title="Total Barang Keluar"
                value={summary?.keluar ?? 0}
                badgeText="KELUAR"
                subtitle="Pengeluaran barang tercatat pada periode"
                icon={<OutboundIcon className="h-5 w-5" />}
                variant="outbound"
                isLoading={isLoading && !summary}
              />
            </div>
          </div>
        </section>

        {/* Aksi Cepat Berdasarkan Role */}
        <section
          aria-labelledby="aksi-cepat-heading"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6"
        >
          <h2
            id="aksi-cepat-heading"
            className="text-base font-bold text-slate-900"
          >
            Akses Cepat {isAdmin ? "Admin & Operasional" : "Petugas Store / Security"}
          </h2>

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
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Link
                href="/users"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5">
                  <UsersIcon className="h-4.5 w-4.5 text-indigo-600" />
                  Manajemen Akun
                </span>
                <span className="text-xs text-indigo-600">Kelola →</span>
              </Link>

              <Link
                href="/work-types"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5">
                  <WorkTypeIcon className="h-4.5 w-4.5 text-indigo-600" />
                  Jenis Pekerjaan
                </span>
                <span className="text-xs text-indigo-600">Kelola →</span>
              </Link>

              <Link
                href="/audit-logs"
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span className="flex items-center gap-2.5">
                  <AuditIcon className="h-4.5 w-4.5 text-indigo-600" />
                  Log Audit
                </span>
                <span className="text-xs text-indigo-600">Tinjau →</span>
              </Link>
            </div>
          )}
        </section>

        {/* 5 Transaksi Terbaru pada Periode Terpilih */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Transaksi Terbaru pada Periode
              </h2>
              <p className="text-xs text-slate-500">
                Menampilkan maksimal 5 pencatatan terbaru untuk periode{" "}
                {periodLabel}.
              </p>
            </div>
            <Link href="/transactions">
              <Button type="button" variant="outline" size="sm">
                Lihat Semua Riwayat →
              </Button>
            </Link>
          </div>

          <DataTable
            columns={columns}
            data={recentTransactions}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            skeletonRows={5}
            onRowClick={(row) => setDetailTarget(row)}
            emptyState={{
              title: "Belum ada transaksi pada periode ini",
              description:
                dateFrom || dateTo
                  ? "Tidak ada pencatatan pada rentang tanggal yang dipilih."
                  : "Mulai catat barang masuk atau barang keluar untuk melihat ringkasan di dashboard.",
            }}
          />
        </section>
      </div>

      <TransactionDetailModal
        open={detailTarget !== null}
        transaction={detailTarget}
        isAdmin={isAdmin}
        onClose={() => setDetailTarget(null)}
      />
    </DashboardShell>
  );
}
