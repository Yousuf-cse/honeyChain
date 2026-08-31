"""
Prophet model for seasonal harvest window estimation.

Predicts macro-level harvest windows based on regional flowering cycles
and seasonal colony growth patterns.
"""

import os
import numpy as np
import pandas as pd

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")


def train_seasonal_model(df: pd.DataFrame) -> dict:
    """
    Train Prophet model on daily-aggregated hive data.

    Predicts daily weight trends to identify harvest windows.
    """
    try:
        from prophet import Prophet
    except ImportError:
        print("  WARNING: Prophet not available, using fallback seasonal model")
        return train_fallback_seasonal_model(df)

    os.makedirs(MODEL_DIR, exist_ok=True)

    # Aggregate to daily
    daily = df.copy()
    daily["date"] = pd.to_datetime(daily["timestamp"]).dt.date
    daily = daily.groupby("date").agg(
        weight=("weight", "mean"),
        temperature=("temperature", "mean"),
        humidity=("humidity", "mean"),
    ).reset_index()

    daily["date"] = pd.to_datetime(daily["date"])
    daily = daily.rename(columns={"date": "ds", "weight": "y"})

    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,
    )
    model.add_regressor("temperature")
    model.add_regressor("humidity")
    model.fit(daily[["ds", "y", "temperature", "humidity"]])

    model_path = os.path.join(MODEL_DIR, "seasonal_prophet.pkl")
    import joblib
    joblib.dump(model, model_path)
    print(f"  Seasonal model saved: {model_path}")

    return {"model": model, "type": "prophet"}


def train_fallback_seasonal_model(df: pd.DataFrame) -> dict:
    """
    Fallback: simple seasonal harmonic model when Prophet is unavailable.

    Fits sinusoidal components to daily weight averages.
    """
    os.makedirs(MODEL_DIR, exist_ok=True)

    daily = df.copy()
    daily["date"] = pd.to_datetime(daily["timestamp"]).dt.date
    daily = daily.groupby("date").agg(weight=("weight", "mean")).reset_index()
    daily["day_num"] = range(len(daily))

    # Fit seasonal harmonics
    day_num = daily["day_num"].values
    weight = daily["weight"].values

    # 365-day periodicity
    X = np.column_stack([
        np.ones(len(day_num)),
        np.sin(2 * np.pi * day_num / 365),
        np.cos(2 * np.pi * day_num / 365),
        np.sin(4 * np.pi * day_num / 365),
        np.cos(4 * np.pi * day_num / 365),
    ])

    coeffs, _, _, _ = np.linalg.lstsq(X, weight, rcond=None)

    model_data = {
        "type": "harmonic",
        "coefficients": coeffs.tolist(),
        "day_start": int(day_num[0]),
    }

    import joblib
    model_path = os.path.join(MODEL_DIR, "seasonal_harmonic.pkl")
    joblib.dump(model_data, model_path)
    print(f"  Seasonal harmonic model saved: {model_path}")

    return {"model": model_data, "type": "harmonic"}


def predict_seasonal_window(model_data: dict, recent_df: pd.DataFrame) -> dict:
    """
    Predict upcoming harvest windows from the seasonal model.

    Returns next peak weight date and window duration.
    """
    model_type = model_data.get("type", "harmonic")

    if model_type == "prophet":
        import joblib
        model = model_data["model"]
        future = model.make_future_dataframe(periods=90, freq="D")
        # Fill regressors with recent averages
        recent = recent_df.tail(48)  # last 24 hours
        future["temperature"] = recent["temperature"].mean()
        future["humidity"] = recent["humidity"].mean()
        forecast = model.predict(future)
        # Find peak weight in next 90 days
        future_forecast = forecast.tail(90)
        peak_idx = future_forecast["yhat"].idxmax()
        peak_date = future_forecast.loc[peak_idx, "ds"]
        peak_weight = future_forecast.loc[peak_idx, "yhat"]
        return {
            "predicted_peak_date": str(peak_date.date()),
            "predicted_peak_weight_kg": round(float(peak_weight), 2),
            "window_days": 14,
            "model_type": "prophet",
        }
    else:
        # Harmonic fallback
        coeffs = model_data["coefficients"]
        day_start = model_data["day_start"]
        future_days = np.arange(day_start, day_start + 90)
        X_future = np.column_stack([
            np.ones(len(future_days)),
            np.sin(2 * np.pi * future_days / 365),
            np.cos(2 * np.pi * future_days / 365),
            np.sin(4 * np.pi * future_days / 365),
            np.cos(4 * np.pi * future_days / 365),
        ])
        predicted = X_future @ np.array(coeffs)
        peak_idx = np.argmax(predicted)
        peak_day = future_days[peak_idx]
        days_ahead = peak_day - day_start
        return {
            "predicted_peak_day": int(days_ahead),
            "predicted_peak_weight_kg": round(float(predicted[peak_idx]), 2),
            "window_days": 14,
            "model_type": "harmonic",
        }
