<?php

namespace Tests\Unit;

use App\Http\Middleware\EnsureActiveUser;
use App\Models\User;
use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Response;

final class EnsureActiveUserTest extends TestCase
{
    public function test_inactive_user_is_rejected(): void
    {
        $request = Request::create('/api/reports');
        $user = new User();
        $user->status = 'nonaktif';
        $request->setUserResolver(fn () => $user);

        $response = (new EnsureActiveUser())->handle(
            $request,
            fn () => new Response('ok'),
        );

        self::assertSame(403, $response->getStatusCode());
    }

    public function test_active_user_can_continue(): void
    {
        $request = Request::create('/api/reports');
        $user = new User();
        $user->status = 'aktif';
        $request->setUserResolver(fn () => $user);

        $response = (new EnsureActiveUser())->handle(
            $request,
            fn () => new Response('ok'),
        );

        self::assertSame(200, $response->getStatusCode());
    }
}
