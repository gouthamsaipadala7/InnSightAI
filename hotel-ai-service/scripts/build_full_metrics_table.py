from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd
from app.config import settings

EXPERIMENTS_DIR = settings.processed_dir.parent.parent / "experiments"
WINDOW_ORDER = ["14d", "30d", "90d", "180d", "full"]

df = pd.read_csv(EXPERIMENTS_DIR / "coldstart_multiwindow_results.csv")
avg = df.groupby(["window", "method"])[["mae", "rmse", "mape", "accuracy"]].mean().reset_index()
avg["window"] = pd.Categorical(avg["window"], categories=WINDOW_ORDER, ordered=True)
avg = avg.sort_values(["window", "method"])
avg.to_csv(EXPERIMENTS_DIR / "coldstart_full_metrics.csv", index=False)
print(avg.to_string(index=False))