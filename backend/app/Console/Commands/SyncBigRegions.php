<?php

namespace App\Console\Commands;

use App\Services\BigRegionSyncService;
use Illuminate\Console\Command;
use Throwable;

final class SyncBigRegions extends Command
{
    protected $signature = 'data:sync-big-regions
        {--province=Lampung : Nama provinsi sesuai atribut WADMPR BIG}
        {--dry-run : Ambil dan validasi seluruh data tanpa menulis database}';

    protected $description = 'Sinkronkan batas desa/kelurahan dari ArcGIS REST BIG';

    public function handle(BigRegionSyncService $service): int
    {
        $province = (string) $this->option('province');
        $this->info("Mengambil batas desa/kelurahan {$province} dari BIG...");

        try {
            $result = $service->sync(
                $province,
                (bool) $this->option('dry-run'),
                fn (int $fetched, int $total) => $this->output->write("\r{$fetched}/{$total}"),
            );
        } catch (Throwable $exception) {
            $this->newLine();
            $this->error($exception->getMessage());
            return self::FAILURE;
        }

        $this->newLine(2);
        $this->table(['Metric', 'Value'], [
            ['Reported by BIG', $result['reported']],
            ['Fetched', $result['fetched']],
            ['Valid', $result['valid']],
            ['Invalid', $result['invalid']],
            ['Inserted', $result['inserted']],
            ['Updated', $result['updated']],
            ['Mode', $this->option('dry-run') ? 'DRY RUN' : 'SYNCED'],
        ]);

        foreach ($result['errors'] as $error) {
            $this->warn($error);
        }

        return $result['invalid'] === 0 ? self::SUCCESS : self::FAILURE;
    }
}
