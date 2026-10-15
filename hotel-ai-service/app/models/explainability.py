from __future__ import annotations
import pandas as pd
import shap
from app.config import settings
from app.data.pipeline import run_pipeline, COMBINED_FILENAME
from app.models.prophet_baseline import fit_prophet_baseline
from app.models.feature_engineering import add_features, FEATURE_COLS
from app.models.xgboost_pooled import load_model, MODEL_FILENAME

_model = None
_explainer = None
_residuals_cache = None

def _label(feature: str, shap_val: float, row: pd.Series) -> str:
    """Translate one feature's SHAP contribution into a plain-language phrase."""
    pct = f"{'+' if shap_val >= 0 else ''}{shap_val:.1f}"
    if feature == "is_weekend":
        return f"Weekend effect: {pct} bookings" if row["is_weekend"] else f"Weekday pattern: {pct} bookings"
    if feature == "is_holiday":
        return f"Holiday effect: {pct} bookings" if row["is_holiday"] else f"No holiday nearby: {pct} bookings"
    if feature == "dow":
        return f"Day-of-week pattern: {pct} bookings"
    if feature == "month":
        return f"Seasonal (monthly) pattern: {pct} bookings"
    if feature == "lag1":
        return f"Yesterday's booking momentum: {pct} bookings"
    if feature == "lag7":
        return f"Same day last week: {pct} bookings"
    if feature in ("roll_mean7", "roll_std7"):
        return f"Recent 7-day booking trend: {pct} bookings"
    if feature == "hotel_id":
        return f"Pattern learned from similar hotels: {pct} bookings"
    return f"{feature}: {pct} bookings"

def _load_artifacts():
    global _model, _explainer, _residuals_cache
    if _model is None:
        _model = load_model(settings.processed_dir / MODEL_FILENAME)
        _explainer = shap.TreeExplainer(_model)

        combined_path = settings.processed_dir / COMBINED_FILENAME
        df = pd.read_csv(combined_path, parse_dates=["date"]) if combined_path.exists() else run_pipeline()

        residual_rows = []
        for hotel_id, hdf in df.groupby("hotel_id"):
            _, _, res_df, _ = fit_prophet_baseline(hdf, hotel_id)
            residual_rows.append(res_df)
        residuals_df = pd.concat(residual_rows, ignore_index=True)
        _residuals_cache = add_features(residuals_df).dropna(subset=FEATURE_COLS[:-1])
    return _model, _explainer, _residuals_cache

def explain_forecast(hotel_id: str, date: str, top_n: int = 3) -> list[str]:
    """Returns top_n plain-language reasons for the XGBoost residual
    correction applied to this hotel/date's forecast."""
    model, explainer, residuals_df = _load_artifacts()

    date = pd.to_datetime(date)
    row = residuals_df[(residuals_df["hotel_id"] == hotel_id) & (residuals_df["date"] == date)]
    if row.empty:
        return [f"No data available for hotel_id={hotel_id} on {date.date()}."]

    row = row.iloc[0]
    X = row[FEATURE_COLS].to_frame().T
    for col in FEATURE_COLS:
        X[col] = X[col].astype(residuals_df[col].dtype)

    shap_values = explainer.shap_values(X)[0]
    contributions = sorted(zip(FEATURE_COLS, shap_values), key=lambda x: abs(x[1]), reverse=True)

    return [_label(feat, val, row) for feat, val in contributions[:top_n]]