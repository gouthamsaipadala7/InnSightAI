from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import mean_absolute_percentage_error, root_mean_squared_error
from app.config import settings
from app.data.pipeline import run_pipeline
from app.models.prophet_baseline import fit_prophet_baseline
from app.models.coldstart import fit_prophet_window
from app.models.feature_engineering import add_features, FEATURE_COLS
from app.models.xgboost_pooled import train_pooled_xgb
from sklearn.metrics import mean_absolute_error

WINDOWS = [("14d", 14), ("30d", 30), ("90d", 90), ("180d", 180), ("full", None)]
TEST_WINDOW_DAYS = 30
XGB_PARAMS = dict(n_estimators=120, max_depth=3, learning_rate=0.05, reg_lambda=5.0)

EXPERIMENTS_DIR = settings.processed_dir.parent.parent / "experiments"
EXPERIMENTS_DIR.mkdir(parents=True, exist_ok=True)

def score(actual, pred):
    mape = mean_absolute_percentage_error(actual, pred) * 100
    return {
        "mae": mean_absolute_error(actual, pred),
        "rmse": root_mean_squared_error(actual, pred),
        "mape": mape,
        "accuracy": 100 - mape,
    }

def main():
    df = run_pipeline()
    hotel_ids = sorted(df["hotel_id"].unique())

    # Full-history residuals per hotel, computed ONCE (used as the "pool" for
    # every other hotel, regardless of the cold hotel's window size).
    full_residuals = {}
    for hid in hotel_ids:
        _, _, res_df, _ = fit_prophet_baseline(df[df["hotel_id"] == hid], hid)
        full_residuals[hid] = res_df

    rows = []
    for cold_id in hotel_ids:
        hotel_df = df[df["hotel_id"] == cold_id]
        max_date = hotel_df["date"].max()
        cutoff = max_date - pd.Timedelta(days=TEST_WINDOW_DAYS)
        min_date = hotel_df["date"].min()

        for label, window in WINDOWS:
            train_start = min_date if window is None else max(min_date, cutoff - pd.Timedelta(days=window))
            merged = fit_prophet_window(hotel_df, cold_id, train_start, cutoff, max_date)
            if merged is None:
                continue
            test_rows = merged[merged["date"] > cutoff]
            if test_rows.empty:
                continue

            m = score(test_rows["actual"], test_rows["predicted"])
            rows.append({"hotel": cold_id, "window": label, "method": "prophet_only", **m})
            # --- per-hotel-only XGBoost (no pooling) ---
            feat_self = add_features(merged)
            train_self = feat_self[feat_self["date"] <= cutoff].dropna(subset=FEATURE_COLS[:-1])
            test_self = feat_self[feat_self["date"] > cutoff].dropna(subset=FEATURE_COLS[:-1])
            if len(train_self) >= 5 and not test_self.empty:
                m = train_pooled_xgb(train_self, **XGB_PARAMS)
                pred = test_self["predicted"] + m.predict(test_self[FEATURE_COLS])
                m = score(test_self["actual"], pred)
                rows.append({"hotel": cold_id, "window": label, "method": "xgb_self_only", **m})
            # --- pooled XGBoost (trained on OTHER hotels' full-history residuals) ---
            other_ids = [h for h in hotel_ids if h != cold_id]
            pool_df = pd.concat([full_residuals[h] for h in other_ids] + [merged], ignore_index=True)
            feat_pool = add_features(pool_df)
            train_pool = feat_pool[feat_pool["hotel_id"].isin(other_ids)].dropna(subset=FEATURE_COLS[:-1])
            test_pool = feat_pool[(feat_pool["hotel_id"] == cold_id) & (feat_pool["date"] > cutoff)].dropna(subset=FEATURE_COLS[:-1])
            if not test_pool.empty:
                m = train_pooled_xgb(train_pool, **XGB_PARAMS)
                pred = test_pool["predicted"] + m.predict(test_pool[FEATURE_COLS])
                m = score(test_pool["actual"], pred)
                rows.append({"hotel": cold_id, "window": label, "method": "xgb_pooled", **m})

            print(f"{cold_id[:20]:<20} {label:<5} done")

    results = pd.DataFrame(rows)
    results.to_csv(EXPERIMENTS_DIR / "coldstart_multiwindow_results.csv", index=False)
    print(f"\nSaved results table to {EXPERIMENTS_DIR / 'coldstart_multiwindow_results.csv'}")

    avg = results.groupby(["window", "method"])["mape"].mean().reset_index()
    print("\n=== Average MAPE by window size and method ===")
    print(avg.pivot(index="window", columns="method", values="mape").reindex([w[0] for w in WINDOWS]).to_string())

    fig, ax = plt.subplots(figsize=(9, 6))
    window_order = [w[0] for w in WINDOWS]
    for method in ["prophet_only", "xgb_self_only", "xgb_pooled"]:
        sub = avg[avg["method"] == method].set_index("window").reindex(window_order)
        ax.plot(window_order, sub["mape"], marker="o", label=method)
    ax.set_xlabel("Training window size"); ax.set_ylabel("Avg MAPE (%)")
    ax.set_title("Forecast accuracy vs. training window size (avg across 5 hotels)")
    ax.legend(); ax.grid(alpha=0.3)
    fig.tight_layout()
    plot_path = EXPERIMENTS_DIR / "mape_vs_window.png"
    fig.savefig(plot_path, dpi=150)
    print(f"Saved plot to {plot_path}")

if __name__ == "__main__":
    main()