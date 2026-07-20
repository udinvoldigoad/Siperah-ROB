<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GroundTruthReport extends Model
{
    protected $table = 'ground_truth_reports';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'report_code',
        'user_id',
        'region_id',
        'latitude',
        'longitude',
        'severity',
        'water_height_cm',
        'incident_time',
        'description',
        'status',
        'validated_by',
        'validated_at',
        'rejection_reason',
        'is_within_monitoring_area',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'water_height_cm' => 'integer',
        'incident_time' => 'datetime',
        'validated_at' => 'datetime',
        'is_within_monitoring_area' => 'boolean',
    ];

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(ReportPhoto::class, 'report_id');
    }
}
