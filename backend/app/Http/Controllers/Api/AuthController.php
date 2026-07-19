<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final class AuthController
{
    public function __construct(private readonly AuditService $audit) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = User::where('email', $data['email'])->first();

        if (!$user || !Hash::check($data['password'], $user->password_hash)) {
            $this->audit->write($request, 'login', 'fail', $data['email'], [
                'actor_name' => $data['email'],
                'actor_role' => 'guest',
                'reason' => 'invalid_credentials',
            ]);
            return response()->json(['message' => 'Email atau password salah'], 401);
        }

        if ($user->status !== 'aktif') {
            $this->audit->write($request, 'login', 'denied', $user->email, [
                'actor_name' => $user->name,
                'actor_role' => $user->role,
                'user_status' => $user->status,
            ]);

            // Pesan spesifik per status agar UI bisa menampilkan panduan yang tepat,
            // plus field account_status yang bisa dibaca frontend.
            $message = match ($user->status) {
                'menunggu' => 'Akun Anda masih menunggu persetujuan admin. Anda akan bisa masuk setelah disetujui.',
                'nonaktif' => 'Akun Anda dinonaktifkan. Hubungi admin untuk mengaktifkannya kembali.',
                'ditolak' => 'Pendaftaran akun Anda ditolak. Hubungi admin untuk informasi lebih lanjut.',
                default => 'Akun Anda belum dapat digunakan. Hubungi admin.',
            };

            return response()->json([
                'message' => $message,
                'account_status' => $user->status,
            ], 403);
        }

        $user->update(['last_login_at' => now()]);
        $token = $user->createToken('auth_token')->plainTextToken;

        $request->setUserResolver(fn () => $user);
        $this->audit->write($request, 'login', 'success', $user->email);

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

        $this->audit->write($request, 'register', 'success', $user->email, [
            'actor_name' => $user->name,
            'actor_role' => $user->role,
            'status' => $user->status,
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
        $this->audit->write($request, 'logout', 'success', $request->user()->email);
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }
}
