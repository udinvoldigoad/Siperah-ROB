"""
train_model.py
Training Random Forest untuk prediksi banjir rob (short-term, H+1 s/d H+7).
Split berbasis waktu (bukan random) karena ini data time-series.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import TimeSeriesSplit, RandomizedSearchCV
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import joblib

FEATURE_COLS = [
    "max_tide_height_cm", "rainfall_mm", "rainfall_3d_avg", "rainfall_7d_avg",
    "wind_speed_ms", "pressure_hpa", "month", "is_full_moon_period", "tide_x_rainfall"
]
TARGET_COL = "label_rob"


def time_based_split(df: pd.DataFrame, test_size: float = 0.15, val_size: float = 0.15):
    """Split data berdasarkan urutan waktu, bukan random -- penting untuk time-series."""
    df = df.sort_values("date").reset_index(drop=True)
    n = len(df)
    test_start = int(n * (1 - test_size))
    val_start = int(n * (1 - test_size - val_size))

    train = df.iloc[:val_start]
    val = df.iloc[val_start:test_start]
    test = df.iloc[test_start:]
    return train, val, test


def train_random_forest(train_df: pd.DataFrame, tune: bool = True) -> RandomForestClassifier:
    X_train = train_df[FEATURE_COLS]
    y_train = train_df[TARGET_COL]

    if not tune:
        model = RandomForestClassifier(
            n_estimators=200, max_depth=10, class_weight="balanced", random_state=42
        )
        model.fit(X_train, y_train)
        return model

    param_dist = {
        "n_estimators": [100, 200, 300, 500],
        "max_depth": [5, 10, 15, 20, None],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf": [1, 2, 4],
    }

    tscv = TimeSeriesSplit(n_splits=5)
    search = RandomizedSearchCV(
        RandomForestClassifier(class_weight="balanced", random_state=42),
        param_distributions=param_dist,
        n_iter=20,
        cv=tscv,
        scoring="f1",
        random_state=42,
        n_jobs=-1,
    )
    search.fit(X_train, y_train)
    print("Best params:", search.best_params_)
    return search.best_estimator_


def evaluate_model(model: RandomForestClassifier, test_df: pd.DataFrame):
    X_test = test_df[FEATURE_COLS]
    y_test = test_df[TARGET_COL]

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    print("=== Classification Report ===")
    print(classification_report(y_test, y_pred, target_names=["Tidak Rob", "Rob"]))

    print("=== Confusion Matrix ===")
    print(confusion_matrix(y_test, y_pred))

    if len(np.unique(y_test)) > 1:
        print(f"\nROC-AUC: {roc_auc_score(y_test, y_prob):.4f}")

    print("\n=== Feature Importance ===")
    importance = pd.Series(model.feature_importances_, index=FEATURE_COLS).sort_values(ascending=False)
    print(importance)


def save_model(model: RandomForestClassifier, path: str = "../models/rf_rob_model.joblib"):
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)
    joblib.dump(model, path)
    print(f"Model disimpan di: {path}")


if __name__ == "__main__":
    from feature_engineering import build_daily_features, create_proxy_label

    # Ganti bagian ini dengan load data asli dari database (lihat schema.sql)
    dates = pd.date_range("2022-01-01", periods=900, freq="D")
    tide_dummy = pd.DataFrame({
        "date": np.repeat(dates, 4),
        "tide_height_cm": np.random.uniform(100, 220, size=900 * 4)
    })
    weather_dummy = pd.DataFrame({
        "date": dates,
        "rainfall_mm": np.random.uniform(0, 40, size=900),
        "wind_speed_ms": np.random.uniform(1, 8, size=900),
        "pressure_hpa": np.random.uniform(1005, 1015, size=900)
    })

    df = build_daily_features(tide_dummy, weather_dummy)
    df = create_proxy_label(df)

    train_df, val_df, test_df = time_based_split(df)
    print(f"Train: {len(train_df)} | Val: {len(val_df)} | Test: {len(test_df)}")

    model = train_random_forest(train_df, tune=True)
    evaluate_model(model, test_df)
    save_model(model)
