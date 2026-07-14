# Dokumen Perencanaan Pembuatan Model ML Prediksi Banjir Rob Lampung
## Pendekatan Algoritma Random Forest

---

## 1. Komponen Data Utama & Karakter Prediktabilitas

Model ini didasarkan pada dua komponen data utama yang memiliki karakteristik prediktabilitas yang berbeda signifikan. Pemahaman terhadap kedua komponen ini sangat krusial dalam menentukan strategi pemodelan jangka pendek dan panjang.

| Komponen Data | Prediksi 30 Hari Ke Depan? | Karakteristik & Konsekuensi |
| :--- | :---: | :--- |
| **Pasang Surut (*Tide*)** | **✅ Bisa (Sangat Akurat)** | Mengikuti pergerakan bulan dan matahari yang bersifat deterministik. Pihak berwenang seperti Pushidrosal/BIG bahkan dapat merilis tabel pasang surut secara akurat hingga 1 tahun penuh ke depan. |
| **Curah Hujan (*Rainfall*)** | **❌ Tidak Bisa Akurat** | Prakiraan cuaca harian yang *reliable* umumnya hanya efektif untuk 7–10 hari ke depan. Di atas rentang tersebut, hanya tersedia prakiraan musiman/klimatologi (kecenderungan umum, bukan angka harian presisi). |

### ⚠️ Konsekuensi Pemodelan:
Jika kita memaksakan model harian presisi untuk target 30 hari ke depan, komponen curah hujannya akan menjadi tebakan kasar (derau/*noise*), sehingga akurasi prediksi rob akan menurun drastis setelah melewati hari ke-10 (H+10).

### 💡 Solusi Realistis: Sistem 2 Tingkat (*Two-Tier System*)
1. **H+1 s/d H+7 (Short-term Outlook):** Prediksi harian presisi menggunakan kombinasi data *tide* aktual dan prakiraan cuaca harian dari BMKG.
2. **H+8 s/d H+30 (Long-term Outlook):** Bukan berupa prediksi harian presisi, melainkan pemetaan tingkat risiko (**Rendah / Sedang / Tinggi**) berbasis data *tide* (akurat) ditambah rata-rata curah hujan musiman (klimatologi), bukan cuaca harian.

---

## 2. Definisi Masalah & Tujuan

* **Tujuan Utama:** Membangun model klasifikasi (atau regresi) untuk memprediksi terjadinya bencana banjir rob di wilayah pesisir Provinsi Lampung (contoh fokus area: Bandar Lampung, Panjang, Teluk Betung, Bakauheni) berdasarkan variabel cuaca, pasang surut air laut, dan kondisi geografis setempat.
* **Pilihan Tipe Output Model:**
    * *Klasifikasi Biner:* Rob / Tidak Rob (0/1) &rarr; **Direkomendasikan sebagai tahap awal** karena lebih mudah dievaluasi dan sangat cocok diintegrasikan dengan *Early Warning System* (EWS).
    * *Klasifikasi Multi-kelas:* Tidak Rob / Rob Ringan / Rob Sedang / Rob Parah.
    * *Regresi:* Memprediksi ketinggian genangan air secara spesifik (dalam satuan cm).
* **Rekomendasi Awal:** Mulai dari pendekatan klasifikasi biner terlebih dahulu. Skema dapat dikembangkan ke multi-kelas atau regresi setelah data historis yang terkumpul memiliki detail dan kualitas yang mencukupi.

---

## 3. Variabel / Fitur yang Dibutuhkan

| Kategori | Variabel / Fitur | Sumber Data Potensial |
| :--- | :--- | :--- |
| **Pasang Surut** | Tinggi pasang, fase bulan (purnama/perbani), prediksi *tide* harian | Pushidrosal, BIG (Badan Informasi Geospasial), DISHIDROS TNI AL |
| **Cuaca** | Curah hujan harian/jam, kecepatan & arah angin, tekanan udara | BMKG (Data historis open-data & API cuaca) |
| **Topografi / Geografi** | Elevasi lahan, jarak ke garis pantai, kemiringan lereng (*slope*) | DEMNAS (BIG), Google Earth Engine (GEE) |
| **Klimatologi Laut** | Tinggi gelombang signifikan, kenaikan muka air laut (*sea level rise*) | BMKG Maritim, Copernicus Marine Service |
| **Historis Kejadian** | Catatan kejadian rob sebelumnya (tanggal, lokasi spesifik, tinggi genangan) | BPBD Lampung, berita lokal, laporan masyarakat |
| **Waktu** | Bulan, musim (hujan/kemarau), waktu (siang/malam) | Ekstraksi / turunan dari variabel *timestamp* |

> 📌 **Catatan Penting:** Data pasang surut dan curah hujan merupakan fitur paling krusial (*core features*) karena fenomena rob umumnya dipicu oleh kombinasi pasang air laut tinggi, curah hujan lokal yang tinggi, serta diperparah oleh fenomena penurunan tanah (*land subsidence*) di area pesisir.

---

## 4. Tahapan Pengumpulan Data

1. **BMKG:** Mengunduh data curah hujan dan parameter cuaca harian dari stasiun cuaca terdekat dengan area kajian (misal: Stasiun Meteorologi Radin Inten II atau Stasiun Meteorologi Maritim Panjang).
2. **Pushidrosal / BIG:** Mengamankan data prediksi pasang surut tahunan untuk wilayah Teluk Lampung.
3. **DEMNAS (demnas.big.go.id):** Mengunduh data elevasi digital (resolusi tinggi) untuk mengekstrak fitur ketinggian tanah pada area rawan.
4. **BPBD Provinsi Lampung:** Mengajukan permohonan data historis bencana banjir rob dalam bentuk laporan tahunan atau rekapitulasi kejadian.
5. **Survei Lapangan Tambahan (Opsional):** Melakukan wawancara dengan warga lokal di kawasan pesisir untuk validasi tanggal dan lokasi kejadian rob yang luput dari pencatatan resmi pemerintah.
6. **Alternatif Pendekatan (Proxy Labeling):** Jika data historis dari BPBD sangat terbatas, kita dapat menggunakan pendekatan *proxy labeling*. Banjir rob diasumsikan terjadi (Label = 1) jika tinggi pasang melampaui ambang batas tertentu (misal: > 1.8 – 2.0 meter di atas *Mean Sea Level* / MSL) yang terjadi bersamaan dengan curah hujan tinggi. Batas *threshold* ini wajib dikonsultasikan dan divalidasi oleh ahli dari BPBD/BMKG setempat.

---

## 5. Data Preprocessing

* **Pembersihan Data (*Cleaning*):** Penanganan nilai yang hilang (*missing values*) menggunakan metode interpolasi linear atau *forward/backward fill* yang sesuai untuk data deret waktu (*time-series*).
* **Sinkronisasi Timestamp:** Menyelaraskan referensi waktu antar sumber data yang berbeda (misal: data cuaca per jam disinkronkan dengan data pasang surut per jam, atau diaggregasi menjadi basis harian).
* **Encoding Fitur Kategorikal:** Mengubah fitur non-numerik seperti kategori musim dan fase bulan menjadi representasi numerik menggunakan *One-Hot Encoding* atau *Ordinal Encoding*.
* **Normalisasi / Scaling:** Meskipun algoritma Random Forest berbasis pohon keputusan (*tree-based*) tidak sensitif terhadap skala fitur, langkah *scaling* (seperti MinMaxScaler atau StandardScaler) tetap baik dilakukan demi konsistensi data.
* **Balancing Dataset:** Mengingat kejadian banjir rob umumnya jauh lebih sedikit (langka) dibandingkan hari-hari normal (*class imbalance*), terapkan teknik penyeimbangan data seperti **SMOTE** (*Synthetic Minority Over-sampling Technique*) atau mengatur parameter pohon lewat `class_weight='balanced'`.

---

## 6. Feature Engineering

Untuk meningkatkan sensitivitas model, buat beberapa fitur turunan berikut:
* **Rolling Average Curah Hujan:** Menghitung akumulasi atau rata-rata bergerak curah hujan selama 3–7 hari terakhir untuk menangkap efek kumulatif kejenuhan air tanah.
* **Anomali Pasang Surut:** Menghitung selisih (deviasi) antara tinggi pasang aktual dengan rata-rata bulanan historisnya.
* **Interaksi Fitur (*Interaction Features*):** Membuat fitur perkalian langsung antara dua variabel kunci, contohnya: `Tinggi Pasang * Curah Hujan Harian`.
* **Proksimitas Hidrologis:** Menghitung jarak spasial lokasi target terhadap muara sungai terdekat, karena luapan sungai sering kali memperparah dampak rob (banjir rob kongestif).

---

## 7. Pengembangan Model Random Forest

### Struktur Eksperimen:
1. **Split Data:** Membagi data menjadi 3 bagian: *Train* (70%), *Validation* (15%), dan *Test* (15%). 
   * ⚠️ **PERINGATAN:** Gunakan pembagian berbasis waktu (*time-based split*) di mana data uji diambil dari periode waktu paling akhir. **JANGAN gunakan *random split*** karena akan menyebabkan kebocoran data (*data leakage*) pada karakteristik *time-series*.
2. **Model Baseline:** Membangun performa awal menggunakan parameter *default* dari kelas `RandomForestClassifier`.
3. **Hyperparameter Tuning:** Mencari kombinasi parameter terbaik menggunakan `GridSearchCV` atau `RandomizedSearchCV` dengan batasan ruang pencarian:
   * `n_estimators`: [100, 200, 500]
   * `max_depth`: [5, 10, 20, None]
   * `min_samples_split`: [2, 5, 10]
   * `min_samples_leaf`: [1, 2, 4]
   * `class_weight`: ['balanced', 'balanced_subsample']
4. **Validasi Silang (*Cross-Validation*):** Wajib menggunakan skema `TimeSeriesSplit` dari scikit-learn untuk memastikan evaluasi model menghormati urutan kronologis waktu, bukan *k-fold cross-validation* konvensional.

**Library Utama yang Digunakan:** `scikit-learn` (`RandomForestClassifier`), `pandas`, `numpy`, dan `imbalanced-learn` (untuk penanganan SMOTE).

---

## 8. Evaluasi Model

Karena dataset memiliki kecenderungan ketidakseimbangan kelas (*imbalanced data*), metrik akurasi (*Accuracy*) akan menjadi bias dan tidak boleh dijadikan acuan tunggal. Gunakan metrik berikut:
* **Precision, Recall, & F1-Score:** Fokus utama ditekankan pada nilai **Recall pada kelas "Rob"**. Dalam konteks mitigasi bencana, *False Alarm* (salah menduga rob padahal tidak terjadi) jauh lebih aman ditoleransi daripada *False Negative* (gagal mendeteksi kejadian banjir rob yang berakibat fatal).
* **Confusion Matrix:** Untuk melihat pemetaan detail klasifikasi benar dan salah.
* **ROC-AUC & Precision-Recall AUC (PR-AUC):** PR-AUC sangat disarankan sebagai indikator kualitas model pada kasus data kelas minoritas yang ekstrem.
* **Feature Importance:** Memanfaatkan fitur bawaan Random Forest (*Gini Importance* / *Permutation Importance*) untuk menginterpretasikan variabel mana yang paling berpengaruh secara signifikan terhadap terjadinya rob di Lampung.

---

## 9. Estimasi Timeline Project

| Minggu | Aktivitas Utama | Output / Deliverables |
| :---: | :--- | :--- |
| **Minggu 1** | Pengumpulan data dari berbagai instansi (BMKG, BIG, BPBD) dan eksplorasi data awal (*Exploratory Data Analysis* - EDA). | Dataset mentah terkumpul, laporan visualisasi korelasi awal. |
| **Minggu 2** | Pembersihan data (*data cleaning*), sinkronisasi data lintas instansi, dan *feature engineering*. | Dataset final yang siap ditranslasikan ke dalam matriks algoritma ML. |
| **Minggu 3** | Pembuatan model *baseline*, penanganan *class imbalance*, ekskusi *hyperparameter tuning*, dan pengujian performa validasi. | Log eksperimen model beserta skor metrik evaluasi sementara. |
| **Minggu 4** | Evaluasi komparatif akhir pada data *test*, interpretasi fitur penting (*feature importance*), dan penyusunan laporan teknis. | Dokumen laporan performa model final beserta rekomendasi *threshold*. |
| **Minggu 5** | *(Opsional - Tahap Lanjutan)* Deployment model ke dalam bentuk API dan perancangan *dashboard monitoring*. | API siap pakai dan purwarupa *dashboard early warning system*. |

---

## 10. Risiko & Tantangan yang Perlu Diantisipasi

1. **Keterbatasan Data Historis:** Catatan dari BPBD berisiko tidak terstruktur atau memiliki banyak kekosongan data.
   * *Mitigasi:* Mengoptimalkan strategi *Proxy Labeling* yang dikombinasikan dengan validasi data berita lokal.
2. **Resolusi Spasial Pasang Surut:** Data pasang surut dari stasiun utama mungkin bersifat makro (tidak mencakup dinamika mikro per titik pantai).
   * *Mitigasi:* Menerapkan pendekatan interpolasi spasial sederhana atau menambahkan variabel topografi lokal (DEMNAS) sebagai pembeda elevasi antar titik.
3. **Ketidakseimbangan Kelas (*Class Imbalance*):** Hari terjadinya rob jauh lebih sedikit dibading hari normal, membuat model rentan condong menebak "Tidak Rob".
   * *Mitigasi:* Pengetatan evaluasi pada *Recall* dan implementasi teknik *resampling* (SMOTE/undersampling) secara bijak pada data training saja.
4. **Dampak Perubahan Iklim (*Climate Change*):** Tren kenaikan muka air laut global dapat menggeser validitas pola historis masa lalu terhadap kondisi masa kini dan masa depan.
   * *Mitigasi:* Merancang sistem agar model dapat di-update/retrain secara berkala (misal setiap 6 atau 12 bulan sekali) dengan memasukkan data paling mutakhir.
