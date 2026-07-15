<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$carbon = \Carbon\Carbon::parse('2026-07-15 11:22:00');
echo "Carbon timezone: " . $carbon->getTimezone()->getName() . "\n";
echo "Carbon JSON: " . json_encode($carbon) . "\n";
