"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { TextareaInput, TextInput } from "@/components/ui/FormField";
import {
  CheckCircleIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  RefreshIcon,
  SearchIcon,
  WorkTypeIcon,
} from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ApiError,
  createWorkType,
  getWorkTypes,
  updateWorkType,
  updateWorkTypeStatus,
  type PaginationMeta,
  type WorkTypeItem,
  type WorkTypeListSummary,
} from "@/lib/api";

type WorkTypeFormState = {
  name: string;
  description: string;
  is_active: boolean;
};

type FormErrors = Partial<Record<keyof WorkTypeFormState | "general", string>>;

const INITIAL_FORM_STATE: WorkTypeFormState = {
  name: "",
  description: "",
  is_active: true,
};

function validateWorkTypeForm(form: WorkTypeFormState): FormErrors {
  const errors: FormErrors = {};
  const trimmedName = form.name.trim();
  const trimmedDesc = form.description.trim();

  if (!trimmedName) {
    errors.name = "Nama jenis pekerjaan wajib diisi.";
  } else if (trimmedName.length > 100) {
    errors.name = "Nama jenis pekerjaan maksimal 100 karakter.";
  }

  if (trimmedDesc.length > 255) {
    errors.description = "Deskripsi maksimal 255 karakter.";
  }

  return errors;
}

function WorkTypesManagementContent() {
  const toast = useToast();

  const [items, setItems] = useState<WorkTypeItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [summary, setSummary] = useState<WorkTypeListSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<WorkTypeItem | null>(null);
  const [formState, setFormState] = useState<WorkTypeFormState>(INITIAL_FORM_STATE);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const [statusTarget, setStatusTarget] = useState<WorkTypeItem | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;

    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setIsLoading(true);
        setFetchError(null);
        return getWorkTypes({
          search: debouncedSearch,
          status: statusFilter,
          page,
          per_page: 10,
        });
      })
      .then((response) => {
        if (!active || !response) return;
        setItems(response.data);
        setMeta(response.meta);
        setSummary(response.summary);
      })
      .catch((error) => {
        if (!active) return;
        const message =
          error instanceof ApiError
            ? error.message
            : "Gagal memuat daftar jenis pekerjaan.";
        setFetchError(message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, statusFilter, page, reloadKey]);

  const hasActiveFilters = debouncedSearch !== "" || statusFilter !== "";

  function openCreateModal() {
    setModalMode("create");
    setEditingItem(null);
    setFormState(INITIAL_FORM_STATE);
    setFormErrors({});
  }

  function openEditModal(item: WorkTypeItem) {
    setModalMode("edit");
    setEditingItem(item);
    setFormState({
      name: item.name,
      description: item.description ?? "",
      is_active: item.is_active,
    });
    setFormErrors({});
  }

  function closeFormModal() {
    if (isSaving) return;
    setModalMode(null);
    setEditingItem(null);
    setFormErrors({});
  }

  async function handleSubmitForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modalMode || isSaving) return;

    const clientErrors = validateWorkTypeForm(formState);
    if (Object.keys(clientErrors).length > 0) {
      setFormErrors(clientErrors);
      return;
    }

    setIsSaving(true);
    setFormErrors({});

    const payload = {
      name: formState.name.trim(),
      description: formState.description.trim()
        ? formState.description.trim()
        : null,
      is_active: formState.is_active,
    };

    try {
      if (modalMode === "create") {
        const res = await createWorkType(payload);
        toast.success("Jenis Pekerjaan Ditambahkan", res.message);
      } else if (editingItem) {
        const res = await updateWorkType(editingItem.id, payload);
        toast.success("Jenis Pekerjaan Diperbarui", res.message);
      }

      setModalMode(null);
      setEditingItem(null);
      setReloadKey((prev) => prev + 1);
    } catch (error) {
      if (error instanceof ApiError) {
        const serverErrors: FormErrors = { general: error.message };
        if (error.errors) {
          for (const [field, messages] of Object.entries(error.errors)) {
            if (messages && messages.length > 0) {
              serverErrors[field as keyof FormErrors] = messages[0];
            }
          }
        }
        setFormErrors(serverErrors);
      } else {
        setFormErrors({
          general: "Terjadi kesalahan saat menyimpan jenis pekerjaan.",
        });
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmStatusToggle() {
    if (!statusTarget || isTogglingStatus) return;

    setIsTogglingStatus(true);
    try {
      const nextActive = !statusTarget.is_active;
      const res = await updateWorkTypeStatus(statusTarget.id, nextActive);
      toast.success(
        nextActive
          ? "Jenis Pekerjaan Diaktifkan"
          : "Jenis Pekerjaan Dinonaktifkan",
        res.message,
      );
      setStatusTarget(null);
      setReloadKey((prev) => prev + 1);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Gagal mengubah status jenis pekerjaan.";
      toast.error("Gagal Mengubah Status", message);
    } finally {
      setIsTogglingStatus(false);
    }
  }

  function resetFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setStatusFilter("");
    setPage(1);
  }

  const columns: TableColumn<WorkTypeItem>[] = [
    {
      key: "name",
      header: "Jenis Pekerjaan",
      render: (row) => (
        <span className="font-semibold text-slate-900">{row.name}</span>
      ),
    },
    {
      key: "description",
      header: "Deskripsi",
      render: (row) => (
        <p className="max-w-md text-xs leading-relaxed text-slate-600 sm:text-sm">
          {row.description || <span className="italic text-slate-400">Tidak ada deskripsi</span>}
        </p>
      ),
    },
    {
      key: "transactions_count",
      header: "Digunakan",
      align: "center",
      render: (row) => (
        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {row.transactions_count ?? 0} transaksi
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.is_active ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Aktif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Nonaktif
          </span>
        ),
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openEditModal(row)}
            leftIcon={<PencilIcon className="h-3.5 w-3.5" />}
          >
            Ubah
          </Button>
          <Button
            type="button"
            variant={row.is_active ? "outline" : "primary"}
            size="sm"
            onClick={() => setStatusTarget(row)}
            leftIcon={<PowerIcon className="h-3.5 w-3.5" />}
          >
            {row.is_active ? "Nonaktifkan" : "Aktifkan"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Total Jenis Pekerjaan"
          value={summary?.total ?? 0}
          subtitle="Seluruh kategori pekerjaan operasional"
          icon={<WorkTypeIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
        <SummaryCard
          title="Jenis Pekerjaan Aktif"
          value={summary?.active ?? 0}
          subtitle="Tersedia pada pilihan input transaksi"
          variant="inbound"
          icon={<CheckCircleIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
        <SummaryCard
          title="Jenis Pekerjaan Nonaktif"
          value={summary?.inactive ?? 0}
          subtitle="Disembunyikan dari input baru, riwayat tetap utuh"
          variant="outbound"
          icon={<PowerIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
      </div>

      {fetchError && (
        <Alert variant="error" title="Gagal Memuat Data Jenis Pekerjaan">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{fetchError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((prev) => prev + 1)}
              leftIcon={<RefreshIcon className="h-3.5 w-3.5" />}
            >
              Coba Lagi
            </Button>
          </div>
        </Alert>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="work-types-search"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                Cari Jenis Pekerjaan
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="work-types-search"
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Nama atau deskripsi pekerjaan..."
                  className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="work-types-status-filter"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                Filter Status
              </label>
              <select
                id="work-types-status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(
                    e.target.value as "" | "active" | "inactive",
                  );
                  setPage(1);
                }}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
              >
                <option value="">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={resetFilters}
              >
                Reset Filter
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={openCreateModal}
              leftIcon={<PlusIcon className="h-4 w-4" />}
            >
              Tambah Jenis Pekerjaan
            </Button>
          </div>
        </div>
      </section>

      <DataTable
        columns={columns}
        data={items}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        skeletonRows={5}
        caption="Daftar Jenis Pekerjaan InOutTrack"
        emptyState={{
          title: "Data tidak ditemukan",
          description: hasActiveFilters
            ? "Tidak ada jenis pekerjaan yang sesuai dengan kata kunci atau filter status yang dipilih."
            : "Belum ada master data jenis pekerjaan. Tambahkan jenis pekerjaan baru untuk memulai.",
          action: hasActiveFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              Reset Filter
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              leftIcon={<PlusIcon className="h-4 w-4" />}
            >
              Tambah Jenis Pekerjaan
            </Button>
          ),
        }}
        footer={
          meta && meta.total > 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-600">
                Menampilkan{" "}
                <span className="font-semibold text-slate-900">
                  {meta.from ?? 0}–{meta.to ?? 0}
                </span>{" "}
                dari{" "}
                <span className="font-semibold text-slate-900">{meta.total}</span>{" "}
                jenis pekerjaan
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
                  onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          ) : undefined
        }
      />

      <Modal
        open={modalMode !== null}
        onClose={closeFormModal}
        title={
          modalMode === "create"
            ? "Tambah Jenis Pekerjaan"
            : "Ubah Jenis Pekerjaan"
        }
        description={
          modalMode === "create"
            ? "Tambahkan kategori jenis pekerjaan baru untuk digunakan saat pencatatan barang."
            : "Perbarui nama, deskripsi, atau status aktif jenis pekerjaan."
        }
        size="md"
        closeOnBackdropClick={!isSaving}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={closeFormModal}
              disabled={isSaving}
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="work-type-management-form"
              variant="primary"
              isLoading={isSaving}
              loadingText="Menyimpan..."
            >
              {modalMode === "create" ? "Simpan Data" : "Simpan Perubahan"}
            </Button>
          </>
        }
      >
        <form
          id="work-type-management-form"
          onSubmit={handleSubmitForm}
          noValidate
          className="space-y-4"
        >
          {formErrors.general && (
            <Alert variant="error" title="Validasi Gagal">
              {formErrors.general}
            </Alert>
          )}

          <TextInput
            label="Nama Jenis Pekerjaan"
            required
            value={formState.name}
            onChange={(e) => {
              setFormState((prev) => ({ ...prev, name: e.target.value }));
              if (formErrors.name) {
                setFormErrors((prev) => ({ ...prev, name: undefined }));
              }
            }}
            placeholder="Contoh: Pemeliharaan Jaringan"
            helperText="Nama harus unik dan maksimal 100 karakter."
            error={formErrors.name}
            disabled={isSaving}
          />

          <TextareaInput
            label="Deskripsi"
            value={formState.description}
            onChange={(e) => {
              setFormState((prev) => ({ ...prev, description: e.target.value }));
              if (formErrors.description) {
                setFormErrors((prev) => ({ ...prev, description: undefined }));
              }
            }}
            placeholder="Jelaskan lingkup pekerjaan secara singkat (opsional)"
            helperText="Maksimal 255 karakter."
            error={formErrors.description}
            disabled={isSaving}
            rows={3}
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={formState.is_active}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    is_active: e.target.checked,
                  }))
                }
                disabled={isSaving}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:cursor-not-allowed"
              />
              <div>
                <span className="block text-sm font-medium text-slate-800">
                  Jenis Pekerjaan Aktif
                </span>
                <span className="block text-xs text-slate-500">
                  Hanya jenis pekerjaan aktif yang tampil di formulir transaksi baru.
                </span>
              </div>
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={statusTarget !== null}
        onCancel={() => {
          if (!isTogglingStatus) setStatusTarget(null);
        }}
        onConfirm={handleConfirmStatusToggle}
        variant={statusTarget?.is_active ? "danger" : "primary"}
        isLoading={isTogglingStatus}
        title={
          statusTarget?.is_active
            ? "Nonaktifkan Jenis Pekerjaan?"
            : "Aktifkan Kembali Jenis Pekerjaan?"
        }
        description={
          statusTarget?.is_active
            ? `Jenis pekerjaan "${statusTarget.name}" tidak akan muncul pada form transaksi baru, namun tetap tampil pada data riwayat transaksi lama.`
            : `Jenis pekerjaan "${statusTarget?.name}" akan muncul kembali pada pilihan transaksi barang masuk dan keluar.`
        }
        confirmLabel={
          statusTarget?.is_active ? "Ya, Nonaktifkan" : "Ya, Aktifkan"
        }
        cancelLabel="Batal"
      />
    </div>
  );
}

export default function WorkTypesPage() {
  return (
    <DashboardShell
      allowedRoles={["admin"]}
      pageTitle="Manajemen Jenis Pekerjaan"
      pageSubtitle="Kelola kategori jenis pekerjaan yang digunakan untuk mengklasifikasikan transaksi barang."
    >
      <WorkTypesManagementContent />
    </DashboardShell>
  );
}
