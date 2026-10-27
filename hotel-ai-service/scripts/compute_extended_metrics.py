from __future__ import annotations
import sys, warnings
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import mean_absolute_percentage_error
from statsmodels.stats.diagnostic import acorr_ljungbox
from app.config import settings

warnings.filterwarnings("ignore")
SEED, B = 42, 2000
rng = np.random.default_rng(SEED)
EXP = settings.processed_dir.parent.parent / "experiments"
WINDOWS = ["14d", "30d", "90d", "180d", "full"]
METHODS = ["seasonal_naive", "moving_average", "ets", "prophet_only", "xgb_self_only", "xgb_pooled",
           "prophet_tuned", "xgb_self_only_tuned", "xgb_pooled_tuned",
           "comb_prophet_tuned_snaive", "comb_pooled_tuned_snaive"]
PAIRS = [("xgb_pooled", "xgb_self_only"), ("xgb_pooled_tuned", "xgb_self_only_tuned")]
TESTS = [("xgb_pooled", "prophet_only"), ("xgb_pooled_tuned", "prophet_tuned"),
         ("xgb_pooled_tuned", "seasonal_naive"), ("prophet_tuned", "prophet_only"), ("prophet_tuned", "seasonal_naive"),
         ("comb_prophet_tuned_snaive", "seasonal_naive"), ("comb_pooled_tuned_snaive", "seasonal_naive"),
         ("xgb_pooled", "seasonal_naive")]
P = pd.read_csv(EXP / "coldstart_predictions_v2.csv")
P["date"] = pd.to_datetime(P["date"], format="mixed").dt.normalize()

def lb_p(r):
    try:
        return acorr_ljungbox(r, lags=[7], return_df=True)["lb_pvalue"].iloc[0]
    except Exception:
        return np.nan

def group_metrics(g):
    g = g.sort_values(["hotel", "date"])
    a, p = g.actual.values, g.predicted.values
    e = p - a; ae = np.abs(e); den = np.abs(a) + np.abs(p)
    o = dict(n_hotels=g.hotel.nunique(), n_obs=len(g), mae=ae.mean(), rmse=np.sqrt((e ** 2).mean()),
             mape=mean_absolute_percentage_error(a, p) * 100, wape=ae.sum() / a.sum() * 100,
             smape=np.mean(np.where(den == 0, 0, 2 * ae / np.where(den == 0, 1, den))) * 100, bias=e.mean())
    o["accuracy"] = 100 - o["mape"]
    bs = ae[rng.integers(0, len(ae), (B, len(ae)))].mean(axis=1)
    o["mae_ci_low"], o["mae_ci_high"] = np.percentile(bs, [2.5, 97.5])
    mases, hits, lbs, tp, fp, fn = [], [], [], 0, 0, 0
    for _, h in g.groupby("hotel"):
        ha, hp = h.actual.values, h.predicted.values
        mases.append(np.abs(hp - ha).mean() / max(h.mase_scale.iloc[0], 1e-9))
        hits += list(np.sign(np.diff(ha)) == np.sign(np.diff(hp)))
        lbs.append(lb_p(ha - hp))
        pa, pp = ha >= np.quantile(ha, .9), hp >= np.quantile(hp, .9)
        tp += (pa & pp).sum(); fp += (~pa & pp).sum(); fn += (pa & ~pp).sum()
    o["mase"] = np.mean(mases); o["directional_acc"] = np.mean(hits) * 100
    o["ljung_box_p_mean"] = np.nanmean(lbs) if not np.all(np.isnan(lbs)) else np.nan
    pr = tp / (tp + fp) if tp + fp else np.nan; rc = tp / (tp + fn) if tp + fn else np.nan
    o["peak_precision"], o["peak_recall"] = pr, rc
    o["peak_f1"] = (2 * pr * rc / (pr + rc) if (pr + rc) > 0 else 0.0) if (pr == pr and rc == rc) else np.nan
    iv = g.dropna(subset=["lower", "upper"])
    o["pi_coverage"] = ((iv.actual >= iv.lower) & (iv.actual <= iv.upper)).mean() * 100 if len(iv) else np.nan
    o["pi_mean_width"] = (iv.upper - iv.lower).mean() if len(iv) else np.nan
    t = g.groupby("hotel")[["train_seconds", "infer_seconds", "model_bytes"]].first().mean()
    o["train_seconds"], o["infer_seconds"], o["model_bytes"] = t.train_seconds, t.infer_seconds, t.model_bytes
    return o

R = pd.DataFrame([{"window": w, "method": m, **group_metrics(g)} for (w, m), g in P.groupby(["window", "method"])])
sn = R[R.method == "seasonal_naive"].set_index("window").mae
R["skill_vs_snaive"] = 1 - R.mae / R.window.map(sn)

hm = P.assign(ae=(P.predicted - P.actual).abs()).groupby(["window", "hotel", "method"]).ae.mean().reset_index()
win = hm.loc[hm.groupby(["window", "hotel"]).ae.idxmin()].groupby(["window", "method"]).size()
win = win.div(hm.groupby("window").hotel.nunique(), level="window").rename("win_rate").reset_index()
R = R.merge(win, on=["window", "method"], how="left"); R["win_rate"] = R.win_rate.fillna(0)

present = set(hm.method); tg = []
for pooled, selfm in PAIRS:
    if pooled not in present or selfm not in present:
        continue
    pv = hm.pivot_table(index=["window", "hotel"], columns="method", values="ae").dropna(subset=[pooled, selfm])
    gain = ((pv[selfm] - pv[pooled]) / pv[selfm] * 100).groupby(level="window").mean().rename("transfer_gain_pct")
    neg = (pv[pooled] > pv[selfm]).groupby(level="window").mean().rename("negative_transfer_rate")
    tg.append(pd.concat([gain, neg], axis=1).reset_index().assign(method=pooled))
R = R.merge(pd.concat(tg), on=["window", "method"], how="left")

sig = []
for w in WINDOWS:
    for cand, ref in TESTS:
        a = P[(P.window == w) & (P.method == ref)].set_index(["hotel", "date"])
        b = P[(P.window == w) & (P.method == cand)].set_index(["hotel", "date"])
        j = a[["actual", "predicted"]].join(b[["predicted"]], lsuffix="_ref", rsuffix="_cand", how="inner")
        if len(j) < 3:
            continue
        d = (j.predicted_ref - j.actual).abs() - (j.predicted_cand - j.actual).abs()  # >0 => candidate better
        dm = d.mean() / np.sqrt(d.var(ddof=1) / len(d))
        try:
            wp = stats.wilcoxon(d).pvalue
        except Exception:
            wp = np.nan
        sig.append(dict(window=w, candidate=cand, reference=ref, n_pairs=len(d), mean_abs_err_gain=d.mean(),
                        dm_stat=dm, dm_p=2 * (1 - stats.t.cdf(abs(dm), len(d) - 1)), wilcoxon_p=wp))

R["window"] = pd.Categorical(R.window, WINDOWS, ordered=True)
R["method"] = pd.Categorical(R.method, METHODS, ordered=True)
R = R.sort_values(["window", "method"])
R.to_csv(EXP / "coldstart_extended_metrics_v2.csv", index=False)
pd.DataFrame(sig).to_csv(EXP / "coldstart_significance_v2.csv", index=False)
print(R.pivot(index="window", columns="method", values="mae").round(2).to_string())
print("\nSaved metrics + significance (v2) | seed", SEED, "| bootstrap B", B)