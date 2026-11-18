<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan Riwayat Transaksi - InOutTrack</title>
    <style>
        @page {
            margin: 14mm 12mm;
        }
        body {
            font-family: Helvetica, Arial, sans-serif;
            font-size: 9px;
            color: #1e293b;
            margin: 0;
            padding: 0;
        }
        .header {
            border-bottom: 2px solid #1d4ed8;
            padding-bottom: 8px;
            margin-bottom: 10px;
        }
        .title {
            font-size: 14px;
            font-weight: bold;
            color: #0f172a;
            margin: 0 0 2px 0;
        }
        .subtitle {
            font-size: 9px;
            color: #475569;
            margin: 0;
        }
        .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            font-size: 8.5px;
        }
        .meta-table td {
            padding: 3px 6px;
            vertical-align: top;
        }
        .meta-label {
            font-weight: bold;
            color: #334155;
            width: 110px;
        }
        .summary-box {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        .summary-box td {
            border: 1px solid #cbd5e1;
            background-color: #f8fafc;
            padding: 6px 10px;
            width: 33.33%;
        }
        .summary-label {
            font-size: 8px;
            color: #475569;
            text-transform: uppercase;
            display: block;
        }
        .summary-value {
            font-size: 12px;
            font-weight: bold;
            color: #0f172a;
        }
        table.data-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        table.data-table thead th {
            background-color: #1e3a8a;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            padding: 6px 5px;
            border: 1px solid #1e3a8a;
            font-size: 8px;
            word-wrap: break-word;
        }
        table.data-table tbody td {
            padding: 5px;
            border: 1px solid #cbd5e1;
            vertical-align: top;
            font-size: 8px;
            word-wrap: break-word;
        }
        table.data-table tbody tr:nth-child(even) td {
            background-color: #f8fafc;
        }
        .badge-in {
            color: #065f46;
            font-weight: bold;
        }
        .badge-out {
            color: #92400e;
            font-weight: bold;
        }
        .text-right {
            text-align: right;
        }
        .text-center {
            text-align: center;
        }
        .footer {
            margin-top: 10px;
            font-size: 7.5px;
            color: #64748b;
            text-align: right;
        }
    </style>
</head>
<body>
    <div class="header">
        <p class="title">LAPORAN RIWAYAT TRANSAKSI BARANG MASUK &amp; KELUAR</p>
        <p class="subtitle">InOutTrack — Sistem Pemantauan Barang Masuk dan Keluar</p>
    </div>

    <table class="meta-table">
        <tr>
            <td class="meta-label">Periode Laporan</td>
            <td>: {{ $periodLabel }}</td>
            <td class="meta-label">Dicetak Oleh</td>
            <td>: {{ $printedBy }}</td>
        </tr>
        <tr>
            <td class="meta-label">Filter Aktif</td>
            <td>: {{ count($activeFilters) > 0 ? implode(' | ', $activeFilters) : 'Tidak ada filter tambahan (Semua Data)' }}</td>
            <td class="meta-label">Waktu Cetak</td>
            <td>: {{ $printedAt }}</td>
        </tr>
    </table>

    <table class="summary-box">
        <tr>
            <td>
                <span class="summary-label">Total Transaksi</span>
                <span class="summary-value">{{ number_format($summary['total'], 0, ',', '.') }}</span>
            </td>
            <td>
                <span class="summary-label">Total Barang Masuk</span>
                <span class="summary-value">{{ number_format($summary['masuk'], 0, ',', '.') }}</span>
            </td>
            <td>
                <span class="summary-label">Total Barang Keluar</span>
                <span class="summary-value">{{ number_format($summary['keluar'], 0, ',', '.') }}</span>
            </td>
        </tr>
    </table>

    <table class="data-table">
        <thead>
            <tr>
                <th style="width: 4%;" class="text-center">No</th>
                <th style="width: 8%;">Jenis</th>
                <th style="width: 11%;">Tanggal &amp; Waktu</th>
                <th style="width: 14%;">Nama Barang</th>
                <th style="width: 7%;" class="text-right">Jumlah</th>
                <th style="width: 6%;">Satuan</th>
                <th style="width: 11%;">Jenis Pekerjaan</th>
                <th style="width: 12%;">Asal / Tujuan</th>
                <th style="width: 10%;">Pengantar / Pengambil</th>
                <th style="width: 9%;">Petugas</th>
                <th style="width: 8%;">Deskripsi &amp; Foto</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($rows as $index => $row)
                <tr>
                    <td class="text-center">{{ $index + 1 }}</td>
                    <td>
                        @if ($row['is_inbound'])
                            <span class="badge-in">Barang Masuk</span>
                        @else
                            <span class="badge-out">Barang Keluar</span>
                        @endif
                    </td>
                    <td>{{ $row['datetime'] }}</td>
                    <td><strong>#{{ $row['id'] }}</strong> {{ $row['item_name'] }}</td>
                    <td class="text-right">{{ $row['quantity_formatted'] }}</td>
                    <td>{{ $row['unit'] }}</td>
                    <td>{{ $row['work_type'] }}</td>
                    <td>{{ $row['location'] }}</td>
                    <td>{{ $row['counterparty'] }}</td>
                    <td>{{ $row['officer'] }}</td>
                    <td>{{ $row['description'] ?: '-' }} ({{ $row['photos_count'] }} foto)</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="footer">
        Dokumen dihasilkan otomatis oleh InOutTrack • Jumlah baris diekspor: {{ count($rows) }}
    </div>
</body>
</html>
