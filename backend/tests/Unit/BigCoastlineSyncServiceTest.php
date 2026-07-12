<?php

namespace Tests\Unit;

use App\Services\BigCoastlineSyncService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class BigCoastlineSyncServiceTest extends TestCase
{
    public function test_dry_run_validates_linestring_without_writing(): void
    {
        Http::fakeSequence()->push(['count' => 1])->push([
            'type' => 'FeatureCollection',
            'features' => [[
                'type' => 'Feature',
                'properties' => ['OBJECTID' => 1, 'TIPGPN' => 2, 'THNSBDATA' => '2022'],
                'geometry' => ['type' => 'LineString', 'coordinates' => [[105.0, -5.0], [105.1, -5.1]]],
            ]],
        ]);

        $stats = (new BigCoastlineSyncService())->sync([103.5, -6.2, 106.3, -3.7], true);

        self::assertSame(1, $stats['reported']);
        self::assertSame(1, $stats['valid']);
        self::assertSame(0, $stats['inserted']);
    }
}
