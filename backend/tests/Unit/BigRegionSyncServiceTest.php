<?php

namespace Tests\Unit;

use App\Services\BigRegionSyncService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class BigRegionSyncServiceTest extends TestCase
{
    public function test_dry_run_validates_big_geojson_without_database_write(): void
    {
        Http::fakeSequence()
            ->push(['count' => 1])
            ->push([
                'type' => 'FeatureCollection',
                'features' => [[
                    'type' => 'Feature',
                    'geometry' => [
                        'type' => 'Polygon',
                        'coordinates' => [[[105.0, -5.0], [105.1, -5.0], [105.1, -5.1], [105.0, -5.0]]],
                    ],
                    'properties' => [
                        'KDEPUM' => '18.01.01.2001',
                        'WADMKD' => 'Desa Uji',
                        'WADMKC' => 'Kecamatan Uji',
                        'WADMKK' => 'Kabupaten Uji',
                        'WADMPR' => 'Lampung',
                    ],
                ]],
            ]);

        $result = (new BigRegionSyncService())->sync('Lampung', true);

        self::assertSame(1, $result['reported']);
        self::assertSame(1, $result['valid']);
        self::assertSame(0, $result['invalid']);
        self::assertSame(0, $result['inserted']);
    }
}
