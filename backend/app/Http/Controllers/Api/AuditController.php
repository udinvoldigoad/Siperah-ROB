<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AuditController
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => [], 'filters' => $request->only(['action', 'outcome', 'search'])]);
    }
}
