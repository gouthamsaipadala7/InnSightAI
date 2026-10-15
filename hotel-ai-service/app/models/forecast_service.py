from __future__ import annotations
import pandas as pd
from prophet import Prophet
from app.config import settings
from app.data.pipeline import COMBINED_FILENAME, run_pipeline
from app.models.feature_engineering import FEATURE_COLS
from app.models.xgboost_pooled import load_model, MODEL_FILENAME

HORIZON_DAYS = {"daily": 30, "monthly": 365, "yearly": 730}

def _load_hotel_history(hotel_id: str) -> pd.DataFrame:
    path = settings.processed_dir / COMBINED_FILENAME
    df = pd.read_csv(path, parse_dates=["date"]) if path.exists() else run_pipeline()
    hdf = df[df["hotel_id"] == hotel_id].sort_values("date")
    if hdf.empty:
        raise ValueError(f"Unknown hotel_id: {hotel_id}")
    return hdf

def _fit_and_forecast(hotel_id: str, horizon_days: int):
    hdf = _load_hotel_history(hotel_id)
    ds = hdf[["date", "bookings"]].rename(columns={"date": "ds", "bookings": "y"})
    model = Prophet(weekly_seasonality=True, yearly_seasonality=len(ds) >= 365, daily_seasonality=False)
    try:
        model.add_country_holidays(country_name="IN")
    except Exception:
        pass
    model.fit(ds)

    future = model.make_future_dataframe(periods=horizon_days)
    forecast = model.predict(future)

    hist = hdf[["date", "bookings"]].rename(columns={"bookings": "actual"})
    merged = hist.merge(
        forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].rename(columns={"ds": "date"}),
        on="date", how="right",
    )
    return merged.sort_values("date").reset_index(drop=True), hdf["date"].max()

def _apply_xgb_correction(merged: pd.DataFrame, hotel_id: str, cutoff) -> pd.DataFrame:
    xgb_model = load_model(settings.processed_dir / MODEL_FILENAME)
    merged = merged.copy()
    merged["residual"] = merged["actual"] - merged["yhat"]
    merged["yhat_corrected"] = merged["yhat"]

    for i, row in merged.iterrows():
        if row["date"] <= cutoff:
            continue
        prior = merged["residual"].iloc[:i]
        lag1 = prior.iloc[-1] if len(prior) >= 1 else 0.0
        lag7 = prior.iloc[-7] if len(prior) >= 7 else lag1
        roll = prior.tail(7)
        feat = pd.DataFrame([{
            "dow": row["date"].dayofweek, "month": row["date"].month,
            "is_weekend": int(row["date"].dayofweek >= 5), "is_holiday": 0,
            "lag1": lag1, "lag7": lag7,
            "roll_mean7": roll.mean() if len(roll) else 0.0,
            "roll_std7": roll.std() if len(roll) > 1 else 0.0,
            "hotel_id": hotel_id,
        }])
        feat["hotel_id"] = feat["hotel_id"].astype("category")
        correction = float(xgb_model.predict(feat[FEATURE_COLS])[0])
        merged.at[i, "residual"] = correction
        merged.at[i, "yhat_corrected"] = row["yhat"] + correction
    return merged

def generate_forecast(hotel_id: str, window: str) -> list[dict]:
    if window not in HORIZON_DAYS:
        raise ValueError("window must be daily, monthly, or yearly")

    merged, cutoff = _fit_and_forecast(hotel_id, HORIZON_DAYS[window])
    merged = _apply_xgb_correction(merged, hotel_id, cutoff)

    if window == "monthly":
        merged["period"] = merged["date"].dt.to_period("M").astype(str)
    elif window == "yearly":
        merged["period"] = merged["date"].dt.to_period("Y").astype(str)
    else:
        merged["period"] = merged["date"].dt.strftime("%Y-%m-%d")

    merged["actual"] = merged["actual"].where(merged["date"] <= cutoff, other=pd.NA)

    agg = merged.groupby("period").agg(
        actual=("actual", lambda s: s.sum(min_count=1)),
        forecast=("yhat_corrected", "sum"),
        lower=("yhat_lower", "sum"),
        upper=("yhat_upper", "sum"),
        date=("date", "max"),
    ).reset_index().sort_values("date")

    agg = agg.astype(object).where(pd.notnull(agg), None)
    return agg.to_dict(orient="records")