"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { SelectInput, TextInput } from "@/components/ui/FormField";
import {
  CheckCircleIcon,
  EyeIcon,
  EyeOffIcon,
  LockShieldIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ApiError,
  createUser,
  deleteUser,
  getUsers,
  updateUser,
  updateUserStatus,
  type ManagedUser,
  type PaginationMeta,
  type UserListSummary,
  type UserRole,
} from "@/lib/api";

type UserFormState = {
  name: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
};

type FormErrors = Partial<Record<keyof UserFormState | "general", string>>;

const INITIAL_FORM_STATE: UserFormState = {
  name: "",
  username: "",
  email: "",
  password: "",
  role: "petugas",
  is_active: true,
};

function validateUserForm(
  form: UserFormState,
  mode: "create" | "edit",
): FormErrors {
  const errors: FormErrors = {};
  const trimmedName = form.name.trim();
  const trimmedUsername = form.username.trim();
  const trimmedEmail = form.email.trim();

  if (!trimmedName) {
    errors.name = "Nama lengkap wajib diisi.";
  } else if (trimmedName.length > 100) {
    errors.name = "Nama lengkap maksimal 100 karakter.";
  }

  if (!trimmedUsername) {
    errors.username = "Username wajib diisi.";
  } else if (trimmedUsername.length < 3) {
    errors.username = "Username minimal 3 karakter.";
  } else if (trimmedUsername.length > 50) {
    errors.username = "Username maksimal 50 karakter.";
  } else if (!/^[a-zA-Z0-9._-]+$/.test(trimmedUsername)) {
    errors.username =
      "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.";
  }

  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = "Format alamat email tidak valid.";
  }

  if (mode === "create") {
    if (!form.password) {
      errors.password = "Password awal wajib diisi.";
    } else if (form.password.length < 8) {
      errors.password = "Password minimal 8 karakter.";
    }
  } else if (form.password && form.password.length < 8) {
    errors.password = "Password baru minimal 8 karakter.";
  }

  return errors;
}

function UsersManagementContent() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [summary, setSummary] = useState<UserListSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | UserRole>("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [formState, setFormState] = useState<UserFormState>(INITIAL_FORM_STATE);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [statusTarget, setStatusTarget] = useState<ManagedUser | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
        return getUsers({
          search: debouncedSearch,
          role: roleFilter,
          status: statusFilter,
          page,
          per_page: 10,
        });
      })
      .then((response) => {
        if (!active || !response) return;
        setUsers(response.data);
        setMeta(response.meta);
        setSummary(response.summary);
      })
      .catch((error) => {
        if (!active) return;
        const message =
          error instanceof ApiError
            ? error.message
            : "Gagal memuat daftar akun pengguna.";
        setFetchError(message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, roleFilter, statusFilter, page, reloadKey]);

  const activeAdminsCount = summary?.active_admins ?? 0;
  const hasActiveFilters =
    debouncedSearch !== "" || roleFilter !== "" || statusFilter !== "";

  const isTargetSelf = (target: ManagedUser) => currentUser?.id === target.id;
  const isTargetLastActiveAdmin = (target: ManagedUser) =>
    target.role === "admin" && target.is_active && activeAdminsCount <= 1;

  function openCreateModal() {
    setModalMode("create");
    setEditingUser(null);
    setFormState(INITIAL_FORM_STATE);
    setFormErrors({});
    setShowPassword(false);
  }

  function openEditModal(target: ManagedUser) {
    setModalMode("edit");
    setEditingUser(target);
    setFormState({
      name: target.name,
      username: target.username,
      email: target.email ?? "",
      password: "",
      role: target.role,
      is_active: target.is_active,
    });
    setFormErrors({});
    setShowPassword(false);
  }

  function closeFormModal() {
    if (isSaving) return;
    setModalMode(null);
    setEditingUser(null);
    setFormErrors({});
  }

  async function handleSubmitForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modalMode || isSaving) return;

    const clientErrors = validateUserForm(formState, modalMode);
    if (Object.keys(clientErrors).length > 0) {
      setFormErrors(clientErrors);
      return;
    }

    setIsSaving(true);
    setFormErrors({});

    try {
      if (modalMode === "create") {
        const res = await createUser({
          name: formState.name.trim(),
          username: formState.username.trim().toLowerCase(),
          email: formState.email.trim() ? formState.email.trim().toLowerCase() : null,
          password: formState.password,
          role: formState.role,
          is_active: formState.is_active,
        });
        toast.success("Akun Ditambahkan", res.message);
      } else if (editingUser) {
        const res = await updateUser(editingUser.id, {
          name: formState.name.trim(),
          username: formState.username.trim().toLowerCase(),
          email: formState.email.trim() ? formState.email.trim().toLowerCase() : null,
          password: formState.password || undefined,
          role: formState.role,
          is_active: formState.is_active,
        });
        toast.success("Akun Diperbarui", res.message);
      }

      setModalMode(null);
      setEditingUser(null);
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
          general: "Terjadi kesalahan saat menyimpan akun pengguna.",
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
      const res = await updateUserStatus(statusTarget.id, nextActive);
      toast.success(
        nextActive ? "Akun Diaktifkan" : "Akun Dinonaktifkan",
        res.message,
      );
      setStatusTarget(null);
      setReloadKey((prev) => prev + 1);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Gagal mengubah status akun pengguna.";
      toast.error("Gagal Mengubah Status", message);
    } finally {
      setIsTogglingStatus(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    try {
      const res = await deleteUser(deleteTarget.id);
      toast.success("Akun Dihapus", res.message);
      setDeleteTarget(null);
      if (users.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        setReloadKey((prev) => prev + 1);
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Gagal menghapus akun pengguna.";
      toast.error("Tidak Dapat Menghapus Akun", message);
    } finally {
      setIsDeleting(false);
    }
  }

  function resetFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setPage(1);
  }

  const columns: TableColumn<ManagedUser>[] = [
    {
      key: "name",
      header: "Pengguna",
      render: (row) => (
        <div className="min-w-44">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{row.name}</span>
            {isTargetSelf(row) && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200">
                Akun Anda
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {row.email || "Email belum diisi"}
          </p>
        </div>
      ),
    },
    {
      key: "username",
      header: "Username",
      render: (row) => (
        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-700">
          {row.username}
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row) =>
        row.role === "admin" ? (
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
            Admin (Staf Administrasi)
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
            Petugas Store/Security
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
      key: "linked",
      header: "Jejak Aktivitas",
      align: "center",
      render: (row) => {
        const count = row.linked_records_count ?? 0;
        return (
          <span
            className="text-xs text-slate-600"
            title={
              count > 0
                ? "Memiliki relasi transaksi/audit log sehingga hanya bisa dinonaktifkan"
                : "Belum memiliki riwayat transaksi atau audit log"
            }
          >
            {count > 0 ? `${count} riwayat` : "Belum ada"}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      render: (row) => {
        const self = isTargetSelf(row);
        const lastAdmin = isTargetLastActiveAdmin(row);
        const hasLinked = (row.linked_records_count ?? 0) > 0;
        const disableDeactivate = row.is_active && (self || lastAdmin);
        const disableDelete = self || lastAdmin || hasLinked;

        const deleteReason = self
          ? "Tidak dapat menghapus akun yang sedang digunakan login"
          : lastAdmin
            ? "Minimal harus ada satu Admin aktif"
            : hasLinked
              ? "Memiliki riwayat transaksi/audit; gunakan Nonaktifkan"
              : "Hapus akun permanen";

        return (
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
              disabled={disableDeactivate}
              title={
                disableDeactivate
                  ? self
                    ? "Tidak dapat menonaktifkan akun sendiri"
                    : "Minimal harus ada satu Admin aktif"
                  : row.is_active
                    ? "Nonaktifkan akun"
                    : "Aktifkan kembali akun"
              }
              onClick={() => setStatusTarget(row)}
              leftIcon={<PowerIcon className="h-3.5 w-3.5" />}
            >
              {row.is_active ? "Nonaktifkan" : "Aktifkan"}
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={disableDelete}
              title={deleteReason}
              onClick={() => setDeleteTarget(row)}
              leftIcon={<TrashIcon className="h-3.5 w-3.5" />}
              aria-label={`Hapus akun ${row.name}`}
            >
              Hapus
            </Button>
          </div>
        );
      },
    },
  ];

  const editingOwnAccount =
    modalMode === "edit" && editingUser ? isTargetSelf(editingUser) : false;
  const editingLastActiveAdmin =
    modalMode === "edit" && editingUser
      ? isTargetLastActiveAdmin(editingUser)
      : false;
  const lockRoleOrStatus = editingOwnAccount || editingLastActiveAdmin;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Akun"
          value={summary?.total ?? 0}
          subtitle="Seluruh akun Admin & Petugas terdaftar"
          icon={<UsersIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
        <SummaryCard
          title="Akun Aktif"
          value={summary?.active ?? 0}
          subtitle="Akun yang diizinkan mengakses sistem"
          variant="inbound"
          icon={<CheckCircleIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
        <SummaryCard
          title="Akun Nonaktif"
          value={summary?.inactive ?? 0}
          subtitle="Diblokir dari login, riwayat tetap aman"
          variant="outbound"
          icon={<PowerIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
        <SummaryCard
          title="Admin Aktif"
          value={summary?.active_admins ?? 0}
          subtitle={`Total Petugas: ${summary?.petugas ?? 0} akun`}
          badgeText={`Admin: ${summary?.admin ?? 0}`}
          variant="admin"
          icon={<LockShieldIcon className="h-5 w-5" />}
          isLoading={isLoading && !summary}
        />
      </div>

      {fetchError && (
        <Alert variant="error" title="Gagal Memuat Data Akun">
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
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label
                htmlFor="users-search"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                Cari Akun
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="users-search"
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Nama, username, atau email..."
                  className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="users-role-filter"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                Filter Role
              </label>
              <select
                id="users-role-filter"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value as "" | UserRole);
                  setPage(1);
                }}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
              >
                <option value="">Semua Role</option>
                <option value="admin">Admin (Staf Administrasi)</option>
                <option value="petugas">Petugas Store/Security</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="users-status-filter"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                Filter Status
              </label>
              <select
                id="users-status-filter"
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
              Tambah Akun
            </Button>
          </div>
        </div>
      </section>

      <DataTable
        columns={columns}
        data={users}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        skeletonRows={5}
        caption="Daftar Akun Pengguna InOutTrack"
        emptyState={{
          title: "Data tidak ditemukan",
          description: hasActiveFilters
            ? "Tidak ada akun pengguna yang cocok dengan kata kunci atau filter yang dipilih."
            : "Belum ada akun pengguna terdaftar. Tambahkan akun baru untuk mulai mengelola akses.",
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
              Tambah Akun
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
                akun pengguna
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
            ? "Tambah Akun Pengguna"
            : "Ubah Akun Pengguna"
        }
        description={
          modalMode === "create"
            ? "Buat akun baru untuk Admin atau Petugas Store/Security dengan password minimal 8 karakter."
            : "Perbarui identitas, role, atau status aktif akun pengguna."
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
              form="user-management-form"
              variant="primary"
              isLoading={isSaving}
              loadingText="Menyimpan..."
            >
              {modalMode === "create" ? "Simpan Akun" : "Simpan Perubahan"}
            </Button>
          </>
        }
      >
        <form
          id="user-management-form"
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
            label="Nama Lengkap"
            required
            value={formState.name}
            onChange={(e) => {
              setFormState((prev) => ({ ...prev, name: e.target.value }));
              if (formErrors.name) {
                setFormErrors((prev) => ({ ...prev, name: undefined }));
              }
            }}
            placeholder="Contoh: Budi Santoso"
            error={formErrors.name}
            disabled={isSaving}
          />

          <TextInput
            label="Username"
            required
            value={formState.username}
            onChange={(e) => {
              setFormState((prev) => ({ ...prev, username: e.target.value }));
              if (formErrors.username) {
                setFormErrors((prev) => ({ ...prev, username: undefined }));
              }
            }}
            placeholder="Contoh: budi.store"
            helperText="Harus unik. Hanya huruf, angka, titik (.), garis bawah (_), atau tanda hubung (-)."
            error={formErrors.username}
            disabled={isSaving}
          />

          <TextInput
            label="Alamat Email"
            type="email"
            value={formState.email}
            onChange={(e) => {
              setFormState((prev) => ({ ...prev, email: e.target.value }));
              if (formErrors.email) {
                setFormErrors((prev) => ({ ...prev, email: undefined }));
              }
            }}
            placeholder="Opsional, contoh: budi@perusahaan.co.id"
            error={formErrors.email}
            disabled={isSaving}
          />

          <TextInput
            label={modalMode === "create" ? "Password Awal" : "Password Baru"}
            type={showPassword ? "text" : "password"}
            required={modalMode === "create"}
            value={formState.password}
            onChange={(e) => {
              setFormState((prev) => ({ ...prev, password: e.target.value }));
              if (formErrors.password) {
                setFormErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            placeholder={
              modalMode === "create"
                ? "Minimal 8 karakter"
                : "Kosongkan jika tidak diubah"
            }
            helperText={
              modalMode === "create"
                ? "Password minimal 8 karakter."
                : "Kosongkan jika tidak ingin mengganti password. Jika diisi, minimal 8 karakter."
            }
            error={formErrors.password}
            disabled={isSaving}
            rightAdornment={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
                aria-label={
                  showPassword ? "Sembunyikan password" : "Lihat password"
                }
              >
                {showPassword ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            }
          />

          <SelectInput
            label="Role Pengguna"
            required
            value={formState.role}
            onChange={(e) =>
              setFormState((prev) => ({
                ...prev,
                role: e.target.value as UserRole,
              }))
            }
            disabled={isSaving || lockRoleOrStatus}
            helperText={
              editingOwnAccount
                ? "Anda tidak dapat mengubah role akun sendiri."
                : editingLastActiveAdmin
                  ? "Minimal harus ada satu Admin aktif dalam sistem."
                  : undefined
            }
            error={formErrors.role}
            options={[
              { value: "petugas", label: "Petugas Store/Security" },
              { value: "admin", label: "Admin (Staf Administrasi)" },
            ]}
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
                disabled={isSaving || lockRoleOrStatus}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div>
                <span className="block text-sm font-medium text-slate-800">
                  Status Akun Aktif
                </span>
                <span className="block text-xs text-slate-500">
                  {lockRoleOrStatus
                    ? "Akun ini tidak dapat dinonaktifkan karena merupakan akun Anda sendiri atau Admin aktif terakhir."
                    : "Akun nonaktif tidak dapat melakukan login ke sistem."}
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
            ? "Nonaktifkan Akun Pengguna?"
            : "Aktifkan Kembali Akun?"
        }
        description={
          statusTarget?.is_active
            ? `Akun "${statusTarget.name}" (${statusTarget.username}) tidak akan dapat login ke sistem setelah dinonaktifkan, tetapi seluruh riwayat transaksi dan log auditnya tetap terjaga.`
            : `Akun "${statusTarget?.name}" (${statusTarget?.username}) akan diaktifkan kembali sehingga dapat login ke sistem.`
        }
        confirmLabel={
          statusTarget?.is_active ? "Ya, Nonaktifkan" : "Ya, Aktifkan"
        }
        cancelLabel="Batal"
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        variant="danger"
        isLoading={isDeleting}
        title="Hapus Akun Pengguna Secara Permanen?"
        description={`Akun "${deleteTarget?.name}" (${deleteTarget?.username}) belum memiliki riwayat transaksi maupun log audit sehingga aman dihapus permanen. Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus Permanen"
        cancelLabel="Batal"
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <DashboardShell
      allowedRoles={["admin"]}
      pageTitle="Manajemen Akun Pengguna"
      pageSubtitle="Kelola akun Staf Administrasi (Admin) dan Petugas Store/Security sesuai hak akses."
    >
      <UsersManagementContent />
    </DashboardShell>
  );
}
