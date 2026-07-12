<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

final class DemoDatasetSeeder extends Seeder
{
    public function run(): void { (new DatabaseSeeder())->seedDatasets(); }
}
