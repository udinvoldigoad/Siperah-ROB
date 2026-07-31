<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Cache;

abstract class TestCase extends BaseTestCase
{
    /**
     * Setiap test mulai dengan cache bersih. Driver `array` bertahan selama satu
     * proses PHPUnit, jadi tanpa flush di sini state antar-test bocor:
     *
     * - Respons /public/map (di-cache 15 menit per filter) bisa dibaca basi oleh
     *   test lain yang memakai filter sama — dulu tiap file Feature flush manual.
     * - Counter rate limiter (registrasi 5/jam, login, dst.) tersimpan di cache
     *   store yang sama, sehingga reset per-test membuat jumlah panggilan
     *   /auth/register dalam satu file tidak lagi menabrak batas limiter.
     *
     * Test yang butuh menanam nilai cache melakukannya SETELAH setUp ini jalan.
     */
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }
}
