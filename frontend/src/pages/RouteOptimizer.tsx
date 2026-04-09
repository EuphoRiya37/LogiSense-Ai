import { useState, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Plus, Trash2, Route, TrendingDown, DollarSign, Clock, Zap, Download } from 'lucide-react'
import { optimizeRoutes } from '../services/api'
import type { RouteResult } from '../types'
import { SectionHeader, Spinner, ProgressBar } from '../components/ui'

// Custom Leaflet icons
const makeIcon = (color: string, priority: number) => L.divIcon({
  className: '',
  html: `<div style="background:${color};width:${10 + priority * 3}px;height:${10 + priority * 3}px;border-radius:50%;border:2px solid white;box-shadow:0 0 8px ${color}aa"></div>`,
  iconAnchor: [8, 8],
})

const depotIcon = L.divIcon({
  className: '',
  html: `<div style="background:#fbbf24;width:16px;height:16px;border-radius:3px;border:2px solid white;box-shadow:0 0 10px #fbbf2480;transform:rotate(45deg)"></div>`,
  iconAnchor: [8, 8],
})

const COLORS = ['#00e5ff', '#a78bfa', '#00ff87', '#fbbf24', '#f472b6', '#60a5fa']
const PRIORITY_LABEL = { 1: 'Low', 2: 'Medium', 3: 'High' }

interface StopInput { id: string; lat: number; lon: number; priority: number; weight_kg: number; name: string }

function MapBounds({ result }: { result: RouteResult | null }) {
  const map = useMap()
  useEffect(() => {
    if (!result?.routes?.length) return
    const pts: [number, number][] = []
    result.routes.forEach(r => r.stops.forEach(s => pts.push([s.lat, s.lon])))
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] })
  }, [result])
  return null
}

const randomStop = (): StopInput => ({
  id: Math.random().toString(36).slice(2, 7),
  lat: parseFloat((39.5 + (Math.random() - 0.5) * 10).toFixed(4)),
  lon: parseFloat((-98.0 + (Math.random() - 0.5) * 20).toFixed(4)),
  priority: Math.ceil(Math.random() * 3),
  weight_kg: parseFloat((Math.random() * 500 + 20).toFixed(1)),
  name: `Stop-${Math.floor(Math.random() * 9000) + 1000}`,
})

export default function RouteOptimizer() {
  const [stops, setStops] = useState<StopInput[]>([randomStop(), randomStop(), randomStop(), randomStop(), randomStop()])
  const [numVehicles, setNumVehicles] = useState(3)
  const [depotLat, setDepotLat] = useState(40.7128)
  const [depotLon, setDepotLon] = useState(-74.006)
  const [result, setResult] = useState<RouteResult | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => optimizeRoutes({
      shipments: stops.map(s => ({ ...s })),
      num_vehicles: numVehicles,
      depot_lat: depotLat,
      depot_lon: depotLon,
    }),
    onSuccess: setResult,
  })

  const addStop = () => setStops(s => [...s, randomStop()])
  const removeStop = (id: string) => setStops(s => s.filter(x => x.id !== id))
  const updateStop = (id: string, key: keyof StopInput, val: any) =>
    setStops(s => s.map(x => x.id === id ? { ...x, [key]: val } : x))

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader title="Route Optimizer" subtitle="Multi-vehicle VRP solved with Google OR-Tools / greedy heuristic — minimize distance, time & cost" />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Controls */}
        <div className="xl:col-span-2 space-y-4">
          {/* Config */}
          <div className="glass-card p-5">
            <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Route size={14} className="text-cyan-400" /> Fleet Configuration
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="stat-label block mb-1.5">Vehicles</label>
                <input type="number" value={numVehicles} onChange={e => setNumVehicles(Number(e.target.value))}
                  min={1} max={10} className="input-field" />
              </div>
              <div>
                <label className="stat-label block mb-1.5">Depot Lat</label>
                <input type="number" value={depotLat} onChange={e => setDepotLat(Number(e.target.value))}
                  step={0.0001} className="input-field" />
              </div>
              <div>
                <label className="stat-label block mb-1.5">Depot Lon</label>
                <input type="number" value={depotLon} onChange={e => setDepotLon(Number(e.target.value))}
                  step={0.0001} className="input-field" />
              </div>
            </div>
            <button className="btn-primary w-full flex items-center justify-center gap-2"
              onClick={() => mutate()} disabled={isPending || stops.length === 0}>
              {isPending ? <><Spinner size={15} color="#020510" /> Optimizing…</> : <><Zap size={14} /> Optimize Routes</>}
            </button>
          </div>

          {/* Stops list */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-white">{stops.length} Delivery Stops</span>
              <button className="btn-ghost flex items-center gap-1.5 text-xs" onClick={addStop}>
                <Plus size={12} /> Add Stop
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {stops.map((s, idx) => (
                <div key={s.id} className="glass-card p-3 fade-in-up">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-semibold text-cyan-400">{s.name}</span>
                    <button onClick={() => removeStop(s.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-600">Lat</span>
                      <input type="number" value={s.lat} step={0.001}
                        onChange={e => updateStop(s.id, 'lat', parseFloat(e.target.value))}
                        className="input-field mt-0.5 text-[11px] py-1 px-2" />
                    </div>
                    <div>
                      <span className="text-slate-600">Lon</span>
                      <input type="number" value={s.lon} step={0.001}
                        onChange={e => updateStop(s.id, 'lon', parseFloat(e.target.value))}
                        className="input-field mt-0.5 text-[11px] py-1 px-2" />
                    </div>
                    <div>
                      <span className="text-slate-600">Priority</span>
                      <select value={s.priority} onChange={e => updateStop(s.id, 'priority', Number(e.target.value))}
                        className="input-field mt-0.5 text-[11px] py-1 px-2">
                        <option value={1}>Low</option>
                        <option value={2}>Med</option>
                        <option value={3}>High</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-slate-600">kg</span>
                      <input type="number" value={s.weight_kg} step={1} min={1}
                        onChange={e => updateStop(s.id, 'weight_kg', parseFloat(e.target.value))}
                        className="input-field mt-0.5 text-[11px] py-1 px-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Savings */}
          {result && (
            <div className="glass-card p-5 space-y-3 fade-in-up" style={{ border: '1px solid rgba(0,255,135,0.2)' }}>
              <div className="text-sm font-semibold text-neon-green mb-1 flex items-center gap-2">
                <TrendingDown size={14} /> Optimization Savings
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="stat-label">Distance Saved</div>
                  <div className="text-xl font-bold font-mono text-neon-green">{result.savings.distance_saved_km} km</div>
                </div>
                <div>
                  <div className="stat-label">Time Saved</div>
                  <div className="text-xl font-bold font-mono text-cyan-400">{result.savings.time_saved_hours}h</div>
                </div>
                <div>
                  <div className="stat-label">Cost Saved</div>
                  <div className="text-xl font-bold font-mono text-purple-400">${result.savings.cost_saved_usd}</div>
                </div>
                <div>
                  <div className="stat-label">Improvement</div>
                  <div className="text-xl font-bold font-mono text-yellow-400">{result.savings.improvement_pct}%</div>
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-600 border-t border-white/5 pt-2">
                Algorithm: {result.algorithm}
              </div>
              <div className="space-y-2">
                {result.stats.route_breakdown.map(r => (
                  <div key={r.vehicle_id} className="flex items-center gap-3">
                    <div className="text-xs font-mono text-slate-400 w-16" style={{ color: COLORS[(r.vehicle_id - 1) % COLORS.length] }}>
                      V-{r.vehicle_id}
                    </div>
                    <ProgressBar value={r.distance_km} max={result.naive_stats.total_distance_km}
                      color={COLORS[(r.vehicle_id - 1) % COLORS.length]} showLabel={false} />
                    <div className="text-[11px] font-mono text-slate-400 w-16 text-right">{r.distance_km}km</div>
                    <div className="text-[11px] font-mono text-slate-500 w-10">{r.num_stops}🚦</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="xl:col-span-3">
          <div className="glass-card overflow-hidden" style={{ height: '680px' }}>
            <div className="px-4 py-3 border-b border-cyan-500/10 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400">
                {result ? `${result.stats.vehicles_used} routes plotted · ${result.stats.total_distance_km} km total` : 'Configure stops and optimize to see routes'}
              </span>
              {result && (
                <div className="flex items-center gap-3 text-xs font-mono">
                  {COLORS.slice(0, result.routes.length).map((c, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <span className="w-4 h-1 rounded-full inline-block" style={{ background: c }} />
                      V-{i + 1}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <MapContainer
              center={[39.5, -98.0]} zoom={4}
              style={{ height: 'calc(100% - 40px)', width: '100%' }}
              zoomControl={false}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap"
              />
              <MapBounds result={result} />

              {/* Depot */}
              <Marker position={[depotLat, depotLon]} icon={depotIcon}>
                <Popup>
                  <div className="font-mono text-sm"><b>🏭 Main Warehouse (Depot)</b><br />{depotLat.toFixed(4)}, {depotLon.toFixed(4)}</div>
                </Popup>
              </Marker>

              {/* Stops (before optimization) */}
              {!result && stops.map(s => (
                <Marker key={s.id} position={[s.lat, s.lon]} icon={makeIcon('#a78bfa', s.priority)}>
                  <Popup>
                    <div className="font-mono text-sm">
                      <b>{s.name}</b><br />
                      Priority: {PRIORITY_LABEL[s.priority as keyof typeof PRIORITY_LABEL]}<br />
                      Weight: {s.weight_kg}kg
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Optimized routes */}
              {result?.routes.map((route, ri) => {
                const color = route.color || COLORS[ri % COLORS.length]
                const pts: [number, number][] = route.stops.map(s => [s.lat, s.lon])
                return (
                  <div key={ri}>
                    <Polyline positions={pts} color={color} weight={3} opacity={0.85}
                       />
                    {route.stops.slice(1, -1).map((s, si) => (
                      <Marker key={`${ri}-${si}`} position={[s.lat, s.lon]} icon={makeIcon(color, (s as any).priority || 1)}>
                        <Popup>
                          <div className="font-mono text-sm">
                            <b>Stop {si + 1}</b><br />{s.name || s.id}<br />
                            Vehicle {route.vehicle_id}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </div>
                )
              })}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  )
}