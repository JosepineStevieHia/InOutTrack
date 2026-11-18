export const MAX_TRANSACTION_PHOTOS = 3;
export const MAX_PHOTO_SIZE_MB = 5;
export const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;

export const ALLOWED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const ALLOWED_PHOTO_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

export const ALLOWED_PHOTO_ACCEPT =
  ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export type PhotoCaptureSource = "camera" | "upload";

export type SelectedPhotoItem = {
  id: string;
  file: File;
  previewUrl: string;
  source: PhotoCaptureSource;
};

/**
 * Validasi format (JPG/JPEG/PNG/WEBP) dan ukuran (<= 5 MB) file foto di frontend.
 * Mengembalikan pesan error Bahasa Indonesia jika tidak valid, atau null jika valid.
 */
export function validatePhotoFile(file: File): string | null {
  const nameLower = file.name.toLowerCase();
  const hasAllowedExt = ALLOWED_PHOTO_EXTENSIONS.some((ext) =>
    nameLower.endsWith(ext),
  );
  const mimeLower = (file.type || "").toLowerCase();
  const hasAllowedMime = (
    ALLOWED_PHOTO_MIME_TYPES as readonly string[]
  ).includes(mimeLower);

  if (!hasAllowedExt && !hasAllowedMime) {
    return `Format "${file.name}" tidak didukung. Gunakan file JPG, JPEG, PNG, atau WEBP.`;
  }

  if (mimeLower !== "" && !hasAllowedMime) {
    return `Tipe file "${file.name}" (${mimeLower}) bukan foto JPG, JPEG, PNG, atau WEBP.`;
  }

  if (file.size <= 0) {
    return `File "${file.name}" kosong atau tidak dapat dibaca.`;
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return `Ukuran "${file.name}" (${formatFileSize(file.size)}) melebihi batas maksimal ${MAX_PHOTO_SIZE_MB} MB.`;
  }

  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function createSelectedPhotoItem(
  file: File,
  source: PhotoCaptureSource,
): SelectedPhotoItem {
  const uniqueId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id: uniqueId,
    file,
    previewUrl: URL.createObjectURL(file),
    source,
  };
}

export function revokePhotoItemUrl(item: SelectedPhotoItem): void {
  if (item.previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(item.previewUrl);
  }
}
