<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

final class FetchBmkgWarnings extends Command
{
    protected $signature = 'data:fetch-bmkg-warnings
        {--hours-ahead=36 : Jendela prakiraan yang dipindai untuk cuaca berbahaya}
        {--per-regency=2 : Jumlah desa pesisir yang diperiksa per kabupaten}
        {--dry-run : Tampilkan hasil tanpa menulis}';

    protected $description = 'Ambil prakiraan cuaca BMKG untuk desa pesisir & catat peringatan cuaca berbahaya (banner peta publik)';

    private const BMKG_URL = 'https://api.bmkg.go.id/publik/prakiraan-cuaca';

    /**
     * Kode cuaca BMKG yang dianggap peringatan, dipetakan ke severity.
     * 95/97 = hujan petir, 65 = hujan lebat, 63 = hujan sedang, 80 = hujan lokal.
     */
    private const WARNING_CODES = [
        97 => 'tinggi', 95 => 'tinggi', 65 => 'tinggi',
        63 => 'sedang', 80 => 'sedang',
    ];

    public function handle(): int
    {
        $hoursAhead = max(6, (int) $this->option('hours-ahead'));
        $perRegency = max(1, (int) $this->option('per-regency'));
        $dryRun = (bool) $this->option('dry-run');
        $cutoff = now()->addHours($hoursAhead);

        // Satu desa acuan per kabupaten (region_code = adm4 Kemendagri, dikenali BMKG).
        $samples = DB::table('regions')
            ->where('coastal_flag', true)
            ->where('provenance_status', 'official')
            ->whereNotNull('region_code')
            ->orderBy('regency')->orderBy('region_code')
            ->get(['regency', 'region_code', 'district', 'village']);

        $byRegency = $samples->groupBy('regency')->map->take($perRegency);
        $warnings = [];

        foreach ($byRegency as $regency => $villages) {
            $worst = null;
            foreach ($villages as $v) {
                $forecast = $this->fetchForecast($v->region_code);
                foreach ($forecast as $point) {
                    $code = (int) ($point['weather'] ?? -1);
                    $at = isset($point['utc_datetime']) ? \Carbon\CarbonImmutable::parse($point['utc_datetime'], 'UTC') : null;
                    if (!isset(self::WARNING_CODES[$code]) || $at === null || $at->gt($cutoff) || $at->lt(now()->subHours(1))) {
                        continue;
                    }
                    $sev = self::WARNING_CODES[$code];
                    // Ambil yang paling parah lalu paling awal per kabupaten.
                    if ($worst === null || $this->severityRank($sev) > $this->severityRank($worst['severity'])
                        || ($this->severityRank($sev) === $this->severityRank($worst['severity']) && $at->lt($worst['valid_from']))) {
                        $worst = [
                            'regency' => $regency,
                            'adm4_code' => $v->region_code,
                            'area_label' => trim(($v->village ? $v->village.', ' : '').$v->district),
                            'weather_code' => $code,
                            'weather_desc' => (string) ($point['weather_desc'] ?? ''),
                            'severity' => $sev,
                            'valid_from' => $at,
                        ];
                    }
                }
            }
            if ($worst !== null) {
                $warnings[] = $worst;
            }
        }

        $this->table(
            ['Kabupaten', 'Area acuan', 'Cuaca', 'Severity', 'Mulai (WIB)'],
            array_map(fn ($w) => [
                $w['regency'], $w['area_label'], $w['weather_desc'], $w['severity'],
                $w['valid_from']->timezone('Asia/Jakarta')->format('d M H:i'),
            ], $warnings),
        );

        if ($dryRun) {
            $this->info(count($warnings).' peringatan (dry-run, tidak ditulis).');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($warnings, $cutoff): void {
            DB::table('weather_warnings')->delete(); // banner selalu mencerminkan fetch terbaru
            foreach ($warnings as $w) {
                DB::table('weather_warnings')->insert([
                    'id' => (string) Str::uuid(),
                    'regency' => $w['regency'],
                    'adm4_code' => $w['adm4_code'],
                    'area_label' => $w['area_label'],
                    'weather_code' => $w['weather_code'],
                    'weather_desc' => $w['weather_desc'],
                    'severity' => $w['severity'],
                    'valid_from' => $w['valid_from'],
                    'valid_until' => $cutoff,
                    'source' => 'BMKG',
                    'source_url' => self::BMKG_URL,
                    'fetched_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        $this->info(count($warnings).' peringatan cuaca BMKG disimpan.');

        return self::SUCCESS;
    }

    /** @return list<array<string, mixed>> */
    private function fetchForecast(string $adm4): array
    {
        try {
            $data = Http::retry(2, 1500)->timeout(30)->get(self::BMKG_URL, ['adm4' => $adm4])->throw()->json();
        } catch (\Throwable $e) {
            $this->warn("BMKG gagal untuk {$adm4}: ".$e->getMessage());

            return [];
        }

        // Struktur: data[0].cuaca = array grup, tiap grup array titik prakiraan.
        $points = [];
        foreach ($data['data'][0]['cuaca'] ?? [] as $group) {
            foreach ($group as $point) {
                $points[] = $point;
            }
        }

        return $points;
    }

    private function severityRank(string $severity): int
    {
        return $severity === 'tinggi' ? 2 : 1;
    }
}
