"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { TransactionPhotoPicker } from "@/components/transactions/TransactionPhotoPicker";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  SelectInput,
  TextInput,
  TextareaInput,
} from "@/components/ui/FormField";
import { TrashIcon, RefreshIcon } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  updateTransaction,
  type TransactionFilterWorkType,
  type TransactionPhotoRecord,
  type TransactionRecord,
} from "@/lib/api";
import {
  MAX_TRANSACTION_PHOTOS,
  formatFileSize,
  revokePhotoItemUrl,
  type SelectedPhotoItem,
} from "@/lib/photo-utils";
import { toDateTimeLocalValue } from "@/lib/transaction-utils";

export type TransactionEditModalProps = {
  open: boolean;
  transaction: TransactionRecord | null;
  workTypes: TransactionFilterWorkType[];
  onClose: () => void;
  onSuccess: (updated: TransactionRecord, message: string) => void;
};

type EditFormState = {
  transaction_datetime: string;
  item_name: string;
  quantity: string;
  unit: string;
  work_type_id: string;
  work_description: string;
  party_location: string;
  counterparty_name: string;
};

type EditErrors = Partial<
  Record<keyof EditFormState | "photos" | "general", string>
>;

export function TransactionEditModal({
  open,
  transaction,
  workTypes,
  onClose,
  onSuccess,
}: TransactionEditModalProps) {
  const [form, setForm] = useState<EditFormState>({
    transaction_datetime: "",
    item_name: "",
    quantity: "",
    unit: "",
    work_type_id: "",
    work_description: "",
    party_location: "",
    counterparty_name: "",
  });
  const [existingPhotos, setExistingPhotos] = useState<TransactionPhotoRecord[]>(
    [],
  );
  const [deletePhotoIds, setDeletePhotoIds] = useState<number[]>([]);
  const [newPhotos, setNewPhotos] = useState<SelectedPhotoItem[]>([]);
  const [photoToggleWarning, setPhotoToggleWarning] = useState<string | null>(
    null,
  );
  const [errors, setErrors] = useState<EditErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const newPhotosRef = useRef<SelectedPhotoItem[]>([]);
  const isInbound = transaction?.type === "MASUK";

  useEffect(() => {
    newPhotosRef.current = newPhotos;
  }, [newPhotos]);

  useEffect(() => {
    return () => {
      newPhotosRef.current.forEach(revokePhotoItemUrl);
    };
  }, []);

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (!active) return;

      newPhotosRef.current.forEach(revokePhotoItemUrl);
      setNewPhotos([]);
      setDeletePhotoIds([]);
      setPhotoToggleWarning(null);

      if (!open || !transaction) {
        setExistingPhotos([]);
        setErrors({});
        return;
      }

      setForm({
        transaction_datetime: toDateTimeLocalValue(
          transaction.transaction_datetime,
        ),
        item_name: transaction.item_name,
        quantity: String(transaction.quantity),
        unit: transaction.unit,
        work_type_id: String(transaction.work_type_id),
        work_description: transaction.work_description ?? "",
        party_location: isInbound
          ? (transaction.origin ?? "")
          : (transaction.destination ?? ""),
        counterparty_name: isInbound
          ? (transaction.sender_name ?? "")
          : (transaction.taker_name ?? ""),
      });
      setExistingPhotos(transaction.photos ?? []);
      setErrors({});
    });

    return () => {
      active = false;
    };
  }, [open, transaction, isInbound]);

  const remainingExistingCount = existingPhotos.filter(
    (p) => !deletePhotoIds.includes(p.id),
  ).length;
  const maxNewPhotos = Math.max(
    0,
    MAX_TRANSACTION_PHOTOS - remainingExistingCount,
  );
  const totalPhotosAfterSave = remainingExistingCount + newPhotos.length;

  const toggleDeleteExistingPhoto = (photoId: number) => {
    setPhotoToggleWarning(null);
    setErrors((prev) => ({ ...prev, photos: undefined }));

    if (deletePhotoIds.includes(photoId)) {
      if (totalPhotosAfterSave + 1 > MAX_TRANSACTION_PHOTOS) {
        setPhotoToggleWarning(
          `Tidak dapat membatalkan penghapusan karena total foto tidak boleh melebihi ${MAX_TRANSACTION_PHOTOS} foto. Hapus salah satu foto baru terlebih dahulu.`,
        );
        return;
      }
      setDeletePhotoIds((prev) => prev.filter((id) => id !== photoId));
    } else {
      setDeletePhotoIds((prev) => [...prev, photoId]);
    }
  };

  const validate = (): EditErrors => {
    const next: EditErrors = {};
    if (!form.transaction_datetime) {
      next.transaction_datetime = "Tanggal dan waktu transaksi wajib diisi.";
    } else if (new Date(form.transaction_datetime).getTime() > Date.now() + 60000) {
      next.transaction_datetime =
        "Tanggal dan waktu transaksi tidak boleh berada di masa depan.";
    }

    if (!form.item_name.trim()) {
      next.item_name = "Nama barang wajib diisi.";
    } else if (form.item_name.trim().length > 255) {
      next.item_name = "Nama barang maksimal 255 karakter.";
    }

    const numericQty = Number(form.quantity);
    if (!form.quantity || Number.isNaN(numericQty) || numericQty <= 0) {
      next.quantity = "Jumlah barang harus lebih dari 0.";
    }

    if (!form.unit.trim()) {
      next.unit = "Satuan barang wajib diisi.";
    } else if (form.unit.trim().length > 50) {
      next.unit = "Satuan barang maksimal 50 karakter.";
    }

    if (!form.work_type_id) {
      next.work_type_id = "Jenis pekerjaan wajib dipilih.";
    }

    if (form.work_description.trim().length > 500) {
      next.work_description = "Deskripsi pekerjaan maksimal 500 karakter.";
    }

    if (!form.party_location.trim()) {
      next.party_location = isInbound
        ? "Asal barang wajib diisi."
        : "Tujuan barang wajib diisi.";
    }

    if (!form.counterparty_name.trim()) {
      next.counterparty_name = isInbound
        ? "Nama pengantar wajib diisi."
        : "Nama pengambil wajib diisi.";
    }

    if (
      (existingPhotos.length > 0 || deletePhotoIds.length > 0) &&
      totalPhotosAfterSave < 1
    ) {
      next.photos = "Transaksi wajib memiliki minimal satu foto barang.";
    } else if (totalPhotosAfterSave > MAX_TRANSACTION_PHOTOS) {
      next.photos = `Total foto per transaksi maksimal ${MAX_TRANSACTION_PHOTOS} foto.`;
    }

    return next;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!transaction || isSaving) return;

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    setErrors({});

    try {
      const payload = {
        transaction_datetime: form.transaction_datetime,
        item_name: form.item_name.trim(),
        quantity: Number(form.quantity),
        unit: form.unit.trim(),
        work_type_id: Number(form.work_type_id),
        work_description: form.work_description.trim() || null,
        delete_photo_ids: deletePhotoIds,
        new_photos: newPhotos.map((item) => item.file),
        ...(isInbound
          ? {
              origin: form.party_location.trim(),
              sender_name: form.counterparty_name.trim(),
            }
          : {
              destination: form.party_location.trim(),
              taker_name: form.counterparty_name.trim(),
            }),
      };

      const res = await updateTransaction(transaction.id, payload);
      newPhotos.forEach(revokePhotoItemUrl);
      setNewPhotos([]);
      onSuccess(res.transaction, res.message);
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const mapped: EditErrors = {};
        if (err.errors.transaction_datetime?.[0]) {
          mapped.transaction_datetime = err.errors.transaction_datetime[0];
        }
        if (err.errors.item_name?.[0]) mapped.item_name = err.errors.item_name[0];
        if (err.errors.quantity?.[0]) mapped.quantity = err.errors.quantity[0];
        if (err.errors.unit?.[0]) mapped.unit = err.errors.unit[0];
        if (err.errors.work_type_id?.[0]) {
          mapped.work_type_id = err.errors.work_type_id[0];
        }
        if (err.errors.work_description?.[0]) {
          mapped.work_description = err.errors.work_description[0];
        }
        if (err.errors.origin?.[0]) mapped.party_location = err.errors.origin[0];
        if (err.errors.destination?.[0]) {
          mapped.party_location = err.errors.destination[0];
        }
        if (err.errors.sender_name?.[0]) {
          mapped.counterparty_name = err.errors.sender_name[0];
        }
        if (err.errors.taker_name?.[0]) {
          mapped.counterparty_name = err.errors.taker_name[0];
        }
        if (err.errors.photos?.[0]) {
          mapped.photos = err.errors.photos[0];
        } else if (err.errors.new_photos?.[0]) {
          mapped.photos = err.errors.new_photos[0];
        } else if (err.errors.delete_photo_ids?.[0]) {
          mapped.photos = err.errors.delete_photo_ids[0];
        } else {
          const dynamicPhotoError = Object.entries(err.errors).find(
            ([key]) =>
              key.startsWith("new_photos.") || key.startsWith("photos."),
          );
          if (dynamicPhotoError?.[1]?.[0]) {
            mapped.photos = dynamicPhotoError[1][0];
          }
        }
        if (Object.keys(mapped).length === 0) {
          mapped.general = err.message;
        }
        setErrors(mapped);
      } else {
        setErrors({
          general:
            err instanceof ApiError
              ? err.message
              : "Gagal menyimpan perubahan transaksi.",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const workTypeOptions = workTypes
    .filter(
      (wt) => wt.is_active || wt.id === transaction?.work_type_id,
    )
    .map((wt) => ({
      value: String(wt.id),
      label: wt.is_active ? wt.name : `${wt.name} (Nonaktif)`,
    }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        transaction
          ? `Edit Transaksi #${transaction.id} (${transaction.type_label})`
          : "Edit Transaksi"
      }
      description="Perubahan data maupun foto oleh Admin tercatat otomatis pada log audit sistem."
      size="xl"
      closeOnBackdropClick={!isSaving}
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-4"
        data-testid="edit-transaction-form"
      >
        {errors.general && (
          <Alert variant="error" title="Gagal Memperbarui Transaksi">
            {errors.general}
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            type="datetime-local"
            label={isInbound ? "Waktu Kedatangan" : "Waktu Keluar"}
            required
            value={form.transaction_datetime}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                transaction_datetime: e.target.value,
              }))
            }
            error={errors.transaction_datetime}
            disabled={isSaving}
            data-testid="edit-transaction-datetime"
          />

          <SelectInput
            label="Jenis Pekerjaan"
            required
            value={form.work_type_id}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, work_type_id: e.target.value }))
            }
            options={workTypeOptions}
            placeholder="Pilih jenis pekerjaan"
            error={errors.work_type_id}
            disabled={isSaving}
            data-testid="edit-transaction-work-type"
          />
        </div>

        <TextInput
          label="Nama Barang"
          required
          value={form.item_name}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, item_name: e.target.value }))
          }
          error={errors.item_name}
          disabled={isSaving}
          data-testid="edit-transaction-item-name"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            type="number"
            step="0.01"
            min="0.01"
            label="Jumlah"
            required
            value={form.quantity}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, quantity: e.target.value }))
            }
            error={errors.quantity}
            disabled={isSaving}
            data-testid="edit-transaction-quantity"
          />

          <TextInput
            label="Satuan"
            required
            value={form.unit}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, unit: e.target.value }))
            }
            error={errors.unit}
            disabled={isSaving}
            data-testid="edit-transaction-unit"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            label={isInbound ? "Asal Barang" : "Tujuan Barang"}
            required
            value={form.party_location}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, party_location: e.target.value }))
            }
            error={errors.party_location}
            disabled={isSaving}
            data-testid="edit-transaction-location"
          />

          <TextInput
            label={isInbound ? "Nama Pengantar" : "Nama Pengambil"}
            required
            value={form.counterparty_name}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                counterparty_name: e.target.value,
              }))
            }
            error={errors.counterparty_name}
            disabled={isSaving}
            data-testid="edit-transaction-counterparty"
          />
        </div>

        <TextareaInput
          label="Deskripsi Pekerjaan"
          rows={3}
          maxLength={500}
          value={form.work_description}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, work_description: e.target.value }))
          }
          error={errors.work_description}
          helperText={`${form.work_description.length}/500 karakter`}
          disabled={isSaving}
          data-testid="edit-transaction-description"
        />

        {/* Manajemen Foto Bukti Transaksi (1–3 Foto) */}
        <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Foto Bukti Transaksi (1–{MAX_TRANSACTION_PHOTOS} Foto)
              </h4>
              <p className="text-xs text-slate-500">
                Tandai foto lama yang ingin dihapus atau unggah/ambil foto baru.
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                totalPhotosAfterSave < 1
                  ? "bg-rose-100 text-rose-700"
                  : "bg-slate-200 text-slate-800"
              }`}
              data-testid="edit-photo-quota-badge"
            >
              Total setelah disimpan: {totalPhotosAfterSave}/{MAX_TRANSACTION_PHOTOS} foto
            </span>
          </div>

          {photoToggleWarning && (
            <Alert variant="warning" title="Periksa Batas Foto">
              {photoToggleWarning}
            </Alert>
          )}

          {existingPhotos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-700">
                Foto Tersimpan Saat Ini ({remainingExistingCount} dipertahankan,{" "}
                {deletePhotoIds.length} ditandai hapus)
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {existingPhotos.map((photo) => {
                  const markedForDelete = deletePhotoIds.includes(photo.id);
                  return (
                    <div
                      key={photo.id}
                      className={`flex flex-col overflow-hidden rounded-lg border bg-white transition-all ${
                        markedForDelete
                          ? "border-rose-300 bg-rose-50/40 opacity-75"
                          : "border-slate-200"
                      }`}
                      data-testid={`edit-existing-photo-${photo.id}`}
                    >
                      <div className="relative h-28 w-full bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={photo.original_name}
                          className={`h-full w-full object-cover ${
                            markedForDelete ? "grayscale" : ""
                          }`}
                        />
                        {markedForDelete && (
                          <span className="absolute inset-x-2 top-2 rounded bg-rose-600/95 px-2 py-0.5 text-center text-[11px] font-semibold text-white">
                            Akan Dihapus
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between gap-2 p-2.5">
                        <div className="min-w-0">
                          <p
                            className="truncate text-xs font-medium text-slate-900"
                            title={photo.original_name}
                          >
                            {photo.original_name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {formatFileSize(photo.file_size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={markedForDelete ? "outline" : "danger"}
                          onClick={() => toggleDeleteExistingPhoto(photo.id)}
                          disabled={isSaving}
                          leftIcon={
                            markedForDelete ? (
                              <RefreshIcon className="h-3.5 w-3.5" />
                            ) : (
                              <TrashIcon className="h-3.5 w-3.5" />
                            )
                          }
                          data-testid={`toggle-delete-photo-${photo.id}`}
                        >
                          {markedForDelete ? "Batal Hapus" : "Hapus Foto"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {maxNewPhotos > 0 ? (
            <TransactionPhotoPicker
              photos={newPhotos}
              onChange={(next) => {
                setPhotoToggleWarning(null);
                setErrors((prev) => ({ ...prev, photos: undefined }));
                setNewPhotos(next);
              }}
              maxPhotos={maxNewPhotos}
              label={`Tambah Foto Baru (Sisa kuota: ${maxNewPhotos} foto)`}
              required={remainingExistingCount === 0}
              error={errors.photos}
              disabled={isSaving}
            />
          ) : (
            <div className="space-y-2">
              <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-600">
                Kuota maksimal {MAX_TRANSACTION_PHOTOS} foto sudah terisi oleh foto
                tersimpan. Klik <strong>Hapus Foto</strong> pada salah satu foto di
                atas jika ingin menggantinya dengan foto baru.
              </p>
              {errors.photos && (
                <p className="text-xs font-medium text-rose-600">
                  {errors.photos}
                </p>
              )}
            </div>
          )}
        </section>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Batal
          </Button>
          <Button
            type="submit"
            isLoading={isSaving}
            loadingText="Menyimpan..."
            data-testid="edit-transaction-submit"
          >
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
