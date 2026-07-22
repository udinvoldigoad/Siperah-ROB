# Entity-Relationship Diagram (ERD) - SIPERAH-RoB

Dokumen ini mendokumentasikan skema database relasional **SIPERAH-RoB** menggunakan diagram Mermaid.

---

## 1. Diagram ERD (Mermaid Format)

```mermaid
erDiagram
    users {
        uuid id PK
        varchar name
        varchar email UK
        varchar password_hash
        varchar phone_number
        user_role role
        varchar institution
        uuid region_id FK
        user_status status
        timestamptz last_login_at
        timestamptz created_at
        timestamptz updated_at
    }

    regions {
        uuid id PK
        varchar province
        varchar regency
        varchar district
        varchar village
        geometry geometry
        integer population
        boolean coastal_flag
        numeric distance_to_coast_m
        numeric avg_elevation_m
        timestamptz created_at
        timestamptz updated_at
    }

    predictions {
        uuid id PK
        uuid region_id FK
        date prediction_date
        numeric risk_probability
        risk_class risk_class
        numeric confidence_score
        numeric max_tidal_height
        time peak_time
        varchar model_version
        timestamptz generated_at
    }

    ground_truth_reports {
        uuid id PK
        varchar report_code UK
        uuid user_id FK
        uuid region_id FK
        timestamptz reported_at
        geometry location
        integer water_height_cm
        report_severity severity
        text description
        report_status status
        uuid validator_id FK
        timestamptz validated_at
        text rejection_reason
        boolean is_within_monitoring_area
        timestamptz created_at
        timestamptz updated_at
    }

    report_photos {
        uuid id PK
        uuid report_id FK
        varchar photo_path
        timestamptz created_at
    }

    tidal_data {
        uuid id PK
        uuid station_id FK
        varchar station_name
        varchar station_code
        timestamptz recorded_at
        numeric tidal_height
        varchar unit
        varchar source
        varchar provenance_status
    }

    api_keys {
        uuid id PK
        uuid user_id FK
        varchar key_hash UK
        varchar key_preview
        varchar name
        jsonb scopes
        integer use_count
        timestamptz last_used_at
        timestamptz expires_at
        timestamptz created_at
        timestamptz updated_at
    }

    audit_logs {
        uuid id PK
        uuid user_id FK
        varchar action
        varchar target_type
        varchar target_id
        jsonb payload
        audit_outcome outcome
        varchar ip_address
        varchar user_agent
        timestamptz created_at
    }

    regions ||--o{ users : "mempunyai operator"
    regions ||--o{ predictions : "mempunyai prediksi"
    regions ||--o{ ground_truth_reports : "lokasi laporan"
    users ||--o{ ground_truth_reports : "dilaporkan_oleh"
    users ||--o{ ground_truth_reports : "divalidasi_oleh"
    ground_truth_reports ||--o{ report_photos : "memiliki foto"
    users ||--o{ api_keys : "memiliki"
    users ||--o{ audit_logs : "melakukan tindakan"
```

---

## 2. Deskripsi Hubungan Utama
1. **Hubungan Wilayah & Pengguna (`regions` -> `users`)**: Relasi satu-ke-banyak (*one-to-many*) opsional. Digunakan untuk membatasi wilayah kerja operator BPBD kabupaten/kota (`region_id`).
2. **Hubungan Wilayah & Prediksi (`regions` -> `predictions`)**: Relasi satu-ke-banyak (*one-to-many*) wajib. Setiap kelurahan pesisir memiliki baris prediksi harian yang dihitung oleh pipeline Machine Learning untuk 30 hari ke depan.
3. **Hubungan Laporan Ground Truth (`ground_truth_reports`)**: 
   * Terikat ke `users` sebagai pelapor.
   * Terikat ke `regions` sebagai kelurahan terasosiasi (ditentukan secara otomatis secara spasial melalui `ST_Contains` koordinat geospasial).
   * Terikat kembali ke `users` (sebagai `validator_id`) saat operator melakukan verifikasi.
4. **Foto Laporan (`report_photos`)**: Menyimpan berkas bukti fisik kejadian rob (WebP terkompresi) yang terikat langsung ke laporan.
