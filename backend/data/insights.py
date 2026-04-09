"""
Rule-based AI insights engine — generates natural language summaries
from logistics data. No external API needed.
"""
from typing import List, Dict, Any


def generate_insights(summary: dict, model_metrics: dict) -> List[Dict[str, Any]]:
    insights = []

    on_time = summary.get("on_time_rate", 0)
    late_rate = summary.get("late_rate", 0)
    avg_delay = summary.get("avg_delay_days", 0)
    total = summary.get("total_shipments", 0)
    delay_by_region = summary.get("delay_by_region", {})
    delay_by_dow = summary.get("delay_by_dow", {})
    delay_by_month = summary.get("delay_by_month", {})
    mode_perf = summary.get("shipping_mode_dist", {})
    eta_r2 = model_metrics.get("eta_model", {}).get("ensemble", {}).get("r2", 0)
    delay_auc = model_metrics.get("delay_model", {}).get("auc", 0)

    # ── Insight 1: On-time performance ──────────────────────────────────────
    if on_time < 70:
        insights.append({
            "type": "critical", "icon": "🚨",
            "title": "Critical: Low On-Time Rate",
            "body": f"Only {on_time:.1f}% of shipments are on time — well below the 75% industry baseline. Immediate intervention recommended.",
            "action": "Review Standard Class shipments first (highest volume + delay overlap).",
        })
    elif on_time < 80:
        insights.append({
            "type": "warning", "icon": "⚠️",
            "title": "On-Time Performance Below Target",
            "body": f"Current on-time rate of {on_time:.1f}% is below the 80% target. {late_rate:.1f}% of shipments are experiencing delays.",
            "action": "Consider upgrading high-priority shipments to First Class or Same Day.",
        })
    else:
        insights.append({
            "type": "success", "icon": "✅",
            "title": "On-Time Performance Strong",
            "body": f"Excellent: {on_time:.1f}% on-time rate exceeds the 75% industry baseline by {on_time - 75:.1f} percentage points.",
            "action": "Maintain current shipping mode distribution.",
        })

    # ── Insight 2: Worst region ──────────────────────────────────────────────
    if delay_by_region:
        worst_region = max(delay_by_region, key=delay_by_region.get)
        worst_rate = delay_by_region[worst_region] * 100
        best_region = min(delay_by_region, key=delay_by_region.get)
        best_rate = delay_by_region[best_region] * 100
        if worst_rate > 35:
            insights.append({
                "type": "warning", "icon": "📍",
                "title": f"High Delay Hotspot: {worst_region}",
                "body": f"{worst_region} has a {worst_rate:.1f}% late rate — {worst_rate - best_rate:.1f}pp higher than the best-performing region ({best_region} at {best_rate:.1f}%).",
                "action": f"Prioritize carrier renegotiation or route changes for {worst_region}.",
            })

    # ── Insight 3: Day-of-week pattern ──────────────────────────────────────
    if delay_by_dow:
        worst_day = max(delay_by_dow, key=delay_by_dow.get)
        best_day = min(delay_by_dow, key=delay_by_dow.get)
        worst_dow_rate = delay_by_dow[worst_day] * 100
        best_dow_rate = delay_by_dow[best_day] * 100
        insights.append({
            "type": "info", "icon": "📅",
            "title": f"Schedule Optimization Opportunity",
            "body": f"{worst_day} has the highest delay rate ({worst_dow_rate:.1f}%). Shifting dispatches to {best_day} ({best_dow_rate:.1f}%) could improve on-time performance.",
            "action": f"Reduce dispatch volumes on {worst_day} and redistribute to {best_day}.",
        })

    # ── Insight 4: Seasonal peak ─────────────────────────────────────────────
    if delay_by_month:
        worst_month_num = max(delay_by_month, key=delay_by_month.get)
        month_names = {1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'May',6:'Jun',
                       7:'Jul',8:'Aug',9:'Sep',10:'Oct',11:'Nov',12:'Dec'}
        worst_month = month_names.get(worst_month_num, str(worst_month_num))
        worst_month_rate = delay_by_month[worst_month_num] * 100
        if worst_month_rate > 35:
            insights.append({
                "type": "warning", "icon": "📈",
                "title": f"Seasonal Peak: {worst_month} is High-Risk",
                "body": f"Historical data shows {worst_month} has a {worst_month_rate:.1f}% late rate — likely driven by holiday/seasonal volume surges.",
                "action": f"Increase fleet capacity and buffer stock in {worst_month}.",
            })

    # ── Insight 5: Model confidence ──────────────────────────────────────────
    if eta_r2 > 0.9:
        insights.append({
            "type": "success", "icon": "🤖",
            "title": "AI Model Confidence: Excellent",
            "body": f"ETA ensemble R²={eta_r2:.4f}, Delay AUC-ROC={delay_auc:.4f}. The model explains {eta_r2*100:.1f}% of ETA variance with high reliability.",
            "action": "Safe to use AI predictions for operational decision-making.",
        })

    # ── Insight 6: Average delay cost ───────────────────────────────────────
    if avg_delay > 0 and total > 0:
        estimated_cost = avg_delay * total * 12.5  # $12.5/shipment/day industry avg
        insights.append({
            "type": "info", "icon": "💰",
            "title": "Delay Cost Estimate",
            "body": f"Average delay of {avg_delay:.2f} days × {total:,} shipments ≈ ${estimated_cost:,.0f} in estimated delay costs (at $12.50/shipment/day industry rate).",
            "action": "Every 0.1-day reduction in avg delay saves approximately $" + f"{total * 12.5 * 0.1:,.0f}.",
        })

    return insights[:5]  # Return top 5 most relevant
