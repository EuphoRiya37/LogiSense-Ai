import numpy as np
from typing import List, Dict
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


FLEET = [
    {'id': 'VAN-01', 'type': 'Van',       'capacity_kg': 800,   'speed_factor': 1.3, 'cost_per_km': 0.70},
    {'id': 'VAN-02', 'type': 'Van',       'capacity_kg': 800,   'speed_factor': 1.3, 'cost_per_km': 0.70},
    {'id': 'TRK-01', 'type': 'Truck',     'capacity_kg': 5000,  'speed_factor': 1.0, 'cost_per_km': 1.20},
    {'id': 'TRK-02', 'type': 'Truck',     'capacity_kg': 5000,  'speed_factor': 1.0, 'cost_per_km': 1.20},
    {'id': 'TRK-03', 'type': 'Truck',     'capacity_kg': 5000,  'speed_factor': 1.0, 'cost_per_km': 1.20},
    {'id': 'HVY-01', 'type': 'Heavy',     'capacity_kg': 20000, 'speed_factor': 0.75,'cost_per_km': 2.00},
    {'id': 'HVY-02', 'type': 'Heavy',     'capacity_kg': 20000, 'speed_factor': 0.75,'cost_per_km': 2.00},
    {'id': 'EXP-01', 'type': 'Express',   'capacity_kg': 200,   'speed_factor': 1.8, 'cost_per_km': 2.50},
    {'id': 'EXP-02', 'type': 'Express',   'capacity_kg': 200,   'speed_factor': 1.8, 'cost_per_km': 2.50},
]

# Priority -> preferred vehicle type order
PRIORITY_VEHICLE_PREF = {
    3: ['Express', 'Van', 'Truck', 'Heavy'],
    2: ['Van', 'Truck', 'Express', 'Heavy'],
    1: ['Truck', 'Heavy', 'Van', 'Express'],
}


class ShipmentAllocator:
    def __init__(self):
        self.fleet = [dict(v, current_load=0.0, shipments=[]) for v in FLEET]

    def _reset(self):
        for v in self.fleet:
            v['current_load'] = 0.0
            v['shipments'] = []

    def allocate(self, shipments: List[Dict]) -> Dict:
        self._reset()

        # Sort: priority desc, weight desc (FFD strategy)
        sorted_ships = sorted(
            shipments,
            key=lambda x: (-x.get('priority', 1), -x.get('weight_kg', 10))
        )

        unallocated = []
        for s in sorted_ships:
            weight = float(s.get('weight_kg', 10))
            priority = int(s.get('priority', 1))
            vehicle = self._best_fit(weight, priority)
            if vehicle:
                vehicle['current_load'] += weight
                vehicle['shipments'].append(s)
            else:
                unallocated.append(s)

        schedule = self._build_schedule()
        active = [v for v in self.fleet if v['shipments']]
        utilizations = [v['current_load'] / v['capacity_kg'] * 100 for v in active] if active else [0]

        return {
            'allocations': [
                {
                    'vehicle_id': v['id'],
                    'vehicle_type': v['type'],
                    'shipment_count': len(v['shipments']),
                    'shipments': v['shipments'],
                    'total_load_kg': round(v['current_load'], 2),
                    'capacity_kg': v['capacity_kg'],
                    'utilization_pct': round(v['current_load'] / v['capacity_kg'] * 100, 1),
                    'cost_per_km': v['cost_per_km'],
                }
                for v in active
            ],
            'unallocated': unallocated,
            'schedule': schedule,
            'stats': {
                'total_vehicles_used': len(active),
                'fleet_size': len(self.fleet),
                'total_allocated': sum(len(v['shipments']) for v in active),
                'unallocated_count': len(unallocated),
                'avg_utilization_pct': round(float(np.mean(utilizations)), 1),
                'allocation_success_rate': round(
                    (len(sorted_ships) - len(unallocated)) / max(len(sorted_ships), 1) * 100, 1
                ),
            }
        }

    def _best_fit(self, weight: float, priority: int) -> Dict:
        pref = PRIORITY_VEHICLE_PREF.get(priority, PRIORITY_VEHICLE_PREF[1])
        for vtype in pref:
            candidates = [
                v for v in self.fleet
                if v['type'] == vtype and (v['capacity_kg'] - v['current_load']) >= weight
            ]
            if candidates:
                # Best-Fit Decreasing: pick tightest fit
                return min(candidates, key=lambda v: v['capacity_kg'] - v['current_load'] - weight)
        return None

    def _build_schedule(self) -> List[Dict]:
        schedule = []
        base = datetime.now().replace(hour=7, minute=30, second=0, microsecond=0)

        for v in self.fleet:
            if not v['shipments']:
                continue
            stops = []
            cur_time = base + timedelta(minutes=30 * (int(v['id'][-1]) if v['id'][-1].isdigit() else 0))
            for i, s in enumerate(v['shipments']):
                dist = float(s.get('distance_km', 40))
                travel_h = dist / (65.0 * v['speed_factor'])
                cur_time += timedelta(hours=travel_h, minutes=10)  # 10 min stop
                stops.append({
                    'seq': i + 1,
                    'shipment_id': s.get('id', f'SHP-{i}'),
                    'destination': s.get('destination', s.get('name', 'Unknown')),
                    'arrival': cur_time.strftime('%H:%M'),
                    'priority': s.get('priority', 1),
                })
            schedule.append({
                'vehicle_id': v['id'],
                'vehicle_type': v['type'],
                'departure': base.strftime('%H:%M'),
                'stops': stops,
                'estimated_return': cur_time.strftime('%H:%M'),
            })
        return schedule
