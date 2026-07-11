<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TidalData extends Model
{
    protected $table = 'tidal_data';

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'id',
        'station_name',
        'station_code',
        'recorded_at',
        'tidal_height',
        'unit',
        'source',
    ];

    protected $casts = [
        'tidal_height' => 'float',
        'recorded_at' => 'datetime',
    ];
}
