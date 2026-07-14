<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

final class RunMlPredictions extends Command
{
    protected $signature = 'ml:predict
        {--mode=predict : Mode pipeline (fetch|train|predict)}
        {--simulate : Pakai data simulasi (offline/demo)}
        {--timeout=900 : Batas waktu eksekusi dalam detik}';

    protected $description = 'Jalankan pipeline ML prediksi banjir rob (ml-api) dan tulis hasil ke tabel predictions';

    public function handle(): int
    {
        $mlApiPath = config('services.ml_api.path') ?: base_path('../ml-api');
        $python = config('services.ml_api.python') ?: $mlApiPath.DIRECTORY_SEPARATOR.'.venv'
            .DIRECTORY_SEPARATOR.'Scripts'.DIRECTORY_SEPARATOR.'python.exe';

        if (!is_file($python)) {
            $python = 'python'; // fallback ke python di PATH
        }

        $command = [$python, 'main.py', '--mode', (string) $this->option('mode')];
        if ($this->option('simulate')) {
            $command[] = '--simulate';
        }

        $this->info('Menjalankan: '.implode(' ', $command)." (cwd: {$mlApiPath})");

        $process = new Process($command, $mlApiPath, null, null, (float) $this->option('timeout'));
        $process->run(function (string $type, string $buffer): void {
            $this->output->write($buffer);
        });

        if (!$process->isSuccessful()) {
            $this->error('Pipeline ML gagal dengan exit code '.$process->getExitCode());
            return self::FAILURE;
        }

        $this->info('Pipeline ML selesai.');
        return self::SUCCESS;
    }
}
