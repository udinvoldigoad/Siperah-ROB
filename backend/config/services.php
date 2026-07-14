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
    ],

];
