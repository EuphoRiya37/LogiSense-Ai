import axios from 'axios'
import type { ShipmentInput, RouteStop } from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
})

export const getStatus = () =>
  api.get('/api/status').then(r => r.data)

export const getSummary = () =>
  api.get('/api/analytics/summary').then(r => r.data)

export const getTrends = () =>
  api.get('/api/analytics/trends').then(r => r.data)

export const getModePerformance = () =>
  api.get('/api/analytics/mode-performance').then(r => r.data)

export const getModelPerformance = () =>
  api.get('/api/analytics/model-performance').then(r => r.data)

export const getDemandForecast = () =>
  api.get('/api/analytics/demand-forecast').then(r => r.data)

export const getLiveShipments = () =>
  api.get('/api/shipments').then(r => r.data)

export const predictFull = (payload: ShipmentInput) =>
  api.post('/api/predict/full', payload).then(r => r.data)

export const predictETA = (payload: ShipmentInput) =>
  api.post('/api/predict/eta', payload).then(r => r.data)

export const predictDelay = (payload: ShipmentInput) =>
  api.post('/api/predict/delay', payload).then(r => r.data)

export const predictBatch = (payload: { shipments: ShipmentInput[] }) =>
  api.post('/api/predict/batch', payload).then(r => r.data)

export const predictWhatIf = (payload: { base: ShipmentInput; scenarios: any[] }) =>
  api.post('/api/predict/whatif', payload).then(r => r.data)

export const compareModes = (payload: ShipmentInput) =>
  api.post('/api/predict/compare', payload).then(r => r.data)

export const optimizeRoutes = (payload: {
  shipments: RouteStop[]
  num_vehicles: number
  optimize_for: string
  depot_lat: number
  depot_lon: number
}) => api.post('/api/optimize/routes', payload).then(r => r.data)

export const optimizeRoutesRoad = (payload: {
  shipments: RouteStop[]
  num_vehicles: number
  optimize_for: string
  depot_lat: number
  depot_lon: number
}) => api.post('/api/optimize/routes/road', payload).then(r => r.data)

export const exportRoutes = (payload: {
  shipments: RouteStop[]
  num_vehicles: number
  optimize_for: string
  depot_lat: number
  depot_lon: number
}) =>
  api.post('/api/export/routes', payload, { responseType: 'blob' }).then(r => r.data)

export const allocateShipments = (payload: { shipments: any[] }) =>
  api.post('/api/allocate', payload).then(r => r.data)

export const getWeather = (lat = 39.5, lon = -98.0) =>
  api.get('/api/weather', { params: { lat, lon } }).then(r => r.data)

export const getGlobalWeather = () =>
  api.get('/api/weather/global').then(r => r.data)

export const getInsights = () =>
  api.get('/api/insights').then(r => r.data)

export const geocode = (q: string) =>
  api.get('/api/geocode', { params: { q } }).then(r => r.data)

export const runStressTest = () =>
  api.post('/api/stress-test').then(r => r.data)

export const getRevenueAtRisk = () =>
  api.get('/api/analytics/revenue-at-risk').then(r => r.data)

export default api