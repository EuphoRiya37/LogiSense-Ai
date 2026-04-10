"""
SLA Risk Intelligence Engine
Scores each shipment's risk across 5 dimensions and produces business impact.
"""
from typing import Dict, Any

SEGMENT_PENALTIES = {
    "Consumer":    {"per_day_pct": 0.02, "churn_risk_per_breach": 0.08},
    "Corporate":   {"per_day_pct": 0.05, "churn_risk_per_breach": 0.15},
    "Home Office": {"per_day_pct": 0.03, "churn_risk_per_breach": 0.10},
}

SHIPPING_MODE_SLA = {
    "Same Day":       {"sla_days": 1, "penalty_multiplier": 2.5},
    "First Class":    {"sla_days": 2, "penalty_multiplier": 1.8},
    "Second Class":   {"sla_days": 3, "penalty_multiplier": 1.3},
    "Standard Class": {"sla_days": 5, "penalty_multiplier": 1.0},
}


def score_sla_risk(
    shipment: Dict[str, Any],
    eta_days: float,
    delay_probability: float,
    weather_delay_days: float = 0.0,
    cargo_type: str = "standard",
) -> Dict[str, Any]:
    from data.cargo_intelligence import CARGO_PROFILES

    order_value = float(shipment.get("sales", 100))
    shipping_mode = shipment.get("shipping_mode", "Standard Class")
    segment = shipment.get("customer_segment", "Consumer")

    sla_config = SHIPPING_MODE_SLA.get(shipping_mode, SHIPPING_MODE_SLA["Standard Class"])
    seg_config = SEGMENT_PENALTIES.get(segment, SEGMENT_PENALTIES["Consumer"])

    delay_score = round(delay_probability, 1)

    cargo_profile = CARGO_PROFILES.get(cargo_type, CARGO_PROFILES["standard"])
    max_hours = cargo_profile.get("max_transit_hours", 720)
    transit_hours = eta_days * 24
    if max_hours < 720:
        overage_h = max(0, transit_hours - max_hours)
        spoilage_rate = cargo_profile.get("spoilage_penalty_pct_per_hour", 0)
        spoilage_score = round(min(100, overage_h * spoilage_rate * 2), 1)
    else:
        spoilage_score = 0.0

    damage_base = cargo_profile.get("damage_base_risk_pct", 1.0)
    shock_mult = {"critical": 3.0, "high": 2.0, "medium": 1.3, "low": 1.0}.get(
        cargo_profile.get("shock_sensitivity", "low"), 1.0
    )
    damage_score = round(min(100, damage_base * shock_mult * 2), 1)
    weather_score = round(min(100, weather_delay_days * 30), 1)

    days_over_sla = max(0, eta_days - sla_config["sla_days"])
    sla_score = round(min(100, days_over_sla * 20 + delay_probability * 0.5), 1)

    composite = round(
        delay_score * 0.35
        + spoilage_score * 0.25
        + damage_score * 0.15
        + weather_score * 0.10
        + sla_score * 0.15,
        1,
    )

    penalty_pct = min(0.20, days_over_sla * seg_config["per_day_pct"] * sla_config["penalty_multiplier"])
    penalty_usd = round(order_value * penalty_pct, 2)
    churn_risk_pct = round(min(80, days_over_sla * seg_config["churn_risk_per_breach"] * 100), 1)
    lifetime_value_at_risk = round(order_value * 8 * (churn_risk_pct / 100), 2)

    def _next_mode(current: str) -> str:
        order = ["Standard Class", "Second Class", "First Class", "Same Day"]
        try:
            idx = order.index(current)
            return order[min(idx + 1, len(order) - 1)]
        except ValueError:
            return "First Class"

    if composite >= 75:
        action, rec_color = "ESCALATE", "#ef4444"
        rec = f"Immediately escalate. Upgrade to {_next_mode(shipping_mode)} or contact customer proactively."
    elif composite >= 50:
        action, rec_color = "MONITOR", "#ff6b35"
        rec = f"High risk. Consider upgrading to {_next_mode(shipping_mode)}. Flag for daily check-in."
    elif composite >= 30:
        action, rec_color = "WATCH", "#fbbf24"
        rec = "Moderate risk. Schedule proactive notification. Monitor weather and incidents."
    else:
        action, rec_color = "OK", "#00ff87"
        rec = "Low risk. Normal operations. No intervention needed."

    return {
        "composite_risk": composite,
        "risk_action": action,
        "risk_color": rec_color,
        "recommendation": rec,
        "dimensions": {
            "transit_delay": delay_score,
            "spoilage": spoilage_score,
            "damage": damage_score,
            "weather": weather_score,
            "sla_breach": sla_score,
        },
        "business_impact": {
            "penalty_pct": round(penalty_pct * 100, 1),
            "penalty_usd": penalty_usd,
            "days_over_sla": round(days_over_sla, 1),
            "churn_risk_pct": churn_risk_pct,
            "lifetime_value_at_risk": lifetime_value_at_risk,
        },
        "sla_config": sla_config,
        "segment": segment,
    }
