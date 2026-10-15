from datetime import datetime, timezone
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Literal, Optional
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.models.forecast_service import generate_forecast
from app.models.explainability import explain_forecast

SERVICE_NAME = "hotel-ai-service"
SERVICE_VERSION = "0.1.0"
app = FastAPI(title="Hotel AI Forecasting Service", version=SERVICE_VERSION)

class HealthResponse(BaseModel):
    status: str; service: str; version: str; timestamp: str

@app.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(status="ok", service=SERVICE_NAME, version=SERVICE_VERSION,
                           timestamp=datetime.now(timezone.utc).isoformat())

@app.get("/")
def root():
    return {"message": f"{SERVICE_NAME} running. /docs for API, /health for status."}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # add your deployed frontend URL here too
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    hotel_id: str
    window: Literal["daily", "monthly", "yearly"]

class PredictPoint(BaseModel):
    period: str
    date: str
    actual: Optional[float]
    forecast: Optional[float]
    lower: Optional[float]
    upper: Optional[float]

@app.post("/predict", response_model=list[PredictPoint])
def predict(req: PredictRequest):
    try:
        records = generate_forecast(req.hotel_id, req.window)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    for r in records:
        r["date"] = str(r["date"])
    return records

@app.get("/explain")
def explain(hotel_id: str, date: str):
    return {"hotel_id": hotel_id, "date": date, "reasons": explain_forecast(hotel_id, date)}