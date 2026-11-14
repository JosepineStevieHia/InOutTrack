<?php

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
