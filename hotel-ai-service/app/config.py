from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg2://hotel_app:password@localhost:5432/hotel_saas"
    kaggle_dataset_slug: str = "jessemostipak/hotel-booking-demand"
    data_raw_dir: str = "data/raw"
    data_processed_dir: str = "data/processed"
    output_dir: str = "outputs"

    @property
    def raw_dir(self) -> Path:
        p = Path(self.data_raw_dir); return p if p.is_absolute() else PROJECT_ROOT / p
    @property
    def processed_dir(self) -> Path:
        p = Path(self.data_processed_dir); return p if p.is_absolute() else PROJECT_ROOT / p
    @property
    def outputs_dir(self) -> Path:
        p = Path(self.output_dir); return p if p.is_absolute() else PROJECT_ROOT / p

settings = Settings()
for _d in (settings.raw_dir, settings.processed_dir, settings.outputs_dir):
    _d.mkdir(parents=True, exist_ok=True)