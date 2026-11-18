"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  CameraIcon,
  CloseIcon,
  EyeIcon,
  ImageIcon,
  PencilIcon,
  RefreshIcon,
  SwitchCameraIcon,
  TrashIcon,
  UploadCloudIcon,
} from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import {
  ALLOWED_PHOTO_ACCEPT,
  MAX_PHOTO_SIZE_MB,
  MAX_TRANSACTION_PHOTOS,
  createSelectedPhotoItem,
  formatFileSize,
  revokePhotoItemUrl,
  validatePhotoFile,
  type SelectedPhotoItem,
} from "@/lib/photo-utils";

export type TransactionPhotoPickerProps = {
  photos: SelectedPhotoItem[];
  onChange: (nextPhotos: SelectedPhotoItem[]) => void;
  maxPhotos?: number;
  label?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
};

type CameraStatus = "idle" | "starting" | "active" | "error";

function resolveCameraErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "name" in err) {
    const name = String((err as { name: unknown }).name);
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Izin akses kamera ditolak oleh browser. Izinkan akses kamera di pengaturan situs atau gunakan opsi Unggah Foto dari perangkat.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "Kamera tidak ditemukan pada perangkat ini. Anda tetap dapat melampirkan foto melalui opsi Unggah Foto dari perangkat.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "Kamera sedang digunakan aplikasi lain atau gagal diinisialisasi. Gunakan opsi Unggah Foto dari perangkat sebagai alternatif.";
    }
    if (name === "SecurityError") {
      return "Akses kamera membutuhkan koneksi aman (HTTPS atau localhost). Silakan gunakan opsi Unggah Foto dari perangkat.";
    }
  }
  return "Kamera tidak dapat diakses saat ini. Anda tetap dapat memilih atau mengunggah foto dari galeri/folder perangkat.";
}

function sourceLabel(source: SelectedPhotoItem["source"]): string {
  return source === "camera" ? "Kamera" : "Unggahan";
}

function formatBadgeLabel(file: File): string {
  const mime = (file.type || "").toLowerCase();
  if (mime === "image/png") return "PNG";
  if (mime === "image/webp") return "WEBP";
  if (mime === "image/jpeg") return "JPG";
  const ext = file.name.split(".").pop()?.toUpperCase();
  return ext || "IMG";
}

export function TransactionPhotoPicker({
  photos,
  onChange,
  maxPhotos = MAX_TRANSACTION_PHOTOS,
  label = "Foto Barang Transaksi",
  required = true,
  error,
  disabled = false,
}: TransactionPhotoPickerProps) {
  const sectionId = useId();
  const [localError, setLocalError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(
    null,
  );
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);
  const [previewModalItem, setPreviewModalItem] =
    useState<SelectedPhotoItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraSessionRef = useRef(0);
  const photosRef = useRef<SelectedPhotoItem[]>(photos);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    if (cameraStatus === "active" && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      void videoRef.current.play().catch(() => undefined);
    }
  }, [cameraStatus]);

  useEffect(() => {
    return () => {
      cameraSessionRef.current += 1;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      photosRef.current.forEach(revokePhotoItemUrl);
    };
  }, []);

  function stopMediaStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function closeCamera() {
    cameraSessionRef.current += 1;
    stopMediaStream();
    setCameraStatus("idle");
    setCameraErrorMessage(null);
    setReplacingPhotoId(null);
  }

  async function startCamera(
    targetFacingMode: "environment" | "user",
    targetReplaceId: string | null = null,
  ) {
    if (disabled) return;

    setLocalError(null);
    setCameraErrorMessage(null);

    if (!targetReplaceId && photos.length >= maxPhotos) {
      setLocalError(
        `Maksimal ${maxPhotos} foto per transaksi. Hapus atau ganti foto yang sudah ada terlebih dahulu.`,
      );
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      stopMediaStream();
      setReplacingPhotoId(null);
      setCameraStatus("error");
      setCameraErrorMessage(
        "Browser ini tidak mendukung pengambilan foto langsung melalui getUserMedia. Silakan gunakan tombol Unggah Foto dari perangkat.",
      );
      return;
    }

    const sessionId = ++cameraSessionRef.current;
    stopMediaStream();
    setReplacingPhotoId(targetReplaceId);
    setCameraStatus("starting");

    let stream: MediaStream;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (constraintErr) {
        const errName =
          constraintErr &&
          typeof constraintErr === "object" &&
          "name" in constraintErr
            ? String((constraintErr as { name: unknown }).name)
            : "";

        if (
          errName === "OverconstrainedError" ||
          errName === "ConstraintNotSatisfiedError"
        ) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } else {
          throw constraintErr;
        }
      }

      if (cameraSessionRef.current !== sessionId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      if (cameraSessionRef.current !== sessionId) {
        stopMediaStream();
        return;
      }

      setCameraStatus("active");
    } catch (err) {
      if (cameraSessionRef.current !== sessionId) return;
      stopMediaStream();
      setReplacingPhotoId(null);
      setCameraStatus("error");
      setCameraErrorMessage(resolveCameraErrorMessage(err));
    }
  }

  function handleSwitchFacingMode() {
    const nextFacingMode =
      facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacingMode);
    void startCamera(nextFacingMode, replacingPhotoId);
  }

  function handleCaptureFromCamera() {
    if (disabled || cameraStatus !== "active") return;
    const video = videoRef.current;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setLocalError(
        "Stream kamera belum siap mengambil gambar. Tunggu sesaat lalu coba lagi.",
      );
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setLocalError("Gagal memproses frame kamera pada perangkat ini.");
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setLocalError("Gagal menghasilkan file gambar dari kamera.");
          return;
        }

        const stamp = new Date()
          .toISOString()
          .replace(/[-:TZ.]/g, "")
          .slice(0, 14);
        const capturedFile = new File([blob], `kamera_${stamp}.jpg`, {
          type: "image/jpeg",
        });

        const validationError = validatePhotoFile(capturedFile);
        if (validationError) {
          setLocalError(validationError);
          return;
        }

        setLocalError(null);
        const newItem = createSelectedPhotoItem(capturedFile, "camera");

        if (replacingPhotoId) {
          const target = photosRef.current.find(
            (p) => p.id === replacingPhotoId,
          );
          const next = photosRef.current.map((item) =>
            item.id === replacingPhotoId ? newItem : item,
          );
          if (target) {
            revokePhotoItemUrl(target);
          }
          onChange(next);
          closeCamera();
          return;
        }

        if (photosRef.current.length >= maxPhotos) {
          revokePhotoItemUrl(newItem);
          setLocalError(`Maksimal ${maxPhotos} foto per transaksi.`);
          closeCamera();
          return;
        }

        const next = [...photosRef.current, newItem];
        onChange(next);

        if (next.length >= maxPhotos) {
          closeCamera();
        }
      },
      "image/jpeg",
      0.88,
    );
  }

  function processIncomingFiles(incoming: FileList | File[]) {
    if (disabled) return;

    const files = Array.from(incoming);
    if (files.length === 0) return;

    setLocalError(null);

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      setLocalError(
        `Batas maksimal ${maxPhotos} foto sudah terpenuhi. Hapus atau ganti salah satu foto terlebih dahulu.`,
      );
      return;
    }

    const errors: string[] = [];
    const addedItems: SelectedPhotoItem[] = [];

    for (const file of files) {
      if (addedItems.length >= remainingSlots) {
        errors.push(
          `Sebagian file dilewati karena batas maksimal adalah ${maxPhotos} foto per transaksi.`,
        );
        break;
      }

      const fileError = validatePhotoFile(file);
      if (fileError) {
        errors.push(fileError);
        continue;
      }

      addedItems.push(createSelectedPhotoItem(file, "upload"));
    }

    if (addedItems.length > 0) {
      onChange([...photos, ...addedItems]);
    }

    if (errors.length > 0) {
      setLocalError(errors.join(" "));
    }
  }

  function handleUploadInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      processIncomingFiles(e.target.files);
    }
    e.target.value = "";
  }

  function handleTriggerReplaceUpload(photoId: string) {
    if (disabled) return;
    setLocalError(null);
    setReplacingPhotoId(photoId);
    replaceFileInputRef.current?.click();
  }

  function handleReplaceInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const targetId = replacingPhotoId;
    e.target.value = "";

    if (!file || !targetId) {
      setReplacingPhotoId(null);
      return;
    }

    const fileError = validatePhotoFile(file);
    if (fileError) {
      setLocalError(fileError);
      setReplacingPhotoId(null);
      return;
    }

    const existing = photos.find((item) => item.id === targetId);
    const replacement = createSelectedPhotoItem(file, "upload");
    const nextPhotos = photos.map((item) =>
      item.id === targetId ? replacement : item,
    );

    if (existing) {
      revokePhotoItemUrl(existing);
    }

    setLocalError(null);
    setReplacingPhotoId(null);
    onChange(nextPhotos);
  }

  function handleRemovePhoto(photoId: string) {
    if (disabled) return;
    const existing = photos.find((item) => item.id === photoId);
    const next = photos.filter((item) => item.id !== photoId);
    if (existing) {
      revokePhotoItemUrl(existing);
    }
    if (previewModalItem?.id === photoId) {
      setPreviewModalItem(null);
    }
    if (replacingPhotoId === photoId) {
      setReplacingPhotoId(null);
    }
    setLocalError(null);
    onChange(next);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!disabled && photos.length < maxPhotos) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) {
      processIncomingFiles(e.dataTransfer.files);
    }
  }

  const slotsRemaining = Math.max(0, maxPhotos - photos.length);
  const displayedError = localError || error;
  const replacingIndex = replacingPhotoId
    ? photos.findIndex((item) => item.id === replacingPhotoId) + 1
    : 0;

  return (
    <div className="space-y-4" aria-labelledby={sectionId}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <label
            id={sectionId}
            className="block text-sm font-semibold text-slate-800"
          >
            {label}
            {required && (
              <span className="ml-1 text-red-600" aria-hidden="true">
                *
              </span>
            )}
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Format JPG, JPEG, PNG, atau WEBP • Maksimal {MAX_PHOTO_SIZE_MB} MB
            per file • Maksimal {maxPhotos} foto per transaksi.
          </p>
        </div>

        <span
          className={`inline-flex w-fit shrink-0 whitespace-nowrap items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            photos.length > 0
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-slate-100 text-slate-600 ring-slate-200"
          }`}
        >
          {photos.length} / {maxPhotos} Foto Terpilih
        </span>
      </div>

      {/* Input file tersembunyi untuk unggah baru (multi) & ganti slot tunggal */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_PHOTO_ACCEPT}
        multiple
        disabled={disabled}
        onChange={handleUploadInputChange}
        className="sr-only"
        aria-label="Pilih file foto dari perangkat"
        data-testid="photo-upload-input"
      />
      <input
        ref={replaceFileInputRef}
        type="file"
        accept={ALLOWED_PHOTO_ACCEPT}
        disabled={disabled}
        onChange={handleReplaceInputChange}
        className="sr-only"
        aria-label="Pilih file foto pengganti"
        data-testid="photo-replace-input"
      />

      {/* Area tombol aksi kamera & unggah file / dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-4 transition-colors sm:p-5 ${
          isDragging
            ? "border-blue-500 bg-blue-50/70"
            : "border-slate-300 bg-slate-50/70"
        }`}
      >
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-2xs ring-1 ring-slate-200">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">
                {slotsRemaining > 0
                  ? `Tambahkan foto barang (sisa ${slotsRemaining} slot)`
                  : `Batas ${maxPhotos} foto telah tercapai`}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {slotsRemaining > 0
                  ? "Gunakan kamera langsung atau seret dan lepas / pilih file gambar dari galeri perangkat."
                  : "Gunakan tombol Ubah/Foto Ulang atau Hapus pada kartu preview di bawah jika ingin mengganti foto."}
              </p>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={
                disabled ||
                slotsRemaining === 0 ||
                cameraStatus === "starting"
              }
              onClick={() => void startCamera(facingMode, null)}
              leftIcon={<CameraIcon className="h-4 w-4" />}
              className="whitespace-nowrap"
              data-testid="open-camera-button"
            >
              {cameraStatus === "starting" && !replacingPhotoId
                ? "Membuka Kamera..."
                : "Ambil dari Kamera"}
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={disabled || slotsRemaining === 0}
              onClick={() => fileInputRef.current?.click()}
              leftIcon={<UploadCloudIcon className="h-4 w-4" />}
              className="whitespace-nowrap"
              data-testid="upload-photo-button"
            >
              Unggah Foto
            </Button>
          </div>
        </div>
      </div>

      {/* Fallback & Peringatan Kamera */}
      {cameraStatus === "error" && cameraErrorMessage && (
        <Alert variant="warning" title="Kamera Tidak Tersedia / Izin Ditolak">
          <div className="space-y-3">
            <p>{cameraErrorMessage}</p>
            {slotsRemaining > 0 && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  leftIcon={<UploadCloudIcon className="h-3.5 w-3.5" />}
                >
                  Pilih File dari Perangkat
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void startCamera(facingMode, null)}
                  leftIcon={<RefreshIcon className="h-3.5 w-3.5" />}
                >
                  Coba Akses Kamera Lagi
                </Button>
              </div>
            )}
          </div>
        </Alert>
      )}

      {/* Panel Live Kamera (getUserMedia) */}
      {(cameraStatus === "starting" || cameraStatus === "active") && (
        <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-950 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
              <span
                className={`h-2 w-2 rounded-full ${
                  cameraStatus === "active"
                    ? "animate-pulse bg-emerald-400"
                    : "bg-amber-400"
                }`}
              />
              {replacingIndex > 0
                ? `Mode Foto Ulang untuk Foto ${replacingIndex}`
                : `Kamera Langsung (${
                    facingMode === "environment" ? "Belakang" : "Depan"
                  })`}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSwitchFacingMode}
                disabled={cameraStatus !== "active"}
                leftIcon={<SwitchCameraIcon className="h-3.5 w-3.5" />}
                className="border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
              >
                Ganti Kamera
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeCamera}
                leftIcon={<CloseIcon className="h-3.5 w-3.5" />}
                className="text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Tutup
              </Button>
            </div>
          </div>

          <div className="relative flex aspect-video max-h-96 w-full items-center justify-center bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-contain"
            />
            {cameraStatus === "starting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/85 text-xs text-slate-200">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                <span>Menghubungkan ke kamera perangkat...</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-3">
            <p className="text-xs text-slate-400">
              Arahkan kamera ke barang dan pastikan pencahayaan cukup sebelum
              mengambil gambar.
            </p>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={cameraStatus !== "active"}
              onClick={handleCaptureFromCamera}
              leftIcon={<CameraIcon className="h-4 w-4" />}
              data-testid="capture-camera-button"
            >
              {replacingIndex > 0
                ? `Ambil Foto Pengganti (${replacingIndex})`
                : "Ambil Gambar"}
            </Button>
          </div>
        </div>
      )}

      {/* Pesan Error Validasi Frontend / Backend */}
      {displayedError && (
        <Alert variant="error" title="Validasi Foto">
          {displayedError}
        </Alert>
      )}

      {/* Grid Preview Foto Terpilih */}
      {photos.length > 0 && (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="photo-preview-grid"
        >
          {photos.map((item, idx) => (
            <div
              key={item.id}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs"
            >
              <div className="relative aspect-video bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt={`Pratinjau foto barang ${idx + 1}: ${item.file.name}`}
                  className="h-full w-full cursor-pointer object-cover"
                  onClick={() => setPreviewModalItem(item)}
                />
                <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                  <span className="rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-xs">
                    Foto {idx + 1}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold backdrop-blur-xs ${
                      item.source === "camera"
                        ? "bg-blue-600/90 text-white"
                        : "bg-emerald-600/90 text-white"
                    }`}
                  >
                    {sourceLabel(item.source)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewModalItem(item)}
                  className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/75 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-xs hover:bg-slate-900"
                  title="Perbesar pratinjau foto"
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  Perbesar
                </button>
              </div>

              <div className="flex flex-1 flex-col justify-between gap-3 p-3.5">
                <div>
                  <p
                    className="truncate text-sm font-medium text-slate-900"
                    title={item.file.name}
                  >
                    {item.file.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatBadgeLabel(item.file)} •{" "}
                    {formatFileSize(item.file.size)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => void startCamera(facingMode, item.id)}
                    leftIcon={<CameraIcon className="h-3.5 w-3.5" />}
                  >
                    Foto Ulang
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => handleTriggerReplaceUpload(item.id)}
                    leftIcon={<PencilIcon className="h-3.5 w-3.5" />}
                  >
                    Ganti File
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={disabled}
                    onClick={() => handleRemovePhoto(item.id)}
                    leftIcon={<TrashIcon className="h-3.5 w-3.5" />}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Perbesar Pratinjau */}
      <Modal
        open={previewModalItem !== null}
        onClose={() => setPreviewModalItem(null)}
        title={previewModalItem?.file.name ?? "Pratinjau Foto"}
        description={
          previewModalItem
            ? `${sourceLabel(previewModalItem.source)} • ${formatBadgeLabel(
                previewModalItem.file,
              )} • ${formatFileSize(previewModalItem.file.size)}`
            : undefined
        }
        size="xl"
        footer={
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewModalItem(null)}
          >
            Tutup
          </Button>
        }
      >
        {previewModalItem && (
          <div className="flex justify-center overflow-hidden rounded-lg bg-slate-950 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewModalItem.previewUrl}
              alt={`Detail foto ${previewModalItem.file.name}`}
              className="max-h-[70vh] w-auto rounded object-contain"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
