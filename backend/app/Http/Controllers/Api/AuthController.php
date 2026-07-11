<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class AuthController
{
    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = User::where('email', $data['email'])->first();

        if (!$user || !Hash::check($data['password'], $user->password_hash)) {
            return response()->json(['message' => 'Email atau password salah'], 401);
        }

        if ($user->status !== 'aktif') {
            return response()->json(['message' => 'Akun belum diaktifkan atau telah dinonaktifkan'], 403);
        }

        $user->update(['last_login_at' => now()]);
        $token = $user->createToken('auth_token')->plainTextToken;

        // Audit log
        \App\Models\AuditLog::create([
            'id' => (string) Str::uuid(),
            'actor_user_id' => $user->id,
            'actor_name' => $user->name,
            'actor_role' => $user->role,
            'action' => 'login',
            'target_resource' => $user->email,
            'outcome' => 'success',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => new UserResource($user),
        ]);
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = User::create([
            'id' => (string) Str::uuid(),
            'name' => $data['name'],
            'email' => $data['email'],
            'password_hash' => Hash::make($data['password']),
            'phone_number' => $data['phone_number'] ?? null,
            'institution' => $data['institution'] ?? null,
            'region_id' => $data['region_id'] ?? null,
            'role' => 'warga', // Default to warga, admin must upgrade
            'status' => 'menunggu', // Default to pending approval
        ]);

        return response()->json([
            'message' => 'Registrasi berhasil. Menunggu persetujuan admin.',
            'user' => new UserResource($user)
        ], 201);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($request->user())
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }
}
