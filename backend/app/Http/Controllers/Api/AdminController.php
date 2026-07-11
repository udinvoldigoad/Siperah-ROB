<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class AdminController
{
    public function users(Request $request)
    {
        $query = User::orderBy('created_at', 'desc');

        if ($request->filled('role')) {
            $query->where('role', $request->query('role'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return UserResource::collection($query->paginate(15));
    }

    public function approveUser(Request $request, string $user): JsonResponse
    {
        $userData = User::findOrFail($user);
        $userData->update(['status' => 'aktif']);

        $actor = $request->user();

        AuditLog::create([
            'id' => (string) Str::uuid(),
            'actor_user_id' => $actor?->id,
            'actor_name' => $actor?->name ?? 'System',
            'actor_role' => $actor?->role ?? 'admin',
            'action' => 'approve_user',
            'target_resource' => $userData->email,
            'outcome' => 'success',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json(['message' => 'User approved', 'id' => $user]);
    }

    public function rejectUser(Request $request, string $user): JsonResponse
    {
        $userData = User::findOrFail($user);
        $userData->update(['status' => 'ditolak']);

        $actor = $request->user();

        AuditLog::create([
            'id' => (string) Str::uuid(),
            'actor_user_id' => $actor?->id,
            'actor_name' => $actor?->name ?? 'System',
            'actor_role' => $actor?->role ?? 'admin',
            'action' => 'reject_user',
            'target_resource' => $userData->email,
            'outcome' => 'success',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json(['message' => 'User rejected', 'id' => $user]);
    }

    public function updateUser(Request $request, string $user): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', 'string', 'in:warga,bpbd_operator,bpbd_provinsi,peneliti,admin'],
            'institution' => ['nullable', 'string', 'max:150'],
        ]);

        $userData = User::findOrFail($user);
        $userData->update($data);

        return response()->json(['message' => 'User updated', 'data' => new UserResource($userData)]);
    }
}
