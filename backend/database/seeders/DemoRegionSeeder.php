<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

final class DemoRegionSeeder extends Seeder
{
    public function run(): void { (new DatabaseSeeder())->seedRegions(); }
}
