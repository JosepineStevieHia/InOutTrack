<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Rate limiter untuk endpoint API umum & login (PRD Bagian 7)
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('login', function (Request $request) {
            $identifier = (string) ($request->input('login') ?? $request->input('username') ?? $request->input('email') ?? '');

            return Limit::perMinute(10)->by(Str::transliterate(Str::lower($identifier) . '|' . $request->ip()));
        });

        // Gate otorisasi berbasis role dan status aktif sesuai PRD (FR-002, FR-003, FR-010, FR-011, FR-012, FR-013)
        Gate::define('admin-only', fn (User $user): bool => $user->is_active && $user->isAdmin());
        Gate::define('manage-users', fn (User $user): bool => $user->is_active && $user->isAdmin());
        Gate::define('manage-work-types', fn (User $user): bool => $user->is_active && $user->isAdmin());
        Gate::define('manage-transactions', fn (User $user): bool => $user->canManageTransactions());
        Gate::define('export-transactions', fn (User $user): bool => $user->canExportTransactions());
        Gate::define('view-audit-logs', fn (User $user): bool => $user->is_active && $user->isAdmin());
        Gate::define('operational-access', fn (User $user): bool => $user->is_active && ($user->isAdmin() || $user->isPetugas()));
    }
}
