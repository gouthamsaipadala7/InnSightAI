from __future__ import annotations
import time
import pandas as pd
from prophet import Prophet

def fit_prophet_window(hotel_df, hotel_id, train_start, train_end, test_end, growth="linear"):
    hotel_df = hotel_df.sort_values("date")
    train_df = hotel_df[(hotel_df["date"] >= train_start) & (hotel_df["date"] <= train_end)]
    if len(train_df) < 5:
        return None
    ds = train_df[["date", "bookings"]].rename(columns={"date": "ds", "bookings": "y"})
    model = Prophet(growth=growth, weekly_seasonality=True, yearly_seasonality=False, daily_seasonality=False)
    try:
        model.add_country_holidays(country_name="IN")
    except Exception:
        pass
    t = time.perf_counter(); model.fit(ds); fit_s = time.perf_counter() - t

    rng = hotel_df[(hotel_df["date"] >= train_start) & (hotel_df["date"] <= test_end)]
    t = time.perf_counter()
    fc = model.predict(rng[["date"]].rename(columns={"date": "ds"}))
    inf_s = time.perf_counter() - t

    merged = rng[["date", "bookings"]].rename(columns={"bookings": "actual"}).merge(
        fc[["ds", "yhat", "yhat_lower", "yhat_upper"]].rename(
            columns={"ds": "date", "yhat": "predicted", "yhat_lower": "lower", "yhat_upper": "upper"}),
        on="date")
    merged["residual"] = merged["actual"] - merged["predicted"]
    merged["hotel_id"] = hotel_id
    return merged, model, fit_s, inf_s