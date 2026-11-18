/**
 * Pusat konfigurasi API InOutTrack (Next.js -> Laravel, Sanctum SPA cookie-based).
 *
 * - Autentikasi memakai cookie session (HttpOnly) -> tidak ada token di localStorage.
 * - Semua request memakai `credentials: "include"`.
 * - CSRF: panggil `ensureCsrfCookie()` sebelum request state-changing (POST/PUT/PATCH/DELETE);
 *   cookie XSRF-TOKEN dikirim kembali sebagai header X-XSRF-TOKEN.
 */

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type UserRole = "admin" | "petugas";

export type UserPermissions = {
  can_manage_users: boolean;
  can_manage_work_types: boolean;
  can_create_transactions: boolean;
  can_view_transactions: boolean;
  can_manage_transactions: boolean;
  can_export_transactions: boolean;
  can_view_audit_logs: boolean;
};

export type AuthUser = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role: UserRole;
  role_label: string;
  is_active: boolean;
  permissions: UserPermissions;
  created_at: string | null;
  updated_at: string | null;
};

export type LoginPayload = {
  /** Username atau alamat email (FR-001) */
  login: string;
  password: string;
  remember?: boolean;
};

export type LoginResponse = {
  message: string;
  user: AuthUser;
};

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;
  /** Error validasi Laravel (422): { field: [pesan, ...] } */
  readonly errors?: Record<string, string[]>;
  /** Detik tunggu jika terkena rate limit (429) */
  readonly retryAfter?: number;

  constructor(message: string, status: number, data: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    if (status === 422 && data && typeof data === "object" && "errors" in data) {
      this.errors = (data as { errors: Record<string, string[]> }).errors;
    }
    if (
      status === 429 &&
      data &&
      typeof data === "object" &&
      "retry_after" in data
    ) {
      this.retryAfter = Number(
        (data as { retry_after: unknown }).retry_after,
      );
    }
  }

  get isUnauthenticated() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
  get isTooManyRequests() {
    return this.status === 429;
  }
  get isNetworkError() {
    return this.status === 0;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/** Minta cookie XSRF-TOKEN dari Laravel (wajib sebelum login / request mutasi). */
export async function ensureCsrfCookie(): Promise<void> {
  const res = await fetch(`${API_URL}/sanctum/csrf-cookie`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  }).catch(() => {
    throw new ApiError("Tidak dapat terhubung ke server.", 0);
  });
  if (!res.ok) {
    throw new ApiError("Gagal mengambil CSRF cookie.", res.status);
  }
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request<T>(
  method: Method,
  path: string,
  body?: unknown,
  retried = false,
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  if (body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (method !== "GET") {
    const xsrf = readCookie("XSRF-TOKEN");
    if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
      method,
      credentials: "include",
      headers,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? body
            : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "Tidak dapat terhubung ke server. Periksa koneksi atau status backend.",
      0,
    );
  }

  // 419 = CSRF token kedaluwarsa/tidak ada -> ambil ulang sekali lalu ulangi.
  if (res.status === 419 && !retried && method !== "GET") {
    await ensureCsrfCookie();
    return request<T>(method, path, body, true);
  }

  const data = await parseBody(res);

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : null) ?? `Request gagal (${res.status})`;
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export type HealthResponse = {
  status: string;
  app: string;
  time: string;
};

export const getHealth = () => api.get<HealthResponse>("/api/health");

/**
 * Login SPA menggunakan username atau email + password (FR-001).
 * Otomatis meminta CSRF cookie terlebih dahulu sebelum mengirim kredensial.
 */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  await ensureCsrfCookie();
  return api.post<LoginResponse>("/api/auth/login", payload);
}

/**
 * Ambil profil pengguna yang sedang login beserta role & permissions.
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const res = await api.get<{ user: AuthUser }>("/api/auth/me");
  return res.user;
}

/**
 * Logout dan akhiri sesi pengguna.
 */
export async function logout(): Promise<{ message: string }> {
  return api.post<{ message: string }>("/api/auth/logout");
}

/* --------------------------------------------------------------------------
 * Master Data: Manajemen Akun Pengguna & Jenis Pekerjaan (Admin Only)
 * ----------------------------------------------------------------------- */

export type PaginationMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

export type ManagedUser = AuthUser & {
  linked_records_count?: number;
  can_delete?: boolean;
};

export type UserListSummary = {
  total: number;
  active: number;
  inactive: number;
  admin: number;
  petugas: number;
  active_admins: number;
};

export type UserListResponse = {
  data: ManagedUser[];
  meta: PaginationMeta;
  summary: UserListSummary;
};

export type UserListParams = {
  search?: string;
  role?: "" | UserRole;
  status?: "" | "active" | "inactive";
  page?: number;
  per_page?: number;
};

export type CreateUserPayload = {
  name: string;
  username: string;
  email?: string | null;
  password: string;
  role: UserRole;
  is_active: boolean;
};

export type UpdateUserPayload = {
  name: string;
  username: string;
  email?: string | null;
  password?: string;
  role: UserRole;
  is_active: boolean;
};

export type UserMutationResponse = {
  message: string;
  user: ManagedUser;
};

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      qs.set(key, String(value));
    }
  });
  const encoded = qs.toString();
  return encoded ? `?${encoded}` : "";
}

export async function getUsers(params: UserListParams = {}): Promise<UserListResponse> {
  const query = buildQueryString(params);
  return api.get<UserListResponse>(`/api/admin/users${query}`);
}

export async function createUser(payload: CreateUserPayload): Promise<UserMutationResponse> {
  await ensureCsrfCookie();
  return api.post<UserMutationResponse>("/api/admin/users", payload);
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<UserMutationResponse> {
  await ensureCsrfCookie();
  return api.put<UserMutationResponse>(`/api/admin/users/${id}`, payload);
}

export async function updateUserStatus(id: number, isActive: boolean): Promise<UserMutationResponse> {
  await ensureCsrfCookie();
  return api.patch<UserMutationResponse>(`/api/admin/users/${id}/status`, { is_active: isActive });
}

export async function deleteUser(id: number): Promise<{ message: string }> {
  await ensureCsrfCookie();
  return api.delete<{ message: string }>(`/api/admin/users/${id}`);
}

export type WorkTypeItem = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  transactions_count?: number;
  created_at: string | null;
  updated_at: string | null;
};

export type WorkTypeListSummary = {
  total: number;
  active: number;
  inactive: number;
};

export type WorkTypeListResponse = {
  data: WorkTypeItem[];
  meta: PaginationMeta;
  summary: WorkTypeListSummary;
};

export type WorkTypeListParams = {
  search?: string;
  status?: "" | "active" | "inactive";
  page?: number;
  per_page?: number;
};

export type SaveWorkTypePayload = {
  name: string;
  description?: string | null;
  is_active: boolean;
};

export type WorkTypeMutationResponse = {
  message: string;
  work_type: WorkTypeItem;
};

export async function getWorkTypes(params: WorkTypeListParams = {}): Promise<WorkTypeListResponse> {
  const query = buildQueryString(params);
  return api.get<WorkTypeListResponse>(`/api/admin/work-types${query}`);
}

export async function createWorkType(payload: SaveWorkTypePayload): Promise<WorkTypeMutationResponse> {
  await ensureCsrfCookie();
  return api.post<WorkTypeMutationResponse>("/api/admin/work-types", payload);
}

export async function updateWorkType(id: number, payload: SaveWorkTypePayload): Promise<WorkTypeMutationResponse> {
  await ensureCsrfCookie();
  return api.put<WorkTypeMutationResponse>(`/api/admin/work-types/${id}`, payload);
}

export async function updateWorkTypeStatus(id: number, isActive: boolean): Promise<WorkTypeMutationResponse> {
  await ensureCsrfCookie();
  return api.patch<WorkTypeMutationResponse>(`/api/admin/work-types/${id}/status`, { is_active: isActive });
}

/* --------------------------------------------------------------------------
 * Photo Management: Upload & Validasi Foto Transaksi (FR-006, Bagian 6)
 * ----------------------------------------------------------------------- */

export type ValidatedPhotoMeta = {
  original_name: string;
  safe_filename: string;
  simulated_path: string;
  mime_type: string;
  file_size: number;
};

export type ValidatePhotosResponse = {
  message: string;
  count: number;
  photos: ValidatedPhotoMeta[];
};

export type TransactionPhotoRecord = {
  id: number;
  transaction_id: number;
  file_path: string;
  url: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: string | null;
  updated_at: string | null;
};

function appendPhotosFormData(files: File[]): FormData {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("photos[]", file);
  });
  return formData;
}

export async function validateTransactionPhotos(
  files: File[],
): Promise<ValidatePhotosResponse> {
  await ensureCsrfCookie();
  return api.post<ValidatePhotosResponse>(
    "/api/operational/transaction-photos/validate",
    appendPhotosFormData(files),
  );
}

export async function uploadTransactionPhotos(
  transactionId: number,
  files: File[],
): Promise<{ message: string; photos: TransactionPhotoRecord[] }> {
  await ensureCsrfCookie();
  return api.post<{ message: string; photos: TransactionPhotoRecord[] }>(
    `/api/operational/transactions/${transactionId}/photos`,
    appendPhotosFormData(files),
  );
}

export async function replaceTransactionPhoto(
  photoId: number,
  file: File,
): Promise<{ message: string; photo: TransactionPhotoRecord }> {
  await ensureCsrfCookie();
  const formData = new FormData();
  formData.append("photo", file);
  return api.post<{ message: string; photo: TransactionPhotoRecord }>(
    `/api/operational/transaction-photos/${photoId}/replace`,
    formData,
  );
}

export async function deleteTransactionPhoto(
  photoId: number,
): Promise<{ message: string }> {
  await ensureCsrfCookie();
  return api.delete<{ message: string }>(
    `/api/operational/transaction-photos/${photoId}`,
  );
}

/* --------------------------------------------------------------------------
 * Modul Transaksi: Barang Masuk & Barang Keluar (FR-004, FR-005, Bagian 6)
 * ----------------------------------------------------------------------- */

export type TransactionType = "MASUK" | "KELUAR";

export type TransactionRecord = {
  id: number;
  type: TransactionType;
  type_label: string;
  transaction_datetime: string | null;
  item_name: string;
  quantity: number;
  quantity_formatted: string;
  unit: string;
  work_type_id: number;
  work_type?: {
    id: number;
    name: string;
  } | null;
  work_description: string | null;
  origin: string | null;
  destination: string | null;
  sender_name: string | null;
  recipient_name: string | null;
  taker_name: string | null;
  giver_name: string | null;
  recorded_by: number;
  recorder?: {
    id: number;
    name: string;
    username: string;
    role: UserRole;
  } | null;
  created_by: number;
  updated_by: number | null;
  photos?: TransactionPhotoRecord[];
  created_at: string | null;
  updated_at: string | null;
};

type BaseTransactionPayload = {
  transaction_datetime: string;
  item_name: string;
  quantity: string | number;
  unit: string;
  work_type_id: number;
  work_description?: string | null;
  photos: File[];
};

export type CreateInboundTransactionPayload = BaseTransactionPayload & {
  origin: string;
  sender_name: string;
};

export type CreateOutboundTransactionPayload = BaseTransactionPayload & {
  destination: string;
  taker_name: string;
};

export type TransactionMutationResponse = {
  message: string;
  transaction: TransactionRecord;
};

function appendBaseTransactionFormData(
  formData: FormData,
  payload: BaseTransactionPayload,
): void {
  formData.append("transaction_datetime", payload.transaction_datetime);
  formData.append("item_name", payload.item_name);
  formData.append("quantity", String(payload.quantity));
  formData.append("unit", payload.unit);
  formData.append("work_type_id", String(payload.work_type_id));
  if (payload.work_description) {
    formData.append("work_description", payload.work_description);
  }
  payload.photos.forEach((file) => {
    formData.append("photos[]", file);
  });
}

export async function getOperationalWorkTypes(): Promise<WorkTypeItem[]> {
  const res = await api.get<{ data: WorkTypeItem[] }>(
    "/api/operational/work-types",
  );
  return res.data;
}

export async function createInboundTransaction(
  payload: CreateInboundTransactionPayload,
): Promise<TransactionMutationResponse> {
  await ensureCsrfCookie();
  const formData = new FormData();
  appendBaseTransactionFormData(formData, payload);
  formData.append("origin", payload.origin);
  formData.append("sender_name", payload.sender_name);

  return api.post<TransactionMutationResponse>(
    "/api/operational/transactions/in",
    formData,
  );
}

export async function createOutboundTransaction(
  payload: CreateOutboundTransactionPayload,
): Promise<TransactionMutationResponse> {
  await ensureCsrfCookie();
  const formData = new FormData();
  appendBaseTransactionFormData(formData, payload);
  formData.append("destination", payload.destination);
  formData.append("taker_name", payload.taker_name);

  return api.post<TransactionMutationResponse>(
    "/api/operational/transactions/out",
    formData,
  );
}

/* --------------------------------------------------------------------------
 * Riwayat Transaksi Gabungan, Detail, & Aksi Edit/Hapus Admin (Tahap 8)
 * ----------------------------------------------------------------------- */

export type TransactionListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  item_name?: string;
  recorded_by?: string | number;
  type?: "" | TransactionType;
  work_type_id?: string | number;
  date_from?: string;
  date_to?: string;
};

export type TransactionListSummary = {
  total: number;
  masuk: number;
  keluar: number;
};

export type TransactionFilterOfficer = {
  id: number;
  name: string;
  username: string;
  role: UserRole;
  is_active: boolean;
};

export type TransactionFilterWorkType = {
  id: number;
  name: string;
  is_active: boolean;
};

export type TransactionListResponse = {
  data: TransactionRecord[];
  meta: PaginationMeta;
  summary: TransactionListSummary;
  filter_options: {
    officers: TransactionFilterOfficer[];
    work_types: TransactionFilterWorkType[];
  };
};

export type UpdateTransactionPayload = {
  transaction_datetime: string;
  item_name: string;
  quantity: string | number;
  unit: string;
  work_type_id: number;
  work_description?: string | null;
  origin?: string;
  sender_name?: string;
  destination?: string;
  taker_name?: string;
  delete_photo_ids?: number[];
  new_photos?: File[];
};

export async function getTransactions(
  params: TransactionListParams = {},
): Promise<TransactionListResponse> {
  const query = buildQueryString(params);
  return api.get<TransactionListResponse>(`/api/operational/transactions${query}`);
}

export async function getTransactionDetail(
  transactionId: number,
): Promise<{ transaction: TransactionRecord }> {
  return api.get<{ transaction: TransactionRecord }>(
    `/api/operational/transactions/${transactionId}`,
  );
}

export async function updateTransaction(
  transactionId: number,
  payload: UpdateTransactionPayload,
): Promise<TransactionMutationResponse> {
  await ensureCsrfCookie();

  const hasPhotoChanges =
    (payload.delete_photo_ids && payload.delete_photo_ids.length > 0) ||
    (payload.new_photos && payload.new_photos.length > 0);

  if (hasPhotoChanges) {
    const formData = new FormData();
    formData.append("_method", "PUT");
    formData.append("transaction_datetime", payload.transaction_datetime);
    formData.append("item_name", payload.item_name);
    formData.append("quantity", String(payload.quantity));
    formData.append("unit", payload.unit);
    formData.append("work_type_id", String(payload.work_type_id));
    formData.append("work_description", payload.work_description ?? "");

    if (payload.origin !== undefined) {
      formData.append("origin", payload.origin);
    }
    if (payload.sender_name !== undefined) {
      formData.append("sender_name", payload.sender_name);
    }
    if (payload.destination !== undefined) {
      formData.append("destination", payload.destination);
    }
    if (payload.taker_name !== undefined) {
      formData.append("taker_name", payload.taker_name);
    }

    (payload.delete_photo_ids ?? []).forEach((photoId) => {
      formData.append("delete_photo_ids[]", String(photoId));
    });
    (payload.new_photos ?? []).forEach((file) => {
      formData.append("new_photos[]", file);
    });

    return api.post<TransactionMutationResponse>(
      `/api/admin/transactions/${transactionId}`,
      formData,
    );
  }

  return api.put<TransactionMutationResponse>(
    `/api/admin/transactions/${transactionId}`,
    {
      transaction_datetime: payload.transaction_datetime,
      item_name: payload.item_name,
      quantity: payload.quantity,
      unit: payload.unit,
      work_type_id: payload.work_type_id,
      work_description: payload.work_description ?? null,
      origin: payload.origin,
      sender_name: payload.sender_name,
      destination: payload.destination,
      taker_name: payload.taker_name,
    },
  );
}

export async function deleteTransaction(
  transactionId: number,
): Promise<{ message: string }> {
  await ensureCsrfCookie();
  return api.delete<{ message: string }>(
    `/api/admin/transactions/${transactionId}`,
  );
}

/* --------------------------------------------------------------------------
 * Dashboard Ringkasan & Ekspor Laporan PDF/Excel (Tahap 9)
 * ----------------------------------------------------------------------- */

export type DashboardSummaryResponse = {
  summary: TransactionListSummary;
  period: {
    date_from: string | null;
    date_to: string | null;
    label: string;
  };
  recent_transactions: TransactionRecord[];
};

export async function getDashboardSummary(params: {
  date_from?: string;
  date_to?: string;
} = {}): Promise<DashboardSummaryResponse> {
  const query = buildQueryString(params);
  return api.get<DashboardSummaryResponse>(`/api/operational/dashboard${query}`);
}

export type ExportFormat = "pdf" | "excel";

function extractFilenameFromHeader(
  disposition: string | null,
  fallback: string,
): string {
  if (!disposition) return fallback;
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].replace(/["']/g, "").trim());
    } catch {
      return fallback;
    }
  }
  const simpleMatch = disposition.match(/filename="?([^";]+)"?/i);
  return simpleMatch?.[1]?.trim() || fallback;
}

export async function downloadTransactionsExport(
  format: ExportFormat,
  params: TransactionListParams = {},
): Promise<{ filename: string }> {
  const query = buildQueryString({
    search: params.search,
    item_name: params.item_name,
    recorded_by: params.recorded_by,
    type: params.type,
    work_type_id: params.work_type_id,
    date_from: params.date_from,
    date_to: params.date_to,
  });

  const endpoint =
    format === "pdf"
      ? `/api/admin/transactions/export/pdf${query}`
      : `/api/admin/transactions/export/excel${query}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept:
          format === "pdf"
            ? "application/pdf, application/json"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
  } catch {
    throw new ApiError(
      "Tidak dapat terhubung ke server. Periksa koneksi atau status backend.",
      0,
    );
  }

  if (!res.ok) {
    let errorData: unknown = null;
    try {
      errorData = await res.json();
    } catch {
      errorData = null;
    }

    const message =
      errorData &&
      typeof errorData === "object" &&
      "message" in errorData
        ? String((errorData as { message: unknown }).message)
        : `Gagal mengekspor laporan (${res.status}).`;

    throw new ApiError(message, res.status, errorData);
  }

  const blob = await res.blob();
  const fallbackExt = format === "pdf" ? "pdf" : "xlsx";
  const fallbackName = `laporan-transaksi-inouttrack.${fallbackExt}`;
  const filename = extractFilenameFromHeader(
    res.headers.get("Content-Disposition"),
    fallbackName,
  );

  if (typeof window !== "undefined") {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  return { filename };
}

/* --------------------------------------------------------------------------
 * Log Audit Transaksi Khusus Admin (Tahap 10, FR-012)
 * ----------------------------------------------------------------------- */

export type AuditAction = "UPDATE" | "DELETE" | "RESTORE";

export type AuditSnapshotPhoto = {
  id: number;
  original_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
};

export type AuditSnapshotData = {
  type?: TransactionType;
  transaction_datetime?: string | null;
  item_name?: string;
  quantity?: number;
  unit?: string;
  work_type_id?: number;
  work_type_name?: string | null;
  work_description?: string | null;
  origin?: string | null;
  destination?: string | null;
  sender_name?: string | null;
  recipient_name?: string | null;
  taker_name?: string | null;
  giver_name?: string | null;
  recorded_by?: number;
  deleted_at?: string | null;
  photos?: AuditSnapshotPhoto[];
};

export type AuditLogRecord = {
  id: number;
  transaction_id: number;
  user_id: number;
  action: AuditAction;
  action_label: string;
  description: string | null;
  ip_address: string | null;
  old_values: AuditSnapshotData | null;
  new_values: AuditSnapshotData | null;
  changed_fields: string[];
  user: {
    id: number;
    name: string;
    username: string;
    role: UserRole;
  } | null;
  transaction: {
    id: number;
    type: TransactionType;
    type_label: string;
    item_name: string;
    quantity: number;
    unit: string;
    transaction_datetime: string | null;
    is_deleted: boolean;
    deleted_at: string | null;
  } | null;
  created_at: string | null;
};

export type AuditLogListParams = {
  page?: number;
  per_page?: number;
  search?: string;
  action?: "" | AuditAction;
  user_id?: string | number;
  transaction_id?: string | number;
  date_from?: string;
  date_to?: string;
};

export type AuditLogListSummary = {
  total: number;
  update_count: number;
  delete_count: number;
};

export type AuditLogListResponse = {
  data: AuditLogRecord[];
  meta: PaginationMeta;
  summary: AuditLogListSummary;
  filter_options: {
    users: TransactionFilterOfficer[];
  };
};

export async function getAuditLogs(
  params: AuditLogListParams = {},
): Promise<AuditLogListResponse> {
  const query = buildQueryString(params);
  return api.get<AuditLogListResponse>(`/api/admin/audit-logs${query}`);
}

export async function getAuditLogDetail(
  auditLogId: number,
): Promise<{ audit_log: AuditLogRecord }> {
  return api.get<{ audit_log: AuditLogRecord }>(
    `/api/admin/audit-logs/${auditLogId}`,
  );
}
