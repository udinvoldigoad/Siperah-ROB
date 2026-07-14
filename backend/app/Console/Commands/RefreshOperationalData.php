<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

final class RefreshOperationalData extends Command
{
    protected $signature = 'data:refresh-operational
        {--province=Lampung : Provinsi yang diaudit}
        {--sync-big : Sinkronkan wilayah BIG sebelum audit}
        {--sync-coastline : Sinkronkan coastline BIG sebelum klasifikasi pesisir}
        {--tidal-csv= : Path CSV pasang surut untuk diimpor}
        {--station-code= : Kode stasiun untuk impor pasang surut}
        {--station-name= : Nama stasiun untuk impor pasang surut}
        {--source=BMKG : Sumber data pasang surut}
        {--dry-run : Jalankan validasi tanpa menulis untuk importer/sync eksternal}';

    protected $description = 'Refresh data operasional harian: wilayah, coastline, pasang surut, klasifikasi pesisir, dan audit kualitas data';

    public function handle(): int
    {
        $province = (string) $this->option('province');
        $dryRun = (bool) $this->option('dry-run');

        if ($this->option('sync-big')) {
            $this->section('Sinkronisasi wilayah BIG');
            $code = Artisan::call('data:sync-big-regions', [
                '--province' => $province,
                '--dry-run' => $dryRun,
            ], $this->output);
            if ($code !== self::SUCCESS) {
                return $code;
            }
        }

        if ($this->option('sync-coastline')) {
            $this->section('Sinkronisasi coastline BIG');
            $code = Artisan::call('data:sync-big-coastlines', [
                '--dry-run' => $dryRun,
            ], $this->output);
            if ($code !== self::SUCCESS) {
                return $code;
            }

            if (!$dryRun) {
                Artisan::call('data:classify-coastal-regions', [], $this->output);
            }
        }

        if ($this->option('tidal-csv')) {
            foreach (['station-code', 'station-name'] as $required) {
                if (!$this->option($required)) {
                    $this->error("Option --{$required} wajib diisi saat --tidal-csv digunakan.");
                    return self::FAILURE;
                }
            }

            $this->section('Impor data pasang surut');
            $code = Artisan::call('data:import-tidal', [
                'file' => $this->option('tidal-csv'),
                '--station-code' => $this->option('station-code'),
                '--station-name' => $this->option('station-name'),
                '--source' => $this->option('source'),
                '--dry-run' => $dryRun,
            ], $this->output);
            if ($code !== self::SUCCESS) {
                return $code;
            }
        }

        $this->section('Audit kualitas wilayah');
        return Artisan::call('data:audit-regions', [
            '--province' => $province,
        ], $this->output);
    }
}
