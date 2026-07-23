# Penjelasan Prediksi Machine Learning SIPERAH-RoB

Dokumen ini menjelaskan secara teknis bagaimana model Machine Learning (ML) bekerja dalam memprediksi risiko banjir rob di pesisir Provinsi Lampung, serta integrasinya ke dalam sistem **SIPERAH-RoB**.

---

## 1. Ikhtisar Model (Model Overview)
Model prediksi utama yang digunakan dalam SIPERAH-RoB berpusat pada **Random Forest Classifier (v1.2.0)**. Model ini bertugas untuk memberikan *daily forecast* (prakiraan harian) ancaman banjir rob pada level kelurahan (region) hingga 7 hari ke depan.

- **Tipe Model:** Classification (Supervised Learning)
- **Algoritma:** Random Forest Ensembles (menggunakan Scikit-Learn/XGBoost)
- **Granularitas Prediksi:** Per hari (Daily), Per wilayah pesisir (Kelurahan)
- **Output:** `risk_class` (Rendah, Sedang, Tinggi, Sangat Tinggi) beserta `risk_probability` (Probabilitas numerik 0-100%).

---

## 2. Sumber Data & Parameter Perhitungan (Features)
Untuk menghasilkan sebuah prediksi, model membutuhkan asupan data (features) dari berbagai dimensi. SIPERAH-RoB menggunakan fitur-fitur berikut:

### a. Data Astronomis & Oseanografi (Pasang Surut)
Ini adalah prediktor paling signifikan (feature importance > 60%):
- `max_tidal_height` (cm): Proyeksi pasang tertinggi harian dari data BMKG / Tabel Pasang Surut Hidrosal.
- `sea_level_anomaly` (cm): Anomali tinggi muka air laut rata-rata (jika tersedia).
- `moon_phase`: Siklus fase bulan (purnama/bulan baru) yang memicu *spring tide*. Dihitung dari tanggal Masehi dan kalender lunar.

### b. Data Meteorologi & Cuaca
Kondisi cuaca memengaruhi seberapa parah air pasang didorong ke daratan (*storm surge*):
- `wind_speed` (knot/km/h): Kecepatan angin yang tertiup ke arah pantai (Onshore winds).
- `precipitation` (mm): Intensitas curah hujan, karena hujan ekstrem bersamaan dengan pasang tinggi akan menyebabkan *compound flooding*.
- `air_pressure` (hPa): Tekanan udara rendah cenderung menaikkan muka air laut.

### c. Data Topografi Wilayah (Statis)
Setiap wilayah pesisir di Lampung memiliki profil geografis yang menentukan kerentanan spesifik:
- `coastal_elevation` (m): Elevasi rata-rata wilayah terhadap permukaan laut (MDPL).
- `distance_from_shore` (km): Kedekatan permukemen dengan garis pantai.

---

## 3. Proses Inference (Bagaimana Model Berjalan)

Setiap hari pada pukul `01:00 WIB` atau `05:00 WIB`, *cron scheduler* akan menjalankan perintah sinkronisasi ML:

1. **Pengumpulan Data Baru:** Backend menarik prakiraan cuaca 7 hari ke depan (dari API BMKG) dan merangkai data pasang surut untuk semua stasiun acuan (seperti Pelabuhan Panjang).
2. **Feature Engineering:** Sistem menghitung probabilitas hujan, titik tertinggi pasang, angin, lalu memetakannya ke masing-masing kelurahan berdasarkan koordinat batas wilayah (BIG).
3. **Inference (API ML):** Data dalam bentuk matriks fitur (JSON/CSV) dikirim ke *Microservice ML* (Python API).
4. **Scoring:** Model ML mengevaluasi *features* dan mengembalikan nilai:
   - `probability` (0 - 1.0)
   - `confidence_score` (Tingkat keyakinan prediksi)
5. **Penyimpanan:** Hasil perhitungan ditulis ke dalam database SIPERAH-RoB pada tabel `predictions`.

---

## 4. Output dan Pengklasifikasian (Risk Classes)
Sistem mengubah angka numerik prediksi menjadi 4 tingkat bahaya yang dapat dipahami masyarakat dan operator:

| Kelas Risiko (`risk_class`) | Warna Peta | Rentang Kemungkinan | Aksi BPBD / Masyarakat |
|---|---|---|---|
| **Rendah** (Ringan) | Hijau | 0% - 20% | Tidak ada ancaman banjir rob. |
| **Sedang** | Kuning | 21% - 50% | Genangan <10cm, genangan minor di jalan. |
| **Tinggi** (Parah) | Oranye | 51% - 80% | Genangan 10-30cm, masuk pelataran rumah. **Siaga.** |
| **Sangat Tinggi** | Merah | 81% - 100%| Genangan >30cm, melumpuhkan pesisir. **Prioritas Evakuasi.**|

---

## 5. Continuous Learning (Timbal Balik Data)

Hal terpenting dari SIPERAH-RoB adalah **Validasi Ground Truth**. 

Setiap kali operator BPBD memvalidasi laporan warga di menu *Validasi Laporan*, data laporan warga (tinggi air, keparahan, foto lapangan) secara otomatis direkam ke dataset **"Geospatial Ground Truth"**. 

Pada akhir tahun/bulan, peneliti atau *Data Scientist* dapat men-download dataset *Ground Truth* ini beserta dataset pasang surut historis, kemudian membandingkannya dengan output model lama. Dengan data ini, model Random Forest secara periodik di-**retrain** agar bobot cuaca, topografi, dan pasang surut semakin relevan (drift mitigation) dengan perubahan kondisi alam terbaru di Provinsi Lampung.
