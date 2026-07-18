<?php

namespace Tests\Feature;

use Tests\TestCase;

final class SecurityHeadersTest extends TestCase
{
    public function test_api_responses_carry_security_headers(): void
    {
        $response = $this->getJson('/');

        $response->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

        // Request test berjalan lewat HTTP biasa — HSTS tidak boleh terpasang
        // di sini (hanya di HTTPS).
        $this->assertFalse($response->headers->has('Strict-Transport-Security'));
    }

    public function test_error_responses_also_carry_security_headers(): void
    {
        $this->getJson('/api/admin/users')
            ->assertUnauthorized()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY');
    }
}
