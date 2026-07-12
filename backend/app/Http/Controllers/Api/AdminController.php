<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\UserResource;
use App\Http\Requests\UpdateAdminUserRequest;
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
        $userData->tokens()->delete();

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

    public function updateUser(UpdateAdminUserRequest $request, string $user): JsonResponse
    {
        $data = $request->validated();
        $userData = User::findOrFail($user);
        abort_if(
            $userData->id === $request->user()->id
                && (($data['role'] ?? 'admin') !== 'admin' || in_array($data['status'] ?? 'aktif', ['nonaktif', 'ditolak'], true)),
            422,
            'Admin tidak dapat menurunkan role atau menonaktifkan akunnya sendiri.',
        );
        $userData->update($data);

        if (in_array($userData->status, ['nonaktif', 'ditolak'], true)) {
            $userData->tokens()->delete();
        }

        $actor = $request->user();
        AuditLog::create([
            'id' => (string) Str::uuid(),
            'actor_user_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role,
            'action' => 'update_user',
            'target_resource' => "users:{$userData->id}",
            'outcome' => 'success',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => $data,
        ]);

        return response()->json(['message' => 'User updated', 'data' => new UserResource($userData)]);
    }
}
