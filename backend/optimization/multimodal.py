"""
Multimodal Logistics Route Comparison
Road · Rail · Sea · Air — cost, time, carbon, reliability scoring.
"""
from typing import Dict, Any, Optional, List

TRANSPORT_MODES = {
    "road": {
        "label": "Road (Truck)",
        "icon": "🚛",
        "color": "#00e5ff",
        "cost_usd_per_tonne_km": 0.15,
        "avg_speed_kph": 75,
        "co2_kg_per_tonne_km": 0.062,
        "reliability_pct": 85,
        "min_distance_km": 0,
        "max_distance_km": 3000,
        "fixed_cost_usd": 80,
        "transit_overhead_h": 2,
        "suitable_cargo": "all",
        "notes": "Door-to-door, flexible routes, affected by congestion & incidents",
    },
    "rail": {
        "label": "Rail (Freight Train)",
        "icon": "🚂",
        "color": "#a78bfa",
        "cost_usd_per_tonne_km": 0.05,
        "avg_speed_kph": 90,
        "co2_kg_per_tonne_km": 0.028,
        "reliability_pct": 92,
        "min_distance_km": 150,
        "max_distance_km": 8000,
        "fixed_cost_usd": 200,
        "transit_overhead_h": 6,
        "suitable_cargo": ["standard", "electronics", "machinery", "frozen_food", "lithium_batteries"],
        "notes": "Low cost/CO₂ for bulk, fixed schedules, terminal-to-terminal",
    },
    "sea": {
        "label": "Sea (Container Ship)",
        "icon": "🚢",
        "color": "#00ff87",
        "cost_usd_per_tonne_km": 0.006,
        "avg_speed_kph": 35,
        "co2_kg_per_tonne_km": 0.011,
        "reliability_pct": 78,
        "min_distance_km": 500,
        "max_distance_km": 25000,
        "fixed_cost_usd": 450,
        "transit_overhead_h": 72,
        "suitable_cargo": ["standard", "electronics", "machinery", "fresh_produce"],
        "notes": "Cheapest per tonne-km, slow, port-to-port, weather dependent",
    },
    "air": {
        "label": "Air Freight",
        "icon": "✈️",
        "color": "#fbbf24",
        "cost_usd_per_tonne_km": 4.50,
        "avg_speed_kph": 850,
        "co2_kg_per_tonne_km": 0.602,
        "reliability_pct": 94,
        "min_distance_km": 200,
        "max_distance_km": 20000,
        "fixed_cost_usd": 300,
        "transit_overhead_h": 8,
        "suitable_cargo": ["standard", "electronics", "fresh_produce", "sugarcane"],
        "notes": "Fastest, premium cost, high carbon, size/weight restricted",
    },
}

URGENCY_MODE_PREFERENCE = {
    "critical": ["air", "road"],
    "high":     ["air", "road", "rail"],
    "medium":   ["road", "rail"],
    "low":      ["sea", "rail", "road"],
}

URGENCY_WEIGHTS = {
    "critical": (0.20, 0.60, 0.05, 0.15),
    "high":     (0.30, 0.45, 0.10, 0.15),
    "medium":   (0.40, 0.30, 0.15, 0.15),
    "low":      (0.45, 0.15, 0.25, 0.15),
}


def compare_multimodal(
    distance_km: float,
    weight_kg: float,
    cargo_type: str = "standard",
    urgency: str = "medium",
    max_transit_hours: Optional[float] = None,
) -> Dict[str, Any]:
    weight_tonnes = weight_kg / 1000
    results = []

    for mode_id, mode in TRANSPORT_MODES.items():
        if distance_km < mode["min_distance_km"] or distance_km > mode["max_distance_km"]:
            results.append({
                "mode": mode_id, "label": mode["label"],
                "icon": mode["icon"], "color": mode["color"],
                "feasible": False,
                "reason": f"Distance {distance_km}km outside range [{mode['min_distance_km']}–{mode['max_distance_km']}km]",
                "notes": mode["notes"],
            })
            continue

        suitable = mode.get("suitable_cargo", "all")
        if suitable != "all" and cargo_type not in suitable:
            results.append({
                "mode": mode_id, "label": mode["label"],
                "icon": mode["icon"], "color": mode["color"],
                "feasible": False,
                "reason": f"{cargo_type.replace('_', ' ')} not permitted on {mode['label']}",
                "notes": mode["notes"],
            })
            continue

        travel_h = distance_km / mode["avg_speed_kph"]
        total_h = travel_h + mode["transit_overhead_h"]
        transport_cost = distance_km * weight_tonnes * mode["cost_usd_per_tonne_km"]
        total_cost = transport_cost + mode["fixed_cost_usd"]
        co2_kg = distance_km * weight_tonnes * mode["co2_kg_per_tonne_km"]

        feasible = True
        urgency_warning = None
        if max_transit_hours and total_h > max_transit_hours:
            feasible = False
            urgency_warning = f"Transit {total_h:.0f}h exceeds required {max_transit_hours:.0f}h"

        cost_score = min(100, total_cost / 50)
        time_score = min(100, total_h / 10)
        co2_score = min(100, co2_kg / 10)
        reliability_score = 100 - mode["reliability_pct"]

        w_cost, w_time, w_co2, w_rel = URGENCY_WEIGHTS.get(urgency, URGENCY_WEIGHTS["medium"])
        composite_score = round(
            cost_score * w_cost + time_score * w_time
            + co2_score * w_co2 + reliability_score * w_rel,
            1,
        )

        results.append({
            "mode": mode_id, "label": mode["label"],
            "icon": mode["icon"], "color": mode["color"],
            "feasible": feasible and not urgency_warning,
            "urgency_warning": urgency_warning,
            "transit_hours": round(total_h, 1),
            "transit_days": round(total_h / 24, 1),
            "cost_usd": round(total_cost, 2),
            "cost_per_kg": round(total_cost / max(weight_kg, 1), 4),
            "co2_kg": round(co2_kg, 2),
            "reliability_pct": mode["reliability_pct"],
            "composite_score": composite_score,
            "notes": mode["notes"],
        })

    results.sort(key=lambda x: (not x.get("feasible", False), x.get("composite_score", 999)))
    recommended = next((r for r in results if r.get("feasible")), None)

    return {
        "distance_km": distance_km,
        "weight_kg": weight_kg,
        "cargo_type": cargo_type,
        "urgency": urgency,
        "modes": results,
        "recommended": recommended,
        "preferred_modes": URGENCY_MODE_PREFERENCE.get(urgency, []),
    }
