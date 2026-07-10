<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AuthController
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        return response()->json([
            'message' => 'Login endpoint ready',
            'email' => $data['email'],
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        return response()->json([
            'message' => 'Registration request queued for approval',
            'data' => $request->only(['name', 'email', 'role', 'institution', 'region_id']),
        ], 202);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out']);
    }
}
