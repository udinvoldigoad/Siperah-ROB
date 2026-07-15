<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$rows = DB::table('predictions')->limit(10)->get();
foreach ($rows as $r) {
    echo "prob: {$r->risk_probability} | class: {$r->risk_class}\n";
}
