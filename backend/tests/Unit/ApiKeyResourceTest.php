<?php

namespace Tests\Unit;

use App\Http\Resources\ApiKeyResource;
use App\Models\ApiKey;
use Illuminate\Http\Request;
use Tests\TestCase;

final class ApiKeyResourceTest extends TestCase
{
    public function test_resource_never_exposes_key_hash(): void
    {
        $key = new ApiKey([
            'id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'key_hash' => 'secret-hash',
            'key_prefix' => 'spr_example...',
            'status' => 'aktif',
            'scopes' => ['predictions:read'],
            'use_count' => 0,
        ]);

        $data = (new ApiKeyResource($key))->toArray(Request::create('/'));

        self::assertArrayNotHasKey('key_hash', $data);
        self::assertArrayNotHasKey('raw_key', $data);
        self::assertSame('spr_example...', $data['key_prefix']);
    }
}
