"use client";

import Link from "next/link";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { TransactionPhotoPicker } from "@/components/transactions/TransactionPhotoPicker";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  SelectInput,
  TextInput,
  TextareaInput,
} from "@/components/ui/FormField";
import {
  CheckCircleIcon,
  HistoryIcon,
  InboundIcon,
  LockShieldIcon,
  OutboundIcon,
  RefreshIcon,
} from "@/components/ui/Icons";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ApiError,
  createInboundTransaction,
  createOutboundTransaction,
  getOperationalWorkTypes,
  type TransactionRecord,
  type WorkTypeItem,
} from "@/lib/api";
import {
  revokePhotoItemUrl,
  type SelectedPhotoItem,
} from "@/lib/photo-utils";

export type TransactionEntryFormProps = {
  direction: "in" | "out";
};

type FormFields = {
  transaction_datetime: string;
  item_name: string;
  quantity: string;
  unit: string;
  work_type_id: string;
  work_description: string;
  party_location: string; // origin (in) or destination (out)
  counterparty_name: string; // sender_name (in) or taker_name (out)
};

type FieldErrorKey =
  | "transaction_datetime"
  | "item_name"
  | "quantity"
  | "unit"
  | "work_type_id"
  | "work_description"
  | "party_location"
  | "counterparty_name"
  | "photos"
  | "general";

type FormErrors = Partial<Record<FieldErrorKey, string>>;

const COMMON_UNITS = [
  "Pcs",
  "Unit",
  "Box",
  "Roll",
  "Meter",
  "Kg",
  "Liter",
  "Set",
  "Lembar",
];

function formatNowForDateTimeLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatReadableDateTime(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function TransactionEntryContent({ direction }: TransactionEntryFormProps) {
  const isInbound = direction === "in";
  const { user, isPetugas } = useAuth();
  const toast = useToast();
  const unitDatalistId = useId();

  const [workTypes, setWorkTypes] = useState<WorkTypeItem[]>([]);
  const [isLoadingWorkTypes, setIsLoadingWorkTypes] = useState(true);
  const [workTypesError, setWorkTypesError] = useState<string | null>(null);
  const [reloadWorkTypesKey, setReloadWorkTypesKey] = useState(0);

  const [maxDateTime, setMaxDateTime] = useState(() =>
    formatNowForDateTimeLocal(),
  );
  const [fields, setFields] = useState<FormFields>(() => ({
    transaction_datetime: formatNowForDateTimeLocal(),
    item_name: "",
    quantity: "",
    unit: "",
    work_type_id: "",
    work_description: "",
    party_location: "",
    counterparty_name: "",
  }));
  const [photos, setPhotos] = useState<SelectedPhotoItem[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedTransaction, setSavedTransaction] =
    useState<TransactionRecord | null>(null);

  useEffect(() => {
    let active = true;

    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setIsLoadingWorkTypes(true);
        setWorkTypesError(null);
        return getOperationalWorkTypes();
      })
      .then((list) => {
        if (!active || !list) return;
        setWorkTypes(list);
      })
      .catch((error) => {
        if (!active) return;
        const message =
          error instanceof ApiError
            ? error.message
            : "Gagal memuat daftar jenis pekerjaan aktif.";
        setWorkTypesError(message);
      })
      .finally(() => {
        if (active) setIsLoadingWorkTypes(false);
      });

    return () => {
      active = false;
    };
  }, [reloadWorkTypesKey]);

  function updateField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    const errorKey = key as FieldErrorKey;
    if (errors[errorKey] || errors.general) {
      setErrors((prev) => ({
        ...prev,
        [errorKey]: undefined,
        general: undefined,
      }));
    }
  }

  function handleSetCurrentDateTime() {
    const nowStr = formatNowForDateTimeLocal();
    setMaxDateTime(nowStr);
    updateField("transaction_datetime", nowStr);
  }

  function handlePhotosChange(nextPhotos: SelectedPhotoItem[]) {
    setPhotos(nextPhotos);
    if (errors.photos || errors.general) {
      setErrors((prev) => ({
        ...prev,
        photos: undefined,
        general: undefined,
      }));
    }
  }

  function validateClientForm(): FormErrors {
    const nextErrors: FormErrors = {};
    const nowMs = Date.now();
    setMaxDateTime(formatNowForDateTimeLocal());

    if (!fields.transaction_datetime.trim()) {
      nextErrors.transaction_datetime = isInbound
        ? "Tanggal dan waktu kedatangan wajib diisi."
        : "Tanggal dan waktu keluar wajib diisi.";
    } else {
      const parsedDate = new Date(fields.transaction_datetime);
      if (Number.isNaN(parsedDate.getTime())) {
        nextErrors.transaction_datetime =
          "Format tanggal dan waktu transaksi tidak valid.";
      } else {
        // Toleransi hingga akhir menit berjalan karena datetime-local berpresisi menit
        if (parsedDate.getTime() > nowMs + 59_000) {
          nextErrors.transaction_datetime =
            "Tanggal dan waktu transaksi tidak boleh berada di masa depan.";
        } else if (
          isPetugas &&
          parsedDate.getTime() < nowMs - (24 * 60 + 5) * 60 * 1000
        ) {
          nextErrors.transaction_datetime =
            "Petugas hanya dapat mencatat waktu transaksi maksimal 24 jam ke belakang.";
        }
      }
    }

    const trimmedItem = fields.item_name.trim();
    if (!trimmedItem) {
      nextErrors.item_name = "Nama barang wajib diisi.";
    } else if (trimmedItem.length > 255) {
      nextErrors.item_name = "Nama barang maksimal 255 karakter.";
    }

    const trimmedQty = fields.quantity.trim().replace(",", ".");
    if (!trimmedQty) {
      nextErrors.quantity = "Jumlah barang wajib diisi.";
    } else {
      const qtyNum = Number(trimmedQty);
      if (Number.isNaN(qtyNum) || qtyNum <= 0) {
        nextErrors.quantity = "Jumlah barang harus berupa angka lebih dari 0.";
      } else if (!/^\d+(\.\d{1,2})?$/.test(trimmedQty)) {
        nextErrors.quantity =
          "Jumlah barang maksimal memiliki 2 angka di belakang koma.";
      }
    }

    const trimmedUnit = fields.unit.trim();
    if (!trimmedUnit) {
      nextErrors.unit = "Satuan barang wajib diisi.";
    } else if (trimmedUnit.length > 50) {
      nextErrors.unit = "Satuan barang maksimal 50 karakter.";
    }

    if (!fields.work_type_id) {
      nextErrors.work_type_id = "Jenis pekerjaan wajib dipilih.";
    }

    const trimmedLocation = fields.party_location.trim();
    if (!trimmedLocation) {
      nextErrors.party_location = isInbound
        ? "Asal barang wajib diisi."
        : "Tujuan barang wajib diisi.";
    } else if (trimmedLocation.length > 255) {
      nextErrors.party_location = isInbound
        ? "Asal barang maksimal 255 karakter."
        : "Tujuan barang maksimal 255 karakter.";
    }

    const trimmedCounterparty = fields.counterparty_name.trim();
    if (!trimmedCounterparty) {
      nextErrors.counterparty_name = isInbound
        ? "Nama pengantar wajib diisi."
        : "Nama pengambil wajib diisi.";
    } else if (trimmedCounterparty.length > 150) {
      nextErrors.counterparty_name = isInbound
        ? "Nama pengantar maksimal 150 karakter."
        : "Nama pengambil maksimal 150 karakter.";
    }

    if (fields.work_description.trim().length > 500) {
      nextErrors.work_description =
        "Deskripsi pekerjaan maksimal 500 karakter.";
    }

    if (photos.length === 0) {
      nextErrors.photos = "Minimal satu foto barang wajib dilampirkan.";
    }

    return nextErrors;
  }

  function mapServerErrors(apiErr: ApiError): FormErrors {
    const mapped: FormErrors = { general: apiErr.message };
    if (!apiErr.errors) return mapped;

    for (const [serverKey, messages] of Object.entries(apiErr.errors)) {
      if (!messages || messages.length === 0) continue;
      const msg = messages[0];

      if (serverKey === "origin" || serverKey === "destination") {
        mapped.party_location = msg;
      } else if (
        serverKey === "sender_name" ||
        serverKey === "taker_name"
      ) {
        mapped.counterparty_name = msg;
      } else if (serverKey === "photos" || serverKey.startsWith("photos.")) {
        mapped.photos = mapped.photos ?? msg;
      } else if (
        serverKey === "transaction_datetime" ||
        serverKey === "item_name" ||
        serverKey === "quantity" ||
        serverKey === "unit" ||
        serverKey === "work_type_id" ||
        serverKey === "work_description"
      ) {
        mapped[serverKey] = msg;
      }
    }

    return mapped;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) return;

    const clientErrors = validateClientForm();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      toast.error(
        "Periksa Data Form",
        "Masih ada field wajib atau ketentuan validasi yang belum terpenuhi.",
      );
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    const normalizedQty = fields.quantity.trim().replace(",", ".");
    const workDescriptionClean = fields.work_description.trim() || null;
    const files = photos.map((item) => item.file);

    try {
      const response = isInbound
        ? await createInboundTransaction({
            transaction_datetime: fields.transaction_datetime,
            item_name: fields.item_name.trim(),
            quantity: normalizedQty,
            unit: fields.unit.trim(),
            work_type_id: Number(fields.work_type_id),
            work_description: workDescriptionClean,
            origin: fields.party_location.trim(),
            sender_name: fields.counterparty_name.trim(),
            photos: files,
          })
        : await createOutboundTransaction({
            transaction_datetime: fields.transaction_datetime,
            item_name: fields.item_name.trim(),
            quantity: normalizedQty,
            unit: fields.unit.trim(),
            work_type_id: Number(fields.work_type_id),
            work_description: workDescriptionClean,
            destination: fields.party_location.trim(),
            taker_name: fields.counterparty_name.trim(),
            photos: files,
          });

      photos.forEach(revokePhotoItemUrl);
      const nowStr = formatNowForDateTimeLocal();
      setMaxDateTime(nowStr);
      setFields({
        transaction_datetime: nowStr,
        item_name: "",
        quantity: "",
        unit: "",
        work_type_id: "",
        work_description: "",
        party_location: "",
        counterparty_name: "",
      });
      setPhotos([]);
      setSavedTransaction(response.transaction);
      toast.success(
        isInbound
          ? "Barang Masuk Tersimpan"
          : "Barang Keluar Tersimpan",
        response.message,
      );
    } catch (error) {
      // Pertahankan seluruh isian form & foto agar pengguna dapat mencoba ulang (PRD Bagian 6)
      if (error instanceof ApiError) {
        const mapped = mapServerErrors(error);
        setErrors(mapped);
        toast.error("Gagal Menyimpan Transaksi", error.message);
      } else {
        const msg =
          "Gagal terhubung ke server. Data form dan foto Anda tetap tersimpan di halaman ini—silakan coba lagi.";
        setErrors({ general: msg });
        toast.error("Koneksi Terputus", msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const descriptionLength = fields.work_description.length;
  const officerFieldLabel = isInbound
    ? "Nama Penerima (Otomatis)"
    : "Nama Pemberi (Otomatis)";

  return (
    <div className="space-y-6">
      {/* Banner Petugas Pencatat Otomatis */}
      <div
        className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
          isInbound
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-amber-200 bg-amber-50/70"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              isInbound
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {isInbound ? (
              <InboundIcon className="h-5 w-5" />
            ) : (
              <OutboundIcon className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {isInbound
                ? "Form Pencatatan Barang Masuk (MASUK)"
                : "Form Pencatatan Barang Keluar (KELUAR)"}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {isInbound
                ? "Penerima barang tercatat otomatis atas nama akun Anda dan divalidasi langsung oleh server."
                : "Pemberi barang tercatat otomatis atas nama akun Anda dan divalidasi langsung oleh server."}
            </p>
          </div>
        </div>

        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          <LockShieldIcon className="h-3.5 w-3.5 text-blue-600" />
          Pencatat: {user?.name ?? "-"}
        </span>
      </div>

      {/* Ringkasan Transaksi Terbaru yang Baru Disimpan */}
      {savedTransaction && (
        <section
          className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-2xs sm:p-5"
          data-testid="saved-transaction-summary"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <h2 className="text-sm font-semibold text-emerald-950">
                  {savedTransaction.type_label} #{savedTransaction.id} Berhasil
                  Disimpan
                </h2>
                <p className="mt-0.5 text-xs text-emerald-800">
                  {savedTransaction.item_name} •{" "}
                  {savedTransaction.quantity_formatted} {savedTransaction.unit}{" "}
                  •{" "}
                  {formatReadableDateTime(
                    savedTransaction.transaction_datetime,
                  )}
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  {isInbound
                    ? `Asal: ${savedTransaction.origin} | Pengantar: ${savedTransaction.sender_name} | Penerima: ${savedTransaction.recipient_name}`
                    : `Tujuan: ${savedTransaction.destination} | Pengambil: ${savedTransaction.taker_name} | Pemberi: ${savedTransaction.giver_name}`}{" "}
                  | {savedTransaction.photos?.length ?? 0} foto tersimpan
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link href="/transactions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<HistoryIcon className="h-3.5 w-3.5" />}
                >
                  Lihat Riwayat
                </Button>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSavedTransaction(null)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </section>
      )}

      {workTypesError && (
        <Alert variant="error" title="Gagal Memuat Jenis Pekerjaan">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{workTypesError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReloadWorkTypesKey((prev) => prev + 1)}
              leftIcon={<RefreshIcon className="h-3.5 w-3.5" />}
            >
              Muat Ulang
            </Button>
          </div>
        </Alert>
      )}

      {!isLoadingWorkTypes && !workTypesError && workTypes.length === 0 && (
        <Alert variant="warning" title="Belum Ada Jenis Pekerjaan Aktif">
          Belum ada master jenis pekerjaan yang aktif. Hubungi Staf Administrasi
          (Admin) untuk menambahkan atau mengaktifkan jenis pekerjaan agar
          transaksi dapat dicatat.
        </Alert>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs sm:p-6"
      >
        {errors.general && (
          <Alert variant="error" title="Gagal Menyimpan Transaksi">
            {errors.general}
          </Alert>
        )}

        {/* Bagian 1: Informasi Barang & Waktu */}
        <div className="space-y-4">
          <div className="border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-semibold text-slate-900">
              1. Detail Barang &amp; Waktu Transaksi
            </h2>
            <p className="text-xs text-slate-500">
              {isPetugas
                ? "Waktu default menggunakan jam saat ini. Petugas tidak dapat mengisi waktu di masa depan atau lebih dari 24 jam ke belakang."
                : "Waktu tidak boleh di masa depan."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <TextInput
                    label={
                      isInbound
                        ? "Tanggal & Waktu Kedatangan"
                        : "Tanggal & Waktu Keluar"
                    }
                    type="datetime-local"
                    required
                    max={maxDateTime}
                    value={fields.transaction_datetime}
                    onFocus={() =>
                      setMaxDateTime(formatNowForDateTimeLocal())
                    }
                    onChange={(e) =>
                      updateField("transaction_datetime", e.target.value)
                    }
                    error={errors.transaction_datetime}
                    disabled={isSubmitting}
                    data-testid="input-transaction-datetime"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  disabled={isSubmitting}
                  onClick={handleSetCurrentDateTime}
                  className="mb-px shrink-0 whitespace-nowrap"
                >
                  Sekarang
                </Button>
              </div>
            </div>

            <TextInput
              label="Nama Barang"
              required
              maxLength={255}
              value={fields.item_name}
              onChange={(e) => updateField("item_name", e.target.value)}
              placeholder="Contoh: Kabel NYM 3x2.5mm atau Bearing SKF 6204"
              error={errors.item_name}
              disabled={isSubmitting}
              data-testid="input-item-name"
            />

            <TextInput
              label="Jumlah"
              type="number"
              required
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={fields.quantity}
              onChange={(e) => updateField("quantity", e.target.value)}
              placeholder="Contoh: 10 atau 12.5"
              helperText="Harus lebih dari 0 (boleh desimal hingga 2 digit, misal 12.5)."
              error={errors.quantity}
              disabled={isSubmitting}
              data-testid="input-quantity"
            />

            <div className="space-y-1.5">
              <TextInput
                label="Satuan"
                required
                maxLength={50}
                list={unitDatalistId}
                value={fields.unit}
                onChange={(e) => updateField("unit", e.target.value)}
                placeholder="Contoh: Pcs, Unit, Box, Kg, Meter"
                error={errors.unit}
                disabled={isSubmitting}
                data-testid="input-unit"
              />
              <datalist id={unitDatalistId}>
                {COMMON_UNITS.map((unitOption) => (
                  <option key={unitOption} value={unitOption} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {COMMON_UNITS.slice(0, 6).map((quickUnit) => (
                  <button
                    key={quickUnit}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => updateField("unit", quickUnit)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      fields.unit.toLowerCase() === quickUnit.toLowerCase()
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    } disabled:opacity-50`}
                  >
                    {quickUnit}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bagian 2: Asal/Tujuan, Pihak Terkait & Pekerjaan */}
        <div className="space-y-4">
          <div className="border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-semibold text-slate-900">
              {isInbound
                ? "2. Sumber Barang, Pihak Terkait & Pekerjaan"
                : "2. Tujuan Barang, Pihak Terkait & Pekerjaan"}
            </h2>
            <p className="text-xs text-slate-500">
              Lengkapi asal/tujuan, pihak pengantar/pengambil, serta jenis
              pekerjaan terkait.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextInput
              label={isInbound ? "Asal Barang" : "Tujuan"}
              required
              maxLength={255}
              value={fields.party_location}
              onChange={(e) => updateField("party_location", e.target.value)}
              placeholder={
                isInbound
                  ? "Contoh: PT Supplier Nusantara / Gudang Eksternal"
                  : "Contoh: Line Produksi A / Area Maintenance"
              }
              error={errors.party_location}
              disabled={isSubmitting}
              data-testid="input-party-location"
            />

            <TextInput
              label={isInbound ? "Nama Pengantar" : "Nama Pengambil"}
              required
              maxLength={150}
              value={fields.counterparty_name}
              onChange={(e) =>
                updateField("counterparty_name", e.target.value)
              }
              placeholder={
                isInbound
                  ? "Nama kurir / supplier yang mengantar"
                  : "Nama teknisi / staf yang mengambil barang"
              }
              error={errors.counterparty_name}
              disabled={isSubmitting}
              data-testid="input-counterparty-name"
            />

            <SelectInput
              label="Jenis Pekerjaan"
              required
              value={fields.work_type_id}
              onChange={(e) => updateField("work_type_id", e.target.value)}
              placeholder={
                isLoadingWorkTypes
                  ? "Memuat jenis pekerjaan..."
                  : "Pilih jenis pekerjaan"
              }
              disabled={isSubmitting || isLoadingWorkTypes}
              error={errors.work_type_id}
              options={workTypes.map((wt) => ({
                value: String(wt.id),
                label: wt.name,
              }))}
              data-testid="select-work-type"
            />

            <TextInput
              label={officerFieldLabel}
              value={user?.name ?? ""}
              readOnly
              disabled
              helperText={
                isInbound
                  ? "Diambil otomatis dari akun yang login dan dikunci oleh server."
                  : "Diambil otomatis dari akun yang login dan dikunci oleh server."
              }
              data-testid="input-auto-officer"
            />
          </div>

          <div>
            <TextareaInput
              label="Deskripsi Pekerjaan"
              value={fields.work_description}
              onChange={(e) =>
                updateField("work_description", e.target.value)
              }
              placeholder="Jelaskan keperluan atau catatan tambahan pekerjaan (opsional, maksimal 500 karakter)"
              rows={3}
              error={errors.work_description}
              disabled={isSubmitting}
              data-testid="textarea-work-description"
            />
            <div className="mt-1 flex justify-end">
              <span
                className={`text-xs ${
                  descriptionLength > 500
                    ? "font-semibold text-red-600"
                    : "text-slate-500"
                }`}
              >
                {descriptionLength} / 500 karakter
              </span>
            </div>
          </div>
        </div>

        {/* Bagian 3: Foto Barang (Komponen Reusable Tahap 6) */}
        <div className="space-y-4 border-t border-slate-100 pt-5">
          <TransactionPhotoPicker
            photos={photos}
            onChange={handlePhotosChange}
            label={isInbound ? "Foto Barang Masuk" : "Foto Barang Keluar"}
            required
            error={errors.photos}
            disabled={isSubmitting}
          />
        </div>

        {/* Tombol Submit dengan Pencegahan Submit Ganda */}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard">
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Kembali ke Dashboard
            </Button>
          </Link>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            loadingText={
              isInbound
                ? "Menyimpan Barang Masuk..."
                : "Menyimpan Barang Keluar..."
            }
            disabled={isSubmitting || workTypes.length === 0}
            className="w-full whitespace-nowrap sm:w-auto"
            data-testid="submit-transaction-button"
          >
            {isInbound ? "Simpan Barang Masuk" : "Simpan Barang Keluar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function TransactionEntryForm({
  direction,
}: TransactionEntryFormProps) {
  const isInbound = direction === "in";

  return (
    <DashboardShell
      allowedRoles={["admin", "petugas"]}
      pageTitle={isInbound ? "Barang Masuk" : "Barang Keluar"}
      pageSubtitle={
        isInbound
          ? "Catat penerimaan barang masuk beserta asal, pengantar, jenis pekerjaan, dan minimal satu foto."
          : "Catat pengeluaran barang keluar beserta tujuan, pengambil, jenis pekerjaan, dan minimal satu foto."
      }
    >
      <TransactionEntryContent direction={direction} />
    </DashboardShell>
  );
}
