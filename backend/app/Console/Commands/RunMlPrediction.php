<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Process;

class RunMlPrediction extends Command
{
    protected $signature = 'ml:predict {--simulate : Gunakan data cuaca simulasi offline}';
    protected $description = 'Menjalankan pipeline Machine Learning (Python) untuk menghasilkan prediksi rob 30 hari ke depan';

    public function handle(): int
    {
        $this->info('Memulai pipeline ML...');
        $baseDir = base_path('../ml-api');
        
        $command = ['python', 'main.py', '--mode', 'predict'];
        if ($this->option('simulate')) {
            $command[] = '--simulate';
        }

        $result = Process::path($baseDir)->run($command, function (string $type, string $output) {
            if ($type === 'err') {
                $this->error(trim($output));
            } else {
                $this->line(trim($output));
            }
        });

        if ($result->successful()) {
            $this->info('Pipeline ML berhasil dijalankan. Prediksi telah disimpan di database.');
            return Command::SUCCESS;
        }

        $this->error('Terjadi kesalahan saat menjalankan pipeline ML.');
        return Command::FAILURE;
    }
}
