import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── project imports ──────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
from config import settings
from data.loader import DataLoader
from data.simulator import ShipmentSimulator
from ml.eta_model import ETAPredictor
from ml.delay_model import DelayPredictor
from optimization.route_optimizer import RouteOptimizer
from optimization.shipment_allocator import ShipmentAllocator
from websocket.manager import ConnectionManager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
logger = logging.getLogger("logisense")

# ── Global state (loaded at startup) ─────────────────────────────────────────
data_loader: Optional[DataLoader] = None
eta_predictor: Optional[ETAPredictor] = None
delay_predictor: Optional[DelayPredictor] = None
route_optimizer = RouteOptimizer()
allocator = ShipmentAllocator()
simulator: Optional[ShipmentSimulator] = None
ws_manager = ConnectionManager()
_bg_task: Optional[asyncio.Task] = None


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global data_loader, eta_predictor, delay_predictor, simulator, _bg_task

    logger.info("🚀 LogiSense AI starting up…")

    # 1. Load data
    data_loader = DataLoader(settings.DATA_PATH)
    df = data_loader.get_dataframe()
    logger.info(f"📦 Loaded {len(df)} records")

    # 2. Train models
    eta_predictor = ETAPredictor()
    delay_predictor = DelayPredictor()

    model_path = settings.MODEL_PATH
    if (os.path.exists(os.path.join(model_path, 'eta_xgboost.pkl')) and
            os.path.exists(os.path.join(model_path, 'eta_gradientboost.pkl')) and
            os.path.exists(os.path.join(model_path, 'delay_model.pkl'))):
        logger.info("Loading cached models…")
        eta_predictor.load(model_path)
        delay_predictor.load(model_path)
    else:
        logger.info("Training models (first run)…")
        eta_predictor.train(df)
        delay_predictor.train(df)
        eta_predictor.save(model_path)
        delay_predictor.save(model_path)

    # 3. Init simulator
    simulator = ShipmentSimulator(num_shipments=25)

    # 4. Background tracking loop
    async def _tracking_loop():
        while True:
            await asyncio.sleep(3)
            try:
                shipments = simulator.tick()
                alerts = simulator.get_alerts()
                kpis = simulator.get_kpis()
                await ws_manager.broadcast({
                    'type': 'tracking_update',
                    'shipments': shipments,
                    'alerts': alerts,
                    'kpis': kpis,
                })
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Tracking loop error: {e}")

    _bg_task = asyncio.create_task(_tracking_loop())
    logger.info("✅ LogiSense AI ready")

    yield

    if _bg_task:
        _bg_task.cancel()
    logger.info("LogiSense AI shutdown")


app = FastAPI(title="LogiSense AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic schemas ──────────────────────────────────────────────────────────
class ShipmentInput(BaseModel):
    shipping_mode: str = Field("Standard Class", examples=["Standard Class"])
    scheduled_shipping_days: float = Field(5, ge=1, le=30)
    order_region: str = "North America"
    category_name: str = "Electronics"
    customer_segment: str = "Consumer"
    market: str = "US"
    payment_type: str = "DEBIT"
    order_country: str = "USA"
    quantity: float = Field(1, ge=1)
    sales: float = Field(100.0, ge=0)
    order_total: float = Field(100.0, ge=0)
    profit: float = 20.0
    discount_rate: float = Field(0.0, ge=0, le=1)
    profit_ratio: float = 0.2
    benefit_per_order: float = 20.0
    latitude: Optional[float] = 39.5
    longitude: Optional[float] = -98.0
    order_day_of_week: Optional[int] = 2
    order_month: Optional[int] = 6
    order_quarter: Optional[int] = 2
    order_year: Optional[int] = 2024


class LocationInput(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    lat: float
    lon: float
    priority: int = Field(1, ge=1, le=3)
    weight_kg: float = Field(10.0, gt=0)
    destination: Optional[str] = None
    distance_km: Optional[float] = 50.0


class RouteRequest(BaseModel):
    shipments: List[LocationInput]
    num_vehicles: int = Field(3, ge=1, le=10)
    optimize_for: str = "balanced"
    depot_lat: float = 40.7128
    depot_lon: float = -74.0060


class AllocationRequest(BaseModel):
    shipments: List[Dict[str, Any]]


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.VERSION}


@app.get("/api/status")
def status():
    return {
        "models_ready": eta_predictor is not None and eta_predictor.trained,
        "data_loaded": data_loader is not None,
        "total_records": len(data_loader.get_dataframe()) if data_loader else 0,
        "eta_metrics": eta_predictor.metrics if eta_predictor else {},
        "delay_metrics": delay_predictor.metrics if delay_predictor else {},
    }


@app.get("/api/analytics/summary")
def analytics_summary():
    if not data_loader:
        raise HTTPException(503, "Data not loaded")
    return data_loader.get_summary_stats()


@app.get("/api/analytics/trends")
def analytics_trends():
    if not data_loader:
        raise HTTPException(503, "Data not loaded")
    return data_loader.get_shipping_trends()


@app.get("/api/analytics/mode-performance")
def mode_performance():
    if not data_loader:
        raise HTTPException(503, "Data not loaded")
    return data_loader.get_mode_performance()


@app.get("/api/analytics/model-performance")
def model_performance():
    return {
        "eta_model": eta_predictor.metrics if eta_predictor else {},
        "delay_model": delay_predictor.metrics if delay_predictor else {},
        "eta_feature_importance": eta_predictor.get_feature_importance() if eta_predictor else {},
        "delay_feature_importance": delay_predictor.get_feature_importance() if delay_predictor else [],
    }


@app.get("/api/shipments")
def get_live_shipments():
    if not simulator:
        raise HTTPException(503, "Simulator not ready")
    return {
        "shipments": simulator.shipments,
        "alerts": simulator.get_alerts(),
        "kpis": simulator.get_kpis(),
    }


@app.post("/api/predict/eta")
def predict_eta(payload: ShipmentInput):
    if not eta_predictor or not eta_predictor.trained:
        raise HTTPException(503, "ETA model not ready")
    result = eta_predictor.predict(payload.model_dump())
    return result


@app.post("/api/predict/delay")
def predict_delay(payload: ShipmentInput):
    if not delay_predictor or not delay_predictor.trained:
        raise HTTPException(503, "Delay model not ready")
    result = delay_predictor.predict(payload.model_dump())
    return result


@app.post("/api/predict/full")
def predict_full(payload: ShipmentInput):
    """ETA + delay risk in one call."""
    if not eta_predictor or not delay_predictor:
        raise HTTPException(503, "Models not ready")
    d = payload.model_dump()
    eta = eta_predictor.predict(d)
    delay = delay_predictor.predict(d)
    return {**eta, **delay}


@app.post("/api/optimize/routes")
def optimize_routes(req: RouteRequest):
    ships = [s.model_dump() for s in req.shipments]
    result = route_optimizer.optimize(
        shipments=ships,
        num_vehicles=req.num_vehicles,
        optimize_for=req.optimize_for,
        depot_lat=req.depot_lat,
        depot_lon=req.depot_lon,
    )
    return result


@app.post("/api/allocate")
def allocate_shipments(req: AllocationRequest):
    return allocator.allocate(req.shipments)


# ── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/ws/tracking")
async def tracking_ws(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        # Send initial state
        await ws_manager.send_personal(ws, {
            'type': 'initial',
            'shipments': simulator.shipments if simulator else [],
            'kpis': simulator.get_kpis() if simulator else {},
        })
        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=60)
            except asyncio.TimeoutError:
                pass  # Keep alive
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception:
        ws_manager.disconnect(ws)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
