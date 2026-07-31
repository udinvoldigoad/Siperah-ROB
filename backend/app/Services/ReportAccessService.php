<?php

namespace App\Services;

use App\Enums\ReportStatus;
use App\Enums\UserRole;
use App\Models\GroundTruthReport;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

final class ReportAccessService
{
    /**
     * Cakupan laporan ground truth yang boleh dibaca seorang pengguna.
     *
     * `peneliti` SENGAJA tidak diberi akses: laporan mentah memuat identitas
     * pelapor (nama & email lewat relasi `reporter`) dan koordinat presisi penuh
     * yang bisa menunjuk rumahnya. Jalur data untuk peneliti adalah portal riset
     * (`/research/datasets`), yang sudah membulatkan koordinat ke 3 desimal dan
     * tidak menyertakan identitas.
     *
     * Catatan sejarah: saat peran disederhanakan 5→3, cabang lama
     * `'bpbd_provinsi', 'admin'` sempat berubah jadi `'peneliti', 'admin'` —
     * menaikkan peneliti dari 403 menjadi akses penuh. Itu tidak disengaja.
     * `match` kini membedakan peran via `UserRole` sehingga peneliti maupun
     * peran tak dikenal selalu jatuh ke `default` → 403, dan peran baru yang
     * lupa ditangani akan melempar `UnhandledMatchError` alih-alih sunyi.
     */
    public function accessible(User $user): Builder
    {
        $query = GroundTruthReport::query();

        return match (UserRole::tryFrom($user->role)) {
            UserRole::Warga => $query->where('user_id', $user->id),
            UserRole::Admin => $query,
            default => abort(403, 'Role ini tidak memiliki akses ke laporan ground truth.'),
        };
    }

    public function authorizeView(User $user, GroundTruthReport $report): void
    {
        if ($user->role === UserRole::Admin->value) return;
        if ($user->role === UserRole::Warga->value) {
            abort_unless($report->user_id === $user->id, 403, 'Anda hanya dapat mengakses laporan sendiri.');
            return;
        }
        abort(403, 'Role ini tidak memiliki akses ke laporan ground truth.');
    }

    public function authorizeReview(User $user, GroundTruthReport $report): void
    {
        abort_unless($user->role === UserRole::Admin->value, 403);
        $this->authorizeView($user, $report);
        abort_unless(
            in_array($report->status, [ReportStatus::Menunggu->value, ReportStatus::PerluReview->value], true),
            409,
            'Hanya laporan menunggu atau perlu_review yang dapat diproses.',
        );
    }
}
