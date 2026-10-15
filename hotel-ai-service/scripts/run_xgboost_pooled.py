from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd
from sklearn.metrics import mean_absolute_percentage_error, root_mean_squared_error
from app.config import settings
from app.data.pipeline import run_pipeline, COMBINED_FILENAME
from app.models.feature_engineering import add_features, FEATURE_COLS
from app.models.xgboost_pooled import time_based_split, train_pooled_xgb, save_model, MODEL_FILENAME
from app.models.prophet_baseline import fit_prophet_baseline

def score(actual, pred):
    return (mean_absolute_percentage_error(actual, pred) * 100,
            root_mean_squared_error(actual, pred))

def main():
    df = run_pipeline()  # refreshes combined dataset -> now includes all 5 hotels
    print(f"Hotels in pool: {sorted(df['hotel_id'].unique())}")

    residual_rows = []
    for hotel_id, hdf in df.groupby("hotel_id"):
        _, _, res_df, _ = fit_prophet_baseline(hdf, hotel_id)
        residual_rows.append(res_df)
    residuals_df = pd.concat(residual_rows, ignore_index=True)

    featured = add_features(residuals_df).dropna(subset=FEATURE_COLS[:-1])
    train_df, test_df = time_based_split(featured, test_frac=0.2)
    print(f"Train rows: {len(train_df)}  Test rows: {len(test_df)}")

    configs = {
        "original (300 trees, depth 4)": dict(n_estimators=300, max_depth=4, learning_rate=0.05),
        "tuned (120 trees, depth 3, L2)": dict(n_estimators=120, max_depth=3, learning_rate=0.05, reg_lambda=5.0),
    }

    baseline_mape, baseline_rmse = score(test_df["actual"], test_df["predicted"])
    print(f"\nProphet-only:                    MAPE={baseline_mape:.2f}%  RMSE={baseline_rmse:.2f}")

    best_model, best_name, best_mape = None, None, float("inf")
    for name, params in configs.items():
        model = train_pooled_xgb(train_df, **params)
        preds = test_df["predicted"] + model.predict(test_df[FEATURE_COLS])
        mape, rmse = score(test_df["actual"], preds)
        print(f"Prophet+XGBoost {name}: MAPE={mape:.2f}%  RMSE={rmse:.2f}")
        if mape < best_mape:
            best_model, best_name, best_mape = model, name, mape

    save_model(best_model, settings.processed_dir / MODEL_FILENAME)
    print(f"\nSaved best model ({best_name}) to {settings.processed_dir / MODEL_FILENAME}")

if __name__ == "__main__":
    main()