<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class AuditController
{
    public function index(Request $request): JsonResponse
    {
        $query = DB::table('audit_logs');

        if ($request->filled('action')) {
            $query->where('action', $request->query('action'));
        }

        if ($request->filled('outcome')) {
            $query->where('outcome', $request->query('outcome'));
        }

        if ($request->filled('search')) {
            $search = '%' . $request->query('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('actor_name', 'like', $search)
                  ->orWhere('action', 'like', $search)
                  ->orWhere('target_resource', 'like', $search);
            });
        }

        $logs = $query->orderBy('created_at', 'desc')->limit(100)->get();

        return response()->json([
            'data' => $logs,
            'filters' => $request->only(['action', 'outcome', 'search'])
        ]);
    }
}
