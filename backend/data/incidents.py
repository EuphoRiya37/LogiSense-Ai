"""
Dynamic Incident Feed — simulates real-world logistics disruptions.
Incidents affect route feasibility and trigger rerouting recommendations.
"""
import random
import math
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any

INCIDENT_TYPES = [
    {
        "type": "road_closure",
        "severity": "HIGH",
        "color": "#ef4444",
        "icon": "🚧",
        "description_templates": [
            "Multi-vehicle accident blocking {road}",
            "Emergency road works on {road} — 6h closure",
            "Bridge structural inspection — {road} closed",
            "Fallen tree blocking {road}",
        ],
        "avg_duration_hours": 4,
        "radius_km": 15,
        "delay_factor": 0.6,
    },
    {
        "type": "weather_event",
        "severity": "MEDIUM",
        "color": "#fbbf24",
        "icon": "⛈️",
        "description_templates": [
            "Flash flooding on {road} — avoid low-lying routes",
            "Dense fog: visibility <50m near {road}",
            "Heavy snowfall — {road} requires chains",
            "High winds: bridges and elevated roads restricted",
        ],
        "avg_duration_hours": 8,
        "radius_km": 40,
        "delay_factor": 0.35,
    },
    {
        "type": "port_strike",
        "severity": "CRITICAL",
        "color": "#a78bfa",
        "icon": "⚓",
        "description_templates": [
            "Dock workers strike — {road} Port suspended 48h",
            "Container terminal closure — reroute to alternative port",
        ],
        "avg_duration_hours": 48,
        "radius_km": 5,
        "delay_factor": 1.0,
    },
    {
        "type": "congestion",
        "severity": "LOW",
        "color": "#fb923c",
        "icon": "🚦",
        "description_templates": [
            "Heavy congestion on {road} — 45min delay expected",
            "Rush hour gridlock near {road}",
            "Major event traffic: {road} moving slowly",
        ],
        "avg_duration_hours": 2,
        "radius_km": 8,
        "delay_factor": 0.15,
    },
    {
        "type": "ambulance_priority",
        "severity": "MEDIUM",
        "color": "#f472b6",
        "icon": "🚑",
        "description_templates": [
            "Emergency corridor active on {road} — commercial vehicles must yield",
            "Mass casualty incident: {road} reserved for emergency services",
        ],
        "avg_duration_hours": 1,
        "radius_km": 5,
        "delay_factor": 0.4,
    },
    {
        "type": "customs_hold",
        "severity": "HIGH",
        "color": "#60a5fa",
        "icon": "🛃",
        "description_templates": [
            "Customs inspection surge at {road} border — 3h delay",
            "Enhanced security screening: {road} checkpoint backed up",
        ],
        "avg_duration_hours": 6,
        "radius_km": 2,
        "delay_factor": 0.5,
    },
]

ROAD_NAMES = [
    "I-95", "Route 66", "M1 Motorway", "A2 Highway",
    "Ring Road", "Coastal Highway", "Main Street Corridor",
    "Industrial Boulevard", "Port Access Road", "Northern Bypass",
]

INCIDENT_HOTSPOTS = [
    {"lat": 40.7128, "lon": -74.0060, "region": "New York Metro"},
    {"lat": 34.0522, "lon": -118.2437, "region": "Los Angeles"},
    {"lat": 41.8781, "lon": -87.6298, "region": "Chicago"},
    {"lat": 51.5074, "lon": -0.1278, "region": "London"},
    {"lat": 48.8566, "lon": 2.3522, "region": "Paris"},
    {"lat": 35.6762, "lon": 139.6503, "region": "Tokyo"},
    {"lat": 19.0760, "lon": 72.8777, "region": "Mumbai Port"},
    {"lat": 1.3521, "lon": 103.8198, "region": "Singapore Port"},
    {"lat": 22.3193, "lon": 114.1694, "region": "Hong Kong Port"},
    {"lat": 29.7604, "lon": -95.3698, "region": "Houston"},
]

_active_incidents: List[Dict] = []
_incident_counter = 0


def generate_incident() -> Dict:
    global _incident_counter
    _incident_counter += 1

    itype = random.choice(INCIDENT_TYPES)
    hotspot = random.choice(INCIDENT_HOTSPOTS)
    road = random.choice(ROAD_NAMES)
    description = random.choice(itype["description_templates"]).replace("{road}", road)
    duration = random.randint(
        max(1, itype["avg_duration_hours"] // 2),
        itype["avg_duration_hours"] * 2,
    )
    expires_at = datetime.now() + timedelta(hours=duration)
    lat = hotspot["lat"] + random.uniform(-0.3, 0.3)
    lon = hotspot["lon"] + random.uniform(-0.3, 0.3)

    return {
        "id": f"INC-{_incident_counter:04d}",
        "type": itype["type"],
        "severity": itype["severity"],
        "color": itype["color"],
        "icon": itype["icon"],
        "description": description,
        "region": hotspot["region"],
        "lat": round(lat, 4),
        "lon": round(lon, 4),
        "radius_km": itype["radius_km"],
        "delay_factor": itype["delay_factor"],
        "reported_at": datetime.now().isoformat(),
        "expires_at": expires_at.isoformat(),
        "duration_hours": duration,
        "reroute_available": itype["type"] != "port_strike",
        "affected_shipments": [],
    }


def tick_incidents(p_new: float = 0.12, p_expire: float = 0.08) -> List[Dict]:
    global _active_incidents
    now = datetime.now()
    _active_incidents = [
        i for i in _active_incidents
        if datetime.fromisoformat(i["expires_at"]) > now and random.random() > p_expire
    ]
    if random.random() < p_new and len(_active_incidents) < 8:
        _active_incidents.append(generate_incident())
    return _active_incidents


def get_active_incidents() -> List[Dict]:
    return list(_active_incidents)


def inject_incident(incident_type: Optional[str] = None) -> Dict:
    incident = generate_incident()
    if incident_type:
        itype_data = next((i for i in INCIDENT_TYPES if i["type"] == incident_type), None)
        if itype_data:
            incident.update({
                "type": itype_data["type"],
                "severity": itype_data["severity"],
                "color": itype_data["color"],
                "icon": itype_data["icon"],
                "delay_factor": itype_data["delay_factor"],
                "radius_km": itype_data["radius_km"],
                "reroute_available": itype_data["type"] != "port_strike",
            })
    _active_incidents.append(incident)
    return incident


def check_shipment_affected(shipment: Dict[str, Any], incidents: List[Dict]) -> List[Dict]:
    affected = []
    for inc in incidents:
        dlat = math.radians(shipment["current_lat"] - inc["lat"])
        dlon = math.radians(shipment["current_lon"] - inc["lon"])
        a = (math.sin(dlat / 2) ** 2
             + math.cos(math.radians(inc["lat"]))
             * math.cos(math.radians(shipment["current_lat"]))
             * math.sin(dlon / 2) ** 2)
        dist_km = 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        if dist_km <= inc["radius_km"] * 2:
            affected.append({**inc, "distance_km": round(dist_km, 1)})
    return affected