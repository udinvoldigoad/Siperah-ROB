<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Pipeline ML Prediksi Rob (ml-api)
    |--------------------------------------------------------------------------
    | path   : direktori ml-api (default: ../ml-api relatif terhadap backend)
    | python : interpreter Python yang dipakai (default: .venv di dalam ml-api)
    */

    'ml_api' => [
        'path' => env('ML_API_PATH'),
        'python' => env('ML_API_PYTHON'),
        // Matikan di host tanpa Python (mis. shared hosting); prediksi harian
        // dijalankan dari GitHub Actions yang menulis langsung ke database.
        'schedule_enabled' => env('ML_SCHEDULE_ENABLED', true),
    ],

];
