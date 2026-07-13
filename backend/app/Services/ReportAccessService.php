<?php

namespace App\Services;

use App\Models\GroundTruthReport;
use App\Models\Region;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

final class ReportAccessService
{
    public function accessible(User $user): Builder
    {
        $query = GroundTruthReport::query();

        return match ($user->role) {
            'warga' => $query->where('user_id', $user->id),
            'bpbd_operator' => $query->whereHas('region', function (Builder $q) use ($user) {
                $regency = $this->operatorRegency($user);
                $q->whereRaw(
                    "REGEXP_REPLACE(LOWER(TRIM(regency)), '^(kabupaten|kota)\\s+', '') = ?",
                    [$regency],
                );
            }),
            'bpbd_provinsi', 'admin' => $query,
            default => abort(403, 'Role ini tidak memiliki akses ke laporan ground truth.'),
        };
    }

    public function authorizeView(User $user, GroundTruthReport $report): void
    {
        if (in_array($user->role, ['bpbd_provinsi', 'admin'], true)) return;
        if ($user->role === 'warga') {
            abort_unless($report->user_id === $user->id, 403, 'Anda hanya dapat mengakses laporan sendiri.');
            return;
        }
        if ($user->role === 'bpbd_operator') {
            $report->loadMissing('region');
            abort_unless(
                $this->normalizeRegency((string) $report->region?->regency) === $this->operatorRegency($user),
                403,
                'Laporan berada di luar wilayah kerja Anda.',
            );
            return;
        }
        abort(403, 'Role ini tidak memiliki akses ke laporan ground truth.');
    }

    public function authorizeReview(User $user, GroundTruthReport $report): void
    {
        abort_unless(in_array($user->role, ['bpbd_operator', 'bpbd_provinsi', 'admin'], true), 403);
        $this->authorizeView($user, $report);
        abort_unless(
            in_array($report->status, ['menunggu', 'perlu_review'], true),
            409,
            'Hanya laporan menunggu atau perlu_review yang dapat diproses.',
        );
    }

    private function operatorRegency(User $user): string
    {
        abort_unless($user->region_id, 403, 'Akun operator belum memiliki wilayah kerja.');
        $regency = Region::whereKey($user->region_id)->value('regency');
        abort_unless($regency, 403, 'Wilayah kerja operator tidak valid.');
        return $this->normalizeRegency($regency);
    }

    private function normalizeRegency(string $regency): string
    {
        return preg_replace('/^(kabupaten|kota)\s+/i', '', mb_strtolower(trim($regency))) ?? '';
    }
}
