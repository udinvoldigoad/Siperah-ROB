<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationSetting extends Model
{
    protected $table = 'notification_settings';

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    /**
     * Default langganan untuk akun yang BELUM pernah menyentuh halaman
     * pengaturan notifikasi — dan karena itu belum punya baris di sini.
     *
     * Nilainya dipakai di dua tempat yang dulu berbeda diam-diam:
     * `NotificationService::settings()` saat membuat baris, dan
     * `RoutesViaPreferredChannels::via()` saat barisnya belum ada. Yang kedua
     * dulu jatuh ke inbox saja, sehingga akun yang tak pernah membuka halaman
     * pengaturan tidak pernah menerima email apa pun.
     */
    public const DEFAULT_CHANNELS = ['browser', 'email'];

    public const DEFAULT_EVENT_TYPES = ['bahaya_sangat_tinggi', 'laporan_ground_truth', 'peringatan_bmkg'];

    protected $fillable = [
        'id',
        'user_id',
        'channels',
        'event_types',
        'monitored_regions',
    ];

    protected $casts = [
        'channels' => 'array',
        'event_types' => 'array',
        'monitored_regions' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
