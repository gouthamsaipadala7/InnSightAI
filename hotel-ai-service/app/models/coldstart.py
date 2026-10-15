from __future__ import annotations
import pandas as pd
from prophet import Prophet

def fit_prophet_window(hotel_df: pd.DataFrame, hotel_id: str, train_start, train_end, test_end):
    """Fit Prophet using ONLY rows in [train_start, train_end], then predict
    across [train_start, test_end]. Returns None if too little training data."""
    hotel_df = hotel_df.sort_values("date")
    train_df = hotel_df[(hotel_df["date"] >= train_start) & (hotel_df["date"] <= train_end)]
    if len(train_df) < 5:
        return None

    ds_train = train_df[["date", "bookings"]].rename(columns={"date": "ds", "bookings": "y"})
    model = Prophet(weekly_seasonality=True, yearly_seasonality=False, daily_seasonality=False)
    try:
        model.add_country_holidays(country_name="IN")
    except Exception:
        pass
    model.fit(ds_train)

    predict_range = hotel_df[(hotel_df["date"] >= train_start) & (hotel_df["date"] <= test_end)]
    forecast = model.predict(predict_range[["date"]].rename(columns={"date": "ds"}))
    merged = predict_range[["date", "bookings"]].rename(columns={"bookings": "actual"}).merge(
        forecast[["ds", "yhat"]].rename(columns={"ds": "date", "yhat": "predicted"}), on="date")
    merged["residual"] = merged["actual"] - merged["predicted"]
    merged["hotel_id"] = hotel_id
    return merged