import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
import joblib

print("Memulai proses training model Machine Learning (Contoh)...")

# 1. BUAT DATASET DUMMY (Di dunia nyata, load dari CSV BMKG/BIG)
# Format ideal: Tanggal, Curah Hujan, Kecepatan Angin, Pasang Laut Historis
dates = pd.date_range(start="2023-01-01", periods=1000, freq='D')
np.random.seed(42)

# Buat pola pasang laut buatan (siklus bulanan/purnama)
pasang_historis = np.sin(np.arange(1000) * (2 * np.pi / 30)) * 20 + 50 
# Tambahkan faktor cuaca acak (hujan & angin)
curah_hujan = np.random.exponential(scale=10, size=1000)
angin = np.random.normal(loc=15, scale=5, size=1000)

# Target Prediksi (Misal: Ketinggian Banjir Rob di pemukiman dalam cm)
# Logika: Jika pasang tinggi + hujan tinggi + angin kencang = banjir rob tinggi
ketinggian_rob = (pasang_historis * 0.5) + (curah_hujan * 0.3) + (angin * 0.2) + np.random.normal(0, 2, 1000)

df = pd.DataFrame({
    'pasang_laut': pasang_historis,
    'curah_hujan': curah_hujan,
    'kecepatan_angin': angin,
    'target_ketinggian_rob': ketinggian_rob
})

print("Dataset Historis Berhasil Disiapkan. Jumlah Data:", len(df))

# 2. PISAHKAN FITUR (X) DAN TARGET (y)
X = df[['pasang_laut', 'curah_hujan', 'kecepatan_angin']]
y = df['target_ketinggian_rob']

# 3. TRAINING MODEL MACHINE LEARNING (Menggunakan Random Forest sbg contoh)
print("Melatih algoritma Random Forest...")
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X, y)

# 4. UJI PREDIKSI
contoh_data_besok = pd.DataFrame({
    'pasang_laut': [65.0],  # Misal besok pasang maksimum 65cm
    'curah_hujan': [20.0],  # Hujan sedang
    'kecepatan_angin': [18.0] # Angin cukup kencang
})
prediksi_besok = model.predict(contoh_data_besok)
print(f"Prediksi Ketinggian Rob untuk data contoh: {prediksi_besok[0]:.2f} cm")

# 5. SIMPAN MODEL KE DALAM FILE (Export)
# File ini yang nanti akan di-load oleh main.py di FastAPI
model_filename = 'model_rob_rf.pkl'
joblib.dump(model, model_filename)
print(f"Model berhasil disimpan sebagai '{model_filename}'!")
print("Sekarang Anda bisa meload file ini di FastAPI backend Anda.")
