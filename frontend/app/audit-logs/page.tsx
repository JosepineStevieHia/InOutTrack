"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { SelectInput, TextInput } from "@/components/ui/FormField";
import {
  AuditIcon,
  EyeIcon,
  PencilIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { SummaryCard } from "@/components/ui/SummaryCard";
import {
  ApiError,
  getAuditLogDetail,
  getAuditLogs,
  type AuditAction,
  type AuditLogListSummary,
  type AuditLogRecord,
  type AuditSnapshotData,
  type PaginationMeta,
  type TransactionFilterOfficer,
} from "@/lib/api";
import { formatFileSize } from "@/lib/photo-utils";
import {
  formatTransactionDate,
  formatTransactionDateTime,
  formatTransactionTime,
} from "@/lib/transaction-utils";

const PER_PAGE = 20;

const FIELD_LABELS: Record<string, string> = {
  type: "Jenis Transaksi",
  transaction_datetime: "Waktu Transaksi",
  item_name: "Nama Barang",
  quantity: "Jumlah",
  unit: "Satuan",
  work_type_id: "ID Jenis Pekerjaan",
  work_type_name: "Jenis Pekerjaan",
  work_description: "Deskripsi Pekerjaan",
  origin: "Asal Barang",
  destination: "Tujuan Barang",
  sender_name: "Nama Pengantar",
  recipient_name: "Nama Penerima",
  taker_name: "Nama Pengambil",
  giver_name: "Nama Pemberi",
  photos: "Foto Bukti Transaksi",
};

type SnapshotRowDef = {
  key: keyof AuditSnapshotData;
  label: string;
};

function getDisplayFields(
  oldValues: AuditSnapshotData | null,
  newValues: AuditSnapshotData | null,
  txType?: string,
): SnapshotRowDef[] {
  const effectiveType = txType ?? oldValues?.type ?? newValues?.type;
  const rows: SnapshotRowDef[] = [
    { key: "type", label: "Jenis Transaksi" },
    { key: "transaction_datetime", label: "Waktu Transaksi" },
    { key: "item_name", label: "Nama Barang" },
    { key: "quantity", label: "Jumlah" },
    { key: "unit", label: "Satuan" },
    { key: "work_type_name", label: "Jenis Pekerjaan" },
    { key: "work_description", label: "Deskripsi Pekerjaan" },
  ];

  if (effectiveType === "MASUK") {
    rows.push(
      { key: "origin", label: "Asal Barang" },
      { key: "sender_name", label: "Nama Pengantar" },
      { key: "recipient_name", label: "Nama Penerima" },
    );
  } else if (effectiveType === "KELUAR") {
    rows.push(
      { key: "destination", label: "Tujuan Barang" },
      { key: "taker_name", label: "Nama Pengambil" },
      { key: "giver_name", label: "Nama Pemberi" },
    );
  } else {
    rows.push(
      { key: "origin", label: "Asal Barang" },
      { key: "destination", label: "Tujuan Barang" },
      { key: "sender_name", label: "Nama Pengantar" },
      { key: "taker_name", label: "Nama Pengambil" },
    );
  }

  rows.push({ key: "photos", label: "Foto Bukti Transaksi" });
  return rows;
}

function formatSnapshotFieldValue(
  snapshot: AuditSnapshotData | null,
  key: keyof AuditSnapshotData,
): string {
  if (!snapshot) return "-";

  if (key === "transaction_datetime") {
    return snapshot.transaction_datetime
      ? formatTransactionDateTime(snapshot.transaction_datetime)
      : "-";
  }

  if (key === "work_type_name") {
    if (snapshot.work_type_name) return snapshot.work_type_name;
    if (snapshot.work_type_id !== undefined) {
      return `ID #${snapshot.work_type_id}`;
    }
    return "-";
  }

  if (key === "type") {
    if (snapshot.type === "MASUK") return "Barang Masuk";
    if (snapshot.type === "KELUAR") return "Barang Keluar";
    return "-";
  }

  const raw = snapshot[key];
  if (raw === null || raw === undefined || raw === "") {
    return "-";
  }

  return String(raw);
}

function renderActionBadge(action: AuditAction) {
  if (action === "DELETE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
        <TrashIcon className="h-3.5 w-3.5" />
        DELETE
      </span>
    );
  }

  if (action === "RESTORE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <RefreshIcon className="h-3.5 w-3.5" />
        RESTORE
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
      <PencilIcon className="h-3.5 w-3.5" />
      UPDATE
    </span>
  );
}

function renderPhotosList(snapshot: AuditSnapshotData | null) {
  if (!snapshot) {
    return <span className="text-xs italic text-slate-400">Tidak ada</span>;
  }

  const photos = snapshot.photos ?? [];
  if (photos.length === 0) {
    return <span className="text-xs text-slate-500">0 foto</span>;
  }

  return (
    <ul className="space-y-1 text-xs">
      {photos.map((p) => (
        <li
          key={`${p.id}-${p.file_path}`}
          className="rounded border border-slate-200 bg-white px-2 py-1"
        >
          <p className="font-medium text-slate-800">{p.original_name}</p>
          <p className="text-[11px] text-slate-500">
            ID #{p.id} • {p.mime_type} • {formatFileSize(p.file_size)}
          </p>
        </li>
      ))}
    </ul>
  );
}

function AuditLogDetailModal({
  open,
  auditLog,
  onClose,
}: {
  open: boolean;
  auditLog: AuditLogRecord | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<AuditLogRecord | null>(auditLog);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const auditLogId = auditLog?.id ?? null;

  useEffect(() => {
    let active = true;

    if (!open || !auditLogId) {
      Promise.resolve().then(() => {
        if (!active) return;
        setDetail(null);
        setDetailError(null);
        setIsLoadingDetail(false);
      });
      return () => {
        active = false;
      };
    }

    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setDetail(auditLog);
        setDetailError(null);
        setIsLoadingDetail(true);
        return getAuditLogDetail(auditLogId);
      })
      .then((res) => {
        if (!active || !res) return;
        setDetail(res.audit_log);
      })
      .catch((err) => {
        if (!active) return;
        setDetailError(
          err instanceof ApiError
            ? err.message
            : "Gagal memuat detail catatan log audit.",
        );
      })
      .finally(() => {
        if (active) setIsLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [open, auditLogId, auditLog]);

  const current = detail ?? auditLog;
  const rows = current
    ? getDisplayFields(
        current.old_values,
        current.new_values,
        current.transaction?.type,
      )
    : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={current ? `Detail Log Audit #${current.id}` : "Detail Log Audit"}
      description={
        current
          ? `${current.action_label} • ${formatTransactionDateTime(current.created_at)}`
          : undefined
      }
      size="xl"
      footer={
        <div className="flex w-full justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      {current && (
        <div className="space-y-5" data-testid="audit-detail-modal">
          {detailError && (
            <Alert variant="warning" title="Perhatian">
              {detailError}
            </Alert>
          )}

          {/* Metadata Audit */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Jenis Tindakan
              </p>
              <div className="mt-1">{renderActionBadge(current.action)}</div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Pengguna Pelaku
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {current.user?.name ?? "-"}
              </p>
              <p className="text-xs text-slate-500">
                @{current.user?.username ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Transaksi Terkait
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                #{current.transaction_id} •{" "}
                {current.transaction?.item_name ??
                  current.old_values?.item_name ??
                  "-"}
              </p>
              <p className="text-xs text-slate-500">
                {current.transaction?.is_deleted
                  ? "Status: Terhapus (Soft Delete)"
                  : "Status: Aktif"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Waktu & Alamat IP
              </p>
              <p className="mt-0.5 text-xs font-medium text-slate-800">
                {formatTransactionDateTime(current.created_at)}
              </p>
              <p className="text-xs text-slate-500">
                IP: {current.ip_address ?? "-"}
              </p>
            </div>
          </div>

          {current.description && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Keterangan: </span>
              {current.description}
            </div>
          )}

          {isLoadingDetail && (
            <p className="text-xs text-slate-500">
              Memuat sinkronisasi detail terbaru...
            </p>
          )}

          {/* Perbandingan Sebelum vs Sesudah */}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Perbandingan Data Sebelum &amp; Sesudah Perubahan
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="w-44 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Field
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Data Sebelum Perubahan
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Data Setelah Perubahan
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map(({ key, label }) => {
                    const isChanged =
                      current.action === "DELETE"
                        ? false
                        : current.changed_fields.includes(key) ||
                          (key === "work_type_name" &&
                            current.changed_fields.includes("work_type_id"));

                    return (
                      <tr
                        key={key}
                        className={isChanged ? "bg-amber-50/60" : ""}
                      >
                        <td className="px-4 py-2.5 align-top font-medium text-slate-800">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{label}</span>
                            {isChanged && (
                              <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                                Berubah
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-top text-slate-700">
                          {key === "photos" ? (
                            renderPhotosList(current.old_values)
                          ) : (
                            <span className="whitespace-pre-wrap wrap-break-word">
                              {formatSnapshotFieldValue(
                                current.old_values,
                                key,
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 align-top text-slate-700">
                          {current.action === "DELETE" ? (
                            <span className="text-xs italic text-rose-600">
                              Transaksi dihapus (Soft Delete)
                            </span>
                          ) : key === "photos" ? (
                            renderPhotosList(current.new_values)
                          ) : (
                            <span
                              className={`whitespace-pre-wrap wrap-break-word ${
                                isChanged ? "font-semibold text-slate-900" : ""
                              }`}
                            >
                              {formatSnapshotFieldValue(
                                current.new_values,
                                key,
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AuditLogsContent() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [summary, setSummary] = useState<AuditLogListSummary>({
    total: 0,
    update_count: 0,
    delete_count: 0,
  });
  const [users, setUsers] = useState<TransactionFilterOfficer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // State Filter & Pagination
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<"" | AuditAction>("");
  const [userFilter, setUserFilter] = useState("");
  const [txIdInput, setTxIdInput] = useState("");
  const [debouncedTxId, setDebouncedTxId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Modal Detail
  const [detailTarget, setDetailTarget] = useState<AuditLogRecord | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed === debouncedSearch) return;
      setDebouncedSearch(trimmed);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput, debouncedSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = txIdInput.trim();
      if (trimmed === debouncedTxId) return;
      setDebouncedTxId(trimmed);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [txIdInput, debouncedTxId]);

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
        return getAuditLogs({
          page,
          per_page: PER_PAGE,
          search: debouncedSearch,
          action: actionFilter,
          user_id: userFilter,
          transaction_id: debouncedTxId,
          date_from: dateFrom,
          date_to: dateTo,
        });
      })
      .then((res) => {
        if (!active || !res) return;
        setLogs(res.data);
        setMeta(res.meta);
        setSummary(res.summary);
        setUsers(res.filter_options.users);
      })
      .catch((err) => {
        if (!active) return;
        setFetchError(
          err instanceof ApiError
            ? err.message
            : "Gagal memuat daftar log audit sistem.",
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
    actionFilter,
    userFilter,
    debouncedTxId,
    dateFrom,
    dateTo,
    reloadKey,
  ]);

  const hasActiveFilters = Boolean(
    searchInput.trim() ||
      actionFilter ||
      userFilter ||
      txIdInput.trim() ||
      dateFrom ||
      dateTo,
  );

  const handleResetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setActionFilter("");
    setUserFilter("");
    setTxIdInput("");
    setDebouncedTxId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const columns: TableColumn<AuditLogRecord>[] = useMemo(() => {
    return [
      {
        key: "created_at",
        header: "Waktu",
        render: (row) => (
          <div className="whitespace-nowrap">
            <p className="font-medium text-slate-900">
              {formatTransactionDate(row.created_at)}
            </p>
            <p className="text-xs text-slate-500">
              {formatTransactionTime(row.created_at)}
            </p>
          </div>
        ),
      },
      {
        key: "user",
        header: "Pengguna",
        render: (row) => (
          <div className="max-w-36">
            <p className="font-medium text-slate-900 truncate">
              {row.user?.name ?? "-"}
            </p>
            <p className="text-xs text-slate-500 truncate">
              @{row.user?.username ?? "-"} •{" "}
              {row.user?.role === "admin" ? "Admin" : "Petugas"}
            </p>
          </div>
        ),
      },
      {
        key: "action",
        header: "Tindakan",
        render: (row) => renderActionBadge(row.action),
      },
      {
        key: "transaction",
        header: "Transaksi Terkait",
        render: (row) => {
          const itemName =
            row.transaction?.item_name ??
            row.old_values?.item_name ??
            "(Tidak diketahui)";
          const txType = row.transaction?.type ?? row.old_values?.type;

          return (
            <div className="min-w-32 max-w-44 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-900">
                  #{row.transaction_id}
                </span>
                {txType && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      txType === "MASUK"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {txType}
                  </span>
                )}
                {row.transaction?.is_deleted && (
                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                    Terhapus
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 line-clamp-1">{itemName}</p>
            </div>
          );
        },
      },
      {
        key: "summary",
        header: "Ringkasan",
        render: (row) => {
          if (row.action === "DELETE") {
            return (
              <p className="max-w-52 text-xs text-rose-700">
                Soft delete transaksi (snapshot tersimpan).
              </p>
            );
          }

          const readableFields = row.changed_fields
            .filter((field) => field !== "work_type_id")
            .map((field) => FIELD_LABELS[field] ?? field);

          return (
            <div className="max-w-56 space-y-1">
              {row.description && (
                <p className="text-xs text-slate-700 line-clamp-1">
                  {row.description}
                </p>
              )}
              {readableFields.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {readableFields.slice(0, 3).map((label) => (
                    <span
                      key={label}
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
                    >
                      {label}
                    </span>
                  ))}
                  {readableFields.length > 3 && (
                    <span className="text-[11px] text-slate-500">
                      +{readableFields.length - 3} lainnya
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-400">
                  Tidak ada perubahan field tercatat
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "actions",
        header: "Aksi",
        align: "right",
        render: (row) => (
          <div
            className="flex justify-end whitespace-nowrap"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              leftIcon={<EyeIcon className="h-3.5 w-3.5" />}
              onClick={() => setDetailTarget(row)}
              data-testid={`audit-detail-button-${row.id}`}
            >
              Detail Diff
            </Button>
          </div>
        ),
      },
    ];
  }, []);

  return (
    <div className="space-y-6">
      <Alert variant="info" title="Rekam Jejak Audit Permanen (Append-Only)">
        Setiap perubahan data/foto maupun penghapusan (soft delete) transaksi
        dicatat otomatis beserta data sebelum dan sesudah perubahan. Log audit
        tidak dapat diakses atau diubah oleh Petugas Store/Security.
      </Alert>

      {/* Kartu Ringkasan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Total Catatan Audit"
          value={summary.total}
          subtitle="Sesuai filter aktif saat ini"
          icon={<AuditIcon className="h-5 w-5" />}
          variant="admin"
          isLoading={isLoading}
        />
        <SummaryCard
          title="Perubahan Transaksi (UPDATE)"
          value={summary.update_count}
          subtitle="Edit data atau perubahan foto bukti"
          icon={<PencilIcon className="h-5 w-5" />}
          variant="outbound"
          isLoading={isLoading}
        />
        <SummaryCard
          title="Penghapusan (DELETE)"
          value={summary.delete_count}
          subtitle="Soft delete transaksi oleh Admin"
          icon={<TrashIcon className="h-5 w-5" />}
          variant="default"
          isLoading={isLoading}
        />
      </div>

      {/* Panel Pencarian & Filter */}
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Filter Log Audit
            </h3>
            <p className="text-xs text-slate-500">
              Telusuri jejak perubahan berdasarkan kata kunci, jenis tindakan,
              Admin, ID transaksi, atau rentang tanggal.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                data-testid="audit-reset-filters-button"
              >
                Reset Filter
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<RefreshIcon className="h-3.5 w-3.5" />}
              onClick={() => setReloadKey((k) => k + 1)}
              disabled={isLoading}
              data-testid="audit-refresh-button"
            >
              Muat Ulang
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <TextInput
              label="Pencarian Bebas"
              placeholder="Cari barang, nama/username admin, deskripsi..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              data-testid="audit-search-input"
            />
            <SearchIcon className="pointer-events-none absolute right-3 top-8.5 h-4 w-4 text-slate-400" />
          </div>

          <SelectInput
            label="Jenis Tindakan"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value as "" | AuditAction);
              setPage(1);
            }}
            options={[
              { value: "", label: "Semua Tindakan" },
              { value: "UPDATE", label: "UPDATE — Perubahan Transaksi" },
              { value: "DELETE", label: "DELETE — Soft Delete Transaksi" },
            ]}
            data-testid="audit-filter-action-select"
          />

          <SelectInput
            label="Pengguna Pelaku"
            value={userFilter}
            onChange={(e) => {
              setUserFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: "Semua Pengguna" },
              ...users.map((u) => ({
                value: String(u.id),
                label: u.is_active ? u.name : `${u.name} (Nonaktif)`,
              })),
            ]}
            data-testid="audit-filter-user-select"
          />

          <TextInput
            label="ID Transaksi"
            placeholder="Contoh: 12"
            value={txIdInput}
            onChange={(e) => setTxIdInput(e.target.value)}
            data-testid="audit-filter-tx-id-input"
          />

          <TextInput
            type="date"
            label="Dari Tanggal"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            data-testid="audit-filter-date-from"
          />

          <TextInput
            type="date"
            label="Sampai Tanggal"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            data-testid="audit-filter-date-to"
          />
        </div>

        {dateRangeWarning && (
          <Alert variant="warning" title="Periksa Rentang Tanggal">
            {dateRangeWarning}
          </Alert>
        )}
      </section>

      {fetchError && (
        <Alert variant="error" title="Gagal Memuat Log Audit">
          {fetchError}
        </Alert>
      )}

      {/* Tabel Log Audit */}
      <DataTable
        columns={columns}
        data={logs}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        skeletonRows={6}
        onRowClick={(row) => setDetailTarget(row)}
        caption="Tabel log audit perubahan dan penghapusan transaksi"
        emptyState={{
          title: "Belum ada catatan log audit",
          description: hasActiveFilters
            ? "Tidak ada catatan log audit yang cocok dengan filter aktif saat ini."
            : "Log audit akan tercatat otomatis setiap kali Admin mengubah atau menghapus transaksi.",
          action: hasActiveFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
            >
              Reset Filter
            </Button>
          ) : undefined,
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
                catatan audit ({meta.per_page} data per halaman)
              </p>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={meta.current_page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="audit-pagination-prev"
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
                  data-testid="audit-pagination-next"
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          ) : null
        }
      />

      <AuditLogDetailModal
        open={detailTarget !== null}
        auditLog={detailTarget}
        onClose={() => setDetailTarget(null)}
      />
    </div>
  );
}

export default function AuditLogsPage() {
  return (
    <DashboardShell
      allowedRoles={["admin"]}
      pageTitle="Log Audit"
      pageSubtitle="Catatan perubahan dan penghapusan transaksi oleh Admin"
    >
      <AuditLogsContent />
    </DashboardShell>
  );
}
