from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from sqlalchemy import create_engine, inspect
from app.config import settings

engine = create_engine(settings.database_url)
insp = inspect(engine)
for table in ["daily_booking_counts", "hotels"]:
    if table in insp.get_table_names():
        print(f"--- {table} ---")
        for col in insp.get_columns(table):
            print(f"  {col['name']}: {col['type']}")
    else:
        print(f"{table} NOT FOUND")