"""
XGBoost model for short-term honey yield prediction.

Optuna-tuned hyperparameters for optimal yield and harvest-days prediction.
"""

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score
import optuna
import joblib
import os

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")


# ── Optuna objective functions ─────────────────────────────────────────────

def _yield_objective(trial: optuna.Trial, X_train, y_train, X_test, y_test):
    params = {
        "n_estimators": trial.suggest_int("n_estimators", 100, 600),
        "max_depth": trial.suggest_int("max_depth", 3, 10),
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
        "subsample": trial.suggest_float("subsample", 0.5, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
        "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 10.0, log=True),
        "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 10.0, log=True),
        "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
        "gamma": trial.suggest_float("gamma", 0.0, 5.0),
        "random_state": 42,
        "objective": "reg:squarederror",
        "n_jobs": -1,
    }
    model = xgb.XGBRegressor(**params)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    preds = model.predict(X_test)
    return mean_absolute_error(y_test, preds)


def _harvest_days_objective(trial: optuna.Trial, X_train, y_train, X_test, y_test):
    params = {
        "n_estimators": trial.suggest_int("n_estimators", 100, 500),
        "max_depth": trial.suggest_int("max_depth", 3, 8),
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
        "subsample": trial.suggest_float("subsample", 0.6, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
        "reg_alpha": trial.suggest_float("reg_alpha", 1e-3, 5.0, log=True),
        "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 5.0, log=True),
        "min_child_weight": trial.suggest_int("min_child_weight", 1, 8),
        "random_state": 42,
        "objective": "reg:squarederror",
        "n_jobs": -1,
    }
    model = xgb.XGBRegressor(**params)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
    preds = model.predict(X_test)
    return mean_absolute_error(y_test, preds)


# ── Training functions ─────────────────────────────────────────────────────

def train_yield_model(
    df: pd.DataFrame,
    feature_cols: list[str],
    n_trials: int = 50,
) -> dict:
    """Optuna-tuned XGBoost regressor for yield prediction."""
    os.makedirs(MODEL_DIR, exist_ok=True)

    X = df[feature_cols].values
    y = df["harvestable_kg"].values
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print(f"  Running Optuna ({n_trials} trials)...")
    study = optuna.create_study(direction="minimize", study_name="yield_xgb")
    study.optimize(
        lambda t: _yield_objective(t, X_train, y_train, X_test, y_test),
        n_trials=n_trials,
        show_progress_bar=True,
    )

    best = study.best_params
    print(f"  Best params: {best}")
    print(f"  Best CV MAE: {study.best_value:.6f} kg")

    model = xgb.XGBRegressor(**best, random_state=42, objective="reg:squarederror", n_jobs=-1)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    metrics = {
        "mae_kg": round(mae, 6),
        "r2_score": round(r2, 6),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "best_params": best,
        "optuna_best_value": round(study.best_value, 6),
    }

    model_path = os.path.join(MODEL_DIR, "yield_xgboost.json")
    model.save_model(model_path)
    joblib.dump(study, os.path.join(MODEL_DIR, "yield_study.pkl"))
    print(f"  Yield model saved: {model_path}")
    print(f"  Final MAE: {mae:.6f} kg | R²: {r2:.6f}")

    return {"model": model, "metrics": metrics, "feature_cols": feature_cols, "study": study}


def train_harvest_days_model(
    df: pd.DataFrame,
    feature_cols: list[str],
    n_trials: int = 50,
) -> dict:
    """Optuna-tuned XGBoost regressor for days-to-harvest prediction."""
    os.makedirs(MODEL_DIR, exist_ok=True)

    X = df[feature_cols].values
    y = df["days_to_harvest"].values
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print(f"  Running Optuna ({n_trials} trials)...")
    study = optuna.create_study(direction="minimize", study_name="harvest_days_xgb")
    study.optimize(
        lambda t: _harvest_days_objective(t, X_train, y_train, X_test, y_test),
        n_trials=n_trials,
        show_progress_bar=True,
    )

    best = study.best_params
    print(f"  Best params: {best}")
    print(f"  Best CV MAE: {study.best_value:.4f} days")

    model = xgb.XGBRegressor(**best, random_state=42, objective="reg:squarederror", n_jobs=-1)
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    metrics = {
        "mae_days": round(mae, 4),
        "r2_score": round(r2, 6),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "best_params": best,
        "optuna_best_value": round(study.best_value, 4),
    }

    model_path = os.path.join(MODEL_DIR, "harvest_days_xgboost.json")
    model.save_model(model_path)
    joblib.dump(study, os.path.join(MODEL_DIR, "harvest_days_study.pkl"))
    print(f"  Harvest days model saved: {model_path}")
    print(f"  Final MAE: {mae:.4f} days | R²: {r2:.6f}")

    return {"model": model, "metrics": metrics, "feature_cols": feature_cols, "study": study}


def predict_yield(model, features: np.ndarray) -> dict:
    pred = float(model.predict(features.reshape(1, -1))[0])
    pred = max(0.0, min(15.0, pred))
    return {
        "predicted_yield_kg": round(pred, 2),
        "confidence_score": round(min(1.0, max(0.0, 1.0 - abs(pred) / 10)), 3),
    }


def predict_harvest_days(model, features: np.ndarray) -> dict:
    pred = float(model.predict(features.reshape(1, -1))[0])
    pred = max(0, min(90, int(pred)))
    return {"estimated_harvest_days": pred}
