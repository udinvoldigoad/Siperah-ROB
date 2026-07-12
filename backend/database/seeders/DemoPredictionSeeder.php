<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

final class DemoPredictionSeeder extends Seeder
{
    public function run(): void { (new DatabaseSeeder())->seedPredictions(); }
}
