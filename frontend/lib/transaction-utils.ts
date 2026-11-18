import type { TransactionRecord } from "@/lib/api";

/**
 * Format ISO timestamp menjadi tanggal singkat Indonesia (Asia/Jakarta).
 */
export function formatTransactionDate(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Format ISO timestamp menjadi jam Indonesia (Asia/Jakarta) dengan akhiran WIB.
 */
export function formatTransactionTime(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const formatted = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(".", ":");
  return `${formatted} WIB`;
}

/**
 * Format ISO timestamp menjadi tanggal dan waktu lengkap Indonesia (Asia/Jakarta).
 */
export function formatTransactionDateTime(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${formatTransactionDate(iso)}, ${formatTransactionTime(iso)}`;
}

/**
 * Konversi ISO timestamp ke nilai `YYYY-MM-DDTHH:mm` (Asia/Jakarta) untuk input `datetime-local`.
 */
export function toDateTimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}`;
}

export function getOfficerDisplayName(tx: TransactionRecord): string {
  if (tx.type === "MASUK") {
    return tx.recipient_name || tx.recorder?.name || "-";
  }
  return tx.giver_name || tx.recorder?.name || "-";
}

export function getCounterpartyInfo(tx: TransactionRecord): {
  locationLabel: string;
  location: string;
  actorLabel: string;
  actorName: string;
} {
  if (tx.type === "MASUK") {
    return {
      locationLabel: "Asal Barang",
      location: tx.origin || "-",
      actorLabel: "Pengantar",
      actorName: tx.sender_name || "-",
    };
  }
  return {
    locationLabel: "Tujuan Barang",
    location: tx.destination || "-",
    actorLabel: "Pengambil",
    actorName: tx.taker_name || "-",
  };
}

export type PeriodPreset =
  | "all"
  | "today"
  | "7d"
  | "30d"
  | "this_month"
  | "custom";

export function formatJakartaYmd(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Menghasilkan rentang tanggal YYYY-MM-DD (timezone Asia/Jakarta) untuk preset periode.
 */
export function getPeriodDateRange(
  preset: Exclude<PeriodPreset, "custom">,
): { dateFrom: string; dateTo: string } {
  const todayStr = formatJakartaYmd(new Date());
  if (preset === "all") {
    return { dateFrom: "", dateTo: "" };
  }
  if (preset === "today") {
    return { dateFrom: todayStr, dateTo: todayStr };
  }

  const [year, month, day] = todayStr.split("-").map(Number);
  const baseUtc = new Date(Date.UTC(year, month - 1, day));

  if (preset === "this_month") {
    const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
    return { dateFrom: firstOfMonth, dateTo: todayStr };
  }

  const offsetDays = preset === "7d" ? 6 : 29;
  const startUtc = new Date(baseUtc.getTime() - offsetDays * 86400000);
  const startStr = `${startUtc.getUTCFullYear()}-${String(
    startUtc.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(startUtc.getUTCDate()).padStart(2, "0")}`;

  return { dateFrom: startStr, dateTo: todayStr };
}
