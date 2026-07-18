<?php

namespace Tests\Unit;

use App\Support\CsvWriter;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class CsvWriterTest extends TestCase
{
    #[DataProvider('formulaCells')]
    public function test_formula_triggering_cells_are_neutralised(string $input): void
    {
        self::assertSame("'".$input, CsvWriter::sanitize($input));
    }

    public static function formulaCells(): array
    {
        return [
            'equals' => ['=SUM(A1:A9)'],
            'plus non-numeric' => ['+cmd|calc'],
            'at' => ['@SUM(1)'],
            'minus with formula payload' => ['-1+1+cmd|\'/c calc\'!A1'],
            'leading space then equals' => [' =1+1'],
            'leading tab' => ["\t=1+1"],
        ];
    }

    #[DataProvider('numericCells')]
    public function test_valid_numbers_are_left_untouched(string $input): void
    {
        // Angka valid (termasuk negatif) tidak boleh berubah jadi teks — mis.
        // latitude -5.451 harus tetap numerik, bukan "'-5.451".
        self::assertSame($input, CsvWriter::sanitize($input));
    }

    public static function numericCells(): array
    {
        return [
            'negative latitude' => ['-5.451'],
            'negative small' => ['-0.12'],
            'positive decimal' => ['1.42'],
            'integer' => ['1000'],
            'scientific' => ['1e5'],
        ];
    }

    public function test_plain_text_is_unchanged(): void
    {
        self::assertSame('Kangkung', CsvWriter::sanitize('Kangkung'));
        self::assertSame('Kota Bandar Lampung', CsvWriter::sanitize('Kota Bandar Lampung'));
    }

    public function test_null_and_bool_are_normalised(): void
    {
        self::assertSame('', CsvWriter::sanitize(null));
        self::assertSame('1', CsvWriter::sanitize(true));
        self::assertSame('0', CsvWriter::sanitize(false));
        self::assertSame('', CsvWriter::sanitize(''));
    }
}
