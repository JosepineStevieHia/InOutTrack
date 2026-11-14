<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Tabel gabungan transaksi barang MASUK dan KELUAR (FR-004 s.d. FR-011, Bagian 6, 8, 12).
     * - Untuk MASUK: `origin`, `sender_name`, dan `recipient_name` relevan.
     * - Untuk KELUAR: `destination`, `taker_name`, dan `giver_name` relevan.
     * - `recorded_by` menyimpan FK ke `users` (petugas penerima/pemberi otomatis dari akun login).
     * - Penghapusan menggunakan soft delete (`deleted_at`) agar jejak audit tetap utuh.
     */
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['MASUK', 'KELUAR']);
            $table->dateTime('transaction_datetime');
            $table->string('item_name', 255);
            $table->decimal('quantity', 12, 2);
            $table->string('unit', 50);

            $table->foreignId('work_type_id')
                ->constrained('work_types')
                ->restrictOnDelete();
            $table->string('work_description', 500)->nullable();

            // Kolom spesifik arah transaksi (nullable sesuai arah MASUK / KELUAR)
            $table->string('origin', 255)->nullable();
            $table->string('destination', 255)->nullable();
            $table->string('sender_name', 150)->nullable();
            $table->string('recipient_name', 150)->nullable();
            $table->string('taker_name', 150)->nullable();
            $table->string('giver_name', 150)->nullable();

            // Keterkaitan dengan akun pengguna (RESTRICT agar histori transaksi tetap terjaga)
            $table->foreignId('recorded_by')
                ->constrained('users')
                ->restrictOnDelete();
            $table->foreignId('created_by')
                ->constrained('users')
                ->restrictOnDelete();
            $table->foreignId('updated_by')
                ->nullable()
                ->constrained('users')
                ->restrictOnDelete();

            $table->softDeletes();
            $table->timestamps();

            // Index untuk mendukung filter, pencarian riwayat, dan ringkasan dashboard
            $table->index(['type', 'transaction_datetime'], 'idx_transactions_type_datetime');
            $table->index('transaction_datetime', 'idx_transactions_datetime');
            $table->index('item_name', 'idx_transactions_item_name');
            $table->index('deleted_at', 'idx_transactions_deleted_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
