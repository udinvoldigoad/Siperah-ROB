<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Http\Requests\AuditLogRequest;
use App\Support\CsvWriter;
use Carbon\CarbonImmutable;

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

        if (!empty($filters['actor_role'])) {
            $query->where('actor_role', $filters['actor_role']);
        }

        if (!empty($filters['user_id'])) {
            $query->where('actor_user_id', $filters['user_id']);
        }

        if (!empty($filters['from'])) {
            $query->where('created_at', '>=', $filters['from']);
        }

        if (!empty($filters['to'])) {
            $query->where('created_at', '<=', CarbonImmutable::parse($filters['to'])->endOfDay());
        }

        if (!empty($filters['search'])) {
            $search = '%' . mb_strtolower($filters['search']) . '%';
            $query->where(function ($q) use ($search) {
                $q->whereRaw('LOWER(COALESCE(actor_name, \'\')) LIKE ?', [$search])
                  ->orWhereRaw('LOWER(COALESCE(actor_role, \'\')) LIKE ?', [$search])
                  ->orWhereRaw('LOWER(COALESCE(action, \'\')) LIKE ?', [$search])
                  ->orWhereRaw('LOWER(COALESCE(target_resource, \'\')) LIKE ?', [$search]);
            });
        }

        if (($filters['format'] ?? 'json') === 'csv') {
            return response()->streamDownload(function () use ($query): void {
                $output = fopen('php://output', 'wb');
                CsvWriter::putRow($output, ['ID', 'Actor', 'Role', 'Action', 'Target', 'Outcome', 'IP', 'Created At']);
                foreach ($query->cursor() as $log) {
                    CsvWriter::putRow($output, [$log->id, $log->actor_name, $log->actor_role, $log->action, $log->target_resource, $log->outcome, $log->ip_address, $log->created_at]);
                }
                fclose($output);
            }, 'audit_logs.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        return AuditLogResource::collection($query->paginate($filters['per_page'] ?? 15));
    }
}
