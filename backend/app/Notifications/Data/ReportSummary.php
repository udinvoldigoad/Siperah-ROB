<?php

namespace App\Notifications\Data;

use App\Models\GroundTruthReport;

/**
 * Cuplikan laporan yang dibawa notifikasi ke dalam antrean.
 *
 * Notifikasi laporan dulu membawa model Eloquent-nya langsung. Karena
 * notifikasi antre memakai SerializesModels, yang tersimpan di antrean hanyalah
 * ID; saat job dijalankan model itu dicari lagi, dan bila laporannya sudah
 * terhapus job GAGAL dengan ModelNotFoundException. Di produksi itu menumpuk
 * jadi 45 job gagal.
 *
 * `$deleteWhenMissingModels` TIDAK bisa dipakai di sini: properti itu dibaca
 * dari kelas job, dan job untuk notifikasi selalu
 * Illuminate\Notifications\SendQueuedNotifications - bukan kelas notifikasi
 * kita. Jadi memasangnya di kelas notifikasi tidak berpengaruh sama sekali.
 *
 * Objek biasa ini memutus rantainya: tak ada model yang perlu dicari ulang.
 * Efek sampingnya justru lebih benar - isi notifikasi menggambarkan keadaan
 * laporan SAAT kejadian, bukan keadaannya saat job kebetulan dijalankan.
 */
final readonly class ReportSummary
{
    public function __construct(
        public string $id,
        public string $code,
        public string $status,
        public ?string $rejectionReason = null,
        public ?string $location = null,
    ) {}

    public static function from(GroundTruthReport $report): self
    {
        $report->loadMissing('region');
        $region = $report->region;

        $location = trim(implode(', ', array_filter([
            $region?->village,
            $region?->district,
            $region?->regency,
        ])));

        return new self(
            id: (string) $report->id,
            code: (string) $report->report_code,
            status: (string) $report->status,
            rejectionReason: $report->rejection_reason,
            location: $location === '' ? null : $location,
        );
    }
}
