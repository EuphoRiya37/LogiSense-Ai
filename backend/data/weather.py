import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

OWMAP_KEY = os.getenv("OPENWEATHER_API_KEY", "")
BASE_URL = "https://api.openweathermap.org/data/2.5/weather"

# Weather condition → delay multiplier
WEATHER_DELAY_MAP = {
    "Clear":        0.00,
    "Clouds":       0.05,
    "Drizzle":      0.12,
    "Rain":         0.22,
    "Thunderstorm": 0.55,
    "Snow":         0.45,
    "Mist":         0.08,
    "Fog":          0.18,
    "Haze":         0.07,
    "Dust":         0.10,
    "Sand":         0.12,
    "Tornado":      0.90,
}

# Simulated fallback by region
REGIONAL_WEATHER_SIM = {
    "North America":  {"condition": "Clouds",  "temp_c": 14,  "wind_kph": 18, "humidity": 60},
    "Western Europe": {"condition": "Rain",    "temp_c": 10,  "wind_kph": 24, "humidity": 78},
    "East of USA":    {"condition": "Clear",   "temp_c": 18,  "wind_kph": 12, "humidity": 52},
    "Southeast Asia": {"condition": "Rain",    "temp_c": 29,  "wind_kph": 15, "humidity": 85},
    "Central America":{"condition": "Clear",   "temp_c": 28,  "wind_kph": 10, "humidity": 70},
    "South America":  {"condition": "Clouds",  "temp_c": 22,  "wind_kph": 14, "humidity": 65},
    "Eastern Europe": {"condition": "Snow",    "temp_c": -2,  "wind_kph": 20, "humidity": 80},
    "Western Africa": {"condition": "Clear",   "temp_c": 33,  "wind_kph": 8,  "humidity": 45},
}


async def get_weather_for_city(city: str) -> Optional[dict]:
    """Fetch live weather from OpenWeatherMap. Returns None if unavailable."""
    if not OWMAP_KEY or OWMAP_KEY == "YOUR_KEY_HERE":
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(BASE_URL, params={
                "q": city, "appid": OWMAP_KEY,
                "units": "metric", "lang": "en"
            })
            if resp.status_code == 200:
                data = resp.json()
                condition = data["weather"][0]["main"]
                return {
                    "city": city,
                    "condition": condition,
                    "description": data["weather"][0]["description"].title(),
                    "temp_c": round(data["main"]["temp"], 1),
                    "wind_kph": round(data["wind"]["speed"] * 3.6, 1),
                    "humidity": data["main"]["humidity"],
                    "delay_boost": WEATHER_DELAY_MAP.get(condition, 0.05),
                    "icon": data["weather"][0]["icon"],
                    "source": "live",
                }
    except Exception as e:
        logger.warning(f"Weather API failed for {city}: {e}")
    return None


def get_weather_for_region(region: str) -> dict:
    """Simulated weather by region (used when no API key)."""
    import random, math
    sim = REGIONAL_WEATHER_SIM.get(region, {"condition": "Clear", "temp_c": 20, "wind_kph": 15, "humidity": 55})
    # Add small noise
    condition = sim["condition"]
    return {
        "city": region,
        "condition": condition,
        "description": condition,
        "temp_c": round(sim["temp_c"] + random.uniform(-2, 2), 1),
        "wind_kph": round(sim["wind_kph"] + random.uniform(-3, 3), 1),
        "humidity": min(100, max(20, sim["humidity"] + random.randint(-5, 5))),
        "delay_boost": WEATHER_DELAY_MAP.get(condition, 0.05),
        "icon": _condition_icon(condition),
        "source": "simulated",
    }


def _condition_icon(condition: str) -> str:
    icons = {
        "Clear": "☀️", "Clouds": "⛅", "Rain": "🌧️",
        "Drizzle": "🌦️", "Thunderstorm": "⛈️", "Snow": "❄️",
        "Mist": "🌫️", "Fog": "🌫️", "Haze": "😶‍🌫️", "Tornado": "🌪️",
    }
    return icons.get(condition, "🌡️")


def get_global_weather_snapshot() -> list:
    """Returns weather for all major regions (simulated). Used on dashboard."""
    return [get_weather_for_region(r) for r in REGIONAL_WEATHER_SIM.keys()]
