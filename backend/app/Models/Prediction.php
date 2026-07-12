<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Prediction extends Model
{
    protected $table = 'predictions';

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'id',
        'region_id',
        'prediction_date',
        'risk_probability',
        'risk_class',
        'confidence_score',
        'max_tidal_height',
        'peak_time',
        'model_version',
        'generated_at',
        'data_source',
        'source_reference',
        'provenance_status',
    ];

    protected $casts = [
        'risk_probability' => 'float',
        'confidence_score' => 'float',
        'max_tidal_height' => 'float',
        'prediction_date' => 'date',
    ];

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }
}
