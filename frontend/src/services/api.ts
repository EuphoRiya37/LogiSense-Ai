import axios from 'axios';
import type { ShipmentInput, PredictionResult, RouteResult, SummaryStats } from '../types';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE, timeout: 30000 });

export const getStatus = () => api.get('/api/status').then(r => r.data);
export const getSummary = (): Promise<SummaryStats> => api.get('/api/analytics/summary').then(r => r.data);
export const getTrends = () => api.get('/api/analytics/trends').then(r => r.data);
export const getModePerformance = () => api.get('/api/analytics/mode-performance').then(r => r.data);
export const getModelPerformance = () => api.get('/api/analytics/model-performance').then(r => r.data);
export const getLiveShipments = () => api.get('/api/shipments').then(r => r.data);
export const getInsights        = () => api.get('/api/insights').then(r => r.data);
export const getGlobalWeather   = () => api.get('/api/weather/global').then(r => r.data);
export const getDemandForecast  = () => api.get('/api/analytics/demand-forecast').then(r => r.data);
export const getWeather = (lat: number, lon: number) => api.get('/api/weather', { params: { lat, lon } }).then(r => r.data);

export const predictFull = (payload: ShipmentInput): Promise<PredictionResult> =>
  api.post('/api/predict/full', payload).then(r => r.data);
export const predictBatch = (shipments: ShipmentInput[]) =>
  api.post('/api/predict/batch', { shipments }).then(r => r.data);

export const predictWhatIf = (
  base: ShipmentInput,
  scenarios: Array<{ label: string; changes: Partial<ShipmentInput> }>
) => api.post('/api/predict/whatif', { base, scenarios }).then(r => r.data);

export const optimizeRoutes = (payload: {
  shipments: Array<{ lat: number; lon: number; priority: number; weight_kg: number; name?: string; id?: string }>;
  num_vehicles: number;
  depot_lat?: number;
  depot_lon?: number;
}): Promise<RouteResult> => api.post('/api/optimize/routes', payload).then(r => r.data);

export const optimizeRoutesRoad = (payload: Parameters<typeof optimizeRoutes>[0]) =>
  api.post('/api/optimize/routes/road', payload).then(r => r.data);

export const geocode = (q: string) =>
  api.get('/api/geocode', { params: { q } }).then(r => r.data);

export const runStressTest = () =>
  api.post('/api/stress-test').then(r => r.data);

export const getRevenueAtRisk = () =>
  api.get('/api/analytics/revenue-at-risk').then(r => r.data);

export const allocateShipments = (shipments: unknown[]) =>
  api.post('/api/allocate', { shipments }).then(r => r.data);

export default api;
