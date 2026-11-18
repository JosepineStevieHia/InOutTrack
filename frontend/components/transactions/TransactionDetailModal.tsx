"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  EyeIcon,
  ImageIcon,
  InboundIcon,
  OutboundIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import {
  ApiError,
  getTransactionDetail,
  type TransactionPhotoRecord,
  type TransactionRecord,
} from "@/lib/api";
import { formatFileSize } from "@/lib/photo-utils";
import {
  formatTransactionDateTime,
  getCounterpartyInfo,
  getOfficerDisplayName,
} from "@/lib/transaction-utils";

export type TransactionDetailModalProps = {
  open: boolean;
  transaction: TransactionRecord | null;
  isAdmin: boolean;
  onClose: () => void;
  onRequestEdit?: (transaction: TransactionRecord) => void;
  onRequestDelete?: (transaction: TransactionRecord) => void;
};

export function TransactionDetailModal({
  open,
  transaction,
  isAdmin,
  onClose,
  onRequestEdit,
  onRequestDelete,
}: TransactionDetailModalProps) {
  const [detail, setDetail] = useState<TransactionRecord | null>(transaction);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] =
    useState<TransactionPhotoRecord | null>(null);

  const transactionId = transaction?.id ?? null;

  useEffect(() => {
    let active = true;

    if (!open || !transactionId) {
      Promise.resolve().then(() => {
        if (!active) return;
        setDetail(null);
        setDetailError(null);
        setIsLoadingDetail(false);
        setLightboxPhoto(null);
      });
      return () => {
        active = false;
      };
    }

    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setDetail(transaction);
        setDetailError(null);
        setIsLoadingDetail(true);
        return getTransactionDetail(transactionId);
      })
      .then((res) => {
        if (!active || !res) return;
        setDetail(res.transaction);
      })
      .catch((err) => {
        if (!active) return;
        setDetailError(
          err instanceof ApiError
            ? err.message
            : "Gagal memuat detail transaksi terbaru.",
        );
      })
      .finally(() => {
        if (active) setIsLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [open, transactionId, transaction]);

  const current = detail ?? transaction;
  const counterparty = current ? getCounterpartyInfo(current) : null;
  const photos = current?.photos ?? [];

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={
          current
            ? `Detail Transaksi #${current.id}`
            : "Detail Transaksi"
        }
        description={
          current
            ? `${current.type_label} • ${formatTransactionDateTime(current.transaction_datetime)}`
            : undefined
        }
        size="xl"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div>
              {isAdmin && current && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRequestEdit?.(current)}
                    leftIcon={<PencilIcon className="h-4 w-4" />}
                    data-testid="detail-modal-edit-button"
                  >
                    Edit Transaksi
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => onRequestDelete?.(current)}
                    leftIcon={<TrashIcon className="h-4 w-4" />}
                    data-testid="detail-modal-delete-button"
                  >
                    Hapus Transaksi
                  </Button>
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="detail-modal-close-button"
            >
              Tutup
            </Button>
          </div>
        }
      >
        {current ? (
          <div className="space-y-6" data-testid="transaction-detail-modal">
            {detailError && (
              <Alert variant="warning" title="Informasi">
                {detailError}
              </Alert>
            )}

            {/* Header Status & Ringkasan Barang */}
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  {current.type === "MASUK" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <InboundIcon className="h-3.5 w-3.5" />
                      Barang Masuk
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      <OutboundIcon className="h-3.5 w-3.5" />
                      Barang Keluar
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {current.work_type?.name ?? "-"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {current.item_name}
                </h3>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Jumlah
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {current.quantity_formatted} {current.unit}
                </p>
              </div>
            </div>

            {/* Rincian Metadata Operasional */}
            <dl className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Waktu Transaksi
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                  {formatTransactionDateTime(current.transaction_datetime)}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {current.type === "MASUK"
                    ? "Petugas Penerima"
                    : "Petugas Pemberi"}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                  {getOfficerDisplayName(current)}
                  {current.recorder?.username && (
                    <span className="ml-1.5 text-xs font-normal text-slate-500">
                      (@{current.recorder.username})
                    </span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  {counterparty?.locationLabel}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {counterparty?.location}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Nama {counterparty?.actorLabel}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {counterparty?.actorName}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">
                  Deskripsi Pekerjaan
                </dt>
                <dd className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {current.work_description || "Tidak ada keterangan tambahan."}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Dicatat Pada
                </dt>
                <dd className="mt-0.5 text-xs text-slate-600">
                  {formatTransactionDateTime(current.created_at)}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-slate-500">
                  Terakhir Diperbarui
                </dt>
                <dd className="mt-0.5 text-xs text-slate-600">
                  {formatTransactionDateTime(current.updated_at)}
                </dd>
              </div>
            </dl>

            {/* Galeri Foto Bukti Transaksi */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ImageIcon className="h-4 w-4 text-blue-600" />
                  Foto Dokumentasi Barang ({photos.length})
                </h4>
                {isLoadingDetail && (
                  <span className="text-xs text-slate-500">
                    Memuat detail terbaru...
                  </span>
                )}
              </div>

              {photos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
                  Tidak ada foto terlampir pada transaksi ini.
                </div>
              ) : (
                <div
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  data-testid="detail-photo-gallery"
                >
                  {photos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs"
                    >
                      <div className="relative aspect-video bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={`Foto transaksi ${current.item_name} #${index + 1}`}
                          className="h-full w-full cursor-pointer object-cover transition-transform hover:scale-[1.02]"
                          onClick={() => setLightboxPhoto(photo)}
                        />
                        <span className="absolute left-2.5 top-2.5 rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-white">
                          Foto {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLightboxPhoto(photo)}
                          className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/75 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-900"
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                          Perbesar
                        </button>
                      </div>
                      <div className="p-3">
                        <p
                          className="truncate text-xs font-medium text-slate-900"
                          title={photo.original_name}
                        >
                          {photo.original_name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {formatFileSize(photo.file_size)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </Modal>

      {/* Modal Pratinjau Ukuran Penuh */}
      <Modal
        open={lightboxPhoto !== null}
        onClose={() => setLightboxPhoto(null)}
        title={lightboxPhoto?.original_name ?? "Pratinjau Foto"}
        description={
          lightboxPhoto
            ? `Ukuran: ${formatFileSize(lightboxPhoto.file_size)}`
            : undefined
        }
        size="xl"
        footer={
          <Button
            type="button"
            variant="outline"
            onClick={() => setLightboxPhoto(null)}
          >
            Tutup Pratinjau
          </Button>
        }
      >
        {lightboxPhoto && (
          <div className="flex justify-center overflow-hidden rounded-lg bg-slate-950 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxPhoto.url}
              alt={`Pratinjau penuh ${lightboxPhoto.original_name}`}
              className="max-h-[75vh] w-auto rounded object-contain"
            />
          </div>
        )}
      </Modal>
    </>
  );
}
