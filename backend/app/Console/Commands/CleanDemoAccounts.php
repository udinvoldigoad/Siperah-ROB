<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Hapus akun demo (operator@, provinsi@) dari produksi.
 *
 * Aman dijalankan kapan saja: audit_logs.actor_user_id di-null-kan lebih
 * dulu, lalu cascade FK menghapus notification_settings & api_keys.
 *
 * Contoh: php artisan accounting:clean-demo --dry-run
 *         php artisan accounting:clean-demo
 */
class CleanDemoAccounts extends Command
{
    protected $signature = 'accounting:clean-demo {--dry-run : Hitung tanpa menghapus}';

    protected $description = 'Hapus akun demo (operator@, provinsi@) beserta data terkait';

    public function handle(): int
    {
        $emails = ['operator@saibar.local', 'provinsi@saibar.local'];
        $users = User::whereIn('email', $emails)->get();

        if ($users->isEmpty()) {
            $this->info('Tidak ada akun demo ditemukan.');

            return self::SUCCESS;
        }

        $this->warn('Akun demo ditemukan:');
        foreach ($users as $user) {
            $lastLogin = $user->last_login_at?->toDateTimeString() ?? 'tidak pernah';
            $this->line("  {$user->email} ({$user->name}) â€” login terakhir: {$lastLogin}");
        }

        if ($this->option('dry-run')) {
            $this->line('Mode dry-run: tidak ada yang dihapus.');

            return self::SUCCESS;
        }

        if (!$this->confirm('Hapus permanen akun-akun ini? Data tidak bisa dikembalikan.')) {
            $this->info('Dibatalkan.');

            return self::SUCCESS;
        }

        foreach ($users as $user) {
            DB::transaction(function () use ($user): void {
                DB::table('audit_logs')
                    ->where('actor_user_id', $user->id)
                    ->update(['actor_user_id' => null]);

                $user->forceDelete();
            });

            $this->info("{$user->email} berhasil dihapus.");
        }

        $this->info('Selesai.');

        return self::SUCCESS;
    }
}

