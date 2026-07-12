<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Http\Requests\AuditLogRequest;

final class AuditController
{
    public function index(AuditLogRequest $request)
    {
        $filters = $request->validated();
        $query = AuditLog::with('actor')->orderBy('created_at', 'desc');

        if (!empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }

        if (!empty($filters['outcome'])) {
            $query->where('outcome', $filters['outcome']);
        }

        if (!empty($filters['search'])) {
            $search = '%' . $filters['search'] . '%';
            $query->where(function ($q) use ($search) {
                $q->where('actor_name', 'like', $search)
                  ->orWhere('action', 'like', $search)
                  ->orWhere('target_resource', 'like', $search);
            });
        }

        if (($filters['format'] ?? 'json') === 'csv') {
            return response()->streamDownload(function () use ($query): void {
                $output = fopen('php://output', 'wb');
                fputcsv($output, ['ID', 'Actor', 'Role', 'Action', 'Target', 'Outcome', 'IP', 'Created At'], ',', '"', '');
                foreach ($query->cursor() as $log) {
                    fputcsv($output, [$log->id, $log->actor_name, $log->actor_role, $log->action, $log->target_resource, $log->outcome, $log->ip_address, $log->created_at], ',', '"', '');
                }
                fclose($output);
            }, 'audit_logs.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        return AuditLogResource::collection($query->paginate($filters['per_page'] ?? 15));
    }
}
