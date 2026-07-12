<?php

namespace App\Console\Commands;

use App\Services\BigCoastlineSyncService;
use Illuminate\Console\Command;
use Throwable;

final class SyncBigCoastlines extends Command
{
    protected $signature = 'data:sync-big-coastlines
        {--bbox=103.5,-6.2,106.3,-3.7 : xmin,ymin,xmax,ymax untuk Lampung}
        {--dry-run : Validasi tanpa menulis database}';
    protected $description = 'Sinkronkan garis pantai BIG skala 1:25.000 untuk bbox Lampung';

    public function handle(BigCoastlineSyncService $service): int
    {
        $bbox = array_map('floatval', explode(',', (string) $this->option('bbox')));
        try {
            $stats = $service->sync($bbox, (bool) $this->option('dry-run'), fn ($done, $total) => $this->output->write("\r{$done}/{$total}"));
        } catch (Throwable $exception) {
            $this->newLine(); $this->error($exception->getMessage()); return self::FAILURE;
        }
        $this->newLine(2);
        $this->table(['Metric', 'Value'], collect($stats)->map(fn ($value, $key) => [$key, $value])->values()->all());
        return self::SUCCESS;
    }
}
