-- =========================================================
-- SKEMA DATABASE: SISTEM PREDIKSI BANJIR ROB LAMPUNG
-- =========================================================

-- 1. Master lokasi/titik pemantauan
CREATE TABLE locations (
    location_id     SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,       -- ex: 'Pelabuhan Panjang'
    latitude        DECIMAL(9,6) NOT NULL,
    longitude       DECIMAL(9,6) NOT NULL,
    elevation_m     DECIMAL(6,2),                -- dari DEMNAS
    distance_to_coast_m DECIMAL(10,2),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 2. Data pasang surut (harian/per jam), sumber: Pushidrosal/BIG InaTide
CREATE TABLE tide_data (
    tide_id         SERIAL PRIMARY KEY,
    location_id     INT REFERENCES locations(location_id),
    obs_datetime    TIMESTAMP NOT NULL,           -- tanggal + jam observasi/prediksi
    tide_height_cm  DECIMAL(6,2) NOT NULL,         -- tinggi air (cm)
    is_forecast     BOOLEAN DEFAULT FALSE,         -- TRUE jika ini data prediksi tide (bisa jauh ke depan)
    source          VARCHAR(50) DEFAULT 'pushidrosal',
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(location_id, obs_datetime)
);

-- 3. Data cuaca harian (curah hujan, angin, tekanan), sumber: BMKG / NASA POWER
CREATE TABLE weather_data (
    weather_id      SERIAL PRIMARY KEY,
    location_id     INT REFERENCES locations(location_id),
    obs_date        DATE NOT NULL,
    rainfall_mm     DECIMAL(6,2),
    wind_speed_ms   DECIMAL(5,2),
    wind_direction  VARCHAR(10),
    pressure_hpa    DECIMAL(6,2),
    data_type       VARCHAR(20) DEFAULT 'actual',  -- 'actual' | 'forecast' | 'climatology_avg'
    source          VARCHAR(50) DEFAULT 'bmkg',
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(location_id, obs_date, data_type)
);

-- 4. Rata-rata klimatologi bulanan (dipakai untuk outlook H+8 s/d H+30)
CREATE TABLE climatology_monthly (
    clim_id         SERIAL PRIMARY KEY,
    location_id     INT REFERENCES locations(location_id),
    month           SMALLINT CHECK (month BETWEEN 1 AND 12),
    avg_rainfall_mm DECIMAL(6,2),
    avg_wind_speed_ms DECIMAL(5,2),
    UNIQUE(location_id, month)
);

-- 5. Catatan kejadian rob historis (label/ground truth)
CREATE TABLE rob_events (
    event_id        SERIAL PRIMARY KEY,
    location_id     INT REFERENCES locations(location_id),
    event_date      DATE NOT NULL,
    severity        VARCHAR(20),                   -- 'ringan' | 'sedang' | 'parah'
    inundation_cm   DECIMAL(6,2),                   -- tinggi genangan jika ada datanya
    is_proxy_label  BOOLEAN DEFAULT FALSE,           -- TRUE jika label dari threshold, bukan laporan resmi
    data_source     VARCHAR(100),                    -- 'BPBD' | 'laporan warga' | 'proxy_threshold'
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- 6. Tabel gabungan fitur harian (hasil feature engineering, siap untuk training)
CREATE TABLE daily_features (
    feature_id          SERIAL PRIMARY KEY,
    location_id         INT REFERENCES locations(location_id),
    feature_date         DATE NOT NULL,
    max_tide_height_cm   DECIMAL(6,2),
    rainfall_mm          DECIMAL(6,2),
    rainfall_3d_avg       DECIMAL(6,2),              -- rolling avg 3 hari
    rainfall_7d_avg       DECIMAL(6,2),
    wind_speed_ms         DECIMAL(5,2),
    pressure_hpa          DECIMAL(6,2),
    month                 SMALLINT,
    is_full_moon_period    BOOLEAN,
    tide_x_rainfall        DECIMAL(10,2),             -- fitur interaksi
    label_rob              SMALLINT,                  -- 0/1 ground truth (untuk training)
    created_at             TIMESTAMP DEFAULT NOW(),
    UNIQUE(location_id, feature_date)
);

-- 7. Hasil prediksi model (untuk disimpan & ditampilkan ke dashboard)
CREATE TABLE predictions (
    prediction_id       SERIAL PRIMARY KEY,
    location_id          INT REFERENCES locations(location_id),
    predicted_for_date    DATE NOT NULL,
    generated_at           TIMESTAMP DEFAULT NOW(),
    horizon_type           VARCHAR(20) NOT NULL,      -- 'short_term' (H1-H7) | 'long_term_outlook' (H8-H30)
    prob_rob               DECIMAL(5,4),               -- probabilitas 0.0000 - 1.0000
    predicted_label         VARCHAR(20),                -- 'Tidak Rob' | 'Rob' atau 'Rendah/Sedang/Tinggi' utk outlook
    model_version            VARCHAR(30),
    UNIQUE(location_id, predicted_for_date, horizon_type)
);

-- Index untuk query time-series yang sering dipakai
CREATE INDEX idx_tide_location_date ON tide_data(location_id, obs_datetime);
CREATE INDEX idx_weather_location_date ON weather_data(location_id, obs_date);
CREATE INDEX idx_features_location_date ON daily_features(location_id, feature_date);
CREATE INDEX idx_predictions_date ON predictions(predicted_for_date);
