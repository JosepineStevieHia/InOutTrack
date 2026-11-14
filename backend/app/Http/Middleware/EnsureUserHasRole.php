<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Periksa apakah pengguna yang login memiliki salah satu dari role yang diizinkan.
     *
     * Contoh pemakaian:
     * - middleware('role:admin')
     * - middleware('role:admin,petugas')
     *
     * Sesuai PRD Bagian 6: Petugas yang mencoba mengakses endpoint khusus Admin
     * harus ditolak oleh backend dengan respons HTTP 403.
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Unauthenticated. Silakan login terlebih dahulu.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        if (! $user->is_active) {
            return response()->json([
                'message' => 'Akun Anda telah dinonaktifkan. Silakan hubungi Staf Administrasi (Admin).',
            ], Response::HTTP_FORBIDDEN);
        }

        // Normalisasi daftar role jika dikirim dengan koma (misal 'admin,petugas')
        $allowedRoles = [];
        foreach ($roles as $roleGroup) {
            foreach (explode(',', $roleGroup) as $role) {
                $trimmed = trim($role);
                if ($trimmed !== '') {
                    $allowedRoles[] = $trimmed;
                }
            }
        }

        if (! in_array($user->role, $allowedRoles, true)) {
            return response()->json([
                'message' => 'Akses ditolak. Anda tidak memiliki hak akses untuk fitur ini.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
