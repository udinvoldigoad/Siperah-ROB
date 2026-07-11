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

    protected $fillable = [
        'id',
        'user_id',
        'channels',
        'event_types',
        'quiet_start',
        'quiet_end',
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
