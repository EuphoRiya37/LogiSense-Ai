import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import List, Optional, Any, Dict
import io, csv
import random
import hashlib

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

sys.path.insert(0, os.path.dirname(__file__))
from config import settings
from data.loader import DataLoader
from data.simulator import ShipmentSimulator
from data.weather import (get_global_weather_snapshot, get_weather_for_region, get_weather_eta_adjustment,)
from data.insights import generate_insights
from ml.eta_model import ETAPredictor
from ml.delay_model import DelayPredictor
from optimization.route_optimizer import RouteOptimizer
from optimization.shipment_allocator import ShipmentAllocator
from websocket.manager import ConnectionManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
logger = logging.getLogger("logisense")

data_loader:     Optional[DataLoader]     = None
eta_predictor:   Optional[ETAPredictor]   = None
delay_predictor: Optional[DelayPredictor] = None
route_optimizer  = RouteOptimizer()
allocator        = ShipmentAllocator()
simulator:       Optional[ShipmentSimulator] = None
ws_manager       = ConnectionManager()
_bg_task:        Optional[asyncio.Task]   = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global data_loader, eta_predictor, delay_predictor, simulator, _bg_task
    logger.info("🚀 LogiSense AI starting up…")

    data_loader = DataLoader(settings.DATA_PATH)
    df = data_loader.get_dataframe()
    logger.info(f"📦 Loaded {len(df)} records")

    eta_predictor   = ETAPredictor()
    delay_predictor = DelayPredictor()
    model_path = settings.MODEL_PATH
    cached = (
        os.path.exists(os.path.join(model_path, 'eta_xgboost.pkl')) and
        os.path.exists(os.path.join(model_path, 'eta_gradientboost.pkl')) and
        os.path.exists(os.path.join(model_path, 'delay_model.pkl'))
    )
    if cached:
        logger.info("Loading cached models…")
        eta_predictor.load(model_path)
        delay_predictor.load(model_path)
    else:
        logger.info("Training models (first run ~60s)…")
        eta_predictor.train(df)
        delay_predictor.train(df)
        eta_predictor.save(model_path)
        delay_predictor.save(model_path)

    simulator = ShipmentSimulator(num_shipments=25)

    async def _tracking_loop():
        while True:
            await asyncio.sleep(3)
            try:
                await ws_manager.broadcast({
                    'type':      'tracking_update',
                    'shipments': simulator.tick(),
                    'alerts':    simulator.get_alerts(),
                    'kpis':      simulator.get_kpis(),
                })
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Tracking loop error: {e}")

    _bg_task = asyncio.create_task(_tracking_loop())
    logger.info("✅ LogiSense AI ready — docs at http://localhost:8000/docs")
    yield
    if _bg_task:
        _bg_task.cancel()
    logger.info("Shutdown complete")

class RouteStopInput(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    priority: int
    weight_kg: float

class RouteRequest(BaseModel):
    shipments: List[RouteStopInput]
    num_vehicles: int
    optimize_for: str = "balanced"
    depot_lat: float
    depot_lon: float

app = FastAPI(title="LogiSense AI", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.post("/api/optimize/routes/road")
async def optimize_routes_road(req: RouteRequest):
    """
    Same as /api/optimize/routes but also fetches actual road polylines
    from OpenRouteService for each vehicle route.
    """
    ships = [s.model_dump() for s in req.shipments]
    result = route_optimizer.optimize(
        shipments=ships,
        num_vehicles=req.num_vehicles,
        optimize_for=req.optimize_for,
        depot_lat=req.depot_lat,
        depot_lon=req.depot_lon,
    )

    api_key = settings.ORS_API_KEY
    if api_key:
        for route in result.get("routes", []):
            stops = route.get("stops", [])
            if len(stops) >= 2:
                # ORS needs [lon, lat] order
                coords = [[s["lon"], s["lat"]] for s in stops]
                polyline = await route_optimizer.fetch_road_polyline(coords, api_key)
                route["road_polyline"] = polyline  # [lat, lon] pairs for Leaflet
            else:
                route["road_polyline"] = []
    else:
        # No key: straight lines remain, flag it
        for route in result.get("routes", []):
            route["road_polyline"] = []
        result["road_routing_note"] = "Set OPENROUTESERVICE_API_KEY in .env for road-following routes"

    return result

def stable_order_value(shipment_id: str) -> float:
    seed = int(hashlib.md5(shipment_id.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    return round(rng.uniform(500, 5000), 2)


# ── Schemas ───────────────────────────────────────────────────────────────────
class ShipmentInput(BaseModel):
    shipping_mode:           str   = "Standard Class"
    scheduled_shipping_days: float = Field(5, ge=1, le=30)
    order_region:            str   = "North America"
    category_name:           str   = "Electronics"
    customer_segment:        str   = "Consumer"
    market:                  str   = "US"
    payment_type:            str   = "DEBIT"
    order_country:           str   = "USA"
    quantity:                float = Field(1, ge=1)
    sales:                   float = Field(100.0, ge=0)
    order_total:             float = Field(100.0, ge=0)
    profit:                  float = 20.0
    discount_rate:           float = Field(0.0, ge=0, le=1)
    profit_ratio:            float = 0.2
    benefit_per_order:       float = 20.0
    latitude:       Optional[float] = 39.5
    longitude:      Optional[float] = -98.0
    order_day_of_week: Optional[int] = 2
    order_month:    Optional[int] = 6
    order_quarter:  Optional[int] = 2
    order_year:     Optional[int] = 2024

class LocationInput(BaseModel):
    id:          Optional[str]   = None
    name:        Optional[str]   = None
    lat:         float
    lon:         float
    priority:    int   = Field(1, ge=1, le=3)
    weight_kg:   float = Field(10.0, gt=0)
    destination: Optional[str]   = None
    distance_km: Optional[float] = 50.0


class AllocationRequest(BaseModel):
    shipments: List[Dict[str, Any]]

class BatchPredictRequest(BaseModel):
    shipments: List[ShipmentInput]

class WhatIfRequest(BaseModel):
    base:      ShipmentInput
    scenarios: List[Dict[str, Any]]


# ── Core endpoints ─────────────────────────────────────────────────────────────
@app.get("/")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.VERSION}

@app.get("/api/status")
def api_status():
    return {
        "models_ready":  eta_predictor is not None and eta_predictor.trained,
        "data_loaded":   data_loader is not None,
        "total_records": len(data_loader.get_dataframe()) if data_loader else 0,
        "eta_metrics":   eta_predictor.metrics   if eta_predictor   else {},
        "delay_metrics": delay_predictor.metrics if delay_predictor else {},
    }

@app.get("/api/analytics/summary")
def analytics_summary():
    if not data_loader: raise HTTPException(503, "Data not loaded")
    return data_loader.get_summary_stats()

@app.get("/api/analytics/trends")
def analytics_trends():
    if not data_loader: raise HTTPException(503, "Data not loaded")
    return data_loader.get_shipping_trends()

@app.get("/api/analytics/mode-performance")
def mode_performance():
    if not data_loader: raise HTTPException(503, "Data not loaded")
    return data_loader.get_mode_performance()

@app.get("/api/analytics/model-performance")
def model_performance():
    return {
        "eta_model":                eta_predictor.metrics              if eta_predictor   else {},
        "delay_model":              delay_predictor.metrics             if delay_predictor else {},
        "eta_feature_importance":   eta_predictor.get_feature_importance()  if eta_predictor   else {},
        "delay_feature_importance": delay_predictor.get_feature_importance() if delay_predictor else [],
    }

@app.get("/api/analytics/demand-forecast")
def demand_forecast():
    if not data_loader: raise HTTPException(503, "Data not loaded")
    try:
        import numpy as np
        df = data_loader.get_dataframe()
        if 'order_month' not in df.columns: return []
        monthly = df.groupby(['order_year', 'order_month'], observed=False).size().reset_index(name='count')
        monthly = monthly.sort_values(['order_year', 'order_month'])
        monthly['label'] = monthly['order_year'].astype(str) + '-' + monthly['order_month'].astype(str).str.zfill(2)
        counts = monthly['count'].tolist()
        if len(counts) < 4: return []
        alpha, smoothed = 0.3, [counts[0]]
        for c in counts[1:]: smoothed.append(alpha * c + (1 - alpha) * smoothed[-1])
        slope = float(np.polyfit(np.arange(6), np.array(counts[-6:]), 1)[0])
        hist = [{'label': row['label'], 'count': int(row['count']),
                 'smoothed': round(smoothed[i], 0), 'type': 'historical'}
                for i, row in monthly.iterrows()]
        last_y, last_m, last_v = int(monthly.iloc[-1]['order_year']), int(monthly.iloc[-1]['order_month']), smoothed[-1]
        forecasts = []
        for o in range(1, 7):
            m = (last_m + o - 1) % 12 + 1
            y = last_y + (last_m + o - 1) // 12
            fv = max(0, last_v + slope * o * 0.8) * (1.12 if m in (11,12) else 0.92 if m in (1,2) else 1.0)
            forecasts.append({'label': f"{y}-{str(m).zfill(2)}", 'count': None,
                               'smoothed': None, 'forecast': round(fv, 0), 'type': 'forecast'})
        return hist[-12:] + forecasts
    except Exception as e:
        logger.warning(f"Demand forecast error: {e}"); return []

@app.get("/api/shipments")
def get_live_shipments():
    if not simulator: raise HTTPException(503, "Simulator not ready")
    return {"shipments": simulator.shipments, "alerts": simulator.get_alerts(), "kpis": simulator.get_kpis()}

@app.post("/api/predict/full")
def predict_full(payload: ShipmentInput):
    if not eta_predictor or not delay_predictor:
        raise HTTPException(503, "Models not ready")
    d = payload.model_dump()
    result = {**eta_predictor.predict(d), **delay_predictor.predict(d)}

    # Apply live weather penalty if region is known
    try:
        region = d.get("order_region", "North America")
        w = get_weather_for_region(region)
        adj = get_weather_eta_adjustment(w["condition"], w["wind_kph"])
        if adj["weather_delay_days"] > 0.1:
            result["eta_days"] = round(result["eta_days"] + adj["weather_delay_days"], 1)
            result["weather_adjustment"] = adj
        else:
            result["weather_adjustment"] = None
    except Exception:
        result["weather_adjustment"] = None

    return result

@app.post("/api/predict/eta")
def predict_eta(payload: ShipmentInput):
    if not eta_predictor or not eta_predictor.trained: raise HTTPException(503, "ETA model not ready")
    return eta_predictor.predict(payload.model_dump())

@app.post("/api/predict/delay")
def predict_delay(payload: ShipmentInput):
    if not delay_predictor or not delay_predictor.trained: raise HTTPException(503, "Delay model not ready")
    return delay_predictor.predict(payload.model_dump())

@app.post("/api/predict/batch")
def predict_batch(req: BatchPredictRequest):
    if not eta_predictor or not delay_predictor: raise HTTPException(503, "Models not ready")
    results = []
    for s in req.shipments:
        d = s.model_dump()
        try:
            results.append({**eta_predictor.predict(d), **delay_predictor.predict(d),
                             "shipping_mode": d.get("shipping_mode"), "order_region": d.get("order_region"),
                             "order_month": d.get("order_month"), "error": None})
        except Exception as e:
            results.append({"error": str(e)})
    return {"results": results, "count": len(results)}

@app.post("/api/predict/whatif")
def predict_whatif(req: WhatIfRequest):
    if not eta_predictor or not delay_predictor: raise HTTPException(503, "Models not ready")
    base_d = req.base.model_dump()
    results = [{"label": "Baseline", **eta_predictor.predict(base_d), **delay_predictor.predict(base_d)}]
    for sc in req.scenarios[:6]:
        variant = {**base_d, **sc.get("changes", {})}
        try:
            results.append({"label": sc.get("label", "Scenario"),
                             **eta_predictor.predict(variant), **delay_predictor.predict(variant),
                             "changes": sc.get("changes", {})})
        except Exception as e:
            results.append({"label": sc.get("label", "Scenario"), "error": str(e)})
    return {"scenarios": results}

@app.post("/api/predict/compare")
def compare_modes(payload: ShipmentInput):
    if not eta_predictor or not delay_predictor: raise HTTPException(503, "Models not ready")
    modes = ["Standard Class", "Second Class", "First Class", "Same Day"]
    costs = {"Standard Class": 0, "Second Class": 15, "First Class": 35, "Same Day": 80}
    sched = {"Standard Class": 5, "Second Class": 3, "First Class": 2, "Same Day": 1}
    results = []
    for mode in modes:
        d = {**payload.model_dump(), "shipping_mode": mode, "scheduled_shipping_days": sched[mode]}
        try:
            eta = eta_predictor.predict(d); delay = delay_predictor.predict(d)
            results.append({"mode": mode, "eta_days": eta["eta_days"],
                             "confidence_lower": eta["confidence_lower"], "confidence_upper": eta["confidence_upper"],
                             "delay_probability": delay["delay_probability"], "risk_level": delay["risk_level"],
                             "risk_color": delay["risk_color"], "extra_cost_usd": costs[mode]})
        except Exception as e:
            logger.warning(f"compare error {mode}: {e}")
    results.sort(key=lambda x: x["eta_days"])
    current = next((r for r in results if r["mode"] == payload.shipping_mode), results[-1])
    best    = results[0]; safest = min(results, key=lambda x: x["delay_probability"])
    day_save = round(current["eta_days"] - best["eta_days"], 1)
    cost_diff = best["extra_cost_usd"] - current["extra_cost_usd"]
    if day_save > 0.5 and cost_diff < 50:
        rec = {"type":"UPGRADE","message":f"Switch to {best['mode']} → save {day_save}d at +${cost_diff}","suggested_mode":best["mode"]}
    elif current["delay_probability"] > 50:
        rs = round(current["delay_probability"]-safest["delay_probability"],0)
        rec = {"type":"RISK_REDUCE","message":f"Use {safest['mode']} → reduce delay risk by {rs:.0f}%","suggested_mode":safest["mode"]}
    else:
        rec = {"type":"OPTIMAL","message":f"{payload.shipping_mode} is optimal","suggested_mode":payload.shipping_mode}
    return {"modes": results, "current_mode": payload.shipping_mode, "recommendation": rec}

@app.post("/api/optimize/routes")
def optimize_routes(req: RouteRequest):
    return route_optimizer.optimize(
        shipments=[s.model_dump() for s in req.shipments],
        num_vehicles=req.num_vehicles, optimize_for=req.optimize_for,
        depot_lat=req.depot_lat, depot_lon=req.depot_lon)

@app.post("/api/allocate")
def allocate_shipments(req: AllocationRequest):
    return allocator.allocate(req.shipments)

# ── Weather (Open-Meteo, no key) ──────────────────────────────────────────────
WEATHER_CODES = {
    0:("Clear sky","☀️",0.0), 1:("Mainly clear","🌤️",0.0), 2:("Partly cloudy","⛅",0.0),
    3:("Overcast","☁️",0.05), 45:("Fog","🌫️",0.15), 51:("Light drizzle","🌦️",0.1),
    61:("Slight rain","🌧️",0.1), 63:("Moderate rain","🌧️",0.2), 65:("Heavy rain","🌧️",0.35),
    71:("Slight snow","🌨️",0.25), 73:("Moderate snow","🌨️",0.4), 75:("Heavy snow","❄️",0.55),
    80:("Showers","🌦️",0.15), 82:("Violent showers","⛈️",0.5), 95:("Thunderstorm","⛈️",0.6),
}

@app.get("/api/weather")
async def get_weather(lat: float = 39.5, lon: float = -98.0):
    url = (f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
           f"&current=temperature_2m,precipitation,wind_speed_10m,weather_code,relative_humidity_2m"
           f"&forecast_days=1&timezone=auto")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            data = (await client.get(url)).json()
        cur = data.get("current", {}); wc = int(cur.get("weather_code", 0))
        desc, icon, df_val = WEATHER_CODES.get(wc, ("Unknown","❓",0.0))
        wind = float(cur.get("wind_speed_10m", 0))
        if wind > 60: df_val += 0.3
        elif wind > 40: df_val += 0.15
        return {"temperature": cur.get("temperature_2m"), "precipitation": cur.get("precipitation"),
                "wind_speed": wind, "humidity": cur.get("relative_humidity_2m"),
                "condition": desc, "icon": icon,
                "delay_factor": round(min(0.9, df_val), 2),
                "delay_impact": "HIGH" if df_val > 0.3 else "MEDIUM" if df_val > 0.1 else "LOW"}
    except Exception as e:
        return {"condition":"Unavailable","icon":"❓","delay_factor":0.0,"delay_impact":"LOW","error":str(e)}

@app.get("/api/weather/global")
def weather_global():
    return get_global_weather_snapshot()

@app.get("/api/insights")
def get_insights_route():
    if not data_loader: raise HTTPException(503, "Data not loaded")
    return generate_insights(data_loader.get_summary_stats(),
                             {"eta_model": eta_predictor.metrics if eta_predictor else {},
                              "delay_model": delay_predictor.metrics if delay_predictor else {}})

@app.get("/api/export/routes")
def export_routes():
    out = io.StringIO()
    csv.writer(out).writerow(["Route","Vehicle","Distance_km","Time_hrs","Cost_USD","Stops"])
    return StreamingResponse(iter([out.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition":"attachment; filename=routes.csv"})

@app.websocket("/ws/tracking")
async def tracking_ws(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        await ws_manager.send_personal(ws, {
            'type': 'initial', 'shipments': simulator.shipments if simulator else [],
            'kpis': simulator.get_kpis() if simulator else {},
        })
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=60)
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception:
        ws_manager.disconnect(ws)

@app.get("/api/geocode")
async def geocode(q: str):
    """Free geocoding via Nominatim (OpenStreetMap). No API key needed."""
    try:
        async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": "LogiSenseAI/1.0"}) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": q, "format": "json", "limit": 5}
            )
            results = resp.json()
            return [
                {
                    "display_name": r["display_name"],
                    "lat": float(r["lat"]),
                    "lon": float(r["lon"]),
                    "type": r.get("type", ""),
                }
                for r in results
            ]
    except Exception as e:
        raise HTTPException(500, f"Geocoding failed: {e}")
@app.post("/api/stress-test")
def run_stress_test():
    if not simulator:
        raise HTTPException(503, "Simulator not ready")
    return simulator.stress_test()

@app.get("/api/analytics/revenue-at-risk")
def revenue_at_risk():
    if not simulator:
        raise HTTPException(503, "Simulator not ready")
    at_risk = []
    total_risk = 0.0
    if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
    for s in simulator.shipments:
        if s["status"] == "delayed":
            order_value = stable_order_value(s["id"])
            delay_days = max(1, s["eta_hours"] // 24)
            sla_penalty_pct = min(0.20, delay_days * 0.05)
            penalty = round(order_value * sla_penalty_pct, 2)
            total_risk += penalty
            at_risk.append({
                "shipment_id": s["id"],
                "destination": s["destination"],
                "order_value": order_value,
                "delay_days": delay_days,
                "sla_penalty_pct": round(sla_penalty_pct * 100, 1),
                "penalty_usd": penalty,
                "delay_reason": s.get("delay_reason", "Unknown"),
            })
    return {
        "at_risk_shipments": at_risk,
        "total_revenue_at_risk": round(total_risk, 2),
        "count": len(at_risk),
    }

