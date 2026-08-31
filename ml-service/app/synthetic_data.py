"""
Synthetic hive telemetry data generator for training ML models.

Generates realistic time-series data:
- Weight: foraging cycles, nectar flow seasons, colony growth
- Temperature: diurnal patterns, brood nest regulation
- Humidity: inversely correlated with temperature, weather events
- Yield labels: honey harvest amounts derived from weight gain patterns
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta


def generate_hive_timeline(
    days: int = 365,
    hive_id: str = "HIVE-001",
    start_date: str = "2025-01-01",
   采样间隔分钟: int = 30,
    seed: int | None = None,
) -> pd.DataFrame:
    """Generate a full year of synthetic hive telemetry at 30-min intervals."""
    rng = np.random.default_rng(seed)
    start = datetime.fromisoformat(start_date)
    n_samples = int(days * 24 * 60 / 采样间隔分钟)
    timestamps = [start + timedelta(minutes=i * 采样间隔分钟) for i in range(n_samples)]

    df = pd.DataFrame({"timestamp": timestamps})
    df["hive_id"] = hive_id
    df["day_of_year"] = df["timestamp"].dt.dayofyear
    df["hour"] = df["timestamp"].dt.hour
    df["day_fraction"] = df["day_of_year"] / 365.0
    df["hour_fraction"] = df["hour"] / 24.0

    # --- Temperature: diurnal + seasonal ---
    seasonal_temp = 25 + 10 * np.sin(2 * np.pi * (df["day_fraction"] - 0.25))  # peak in summer
    diurnal_temp = 3.5 * np.sin(2 * np.pi * (df["hour_fraction"] - 0.33))  # peak ~14:00
    temp_noise = rng.normal(0, 1.0, n_samples)
    df["temperature"] = np.clip(seasonal_temp + diurnal_temp + temp_noise, 5, 48)

    # --- Humidity: inverse of temp + weather events ---
    base_humidity = 70 - 0.5 * (df["temperature"] - 25)
    humidity_noise = rng.normal(0, 4, n_samples)
    # Random rain events (spikes in humidity)
    rain_mask = rng.random(n_samples) < 0.02
    rain_spike = rain_mask * rng.uniform(15, 30, n_samples)
    df["humidity"] = np.clip(base_humidity + humidity_noise + rain_spike, 30, 98)

    # --- Weight: colony growth + foraging + nectar flow ---
    # Seasonal baseline: colony grows in spring, peaks in summer
    colony_growth = 18 + 6 * np.sin(2 * np.pi * (df["day_fraction"] - 0.15))
    # Diurnal foraging: bees leave during day (weight drops), return at dusk (weight gains)
    foraging_cycle = -1.2 * np.sin(2 * np.pi * (df["hour_fraction"] - 0.5))
    # Nectar flow: strong weight gain during bloom periods (Apr-Jun, Aug-Sep)
    bloom1 = 3 * np.exp(-((df["day_of_year"] - 150) ** 2) / 800)  # Jun peak
    bloom2 = 2 * np.exp(-((df["day_of_year"] - 250) ** 2) / 600)  # Sep peak
    nectar_flow = bloom1 + bloom2
    # Weight noise
    weight_noise = rng.normal(0, 0.3, n_samples)
    df["weight"] = np.clip(colony_growth + foraging_cycle + nectar_flow + weight_noise, 10, 45)

    # --- Derived features ---
    df["weight_delta"] = df["weight"].diff().fillna(0)
    df["temp_rolling_6h"] = df["temperature"].rolling(12, min_periods=1).mean()
    df["humidity_rolling_6h"] = df["humidity"].rolling(12, min_periods=1).mean()
    df["weight_rolling_24h"] = df["weight"].rolling(48, min_periods=1).mean()
    df["dwdt"] = df["weight"].diff(4).fillna(0) / 4  # weight change per hour

    return df


def generate_yield_labels(df: pd.DataFrame) -> pd.DataFrame:
    """
    Derive yield labels from telemetry.

    - `harvestable_kg`: how much honey could be harvested at this point
    - `days_to_harvest`: days until weight gain crosses harvest threshold
    - `is_harvest_ready`: binary — weight gain > 2kg over 14-day window
    """
    df = df.copy()

    # 14-day rolling weight gain
    df["weight_gain_14d"] = df["weight"].diff(14 * 48).fillna(0)  # 48 samples/day at 30min

    # Harvest threshold: colony has gained > 2 kg of honey
    HARVEST_THRESHOLD_KG = 2.0
    df["is_harvest_ready"] = (df["weight_gain_14d"] > HARVEST_THRESHOLD_KG).astype(int)

    # Harvestable yield: weight above baseline (15 kg colony minimum)
    df["harvestable_kg"] = np.clip(df["weight_gain_14d"], 0, 15)

    # Days to next harvest: vectorized forward scan
    df["days_to_harvest"] = 90  # default cap
    ready_mask = df["is_harvest_ready"] == 1
    ready_positions = np.where(ready_mask.values)[0]
    if len(ready_positions) > 0:
        all_pos = np.arange(len(df))
        # For each position, find next harvest-ready index via searchsorted
        next_ready_idx = np.searchsorted(ready_positions, all_pos, side="left")
        has_next = next_ready_idx < len(ready_positions)
        days_ahead = np.zeros(len(df), dtype=int)
        days_ahead[has_next] = (ready_positions[next_ready_idx[has_next]] - all_pos[has_next]) // 48
        df["days_to_harvest"] = np.clip(days_ahead, 0, 90)

    return df


def generate_dataset(
    n_hives: int = 10,
    days: int = 180,
    seed: int = 42,
) -> pd.DataFrame:
    """Generate a full training dataset across multiple hives."""
    frames = []
    for i in range(n_hives):
        hive_id = f"HIVE-{i + 1:03d}"
        df = generate_hive_timeline(
            days=days,
            hive_id=hive_id,
            start_date="2025-01-01",
            seed=seed + i,
        )
        df = generate_yield_labels(df)
        frames.append(df)
    return pd.concat(frames, ignore_index=True)


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """Select and engineer features for model training."""
    feature_cols = [
        "temperature",
        "humidity",
        "weight",
        "weight_delta",
        "temp_rolling_6h",
        "humidity_rolling_6h",
        "weight_rolling_24h",
        "dwdt",
        "day_of_year",
        "hour",
        "weight_gain_14d",
    ]
    return df[feature_cols].copy(), feature_cols


if __name__ == "__main__":
    print("Generating synthetic dataset for 20 hives...")
    df = generate_dataset(n_hives=20, days=365)
    print(f"  Shape: {df.shape}")
    print(f"  Harvest ready: {df['is_harvest_ready'].sum()} / {len(df)} samples")
    print(f"  Avg harvestable yield: {df['harvestable_kg'].mean():.2f} kg")
    df.to_csv("training_data.csv", index=False)
    print("  Saved to training_data.csv")
