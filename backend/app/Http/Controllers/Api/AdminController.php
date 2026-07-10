<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class AdminController
{
    public function users(Request $request): JsonResponse
    {
        $query = DB::table('users')
            ->leftJoin('regions', 'users.region_id', '=', 'regions.id')
            ->select('users.*', 'regions.village as region_name', 'regions.regency as region_regency');

        if ($request->filled('role')) {
            $query->where('users.role', $request->query('role'));
        }

        if ($request->filled('status')) {
            $query->where('users.status', $request->query('status'));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->query('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('users.name', 'like', $search)
                  ->orWhere('users.email', 'like', $search)
                  ->orWhere('regions.village', 'like', $search);
            });
        }

        $users = $query->orderBy('users.created_at', 'desc')->get();

        return response()->json([
            'data' => $users,
            'filters' => $request->only(['role', 'status', 'region_id', 'search'])
        ]);
    }

    public function approveUser(string $user): JsonResponse
    {
        DB::table('users')->where('id', $user)->update([
            'status' => 'aktif',
            'updated_at' => now(),
        ]);

        $userData = DB::table('users')->where('id', $user)->first();

        // Log audit log
        DB::table('audit_logs')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'actor_user_id' => null,
            'actor_name' => 'System Admin',
            'actor_role' => 'admin',
            'action' => 'approve_user',
            'target_resource' => $userData->email ?? $user,
            'outcome' => 'success',
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'User approved', 'id' => $user]);
    }

    public function rejectUser(string $user): JsonResponse
    {
        DB::table('users')->where('id', $user)->update([
            'status' => 'ditolak',
            'updated_at' => now(),
        ]);

        $userData = DB::table('users')->where('id', $user)->first();

        // Log audit log
        DB::table('audit_logs')->insert([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'actor_user_id' => null,
            'actor_name' => 'System Admin',
            'actor_role' => 'admin',
            'action' => 'reject_user',
            'target_resource' => $userData->email ?? $user,
            'outcome' => 'success',
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'User rejected', 'id' => $user]);
    }

    public function updateUser(Request $request, string $user): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', 'in:warga,bpbd_operator,bpbd_provinsi,peneliti,admin'],
            'status' => ['required', 'in:menunggu,aktif,nonaktif,ditolak'],
            'region_id' => ['nullable', 'uuid'],
        ]);

        DB::table('users')->where('id', $user)->update([
            'role' => $data['role'],
            'status' => $data['status'],
            'region_id' => $data['region_id'] ?? null,
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'User updated', 'id' => $user]);
    }
}
