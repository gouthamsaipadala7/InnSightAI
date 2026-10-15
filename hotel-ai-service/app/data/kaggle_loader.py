from __future__ import annotations
import logging, shutil
from pathlib import Path
import numpy as np
import pandas as pd
from app.config import settings
from app.data.schemas import DataSource

logger = logging.getLogger(__name__)
RAW_FILENAME = "hotel_bookings.csv"
HOTEL_ID_MAP = {"City Hotel": "kaggle_city_hotel", "Resort Hotel": "kaggle_resort_hotel"}
MONTH_NAME_TO_NUM = {m: i+1 for i, m in enumerate(
    ["January","February","March","April","May","June","July","August",
     "September","October","November","December"])}

def download_kaggle_dataset(dest_dir: Path | None = None) -> Path:
    dest_dir = dest_dir or settings.raw_dir
    dest_path = dest_dir / RAW_FILENAME
    try:
        import kagglehub
    except ImportError as e:
        raise RuntimeError(
            "kagglehub not installed. pip install kagglehub + configure "
            f"~/.kaggle/kaggle.json, or manually place CSV at {dest_path}."
        ) from e
    cache_path = Path(kagglehub.dataset_download(settings.kaggle_dataset_slug))
    candidates = list(cache_path.glob("**/*.csv"))
    if not candidates:
        raise FileNotFoundError(f"No CSV found in {cache_path}")
    dest_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy(candidates[0], dest_path)
    return dest_path

def load_raw_kaggle_csv(path: Path | None = None) -> pd.DataFrame:
    path = path or (settings.raw_dir / RAW_FILENAME)
    if not path.exists():
        path = download_kaggle_dataset()
    return pd.read_csv(path, na_values=["NULL", "NA", ""], keep_default_na=True)

def clean_kaggle_data(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    required = {"hotel","is_canceled","arrival_date_year","arrival_date_month","arrival_date_day_of_month"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {missing}")
    df["children"] = df["children"].fillna(0).astype(int)
    df["country"] = df["country"].fillna("Unknown")
    df["is_canceled"] = df["is_canceled"].astype(int)
    month_num = df["arrival_date_month"].map(MONTH_NAME_TO_NUM)
    df = df[month_num.notna()]; month_num = month_num[month_num.notna()]
    arrival_date = pd.to_datetime(dict(
        year=df["arrival_date_year"], month=month_num.astype(int),
        day=df["arrival_date_day_of_month"]), errors="coerce")
    bad = arrival_date.isna()
    df = df[~bad].copy()
    df["arrival_date"] = arrival_date[~bad]
    unknown = set(df["hotel"].unique()) - set(HOTEL_ID_MAP)
    if unknown:
        raise ValueError(f"Unknown hotel values: {unknown}")
    return df

def aggregate_kaggle_daily(df: pd.DataFrame) -> pd.DataFrame:
    grouped = (df.groupby(["hotel","arrival_date"])
               .agg(bookings=("is_canceled","size"), canceled=("is_canceled","sum"))
               .reset_index().rename(columns={"arrival_date":"date"}))
    grouped["hotel_id"] = grouped["hotel"].map(HOTEL_ID_MAP)
    grouped["hotel_name"] = grouped["hotel"]
    grouped["source"] = DataSource.KAGGLE_PRETRAIN.value
    filled = []
    for hotel_id, sub in grouped.groupby("hotel_id"):
        hotel_name = grouped.loc[grouped["hotel_id"]==hotel_id, "hotel_name"].iloc[0]
        full_range = pd.date_range(sub["date"].min(), sub["date"].max(), freq="D")
        sub = sub.set_index("date").reindex(full_range)
        sub["hotel_id"] = hotel_id
        sub["hotel_name"] = hotel_name
        sub["bookings"] = sub["bookings"].fillna(0).astype(int)
        sub["canceled"] = sub["canceled"].fillna(0).astype(int)
        sub["source"] = DataSource.KAGGLE_PRETRAIN.value
        sub.index.name = "date"
        filled.append(sub.reset_index())
    result = pd.concat(filled, ignore_index=True)
    result = result[["hotel_id","hotel_name","date","bookings","canceled","source"]]
    return result.sort_values(["hotel_id","date"]).reset_index(drop=True)

def load_kaggle_daily_counts(raw_csv_path: Path | None = None) -> pd.DataFrame:
    return aggregate_kaggle_daily(clean_kaggle_data(load_raw_kaggle_csv(raw_csv_path)))