<?php

namespace App\Enums;

/**
 * Kelas risiko rob, dipetakan ke enum Postgres `risk_class`
 * (`rendah`, `sedang`, `tinggi`, `sangat_tinggi`).
 *
 * Dipakai di titik yang menentukan apa yang dilihat publik (filter wilayah
 * kritis di peta) dan siapa yang menerima peringatan push — keputusan
 * perilaku yang tak boleh berubah diam-diam karena salah ketik literal.
 */
enum RiskClass: string
{
    case Rendah = 'rendah';
    case Sedang = 'sedang';
    case Tinggi = 'tinggi';
    case SangatTinggi = 'sangat_tinggi';
}
