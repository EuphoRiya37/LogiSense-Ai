import math
import random
from typing import List, Dict, Tuple, Optional
import logging

logger = logging.getLogger(__name__)

try:
    from ortools.constraint_solver import routing_enums_pb2
    from ortools.constraint_solver import pywrapcp
    ORTOOLS_AVAILABLE = True
    logger.info("OR-Tools available — using optimal VRP solver")
except ImportError:
    ORTOOLS_AVAILABLE = False
    logger.warning("OR-Tools not installed — using greedy heuristic")

CO2_KG_PER_KM = 1.02  # avg diesel truck (DEFRA 2023)


class RouteOptimizer:
    AVG_SPEED_KMH = 65.0
    COST_PER_KM = 1.35

    def optimize(
        self,
        shipments: List[Dict],
        num_vehicles: int = 3,
        optimize_for: str = "balanced",
        depot_lat: float = 40.7128,
        depot_lon: float = -74.0060,
    ) -> Dict:
        if not shipments:
            return {"routes": [], "stats": {}, "savings": {}}

        depot = {
            "id": "DEPOT", "name": "Main Warehouse",
            "lat": depot_lat, "lon": depot_lon,
            "priority": 0, "weight_kg": 0,
        }
        locations = [depot] + [self._sanitize(s) for s in shipments]
        n = len(locations)
        dist_matrix = self._build_matrix(locations)

        if ORTOOLS_AVAILABLE and n > 2:
            routes = self._solve_with_ortools(locations, dist_matrix, num_vehicles)
        else:
            routes = self._solve_greedy(locations, dist_matrix, num_vehicles)

        naive = self._naive_baseline(locations, dist_matrix, num_vehicles)
        opt_stats = self._calc_stats(routes, dist_matrix)
        naive_stats = self._calc_stats(naive, dist_matrix)

        dist_saved = naive_stats["total_distance_km"] - opt_stats["total_distance_km"]
        savings = {
            "distance_saved_km": round(dist_saved, 2),
            "time_saved_hours": round(naive_stats["total_time_hours"] - opt_stats["total_time_hours"], 2),
            "cost_saved_usd": round(dist_saved * self.COST_PER_KM, 2),
            "co2_saved_kg": round(dist_saved * CO2_KG_PER_KM, 2),
            "improvement_pct": round(
                dist_saved / max(naive_stats["total_distance_km"], 1) * 100, 1
            ),
        }

        return {
            "routes": routes,
            "stats": opt_stats,
            "naive_stats": naive_stats,
            "savings": savings,
            "algorithm": "OR-Tools VRP" if (ORTOOLS_AVAILABLE and n > 2) else "Greedy NN Heuristic",
            "depot": depot,
        }

    def _sanitize(self, s: dict) -> dict:
        return {
            "id": s.get("id", f"SHP-{random.randint(1000,9999)}"),
            "name": s.get("name", s.get("destination", "Unknown")),
            "lat": float(s.get("lat", s.get("dest_lat", 40.0))),
            "lon": float(s.get("lon", s.get("dest_lon", -74.0))),
            "priority": int(s.get("priority", 1)),
            "weight_kg": float(s.get("weight_kg", 10)),
        }

    def _build_matrix(self, locations: List[Dict]) -> List[List[float]]:
        n = len(locations)
        mat = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i != j:
                    mat[i][j] = self._haversine(
                        locations[i]["lat"], locations[i]["lon"],
                        locations[j]["lat"], locations[j]["lon"],
                    )
        return mat

    @staticmethod
    def _haversine(lat1, lon1, lat2, lon2) -> float:
        R = 6371.0
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (math.sin(d_lat / 2) ** 2
             + math.cos(math.radians(lat1))
             * math.cos(math.radians(lat2))
             * math.sin(d_lon / 2) ** 2)
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def _solve_with_ortools(self, locations, dist_matrix, num_vehicles) -> List[Dict]:
        SCALE = 100
        n = len(locations)
        int_mat = [[int(d * SCALE) for d in row] for row in dist_matrix]
        manager = pywrapcp.RoutingIndexManager(n, num_vehicles, 0)
        routing = pywrapcp.RoutingModel(manager)

        def dist_cb(from_i, to_i):
            return int_mat[manager.IndexToNode(from_i)][manager.IndexToNode(to_i)]

        cb_idx = routing.RegisterTransitCallback(dist_cb)
        routing.SetArcCostEvaluatorOfAllVehicles(cb_idx)
        routing.AddDimension(cb_idx, 0, int(50000 * SCALE), True, "Distance")
        dim = routing.GetDimensionOrDie("Distance")
        dim.SetGlobalSpanCostCoefficient(100)

        params = pywrapcp.DefaultRoutingSearchParameters()
        params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        params.time_limit.seconds = 8

        sol = routing.SolveWithParameters(params)
        routes = []
        if sol:
            for v in range(num_vehicles):
                idx = routing.Start(v)
                stop_indices = []
                while not routing.IsEnd(idx):
                    stop_indices.append(manager.IndexToNode(idx))
                    idx = sol.Value(routing.NextVar(idx))
                stop_indices.append(0)
                if len(stop_indices) > 2:
                    routes.append({
                        "vehicle_id": v + 1,
                        "stops": [locations[i] for i in stop_indices],
                        "stop_indices": stop_indices,
                        "color": self._vehicle_color(v),
                    })
        if not routes:
            return self._solve_greedy(locations, dist_matrix, num_vehicles)
        return routes

    def _solve_greedy(self, locations, dist_matrix, num_vehicles) -> List[Dict]:
        n = len(locations)
        unvisited = list(range(1, n))
        unvisited.sort(key=lambda i: -locations[i].get("priority", 1))
        vehicle_stops = [[] for _ in range(num_vehicles)]
        for i, node in enumerate(unvisited):
            vehicle_stops[i % num_vehicles].append(node)
        routes = []
        for v_id, stops in enumerate(vehicle_stops):
            if not stops:
                continue
            ordered = self._nearest_neighbor([0] + stops, dist_matrix)
            routes.append({
                "vehicle_id": v_id + 1,
                "stops": [locations[i] for i in ordered] + [locations[0]],
                "stop_indices": ordered + [0],
                "color": self._vehicle_color(v_id),
            })
        return routes

    def _nearest_neighbor(self, nodes: List[int], matrix: List[List[float]]) -> List[int]:
        if not nodes:
            return []
        unvisited = [n for n in nodes if n != 0]
        route = [0]
        cur = 0
        while unvisited:
            nxt = min(unvisited, key=lambda x: matrix[cur][x])
            route.append(nxt)
            unvisited.remove(nxt)
            cur = nxt
        return route

    def _naive_baseline(self, locations, dist_matrix, num_vehicles) -> List[Dict]:
        n = len(locations)
        stops = list(range(1, n))
        chunk = max(1, len(stops) // num_vehicles)
        routes = []
        for v in range(num_vehicles):
            s = v * chunk
            e = s + chunk if v < num_vehicles - 1 else len(stops)
            sl = [0] + stops[s:e] + [0]
            if len(sl) > 2:
                routes.append({
                    "vehicle_id": v + 1,
                    "stops": [locations[i] for i in sl],
                    "stop_indices": sl,
                    "color": self._vehicle_color(v),
                })
        return routes

    def _calc_stats(self, routes: List[Dict], dist_matrix: List[List[float]]) -> Dict:
        total_dist = 0.0
        breakdown = []
        for r in routes:
            idxs = r["stop_indices"]
            d = sum(
                dist_matrix[idxs[i]][idxs[i + 1]]
                for i in range(len(idxs) - 1)
                if idxs[i] < len(dist_matrix) and idxs[i + 1] < len(dist_matrix)
            )
            total_dist += d
            breakdown.append({
                "vehicle_id": r["vehicle_id"],
                "distance_km": round(d, 2),
                "time_hours": round(d / self.AVG_SPEED_KMH, 2),
                "cost_usd": round(d * self.COST_PER_KM, 2),
                "co2_kg": round(d * CO2_KG_PER_KM, 2),
                "num_stops": len(r["stops"]) - 2,
            })
        return {
            "total_distance_km": round(total_dist, 2),
            "total_time_hours": round(total_dist / self.AVG_SPEED_KMH, 2),
            "total_cost_usd": round(total_dist * self.COST_PER_KM, 2),
            "total_co2_kg": round(total_dist * CO2_KG_PER_KM, 2),
            "vehicles_used": len(routes),
            "route_breakdown": breakdown,
        }

    @staticmethod
    def _vehicle_color(v: int) -> str:
        colors = ["#00e5ff", "#a78bfa", "#00ff87", "#fbbf24", "#f472b6", "#60a5fa"]
        return colors[v % len(colors)]

    async def fetch_road_polyline(self, coords: list, api_key: str) -> list:
        """Fetch road polyline from OpenRouteService (optional, requires API key)."""
        import httpx
        if not api_key:
            return []
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(
                    "https://api.openrouteservice.org/v2/directions/driving-hgv/geojson",
                    headers={"Authorization": api_key, "Content-Type": "application/json"},
                    json={"coordinates": coords},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    coords_raw = data["features"][0]["geometry"]["coordinates"]
                    return [[c[1], c[0]] for c in coords_raw]
        except Exception as e:
            logger.warning(f"ORS polyline fetch failed: {e}")
        return []
