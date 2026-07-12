<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

final class DemoReportSeeder extends Seeder
{
    public function run(): void { (new DatabaseSeeder())->seedReports(); }
}
