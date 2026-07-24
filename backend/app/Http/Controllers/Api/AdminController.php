<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\UserResource;
use App\Http\Requests\StoreAdminUserRequest;
use App\Http\Requests\UpdateAdminUserRequest;
use App\Models\User;
use App\Services\AuditService;
use App\Support\CsvWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class AdminController
{
    public function __construct(private readonly AuditService $audit) {}

    public function users(Request $request)
    {
        $query = User::with('region')->orderBy('created_at', 'desc');

        if ($request->filled('role')) {
            $query->where('role', $request->query('role'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('search')) {
            $search = mb_strtolower((string) $request->query('search'));
            $query->where(function ($items) use ($search): void {
                $items->whereRaw('LOWER(name) LIKE ?', ["%{$search}%"])
                    ->orWhereRaw('LOWER(email) LIKE ?', ["%{$search}%"])
                    ->orWhereRaw('LOWER(COALESCE(institution, \'\')) LIKE ?', ["%{$search}%"]);
            });
        }

        // Ringkasan global (mengabaikan filter) agar KPI & banner approval akurat
        // lintas halaman, bukan hanya 15 baris yang sedang ditampilkan.
        $summary = [
            'total' => User::count(),
            'aktif' => User::where('status', 'aktif')->count(),
            'menunggu' => User::where('status', 'menunggu')->count(),
            'nonaktif' => User::where('status', 'nonaktif')->count(),
            'peneliti_menunggu' => User::where('role', 'peneliti')->where('status', 'menunggu')->count(),
        ];

        return UserResource::collection($query->paginate(15))->additional(['summary' => $summary]);
    }

    /**
     * Daftar kabupaten/kota terpantau untuk dropdown "wilayah kerja" saat admin
     * membuat pengguna. Region berlevel desa/kelurahan, jadi dikelompokkan per
     * regency dan diwakili satu region_id (MIN) — cukup untuk scoping operator
     * (dashboard menurunkan regency dari region_id) dan ramah dipilih admin.
     */
    public function regions(): JsonResponse
    {
        // Postgres tak punya MIN(uuid); cast ke text untuk mengambil satu id
        // perwakilan per regency (hasil tetap uuid valid yang ada di tabel).
        $rows = DB::table('regions')
            ->selectRaw('MIN(id::text) as id, regency')
            ->whereNotNull('regency')
            ->where('regency', '<>', '')
            ->groupBy('regency')
            ->orderBy('regency')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function storeUser(StoreAdminUserRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = User::create([
            'id' => (string) Str::uuid(),
            'name' => $data['name'],
            'email' => $data['email'],
            'password_hash' => Hash::make($data['password']),
            'phone_number' => $data['phone_number'] ?? null,
            'role' => $data['role'],
            'institution' => $data['institution'] ?? null,
            'region_id' => $data['region_id'] ?? null,
            'status' => $data['status'],
        ]);

        $this->audit->write($request, 'create_user', 'success', "users:{$user->id}", [
            'email' => $user->email,
            'role' => $user->role,
            'status' => $user->status,
            'region_id' => $user->region_id,
        ]);

        return response()->json(['message' => 'User created', 'data' => new UserResource($user->load('region'))], 201);
    }

    public function approveUser(Request $request, string $user): JsonResponse
    {
        $userData = User::findOrFail($user);
        $userData->update(['status' => 'aktif']);

        $this->audit->write($request, 'approve_user', 'success', "users:{$userData->id}", [
            'email' => $userData->email,
            'role' => $userData->role,
        ]);

        return response()->json(['message' => 'User approved', 'id' => $user]);
    }

    public function rejectUser(Request $request, string $user): JsonResponse
    {
        $userData = User::findOrFail($user);
        $userData->update(['status' => 'ditolak']);
        $userData->tokens()->delete();

        $this->audit->write($request, 'reject_user', 'success', "users:{$userData->id}", [
            'email' => $userData->email,
            'role' => $userData->role,
        ]);

        return response()->json(['message' => 'User rejected', 'id' => $user]);
    }

    public function destroyUser(Request $request, string $user): JsonResponse
    {
        $userData = User::findOrFail($user);
        abort_if($userData->id === $request->user()->id, 422, 'Admin tidak dapat menghapus akunnya sendiri.');

        // Soft delete: baris tetap ada agar FK audit_logs/ground_truth_reports
        // (ON DELETE NO ACTION) tak dilanggar & jejak riwayat utuh. Sesi diputus
        // dan akun hilang dari semua query User (login/daftar) via global scope.
        $userData->tokens()->delete();
        $userData->delete();

        $this->audit->write($request, 'delete_user', 'success', "users:{$userData->id}", [
            'email' => $userData->email,
            'role' => $userData->role,
        ]);

        return response()->json(['message' => 'User deleted', 'id' => $user]);
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

        $this->audit->write($request, 'update_user', 'success', "users:{$userData->id}", $data);

        return response()->json(['message' => 'User updated', 'data' => new UserResource($userData->load('region'))]);
    }

    public function exportUsers(Request $request): StreamedResponse
    {
        $rows = User::with('region')
            ->orderBy('created_at', 'desc')
            ->limit(5000)
            ->get();

        $this->audit->write($request, 'export_users', 'success', 'users:export', [
            'rows' => $rows->count(),
        ]);

        return response()->streamDownload(function () use ($rows): void {
            $output = fopen('php://output', 'wb');
            CsvWriter::putRow($output, ['Nama', 'Email', 'Role', 'Status', 'Instansi', 'Wilayah Kerja', 'Dibuat']);
            foreach ($rows as $user) {
                CsvWriter::putRow($output, [
                    $user->name,
                    $user->email,
                    $user->role,
                    $user->status,
                    $user->institution,
                    trim(implode(', ', array_filter([$user->region?->village, $user->region?->district, $user->region?->regency]))),
                    optional($user->created_at)->toIso8601String(),
                ]);
            }
            fclose($output);
        }, 'admin-users.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
