"""
train_model.py
Training Random Forest untuk prediksi banjir rob (short-term, H+1 s/d H+7).

Pipeline (Fase 2.2 roadmap):
  time-based split -> SMOTE (hanya train, dengan guard) -> RandomForest
  (+ optional RandomizedSearchCV TimeSeriesSplit) -> evaluasi
  (Recall/F1/ROC-AUC/PR-AUC) -> simpan artefak + metrics JSON ke models/.

Target performa minimum (roadmap): Recall >= 0.80, Precision >= 0.60,
F1 >= 0.70, PR-AUC >= 0.65 pada test set.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import RandomizedSearchCV, TimeSeriesSplit

from .feature_engineering import FEATURE_COLS

TARGET_COL = "Rob"
MODEL_VERSION = "flood_classifier_v1"
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
MODEL_PATH = MODELS_DIR / f"{MODEL_VERSION}.joblib"
METRICS_PATH = MODELS_DIR / f"metrics_{MODEL_VERSION}.json"


def time_based_split(df: pd.DataFrame, test_size: float = 0.15, val_size: float = 0.15):
    """Split kronologis (bukan random) -- wajib untuk data time-series."""
    df = df.sort_values("date").reset_index(drop=True)
    n = len(df)
    test_start = int(n * (1 - test_size))
    val_start = int(n * (1 - test_size - val_size))
    return df.iloc[:val_start], df.iloc[val_start:test_start], df.iloc[test_start:]


def _apply_smote(X_train: pd.DataFrame, y_train: pd.Series):
    """
    SMOTE hanya pada data training. Guard: butuh minoritas cukup banyak
    (k_neighbors default 5 -> minimal 6 sampel positif); jika tidak,
    lewati dan andalkan class_weight='balanced'.
    """
    positives = int(y_train.sum())
    if positives < 10:
        print(f"[WARNING] SMOTE dilewati: hanya {positives} sampel positif "
              "(class_weight='balanced' tetap aktif).")
        return X_train, y_train
    try:
        from imblearn.over_sampling import SMOTE
        k_neighbors = min(5, positives - 1)
        smote = SMOTE(random_state=42, k_neighbors=k_neighbors)
        X_res, y_res = smote.fit_resample(X_train, y_train)
        print(f"[INFO] SMOTE: {positives} -> {int(y_res.sum())} sampel positif.")
        return X_res, y_res
    except ImportError:
        print("[WARNING] imbalanced-learn tidak terpasang; SMOTE dilewati.")
        return X_train, y_train


def train_random_forest(train_df: pd.DataFrame, tune: bool = True,
                        use_smote: bool = True) -> RandomForestClassifier:
    X_train = train_df[FEATURE_COLS]
    y_train = train_df[TARGET_COL]

    if use_smote:
        X_train, y_train = _apply_smote(X_train, y_train)

    if not tune:
        model = RandomForestClassifier(
            n_estimators=200, max_depth=10, class_weight="balanced",
            random_state=42, n_jobs=-1,
        )
        model.fit(X_train, y_train)
        return model

    param_dist = {
        "n_estimators": [100, 200, 300, 500],
        "max_depth": [5, 10, 15, 20, None],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf": [1, 2, 4],
    }
    search = RandomizedSearchCV(
        RandomForestClassifier(class_weight="balanced", random_state=42, n_jobs=-1),
        param_distributions=param_dist,
        n_iter=20,
        cv=TimeSeriesSplit(n_splits=5),
        scoring="f1",
        random_state=42,
        n_jobs=-1,
    )
    search.fit(X_train, y_train)
    print("Best params:", search.best_params_)
    return search.best_estimator_


def evaluate_model(model: RandomForestClassifier, test_df: pd.DataFrame) -> dict:
    """Evaluasi lengkap; return dict metrik untuk disimpan/diaudit."""
    X_test = test_df[FEATURE_COLS]
    y_test = test_df[TARGET_COL]

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    print("=== Classification Report ===")
    print(classification_report(y_test, y_pred, target_names=["Tidak Rob", "Rob"], zero_division=0))
    print("=== Confusion Matrix ===")
    print(confusion_matrix(y_test, y_pred))

    metrics = {
        "recall_rob": round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        "precision_rob": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
        "f1_rob": round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
        "test_rows": int(len(y_test)),
        "test_positives": int(y_test.sum()),
    }
    if len(np.unique(y_test)) > 1:
        metrics["roc_auc"] = round(float(roc_auc_score(y_test, y_prob)), 4)
        metrics["pr_auc"] = round(float(average_precision_score(y_test, y_prob)), 4)
        print(f"\nROC-AUC: {metrics['roc_auc']:.4f} | PR-AUC: {metrics['pr_auc']:.4f}")

    print("\n=== Feature Importance ===")
    importance = pd.Series(model.feature_importances_, index=FEATURE_COLS).sort_values(ascending=False)
    print(importance.to_string())
    metrics["feature_importance"] = {k: round(float(v), 4) for k, v in importance.items()}

    targets = {"recall_rob": 0.80, "precision_rob": 0.60, "f1_rob": 0.70, "pr_auc": 0.65}
    unmet = [f"{name} {metrics.get(name, 0):.2f} < {threshold}"
             for name, threshold in targets.items() if metrics.get(name, 0) < threshold]
    if unmet:
        print(f"\n[WARNING] Target performa minimum roadmap belum tercapai: {'; '.join(unmet)}")
    metrics["targets_met"] = not unmet
    return metrics


def save_model(model: RandomForestClassifier, metrics: dict | None = None,
               path: Path = MODEL_PATH) -> Path:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "feature_cols": FEATURE_COLS,
                 "version": MODEL_VERSION, "trained_at": datetime.now().isoformat()}, path)
    print(f"[OK] Model disimpan: {path}")
    if metrics is not None:
        METRICS_PATH.write_text(json.dumps(metrics, indent=2))
        print(f"[OK] Metrik disimpan: {METRICS_PATH}")
    return path


def load_model(path: Path = MODEL_PATH) -> RandomForestClassifier | None:
    """Muat model tersimpan; None bila belum ada / skema fitur berubah."""
    if not Path(path).exists():
        return None
    artifact = joblib.load(path)
    if isinstance(artifact, dict):
        if artifact.get("feature_cols") != FEATURE_COLS:
            print("[WARNING] Skema fitur model tersimpan berbeda dengan kode "
                  "saat ini -- model perlu retraining.")
            return None
        return artifact["model"]
    return artifact  # format lama: langsung objek model
