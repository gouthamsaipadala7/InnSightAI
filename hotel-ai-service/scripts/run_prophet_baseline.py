from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd
from app.config import settings
from app.data.pipeline import COMBINED_FILENAME
from app.models.prophet_baseline import fit_prophet_baseline

RESIDUALS_FILENAME = "residuals_combined.csv"

def main():
    combined_path = settings.processed_dir / COMBINED_FILENAME
    df = pd.read_csv(combined_path, parse_dates=["date"])

    all_residuals = []
    all_metrics = []

    for hotel_id, hotel_df in df.groupby("hotel_id"):
        print(f"Fitting Prophet for {hotel_id} ({len(hotel_df)} days)...")
        _, _, residuals_df, metrics = fit_prophet_baseline(hotel_df, hotel_id)
        all_residuals.append(residuals_df)
        all_metrics.append(metrics)

    residuals_combined = pd.concat(all_residuals, ignore_index=True)
    out_path = settings.processed_dir / RESIDUALS_FILENAME
    residuals_combined.to_csv(out_path, index=False)

    print("\n=== Prophet Baseline Metrics ===")
    metrics_df = pd.DataFrame(all_metrics)
    print(metrics_df.to_string(index=False))
    print(f"\nSaved residuals ({len(residuals_combined)} rows) to {out_path}")

if __name__ == "__main__":
    main()