# 🚀 LogiSense AI — Intelligent Logistics Optimization System

> AI-powered supply chain intelligence: ETA prediction · route optimization · real-time tracking · automated scheduling

---

## ✨ What Makes This Stand Out

| Capability | Our Approach |
|---|---|
| **ETA Prediction** | XGBoost + LightGBM + Random Forest **ensemble** with confidence intervals |
| **Delay Risk** | XGBoost classifier with calibrated probabilities + risk level (LOW/MEDIUM/HIGH/CRITICAL) |
| **Route Optimization** | **Google OR-Tools VRP solver** (greedy fallback) — minimizes distance, time, cost simultaneously |
| **Fleet Allocation** | Best-Fit Decreasing bin-packing across Express/Van/Truck/Heavy vehicle types |
| **Live Tracking** | WebSocket-powered real-time map with animated shipment markers |
| **UI** | Professional dark-themed React dashboard — Syne + JetBrains Mono, glassmorphism cards |

---

## 📁 Project Structure

```
logisense-ai/
├── backend/                 # FastAPI Python backend
│   ├── main.py              # App entry point + all API routes
│   ├── config.py            # Environment configuration
│   ├── data/
│   │   ├── loader.py        # Kaggle CSV loader + synthetic fallback
│   │   └── simulator.py     # Real-time shipment simulator
│   ├── ml/
│   │   ├── feature_engineering.py   # Feature extraction + encoding
│   │   ├── eta_model.py             # XGB+LGB+RF ensemble regressor
│   │   └── delay_model.py           # XGB delay probability classifier
│   ├── optimization/
│   │   ├── route_optimizer.py       # OR-Tools VRP + greedy heuristic
│   │   └── shipment_allocator.py    # Priority fleet allocation (FFD)
│   └── websocket/
│       └── manager.py               # WebSocket broadcast manager
└── frontend/                # React + Vite + TypeScript frontend
    └── src/
        ├── pages/
        │   ├── Dashboard.tsx        # KPIs + charts overview
        │   ├── Predictions.tsx      # ETA + delay risk predictor
        │   ├── RouteOptimizer.tsx   # Interactive VRP map
        │   ├── LiveTracking.tsx     # Real-time WebSocket tracking
        │   └── Analytics.tsx        # Deep analytics + model performance
        ├── services/
        │   ├── api.ts               # Axios API calls
        │   └── websocket.ts         # WebSocket subscription
        └── components/
            └── ui.tsx               # Reusable UI components
```

---

## ⚡ Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+

---

### 1. Clone and setup

```bash
git clone https://github.com/YOUR_USERNAME/logisense-ai.git
cd logisense-ai
```

### 2. (Optional) Download Kaggle Dataset

Download the supply chain CSV from:  
**https://www.kaggle.com/datasets/harshsingh2209/supply-chain-analysis**

Place the CSV file at:
```
backend/data/supply_chain.csv
```

> **Note:** If the file is absent, LogiSense AI auto-generates a realistic 12,000-row synthetic dataset — all features still work.

---

### 3. Backend setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env if needed (defaults work out of the box)

# Create data directory
mkdir -p data models

# Start backend (auto-trains models on first run ~60 seconds)
python main.py
```

Backend will be live at: **http://localhost:8000**  
API docs available at: **http://localhost:8000/docs**

> **First run note:** Model training takes ~60 seconds. Subsequent runs load cached models instantly.

---

### 4. Frontend setup (new terminal)

```bash
cd frontend

# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will be live at: **http://localhost:5173**

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/status` | Model + data status |
| GET | `/api/analytics/summary` | Dashboard KPIs |
| GET | `/api/analytics/trends` | Monthly trend data |
| GET | `/api/analytics/mode-performance` | Shipping mode breakdown |
| GET | `/api/analytics/model-performance` | ML model metrics + feature importance |
| GET | `/api/shipments` | Live simulated shipments |
| POST | `/api/predict/eta` | Predict ETA (days) |
| POST | `/api/predict/delay` | Predict delay risk |
| POST | `/api/predict/full` | ETA + delay in one call |
| POST | `/api/optimize/routes` | VRP route optimization |
| POST | `/api/allocate` | Allocate shipments to fleet |
| WS | `/ws/tracking` | Real-time tracking stream |

---

## 🧠 ML Architecture

### ETA Prediction (Ensemble Regressor)
- **XGBoost** (weight: 40%) — gradient boosted trees, strong on tabular data  
- **LightGBM** (weight: 40%) — fast leaf-wise growth, handles large features  
- **Random Forest** (weight: 20%) — variance reduction baseline  
- **Features:** shipping mode (encoded), scheduled days, region, category, customer segment, market, seasonality (cyclical sin/cos encoding), geographic coordinates, interaction terms
- **Output:** ETA days + 90% confidence interval + individual model predictions

### Delay Prediction (XGBoost Classifier)
- Calibrated delay probability (0–100%)
- Risk level classification: LOW / MEDIUM / HIGH / CRITICAL
- Class imbalance handled via `scale_pos_weight`

### Route Optimization (VRP)
- **Google OR-Tools** — optimal multi-vehicle routing with Guided Local Search metaheuristic (8s time budget)
- **Greedy NN fallback** — priority-weighted nearest neighbor heuristic
- Minimizes total distance (with global span balancing across vehicles)
- Returns: route paths, distance/time/cost per vehicle, savings vs naive baseline

### Fleet Allocation
- **Best-Fit Decreasing (BFD)** bin-packing algorithm
- Priority-aware vehicle selection (Express for P3, Truck for P1)
- Vehicle types: Express (200kg) / Van (800kg) / Truck (5t) / Heavy (20t)
- Automated delivery schedule with ETA per stop

---

## 📊 Evaluation Criteria Coverage

| Criterion | Implementation |
|---|---|
| **Prediction Accuracy** | Ensemble model, MAE + R² + AUC reported, CI displayed |
| **Optimization Efficiency** | OR-Tools VRP, % improvement vs naive shown |
| **Innovation** | WebSocket live tracking, ensemble ML, BFD allocation, confidence UI |
| **Automation Level** | Zero manual intervention: data load → train → predict → allocate → schedule |
| **Practicality** | Works with real Kaggle data or auto-generates synthetic; full REST API |
| **Presentation** | Professional dark UI, animated map, interactive charts, live alerts |

---

## 🛠 Tech Stack

**Backend:** FastAPI · Python 3.10 · XGBoost · LightGBM · scikit-learn · OR-Tools · pandas · numpy  
**Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · Recharts · React-Leaflet · Framer Motion · Zustand  
**Fonts:** Syne (display) · JetBrains Mono (data)
