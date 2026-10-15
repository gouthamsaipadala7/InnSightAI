from __future__ import annotations
import logging
import pandas as pd
from app.config import settings
from app.data.db_connector import fetch_platform_daily_counts
from app.data.kaggle_loader import load_kaggle_daily_counts
from app.data.schemas import DAILY_COUNTS_COLUMNS, DataSource

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)
COMBINED_FILENAME = "daily_booking_counts_combined.csv"

def combine_daily_counts(kaggle_df: pd.DataFrame, platform_df: pd.DataFrame) -> pd.DataFrame:
    for name, df in (("kaggle", kaggle_df), ("platform", platform_df)):
        missing = set(DAILY_COUNTS_COLUMNS) - set(df.columns)
        if missing:
            raise ValueError(f"{name} missing columns: {missing}")
    frames = [df for df in (kaggle_df, platform_df) if not df.empty]
    combined = pd.concat(frames, ignore_index=True) if frames else kaggle_df.iloc[0:0]
    combined = combined[DAILY_COUNTS_COLUMNS]
    bad = set(combined["source"].unique()) - {s.value for s in DataSource}
    if bad:
        raise ValueError(f"Unexpected source tag(s): {bad}")
    return combined.sort_values(["source","hotel_id","date"]).reset_index(drop=True)

def save_processed(df: pd.DataFrame, filename: str = COMBINED_FILENAME) -> None:
    df.to_csv(settings.processed_dir / filename, index=False)

def run_pipeline() -> pd.DataFrame:
    kaggle_df = load_kaggle_daily_counts()
    platform_df = fetch_platform_daily_counts()
    combined = combine_daily_counts(kaggle_df, platform_df)
    save_processed(combined)
    logger.info("Hotels per source:\n%s", combined.groupby("source")["hotel_id"].nunique().to_string())
    return combined

if __name__ == "__main__":
    run_pipeline()