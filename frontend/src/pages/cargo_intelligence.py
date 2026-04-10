"""
Cargo Intelligence Engine
Enforces perishable, fragile, hazmat, and oversized cargo constraints.
Matches cargo profiles to vehicle capabilities and scores feasibility.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

CARGO_PROFILES = {
    "sugarcane": {
        "label": "Sugarcane (Perishable)",
        "category": "perishable",
        "max_transit_hours": 24,
        "temp_min_c": 5,
        "temp_max_c": 30,
        "requires_refrigeration": False,
        "shock_sensitivity": "low",
        "hazmat": False,
        "icon": "🌾",
        "spoilage_penalty_pct_per_hour": 4.0,
        "damage_base_risk_pct": 1.0,
        "notes": "Must reach processing plant within 24h of harvest or sugar content degrades >20%",
    },
    "frozen_food": {
        "label": "Frozen Food",
        "category": "perishable",
        "max_transit_hours": 12,
        "temp_min_c": -25,
        "temp_max_c": -15,
        "requires_refrigeration": True,
        "reefer_class": "frozen",
        "shock_sensitivity": "low",
        "hazmat": False,
        "icon": "🧊",
        "spoilage_penalty_pct_per_hour": 8.0,
        "damage_base_risk_pct": 1.5,
        "notes": "Reefer truck required, must maintain -18°C ± 3°C cold chain",
    },
    "fresh_produce": {
        "label": "Fresh Produce / Pharmaceuticals",
        "category": "perishable",
        "max_transit_hours": 48,
        "temp_min_c": 2,
        "temp_max_c": 8,
        "requires_refrigeration": True,
        "reefer_class": "chilled",
        "shock_sensitivity": "medium",
        "hazmat": False,
        "icon": "🥦",
        "spoilage_penalty_pct_per_hour": 2.0,
        "damage_base_risk_pct": 2.0,
        "notes": "Cold chain 2–8°C required. Keep upright. Pharma requires GDP compliance.",
    },
    "eggs": {
        "label": "Eggs / Glassware (Fragile)",
        "category": "fragile",
        "max_transit_hours": 120,
        "temp_min_c": 5,
        "temp_max_c": 25,
        "requires_refrigeration": False,
        "shock_sensitivity": "critical",
        "max_vibration_g": 0.3,
        "hazmat": False,
        "icon": "🥚",
        "spoilage_penalty_pct_per_hour": 0.0,
        "damage_base_risk_pct": 12.0,
        "notes": "Low-vibration routing required — avoid dirt roads, rail joints, air freight turbulence",
    },
    "electronics": {
        "label": "Consumer Electronics",
        "category": "fragile",
        "max_transit_hours": 240,
        "temp_min_c": -10,
        "temp_max_c": 40,
        "requires_refrigeration": False,
        "shock_sensitivity": "high",
        "max_vibration_g": 1.5,
        "hazmat": False,
        "icon": "📱",
        "spoilage_penalty_pct_per_hour": 0.0,
        "damage_base_risk_pct": 4.0,
        "notes": "Padded vehicle, avoid high-vibration routes; ESD protection for semiconductors",
    },
    "lithium_batteries": {
        "label": "Lithium Batteries (Hazmat Class 9)",
        "category": "hazmat",
        "max_transit_hours": 480,
        "temp_min_c": 0,
        "temp_max_c": 35,
        "requires_refrigeration": False,
        "shock_sensitivity": "high",
        "hazmat": True,
        "hazmat_class": "9",
        "requires_hazmat_cert": True,
        "icon": "⚡",
        "spoilage_penalty_pct_per_hour": 0.0,
        "damage_base_risk_pct": 2.0,
        "notes": "UN3480/UN3481. Requires ADR/IATA certified carrier. Prohibited on passenger aircraft.",
    },
    "machinery": {
        "label": "Heavy Machinery / Equipment",
        "category": "oversized",
        "max_transit_hours": 720,
        "weight_min_kg": 5000,
        "requires_flatbed": True,
        "requires_escort": False,
        "shock_sensitivity": "low",
        "hazmat": False,
        "icon": "⚙️",
        "terrain_restrictions": ["narrow_road", "low_bridge"],
        "spoilage_penalty_pct_per_hour": 0.0,
        "damage_base_risk_pct": 1.0,
        "notes": "Flatbed or lowboy required. Check bridge weight limits and route clearances.",
    },
    "standard": {
        "label": "Standard Cargo",
        "category": "standard",
        "max_transit_hours": 720,
        "temp_min_c": -20,
        "temp_max_c": 50,
        "requires_refrigeration": False,
        "shock_sensitivity": "low",
        "hazmat": False,
        "icon": "📦",
        "spoilage_penalty_pct_per_hour": 0.0,
        "damage_base_risk_pct": 1.0,
        "notes": "No special handling required",
    },
}

VEHICLE_CAPABILITIES = {
    "standard_van": {
        "label": "Standard Van",
        "max_weight_kg": 1200,
        "refrigeration": None,
        "shock_rating": "medium",
        "hazmat_certified": False,
        "flatbed": False,
        "terrain": ["highway", "urban", "rural"],
        "avg_speed_kph": 85,
        "co2_kg_per_km": 0.21,
        "cost_per_km": 0.70,
        "icon": "🚐",
    },
    "reefer_van": {
        "label": "Refrigerated Van (Chilled)",
        "max_weight_kg": 1000,
        "refrigeration": "chilled",
        "temp_range_c": (2, 8),
        "shock_rating": "medium",
        "hazmat_certified": False,
        "flatbed": False,
        "terrain": ["highway", "urban", "rural"],
        "avg_speed_kph": 80,
        "co2_kg_per_km": 0.28,
        "cost_per_km": 1.10,
        "icon": "🚐❄️",
    },
    "frozen_truck": {
        "label": "Frozen Reefer Truck",
        "max_weight_kg": 8000,
        "refrigeration": "frozen",
        "temp_range_c": (-25, -15),
        "shock_rating": "medium",
        "hazmat_certified": False,
        "flatbed": False,
        "terrain": ["highway", "rural"],
        "avg_speed_kph": 75,
        "co2_kg_per_km": 0.45,
        "cost_per_km": 1.80,
        "icon": "🚛❄️",
    },
    "low_vibration_truck": {
        "label": "Air-Suspension Truck (Low-Vibration)",
        "max_weight_kg": 5000,
        "refrigeration": None,
        "shock_rating": "low",
        "hazmat_certified": False,
        "flatbed": False,
        "terrain": ["highway", "urban"],
        "avg_speed_kph": 70,
        "co2_kg_per_km": 0.40,
        "cost_per_km": 1.50,
        "icon": "🚛🛡️",
    },
    "hazmat_truck": {
        "label": "ADR Hazmat Certified Truck",
        "max_weight_kg": 12000,
        "refrigeration": None,
        "shock_rating": "medium",
        "hazmat_certified": True,
        "hazmat_classes": ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
        "flatbed": False,
        "terrain": ["highway", "rural"],
        "avg_speed_kph": 70,
        "co2_kg_per_km": 0.55,
        "cost_per_km": 2.20,
        "icon": "⚠️🚛",
    },
    "flatbed_truck": {
        "label": "Flatbed / Lowboy Truck",
        "max_weight_kg": 25000,
        "refrigeration": None,
        "shock_rating": "low",
        "hazmat_certified": False,
        "flatbed": True,
        "terrain": ["highway"],
        "avg_speed_kph": 60,
        "co2_kg_per_km": 0.80,
        "cost_per_km": 2.50,
        "icon": "🏗️🚛",
    },
    "express_bike": {
        "label": "Motorbike / Last-Mile Express",
        "max_weight_kg": 50,
        "refrigeration": None,
        "shock_rating": "high",
        "hazmat_certified": False,
        "flatbed": False,
        "terrain": ["highway", "urban", "rural", "narrow_road"],
        "avg_speed_kph": 60,
        "co2_kg_per_km": 0.08,
        "cost_per_km": 0.40,
        "icon": "🛵",
    },
}

TERRAIN_PROFILES = {
    "highway":     {"vibration_factor": 1.0, "speed_factor": 1.0,  "accessible_vehicles": "all"},
    "urban":       {"vibration_factor": 1.3, "speed_factor": 0.65, "accessible_vehicles": "all"},
    "rural":       {"vibration_factor": 1.8, "speed_factor": 0.75, "accessible_vehicles": [
        "standard_van", "reefer_van", "frozen_truck", "hazmat_truck", "flatbed_truck", "low_vibration_truck"
    ]},
    "dirt_road":   {"vibration_factor": 3.5, "speed_factor": 0.40, "accessible_vehicles": ["express_bike", "standard_van"]},
    "narrow_road": {"vibration_factor": 1.5, "speed_factor": 0.50, "accessible_vehicles": ["express_bike", "standard_van", "reefer_van"]},
}


def analyze_cargo(
    cargo_type: str,
    weight_kg: float,
    distance_km: float,
    available_vehicles: Optional[List[str]] = None,
    dispatch_time_iso: Optional[str] = None,
    terrain: str = "highway",
) -> Dict[str, Any]:
    profile = CARGO_PROFILES.get(cargo_type, CARGO_PROFILES["standard"])
    terrain_data = TERRAIN_PROFILES.get(terrain, TERRAIN_PROFILES["highway"])

    if available_vehicles is None:
        available_vehicles = list(VEHICLE_CAPABILITIES.keys())

    dispatch_dt = datetime.fromisoformat(dispatch_time_iso) if dispatch_time_iso else datetime.now()
    results = []

    for vid in available_vehicles:
        veh = VEHICLE_CAPABILITIES.get(vid)
        if not veh:
            continue

        issues: List[str] = []
        warnings: List[str] = []
        feasible = True
        score = 100

        if weight_kg > veh["max_weight_kg"]:
            issues.append(f"Over capacity: {weight_kg}kg > {veh['max_weight_kg']}kg limit")
            feasible = False
            score -= 50

        if profile.get("requires_refrigeration"):
            needed_class = profile.get("reefer_class")
            if veh.get("refrigeration") != needed_class:
                issues.append(f"Requires {needed_class} refrigeration; vehicle has {veh.get('refrigeration') or 'none'}")
                feasible = False
                score -= 40

        if profile.get("hazmat") and not veh.get("hazmat_certified"):
            issues.append(f"Hazmat Class {profile.get('hazmat_class', '?')} requires ADR-certified vehicle")
            feasible = False
            score -= 45

        if profile.get("requires_flatbed") and not veh.get("flatbed"):
            issues.append("Oversized cargo requires flatbed/lowboy truck")
            feasible = False
            score -= 40

        accessible = terrain_data.get("accessible_vehicles")
        if accessible != "all" and vid not in accessible:
            issues.append(f"Vehicle type not suitable for {terrain} terrain")
            feasible = False
            score -= 30

        shock_map = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        veh_shock = shock_map.get(veh.get("shock_rating", "medium"), 2)
        cargo_shock = shock_map.get(profile.get("shock_sensitivity", "low"), 1)
        if cargo_shock > veh_shock:
            gap = cargo_shock - veh_shock
            warnings.append(
                f"Vibration risk: cargo needs ≥{profile['shock_sensitivity']}, vehicle provides {veh['shock_rating']}"
            )
            score -= gap * 15

        speed = veh["avg_speed_kph"] * terrain_data["speed_factor"]
        transit_hours = distance_km / max(speed, 1)
        max_hours = profile.get("max_transit_hours", 720)
        arrival_dt = dispatch_dt + timedelta(hours=transit_hours)

        if transit_hours > max_hours:
            overage = transit_hours - max_hours
            penalty = profile.get("spoilage_penalty_pct_per_hour", 0) * overage
            issues.append(f"Transit {transit_hours:.1f}h exceeds {max_hours}h limit by {overage:.1f}h")
            if penalty > 0:
                issues.append(f"Estimated spoilage: {min(100, penalty):.0f}% value loss")
            feasible = False
            score -= min(50, penalty * 2)

        if max_hours < 720:
            time_buffer_h = max(0, max_hours - transit_hours)
            latest_dispatch = dispatch_dt + timedelta(hours=time_buffer_h) if time_buffer_h > 0 else None
        else:
            latest_dispatch = None
            time_buffer_h = 999.0

        base_damage = profile.get("damage_base_risk_pct", 1.0)
        vib_multiplier = terrain_data["vibration_factor"]
        shock_multiplier = 1.0 + (max(0, cargo_shock - veh_shock) * 0.25)
        damage_risk_pct = round(min(95, base_damage * vib_multiplier * shock_multiplier), 1)

        if damage_risk_pct > 15:
            warnings.append(f"High damage probability: {damage_risk_pct}%")

        results.append({
            "vehicle_id": vid,
            "vehicle_label": veh["label"],
            "vehicle_icon": veh["icon"],
            "feasible": feasible and score > 30,
            "score": max(0, round(score)),
            "issues": issues,
            "warnings": warnings,
            "transit_hours": round(transit_hours, 1),
            "arrival_time": arrival_dt.isoformat(),
            "latest_safe_dispatch": latest_dispatch.isoformat() if latest_dispatch else None,
            "time_buffer_hours": round(time_buffer_h, 1),
            "damage_risk_pct": damage_risk_pct,
            "cost_usd": round(distance_km * veh["cost_per_km"], 2),
            "co2_kg": round(distance_km * veh["co2_kg_per_km"], 2),
        })

    results.sort(key=lambda x: (-x["feasible"], -x["score"]))
    recommended = next((r for r in results if r["feasible"]), results[0] if results else None)

    sla_risk = "LOW"
    if recommended:
        if not recommended["feasible"]:
            sla_risk = "CRITICAL"
        elif recommended["time_buffer_hours"] < 4:
            sla_risk = "HIGH"
        elif recommended["time_buffer_hours"] < 12:
            sla_risk = "MEDIUM"

    return {
        "cargo_type": cargo_type,
        "cargo_profile": profile,
        "weight_kg": weight_kg,
        "distance_km": distance_km,
        "terrain": terrain,
        "vehicle_options": results,
        "recommended_vehicle": recommended,
        "sla_risk": sla_risk,
        "dispatch_deadline": recommended["latest_safe_dispatch"] if recommended else None,
        "analysis_timestamp": datetime.now().isoformat(),
    }
