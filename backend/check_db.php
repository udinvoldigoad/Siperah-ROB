<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$dateStr = '2026-07-15 11:22:00+07';
$carbon = \Carbon\Carbon::createFromFormat('Y-m-d H:i:sP', $dateStr);
if ($carbon) {
    echo "Parsed correctly! " . $carbon->toIsoString() . "\n";
} else {
    echo "Failed to parse\n";
}

$carbon2 = \Carbon\Carbon::createFromFormat('Y-m-d H:i:sP', '2026-07-15 11:22:00+07:00');
echo "Parsed 2! " . $carbon2->toIsoString() . "\n";
