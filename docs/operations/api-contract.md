# Kontrak & Stabilitas API Publik `/api/v1/*`

Dokumen ini menetapkan spesifikasi, janji stabilitas, dan kebijakan penghentian (deprecation) untuk API peneliti eksternal SIPERAH-RoB.

---

## 1. Ikhtisar (Overview)
* **Base Path**: `/api/v1`
* **Format Response**: JSON (dengan header `X-Api-Version: v1`)
* **Autentikasi**: Header `X-API-Key: spr_xxx` atau `Authorization: ApiKey spr_xxx`
* **Rate Limit**: Default 120 permintaan per menit. Header respons: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`.

---

## 2. Referensi Endpoint API Peneliti

### A. Ambil Prediksi Harian (`GET /api/v1/predictions/daily`)
Mengambil data prediksi risiko banjir rob harian untuk wilayah-wilayah pesisir Lampung yang dipantau.
* **Scope Kunci**: `predictions:read`
* **Parameter Query**:
  | Parameter | Tipe | Deskripsi | Default / Contoh |
  | :--- | :--- | :--- | :--- |
  | `date` | `string` | Tanggal prediksi dalam format `Y-m-d`. | Hari ini (`2026-07-22`) |
  | `regency` | `string` | Nama kabupaten/kota untuk filter wilayah (di-normalize). | `bandar_lampung` |
  | `page` | `integer` | Nomor halaman paginasi. | `1` |
  | `per_page` | `integer` | Jumlah rekaman per halaman (maksimal 1000). | `50` |
* **Contoh Respons (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "1a2b3c4d-...",
        "prediction_date": "2026-07-22",
        "region": {
          "id": "969c0d90-...",
          "regency": "Bandar Lampung",
          "district": "Panjang",
          "village": "Panjang Utara"
        },
        "risk_probability": 14.96,
        "risk_class": "Rendah",
        "confidence_score": 0.85,
        "max_tidal_height": 1.117,
        "peak_time": "2026-07-22 07:00:00+00",
        "model_version": "v1.2.0"
      }
    ],
    "meta": {
      "current_page": 1,
      "last_page": 1,
      "per_page": 50,
      "total": 30
    }
  }
  ```

---

### B. Ambil Laporan Ground Truth (`GET /api/v1/reports`)
Mengambil data laporan banjir rob dari warga yang telah divalidasi oleh BPBD.
* **Scope Kunci**: `reports:read`
* **Parameter Query**:
  | Parameter | Tipe | Deskripsi | Contoh |
  | :--- | :--- | :--- | :--- |
  | `regency` | `string` | Filter nama kabupaten/kota kejadian. | `lampung_selatan` |
  | `from_date` | `string` | Batas awal tanggal laporan (`Y-m-d`). | `2026-07-01` |
  | `to_date` | `string` | Batas akhir tanggal laporan (`Y-m-d`). | `2026-07-22` |
* **Contoh Respons (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "5f6g7h8i-...",
        "reported_at": "2026-07-16T12:00:00Z",
        "location": {
          "latitude": -5.451,
          "longitude": 105.262
        },
        "water_height_cm": 25,
        "severity": "Sedang",
        "description": "Air pasang mulai masuk pekarangan rumah warga setinggi mata kaki.",
        "status": "divalidasi",
        "verified_at": "2026-07-16T13:30:00Z"
      }
    ]
  }
  ```
  > [!NOTE]
  > Demi menjaga privasi warga pelapor, koordinat `latitude` dan `longitude` dibulatkan tepat **3 desimal** (sekitar ~110 meter akurasi spasial), serta informasi nama/kontak pelapor tidak pernah diekspos melalui API eksternal.

---

### C. Ambil Data Pasut Historis (`GET /api/v1/tidal`)
Mengambil rekaman data historis tinggi muka air laut per jam dari stasiun pantau.
* **Scope Kunci**: `tidal:read`
* **Parameter Query**:
  | Parameter | Tipe | Deskripsi | Contoh |
  | :--- | :--- | :--- | :--- |
  | `station_code` | `string` | Kode stasiun pasang surut acuan. | `bandar_lampung` |
  | `from_date` | `string` | Batas awal tanggal data (`Y-m-d`). | `2026-07-01` |
  | `to_date` | `string` | Batas akhir tanggal data (`Y-m-d`). | `2026-07-10` |
* **Contoh Respons (200 OK)**:
  ```json
  {
    "data": [
      {
        "station_code": "bandar_lampung",
        "recorded_at": "2026-07-01T00:00:00Z",
        "tidal_height": 0.45,
        "unit": "m",
        "source": "Open-Meteo Marine"
      }
    ]
  }
  ```

---

## 3. Kebijakan Deprecations & Stabilitas Kontrak
1. **Pemberitahuan Deprecations (RFC 8594)**: Apabila endpoint akan dihentikan, respons akan menyertakan header:
   * `Deprecation: true`
   * `Sunset: YYYY-MM-DD` (tanggal penghentian layanan)
2. **Backward Compatibility**: Tidak ada penghapusan bidang (*field*) respons dalam versi kontrak yang sama (`v1`). Penambahan bidang baru bersifat *non-breaking*, dan klien wajib mengabaikan bidang yang tidak dikenal secara aman.
3. **Penanganan Error**: Format respons kesalahan terstandarisasi sebagai berikut:
   ```json
   {
     "data": null,
     "message": "Deskripsi alasan kegagalan / otorisasi ditolak."
   }
   ```
