from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd
from sklearn.metrics import mean_absolute_percentage_error, root_mean_squared_error
from app.config import settings
from app.data.pipeline import run_pipeline
from app.models.prophet_baseline import fit_prophet_baseline
from app.models.coldstart import fit_prophet_truncated
from app.models.feature_engineering import add_features, FEATURE_COLS
from app.models.xgboost_pooled import train_pooled_xgb

TRAIN_DAYS = 14      # simulate a hotel with only 2 weeks of history
TEST_WINDOW_DAYS = 30

def score(actual, pred):
    return (mean_absolute_percentage_error(actual, pred) * 100,
            root_mean_squared_error(actual, pred))

def main():
    df = run_pipeline()
    hotel_ids = sorted(df["hotel_id"].unique())
    print(f"Cold-start eval over {len(hotel_ids)} hotels, {TRAIN_DAYS}-day warm start, "
          f"{TEST_WINDOW_DAYS}-day test window.\n")

    baseline_scores, pooled_scores = [], []

    for cold_id in hotel_ids:
        cold_df = df[df["hotel_id"] == cold_id]
        other_ids = [h for h in hotel_ids if h != cold_id]

        # Full-history residuals for the OTHER hotels (normal B2 fit) — this is
        # the "pool" the cold-start hotel borrows patterns from.
        other_residuals = []
        for hid in other_ids:
            _, _, res_df, _ = fit_prophet_baseline(df[df["hotel_id"] == hid], hid)
            other_residuals.append(res_df)
        other_residuals_df = pd.concat(other_residuals, ignore_index=True)

        # Cold-start hotel: Prophet fit on first TRAIN_DAYS only, predicted forward.
        cold_merged, cutoff = fit_prophet_truncated(cold_df, cold_id, TRAIN_DAYS)
        test_window = cold_merged[
            (cold_merged["date"] > cutoff) &
            (cold_merged["date"] <= cutoff + pd.Timedelta(days=TEST_WINDOW_DAYS))
        ]
        if test_window.empty:
            continue

        # Combine pool + cold-start series so hotel_id categories & lag/rolling
        # features are computed consistently, then split back apart.
        combined = pd.concat([other_residuals_df, cold_merged], ignore_index=True)
        featured = add_features(combined)

        train_feat = featured[featured["hotel_id"].isin(other_ids)].dropna(subset=FEATURE_COLS[:-1])
        test_feat = featured[
            (featured["hotel_id"] == cold_id) &
            (featured["date"] > cutoff) &
            (featured["date"] <= cutoff + pd.Timedelta(days=TEST_WINDOW_DAYS))
        ].dropna(subset=FEATURE_COLS[:-1])
        if test_feat.empty:
            continue

        model = train_pooled_xgb(train_feat, n_estimators=120, max_depth=3, learning_rate=0.05, reg_lambda=5.0)
        test_feat = test_feat.copy()
        test_feat["final_forecast"] = test_feat["predicted"] + model.predict(test_feat[FEATURE_COLS])

        b_mape, b_rmse = score(test_feat["actual"], test_feat["predicted"])
        p_mape, p_rmse = score(test_feat["actual"], test_feat["final_forecast"])
        baseline_scores.append(b_mape); pooled_scores.append(p_mape)

        print(f"{cold_id:<40} Prophet-only MAPE={b_mape:6.2f}%  Prophet+XGB MAPE={p_mape:6.2f}%  (n={len(test_feat)})")

    print(f"\n=== Cold-start averages across {len(baseline_scores)} hotels ===")
    print(f"Prophet-only avg MAPE:    {sum(baseline_scores)/len(baseline_scores):.2f}%")
    print(f"Prophet+XGBoost avg MAPE: {sum(pooled_scores)/len(pooled_scores):.2f}%")

if __name__ == "__main__":
    main()