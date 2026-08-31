"""
HoneyChain ML Inference Server

FastAPI microservice providing yield prediction and seasonal harvest windows.
"""

import os
import numpy as np
import pandas as pd
import xgboost as xgb
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "..", "models")

# ── Load models on startup ─────────────────────────────────────────────────
app = FastAPI(
    title="HoneyChain ML Service",
    description="Predictive yield and seasonal harvest window estimation for beekeeping",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

yield_model = None
harvest_days_model = None
seasonal_model_data = None
FEATURE_COLS = [
    "temperature", "humidity", "weight", "weight_delta",
    "temp_rolling_6h", "humidity_rolling_6h", "weight_rolling_24h",
    "dwdt", "day_of_year", "hour", "weight_gain_14d",
]


def load_models():
    global yield_model, harvest_days_model, seasonal_model_data

    yield_path = os.path.join(MODEL_DIR, "yield_xgboost.json")
    harvest_path = os.path.join(MODEL_DIR, "harvest_days_xgboost.json")
    seasonal_path = os.path.join(MODEL_DIR, "seasonal_prophet.pkl")
    harmonic_path = os.path.join(MODEL_DIR, "seasonal_harmonic.pkl")

    if os.path.exists(yield_path):
        yield_model = xgb.XGBRegressor()
        yield_model.load_model(yield_path)
        print("[ML] Yield model loaded")

    if os.path.exists(harvest_path):
        harvest_days_model = xgb.XGBRegressor()
        harvest_days_model.load_model(harvest_path)
        print("[ML] Harvest days model loaded")

    if os.path.exists(seasonal_path):
        seasonal_model_data = {"model": joblib.load(seasonal_path), "type": "prophet"}
        print("[ML] Seasonal Prophet model loaded")
    elif os.path.exists(harmonic_path):
        seasonal_model_data = joblib.load(harmonic_path)
        print("[ML] Seasonal harmonic model loaded")


@app.on_event("startup")
async def startup():
    load_models()


# ── Request / Response schemas ─────────────────────────────────────────────

class TelemetryPoint(BaseModel):
    timestamp: int = Field(..., description="Unix epoch seconds")
    temperature: float = Field(..., description="Celsius")
    humidity: float = Field(..., description="Percentage 0-100")
    weight: float = Field(..., description="Kilograms")


class YieldRequest(BaseModel):
    hive_id: str = Field(..., description="Hive identifier")
    telemetry_history: list[TelemetryPoint] = Field(
        ..., min_length=10, description="At least 10 readings for feature engineering"
    )


class YieldResponse(BaseModel):
    hive_id: str
    predicted_yield_kg: float
    estimated_harvest_days: int
    confidence_score: float
    model_versions: dict
    readings_used: int


class SeasonalRequest(BaseModel):
    hive_id: str = "HIVE-001"
    telemetry_history: list[TelemetryPoint] = Field(..., min_length=48)


class SeasonalResponse(BaseModel):
    hive_id: str
    predicted_peak_weight_kg: float
    window_days: int
    model_type: str
    readings_used: int


# ── Helpers ────────────────────────────────────────────────────────────────

def compute_features(points: list[TelemetryPoint]) -> np.ndarray:
    """Engineer features from raw telemetry history."""
    temps = np.array([p.temperature for p in points])
    humids = np.array([p.humidity for p in points])
    weights = np.array([p.weight for p in points])
    timestamps = np.array([p.timestamp for p in points])

    n = len(points)
    last = n - 1

    # Rolling averages
    temp_6h = pd.Series(temps).rolling(12, min_periods=1).mean().values
    humid_6h = pd.Series(humids).rolling(12, min_periods=1).mean().values
    weight_24h = pd.Series(weights).rolling(48, min_periods=1).mean().values

    # Deltas
    weight_delta = np.zeros(n)
    weight_delta[1:] = np.diff(weights)

    dwdt = np.zeros(n)
    dwdt[4:] = (weights[4:] - weights[:-4]) / 4

    # Weight gain over 14 days (or available window)
    gain_window = min(14 * 48, n)
    weight_gain_14d = np.zeros(n)
    weight_gain_14d[gain_window - 1 :] = weights[gain_window - 1 :] - weights[: n - gain_window + 1]

    # Time features
    from datetime import datetime
    dt = datetime.fromtimestamp(int(timestamps[last]))
    day_of_year = dt.timetuple().tm_yday
    hour = dt.hour

    features = np.array([
        temps[last],
        humids[last],
        weights[last],
        weight_delta[last],
        temp_6h[last],
        humid_6h[last],
        weight_24h[last],
        dwdt[last],
        day_of_year,
        hour,
        weight_gain_14d[last],
    ])

    return features


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "HoneyChain ML Service",
        "models_loaded": {
            "yield_xgboost": yield_model is not None,
            "harvest_days_xgboost": harvest_days_model is not None,
            "seasonal": seasonal_model_data is not None,
        },
    }


@app.post("/predict/yield", response_model=YieldResponse)
async def predict_yield(req: YieldRequest):
    if yield_model is None or harvest_days_model is None:
        raise HTTPException(
            status_code=503,
            detail="Yield model not trained yet. Run: python -m app.train",
        )

    try:
        features = compute_features(req.telemetry_history)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Feature computation failed: {e}")

    yield_pred = float(yield_model.predict(features.reshape(1, -1))[0])
    yield_pred = round(max(0.0, min(15.0, yield_pred)), 2)

    days_pred = float(harvest_days_model.predict(features.reshape(1, -1))[0])
    days_pred = max(0, min(90, int(days_pred)))

    confidence = round(min(1.0, max(0.0, 1.0 - abs(yield_pred) / 10)), 3)

    return YieldResponse(
        hive_id=req.hive_id,
        predicted_yield_kg=yield_pred,
        estimated_harvest_days=days_pred,
        confidence_score=confidence,
        model_versions={
            "yield_xgboost": "1.0.0",
            "harvest_days_xgboost": "1.0.0",
        },
        readings_used=len(req.telemetry_history),
    )


@app.post("/predict/seasonal", response_model=SeasonalResponse)
async def predict_seasonal(req: SeasonalRequest):
    if seasonal_model_data is None:
        raise HTTPException(
            status_code=503,
            detail="Seasonal model not trained yet. Run: python -m app.train",
        )

    from app.seasonal_model import predict_seasonal_window

    df = pd.DataFrame([p.model_dump() for p in req.telemetry_history])
    result = predict_seasonal_window(seasonal_model_data, df)

    return SeasonalResponse(
        hive_id=req.hive_id,
        predicted_peak_weight_kg=result["predicted_peak_weight_kg"],
        window_days=result.get("window_days", 14),
        model_type=result["model_type"],
        readings_used=len(req.telemetry_history),
    )


@app.get("/models/status")
async def model_status():
    """Check which models are loaded and their metrics."""
    return {
        "yield_model": {
            "loaded": yield_model is not None,
            "type": "XGBRegressor",
            "features": FEATURE_COLS,
        },
        "harvest_days_model": {
            "loaded": harvest_days_model is not None,
            "type": "XGBRegressor",
        },
        "seasonal_model": {
            "loaded": seasonal_model_data is not None,
            "type": seasonal_model_data.get("type") if seasonal_model_data else None,
        },
    }
