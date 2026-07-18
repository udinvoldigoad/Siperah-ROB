# Kontrak & Stabilitas API Publik `/api/v1/*`

Dokumen ini menetapkan janji stabilitas dan kebijakan penghentian (deprecation)
untuk API peneliti SIPERAH-RoB. Berlaku untuk seluruh endpoint di bawah prefix
`/api/v1`. Referensi teknis (parameter, contoh request/response) disajikan secara
hidup lewat endpoint `GET /api/research/api-reference` dan tab **Referensi API**
di portal peneliti.

## Versi

- Versi kontrak saat ini: **v1**.
- Semua endpoint stabil berada di bawah `/api/v1/...`:
  - `GET /api/v1/predictions/daily` — scope `predictions:read`
  - `GET /api/v1/reports` — scope `reports:read`
  - `GET /api/v1/tidal` — scope `tidal:read`
- Setiap response v1 menyertakan header **`X-Api-Version: v1`**.

## Autentikasi & rate limit

- Header `X-API-Key: spr_xxx` (alternatif `Authorization: ApiKey spr_xxx`).
- Rate limit per API key, configurable via env `API_RATE_LIMIT` (default 120/menit).
  Header respons: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`.

## Janji stabilitas (dalam v1)

1. **Tidak menghapus/mengganti makna** field yang sudah terdokumentasi. Nama dan
   tipe data field yang dipublikasikan tetap.
2. **Penambahan bersifat non-breaking.** Field baru dapat muncul kapan saja;
   klien **wajib mengabaikan field yang tidak dikenal** dan tidak mengandalkan
   urutan field.
3. **Format error konsisten:** `{ "data": null, "message": "<penjelasan>" }`
   dengan kode 401/403/422/429 sesuai dokumentasi referensi.
4. **Privasi:** koordinat laporan ground truth dibulatkan 3 desimal; data pelapor
   (nama, kontak) tidak pernah diekspos di API.

Perubahan yang **melanggar** poin 1–3 dianggap *breaking* dan tidak dilakukan di
v1 — dirilis sebagai versi baru (mis. `/api/v2`).

## Kebijakan deprecation

- Saat sebuah endpoint/versi dijadwalkan dihentikan, respons endpoint tersebut
  mengirim header (RFC 8594):
  - `Deprecation: true`
  - `Sunset: <tanggal>` — tanggal setelah itu endpoint tidak lagi dijamin tersedia.
- Pengumuman juga ditampilkan di portal peneliti sebelum tanggal sunset.
- **v1 tetap dilayani minimal 180 hari** sejak pengumuman penggantian, agar
  integrasi eksternal punya waktu bermigrasi.

## Changelog kontrak

| Tanggal | Perubahan |
|---|---|
| 2026-07-18 | Kontrak v1 difinalkan: base path diseragamkan ke `/api/v1`, ditambah header `X-Api-Version`, deklarasi stabilitas & kebijakan deprecation. |
