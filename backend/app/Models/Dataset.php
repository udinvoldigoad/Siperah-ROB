<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Dataset extends Model
{
    protected $table = 'datasets';

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'id',
        'name',
        'description',
        'dataset_type',
        'period_start',
        'period_end',
        'resolution',
        'record_count',
        'license',
        'csv_url',
        'json_url',
        'visibility',
        'coverage_regencies',
    ];

    protected $casts = [
        'record_count' => 'integer',
        'period_start' => 'date',
        'period_end' => 'date',
        'coverage_regencies' => 'array',
    ];
}
