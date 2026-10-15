from __future__ import annotations
import numpy as np
import pandas as pd
from prophet import Prophet
from sklearn.metrics import mean_absolute_percentage_error, root_mean_squared_error

def fit_prophet_baseline(hotel_df: pd.DataFrame, hotel_id: str):
    """hotel_df needs columns: date, bookings. Returns (model, preds_df, residuals_df, metrics)."""
    df = hotel_df[["date", "bookings"]].rename(columns={"date": "ds", "bookings": "y"}).sort_values("ds")
    span_days = (df["ds"].max() - df["ds"].min()).days

    model = Prophet(
        weekly_seasonality=True,
        yearly_seasonality=span_days >= 365,
        daily_seasonality=False,
    )
    try:
        model.add_country_holidays(country_name="IN")
    except Exception:
        pass  # holiday data unavailable, skip silently

    model.fit(df)

    forecast = model.predict(df[["ds"]])
    preds = forecast[["ds", "yhat"]].rename(columns={"ds": "date", "yhat": "predicted"})

    merged = df.rename(columns={"ds": "date", "y": "actual"}).merge(preds, on="date")
    merged["residual"] = merged["actual"] - merged["predicted"]
    merged["hotel_id"] = hotel_id

    mape = mean_absolute_percentage_error(merged["actual"], merged["predicted"]) * 100
    rmse = root_mean_squared_error(merged["actual"], merged["predicted"])
    metrics = {"hotel_id": hotel_id, "mape": mape, "rmse": rmse, "n_days": len(merged)}

    residuals_df = merged[["hotel_id", "date", "actual", "predicted", "residual"]]
    return model, preds, residuals_df, metrics