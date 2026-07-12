<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class TidalStation extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id', 'code', 'name', 'latitude', 'longitude', 'coverage_radius_km',
        'default_datum', 'timezone', 'source', 'source_url',
        'provenance_status', 'status',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'coverage_radius_km' => 'float',
    ];

    public function data(): HasMany
    {
        return $this->hasMany(TidalData::class, 'station_id');
    }
}
