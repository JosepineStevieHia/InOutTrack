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
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  if (body !== undefined) headers["Content-Type"] = "application/json";

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
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
