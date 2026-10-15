from __future__ import annotations
import pandas as pd
import holidays

def add_features(df: pd.DataFrame) -> pd.DataFrame:
    """df needs: hotel_id, date, residual (sorted doesn't matter, we sort here)."""
    df = df.sort_values(["hotel_id", "date"]).copy()
    df["date"] = pd.to_datetime(df["date"])

    df["dow"] = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.month
    df["is_weekend"] = (df["dow"] >= 5).astype(int)

    in_holidays = holidays.India(years=range(df["date"].dt.year.min(), df["date"].dt.year.max() + 1))
    df["is_holiday"] = df["date"].dt.date.isin(in_holidays).astype(int)

    g = df.groupby("hotel_id")["residual"]
    df["lag1"] = g.shift(1)
    df["lag7"] = g.shift(7)
    df["roll_mean7"] = g.shift(1).rolling(7).mean().reset_index(level=0, drop=True)
    df["roll_std7"] = g.shift(1).rolling(7).std().reset_index(level=0, drop=True)

    df["hotel_id"] = df["hotel_id"].astype("category")
    return df

FEATURE_COLS = ["dow", "month", "is_weekend", "is_holiday", "lag1", "lag7",
                 "roll_mean7", "roll_std7", "hotel_id"]