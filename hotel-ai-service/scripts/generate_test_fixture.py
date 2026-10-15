from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import numpy as np
import pandas as pd
from app.config import settings

RNG = np.random.default_rng(42)

def _dates(year, n):
    d = pd.date_range(f"{year}-01-01", f"{year}-12-31", freq="D")
    c = RNG.choice(d, size=n, replace=True)
    return pd.DataFrame({"arrival_date_year": pd.DatetimeIndex(c).year,
                          "arrival_date_month": pd.DatetimeIndex(c).month_name(),
                          "arrival_date_day_of_month": pd.DatetimeIndex(c).day})

def generate_fixture(n_per_hotel=4000, years=(2023,2024)) -> pd.DataFrame:
    rows = []
    for hotel in ["City Hotel","Resort Hotel"]:
        for year in years:
            n = n_per_hotel // len(years)
            dp = _dates(year, n)
            is_canceled = RNG.binomial(1, 0.18, size=n)
            children = RNG.choice([0,0,0,1,2,np.nan], size=n, p=[0.7,0.1,0.1,0.05,0.03,0.02])
            country = RNG.choice(["PRT","GBR","USA","FRA","DEU",np.nan], size=n, p=[0.4,0.2,0.15,0.1,0.1,0.05])
            adr = np.round(RNG.normal(100 if hotel=="City Hotel" else 130, 30, size=n).clip(0), 2)
            rows.append(pd.DataFrame({
                "hotel": hotel, "is_canceled": is_canceled, "lead_time": RNG.integers(0,400,size=n),
                **dp, "stays_in_weekend_nights": RNG.integers(0,4,size=n),
                "stays_in_week_nights": RNG.integers(0,10,size=n),
                "adults": RNG.integers(1,4,size=n), "children": children,
                "babies": RNG.integers(0,2,size=n), "meal":"BB", "country": country,
                "market_segment":"Online TA","distribution_channel":"TA/TO",
                "is_repeated_guest":0,"previous_cancellations":0,"previous_bookings_not_canceled":0,
                "reserved_room_type":"A","assigned_room_type":"A","booking_changes":0,
                "deposit_type":"No Deposit","agent":np.nan,"company":np.nan,
                "days_in_waiting_list":0,"customer_type":"Transient","adr":adr,
                "required_car_parking_spaces":0,"total_of_special_requests":RNG.integers(0,3,size=n),
                "reservation_status": np.where(is_canceled,"Canceled","Check-Out"),
                "reservation_status_date": pd.Timestamp(f"{year}-01-01"),
            }))
    return pd.concat(rows, ignore_index=True)

if __name__ == "__main__":
    df = generate_fixture()
    out = settings.raw_dir / "hotel_bookings.csv"
    df.to_csv(out, index=False)
    print(f"Wrote {len(df)} TEST FIXTURE rows to {out} (NOT real Kaggle data)")