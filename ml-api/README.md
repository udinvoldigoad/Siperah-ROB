# SIPERAH-RoB Machine Learning API

Ini adalah _microservice_ berbasis **Python (FastAPI)** yang bertugas sebagai *Engine* prediksi banjir rob (Sistem AI) untuk proyek SIPERAH-RoB.

## Konsep Arsitektur
Aplikasi utama (React Frontend atau Laravel Backend) dapat melakukan HTTP POST ke API ini untuk meminta perhitungan tren risiko 30 hari ke depan, lalu menampilkannya pada grafik di Dashboard Provinsi.

Saat ini `model.py` berisi algoritma simulasi/dummy (menghasilkan pola ombak melengkung sesuai array). Anda harus menggantinya dengan model *Machine Learning* asli (seperti LSTM atau Random Forest) yang telah ditraining dengan data cuaca BMKG dan BIG.

## Prasyarat
Pastikan Anda sudah menginstal **Python 3.8+**.

## Cara Menjalankan Server

1. Buka terminal/command prompt di dalam folder `ml-api` ini.
2. Sangat disarankan membuat _virtual environment_ (Opsional tapi direkomendasikan):
   ```bash
   python -m venv venv
   source venv/bin/activate  # Untuk Linux/Mac
   venv\Scripts\activate     # Untuk Windows
   ```
3. Instal semua _library_ yang dibutuhkan:
   ```bash
   pip install -r requirements.txt
   ```
4. Jalankan server FastAPI:
   ```bash
   uvicorn main:app --reload
   ```
5. Server akan berjalan di `http://127.0.0.1:8000`.

## Dokumentasi API (Swagger UI)
Setelah server berjalan, Anda dapat melihat dan mencoba endpoint API secara langsung dengan membuka _browser_ di:
👉 **http://127.0.0.1:8000/docs**

## Endpoint Utama
**`POST /api/v1/predict/30-days`**
*Payload (Body JSON):*
```json
{
  "region_id": "lampung",
  "target_days": 30
}
```
*Response JSON:*
```json
{
  "region_id": "lampung",
  "prediction_trend": [8, 11, 15, 21, 26, 33, 49, 44, 42, 33, ...],
  "status": "success"
}
```

## Cara Memasukkan Model ML Sendiri
1. Masukkan file model yang sudah dilatih (misal: `lstm_model.h5` atau `rf_model.pkl`) ke dalam folder ini.
2. Buka `model.py`.
3. Gunakan _library_ yang sesuai (misal `import tensorflow as tf` atau `import joblib`) untuk melakukan *load_model()* di dalam fungsi `__init__`.
4. Ubah logika dalam fungsi `predict_30_days` untuk melakukan `.predict()` pada data input, lalu kembalikan _array list_-nya.
