import { useState, useEffect, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Plus, Trash2, Route, TrendingDown, Zap, Search, Layers, Navigation2 } from 'lucide-react'
import { optimizeRoutes, geocode } from '../services/api'
import type { RouteResult } from '../types'
import { SectionHeader, Spinner, ProgressBar } from '../components/ui'

// ── Map tile layers ────────────────────────────────────────────────────────────
const TILE_LAYERS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Maxar, Earthstar Geographics',
    label: '🛰️ Satellite',
  },
  streets: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, HERE, Garmin, FAO',
    label: '🗺️ Streets',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© CARTO © OpenStreetMap',
    label: '🌙 Dark',
  },
} as const
type TileKey = keyof typeof TILE_LAYERS

// ── Multimodal mode data ───────────────────────────────────────────────────────
const TRANSPORT_MODES = [
  { id: 'road',     icon: '🚛', label: 'Road',       color: '#00e5ff', speedKph: 75,  costPerKmPerT: 0.15, co2PerKmPerT: 0.062, overheadH: 2,  minKm: 0,   notes: 'Door-to-door, all terrains' },
  { id: 'rail',     icon: '🚂', label: 'Rail',       color: '#a78bfa', speedKph: 95,  costPerKmPerT: 0.05, co2PerKmPerT: 0.028, overheadH: 6,  minKm: 150, notes: 'Bulk cargo, low cost, fixed schedule' },
  { id: 'sea',      icon: '🚢', label: 'Sea',        color: '#00ff87', speedKph: 35,  costPerKmPerT: 0.006,co2PerKmPerT: 0.011, overheadH: 72, minKm: 500, notes: 'Cheapest/tonne-km, slow, port-to-port' },
  { id: 'air',      icon: '✈️', label: 'Air Freight',color: '#fbbf24', speedKph: 850, costPerKmPerT: 4.50, co2PerKmPerT: 0.602, overheadH: 8,  minKm: 200, notes: 'Fastest, premium price, high carbon' },
]

function calcMultimodal(distKm: number, weightKg: number) {
  const wT = weightKg / 1000
  return TRANSPORT_MODES.map(m => {
    const travelH = distKm / m.speedKph
    const totalH  = travelH + m.overheadH
    const cost    = distKm * wT * m.costPerKmPerT + 50
    const co2     = distKm * wT * m.co2PerKmPerT
    const feasible = distKm >= m.minKm
    return { ...m, transitH: round1(totalH), transitD: round1(totalH / 24), cost: round1(cost), co2: round1(co2), feasible }
  })
}
const round1 = (n: number) => Math.round(n * 10) / 10

// ── Helpers ────────────────────────────────────────────────────────────────────
const makeIcon = (color: string, priority: number, label?: string) => L.divIcon({
  className: '',
  html: `<div style="position:relative">
    <div style="background:${color};width:${10 + priority * 4}px;height:${10 + priority * 4}px;border-radius:50%;border:2.5px solid white;box-shadow:0 0 10px ${color}bb"></div>
    ${label ? `<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);background:rgba(2,5,16,0.9);color:${color};font-size:9px;font-family:monospace;padding:1px 4px;border-radius:3px;white-space:nowrap;border:1px solid ${color}40">${label}</div>` : ''}
  </div>`,
  iconAnchor: [8, 8],
})

const depotIcon = L.divIcon({
  className: '',
  html: `<div style="background:#fbbf24;width:18px;height:18px;border-radius:4px;border:2.5px solid white;box-shadow:0 0 12px #fbbf2490;transform:rotate(45deg)"></div>`,
  iconAnchor: [9, 9],
})

const COLORS = ['#00e5ff', '#a78bfa', '#00ff87', '#fbbf24', '#f472b6', '#60a5fa']
const PRIORITY_LABEL = { 1: 'Low', 2: 'Med', 3: 'High' } as const

interface StopInput {
  id: string; lat: number; lon: number; priority: number; weight_kg: number; name: string
}

// ── MapBounds — auto-fits ALL stops including Kerala ───────────────────────────
function MapBounds({ stops, result, depotLat, depotLon }: {
  stops: StopInput[]; result: RouteResult | null; depotLat: number; depotLon: number
}) {
  const map = useMap()
  useEffect(() => {
    const pts: [number, number][] = [[depotLat, depotLon], ...stops.map(s => [s.lat, s.lon] as [number, number])]
    if (result?.routes?.length) {
      result.routes.forEach(r => r.stops.forEach(s => pts.push([s.lat, s.lon])))
    }
    if (pts.length >= 2) {
      try { map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 10 }) } catch {}
    }
  }, [result, stops, depotLat, depotLon, map])
  return null
}

// ── OSRM client-side road polyline (no API key needed) ─────────────────────────
async function fetchOSRM(stops: { lat: number; lon: number }[]): Promise<[number, number][]> {
  if (stops.length < 2) return []
  const coords = stops.map(s => `${s.lon},${s.lat}`).join(';')
  try {
    const resp = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(8000) }
    )
    const data = await resp.json()
    if (data.code === 'Ok' && data.routes?.[0]) {
      return data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]])
    }
  } catch {}
  return []
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
  const [stops, setStops] = useState<StopInput[]>([
    randomStop(), randomStop(), randomStop(), randomStop(), randomStop(),
  ])
  const [numVehicles, setNumVehicles] = useState(3)
  const [depotLat, setDepotLat]     = useState(40.7128)
  const [depotLon, setDepotLon]     = useState(-74.006)
  const [result, setResult]         = useState<RouteResult | null>(null)
  const [roadPolylines, setRoadPolylines] = useState<Record<number, [number, number][]>>({})
  const [loadingRoads, setLoadingRoads]   = useState(false)
  const [tileKey, setTileKey]       = useState<TileKey>('satellite')
  const [addressQuery, setAddressQuery]   = useState('')
  const [geoResults, setGeoResults] = useState<any[]>([])
  const [showMultimodal, setShowMultimodal] = useState(false)
  const [mmData, setMmData]         = useState<ReturnType<typeof calcMultimodal> | null>(null)

  // ── After optimization, fetch OSRM polylines for each vehicle route ──────────
  const fetchAllRoads = useCallback(async (routes: RouteResult['routes']) => {
    setLoadingRoads(true)
    const polys: Record<number, [number, number][]> = {}
    await Promise.all(routes.map(async (r) => {
      const pts = r.stops.filter(s => s.lat && s.lon)
      const poly = await fetchOSRM(pts)
      if (poly.length > 1) polys[r.vehicle_id] = poly
    }))
    setRoadPolylines(polys)
    setLoadingRoads(false)
  }, [])

  const { mutate, isPending } = useMutation({
    mutationFn: () => optimizeRoutes({
      shipments: stops.map(s => ({ ...s })),
      num_vehicles: numVehicles,
      optimize_for: 'balanced',
      depot_lat: depotLat,
      depot_lon: depotLon,
    }),
    onSuccess: (data) => {
      setResult(data)
      fetchAllRoads(data.routes)
      // Compute multimodal for average route distance
      if (data.stats?.total_distance_km) {
        const totalWeight = stops.reduce((a, s) => a + s.weight_kg, 0)
        setMmData(calcMultimodal(data.stats.total_distance_km, totalWeight))
        setShowMultimodal(true)
      }
    },
  })

  const addStop = () => setStops(s => [...s, randomStop()])
  const removeStop = (id: string) => setStops(s => s.filter(x => x.id !== id))
  const updateStop = (id: string, key: keyof StopInput, val: any) =>
    setStops(s => s.map(x => x.id === id ? { ...x, [key]: val } : x))

  const handleGeoSearch = async () => {
    if (!addressQuery.trim()) return
    try { setGeoResults(await geocode(addressQuery)) } catch { setGeoResults([]) }
  }

  const addGeoStop = (r: any) => {
    setStops(s => [...s, {
      id: Math.random().toString(36).slice(2, 7),
      lat: parseFloat(Number(r.lat).toFixed(6)),
      lon: parseFloat(Number(r.lon).toFixed(6)),
      name: r.display_name.slice(0, 35),
      priority: 2, weight_kg: 100,
    }])
    setGeoResults([]); setAddressQuery('')
  }

  const tile = TILE_LAYERS[tileKey]
  const totalDistKm = stops.reduce((acc, s) => {
    const d = Math.sqrt((s.lat - depotLat) ** 2 + (s.lon - depotLon) ** 2) * 111
    return acc + d
  }, 0)

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Route Optimizer"
        subtitle="Multi-vehicle VRP · Google OR-Tools · OSRM real road routing · Multimodal comparison"
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* ── Left controls ─────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Fleet config */}
          <div className="glass-card p-5">
            <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Route size={14} className="text-cyan-400" /> Fleet Configuration
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Vehicles', val: numVehicles, set: setNumVehicles, min: 1, max: 10, step: 1 },
                { label: 'Depot Lat', val: depotLat,   set: setDepotLat,   min: -90, max: 90, step: 0.0001 },
                { label: 'Depot Lon', val: depotLon,   set: setDepotLon,   min: -180,max: 180,step: 0.0001 },
              ].map(({ label, val, set, min, max, step }) => (
                <div key={label}>
                  <label className="stat-label block mb-1.5">{label}</label>
                  <input type="number" value={val} min={min} max={max} step={step}
                    onChange={e => set(Number(e.target.value) as any)}
                    className="input-field" />
                </div>
              ))}
            </div>
            <button className="btn-primary w-full flex items-center justify-center gap-2"
              onClick={() => mutate()} disabled={isPending || stops.length === 0}>
              {isPending
                ? <><Spinner size={15} color="#020510" /> Optimizing…</>
                : <><Zap size={14} /> Optimize Routes</>}
            </button>
            {loadingRoads && (
              <div className="flex items-center gap-2 mt-2 text-[10px] font-mono text-cyan-400">
                <Spinner size={10} color="#00e5ff" /> Fetching real road paths via OSRM…
              </div>
            )}
          </div>

          {/* Address search */}
          <div className="glass-card p-4">
            <div className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
              <Search size={13} className="text-cyan-400" /> Search Address (Geocode)
            </div>
            <div className="flex gap-2">
              <input value={addressQuery}
                onChange={e => setAddressQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGeoSearch()}
                placeholder="e.g. Thiruvananthapuram, Kerala"
                className="input-field flex-1 text-xs" />
              <button className="btn-ghost text-xs px-3" onClick={handleGeoSearch}>Go</button>
            </div>
            {geoResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-36 overflow-y-auto">
                {geoResults.slice(0, 5).map((r, i) => (
                  <button key={i}
                    className="w-full text-left text-[10px] font-mono text-slate-400 hover:text-cyan-400 px-2 py-1.5 rounded glass-card truncate transition-colors"
                    onClick={() => addGeoStop(r)}>
                    + {r.display_name.slice(0, 65)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stops list */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-white">{stops.length} Delivery Stops</span>
              <button className="btn-ghost flex items-center gap-1.5 text-xs" onClick={addStop}>
                <Plus size={12} /> Add Random
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {stops.map((s, idx) => (
                <div key={s.id} className="glass-card p-3 fade-in-up">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                      <span className="text-xs font-mono font-semibold text-slate-300 truncate max-w-[140px]">{s.name}</span>
                    </div>
                    <button onClick={() => removeStop(s.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 text-[11px]">
                    {[
                      { label: 'Lat', key: 'lat' as const, step: '0.001' },
                      { label: 'Lon', key: 'lon' as const, step: '0.001' },
                    ].map(({ label, key, step }) => (
                      <div key={key}>
                        <span className="text-slate-600 text-[9px]">{label}</span>
                        <input type="number" value={s[key]} step={step}
                          onChange={e => updateStop(s.id, key, parseFloat(e.target.value))}
                          className="input-field mt-0.5 text-[11px] py-1 px-2" />
                      </div>
                    ))}
                    <div>
                      <span className="text-slate-600 text-[9px]">Priority</span>
                      <select value={s.priority}
                        onChange={e => updateStop(s.id, 'priority', Number(e.target.value))}
                        className="input-field mt-0.5 text-[11px] py-1 px-2">
                        <option value={1}>Low</option>
                        <option value={2}>Med</option>
                        <option value={3}>High</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-slate-600 text-[9px]">kg</span>
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
            <div className="glass-card p-5 space-y-3 fade-in-up"
              style={{ border: '1px solid rgba(0,255,135,0.2)' }}>
              <div className="text-sm font-semibold text-neon-green flex items-center gap-2">
                <TrendingDown size={14} /> Optimization Savings
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Distance Saved', val: `${result.savings.distance_saved_km} km`, color: '#00ff87' },
                  { label: 'Time Saved',     val: `${result.savings.time_saved_hours}h`,   color: '#00e5ff' },
                  { label: 'Cost Saved',     val: `$${result.savings.cost_saved_usd}`,      color: '#a78bfa' },
                  { label: 'Improvement',    val: `${result.savings.improvement_pct}%`,     color: '#fbbf24' },
                ].map(k => (
                  <div key={k.label} className="glass-card p-3">
                    <div className="stat-label text-[9px]">{k.label}</div>
                    <div className="text-xl font-bold font-mono mt-1" style={{ color: k.color }}>{k.val}</div>
                  </div>
                ))}
                <div className="col-span-2 glass-card p-3 flex items-center gap-3"
                  style={{ border: '1px solid rgba(0,255,135,0.2)' }}>
                  <span className="text-xl">🌱</span>
                  <div>
                    <div className="stat-label text-[9px]">CO₂ Prevented</div>
                    <div className="text-lg font-bold font-mono text-neon-green">
                      {(result.savings as any).co2_saved_kg ?? round1(result.savings.distance_saved_km * 1.02)} kg
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-600 pt-1">
                Algorithm: {result.algorithm}
              </div>
              <div className="space-y-2">
                {result.stats.route_breakdown.map(r => (
                  <div key={r.vehicle_id} className="flex items-center gap-3">
                    <div className="w-16 text-xs font-mono" style={{ color: COLORS[(r.vehicle_id - 1) % COLORS.length] }}>
                      V-{r.vehicle_id}
                    </div>
                    <ProgressBar value={r.distance_km} max={result.naive_stats.total_distance_km}
                      color={COLORS[(r.vehicle_id - 1) % COLORS.length]} showLabel={false} />
                    <div className="text-[11px] font-mono text-slate-400 w-16 text-right">{r.distance_km}km</div>
                    <div className="text-[11px] font-mono text-slate-500 w-8">{r.num_stops}🚦</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multimodal comparison */}
          {showMultimodal && mmData && (
            <div className="glass-card p-5 fade-in-up" style={{ border: '1px solid rgba(251,191,36,0.2)' }}>
              <div className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                🚛🚂🚢✈️
                <span>Multimodal Route Comparison</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mb-3">
                For {round1(result?.stats.total_distance_km ?? totalDistKm)}km ·{' '}
                {stops.reduce((a, s) => a + s.weight_kg, 0).toFixed(0)}kg total cargo
              </div>
              <div className="space-y-2">
                {mmData.map((m, i) => (
                  <div key={m.id}
                    className={`glass-card p-3 transition-all ${!m.feasible ? 'opacity-40' : ''}`}
                    style={i === 0 ? { border: `1px solid ${m.color}40` } : {}}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{m.icon}</span>
                        <div>
                          <div className="text-xs font-semibold" style={{ color: m.color }}>
                            {m.label}
                            {i === 0 && m.feasible && (
                              <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded-full font-mono"
                                style={{ background: `${m.color}20`, color: m.color }}>OPTIMAL</span>
                            )}
                          </div>
                          <div className="text-[9px] text-slate-600 font-mono">{m.notes}</div>
                        </div>
                      </div>
                      {!m.feasible && (
                        <span className="text-[9px] text-red-400 font-mono">Min {m.minKm}km required</span>
                      )}
                    </div>
                    {m.feasible && (
                      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                        <div className="glass-card p-1.5 text-center">
                          <div className="text-slate-500">Cost</div>
                          <div style={{ color: m.color }}>${m.cost}</div>
                        </div>
                        <div className="glass-card p-1.5 text-center">
                          <div className="text-slate-500">Transit</div>
                          <div style={{ color: m.color }}>{m.transitD}d</div>
                        </div>
                        <div className="glass-card p-1.5 text-center">
                          <div className="text-slate-500">CO₂</div>
                          <div style={{ color: m.color }}>{m.co2}kg</div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Map ────────────────────────────────────────────────────────── */}
        <div className="xl:col-span-3">
          <div className="glass-card overflow-hidden" style={{ height: '760px' }}>
            {/* Map toolbar */}
            <div className="px-4 py-2.5 border-b border-cyan-500/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                <Navigation2 size={11} className="text-cyan-400" />
                {result
                  ? `${result.stats.vehicles_used} routes · ${result.stats.total_distance_km}km · ${Object.keys(roadPolylines).length} road paths loaded`
                  : `${stops.length} stops configured`}
              </div>

              {/* Tile switcher */}
              <div className="flex gap-1 p-0.5 glass-card">
                {(Object.keys(TILE_LAYERS) as TileKey[]).map(k => (
                  <button key={k} onClick={() => setTileKey(k)}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                      tileKey === k ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    style={tileKey === k ? { background: 'rgba(0,229,255,0.15)', color: '#00e5ff' } : {}}>
                    {TILE_LAYERS[k].label}
                  </button>
                ))}
              </div>

              {/* Legend */}
              {result && (
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                  {COLORS.slice(0, result.routes.length).map((c, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="w-5 h-0.5 rounded-full inline-block" style={{ background: c }} />
                      V{i + 1}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <MapContainer
              center={[20, 0]} zoom={2}
              style={{ height: 'calc(100% - 42px)', width: '100%' }}
              zoomControl
            >
              <TileLayer key={tileKey} url={tile.url} attribution={tile.attribution} />
              <MapBounds stops={stops} result={result} depotLat={depotLat} depotLon={depotLon} />

              {/* Depot */}
              <Marker position={[depotLat, depotLon]} icon={depotIcon}>
                <Popup>
                  <div className="font-mono text-xs">
                    <b style={{ color: '#fbbf24' }}>🏭 Main Warehouse (Depot)</b><br />
                    {depotLat.toFixed(4)}, {depotLon.toFixed(4)}
                  </div>
                </Popup>
              </Marker>

              {/* Unoptimized stops — visible before optimization */}
              {!result && stops.map((s, idx) => (
                <Marker key={s.id} position={[s.lat, s.lon]}
                  icon={makeIcon(COLORS[idx % COLORS.length], s.priority, s.name.slice(0, 12))}>
                  <Popup>
                    <div className="font-mono text-xs">
                      <b>{s.name}</b><br />
                      Priority: {PRIORITY_LABEL[s.priority as keyof typeof PRIORITY_LABEL]}<br />
                      Weight: {s.weight_kg}kg<br />
                      {s.lat.toFixed(5)}, {s.lon.toFixed(5)}
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Optimized routes with real road polylines */}
              {result?.routes.map((route, ri) => {
                const color = route.color || COLORS[ri % COLORS.length]
                const roadPoly = roadPolylines[route.vehicle_id]
                const straightPts: [number, number][] = route.stops.map(s => [s.lat, s.lon])
                const positions = roadPoly && roadPoly.length > 1 ? roadPoly : straightPts

                return (
                  <div key={ri}>
                    {/* Road or straight-line path */}
                    <Polyline
                      positions={positions}
                      color={color}
                      weight={roadPoly ? 4 : 2}
                      opacity={0.9}
                      dashArray={roadPoly ? undefined : '8 6'}
                    />
                    {/* Stop markers */}
                    {route.stops.slice(1, -1).map((s, si) => (
                      <Marker key={`${ri}-${si}`} position={[s.lat, s.lon]}
                        icon={makeIcon(color, (s as any).priority || 2, `${si + 1}`)}>
                        <Popup>
                          <div className="font-mono text-xs">
                            <b style={{ color }}>V{route.vehicle_id} · Stop {si + 1}</b><br />
                            {(s as any).name || s.id}<br />
                            {s.lat.toFixed(4)}, {s.lon.toFixed(4)}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </div>
                )
              })}
            </MapContainer>
          </div>

          {/* Road routing status */}
          {result && (
            <div className="mt-2 flex items-center gap-3 text-[10px] font-mono px-1">
              {loadingRoads
                ? <span className="text-cyan-400 flex items-center gap-1.5"><Spinner size={8} color="#00e5ff" /> Loading OSRM road paths…</span>
                : Object.keys(roadPolylines).length > 0
                ? <span className="text-neon-green">✓ Real road paths loaded ({Object.keys(roadPolylines).length}/{result.routes.length} routes via OSRM)</span>
                : <span className="text-slate-500">Showing straight-line paths (OSRM unavailable — check network)</span>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
