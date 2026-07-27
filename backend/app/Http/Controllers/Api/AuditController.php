<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Http\Requests\AuditLogRequest;
use App\Services\AuditService;
use App\Support\AppTime;
use App\Support\CsvWriter;

final class AuditController
{
    public function __construct(private readonly AuditService $audit) {}

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

        // Admin memilih tanggal dalam WIB, tapi created_at disimpan UTC —
        // batas harinya harus digeser, kalau tidak rentang "1–2 Juli" ikut
        // memuat 07:00 WIB tanggal 1 s/d 07:00 WIB tanggal 3.
        if (!empty($filters['from'])) {
            $query->where('created_at', '>=', AppTime::startOfDayUtc($filters['from']));
        }

        if (!empty($filters['to'])) {
            $query->where('created_at', '<=', AppTime::endOfDayUtc($filters['to']));
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
            // Penarikan massal jejak audit harus meninggalkan jejak juga.
            $this->audit->write($request, 'export_audit_logs', 'success', 'audit_logs:export', array_filter($filters));

            return response()->streamDownload(function () use ($query): void {
                $output = fopen('php://output', 'wb');
                // Timestamp ISO-8601 ber-offset — kolom mentah Carbon tampil
                // sebagai UTC polos dan terbaca 7 jam lebih awal dari tabel UI.
                CsvWriter::putRow($output, ['ID', 'Actor', 'Role', 'Action', 'Target', 'Outcome', 'IP', 'Created At (ISO-8601)']);
                foreach ($query->cursor() as $log) {
                    CsvWriter::putRow($output, [$log->id, $log->actor_name, $log->actor_role, $log->action, $log->target_resource, $log->outcome, $log->ip_address, optional($log->created_at)->toIso8601String()]);
                }
                fclose($output);
            }, 'audit_logs.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        // Ringkasan global per-outcome agar KPI akurat lintas halaman
        // (bukan hanya baris yang sedang ditampilkan).
        $summary = [
            'total' => AuditLog::count(),
            'success' => AuditLog::where('outcome', 'success')->count(),
            'denied' => AuditLog::where('outcome', 'denied')->count(),
            'fail' => AuditLog::where('outcome', 'fail')->count(),
            'partial' => AuditLog::where('outcome', 'partial')->count(),
        ];

        return AuditLogResource::collection($query->paginate($filters['per_page'] ?? 15))
            ->additional(['summary' => $summary]);
    }
}
