<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * Satu-satunya sumber kebenaran zona waktu operasional (WIB).
 *
 * `app.timezone` SENGAJA dibiarkan UTC dan tidak boleh diubah: kolom waktu di
 * Postgres bertipe `timestamptz`, sedangkan Laravel menulis Carbon sebagai
 * string tanpa offset yang lalu ditafsirkan sesi DB (`config/database.php`
 * pgsql.timezone = UTC). Mengubah `app.timezone` ke Asia/Jakarta akan
 * menggeser SEMUA penulisan baru 7 jam sementara baris lama tetap UTC —
 * kerusakan data diam-diam.
 *
 * Karena itu: penyimpanan tetap UTC, dan setiap batas **hari kalender**
 * di-anchor eksplisit ke WIB lewat kelas ini. Tanpa itu pukul 00:00–07:00 WIB
 * masih terhitung "kemarin" — persis jam rawan rob subuh, mencakup pipeline ML
 * 06:00 dan notifikasi risiko tinggi 06:30 WIB.
 */
final class AppTime
{
    /** Zona waktu operasional sistem (Lampung = WIB). */
    public const TZ = 'Asia/Jakarta';

    /** Sekarang, direpresentasikan dalam WIB. */
    public static function now(): CarbonImmutable
    {
        return CarbonImmutable::now(self::TZ);
    }

    /** Tengah malam WIB hari ini. */
    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::today(self::TZ);
    }

    /** Tanggal kalender hari ini menurut WIB, mis. "2026-07-28". */
    public static function todayString(): string
    {
        return self::today()->toDateString();
    }

    /**
     * Awal hari WIB, dikembalikan dalam UTC agar bisa langsung dibandingkan
     * dengan kolom `timestamptz` yang sesi DB-nya UTC.
     */
    public static function startOfDayUtc(?string $date = null): CarbonImmutable
    {
        return self::parseInWib($date)->startOfDay()->utc();
    }

    /** Akhir hari WIB (23:59:59.999999), dikembalikan dalam UTC. */
    public static function endOfDayUtc(?string $date = null): CarbonImmutable
    {
        return self::parseInWib($date)->endOfDay()->utc();
    }

    /**
     * Awal bulan WIB dalam UTC. Menerima "Y-m" (mis. "2026-07") maupun tanggal
     * penuh; null berarti bulan berjalan.
     */
    public static function startOfMonthUtc(?string $yearMonth = null): CarbonImmutable
    {
        return self::parseInWib($yearMonth)->startOfMonth()->utc();
    }

    /** Akhir bulan WIB dalam UTC. */
    public static function endOfMonthUtc(?string $yearMonth = null): CarbonImmutable
    {
        return self::parseInWib($yearMonth)->endOfMonth()->utc();
    }

    /**
     * Tanggal kalender awal/akhir bulan, mis. "2026-07-01"/"2026-07-31".
     *
     * Untuk kolom bertipe `date` (mis. `predictions.prediction_date`) — JANGAN
     * pakai varian *Utc lalu `toDateString()`: tengah malam WIB tanggal 1
     * adalah pukul 17:00 UTC tanggal SEBELUMNYA, jadi tanggalnya meleset satu
     * hari.
     */
    public static function monthStartDate(?string $yearMonth = null): string
    {
        return self::parseInWib($yearMonth)->startOfMonth()->toDateString();
    }

    /** @see monthStartDate() */
    public static function monthEndDate(?string $yearMonth = null): string
    {
        return self::parseInWib($yearMonth)->endOfMonth()->toDateString();
    }

    /**
     * Ekspresi SQL untuk mengelompokkan kolom `timestamptz` per hari KALENDER
     * WIB. `CAST(kolom AS date)` polos memakai zona sesi (UTC), sehingga
     * aktivitas 00:00–07:00 WIB jatuh ke ember hari sebelumnya.
     */
    public static function sqlDateInWib(string $column): string
    {
        return "CAST({$column} AT TIME ZONE '".self::TZ."' AS date)";
    }

    private static function parseInWib(?string $value): CarbonImmutable
    {
        if ($value === null || $value === '') {
            return self::now();
        }

        // "2026-07" tidak dikenali Carbon::parse sebagai bulan; lengkapi harinya.
        if (preg_match('/^\d{4}-\d{2}$/', $value) === 1) {
            $value .= '-01';
        }

        return CarbonImmutable::parse($value, self::TZ);
    }
}
