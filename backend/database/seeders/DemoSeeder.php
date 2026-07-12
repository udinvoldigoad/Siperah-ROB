<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

final class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            DemoRegionSeeder::class,
            DemoUserSeeder::class,
            DemoPredictionSeeder::class,
            DemoReportSeeder::class,
            DemoDatasetSeeder::class,
        ]);
    }
}
