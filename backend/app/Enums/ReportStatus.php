<?php

namespace App\Enums;

/**
 * Status laporan ground truth, dipetakan ke enum Postgres `report_status`
 * (`menunggu`, `divalidasi`, `ditolak`, `duplikat`, `perlu_review`).
 *
 * Dipakai pada transisi status (hanya `menunggu`/`perlu_review` yang boleh
 * diproses) dan filter laporan terbuka — keputusan yang menentukan hak admin
 * memvalidasi dan apa yang tampil di antrean/peta publik.
 */
enum ReportStatus: string
{
    case Menunggu = 'menunggu';
    case Divalidasi = 'divalidasi';
    case Ditolak = 'ditolak';
    case Duplikat = 'duplikat';
    case PerluReview = 'perlu_review';

    /**
     * Status yang menutup laporan dengan keputusan manusia dan harus
     * meninggalkan jejak siapa & kapan memutuskannya.
     */
    public function isDecision(): bool
    {
        return in_array($this, [self::Divalidasi, self::Ditolak, self::Duplikat], true);
    }
}
