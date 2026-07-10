<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

final class DatabaseSeeder extends Seeder
{
    private const REGION_ID = '11111111-1111-4111-8111-111111111111';
    private const USER_ID = '22222222-2222-4222-8222-222222222222';

    public function run(): void
    {
        DB::statement(
            "insert into regions (id, province, regency, district, village, geometry, population, coastal_flag, created_at, updated_at)
            values (?, 'Lampung', 'Bandar Lampung', 'Panjang', 'Panjang Utara',
                'MULTIPOLYGON(((105.250000 -5.460000,105.290000 -5.460000,105.290000 -5.430000,105.250000 -5.430000,105.250000 -5.460000)))',
                12000, true, now(), now())
            on conflict (id) do nothing",
            [self::REGION_ID],
        );

        DB::table('users')->updateOrInsert(
            ['id' => self::USER_ID],
            [
                'name' => 'Warga Mode Awam',
                'email' => 'warga@siperah.local',
                'phone_number' => '080000000000',
                'role' => 'warga',
                'region_id' => self::REGION_ID,
                'status' => 'aktif',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        foreach ($this->reports() as $report) {
            DB::statement(
                "insert into ground_truth_reports (
                    id, report_code, user_id, region_id, latitude, longitude, severity, water_height_cm,
                    incident_time, description, status, created_at, updated_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict (id) do update set
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    severity = excluded.severity,
                    water_height_cm = excluded.water_height_cm,
                    incident_time = excluded.incident_time,
                    description = excluded.description,
                    status = excluded.status,
                    updated_at = excluded.updated_at",
                [
                    $report['id'],
                    $report['code'],
                    self::USER_ID,
                    self::REGION_ID,
                    $report['latitude'],
                    $report['longitude'],
                    $report['severity'],
                    $report['water_height_cm'],
                    $report['incident_time'],
                    $report['description'],
                    $report['status'],
                    $report['created_at'],
                    now(),
                ],
            );

            foreach ($report['photos'] as $photo) {
                DB::table('report_photos')->updateOrInsert(
                    ['id' => $photo['id']],
                    [
                        'report_id' => $report['id'],
                        'file_url' => 'seed/'.$photo['name'].'.jpg',
                        'file_name' => $photo['name'],
                        'file_size' => 180000,
                        'mime_type' => 'image/jpeg',
                        'uploaded_at' => now(),
                    ],
                );
            }
        }
    }

    private function reports(): array
    {
        return [
            [
                'id' => '33333333-3333-4333-8333-333333333882',
                'code' => 'GT-LPG-882',
                'latitude' => -5.450000,
                'longitude' => 105.266667,
                'severity' => 'parah',
                'status' => 'menunggu',
                'water_height_cm' => 38,
                'incident_time' => '2026-07-09 02:40:00+07',
                'created_at' => now()->subMinutes(12),
                'description' => 'Genangan masuk ke akses pasar dan menutup sebagian jalan warga. Arus lambat, kendaraan roda dua mulai dialihkan.',
                'photos' => [
                    ['id' => '44444444-4444-4444-8444-333333333821', 'name' => 'Akses pasar'],
                    ['id' => '44444444-4444-4444-8444-333333333822', 'name' => 'Jalan lingkungan'],
                ],
            ],
            [
                'id' => '33333333-3333-4333-8333-333333333881',
                'code' => 'GT-LPG-881',
                'latitude' => -5.382120,
                'longitude' => 105.274010,
                'severity' => 'sedang',
                'status' => 'perlu_review',
                'water_height_cm' => 24,
                'incident_time' => '2026-07-09 01:58:00+07',
                'created_at' => now()->subMinutes(36),
                'description' => 'Air menutup bahu jalan dekat drainase utama. Perlu cek ulang karena lokasi cukup jauh dari pesisir.',
                'photos' => [
                    ['id' => '44444444-4444-4444-8444-333333333811', 'name' => 'Drainase'],
                    ['id' => '44444444-4444-4444-8444-333333333812', 'name' => 'Bahu jalan'],
                ],
            ],
            [
                'id' => '33333333-3333-4333-8333-333333333879',
                'code' => 'GT-LPG-879',
                'latitude' => -5.447830,
                'longitude' => 105.262440,
                'severity' => 'sangat_parah',
                'status' => 'menunggu',
                'water_height_cm' => 52,
                'incident_time' => '2026-07-08 23:20:00+07',
                'created_at' => now()->subHour(),
                'description' => 'Air masuk ke rumah warga di gang rendah. Beberapa kepala keluarga memindahkan barang ke lantai atas.',
                'photos' => [
                    ['id' => '44444444-4444-4444-8444-333333333791', 'name' => 'Gang rendah'],
                    ['id' => '44444444-4444-4444-8444-333333333792', 'name' => 'Rumah warga'],
                ],
            ],
        ];
    }
}
