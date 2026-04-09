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
    pythonORS_API_KEY: str = os.getenv("eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjljMzkyNDZhM2U1MzQ2MDViZTZjZDQxODFlZWJlYWU2IiwiaCI6Im11cm11cjY0In0=", "")
    OPENWEATHER_API_KEY: str = os.getenv("9161e3011183004cd42f7f4fd9813e09", "")

settings = Settings()
