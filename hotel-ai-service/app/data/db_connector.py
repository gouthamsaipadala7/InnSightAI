from __future__ import annotations
import logging
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from app.config import settings
from app.data.schemas import DAILY_COUNTS_COLUMNS, DataSource

logger = logging.getLogger(__name__)
TABLE_NAME = "daily_booking_counts"
QUERY = text(f"""
    SELECT
        d.hotel_id::text  AS hotel_id,
        COALESCE(h.name, d.hotel_id::text) AS hotel_name,
        d.date            AS date,
        d.count           AS bookings
    FROM {TABLE_NAME} d
    LEFT JOIN hotels h ON h.id = d.hotel_id
    ORDER BY d.hotel_id, d.date
""")

def _empty_platform_df() -> pd.DataFrame:
    return pd.DataFrame(columns=DAILY_COUNTS_COLUMNS)

def fetch_platform_daily_counts() -> pd.DataFrame:
    try:
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            df = pd.read_sql(QUERY, conn)
    except SQLAlchemyError as e:
        logger.warning("Platform data unavailable (Phase 2 table missing?): %s", e)
        return _empty_platform_df()
    if df.empty:
        return _empty_platform_df()
    df["date"] = pd.to_datetime(df["date"])
    df["canceled"] = 0
    df["source"] = DataSource.PLATFORM_TENANT.value
    return df[DAILY_COUNTS_COLUMNS]