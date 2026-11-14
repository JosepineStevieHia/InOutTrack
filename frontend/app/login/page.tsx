"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/FormField";
import {
  BrandLogoIcon,
  EyeIcon,
  EyeOffIcon,
  LockShieldIcon,
} from "@/components/ui/Icons";
import { PageLoading } from "@/components/ui/LoadingState";
import { useToast } from "@/components/ui/ToastProvider";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isAuthenticated, isLoading: authLoading } = useAuth();
  const toast = useToast();

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    login?: string;
    password?: string;
  }>({});

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <PageLoading
          message={
            isAuthenticated
              ? "Mengalihkan ke Dashboard..."
              : "Memeriksa sesi login..."
          }
        />
      </main>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const trimmedLogin = loginIdentifier.trim();
    const nextFieldErrors: { login?: string; password?: string } = {};

    if (!trimmedLogin) {
      nextFieldErrors.login = "Username atau email wajib diisi.";
    }
    if (!password) {
      nextFieldErrors.password = "Password wajib diisi.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await signIn({
        login: trimmedLogin,
        password,
        remember,
      });
      toast.success(
        `Selamat datang, ${user.name}`,
        `Masuk sebagai ${user.role_label}.`,
      );
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errors) {
          setFieldErrors({
            login: err.errors.login?.[0],
            password: err.errors.password?.[0],
          });
        }
        if (err.isTooManyRequests && err.retryAfter) {
          setFormError(
            `Terlalu banyak percobaan login. Silakan tunggu ${err.retryAfter} detik sebelum mencoba kembali.`,
          );
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError(
          "Terjadi kesalahan yang tidak terduga. Silakan coba lagi.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <BrandLogoIcon className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            Masuk ke InOutTrack
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Sistem Pemantauan Barang Masuk &amp; Keluar Perusahaan Manufaktur
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {formError && (
            <Alert variant="error" title="Login Gagal" className="mb-5">
              {formError}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <TextInput
              name="login"
              label="Username atau Email"
              type="text"
              autoComplete="username"
              placeholder="Contoh: admin atau petugas.store"
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              error={fieldErrors.login}
              disabled={isSubmitting}
              required
            />

            <TextInput
              name="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Masukkan password akun Anda"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              disabled={isSubmitting}
              required
              rightAdornment={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Lihat password"
                  }
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-4.5 w-4.5" />
                  ) : (
                    <EyeIcon className="h-4.5 w-4.5" />
                  )}
                </button>
              }
            />

            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={isSubmitting}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span>Ingat sesi saya</span>
              </label>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting}
                loadingText="Memverifikasi..."
              >
                Masuk
              </Button>
            </div>
          </form>

          <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-500 ring-1 ring-slate-200/70">
            <LockShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="leading-relaxed">
              Autentikasi dilindungi sesi cookie aman dan pembatasan percobaan
              login. Hubungi <span className="font-medium text-slate-700">Staf Administrasi</span> jika akun Anda dinonaktifkan atau lupa kata sandi.
            </p>
          </div>
        </section>

        <p className="text-center text-xs text-slate-400">
          InOutTrack • Fondasi Operasional Gudang &amp; Security
        </p>
      </div>
    </main>
  );
}
