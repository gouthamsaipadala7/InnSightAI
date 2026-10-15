from enum import Enum

class DataSource(str, Enum):
    KAGGLE_PRETRAIN = "kaggle_pretrain"
    PLATFORM_TENANT = "platform_tenant"

DAILY_COUNTS_COLUMNS = ["hotel_id", "hotel_name", "date", "bookings", "canceled", "source"]