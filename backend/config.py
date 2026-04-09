import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    APP_NAME: str = "LogiSense AI"
    VERSION: str = "1.0.0"
    DATA_PATH: str = os.getenv("DATA_PATH", "./data/supply_chain.csv")
    MODEL_PATH: str = os.getenv("MODEL_PATH", "./models")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

settings = Settings()
