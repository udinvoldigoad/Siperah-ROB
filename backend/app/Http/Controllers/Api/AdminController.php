<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AdminController
{
    public function users(Request $request): JsonResponse
    {
        return response()->json(['data' => [], 'filters' => $request->only(['role', 'status', 'region_id', 'search'])]);
    }

    public function approveUser(string $user): JsonResponse
    {
        return response()->json(['message' => 'User approved', 'id' => $user]);
    }

    public function rejectUser(string $user): JsonResponse
    {
        return response()->json(['message' => 'User rejected', 'id' => $user]);
    }

    public function updateUser(Request $request, string $user): JsonResponse
    {
        return response()->json(['message' => 'User updated', 'id' => $user, 'data' => $request->only(['role', 'region_id', 'status'])]);
    }
}
