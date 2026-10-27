from __future__ import annotations
import sys, time, pickle, random, warnings
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import numpy as np
import pandas as pd
from prophet.serialize import model_to_json
from app.config import settings
from app.data.pipeline import run_pipeline
from app.models.prophet_baseline import fit_prophet_baseline
from app.models.coldstart import fit_prophet_window
from app.models.feature_engineering import add_features, FEATURE_COLS
from app.models.xgboost_pooled import train_pooled_xgb

SEED = 42
random.seed(SEED); np.random.seed(SEED); warnings.filterwarnings("ignore")
WINDOWS = [("14d", 14), ("30d", 30), ("90d", 90), ("180d", 180), ("full", None)]
TEST_DAYS = 30
BASE = dict(n_estimators=120, max_depth=3, learning_rate=0.05, reg_lambda=5.0, random_state=SEED)
GRID = [BASE, dict(BASE, n_estimators=60, max_depth=2, reg_lambda=10.0),
        dict(BASE, n_estimators=200, reg_lambda=1.0), dict(BASE, n_estimators=100, max_depth=4)]
EXP = settings.processed_dir.parent.parent / "experiments"
NF = FEATURE_COLS[:-1]

def mae(a, p):
    return float(np.mean(np.abs(np.asarray(a, float) - np.asarray(p, float))))

def pick_growth(hdf, hid, start, cutoff):
    """Choose linear vs flat trend on a validation slice at the END of the training window."""
    tr = hdf[(hdf.date >= start) & (hdf.date <= cutoff)]
    v = min(14, max(5, len(tr) // 4))
    if len(tr) <= v + 5:
        return None
    tr_end = tr.date.iloc[-v - 1]
    best = None
    for g in ("linear", "flat"):
        r = fit_prophet_window(hdf, hid, start, tr_end, cutoff, growth=g)
        if r is None:
            continue
        m = r[0]; val = m[m.date > tr_end]
        s = mae(val.actual, val.predicted)
        if best is None or s < best[0]:
            best = (s, g, m, tr_end)
    return best

def pick_cfg(a, v):
    if len(v) < 5:
        return BASE
    sc = [(mae(v.actual, v.predicted + train_pooled_xgb(a, **c).predict(v[FEATURE_COLS])), i)
          for i, c in enumerate(GRID)]
    return GRID[min(sc)[1]]

def main():
    df = run_pipeline()
    df = df[(df["source"] == "kaggle_pretrain") | (df["date"] <= pd.Timestamp("2026-09-13"))]
    assert df.hotel_id.nunique() >= 5, "Platform data missing - fix the DB connection first"
    ids = sorted(df.hotel_id.unique())
    full_res = {h: fit_prophet_baseline(df[df.hotel_id == h], h)[2] for h in ids}
    out = []

    for cold in ids:
        hdf = df[df.hotel_id == cold].sort_values("date")
        max_d = hdf.date.max(); cutoff = max_d - pd.Timedelta(days=TEST_DAYS); min_d = hdf.date.min()
        test = hdf[hdf.date > cutoff]
        others = [h for h in ids if h != cold]
        for label, win in WINDOWS:
            start = min_d if win is None else max(min_d, cutoff - pd.Timedelta(days=win))
            train = hdf[(hdf.date >= start) & (hdf.date <= cutoff)]
            if len(train) < 14 or test.empty:
                continue
            y = train.bookings.values.astype(float); n = len(test)
            meta = dict(hotel=cold, window=label, mase_scale=np.mean(np.abs(y[7:] - y[:-7])))
            sn_s = pd.Series(np.tile(y[-7:], n // 7 + 1)[:n], index=test.date.values)

            def emit(method, dates, act, pred, lo=np.nan, hi=np.nan, tr_s=np.nan, inf_s=np.nan, size=np.nan):
                out.append(pd.DataFrame({**meta, "method": method, "date": dates, "actual": act,
                    "predicted": pred, "lower": lo, "upper": hi,
                    "train_seconds": tr_s, "infer_seconds": inf_s, "model_bytes": size}))

            t = time.perf_counter(); best = pick_growth(hdf, cold, start, cutoff); sel_s = time.perf_counter() - t
            g = best[1] if best else "linear"
            r = fit_prophet_window(hdf, cold, start, cutoff, max_d, growth=g)
            if r is None:
                continue
            merged, pmodel, p_fit, p_inf = r
            p_size = len(model_to_json(pmodel))
            te = merged[merged.date > cutoff]
            emit("prophet_tuned", te.date.values, te.actual.values, te.predicted.values,
                 te.lower.values, te.upper.values, sel_s + p_fit, p_inf, p_size)
            emit("comb_prophet_tuned_snaive", te.date.values, te.actual.values,
                 0.5 * te.predicted.values + 0.5 * sn_s.reindex(te.date.values).values,
                 tr_s=sel_s + p_fit, inf_s=p_inf, size=p_size)

            # self-only XGBoost on tuned-Prophet residuals
            fs = add_features(merged)
            a = fs[fs.date <= cutoff].dropna(subset=NF); b = fs[fs.date > cutoff].dropna(subset=NF)
            if len(a) >= 5 and not b.empty:
                cfg, t = BASE, time.perf_counter()
                if best and len(a) >= 40:
                    ms = add_features(best[2])
                    cfg = pick_cfg(ms[ms.date <= best[3]].dropna(subset=NF), ms[ms.date > best[3]].dropna(subset=NF))
                tune_s = time.perf_counter() - t
                t = time.perf_counter(); m = train_pooled_xgb(a, **cfg); x_fit = time.perf_counter() - t
                t = time.perf_counter(); c = m.predict(b[FEATURE_COLS]); x_inf = time.perf_counter() - t
                emit("xgb_self_only_tuned", b.date.values, b.actual.values, b.predicted.values + c,
                     b.lower.values + c, b.upper.values + c, sel_s + p_fit + tune_s + x_fit,
                     p_inf + x_inf, p_size + len(pickle.dumps(m)))

            # pooled XGBoost (leave-one-hotel-out) on tuned-Prophet residuals
            pool = add_features(pd.concat([full_res[h] for h in others] + [merged], ignore_index=True))
            a = pool[pool.hotel_id.isin(others)].dropna(subset=NF)
            b = pool[(pool.hotel_id == cold) & (pool.date > cutoff)].dropna(subset=NF)
            if not b.empty:
                cfg, t = BASE, time.perf_counter()
                if best:
                    pv = add_features(pd.concat([full_res[h] for h in others] + [best[2]], ignore_index=True))
                    cfg = pick_cfg(a, pv[(pv.hotel_id == cold) & (pv.date > best[3])].dropna(subset=NF))
                tune_s = time.perf_counter() - t
                t = time.perf_counter(); m = train_pooled_xgb(a, **cfg); x_fit = time.perf_counter() - t
                t = time.perf_counter(); c = m.predict(b[FEATURE_COLS]); x_inf = time.perf_counter() - t
                pred = b.predicted.values + c
                tr_s, inf_s, size = sel_s + p_fit + tune_s + x_fit, p_inf + x_inf, p_size + len(pickle.dumps(m))
                emit("xgb_pooled_tuned", b.date.values, b.actual.values, pred,
                     b.lower.values + c, b.upper.values + c, tr_s, inf_s, size)
                emit("comb_pooled_tuned_snaive", b.date.values, b.actual.values,
                     0.5 * pred + 0.5 * sn_s.reindex(b.date.values).values, tr_s=tr_s, inf_s=inf_s, size=size)
            print(cold[:20], label, "growth =", g, "done")

    old = pd.read_csv(EXP / "coldstart_predictions.csv")   # earlier run, left untouched
    pd.concat([old, pd.concat(out, ignore_index=True)], ignore_index=True).to_csv(
        EXP / "coldstart_predictions_v2.csv", index=False)
    print("Saved", EXP / "coldstart_predictions_v2.csv")

if __name__ == "__main__":
    main()