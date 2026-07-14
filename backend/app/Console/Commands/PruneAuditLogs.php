<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use Illuminate\Console\Command;

final class PruneAuditLogs extends Command
{
    protected $signature = 'audit:prune {--days= : Jumlah hari retensi audit log. Default dari AUDIT_RETENTION_DAYS atau 365 hari.}';

    protected $description = 'Hapus audit log yang melewati kebijakan retensi production.';

    public function handle(): int
    {
        $days = (int) ($this->option('days') ?: env('AUDIT_RETENTION_DAYS', 365));
        if ($days < 30) {
            $this->error('Retensi audit minimal 30 hari agar tidak menghapus jejak operasional terlalu agresif.');
            return self::FAILURE;
        }

        $deleted = AuditLog::query()
            ->where('created_at', '<', now()->subDays($days))
            ->delete();

        $this->info("Audit log lebih lama dari {$days} hari dihapus: {$deleted} baris.");

        return self::SUCCESS;
    }
}
