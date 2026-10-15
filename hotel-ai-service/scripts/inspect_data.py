from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from app.config import settings
from app.data.pipeline import COMBINED_FILENAME, run_pipeline

def load_combined() -> pd.DataFrame:
    path = settings.processed_dir / COMBINED_FILENAME
    return run_pipeline() if not path.exists() else pd.read_csv(path, parse_dates=["date"])

def print_summary(df):
    print(f"Total rows: {len(df)}  Sources: {sorted(df['source'].unique())}")
    for source, sdf in df.groupby("source"):
        print(f"--- {source} ---")
        for hid, hdf in sdf.groupby("hotel_id"):
            dmin, dmax = hdf["date"].min(), hdf["date"].max()
            print(f"  {hid}: {len(hdf)} days [{dmin.date()}→{dmax.date()}] "
                  f"mean={hdf['bookings'].mean():.2f} std={hdf['bookings'].std():.2f}")

def save_plot(df, filename="daily_bookings_overview.png"):
    fig, ax = plt.subplots(figsize=(13,6))
    for hid, hdf in df.groupby("hotel_id"):
        hdf = hdf.sort_values("date")
        style = "--" if hdf["source"].iloc[0]=="kaggle_pretrain" else "-"
        ax.plot(hdf["date"], hdf["bookings"], style, label=hid, alpha=0.8, linewidth=1.2)
    ax.set_title("Daily Booking Counts by Hotel"); ax.legend(fontsize=8); ax.grid(alpha=0.3)
    fig.tight_layout()
    out = settings.outputs_dir / filename
    fig.savefig(out, dpi=150); plt.close(fig)
    return out

if __name__ == "__main__":
    df = load_combined()
    print_summary(df)
    print(f"Saved plot: {save_plot(df)}")