"""
Training pipeline for HoneyChain ML models.

Uses Optuna for hyperparameter tuning on XGBoost models.
Generates synthetic data, trains tuned models, and saves artifacts.
"""

import os
import sys
import logging

sys.path.insert(0, os.path.dirname(__file__))

# Suppress Optuna output noise
optuna_logger = logging.getLogger("optuna")
optuna_logger.setLevel(logging.WARNING)

from app.synthetic_data import generate_dataset, prepare_features
from app.yield_model import train_yield_model, train_harvest_days_model
from app.seasonal_model import train_seasonal_model

N_TRIALS = 50  # Optuna search budget per model


def main():
    print("=" * 60)
    print("  HoneyChain ML Training Pipeline (Optuna-Tuned)")
    print("=" * 60)

    # 1. Generate synthetic data
    print("\n[1/4] Generating synthetic telemetry for 20 hives...")
    df = generate_dataset(n_hives=20, days=180, seed=42)
    print(f"  Total samples: {len(df):,}")
    print(f"  Harvest ready: {df['is_harvest_ready'].sum():,} / {len(df):,}")
    print(f"  Avg harvestable yield: {df['harvestable_kg'].mean():.2f} kg")

    # 2. Prepare features
    print("\n[2/4] Engineering features...")
    features_df, feature_cols = prepare_features(df)
    print(f"  Features: {feature_cols}")

    # 3. Train XGBoost models with Optuna
    print(f"\n[3/4] Training XGBoost models with Optuna ({N_TRIALS} trials each)...")
    print("  → Yield prediction model:")
    yield_result = train_yield_model(df, feature_cols, n_trials=N_TRIALS)
    print("\n  → Days-to-harvest model:")
    harvest_result = train_harvest_days_model(df, feature_cols, n_trials=N_TRIALS)

    # 4. Train seasonal model
    print("\n[4/4] Training seasonal harvest window model...")
    seasonal_result = train_seasonal_model(df)

    # Summary
    print("\n" + "=" * 60)
    print("  Training Complete!")
    print("=" * 60)
    print(f"  Yield model MAE:      {yield_result['metrics']['mae_kg']:.6f} kg")
    print(f"  Yield model R²:       {yield_result['metrics']['r2_score']:.6f}")
    print(f"  Harvest days MAE:     {harvest_result['metrics']['mae_days']:.4f} days")
    print(f"  Harvest days R²:      {harvest_result['metrics']['r2_score']:.6f}")
    print(f"  Seasonal model type:  {seasonal_result['type']}")
    print(f"  Optuna trials/model:  {N_TRIALS}")
    print(f"  Models saved to:      {os.path.abspath('models/')}")
    print("=" * 60)


if __name__ == "__main__":
    main()
