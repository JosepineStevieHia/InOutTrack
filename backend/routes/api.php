<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes (prefix otomatis: /api)
|--------------------------------------------------------------------------
*/

// Health check sederhana untuk menguji koneksi frontend -> backend.
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => config('app.name'),
        'time' => now()->toIso8601String(),
    ]);
});

/*
|--------------------------------------------------------------------------
| Autentikasi (FR-001, FR-002, Bagian 6 & 7)
|--------------------------------------------------------------------------
*/
Route::post('/auth/login', [AuthController::class, 'login'])->name('auth.login');
Route::post('/login', [AuthController::class, 'login']);

/*
|--------------------------------------------------------------------------
| Endpoint Terproteksi (Wajib Login & Akun Aktif)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    // Identifikasi pengguna yang sedang login & logout
    Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');
    Route::get('/user', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
    Route::post('/logout', [AuthController::class, 'logout']);

    /*
    |----------------------------------------------------------------------
    | Area Operasional (Admin & Petugas Store/Security)
    |----------------------------------------------------------------------
    */
    Route::prefix('operational')
        ->middleware('role:admin,petugas')
        ->group(function () {
            Route::get('/access-check', function (Request $request) {
                return response()->json([
                    'status' => 'ok',
                    'scope' => 'operational',
                    'message' => 'Akses operasional diizinkan.',
                    'role' => $request->user()->role,
                ]);
            })->name('operational.access-check');
        });

    /*
    |----------------------------------------------------------------------
    | Area Pengelolaan Sistem Khusus Admin (Staf Administrasi)
    | Petugas Store/Security ditolak dengan HTTP 403 (PRD Bagian 6)
    |----------------------------------------------------------------------
    */
    Route::prefix('admin')
        ->middleware('role:admin')
        ->group(function () {
            Route::get('/access-check', function (Request $request) {
                return response()->json([
                    'status' => 'ok',
                    'scope' => 'admin',
                    'message' => 'Akses pengelolaan sistem Admin diizinkan.',
                    'role' => $request->user()->role,
                ]);
            })->name('admin.access-check');
        });
});
