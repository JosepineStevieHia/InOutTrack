<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Seed akun awal sesuai dua persona di PRD (Bagian 3 & 8.6):
     * 1. Staf Administrasi (role: admin)
     * 2. Petugas Store & Petugas Security (role: petugas)
     *
     * Menggunakan updateOrCreate berdasarkan `username` agar idempoten.
     */
    public function run(): void
    {
        $users = [
            [
                'username' => 'admin',
                'name' => 'Staf Administrasi',
                'email' => 'admin@inouttrack.local',
                'password' => Hash::make('Admin12345!'),
                'role' => User::ROLE_ADMIN,
                'is_active' => true,
            ],
            [
                'username' => 'petugas.store',
                'name' => 'Petugas Store',
                'email' => 'store@inouttrack.local',
                'password' => Hash::make('Petugas12345!'),
                'role' => User::ROLE_PETUGAS,
                'is_active' => true,
            ],
            [
                'username' => 'petugas.security',
                'name' => 'Petugas Security',
                'email' => 'security@inouttrack.local',
                'password' => Hash::make('Petugas12345!'),
                'role' => User::ROLE_PETUGAS,
                'is_active' => true,
            ],
        ];

        foreach ($users as $userData) {
            User::updateOrCreate(
                ['username' => $userData['username']],
                $userData
            );
        }
    }
}
