import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import { Truck, Plus, Trash2, PlayCircle, BarChart2, Clock, Layers, Navigation2 } from 'lucide-react'
import { allocateShipments } from '../services/api'
import { SectionHeader, Spinner, ProgressBar } from '../components/ui'

// ── Tile layer options ─────────────────────────────────────────────────────────
const TILE_LAYERS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, Maxar, Earthstar Geographics',
    label: '🛰️ Satellite',
  },
  streets: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri, HERE, Garmin',
    label: '🗺️ Streets',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '© CARTO © OpenStreetMap',
    label: '🌙 Dark',
  },
} as const
type TileKey = keyof typeof TILE_LAYERS

// ── Known city coordinates for map placement ───────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  'New York':    [40.7128, -74.0060],
  'Chicago':     [41.8781, -87.6298],
  'LA':          [34.0522, -118.2437],
  'Los Angeles': [34.0522, -118.2437],
  'Houston':     [29.7604, -95.3698],
  'Phoenix':     [33.4484, -112.0740],
  'Dallas':      [32.7767, -96.7970],
  'Seattle':     [47.6062, -122.3321],
  'Miami':       [25.7617, -80.1918],
  'Boston':      [42.3601, -71.0589],
  'Denver':      [39.7392, -104.9903],
  'Atlanta':     [33.7490, -84.3880],
  'Portland':    [45.5051, -122.6750],
  'Las Vegas':   [36.1699, -115.1398],
  'Detroit':     [42.3314, -83.0458],
  'Minneapolis': [44.9778, -93.2650],
  'San Antonio': [29.4241, -98.4936],
  'Philadelphia':[39.9526, -75.1652],
  'San Diego':   [32.7157, -117.1611],
  'San Jose':    [37.3382, -121.8863],
}

const DEPOT: [number, number] = [39.8283, -98.5795] // Geographic center of US

const VEHICLE_ICONS: Record<string, string> = { Van: '🚐', Truck: '🚛', Heavy: '🚜', Express: '⚡' }
const VEHICLE_COLORS: Record<string, string> = {
  Van: '#00e5ff', Truck: '#a78bfa', Heavy: '#ff6b35', Express: '#00ff87'
}

// ── Leaflet icon builder ───────────────────────────────────────────────────────
const makeVehicleIcon = (color: string, vehicleType: string) => L.divIcon({
  className: '',
  html: `<div style="display:flex;flex-direction:column;align-items:center">
    <div style="background:${color};color:#020510;font-size:13px;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 0 12px ${color}99">
      ${VEHICLE_ICONS[vehicleType] || '🚛'}
    </div>
    <div style="width:2px;height:6px;background:${color}"></div>
  </div>`,
  iconAnchor: [14, 34],
})

const makeDestIcon = (color: string, label: string, priority: number) => L.divIcon({
  className: '',
  html: `<div style="position:relative">
    <div style="background:${color};width:${8 + priority * 3}px;height:${8 + priority * 3}px;border-radius:50%;border:2px solid white;box-shadow:0 0 8px ${color}bb"></div>
    <div style="position:absolute;top:-16px;left:50%;transform:translateX(-50%);background:rgba(2,5,16,0.92);color:${color};font-size:9px;font-family:monospace;padding:1px 4px;border-radius:3px;white-space:nowrap;border:1px solid ${color}40">${label}</div>
  </div>`,
  iconAnchor: [6, 6],
})

const depotIcon = L.divIcon({
  className: '',
  html: `<div style="background:#fbbf24;width:20px;height:20px;border-radius:4px;border:2.5px solid white;box-shadow:0 0 16px #fbbf2499;transform:rotate(45deg)"></div>`,
  iconAnchor: [10, 10],
})

const PRIORITY_LABEL: Record<number, { label: string; color: string }> = {
  3: { label: 'HIGH', color: '#00ff87' },
  2: { label: 'MED',  color: '#fbbf24' },
  1: { label: 'LOW',  color: '#94a3b8' },
}

const randomShipment = (i: number) => ({
  id: `SHP-${String(i).padStart(4, '0')}`,
  destination: Object.keys(CITY_COORDS)[Math.floor(Math.random() * Object.keys(CITY_COORDS).length)],
  weight_kg: Math.round(Math.random() * 800 + 20),
  priority: Math.ceil(Math.random() * 3) as 1 | 2 | 3,
  distance_km: Math.round(Math.random() * 400 + 30),
  product: ['Electronics', 'Furniture', 'Food', 'Automotive', 'Clothing'][Math.floor(Math.random() * 5)],
})

export default function FleetAllocation() {
  const [shipments, setShipments] = useState(() =>
    Array.from({ length: 8 }, (_, i) => randomShipment(i + 1))
  )
  const [result, setResult]   = useState<any>(null)
  const [tileKey, setTileKey] = useState<TileKey>('satellite')

  const { mutate, isPending } = useMutation({
    mutationFn: () => allocateShipments(shipments),
    onSuccess: setResult,
  })

  const addShipment  = () => setShipments(s => [...s, randomShipment(s.length + 1)])
  const removeShipment = (id: string) => setShipments(s => s.filter(x => x.id !== id))
  const updatePriority = (id: string, p: number) =>
    setShipments(s => s.map(x => x.id === id ? { ...x, priority: p as 1 | 2 | 3 } : x))
  const updateWeight = (id: string, w: number) =>
    setShipments(s => s.map(x => x.id === id ? { ...x, weight_kg: w } : x))
  const updateDest = (id: string, dest: string) =>
    setShipments(s => s.map(x => x.id === id ? { ...x, destination: dest } : x))

  const totalWeight = shipments.reduce((a, b) => a + b.weight_kg, 0)
  const tile = TILE_LAYERS[tileKey]

  // Build map markers from allocation result
  const mapAllocations = result?.allocations ?? []

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader title="Fleet Allocation"
        subtitle="Best-Fit Decreasing bin-packing · Priority-aware vehicle assignment · Live route map" />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* ── Left: Shipment list ─────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck size={14} className="text-cyan-400" />
                <span className="text-sm font-semibold text-white">{shipments.length} Pending Shipments</span>
                <span className="text-xs font-mono text-slate-500">({totalWeight.toLocaleString()}kg)</span>
              </div>
              <button className="btn-ghost text-xs flex items-center gap-1.5" onClick={addShipment}>
                <Plus size={12} /> Add
              </button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4 pr-1">
              {shipments.map(s => {
                const p = PRIORITY_LABEL[s.priority]
                return (
                  <div key={s.id} className="glass-card px-3 py-2.5 flex items-center gap-3 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-cyan-400 font-semibold">{s.id}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold"
                          style={{ color: p.color, background: `${p.color}18` }}>{p.label}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        {s.product} →{' '}
                        <select value={s.destination}
                          onChange={e => updateDest(s.id, e.target.value)}
                          className="bg-transparent text-slate-400 text-[10px] font-mono border-none outline-none">
                          {Object.keys(CITY_COORDS).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input type="number" value={s.weight_kg} min={1}
                        onChange={e => updateWeight(s.id, Number(e.target.value))}
                        className="input-field w-16 text-xs py-1 px-2" />
                      <span className="text-[10px] text-slate-600 font-mono">kg</span>
                      <select value={s.priority}
                        onChange={e => updatePriority(s.id, Number(e.target.value))}
                        className="input-field text-xs py-1 px-2 w-12">
                        <option value={1}>P1</option>
                        <option value={2}>P2</option>
                        <option value={3}>P3</option>
                      </select>
                      <button onClick={() => removeShipment(s.id)}
                        className="text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <button className="btn-primary w-full flex items-center justify-center gap-2"
              onClick={() => mutate()} disabled={isPending || shipments.length === 0}>
              {isPending
                ? <><Spinner size={15} color="#020510" /> Allocating…</>
                : <><PlayCircle size={14} /> Run Fleet Allocation</>}
            </button>
          </div>

          {/* Stats summary */}
          {result && (
            <div className="glass-card p-5 fade-in-up" style={{ border: '1px solid rgba(0,229,255,0.2)' }}>
              <div className="stat-label mb-3 flex items-center gap-2">
                <BarChart2 size={12} className="text-cyan-400" /> Allocation Summary
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Vehicles Used',    val: result.stats?.total_vehicles_used,           color: '#00e5ff' },
                  { label: 'Success Rate',      val: `${result.stats?.allocation_success_rate}%`, color: '#00ff87' },
                  { label: 'Total Allocated',   val: result.stats?.total_allocated,               color: '#a78bfa' },
                  { label: 'Avg Utilization',   val: `${result.stats?.avg_utilization_pct}%`,     color: '#fbbf24' },
                ].map(stat => (
                  <div key={stat.label} className="glass-card p-3">
                    <div className="stat-label text-[9px] mb-1">{stat.label}</div>
                    <div className="text-xl font-bold font-mono" style={{ color: stat.color }}>{stat.val}</div>
                  </div>
                ))}
              </div>
              {result.stats?.unallocated_count > 0 && (
                <div className="mt-3 text-xs font-mono text-orange-400">
                  ⚠ {result.stats.unallocated_count} shipment(s) overweight — no suitable vehicle
                </div>
              )}

              {/* Vehicle breakdown */}
              <div className="mt-4 space-y-2">
                {result.allocations?.map((v: any) => {
                  const color = VEHICLE_COLORS[v.vehicle_type] || '#00e5ff'
                  return (
                    <div key={v.vehicle_id} className="glass-card p-3"
                      style={{ borderLeft: `3px solid ${color}` }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span>{VEHICLE_ICONS[v.vehicle_type] || '🚛'}</span>
                          <span className="text-xs font-mono font-semibold" style={{ color }}>{v.vehicle_id}</span>
                        </div>
                        <span className="text-xs font-mono" style={{ color }}>{v.utilization_pct}%</span>
                      </div>
                      <ProgressBar value={v.utilization_pct} max={100}
                        color={v.utilization_pct > 85 ? '#ef4444' : v.utilization_pct > 65 ? '#fbbf24' : color}
                        showLabel={false} />
                      <div className="text-[9px] font-mono text-slate-500 mt-1">
                        {v.total_load_kg.toLocaleString()} / {v.capacity_kg.toLocaleString()} kg · {v.shipment_count} shipments
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Schedule */}
          {result?.schedule?.length > 0 && (
            <div className="glass-card p-4 fade-in-up">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={12} className="text-purple-400" />
                <span className="text-xs font-semibold text-white">Delivery Schedule</span>
                <span className="text-[10px] font-mono text-slate-500 ml-auto">Departs 07:30</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.schedule.map((v: any) => {
                  const color = VEHICLE_COLORS[v.vehicle_type] || '#00e5ff'
                  return (
                    <div key={v.vehicle_id} className="glass-card p-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                        <span className="text-[11px] font-mono font-semibold" style={{ color }}>
                          {VEHICLE_ICONS[v.vehicle_type]} {v.vehicle_id}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono ml-auto">→ {v.estimated_return}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {v.stops?.slice(0, 4).map((stop: any) => (
                          <span key={stop.seq}
                            className="text-[9px] font-mono text-slate-400 glass-card px-1.5 py-0.5">
                            {stop.seq}. {stop.destination?.slice(0, 10)}
                            <span className="text-cyan-400 ml-1">@{stop.arrival}</span>
                          </span>
                        ))}
                        {v.stops?.length > 4 && (
                          <span className="text-[9px] font-mono text-slate-600 glass-card px-1.5 py-0.5">
                            +{v.stops.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Map ──────────────────────────────────────────────── */}
        <div className="xl:col-span-3">
          <div className="glass-card overflow-hidden" style={{ height: '760px' }}>
            {/* Map toolbar */}
            <div className="px-4 py-2.5 border-b border-cyan-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <Navigation2 size={11} className="text-cyan-400" />
                {result
                  ? `${result.stats?.total_vehicles_used} vehicles · ${result.stats?.total_allocated} shipments mapped`
                  : `${shipments.length} pending shipments · Run allocation to see vehicle routes`}
              </div>

              {/* Tile switcher */}
              <div className="flex gap-0.5 p-0.5 glass-card">
                {(Object.keys(TILE_LAYERS) as TileKey[]).map(k => (
                  <button key={k} onClick={() => setTileKey(k)}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                      tileKey === k ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    style={tileKey === k ? { background: 'rgba(0,229,255,0.12)' } : {}}>
                    {TILE_LAYERS[k].label}
                  </button>
                ))}
              </div>
            </div>

            <MapContainer
              center={[39.5, -98.0]} zoom={4}
              style={{ height: 'calc(100% - 42px)', width: '100%' }}
              zoomControl
            >
              <TileLayer key={tileKey} url={tile.url} attribution={tile.attribution} />

              {/* Depot */}
              <Marker position={DEPOT} icon={depotIcon}>
                <Popup>
                  <div className="font-mono text-xs">
                    <b style={{ color: '#fbbf24' }}>🏭 Central Distribution Hub</b><br />
                    Depot coordinates: 39.83°N, 98.58°W
                  </div>
                </Popup>
              </Marker>

              {/* Before allocation: show all shipment destinations */}
              {!result && shipments.map((s, i) => {
                const coords = CITY_COORDS[s.destination]
                if (!coords) return null
                const p = PRIORITY_LABEL[s.priority]
                return (
                  <div key={s.id}>
                    <Polyline
                      positions={[DEPOT, coords]}
                      color={p.color} weight={1} opacity={0.25} dashArray="4 8"
                    />
                    <Marker position={coords} icon={makeDestIcon(p.color, s.id, s.priority)}>
                      <Popup>
                        <div className="font-mono text-xs">
                          <b style={{ color: p.color }}>{s.id}</b><br />
                          {s.product} → {s.destination}<br />
                          {s.weight_kg}kg · Priority {s.priority}
                        </div>
                      </Popup>
                    </Marker>
                  </div>
                )
              })}

              {/* After allocation: show vehicle-colored routes */}
              {result && mapAllocations.map((alloc: any) => {
                const color = VEHICLE_COLORS[alloc.vehicle_type] || '#00e5ff'
                const vehCoords = CITY_COORDS[alloc.shipments?.[0]?.destination] ?? DEPOT
                return (
                  <div key={alloc.vehicle_id}>
                    {/* Vehicle icon near depot / first stop */}
                    <Marker position={DEPOT} icon={makeVehicleIcon(color, alloc.vehicle_type)}>
                      <Popup>
                        <div className="font-mono text-xs">
                          <b style={{ color }}>{VEHICLE_ICONS[alloc.vehicle_type]} {alloc.vehicle_id}</b><br />
                          Type: {alloc.vehicle_type}<br />
                          Capacity: {alloc.capacity_kg.toLocaleString()}kg<br />
                          Load: {alloc.total_load_kg.toLocaleString()}kg ({alloc.utilization_pct}%)<br />
                          Shipments: {alloc.shipment_count}
                        </div>
                      </Popup>
                    </Marker>

                    {/* Draw route lines to all destinations */}
                    {alloc.shipments?.map((s: any, si: number) => {
                      const destCoords = CITY_COORDS[s.destination]
                      if (!destCoords) return null
                      const prevCoords = si === 0
                        ? DEPOT
                        : CITY_COORDS[alloc.shipments[si - 1]?.destination] ?? DEPOT
                      return (
                        <div key={`${alloc.vehicle_id}-${s.id}`}>
                          <Polyline
                            positions={[prevCoords, destCoords]}
                            color={color} weight={2.5} opacity={0.75}
                            dashArray={si > 0 ? '6 4' : undefined}
                          />
                          <Marker position={destCoords}
                            icon={makeDestIcon(color, `${alloc.vehicle_id.slice(-2)}·${si + 1}`, s.priority || 2)}>
                            <Popup>
                              <div className="font-mono text-xs">
                                <b style={{ color }}>{s.id || `SHP-${si}`}</b><br />
                                Vehicle: {alloc.vehicle_id}<br />
                                Destination: {s.destination}<br />
                                Weight: {s.weight_kg}kg<br />
                                Priority: P{s.priority}
                              </div>
                            </Popup>
                          </Marker>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </MapContainer>
          </div>

          {/* Map legend */}
          {result && (
            <div className="mt-2 flex items-center gap-4 text-[10px] font-mono px-1 text-slate-500 flex-wrap">
              {mapAllocations.map((v: any) => {
                const color = VEHICLE_COLORS[v.vehicle_type] || '#00e5ff'
                return (
                  <span key={v.vehicle_id} className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 rounded-full inline-block" style={{ background: color }} />
                    <span style={{ color }}>{VEHICLE_ICONS[v.vehicle_type]} {v.vehicle_id}</span>
                    <span className="text-slate-600">({v.shipment_count} stops)</span>
                  </span>
                )
              })}
              <span className="flex items-center gap-1.5 ml-auto">
                <span className="w-4 h-4 inline-block" style={{
                  background: '#fbbf24', borderRadius: '3px', transform: 'rotate(45deg)', display: 'inline-block', width: '10px', height: '10px'
                }} />
                <span>Central Depot</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
