"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { SelectInput, TextInput } from "@/components/ui/FormField";
import {
  ExportIcon,
  HistoryIcon,
  InboundIcon,
  OutboundIcon,
  RefreshIcon,
  SearchIcon,
} from "@/components/ui/Icons";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ApiError,
  downloadTransactionsExport,
  getTransactions,
  type ExportFormat,
  type PaginationMeta,
  type TransactionFilterOfficer,
  type TransactionFilterWorkType,
  type TransactionListSummary,
  type TransactionRecord,
  type TransactionType,
} from "@/lib/api";
import {
  formatTransactionDate,
  formatTransactionTime,
  getCounterpartyInfo,
  getOfficerDisplayName,
  getPeriodDateRange,
  type PeriodPreset,
} from "@/lib/transaction-utils";

const MAX_EXPORT_ROWS = 10000;

function ExportsPageContent() {
  const toast = useToast();

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [itemNameInput, setItemNameInput] = useState("");
  const [debouncedItemName, setDebouncedItemName] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | TransactionType>("");
  const [officerFilter, setOfficerFilter] = useState("");
  const [workTypeFilter, setWorkTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [summary, setSummary] = useState<TransactionListSummary | null>(null);
  const [officers, setOfficers] = useState<TransactionFilterOfficer[]>([]);
  const [workTypes, setWorkTypes] = useState<TransactionFilterWorkType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(
    null,
  );

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === debouncedSearch) return;
    const timer = window.setTimeout(() => {
      setDebouncedSearch(trimmed);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, debouncedSearch]);

  useEffect(() => {
    const trimmed = itemNameInput.trim();
    if (trimmed === debouncedItemName) return;
    const timer = window.setTimeout(() => {
      setDebouncedItemName(trimmed);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [itemNameInput, debouncedItemName]);

  useEffect(() => {
    let active = true;

    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setIsLoading(true);
        setFetchError(null);
        return getTransactions({
          page,
          per_page: 20,
          search: debouncedSearch,
          item_name: debouncedItemName,
          type: typeFilter,
          recorded_by: officerFilter,
          work_type_id: workTypeFilter,
          date_from: dateFrom,
          date_to: dateTo,
        });
      })
      .then((res) => {
        if (!active || !res) return;
        setTransactions(res.data);
        setMeta(res.meta);
        setSummary(res.summary);
        setOfficers(res.filter_options.officers);
        setWorkTypes(res.filter_options.work_types);
      })
      .catch((err) => {
        if (!active) return;
        setFetchError(
          err instanceof ApiError
            ? err.message
            : "Gagal memuat pratinjau data ekspor.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    page,
    debouncedSearch,
    debouncedItemName,
    typeFilter,
    officerFilter,
    workTypeFilter,
    dateFrom,
    dateTo,
    reloadKey,
  ]);

  const handlePresetChange = (value: string) => {
    const preset = value as PeriodPreset;
    setPeriodPreset(preset);
    if (preset === "custom") return;

    const range = getPeriodDateRange(preset);
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    setPage(1);
  };

  const handleReset = () => {
    setPeriodPreset("all");
    setSearchInput("");
    setDebouncedSearch("");
    setItemNameInput("");
    setDebouncedItemName("");
    setTypeFilter("");
    setOfficerFilter("");
    setWorkTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const totalCount = summary?.total ?? 0;
  const exceedsLimit = totalCount > MAX_EXPORT_ROWS;
  const isEmpty = !isLoading && totalCount === 0;
  const canExport = !isLoading && totalCount > 0 && !exceedsLimit;

  const handleDownload = async (format: ExportFormat) => {
    if (!canExport || exportingFormat !== null) return;
    setExportingFormat(format);

    try {
      const { filename } = await downloadTransactionsExport(format, {
        search: debouncedSearch,
        item_name: debouncedItemName,
        type: typeFilter,
        recorded_by: officerFilter,
        work_type_id: workTypeFilter,
        date_from: dateFrom,
        date_to: dateTo,
      });
      toast.success(
        "Ekspor Laporan Berhasil",
        `File ${filename} berhasil dibuat dan diunduh.`,
      );
    } catch (err) {
      toast.error(
        "Gagal Mengekspor Laporan",
        err instanceof ApiError
          ? err.message
          : "Terjadi kesalahan saat membuat berkas ekspor.",
      );
    } finally {
      setExportingFormat(null);
    }
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
        header: "Nama Barang",
        render: (row) => (
          <div>
            <p className="font-semibold text-slate-900">{row.item_name}</p>
            <p className="text-xs text-slate-500">
              {row.quantity_formatted} {row.unit}
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
                {info.actorLabel}: {info.actorName}
              </p>
            </div>
          );
        },
      },
      {
        key: "officer",
        header: "Petugas",
        render: (row) => (
          <span className="font-medium text-slate-800">
            {getOfficerDisplayName(row)}
          </span>
        ),
      },
      {
        key: "work_type",
        header: "Jenis Pekerjaan",
        render: (row) => (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {row.work_type?.name ?? "-"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      {/* Header & Tombol Ekspor Utama */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Ekspor Laporan Riwayat Transaksi (Khusus Admin)
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Unduh laporan dalam format <strong>PDF</strong> atau{" "}
            <strong>Excel (.xlsx)</strong> sesuai filter dan periode aktif
            (maksimal 10.000 baris per ekspor).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="danger"
            onClick={() => void handleDownload("pdf")}
            isLoading={exportingFormat === "pdf"}
            loadingText="Membuat PDF..."
            disabled={!canExport || exportingFormat !== null}
            leftIcon={<ExportIcon className="h-4 w-4" />}
            data-testid="exports-page-pdf-button"
          >
            Unduh Laporan PDF
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleDownload("excel")}
            isLoading={exportingFormat === "excel"}
            loadingText="Membuat Excel..."
            disabled={!canExport || exportingFormat !== null}
            leftIcon={<ExportIcon className="h-4 w-4" />}
            data-testid="exports-page-excel-button"
          >
            Unduh Laporan Excel (.xlsx)
          </Button>
        </div>
      </div>

      {/* Filter Periode & Multi-Kriteria */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Atur Periode &amp; Filter Data Ekspor
          </h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((prev) => prev + 1)}
              leftIcon={<RefreshIcon className="h-4 w-4" />}
            >
              Segarkan Data
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              data-testid="exports-reset-button"
            >
              Reset Filter
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SelectInput
            label="Preset Periode"
            value={periodPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            options={[
              { value: "all", label: "Semua Waktu" },
              { value: "today", label: "Hari Ini" },
              { value: "7d", label: "7 Hari Terakhir" },
              { value: "30d", label: "30 Hari Terakhir" },
              { value: "this_month", label: "Bulan Ini" },
              { value: "custom", label: "Rentang Kustom" },
            ]}
            data-testid="exports-period-preset"
          />

          <TextInput
            type="date"
            label="Dari Tanggal"
            value={dateFrom}
            onChange={(e) => {
              setPeriodPreset("custom");
              setDateFrom(e.target.value);
              setPage(1);
            }}
            data-testid="exports-date-from"
          />

          <TextInput
            type="date"
            label="Sampai Tanggal"
            value={dateTo}
            onChange={(e) => {
              setPeriodPreset("custom");
              setDateTo(e.target.value);
              setPage(1);
            }}
            data-testid="exports-date-to"
          />

          <SelectInput
            label="Jenis Transaksi"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as "" | TransactionType);
              setPage(1);
            }}
            options={[
              { value: "", label: "Semua Jenis" },
              { value: "MASUK", label: "Barang Masuk" },
              { value: "KELUAR", label: "Barang Keluar" },
            ]}
            data-testid="exports-type-select"
          />

          <TextInput
            label="Pencarian Teks Bebas"
            placeholder="Kata kunci..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            rightAdornment={<SearchIcon className="h-4 w-4 text-slate-400" />}
            data-testid="exports-search-input"
          />

          <TextInput
            label="Filter Nama Barang"
            placeholder="Contoh: Kabel"
            value={itemNameInput}
            onChange={(e) => setItemNameInput(e.target.value)}
            data-testid="exports-item-name-input"
          />

          <SelectInput
            label="Filter Petugas"
            value={officerFilter}
            onChange={(e) => {
              setOfficerFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: "Semua Petugas" },
              ...officers.map((officer) => ({
                value: String(officer.id),
                label: officer.is_active
                  ? officer.name
                  : `${officer.name} (Nonaktif)`,
              })),
            ]}
            data-testid="exports-officer-select"
          />

          <SelectInput
            label="Filter Jenis Pekerjaan"
            value={workTypeFilter}
            onChange={(e) => {
              setWorkTypeFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: "Semua Jenis Pekerjaan" },
              ...workTypes.map((wt) => ({
                value: String(wt.id),
                label: wt.is_active ? wt.name : `${wt.name} (Nonaktif)`,
              })),
            ]}
            data-testid="exports-work-type-select"
          />
        </div>
      </section>

      {/* Ringkasan & Validasi Kelayakan Ekspor */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Data Akan Diekspor"
          value={summary?.total ?? 0}
          subtitle="Maksimal 10.000 baris per berkas"
          icon={<HistoryIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
        <SummaryCard
          title="Barang Masuk"
          value={summary?.masuk ?? 0}
          variant="inbound"
          subtitle="Masuk dalam cakupan ekspor"
          icon={<InboundIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
        <SummaryCard
          title="Barang Keluar"
          value={summary?.keluar ?? 0}
          variant="outbound"
          subtitle="Keluar dalam cakupan ekspor"
          icon={<OutboundIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
      </section>

      {isEmpty && (
        <Alert variant="warning" title="Data Kosong — Ekspor Dinonaktifkan">
          Tidak ada data transaksi yang sesuai dengan filter aktif. Sistem tidak
          menghasilkan file kosong; silakan ubah atau reset filter terlebih
          dahulu.
        </Alert>
      )}

      {exceedsLimit && (
        <Alert
          variant="error"
          title="Melebihi Batas Maksimal Ekspor (10.000 Baris)"
        >
          Total data terpilih ({totalCount.toLocaleString("id-ID")} baris)
          melebihi batas maksimal ekspor 10.000 baris. Silakan persempit rentang
          tanggal atau filter tambahan terlebih dahulu.
        </Alert>
      )}

      {fetchError && (
        <Alert variant="error" title="Gagal Memuat Pratinjau">
          {fetchError}
        </Alert>
      )}

      {/* Pratinjau Data yang Akan Diekspor */}
      <DataTable
        columns={columns}
        data={transactions}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        skeletonRows={5}
        caption="Pratinjau data transaksi yang akan diekspor"
        emptyState={{
          title: "Data tidak ditemukan",
          description:
            "Tidak ada data transaksi yang memenuhi kriteria filter ekspor saat ini.",
          action: (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
            >
              Reset Filter
            </Button>
          ),
        }}
        footer={
          meta ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-600">
                Pratinjau {meta.from ?? 0}–{meta.to ?? 0} dari {meta.total}{" "}
                transaksi yang akan masuk ke laporan ekspor.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={meta.current_page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Sebelumnya
                </Button>
                <span className="px-2 text-xs font-medium text-slate-700">
                  Halaman {meta.current_page} / {meta.last_page}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={meta.current_page >= meta.last_page || isLoading}
                  onClick={() =>
                    setPage((p) => Math.min(meta.last_page, p + 1))
                  }
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          ) : null
        }
      />
    </div>
  );
}

export default function ExportsPage() {
  return (
    <DashboardShell
      allowedRoles={["admin"]}
      pageTitle="Ekspor Laporan"
      pageSubtitle="Ekspor riwayat transaksi ke PDF dan Excel (.xlsx) sesuai filter aktif"
    >
      <ExportsPageContent />
    </DashboardShell>
  );
}
