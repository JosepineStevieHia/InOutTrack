<?php

namespace Database\Seeders;

use App\Models\WorkType;
use Illuminate\Database\Seeder;

class WorkTypeSeeder extends Seeder
{
    /**
     * Seed master data jenis pekerjaan di lingkungan perusahaan manufaktur (FR-013, Bagian 12).
     * Menggunakan updateOrCreate berdasarkan `name` agar idempoten.
     */
    public function run(): void
    {
        $workTypes = [
            [
                'name' => 'Produksi',
                'description' => 'Kebutuhan bahan baku, komponen, atau hasil produksi manufaktur.',
                'is_active' => true,
            ],
            [
                'name' => 'Maintenance & Perbaikan',
                'description' => 'Suku cadang, peralatan, atau pengiriman mesin untuk pemeliharaan dan servis.',
                'is_active' => true,
            ],
            [
                'name' => 'Logistik & Gudang',
                'description' => 'Penerimaan dan pengeluaran barang gudang, distribusi, atau pengiriman pelanggan/vendor.',
                'is_active' => true,
            ],
            [
                'name' => 'Proyek & Instalasi',
                'description' => 'Material dan peralatan untuk pekerjaan proyek, fabrikasi, atau instalasi fasilitas.',
                'is_active' => true,
            ],
            [
                'name' => 'Operasional & Umum (GA)',
                'description' => 'Kebutuhan operasional kantor, K3/safety, dan perlengkapan umum pabrik.',
                'is_active' => true,
            ],
            [
                'name' => 'Quality Control / Lab',
                'description' => 'Sampel pengujian, alat ukur, atau barang keperluan inspeksi mutu.',
                'is_active' => true,
            ],
        ];

        foreach ($workTypes as $workType) {
            WorkType::updateOrCreate(
                ['name' => $workType['name']],
                $workType
            );
        }
    }
}
