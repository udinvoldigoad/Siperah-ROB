<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Region extends Model
{
    protected $table = 'regions';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'province',
        'regency',
        'district',
        'village',
        'geometry',
        'population',
        'coastal_flag',
    ];

    protected $casts = [
        'population' => 'integer',
        'coastal_flag' => 'boolean',
    ];

    public function predictions(): HasMany
    {
        return $this->hasMany(Prediction::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(GroundTruthReport::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
