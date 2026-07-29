<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * `system:health-check` harus mengeluh saat kunci VAPID salah BENTUK, bukan
 * hanya saat kosong.
 *
 * Latar: di produksi baris `.env` VAPID_PRIVATE_KEY kehilangan newline sehingga
 * menyatu dengan VAPID_SUBJECT. Nilainya jadi 90 karakter berisi `=` dan `/`,
 * dan setiap pengiriman push gagal di `Base64Url::decode()` — tak terdeteksi
 * selama dua hari karena satu-satunya gejalanya adalah job antrean gagal.
 */
final class VapidHealthCheckTest extends TestCase
{
    use DatabaseTransactions;

    /** Kunci sah: 65 byte diawali 0x04 (publik) dan 32 byte (privat). */
    private function validPublic(): string
    {
        return $this->b64url("\x04".str_repeat("\x11", 64));
    }

    private function validPrivate(): string
    {
        return $this->b64url(str_repeat("\x22", 32));
    }

    private function b64url(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    /**
     * Pakai Artisan::call, bukan $this->artisan(): PendingCommand butuh Mockery
     * dan proyek ini sengaja tidak memasangnya (lihat GoogleOAuthTest yang
     * menstub Socialite lewat Socialite::extend()).
     */
    private function runCheck(): string
    {
        Artisan::call('system:health-check', ['--hours' => 1]);

        return Artisan::output();
    }

    public function test_well_formed_keys_raise_no_complaint(): void
    {
        config([
            'webpush.vapid.public_key' => $this->validPublic(),
            'webpush.vapid.private_key' => $this->validPrivate(),
            'webpush.vapid.subject' => 'mailto:admin@example.test',
        ]);

        self::assertStringNotContainsString('VAPID', $this->runCheck());
    }

    /** Persis bentuk yang terjadi di produksi: dua variabel menyatu. */
    public function test_private_key_merged_with_the_next_variable_is_caught(): void
    {
        config([
            'webpush.vapid.public_key' => $this->validPublic(),
            'webpush.vapid.private_key' => $this->validPrivate().'VAPID_SUBJECT=https://contoh.test',
            'webpush.vapid.subject' => 'https://contoh.test',
        ]);

        self::assertStringContainsString('VAPID_PRIVATE_KEY salah bentuk', $this->runCheck());
    }

    /** Base64 standar (mengandung + / =) juga salah — harus base64url. */
    public function test_standard_base64_private_key_is_caught(): void
    {
        config([
            'webpush.vapid.public_key' => $this->validPublic(),
            'webpush.vapid.private_key' => base64_encode(str_repeat("\xfb", 32)),
            'webpush.vapid.subject' => 'mailto:admin@example.test',
        ]);

        self::assertStringContainsString('VAPID_PRIVATE_KEY salah bentuk', $this->runCheck());
    }

    /** Kunci publik terkompresi (diawali 0x02/0x03) tak didukung pustaka push. */
    public function test_compressed_public_key_is_caught(): void
    {
        config([
            'webpush.vapid.public_key' => $this->b64url("\x02".str_repeat("\x11", 64)),
            'webpush.vapid.private_key' => $this->validPrivate(),
            'webpush.vapid.subject' => 'mailto:admin@example.test',
        ]);

        self::assertStringContainsString('VAPID_PUBLIC_KEY salah bentuk', $this->runCheck());
    }

    public function test_subject_must_be_mailto_or_https(): void
    {
        config([
            'webpush.vapid.public_key' => $this->validPublic(),
            'webpush.vapid.private_key' => $this->validPrivate(),
            'webpush.vapid.subject' => 'siperah-rob.example.test',
        ]);

        self::assertStringContainsString('VAPID_SUBJECT', $this->runCheck());
    }

    /** Belum dikonfigurasi sama sekali (dev lokal) bukan masalah. */
    public function test_unconfigured_push_is_not_reported(): void
    {
        config([
            'webpush.vapid.public_key' => '',
            'webpush.vapid.private_key' => '',
            'webpush.vapid.subject' => '',
        ]);

        self::assertStringNotContainsString('VAPID', $this->runCheck());
    }
}
