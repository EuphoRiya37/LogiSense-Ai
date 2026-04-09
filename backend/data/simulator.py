import numpy as np
import random
import time
from datetime import datetime, timedelta
from typing import List, Dict

CITY_HUBS = [
    {"name": "New York", "lat": 40.7128, "lon": -74.0060},
    {"name": "Los Angeles", "lat": 34.0522, "lon": -118.2437},
    {"name": "Chicago", "lat": 41.8781, "lon": -87.6298},
    {"name": "Houston", "lat": 29.7604, "lon": -95.3698},
    {"name": "Phoenix", "lat": 33.4484, "lon": -112.0740},
    {"name": "Philadelphia", "lat": 39.9526, "lon": -75.1652},
    {"name": "San Antonio", "lat": 29.4241, "lon": -98.4936},
    {"name": "Dallas", "lat": 32.7767, "lon": -96.7970},
    {"name": "London", "lat": 51.5074, "lon": -0.1278},
    {"name": "Paris", "lat": 48.8566, "lon": 2.3522},
    {"name": "Berlin", "lat": 52.5200, "lon": 13.4050},
    {"name": "Tokyo", "lat": 35.6762, "lon": 139.6503},
    {"name": "Mumbai", "lat": 19.0760, "lon": 72.8777},
    {"name": "São Paulo", "lat": -23.5505, "lon": -46.6333},
    {"name": "Sydney", "lat": -33.8688, "lon": 151.2093},
]

PRODUCTS = [
    "Industrial Machinery", "Consumer Electronics", "Pharmaceutical Supplies",
    "Automotive Parts", "Apparel & Textiles", "Food & Beverage",
    "Medical Equipment", "Chemical Products", "Agricultural Goods",
    "Luxury Goods", "Raw Materials", "Construction Equipment"
]

STATUS_TRANSITIONS = {
    "pending": ["in_transit"],
    "in_transit": ["in_transit", "in_transit", "in_transit", "out_for_delivery", "delayed"],
    "out_for_delivery": ["delivered", "delivery_attempt_failed"],
    "delayed": ["in_transit", "in_transit", "delivered"],
    "delivery_attempt_failed": ["out_for_delivery"],
    "delivered": ["delivered"],
}

STATUS_COLORS = {
    "pending": "#94a3b8",
    "in_transit": "#00e5ff",
    "out_for_delivery": "#a78bfa",
    "delayed": "#ff6b35",
    "delivered": "#00ff87",
    "delivery_attempt_failed": "#ef4444",
}


class ShipmentSimulator:
    def __init__(self, num_shipments: int = 20):
        self.shipments: List[Dict] = []
        self._init_shipments(num_shipments)

    def _init_shipments(self, n: int):
        np.random.seed(int(time.time()) % 1000)
        # Force a realistic distribution: in-transit, delayed, out for delivery
        forced_statuses = (
            ["in_transit"] * int(n * 0.50) +
            ["delayed"] * int(n * 0.20) +
            ["out_for_delivery"] * int(n * 0.20) +
            ["pending"] * max(1, int(n * 0.10))
        )
        random.shuffle(forced_statuses)
        for i in range(n):
            origin = random.choice(CITY_HUBS)
            dest = random.choice([c for c in CITY_HUBS if c != origin])
            s = self._create_shipment(i + 1, origin, dest)
            if i < len(forced_statuses):
                forced = forced_statuses[i]
                s["status"] = forced
                s["status_color"] = STATUS_COLORS[forced]
                # Cap progress so nothing starts near-delivered on init
                if forced == "in_transit":
                    s["progress"] = round(random.uniform(5, 75), 1)
                elif forced == "delayed":
                    s["progress"] = round(random.uniform(10, 60), 1)
                    if not s["delay_reason"]:
                        s["delay_reason"] = random.choice([
                            "Weather conditions", "Traffic congestion",
                            "Customs clearance", "Mechanical issue"
                        ])
                elif forced == "out_for_delivery":
                    s["progress"] = round(random.uniform(80, 95), 1)
                else:
                    s["progress"] = round(random.uniform(2, 15), 1)
                # Recalculate position
                pct = s["progress"] / 100
                s["current_lat"] = origin["lat"] + (s["dest_lat"] - origin["lat"]) * pct + random.uniform(-0.3, 0.3)
                s["current_lon"] = origin["lon"] + (s["dest_lon"] - origin["lon"]) * pct + random.uniform(-0.3, 0.3)
            self.shipments.append(s)

    def _create_shipment(self, sid: int, origin: dict, dest: dict) -> dict:
        progress = random.uniform(0.05, 0.95)
        cur_lat = origin["lat"] + (dest["lat"] - origin["lat"]) * progress
        cur_lon = origin["lon"] + (dest["lon"] - origin["lon"]) * progress
        cur_lat += random.uniform(-0.5, 0.5)
        cur_lon += random.uniform(-0.5, 0.5)

        statuses = ["pending", "in_transit", "out_for_delivery", "delayed"]
        weights = [0.05, 0.65, 0.15, 0.15]
        status = random.choices(statuses, weights=weights)[0]

        eta_hours = random.randint(2, 72)
        created = datetime.now() - timedelta(hours=random.randint(12, 120))

        return {
            "id": f"LSE-{sid:04d}",
            "product": random.choice(PRODUCTS),
            "origin": origin["name"],
            "destination": dest["name"],
            "origin_lat": origin["lat"],
            "origin_lon": origin["lon"],
            "dest_lat": dest["lat"],
            "dest_lon": dest["lon"],
            "current_lat": cur_lat,
            "current_lon": cur_lon,
            "progress": round(progress * 100, 1),
            "status": status,
            "status_color": STATUS_COLORS[status],
            "eta_hours": eta_hours,
            "eta_display": (datetime.now() + timedelta(hours=eta_hours)).strftime("%b %d, %H:%M"),
            "weight_kg": round(random.uniform(5, 2000), 1),
            "priority": random.choice([1, 1, 2, 2, 3]),
            "carrier": random.choice(["FedEx", "DHL", "UPS", "USPS", "Maersk"]),
            "created_at": created.isoformat(),
            "last_update": datetime.now().isoformat(),
            "delay_reason": random.choice([None, None, None, "Weather conditions",
                                            "Traffic congestion", "Customs clearance",
                                            "Mechanical issue"]),
        }

    def tick(self) -> List[Dict]:
        """Advance simulation one tick. Respawn delivered shipments to keep map alive."""
        for i, s in enumerate(self.shipments):
            if s["status"] == "delivered":
                # Respawn: pick new random origin/destination after a short cooldown
                if random.random() < 0.15:  # 15% chance per tick to respawn
                    origin = random.choice(CITY_HUBS)
                    dest = random.choice([c for c in CITY_HUBS if c != origin])
                    self.shipments[i] = self._create_shipment(i + 1, origin, dest)
                    self.shipments[i]["progress"] = 0.0
                    self.shipments[i]["status"] = "in_transit"
                continue

            # Move shipment
            move = random.uniform(0.002, 0.008)
            s["progress"] = min(99.5, round(s["progress"] + move * 100, 1))
            s["current_lat"] += (s["dest_lat"] - s["current_lat"]) * move * 4
            s["current_lon"] += (s["dest_lon"] - s["current_lon"]) * move * 4
            s["current_lat"] += random.uniform(-0.05, 0.05)
            s["current_lon"] += random.uniform(-0.05, 0.05)

            # Status transition
            if s["progress"] >= 94 and s["status"] not in ("delivered", "delivery_attempt_failed"):
                s["status"] = "out_for_delivery"
            elif s["progress"] >= 99:
                s["status"] = "delivered"
                s["progress"] = 100.0
            else:
                transitions = STATUS_TRANSITIONS.get(s["status"], [s["status"]])
                s["status"] = random.choice(transitions)

            s["status_color"] = STATUS_COLORS.get(s["status"], "#94a3b8")
            s["eta_hours"] = max(0, s["eta_hours"] - 1)
            s["last_update"] = datetime.now().isoformat()

            # Random alert injection
            if s["status"] == "delayed" and not s.get("delay_reason"):
                s["delay_reason"] = random.choice([
                    "Weather conditions", "Traffic congestion",
                    "Customs clearance", "Mechanical issue"
                ])

        return self.shipments

    def get_alerts(self) -> List[Dict]:
        alerts = []
        for s in self.shipments:
            if s["status"] == "delayed":
                alerts.append({
                    "shipment_id": s["id"],
                    "type": "DELAY",
                    "message": f"{s['id']} delayed: {s.get('delay_reason', 'Unknown reason')}",
                    "severity": "warning",
                    "timestamp": datetime.now().isoformat(),
                })
            elif s["eta_hours"] < 2 and s["status"] == "out_for_delivery":
                alerts.append({
                    "shipment_id": s["id"],
                    "type": "IMMINENT_DELIVERY",
                    "message": f"{s['id']} arriving at {s['destination']} within 2 hours",
                    "severity": "info",
                    "timestamp": datetime.now().isoformat(),
                })
        return alerts

    def get_kpis(self) -> Dict:
        total = len(self.shipments)
        delayed = sum(1 for s in self.shipments if s["status"] == "delayed")
        delivered = sum(1 for s in self.shipments if s["status"] == "delivered")
        in_transit = sum(1 for s in self.shipments if s["status"] in ("in_transit", "out_for_delivery"))
        return {
            "total": total,
            "in_transit": in_transit,
            "delayed": delayed,
            "delivered": delivered,
            "on_time_rate": round((total - delayed) / max(total, 1) * 100, 1),
        }
