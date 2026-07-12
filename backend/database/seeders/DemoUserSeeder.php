<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

final class DemoUserSeeder extends Seeder
{
    public function run(): void { (new DatabaseSeeder())->seedUsers(); }
}
