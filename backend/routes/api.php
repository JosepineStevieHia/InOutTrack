<?php

use App\Http\Controllers\Api\Admin\AuditLogController;
use App\Http\Controllers\Api\Admin\TransactionExportController;
use App\Http\Controllers\Api\Admin\UserManagementController;
use App\Http\Controllers\Api\Admin\WorkTypeController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\TransactionPhotoController;
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

            // Tahap 9: Dashboard Ringkasan Transaksi (FR-009, Bagian 8.5)
            Route::get('/dashboard', [DashboardController::class, 'summary'])
                ->name('operational.dashboard.summary');

            // Tahap 7 & 8: Transaksi Barang Masuk, Barang Keluar, dan Riwayat Gabungan (FR-004, FR-005, FR-007, FR-008)
            Route::get('/work-types', [TransactionController::class, 'workTypes'])
                ->name('operational.work-types.index');
            Route::get('/transactions', [TransactionController::class, 'index'])
                ->name('operational.transactions.index');
            Route::get('/transactions/{transaction}', [TransactionController::class, 'show'])
                ->name('operational.transactions.show');
            Route::post('/transactions/in', [TransactionController::class, 'storeInbound'])
                ->name('operational.transactions.in.store');
            Route::post('/transactions/out', [TransactionController::class, 'storeOutbound'])
                ->name('operational.transactions.out.store');

            // Tahap 6: Photo Management (FR-006, Bagian 6, Bagian 12)
            Route::post('/transaction-photos/validate', [TransactionPhotoController::class, 'validateUpload'])
                ->name('operational.transaction-photos.validate');
            Route::get('/transactions/{transaction}/photos', [TransactionPhotoController::class, 'index'])
                ->name('operational.transactions.photos.index');
            Route::post('/transactions/{transaction}/photos', [TransactionPhotoController::class, 'store'])
                ->name('operational.transactions.photos.store');
            Route::post('/transaction-photos/{transactionPhoto}/replace', [TransactionPhotoController::class, 'replace'])
                ->name('operational.transaction-photos.replace');
            Route::delete('/transaction-photos/{transactionPhoto}', [TransactionPhotoController::class, 'destroy'])
                ->name('operational.transaction-photos.destroy');
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

            // Tahap 5: Manajemen Akun Pengguna (FR-003, Bagian 8.6)
            Route::get('/users', [UserManagementController::class, 'index'])->name('admin.users.index');
            Route::post('/users', [UserManagementController::class, 'store'])->name('admin.users.store');
            Route::get('/users/{user}', [UserManagementController::class, 'show'])->name('admin.users.show');
            Route::put('/users/{user}', [UserManagementController::class, 'update'])->name('admin.users.update');
            Route::patch('/users/{user}/status', [UserManagementController::class, 'updateStatus'])->name('admin.users.status');
            Route::delete('/users/{user}', [UserManagementController::class, 'destroy'])->name('admin.users.destroy');

            // Tahap 5: Manajemen Jenis Pekerjaan (FR-013)
            Route::get('/work-types', [WorkTypeController::class, 'index'])->name('admin.work-types.index');
            Route::post('/work-types', [WorkTypeController::class, 'store'])->name('admin.work-types.store');
            Route::get('/work-types/{workType}', [WorkTypeController::class, 'show'])->name('admin.work-types.show');
            Route::put('/work-types/{workType}', [WorkTypeController::class, 'update'])->name('admin.work-types.update');
            Route::patch('/work-types/{workType}/status', [WorkTypeController::class, 'updateStatus'])->name('admin.work-types.status');

            // Tahap 8 & 10: Ubah & Hapus Transaksi Khusus Admin dengan Audit Log (FR-011, FR-012)
            Route::put('/transactions/{transaction}', [TransactionController::class, 'update'])->name('admin.transactions.update');
            Route::post('/transactions/{transaction}', [TransactionController::class, 'update'])->name('admin.transactions.update.multipart');
            Route::delete('/transactions/{transaction}', [TransactionController::class, 'destroy'])->name('admin.transactions.destroy');

            // Tahap 9: Ekspor Laporan PDF & Excel Khusus Admin (FR-010, Bagian 8.5)
            Route::get('/transactions/export/pdf', [TransactionExportController::class, 'exportPdf'])->name('admin.transactions.export.pdf');
            Route::get('/transactions/export/excel', [TransactionExportController::class, 'exportExcel'])->name('admin.transactions.export.excel');

            // Tahap 10: Log Audit Transaksi Khusus Admin (Append-Only / Read-Only, FR-012)
            Route::get('/audit-logs', [AuditLogController::class, 'index'])->name('admin.audit-logs.index');
            Route::get('/audit-logs/{auditLog}', [AuditLogController::class, 'show'])->name('admin.audit-logs.show');
        });
});
