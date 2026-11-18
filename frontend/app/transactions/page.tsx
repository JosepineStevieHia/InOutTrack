"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { TransactionDetailModal } from "@/components/transactions/TransactionDetailModal";
import { TransactionEditModal } from "@/components/transactions/TransactionEditModal";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { SelectInput, TextInput } from "@/components/ui/FormField";
import {
  ExportIcon,
  EyeIcon,
  HistoryIcon,
  ImageIcon,
  InboundIcon,
  OutboundIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ApiError,
  deleteTransaction,
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
} from "@/lib/transaction-utils";

const PER_PAGE = 20;

function TransactionHistoryContent() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === "admin";

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [summary, setSummary] = useState<TransactionListSummary | null>(null);
  const [officers, setOfficers] = useState<TransactionFilterOfficer[]>([]);
  const [workTypes, setWorkTypes] = useState<TransactionFilterWorkType[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filter & Search States (semua dapat dikombinasikan dengan logika AND di backend)
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

  // Modal & Dialog States
  const [detailTarget, setDetailTarget] = useState<TransactionRecord | null>(
    null,
  );
  const [editTarget, setEditTarget] = useState<TransactionRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransactionRecord | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(
    null,
  );

  const handleExport = async (format: ExportFormat) => {
    if (!isAdmin || exportingFormat !== null) return;
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
        "Ekspor Berhasil",
        `Berkas ${filename} berhasil diunduh sesuai filter aktif.`,
      );
    } catch (err) {
      toast.error(
        "Gagal Mengekspor",
        err instanceof ApiError
          ? err.message
          : "Terjadi kesalahan saat mengekspor data transaksi.",
      );
    } finally {
      setExportingFormat(null);
    }
  };

  // Debounce pencarian teks bebas
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === debouncedSearch) return;

    const timer = window.setTimeout(() => {
      setDebouncedSearch(trimmed);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput, debouncedSearch]);

  // Debounce filter nama barang
  useEffect(() => {
    const trimmed = itemNameInput.trim();
    if (trimmed === debouncedItemName) return;

    const timer = window.setTimeout(() => {
      setDebouncedItemName(trimmed);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [itemNameInput, debouncedItemName]);

  const dateRangeWarning =
    dateFrom && dateTo && dateFrom > dateTo
      ? "Tanggal awal lebih besar daripada tanggal akhir."
      : null;

  useEffect(() => {
    let active = true;

    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setIsLoading(true);
        setFetchError(null);
        return getTransactions({
          page,
          per_page: PER_PAGE,
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
            : "Gagal memuat data riwayat transaksi.",
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

  const hasActiveFilters = Boolean(
    searchInput.trim() ||
      itemNameInput.trim() ||
      typeFilter ||
      officerFilter ||
      workTypeFilter ||
      dateFrom ||
      dateTo,
  );

  const handleResetFilters = () => {
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

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);

    try {
      const res = await deleteTransaction(deleteTarget.id);
      toast.success("Transaksi Dihapus", res.message);
      if (detailTarget?.id === deleteTarget.id) {
        setDetailTarget(null);
      }
      setDeleteTarget(null);
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      toast.error(
        "Gagal Menghapus",
        err instanceof ApiError
          ? err.message
          : "Terjadi kesalahan saat menghapus transaksi.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: TableColumn<TransactionRecord>[] = useMemo(() => {
    return [
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
        key: "transaction_datetime",
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
        key: "item_name",
        header: "Nama Barang",
        render: (row) => (
          <div className="min-w-[180px] max-w-[260px]">
            <p className="font-semibold text-slate-900">{row.item_name}</p>
            {row.work_description ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                {row.work_description}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-400">
                ID #{row.id}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "quantity",
        header: "Jumlah & Satuan",
        render: (row) => (
          <span className="whitespace-nowrap font-semibold text-slate-900">
            {row.quantity_formatted}{" "}
            <span className="font-normal text-slate-600">{row.unit}</span>
          </span>
        ),
      },
      {
        key: "counterparty",
        header: "Asal / Tujuan",
        render: (row) => {
          const info = getCounterpartyInfo(row);
          return (
            <div className="min-w-[160px] max-w-[240px]">
              <p className="font-medium text-slate-800">{info.location}</p>
              <p className="mt-0.5 text-xs text-slate-500">
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
          <div className="whitespace-nowrap">
            <p className="font-medium text-slate-800">
              {getOfficerDisplayName(row)}
            </p>
            <p className="text-xs text-slate-500">
              {row.type === "MASUK" ? "Penerima" : "Pemberi"}
            </p>
          </div>
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
      {
        key: "actions",
        header: "Detail & Aksi",
        align: "right",
        render: (row) => {
          const photoCount = row.photos?.length ?? 0;
          return (
            <div
              className="flex flex-wrap items-center justify-end gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDetailTarget(row)}
                leftIcon={<EyeIcon className="h-3.5 w-3.5" />}
                data-testid={`detail-transaction-${row.id}`}
              >
                Detail
                <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  <ImageIcon className="h-3 w-3" />
                  {photoCount}
                </span>
              </Button>

              {isAdmin && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditTarget(row)}
                    leftIcon={<PencilIcon className="h-3.5 w-3.5" />}
                    data-testid={`edit-transaction-${row.id}`}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteTarget(row)}
                    leftIcon={<TrashIcon className="h-3.5 w-3.5" />}
                    data-testid={`delete-transaction-${row.id}`}
                  >
                    Hapus
                  </Button>
                </>
              )}
            </div>
          );
        },
      },
    ];
  }, [isAdmin]);

  return (
    <div className="space-y-6">
      {/* Banner Header & Pintasan Aksi Cepat */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Riwayat Transaksi Gabungan
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Menampilkan catatan barang masuk dan keluar terbaru beserta foto
            bukti transaksi (20 data per halaman).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleExport("pdf")}
                isLoading={exportingFormat === "pdf"}
                loadingText="Menyiapkan PDF..."
                disabled={
                  exportingFormat !== null ||
                  isLoading ||
                  (summary?.total ?? 0) === 0
                }
                leftIcon={<ExportIcon className="h-4 w-4 text-red-600" />}
                data-testid="export-pdf-button"
              >
                Ekspor PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleExport("excel")}
                isLoading={exportingFormat === "excel"}
                loadingText="Menyiapkan Excel..."
                disabled={
                  exportingFormat !== null ||
                  isLoading ||
                  (summary?.total ?? 0) === 0
                }
                leftIcon={<ExportIcon className="h-4 w-4 text-emerald-600" />}
                data-testid="export-excel-button"
              >
                Ekspor Excel (.xlsx)
              </Button>
            </>
          )}
          <Link href="/transactions/in">
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<PlusIcon className="h-4 w-4" />}
            >
              Barang Masuk
            </Button>
          </Link>
          <Link href="/transactions/out">
            <Button
              type="button"
              size="sm"
              leftIcon={<PlusIcon className="h-4 w-4" />}
            >
              Barang Keluar
            </Button>
          </Link>
        </div>
      </div>

      {/* Kartu Ringkasan (Mengikuti Filter Aktif - FR-009) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Total Transaksi"
          value={summary?.total ?? 0}
          subtitle={
            hasActiveFilters
              ? "Hasil sesuai filter aktif"
              : "Seluruh transaksi tercatat"
          }
          icon={<HistoryIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
        <SummaryCard
          title="Barang Masuk"
          value={summary?.masuk ?? 0}
          variant="inbound"
          subtitle="Total transaksi penerimaan"
          icon={<InboundIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
        <SummaryCard
          title="Barang Keluar"
          value={summary?.keluar ?? 0}
          variant="outbound"
          subtitle="Total transaksi pengeluaran"
          icon={<OutboundIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
      </section>

      {/* Panel Pencarian & Filter Multi-Kriteria (Semua dapat digunakan bersamaan) */}
      <section
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
        aria-label="Filter Riwayat Transaksi"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Pencarian & Filter Multi-Kriteria
            </h3>
            <p className="text-xs text-slate-500">
              Kombinasikan pencarian teks dan beberapa filter sekaligus untuk
              mempersempit riwayat.
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
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              data-testid="reset-filters-button"
            >
              Reset Filter
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <TextInput
              label="Pencarian Teks Bebas"
              placeholder="Cari nama barang, deskripsi, asal/tujuan, atau petugas..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              rightAdornment={<SearchIcon className="h-4 w-4 text-slate-400" />}
              data-testid="filter-search-input"
            />
          </div>

          <TextInput
            label="Filter Nama Barang"
            placeholder="Contoh: Kabel NYM"
            value={itemNameInput}
            onChange={(e) => setItemNameInput(e.target.value)}
            data-testid="filter-item-name-input"
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
            data-testid="filter-type-select"
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
            data-testid="filter-officer-select"
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
            data-testid="filter-work-type-select"
          />

          <TextInput
            type="date"
            label="Dari Tanggal"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            data-testid="filter-date-from-input"
          />

          <TextInput
            type="date"
            label="Sampai Tanggal"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            data-testid="filter-date-to-input"
          />
        </div>

        {dateRangeWarning && (
          <Alert variant="warning" title="Periksa Rentang Tanggal">
            {dateRangeWarning}
          </Alert>
        )}
      </section>

      {fetchError && (
        <Alert variant="error" title="Gagal Memuat Riwayat">
          {fetchError}
        </Alert>
      )}

      {/* Tabel Riwayat Transaksi Gabungan */}
      <DataTable
        columns={columns}
        data={transactions}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        skeletonRows={6}
        onRowClick={(row) => setDetailTarget(row)}
        caption="Tabel riwayat gabungan barang masuk dan barang keluar"
        emptyState={{
          title: "Data tidak ditemukan",
          description: hasActiveFilters
            ? "Tidak ada transaksi yang cocok dengan kombinasi pencarian dan filter saat ini."
            : "Belum ada transaksi barang masuk atau barang keluar yang tercatat.",
          action: hasActiveFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
            >
              Reset Filter
            </Button>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/transactions/in">
                <Button type="button" size="sm" variant="outline">
                  Catat Barang Masuk
                </Button>
              </Link>
              <Link href="/transactions/out">
                <Button type="button" size="sm">
                  Catat Barang Keluar
                </Button>
              </Link>
            </div>
          ),
        }}
        footer={
          meta ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-600">
                Menampilkan{" "}
                <span className="font-semibold text-slate-900">
                  {meta.from ?? 0}–{meta.to ?? 0}
                </span>{" "}
                dari{" "}
                <span className="font-semibold text-slate-900">
                  {meta.total}
                </span>{" "}
                transaksi ({meta.per_page} data per halaman)
              </p>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={meta.current_page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="pagination-prev-button"
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
                  data-testid="pagination-next-button"
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          ) : null
        }
      />

      {/* Modal Detail Transaksi & Galeri Foto (Admin & Petugas) */}
      <TransactionDetailModal
        open={detailTarget !== null}
        transaction={detailTarget}
        isAdmin={isAdmin}
        onClose={() => setDetailTarget(null)}
        onRequestEdit={(tx) => {
          setDetailTarget(null);
          setEditTarget(tx);
        }}
        onRequestDelete={(tx) => {
          setDeleteTarget(tx);
        }}
      />

      {/* Modal Edit Transaksi (Khusus Admin) */}
      {isAdmin && (
        <TransactionEditModal
          open={editTarget !== null}
          transaction={editTarget}
          workTypes={workTypes}
          onClose={() => setEditTarget(null)}
          onSuccess={(updated, message) => {
            setEditTarget(null);
            if (detailTarget?.id === updated.id) {
              setDetailTarget(updated);
            }
            toast.success("Transaksi Diperbarui", message);
            setReloadKey((prev) => prev + 1);
          }}
        />
      )}

      {/* Dialog Konfirmasi Hapus Transaksi (Khusus Admin) */}
      {isAdmin && (
        <ConfirmDialog
          open={deleteTarget !== null}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          variant="danger"
          isLoading={isDeleting}
          title="Hapus Transaksi?"
          description={
            deleteTarget
              ? `Transaksi #${deleteTarget.id} (${deleteTarget.type_label}: ${deleteTarget.item_name}) akan dihapus dari riwayat aktif (soft delete) dan dicatat pada log audit.`
              : ""
          }
          confirmLabel="Ya, Hapus Transaksi"
          cancelLabel="Batal"
        />
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <DashboardShell
      allowedRoles={["admin", "petugas"]}
      pageTitle="Riwayat Transaksi"
      pageSubtitle="Penelusuran riwayat gabungan barang masuk dan barang keluar"
    >
      <TransactionHistoryContent />
    </DashboardShell>
  );
}
