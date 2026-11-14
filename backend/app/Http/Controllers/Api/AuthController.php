<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

class AuthController extends Controller
{
    /**
     * Login pengguna menggunakan username atau email + password (FR-001, FR-002, Bagian 6 & 7).
     *
     * - Menerapkan pembatasan percobaan login (maks 5x gagal / 60 detik).
     * - Menolak akun nonaktif (is_active = false) dengan HTTP 403.
     * - Menggunakan session cookie Sanctum SPA dan me-regenerate session ID.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $throttleKey = $request->throttleKey();

        // 1. Cek apakah melebihi batas percobaan login (PRD Bagian 7)
        if (RateLimiter::tooManyAttempts($throttleKey, LoginRequest::MAX_ATTEMPTS)) {
            event(new Lockout($request));

            $seconds = RateLimiter::availableIn($throttleKey);

            return response()->json([
                'message' => "Terlalu banyak percobaan login. Silakan coba lagi dalam {$seconds} detik.",
                'retry_after' => $seconds,
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $identifier = (string) $request->validated('login');
        $password = (string) $request->validated('password');

        // 2. Cari akun berdasarkan username atau email (FR-001)
        $user = User::query()
            ->where('username', $identifier)
            ->orWhere('email', $identifier)
            ->first();

        // 3. Verifikasi keberadaan akun & kecocokan password
        if (! $user || ! Hash::check($password, $user->password)) {
            RateLimiter::hit($throttleKey, LoginRequest::DECAY_SECONDS);

            return response()->json([
                'message' => 'Username/email atau password yang Anda masukkan salah.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        // 4. Validasi status aktif akun (PRD Bagian 6: akun nonaktif tidak dapat login)
        if (! $user->is_active) {
            return response()->json([
                'message' => 'Akun Anda telah dinonaktifkan. Silakan hubungi Staf Administrasi (Admin).',
            ], Response::HTTP_FORBIDDEN);
        }

        // 5. Bersihkan rate limiter & mulai sesi autentikasi SPA
        RateLimiter::clear($throttleKey);

        Auth::guard('web')->login($user, $request->boolean('remember'));

        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return response()->json([
            'message' => 'Login berhasil.',
            'user' => (new UserResource($user))->resolve($request),
        ], Response::HTTP_OK);
    }

    /**
     * Identifikasi pengguna yang sedang login beserta role dan hak aksesnya.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'user' => (new UserResource($user))->resolve($request),
        ], Response::HTTP_OK);
    }

    /**
     * Logout pengguna dan akhiri sesi autentikasi (FR-001).
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        Auth::guard('web')->logout();

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        $token = $user && method_exists($user, 'currentAccessToken') ? $user->currentAccessToken() : null;
        if ($token && method_exists($token, 'delete')) {
            $token->delete();
        }

        return response()->json([
            'message' => 'Logout berhasil.',
        ], Response::HTTP_OK);
    }
}
