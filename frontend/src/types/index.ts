export interface ShipmentInput {
  shipping_mode: string;
  scheduled_shipping_days: number;
  order_region: string;
  category_name: string;
  customer_segment: string;
  market: string;
  payment_type: string;
  order_country: string;
  quantity: number;
  sales: number;
  order_total: number;
  profit: number;
  discount_rate: number;
  profit_ratio: number;
  benefit_per_order: number;
  latitude?: number;
  longitude?: number;
  order_day_of_week?: number;
  order_month?: number;
  order_quarter?: number;
  order_year?: number;
}

export interface WeatherAdjustment {
  weather_delay_days: number;
  weather_condition: string;
  weather_reason: string | null;
  icon: string;
}

export interface ETAResult {
  eta_days: number;
  confidence_lower: number;
  confidence_upper: number;
  confidence_score: number;
  individual_predictions: Record<string, number>;
}

export interface DelayResult {
  delay_probability: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_color: string;
  is_predicted_delayed: boolean;
}

export interface PredictionResult extends ETAResult, DelayResult {
  weather_adjustment?: WeatherAdjustment | null;
}

export interface LiveShipment {
  id: string;
  product: string;
  origin: string;
  destination: string;
  origin_lat: number;
  origin_lon: number;
  dest_lat: number;
  dest_lon: number;
  current_lat: number;
  current_lon: number;
  progress: number;
  status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delayed' | 'delivered' | 'delivery_attempt_failed';
  status_color: string;
  eta_hours: number;
  eta_display: string;
  weight_kg: number;
  priority: number;
  carrier: string;
  created_at: string;
  last_update: string;
  delay_reason?: string | null;
}

export interface RouteStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  priority: number;
  weight_kg: number;
}

export interface OptimizedRoute {
  vehicle_id: number;
  stops: RouteStop[];
  stop_indices: number[];
  color: string;
  road_polyline?: [number, number][];
}

export interface RouteBreakdown {
  vehicle_id: number;
  distance_km: number;
  time_hours: number;
  cost_usd: number;
  num_stops: number;
  co2_kg?: number;
}

export interface RouteStats {
  total_distance_km: number;
  total_time_hours: number;
  total_cost_usd: number;
  vehicles_used: number;
  route_breakdown: RouteBreakdown[];
}

export interface RouteSavings {
  distance_saved_km: number;
  time_saved_hours: number;
  cost_saved_usd: number;
  co2_saved_kg?: number;
  improvement_pct: number;
}

export interface RouteResult {
  routes: OptimizedRoute[];
  stats: RouteStats;
  naive_stats: RouteStats;
  savings: RouteSavings;
  algorithm: string;
  depot: RouteStop;
  road_routing_note?: string;
}

export interface SummaryStats {
  total_shipments: number;
  on_time_rate: number;
  avg_delay_days: number;
  avg_shipping_days: number;
  late_rate: number;
  total_revenue: number;
  avg_order_value: number;
  shipping_mode_dist: Record<string, number>;
  delivery_status_dist: Record<string, number>;
  delay_by_region: Record<string, number>;
  delay_by_category: Record<string, number>;
  delay_by_dow: Record<string, number>;
  delay_by_month: Record<number, number>;
}

export interface Alert {
  shipment_id: string;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: string;
}