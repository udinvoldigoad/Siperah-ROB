<?php

namespace App\Support;

/**
 * Penulisan CSV yang aman dari formula/CSV injection.
 *
 * Sel yang diawali =, +, -, @, tab, atau carriage return dapat dieksekusi
 * sebagai formula oleh Excel/Sheets/LibreOffice. Kita netralkan dengan
 * menambahkan tanda kutip tunggal di depan sel berisiko.
 *
 * Referensi: OWASP "CSV Injection".
 */
final class CsvWriter
{
    /**
     * Tulis satu baris CSV ke stream dengan seluruh sel dinetralkan.
     *
     * @param resource $handle
     * @param array<int, mixed> $row
     */
    public static function putRow($handle, array $row): void
    {
        fputcsv($handle, array_map(self::sanitize(...), $row), ';', '"', '');
    }

    /**
     * Netralkan satu nilai sel dari kemungkinan formula injection.
     */
    public static function sanitize(mixed $value): string
    {
        if ($value === null || is_bool($value)) {
            return $value === null ? '' : ($value ? '1' : '0');
        }

        $string = (string) $value;
        if ($string === '') {
            return '';
        }

        // Angka valid (termasuk negatif, desimal, eksponen) bukan formula —
        // jangan diprefiks agar nilai seperti latitude -5.451 atau tinggi pasang
        // -0.12 tetap numerik dan tidak berubah jadi teks "'-5.451".
        if (is_numeric($string)) {
            return $string;
        }

        // Karakter pemicu formula di awal sel (termasuk setelah spasi/tab/CR).
        if (preg_match('/^[\s]*[=+\-@\t\r]/', $string)) {
            return "'".$string;
        }

        return $string;
    }
}
