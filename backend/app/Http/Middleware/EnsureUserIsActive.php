<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    /**
     * Pastikan akun pengguna yang sedang login masih berstatus aktif (is_active = true).
     * Jika akun dinonaktifkan oleh Admin di tengah sesi, akhiri sesi dan tolak dengan 403.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Unauthenticated. Silakan login terlebih dahulu.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (! $user->is_active) {
            Auth::guard('web')->logout();

            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            $token = method_exists($user, 'currentAccessToken') ? $user->currentAccessToken() : null;
            if ($token && method_exists($token, 'delete')) {
                $token->delete();
            }

            return response()->json([
                'message' => 'Akun Anda telah dinonaktifkan. Silakan hubungi Staf Administrasi (Admin).',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
