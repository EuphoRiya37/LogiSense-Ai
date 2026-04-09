# LogiSense AI — Intelligent Logistics Optimization System

> AI-powered supply chain intelligence platform: ETA prediction · delay risk · route optimization · fleet allocation · live tracking · demand forecasting · weather integration

---

## Feature Overview

| Page | What It Does |
|---|---|
| **Dashboard** | KPI overview, delivery breakdown, mode performance, trends, AI insights, weather snapshot |
| **Predictions** | Single, batch, and what-if ETA + delay risk predictions with 3-model ensemble |
| **Route Optimizer** | OR-Tools VRP multi-vehicle routing on interactive Leaflet map |
| **Fleet Allocation** | Best-Fit Decreasing bin-packing, priority-aware vehicle assignment with schedule |
| **Live Tracking** | WebSocket real-time map, status badges, alerts |
| **Analytics** | Model diagnostics, demand forecast, feature importance, seasonal heatmaps |

---

##  ML Architecture

- **ETA Prediction** — XGBoost + GradientBoost + Random Forest ensemble (R² ≈ 0.93, MAE ≈ 0.5 days)
- **Delay Risk** — XGBoost classifier with probability calibration (AUC-ROC ≈ 0.94)
- **What-If Analysis** — Compare up to 6 shipping scenarios simultaneously
- **Batch Prediction** — Enter multiple shipments at once with CSV export
- **Mode Comparison** — Auto-recommendation engine comparing all 4 shipping classes
- **Demand Forecast** — Exponential smoothing + linear trend, 6-month horizon

---

## Quick Start

### Prerequisites
- Python 3.10–3.13 (NOT 3.14 — xgboost wheels not published yet)
- Node.js 18+

### Backend

```bash
cd logisense-ai/backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
copy .env.example .env       # Windows  /  cp .env.example .env on Mac
mkdir data models
# Optional: place supply_chain.csv from Kaggle into data/
python main.py
# First run trains models (~60-90s). Opens at http://localhost:8000
```

### Frontend (new terminal)

```bash
cd logisense-ai/frontend
copy .env.example .env       # Windows  /  cp .env.example .env on Mac
npm install
npm run dev
# Opens at http://localhost:5173
```

---

## 🔌 Key API Endpoints

| Endpoint | Description |
|----------|-------------|
| GET `/api/analytics/summary` | KPIs, distributions, regional breakdown |
| GET `/api/analytics/demand-forecast` | 6-month demand forecast |
| GET `/api/insights` | AI-generated actionable insights |
| GET `/api/weather/global` | Weather snapshot by region |
| POST `/api/predict/full` | ETA + delay risk (single) |
| POST `/api/predict/batch` | Bulk predictions |
| POST `/api/predict/whatif` | Custom scenario comparison |
| POST `/api/predict/compare` | Auto-compare all shipping modes |
| POST `/api/optimize/routes` | OR-Tools VRP route optimization |
| POST `/api/allocate` | Fleet allocation + delivery schedule |
| WS `/ws/tracking` | Real-time tracking stream |

Full interactive docs: **http://localhost:8000/docs**

---

##  Judging Criteria

| Criterion | Implementation |
|---|---|
| **Prediction Accuracy** | Ensemble R²=0.93, AUC=0.94, shown with CI in UI |
| **Optimization Efficiency** | OR-Tools VRP, savings vs naive baseline, BFD allocation |
| **Innovation** | What-If, demand forecasting, AI insights, weather integration, batch CSV export |
| **Automation** | Auto-trains, auto-allocates, auto-schedules, auto-insights |
| **Practicality** | Real Kaggle data or auto-synthetic; full API docs |
| **Presentation** | Dark mission-control UI, animated maps, real-time updates |

