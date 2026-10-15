from __future__ import annotations
import joblib
import pandas as pd
import xgboost as xgb
from app.models.feature_engineering import FEATURE_COLS

MODEL_FILENAME = "xgboost_pooled_residual.joblib"

def time_based_split(df: pd.DataFrame, test_frac: float = 0.2):
    """Per-hotel: last test_frac of rows (by date) become test set."""
    train_parts, test_parts = [], []
    for _, hdf in df.groupby("hotel_id", observed=True):
        hdf = hdf.sort_values("date")
        split_idx = int(len(hdf) * (1 - test_frac))
        train_parts.append(hdf.iloc[:split_idx])
        test_parts.append(hdf.iloc[split_idx:])
    return pd.concat(train_parts), pd.concat(test_parts)

def train_pooled_xgb(train_df: pd.DataFrame, **xgb_params) -> xgb.XGBRegressor:
    params = dict(n_estimators=300, max_depth=4, learning_rate=0.05,
                  tree_method="hist", enable_categorical=True, random_state=42)
    params.update(xgb_params)
    model = xgb.XGBRegressor(**params)
    model.fit(train_df[FEATURE_COLS], train_df["residual"])
    return model

def save_model(model: xgb.XGBRegressor, path) -> None:
    joblib.dump(model, path)

def load_model(path) -> xgb.XGBRegressor:
    return joblib.load(path)