<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AuditController
{
    public function index(Request $request)
    {
        $query = AuditLog::with('actor')->orderBy('created_at', 'desc');

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

        return AuditLogResource::collection($query->paginate(15));
    }
}
