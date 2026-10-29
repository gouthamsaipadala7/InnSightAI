from __future__ import annotations
import sys, time, pickle, random, warnings
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from prophet.serialize import model_to_json
from app.config import settings
from app.data.pipeline import run_pipeline
from app.models.prophet_baseline import fit_prophet_baseline
from app.models.coldstart import fit_prophet_window
from app.models.feature_engineering import add_features, FEATURE_COLS
from app.models.xgboost_pooled import train_pooled_xgb

SEED = 42
random.seed(SEED); np.random.seed(SEED)
warnings.filterwarnings("ignore")
WINDOWS = [("14d", 14), ("30d", 30), ("90d", 90), ("180d", 180), ("full", None)]
TEST_DAYS = 30
XGB = dict(n_estimators=120, max_depth=3, learning_rate=0.05, reg_lambda=5.0, random_state=SEED)
EXP = settings.processed_dir.parent.parent / "experiments"
EXP.mkdir(parents=True, exist_ok=True)

def main():
    df = run_pipeline()
    # platform seed ended 2026-09-13; later rows are live app check-ins, not demand history
    df = df[(df["source"] == "kaggle_pretrain") | (df["date"] <= pd.Timestamp("2026-09-13"))]
    assert df.hotel_id.nunique() >= 5, "Platform data missing - fix the DB connection first"
    ids = sorted(df["hotel_id"].unique())
    full_res = {h: fit_prophet_baseline(df[df.hotel_id == h], h)[2] for h in ids}
    out = []

    for cold in ids:
        hdf = df[df.hotel_id == cold].sort_values("date")
        max_d = hdf.date.max(); cutoff = max_d - pd.Timedelta(days=TEST_DAYS); min_d = hdf.date.min()
        test = hdf[hdf.date > cutoff]
        for label, win in WINDOWS:
            start = min_d if win is None else max(min_d, cutoff - pd.Timedelta(days=win))
            train = hdf[(hdf.date >= start) & (hdf.date <= cutoff)]
            if len(train) < 14 or test.empty:
                continue
            y = train.bookings.values.astype(float); n = len(test)
            actual = test.bookings.values.astype(float)
            meta = dict(hotel=cold, window=label, mase_scale=np.mean(np.abs(y[7:] - y[:-7])))

            def emit(method, dates, act, pred, lo=np.nan, hi=np.nan, tr_s=np.nan, inf_s=np.nan, size=np.nan):
                out.append(pd.DataFrame({**meta, "method": method, "date": dates, "actual": act,
                    "predicted": pred, "lower": lo, "upper": hi,
                    "train_seconds": tr_s, "infer_seconds": inf_s, "model_bytes": size}))

            # --- baselines ---
            t = time.perf_counter(); last = y[-7:]; p = np.tile(last, n // 7 + 1)[:n]
            emit("seasonal_naive", test.date.values, actual, p, tr_s=0.0, inf_s=time.perf_counter() - t, size=last.nbytes)
            t = time.perf_counter(); p = np.full(n, y[-7:].mean())
            emit("moving_average", test.date.values, actual, p, tr_s=0.0, inf_s=time.perf_counter() - t, size=8)
            try:
                t = time.perf_counter()
                res = ExponentialSmoothing(y, trend=None, seasonal="add", seasonal_periods=7).fit()
                tr_s = time.perf_counter() - t
                t = time.perf_counter(); p = res.forecast(n); inf_s = time.perf_counter() - t
                res.remove_data()
                emit("ets", test.date.values, actual, p, tr_s=tr_s, inf_s=inf_s, size=len(pickle.dumps(res)))
            except Exception:
                pass

            # --- Prophet ---
            pr = fit_prophet_window(hdf, cold, start, cutoff, max_d)
            if pr is None:
                continue
            merged, pmodel, p_fit, p_inf = pr
            p_size = len(model_to_json(pmodel))
            tr = merged[merged.date > cutoff]
            emit("prophet_only", tr.date.values, tr.actual.values, tr.predicted.values,
                 tr.lower.values, tr.upper.values, p_fit, p_inf, p_size)

            # --- XGBoost on own residuals only ---
            fs = add_features(merged)
            a = fs[fs.date <= cutoff].dropna(subset=FEATURE_COLS[:-1])
            b = fs[fs.date > cutoff].dropna(subset=FEATURE_COLS[:-1])
            if len(a) >= 5 and not b.empty:
                t = time.perf_counter(); m = train_pooled_xgb(a, **XGB); x_fit = time.perf_counter() - t
                t = time.perf_counter(); c = m.predict(b[FEATURE_COLS]); x_inf = time.perf_counter() - t
                emit("xgb_self_only", b.date.values, b.actual.values, b.predicted.values + c,
                     b.lower.values + c, b.upper.values + c, p_fit + x_fit, p_inf + x_inf, p_size + len(pickle.dumps(m)))

            # --- pooled XGBoost (leave-one-hotel-out) ---
            others = [h for h in ids if h != cold]
            pool = add_features(pd.concat([full_res[h] for h in others] + [merged], ignore_index=True))
            a = pool[pool.hotel_id.isin(others)].dropna(subset=FEATURE_COLS[:-1])
            b = pool[(pool.hotel_id == cold) & (pool.date > cutoff)].dropna(subset=FEATURE_COLS[:-1])
            if not b.empty:
                t = time.perf_counter(); m = train_pooled_xgb(a, **XGB); x_fit = time.perf_counter() - t
                t = time.perf_counter(); c = m.predict(b[FEATURE_COLS]); x_inf = time.perf_counter() - t
                emit("xgb_pooled", b.date.values, b.actual.values, b.predicted.values + c,
                     b.lower.values + c, b.upper.values + c, p_fit + x_fit, p_inf + x_inf, p_size + len(pickle.dumps(m)))
            print(cold[:20], label, "done")

    pd.concat(out, ignore_index=True).to_csv(EXP / "coldstart_predictions.csv", index=False)
    print("Saved", EXP / "coldstart_predictions.csv")

if __name__ == "__main__":
    main()