<?php

namespace App\Console\Commands;

use App\Services\TidalCsvImporter;
use Illuminate\Console\Command;
use InvalidArgumentException;

final class ImportTidalCsv extends Command
{
    protected $signature = 'data:import-tidal
        {file : Path CSV}
        {--format=chart : chart atau extremes}
        {--station-code= : Kode stasiun wajib}
        {--station-name= : Nama stasiun wajib}
        {--source= : Nama sumber data wajib}
        {--timezone=Asia/Jakarta : Zona waktu CSV}
        {--datum=MSL : Datum chart: EST, MSL, atau LAT}
        {--latitude= : Latitude stasiun}
        {--longitude= : Longitude stasiun}
        {--coverage-km= : Radius representatif stasiun dalam km}
        {--source-url= : URL sumber asli}
        {--provenance=unverified : official, unverified, atau demo}
        {--dry-run : Validasi tanpa menulis database}';

    protected $description = 'Validasi dan impor CSV pasang-surut secara idempotent';

    public function handle(TidalCsvImporter $importer): int
    {
        foreach (['station-code', 'station-name', 'source'] as $option) {
            if (!$this->option($option)) {
                $this->error("Option --{$option} wajib diisi agar data tidak salah label.");
                return self::FAILURE;
            }
        }

        try {
            $result = $importer->import(
                path: $this->argument('file'),
                format: $this->option('format'),
                stationCode: $this->option('station-code'),
                stationName: $this->option('station-name'),
                source: $this->option('source'),
                timezone: $this->option('timezone'),
                datum: strtoupper($this->option('datum')),
                dryRun: (bool) $this->option('dry-run'),
                latitude: $this->nullableFloat('latitude'),
                longitude: $this->nullableFloat('longitude'),
                coverageRadiusKm: $this->nullableFloat('coverage-km'),
                sourceUrl: $this->option('source-url'),
                provenanceStatus: $this->option('provenance'),
            );
        } catch (InvalidArgumentException $exception) {
            $this->error($exception->getMessage());
            return self::FAILURE;
        }

        $this->table(['Metric', 'Value'], [
            ['Rows', $result['rows']],
            ['First (UTC)', $result['first_at']],
            ['Last (UTC)', $result['last_at']],
            ['Minimum (m)', $result['minimum']],
            ['Maximum (m)', $result['maximum']],
            ['Mode', $this->option('dry-run') ? 'DRY RUN' : 'IMPORTED'],
        ]);

        return self::SUCCESS;
    }

    private function nullableFloat(string $option): ?float
    {
        $value = $this->option($option);
        return $value === null || $value === '' ? null : (float) $value;
    }
}
