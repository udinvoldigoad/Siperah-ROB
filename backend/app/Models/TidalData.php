<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TidalData extends Model
{
    protected $table = 'tidal_data';

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'id',
        'station_id',
        'station_name',
        'station_code',
        'recorded_at',
        'tidal_height',
        'unit',
        'source',
        'data_type',
        'datum',
        'event_type',
        'timezone',
        'source_reference',
        'provenance_status',
        'quality_status',
        'imported_at',
    ];

    protected $casts = [
        'tidal_height' => 'float',
        'recorded_at' => 'datetime',
        'imported_at' => 'datetime',
    ];

    public function station(): BelongsTo
    {
        return $this->belongsTo(TidalStation::class, 'station_id');
    }
}
