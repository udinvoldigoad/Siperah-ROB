<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Carbon\Carbon;

final class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedRegions();
        $this->seedUsers();
        $this->seedPredictions();
        $this->seedReports();
        $this->seedDatasets();
    }

    // ── Regions ────────────────────────────────────────────────────

    private function seedRegions(): void
    {
        $regions = $this->regionData();
        $postgisInstalled = (bool) DB::selectOne(
            "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS installed"
        )->installed;
        $geometryValue = $postgisInstalled
            ? 'ST_SetSRID(ST_GeomFromText(?), 4326)'
            : '?';

        foreach ($regions as $r) {
            DB::statement(
                "INSERT INTO regions (id, province, regency, district, village, geometry, population, coastal_flag, created_at, updated_at)
                VALUES (?, 'Lampung', ?, ?, ?, {$geometryValue}, ?, true, now(), now())
                ON CONFLICT (id) DO UPDATE SET
                    regency = EXCLUDED.regency,
                    district = EXCLUDED.district,
                    village = EXCLUDED.village,
                    geometry = EXCLUDED.geometry,
                    population = EXCLUDED.population,
                    updated_at = now()",
                [$r['id'], $r['regency'], $r['district'], $r['village'], $r['geometry'], $r['population']],
            );
        }
    }

    /**
     * 7 kabupaten/kota pesisir × beberapa kelurahan rawan rob.
     * Geometry: bounding-box MULTIPOLYGON representatif (bukan presisi kadaster).
     */
    private function regionData(): array
    {
        return [
            // ── Kota Bandar Lampung ──────────────────────────────
            [
                'id' => '11111111-1111-4111-8111-111111111111',
                'regency' => 'Kota Bandar Lampung',
                'district' => 'Panjang',
                'village' => 'Panjang Utara',
                'geometry' => 'MULTIPOLYGON(((105.250 -5.460,105.290 -5.460,105.290 -5.430,105.250 -5.430,105.250 -5.460)))',
                'population' => 12000,
            ],
            [
                'id' => '11111111-1111-4111-8111-111111111112',
                'regency' => 'Kota Bandar Lampung',
                'district' => 'Panjang',
                'village' => 'Panjang Selatan',
                'geometry' => 'MULTIPOLYGON(((105.250 -5.470,105.290 -5.470,105.290 -5.460,105.250 -5.460,105.250 -5.470)))',
                'population' => 9500,
            ],
            [
                'id' => '11111111-1111-4111-8111-111111111113',
                'regency' => 'Kota Bandar Lampung',
                'district' => 'Bumi Waras',
                'village' => 'Kangkung',
                'geometry' => 'MULTIPOLYGON(((105.258 -5.452,105.270 -5.452,105.270 -5.444,105.258 -5.444,105.258 -5.452)))',
                'population' => 8700,
            ],
            [
                'id' => '11111111-1111-4111-8111-111111111114',
                'regency' => 'Kota Bandar Lampung',
                'district' => 'Bumi Waras',
                'village' => 'Bumi Waras',
                'geometry' => 'MULTIPOLYGON(((105.262 -5.458,105.276 -5.458,105.276 -5.448,105.262 -5.448,105.262 -5.458)))',
                'population' => 11200,
            ],
            [
                'id' => '11111111-1111-4111-8111-111111111115',
                'regency' => 'Kota Bandar Lampung',
                'district' => 'Telukbetung Selatan',
                'village' => 'Pesawahan',
                'geometry' => 'MULTIPOLYGON(((105.255 -5.442,105.268 -5.442,105.268 -5.435,105.255 -5.435,105.255 -5.442)))',
                'population' => 7800,
            ],
            [
                'id' => '11111111-1111-4111-8111-111111111116',
                'regency' => 'Kota Bandar Lampung',
                'district' => 'Telukbetung Barat',
                'village' => 'Kota Karang',
                'geometry' => 'MULTIPOLYGON(((105.240 -5.445,105.254 -5.445,105.254 -5.438,105.240 -5.438,105.240 -5.445)))',
                'population' => 6200,
            ],
            [
                'id' => '11111111-1111-4111-8111-111111111117',
                'regency' => 'Kota Bandar Lampung',
                'district' => 'Telukbetung Timur',
                'village' => 'Kota Karang Raya',
                'geometry' => 'MULTIPOLYGON(((105.268 -5.440,105.282 -5.440,105.282 -5.432,105.268 -5.432,105.268 -5.440)))',
                'population' => 5400,
            ],

            // ── Kabupaten Pesawaran ──────────────────────────────
            [
                'id' => '11111111-1111-4111-8111-222222222221',
                'regency' => 'Pesawaran',
                'district' => 'Padang Cermin',
                'village' => 'Hanura',
                'geometry' => 'MULTIPOLYGON(((105.180 -5.525,105.220 -5.525,105.220 -5.500,105.180 -5.500,105.180 -5.525)))',
                'population' => 4800,
            ],
            [
                'id' => '11111111-1111-4111-8111-222222222222',
                'regency' => 'Pesawaran',
                'district' => 'Punduh Pidada',
                'village' => 'Punduh Pidada',
                'geometry' => 'MULTIPOLYGON(((105.060 -5.600,105.100 -5.600,105.100 -5.570,105.060 -5.570,105.060 -5.600)))',
                'population' => 3200,
            ],
            [
                'id' => '11111111-1111-4111-8111-222222222223',
                'regency' => 'Pesawaran',
                'district' => 'Teluk Pandan',
                'village' => 'Hurun',
                'geometry' => 'MULTIPOLYGON(((105.195 -5.510,105.215 -5.510,105.215 -5.495,105.195 -5.495,105.195 -5.510)))',
                'population' => 3900,
            ],

            // ── Kabupaten Tanggamus ──────────────────────────────
            [
                'id' => '11111111-1111-4111-8111-333333333331',
                'regency' => 'Tanggamus',
                'district' => 'Kota Agung',
                'village' => 'Kuripan',
                'geometry' => 'MULTIPOLYGON(((104.620 -5.490,104.660 -5.490,104.660 -5.460,104.620 -5.460,104.620 -5.490)))',
                'population' => 5100,
            ],
            [
                'id' => '11111111-1111-4111-8111-333333333332',
                'regency' => 'Tanggamus',
                'district' => 'Kelumbayan',
                'village' => 'Kelumbayan',
                'geometry' => 'MULTIPOLYGON(((104.720 -5.570,104.760 -5.570,104.760 -5.540,104.720 -5.540,104.720 -5.570)))',
                'population' => 2800,
            ],

            // ── Kabupaten Lampung Selatan ────────────────────────
            [
                'id' => '11111111-1111-4111-8111-444444444441',
                'regency' => 'Lampung Selatan',
                'district' => 'Kalianda',
                'village' => 'Kalianda',
                'geometry' => 'MULTIPOLYGON(((105.580 -5.730,105.620 -5.730,105.620 -5.700,105.580 -5.700,105.580 -5.730)))',
                'population' => 7200,
            ],
            [
                'id' => '11111111-1111-4111-8111-444444444442',
                'regency' => 'Lampung Selatan',
                'district' => 'Rajabasa',
                'village' => 'Rajabasa',
                'geometry' => 'MULTIPOLYGON(((105.610 -5.780,105.650 -5.780,105.650 -5.750,105.610 -5.750,105.610 -5.780)))',
                'population' => 4500,
            ],
            [
                'id' => '11111111-1111-4111-8111-444444444443',
                'regency' => 'Lampung Selatan',
                'district' => 'Bakauheni',
                'village' => 'Bakauheni',
                'geometry' => 'MULTIPOLYGON(((105.740 -5.870,105.780 -5.870,105.780 -5.840,105.740 -5.840,105.740 -5.870)))',
                'population' => 3800,
            ],

            // ── Kabupaten Pesisir Barat ──────────────────────────
            [
                'id' => '11111111-1111-4111-8111-555555555551',
                'regency' => 'Pesisir Barat',
                'district' => 'Krui Selatan',
                'village' => 'Pasar Krui',
                'geometry' => 'MULTIPOLYGON(((103.920 -5.190,103.960 -5.190,103.960 -5.160,103.920 -5.160,103.920 -5.190)))',
                'population' => 5600,
            ],
            [
                'id' => '11111111-1111-4111-8111-555555555552',
                'regency' => 'Pesisir Barat',
                'district' => 'Pesisir Tengah',
                'village' => 'Way Jambu',
                'geometry' => 'MULTIPOLYGON(((103.880 -5.080,103.920 -5.080,103.920 -5.050,103.880 -5.050,103.880 -5.080)))',
                'population' => 3100,
            ],

            // ── Kabupaten Lampung Timur ──────────────────────────
            [
                'id' => '11111111-1111-4111-8111-666666666661',
                'regency' => 'Lampung Timur',
                'district' => 'Labuhan Maringgai',
                'village' => 'Labuhan Maringgai',
                'geometry' => 'MULTIPOLYGON(((105.840 -5.270,105.880 -5.270,105.880 -5.240,105.840 -5.240,105.840 -5.270)))',
                'population' => 6100,
            ],
            [
                'id' => '11111111-1111-4111-8111-666666666662',
                'regency' => 'Lampung Timur',
                'district' => 'Pasir Sakti',
                'village' => 'Pasir Sakti',
                'geometry' => 'MULTIPOLYGON(((105.850 -5.310,105.890 -5.310,105.890 -5.280,105.850 -5.280,105.850 -5.310)))',
                'population' => 4200,
            ],

            // ── Kabupaten Mesuji (pesisir timur) ─────────────────
            [
                'id' => '11111111-1111-4111-8111-777777777771',
                'regency' => 'Mesuji',
                'district' => 'Mesuji Timur',
                'village' => 'Sungai Sidang',
                'geometry' => 'MULTIPOLYGON(((105.800 -3.850,105.840 -3.850,105.840 -3.820,105.800 -3.820,105.800 -3.850)))',
                'population' => 2400,
            ],
        ];
    }

    // ── Users ──────────────────────────────────────────────────────

    private function seedUsers(): void
    {
        $users = [
            [
                'id' => '22222222-2222-4222-8222-222222222222',
                'name' => 'Warga Mode Awam',
                'email' => 'warga@siperah.local',
                'password_hash' => Hash::make('password'),
                'phone_number' => '080000000000',
                'role' => 'warga',
                'region_id' => '11111111-1111-4111-8111-111111111111',
                'status' => 'aktif',
            ],
            [
                'id' => '22222222-2222-4222-8222-aaaaaaaaaaaa',
                'name' => 'Admin Sistem',
                'email' => 'admin@siperah.local',
                'password_hash' => Hash::make('password'),
                'phone_number' => '081111111111',
                'role' => 'admin',
                'region_id' => null,
                'status' => 'aktif',
            ],
            [
                'id' => '22222222-2222-4222-8222-bbbbbbbbbbbb',
                'name' => 'Operator BPBD Bandar Lampung',
                'email' => 'operator@siperah.local',
                'password_hash' => Hash::make('password'),
                'phone_number' => '082222222222',
                'role' => 'bpbd_operator',
                'region_id' => '11111111-1111-4111-8111-111111111111',
                'status' => 'aktif',
                'institution' => 'BPBD Kota Bandar Lampung',
            ],
            [
                'id' => '22222222-2222-4222-8222-cccccccccccc',
                'name' => 'Kepala BPBD Provinsi Lampung',
                'email' => 'provinsi@siperah.local',
                'password_hash' => Hash::make('password'),
                'phone_number' => '083333333333',
                'role' => 'bpbd_provinsi',
                'region_id' => null,
                'status' => 'aktif',
                'institution' => 'BPBD Provinsi Lampung',
            ],
            [
                'id' => '22222222-2222-4222-8222-dddddddddddd',
                'name' => 'Dr. Peneliti Unila',
                'email' => 'peneliti@siperah.local',
                'password_hash' => Hash::make('password'),
                'phone_number' => '084444444444',
                'role' => 'peneliti',
                'region_id' => null,
                'status' => 'aktif',
                'institution' => 'Universitas Lampung',
            ],
        ];

        foreach ($users as $u) {
            DB::table('users')->updateOrInsert(
                ['id' => $u['id']],
                array_merge($u, ['created_at' => now(), 'updated_at' => now()]),
            );
        }
    }

    // ── Predictions ────────────────────────────────────────────────

    private function seedPredictions(): void
    {
        $regions = $this->regionData();
        $riskLevels = [
            ['class' => 'sangat_tinggi', 'prob_min' => 70, 'prob_max' => 95, 'height_min' => 1.2, 'height_max' => 2.1],
            ['class' => 'tinggi',        'prob_min' => 50, 'prob_max' => 75, 'height_min' => 0.8, 'height_max' => 1.4],
            ['class' => 'sedang',        'prob_min' => 25, 'prob_max' => 55, 'height_min' => 0.4, 'height_max' => 0.9],
            ['class' => 'rendah',        'prob_min' => 5,  'prob_max' => 30, 'height_min' => 0.1, 'height_max' => 0.5],
        ];

        $today = Carbon::today();

        foreach ($regions as $i => $region) {
            // Assign risk level in a rotating pattern to get variety
            $level = $riskLevels[$i % count($riskLevels)];

            for ($day = 0; $day < 7; $day++) {
                $date = $today->copy()->addDays($day);
                $prob = round(mt_rand($level['prob_min'] * 100, $level['prob_max'] * 100) / 100, 2);
                $height = round(mt_rand((int)($level['height_min'] * 100), (int)($level['height_max'] * 100)) / 100, 2);
                $confidence = round(mt_rand(7500, 9500) / 100, 2);
                $peakHour = mt_rand(0, 23);
                $peakMinute = mt_rand(0, 59);

                DB::statement(
                    "INSERT INTO predictions (id, region_id, prediction_date, risk_probability, risk_class, confidence_score, max_tidal_height, peak_time, model_version, generated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RF-v1.2.0', now())
                    ON CONFLICT (region_id, prediction_date) DO UPDATE SET
                        risk_probability = EXCLUDED.risk_probability,
                        risk_class = EXCLUDED.risk_class,
                        confidence_score = EXCLUDED.confidence_score,
                        max_tidal_height = EXCLUDED.max_tidal_height,
                        peak_time = EXCLUDED.peak_time,
                        generated_at = now()",
                    [
                        (string) Str::uuid(),
                        $region['id'],
                        $date->format('Y-m-d'),
                        $prob,
                        $level['class'],
                        $confidence,
                        $height,
                        sprintf('%02d:%02d:00', $peakHour, $peakMinute),
                    ],
                );
            }
        }
    }

    // ── Reports ────────────────────────────────────────────────────

    private function seedReports(): void
    {
        $reports = [
            [
                'id' => '33333333-3333-4333-8333-333333333882',
                'code' => 'GT-LPG-882',
                'region_id' => '11111111-1111-4111-8111-111111111111',
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
                'region_id' => '11111111-1111-4111-8111-111111111112',
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
                'region_id' => '11111111-1111-4111-8111-111111111113',
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
            [
                'id' => '33333333-3333-4333-8333-333333333878',
                'code' => 'GT-LPG-878',
                'region_id' => '11111111-1111-4111-8111-111111111116',
                'latitude' => -5.441200,
                'longitude' => 105.246800,
                'severity' => 'parah',
                'status' => 'divalidasi',
                'water_height_cm' => 45,
                'incident_time' => '2026-07-08 22:15:00+07',
                'created_at' => now()->subHours(2),
                'description' => 'Banjir rob masuk ke Pulau Pasaran, aktivitas nelayan terganggu. Air menggenangi area penjemuran ikan.',
                'photos' => [
                    ['id' => '44444444-4444-4444-8444-333333333781', 'name' => 'Pulau Pasaran'],
                ],
            ],
            [
                'id' => '33333333-3333-4333-8333-333333333877',
                'code' => 'GT-PSW-877',
                'region_id' => '11111111-1111-4111-8111-222222222221',
                'latitude' => -5.512000,
                'longitude' => 105.198000,
                'severity' => 'ringan',
                'status' => 'divalidasi',
                'water_height_cm' => 8,
                'incident_time' => '2026-07-08 21:00:00+07',
                'created_at' => now()->subHours(3),
                'description' => 'Sedikit genangan di area tambak udang dekat pantai Hanura. Belum mengganggu aktivitas.',
                'photos' => [],
            ],
        ];

        $userId = '22222222-2222-4222-8222-222222222222';
        $validatorId = '22222222-2222-4222-8222-bbbbbbbbbbbb';

        foreach ($reports as $r) {
            DB::statement(
                "INSERT INTO ground_truth_reports (
                    id, report_code, user_id, region_id, latitude, longitude, severity,
                    water_height_cm, incident_time, description, status,
                    validated_by, validated_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    validated_by = EXCLUDED.validated_by,
                    validated_at = EXCLUDED.validated_at,
                    updated_at = now()",
                [
                    $r['id'], $r['code'], $userId, $r['region_id'],
                    $r['latitude'], $r['longitude'], $r['severity'],
                    $r['water_height_cm'], $r['incident_time'], $r['description'],
                    $r['status'],
                    $r['status'] === 'divalidasi' ? $validatorId : null,
                    $r['status'] === 'divalidasi' ? now()->subMinutes(30) : null,
                    $r['created_at'],
                ],
            );

            foreach ($r['photos'] as $photo) {
                DB::table('report_photos')->updateOrInsert(
                    ['id' => $photo['id']],
                    [
                        'report_id' => $r['id'],
                        'file_url' => 'seed/' . $photo['name'] . '.jpg',
                        'file_name' => $photo['name'],
                        'file_size' => 180000,
                        'mime_type' => 'image/jpeg',
                        'uploaded_at' => now(),
                    ],
                );
            }
        }
    }

    // ── Datasets ───────────────────────────────────────────────────

    private function seedDatasets(): void
    {
        $datasets = [
            [
                'id' => '55555555-5555-4555-8555-555555555551',
                'name' => 'Data Historis Pasang Surut Teluk Lampung (2020-2025)',
                'description' => 'Dataset rekaman tinggi muka air laut per jam dari stasiun pengamatan BMKG Panjang, Teluk Lampung.',
                'dataset_type' => 'Tidal Height Timeseries',
                'period_start' => '2020-01-01',
                'period_end' => '2025-12-31',
                'resolution' => 'Hourly',
                'record_count' => 52560,
                'license' => 'Open Database License (ODbL)',
                'csv_url' => '/api/v1/tidal?format=csv',
                'json_url' => '/api/v1/tidal?format=json',
                'visibility' => 'peneliti',
            ],
            [
                'id' => '55555555-5555-4555-8555-555555555552',
                'name' => 'Ground Truth Validasi Banjir Rob Lampung (2026)',
                'description' => 'Kumpulan laporan verifikasi banjir rob oleh warga dan petugas kebencanaan yang telah divalidasi.',
                'dataset_type' => 'Geospatial Ground Truth',
                'period_start' => '2026-01-01',
                'period_end' => '2026-07-10',
                'resolution' => 'Event-based',
                'record_count' => 1204,
                'license' => 'Creative Commons Attribution (CC BY 4.0)',
                'csv_url' => '/api/v1/reports?format=csv',
                'json_url' => '/api/v1/reports?format=json',
                'visibility' => 'peneliti',
            ],
            [
                'id' => '55555555-5555-4555-8555-555555555553',
                'name' => 'Prediksi Harian Risiko Rob Model RF v1.2.0',
                'description' => 'Output harian model Random Forest untuk klasifikasi risiko banjir rob per kelurahan pesisir.',
                'dataset_type' => 'Daily Risk Predictions',
                'period_start' => '2026-01-01',
                'period_end' => '2026-07-10',
                'resolution' => 'Daily',
                'record_count' => 38430,
                'license' => 'Creative Commons Attribution (CC BY 4.0)',
                'csv_url' => '/api/v1/predictions/daily?format=csv',
                'json_url' => '/api/v1/predictions/daily?format=json',
                'visibility' => 'peneliti',
            ],
        ];

        foreach ($datasets as $ds) {
            DB::table('datasets')->updateOrInsert(
                ['id' => $ds['id']],
                $ds,
            );
        }
    }
}
