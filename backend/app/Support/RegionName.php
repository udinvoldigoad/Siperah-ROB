<?php

namespace App\Support;

final class RegionName
{
    public static function normalize(string $name): string
    {
        return preg_replace('/^(kabupaten|kota)\s+/i', '', mb_strtolower(trim($name))) ?? '';
    }
}
