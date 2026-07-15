# Penjelasan Algoritma Machine Learning SIPERAH-RoB

Sistem Informasi Prediksi Risiko Banjir Rob Terpadu (SIPERAH-RoB) menggunakan pendekatan *Machine Learning* untuk memprediksi tingkat ancaman dan peluang terjadinya banjir pesisir (rob) di Provinsi Lampung. Pendekatan ini secara signifikan lebih akurat daripada sekadar melihat tabel pasang surut astronomis biasa.

Berikut adalah alur lengkap bagaimana AI (Machine Learning) kita melakukan perhitungan:

## 1. Pengumpulan Data (Data Fetching)
Model AI kita tidak bekerja dengan asumsi kosong. AI dilatih menggunakan **data historis selama 10 tahun terakhir (sejak 2015)** yang mencakup:
*   **Data Cuaca Historis (ERA5 Open-Meteo)**: Curah hujan harian (mm), arah angin dominan, kecepatan angin maksimal (m/s), dan tekanan udara rata-rata (hPa).
*   **Data Gelombang Historis (Marine API)**: Ketinggian gelombang laut maksimal (meter) dan ketinggian *swell* (alun) maksimal.
*   **Data Harmonik Pasang Surut**: Dihitung secara matematis menggunakan offset datum dan rata-rata tinggi pasang air laut di masing-masing pesisir.

## 2. Rekayasa Fitur (Feature Engineering)
Data mentah di atas belum cukup pintar untuk dipelajari oleh model. Algoritma melakukan *feature engineering* untuk mensimulasikan kondisi lingkungan pesisir:
*   **Akumulasi Curah Hujan**: Model menghitung rata-rata curah hujan selama 3 hari, 7 hari, dan 14 hari ke belakang. Tanah yang sudah jenuh air akibat hujan berhari-hari (meski hujannya tidak lebat) akan memperparah banjir rob.
*   **Interaksi Fenomena Alam**: 
    *   `tide_x_rainfall`: Pasang tinggi yang bertemu hujan lebat.
    *   `rain_x_wind`: Badai hujan yang diiringi angin kencang.
    *   `tide_x_wave`: Pasang tinggi yang diperparah ombak besar (*storm surge*).
*   **Indikator Siklus Waktu**: Menandai apakah sedang terjadi bulan purnama (*Full Moon*), musim hujan (*Wet Season*), atau *King Tide* (pasang maksimum yang menembus batas persentil ke-95).

## 3. Penentuan Label Bencana (Proxy Labeling & Ground Truth)
Karena catatan historis valid BPBD tentang banjir rob di masa lalu tidak selalu lengkap setiap hari, sistem menggunakan pendekatan **Proxy Labeling** yang divalidasi dengan data nyata (*Ground Truth*).
*   **Proxy Rules**: Secara otomatis memberi label "Banjir Rob" pada data masa lalu jika terjadi kombinasi pasang laut ekstrem + curah hujan / gelombang yang melampaui batas kritis (*threshold*).
*   **Citizen Science (Validasi Warga)**: Jika ada laporan dari fitur "Lapor Bencana" warga dan divalidasi oleh BPBD, data tersebut akan memaksa masuk dan menimpa label prediksi menjadi *True Positives*, sehingga model AI akan semakin cerdas di titik pesisir tersebut.

## 4. Pelatihan Model (Training - Random Forest)
*   **SMOTE (Synthetic Minority Over-sampling Technique)**: Karena jumlah hari terjadinya banjir rob (positif) jauh lebih sedikit dibanding hari normal (negatif), model menggunakan SMOTE untuk menyeimbangkan data.
*   **Random Forest Classifier**: Model dilatih (di-*train*) menggunakan algoritma berbasis *decision trees* berjumlah banyak (Hutan Acak) untuk mengklasifikasi apakah akan terjadi rob atau tidak. Algoritma ini dipilih karena sangat andal untuk mendeteksi korelasi non-linear antara iklim, pasang surut, dan banjir.

## 5. Pembuatan Prediksi Harian (Live Forecasting)
Setiap harinya, sistem melakukan *Cron Job* yang menarik **Prakiraan Cuaca 7 Hari ke Depan**. Data 7 hari ini diproses melalui tahapan rekayasa fitur di atas dan disuntikkan ke dalam model *Random Forest* yang sudah terlatih. 

Model menghasilkan angka **Risk Probability** (0% hingga 100%), yang kemudian dikonversi menjadi Kelas Bahaya (Risk Class) untuk UI:
*   🟢 **Rendah**: Peluang < 30%
*   🟡 **Sedang**: Peluang 30% - 50%
*   🟠 **Tinggi**: Peluang 50% - 75%
*   🔴 **Sangat Tinggi / Kritis**: Peluang > 75%

> **Tingkat Akurasi (Confidence Score)**: Merupakan nilai kepercayaan dari model *Random Forest* terhadap prediksinya sendiri. Semakin sering fenomena tersebut dipelajari (misal: cuaca sangat cerah & pasang surut rendah = pasti tidak banjir), maka *confidence score* akan mendekati 100%. Semakin ambigu cuacanya, maka nilai kepercayaan akan menurun, menunjukkan potensi *margin of error*.
