import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet'
import L from 'leaflet'
import { Radio, AlertTriangle, TrendingUp, Package, CheckCircle, Cloud, Wifi, Zap } from 'lucide-react'
import { subscribeTracking } from '../services/websocket'
import { getWeather, injectIncident } from '../services/api'
import type { LiveShipment, Alert } from '../types'
import { SectionHeader, StatusBadge, Spinner } from '../components/ui'

function makeShipIcon(color: string, status: string) {
  const size = status === 'delayed' ? 14 : status === 'delivered' ? 12 : 10
  const pulse =
    status === 'delayed'
      ? `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${size * 2.5}px;height:${size * 2.5}px;border-radius:50%;border:1.5px solid ${color};opacity:0.4;animation:ping-cyan 1.5s infinite"></div>`
      : ''
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${size}px;height:${size}px">${pulse}<div style="position:absolute;top:0;left:0;width:100%;height:100%;border-radius:50%;background:${color};border:1.5px solid rgba(255,255,255,0.6);box-shadow:0 0 8px ${color}99"></div></div>`,
    iconAnchor: [size / 2, size / 2],
  })
}

function makeIncidentIcon(icon: string, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="font-size:20px;filter:drop-shadow(0 0 6px ${color});cursor:pointer">${icon}</div>`,
    iconAnchor: [12, 12],
  })
}

function AnimatedMarkers({ shipments }: { shipments: LiveShipment[] }) {
  return (
    <>
      {shipments.map(s => (
        <div key={s.id}>
          <Polyline
            positions={[[s.origin_lat, s.origin_lon], [s.dest_lat, s.dest_lon]]}
            color={s.status_color} weight={1} opacity={0.18} dashArray="4 8"
          />
          <Marker position={[s.current_lat, s.current_lon]} icon={makeShipIcon(s.status_color, s.status)}>
            <Popup>
              <div className="font-mono text-xs min-w-[180px] space-y-1">
                <div className="font-bold text-sm" style={{ color: s.status_color }}>{s.id}</div>
                <div className="text-slate-300">{s.product}</div>
                <div className="text-slate-500">{s.origin} → {s.destination}</div>
                <div>Progress: <span style={{ color: s.status_color }}>{s.progress}%</span></div>
                <div>ETA: <span className="text-cyan-400">{s.eta_display}</span></div>
                <div>Weight: {s.weight_kg}kg · Carrier: {s.carrier}</div>
                {s.delay_reason && <div className="text-orange-400">⚠ {s.delay_reason}</div>}
              </div>
            </Popup>
          </Marker>
        </div>
      ))}
    </>
  )
}

const INCIDENT_TYPES_MENU = [
  { id: 'road_closure',       label: '🚧 Road Closure' },
  { id: 'weather_event',      label: '⛈️ Weather Event' },
  { id: 'congestion',         label: '🚦 Congestion' },
  { id: 'ambulance_priority', label: '🚑 Ambulance Priority' },
  { id: 'customs_hold',       label: '🛃 Customs Hold' },
  { id: 'port_strike',        label: '⚓ Port Strike' },
]

export default function LiveTracking() {
  const [shipments, setShipments]   = useState<LiveShipment[]>([])
  const [alerts, setAlerts]         = useState<Alert[]>([])
  const [incidents, setIncidents]   = useState<any[]>([])
  const [kpis, setKpis]             = useState({ total: 0, in_transit: 0, delayed: 0, delivered: 0, on_time_rate: 0 })
  const [connected, setConnected]   = useState(false)
  const [selected, setSelected]     = useState<LiveShipment | null>(null)
  const [weather, setWeather]       = useState<any>(null)

  useEffect(() => {
    const unsub = subscribeTracking(data => {
      setShipments(data.shipments)
      setAlerts(data.alerts.slice(0, 8))
      setKpis(data.kpis)
      setConnected(true)
      if ((data as any).incidents) setIncidents((data as any).incidents)
    })
    const timer = setTimeout(() => !connected && setConnected(false), 5000)
    return () => { unsub(); clearTimeout(timer) }
  }, [])

  useEffect(() => {
    if (!selected) return
    setWeather(null)
    getWeather(selected.origin_lat, selected.origin_lon)
      .then(setWeather)
      .catch(() => setWeather(null))
  }, [selected?.id])

  const handleInjectIncident = async (type: string) => {
    try { await injectIncident(type) } catch {}
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <SectionHeader title="Live Tracking" subtitle="Real-time shipment monitoring · Incident detection · Dynamic rerouting" />
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-neon-green animate-pulse' : 'bg-red-500'}`} />
          <span className={connected ? 'text-neon-green' : 'text-red-400'}>
            {connected ? 'LIVE' : 'CONNECTING…'}
          </span>
          <Wifi size={12} className={connected ? 'text-neon-green' : 'text-red-400'} />
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total',      val: kpis.total,         color: '#e2e8f0', icon: <Package size={12} /> },
          { label: 'In Transit', val: kpis.in_transit,    color: '#00e5ff', icon: <Radio size={12} /> },
          { label: 'Delayed',    val: kpis.delayed,       color: '#ff6b35', icon: <AlertTriangle size={12} /> },
          { label: 'Delivered',  val: kpis.delivered,     color: '#00ff87', icon: <CheckCircle size={12} /> },
          { label: 'On-Time %',  val: `${kpis.on_time_rate}%`, color: '#a78bfa', icon: <TrendingUp size={12} /> },
        ].map(k => (
          <div key={k.label} className="glass-card p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1" style={{ color: k.color }}>
              {k.icon}
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{k.label}</span>
            </div>
            <div className="text-xl font-bold font-mono" style={{ color: k.color }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Map */}
        <div className="xl:col-span-3">
          <div className="glass-card overflow-hidden" style={{ height: '580px' }}>
            <div className="px-4 py-2.5 border-b border-cyan-500/10 flex items-center gap-3 text-[11px] font-mono text-slate-500 flex-wrap">
              <span className="animate-pulse text-cyan-400">●</span>
              {shipments.length} active shipments · updates every 3s
              {incidents.length > 0 && (
                <span className="text-orange-400">· {incidents.length} active incident{incidents.length > 1 ? 's' : ''}</span>
              )}
              {[
                { label: 'In Transit', color: '#00e5ff' },
                { label: 'Delayed', color: '#ff6b35' },
                { label: 'Delivered', color: '#00ff87' },
                { label: 'Out for Delivery', color: '#a78bfa' },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
            {!connected ? (
              <div className="flex items-center justify-center h-full gap-3 text-slate-500">
                <Spinner /><span className="font-mono text-sm">Connecting to tracking server…</span>
              </div>
            ) : (
              <MapContainer center={[20, 0]} zoom={2} style={{ height: 'calc(100% - 38px)', width: '100%' }} zoomControl>
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; OpenStreetMap &copy; CARTO'
                />
                <AnimatedMarkers shipments={shipments} />

                {/* Incident markers */}
                {incidents.map((inc: any) => (
                  <div key={inc.id}>
                    <Circle
                      center={[inc.lat, inc.lon]}
                      radius={inc.radius_km * 1000}
                      pathOptions={{ color: inc.color, fillColor: inc.color, fillOpacity: 0.1, weight: 1.5, dashArray: '5 5' }}
                    />
                    <Marker
                      position={[inc.lat, inc.lon]}
                      icon={makeIncidentIcon(inc.icon, inc.color)}
                    >
                      <Popup>
                        <div className="font-mono text-xs min-w-[210px]">
                          <div className="font-bold mb-1" style={{ color: inc.color }}>
                            {inc.icon} {inc.type?.replace(/_/g, ' ').toUpperCase()}
                          </div>
                          <div className="text-slate-300 mb-1">{inc.description}</div>
                          <div className="text-slate-500 text-[10px]">
                            📍 {inc.region} · Radius: {inc.radius_km}km
                          </div>
                          <div className="text-slate-500 text-[10px]">
                            Expires: {new Date(inc.expires_at).toLocaleTimeString()}
                          </div>
                          {inc.affected_shipments?.length > 0 && (
                            <div className="text-orange-400 text-[10px] mt-1">
                              ⚠ Affecting: {inc.affected_shipments.slice(0, 3).join(', ')}
                            </div>
                          )}
                          {inc.reroute_available && (
                            <div className="text-green-400 text-[10px] mt-0.5">✓ Alternate route available</div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  </div>
                ))}
              </MapContainer>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="xl:col-span-1 space-y-4 overflow-hidden">
          {/* Incident simulator */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={13} className="text-orange-400" />
              <span className="text-xs font-semibold text-white">Incident Simulator</span>
              {incidents.length > 0 && (
                <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,107,53,0.15)', color: '#ff6b35' }}>
                  {incidents.length} active
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {INCIDENT_TYPES_MENU.map(t => (
                <button key={t.id}
                  onClick={() => handleInjectIncident(t.id)}
                  className="btn-ghost text-[10px] py-1.5 px-2 text-left truncate">
                  {t.label}
                </button>
              ))}
            </div>
            <div className="text-[9px] text-slate-600 font-mono mt-2">
              Click to inject incident onto the live map
            </div>
          </div>

          {/* Alerts */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={13} className="text-orange-400" />
              <span className="text-xs font-semibold text-white">Live Alerts</span>
              {alerts.length > 0 && (
                <span className="ml-auto bg-orange-400/20 text-orange-400 text-[10px] font-mono px-1.5 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
            </div>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-[11px] text-slate-600 font-mono text-center py-3">No active alerts</div>
              ) : alerts.map((a, i) => (
                <div key={i} className="glass-card px-3 py-2 border-l-2 fade-in-up"
                  style={{ borderColor: a.severity === 'warning' ? '#ff6b35' : '#00e5ff' }}>
                  <div className="text-[10px] font-mono text-slate-500">{a.shipment_id}</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">{a.message}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipment list */}
          <div className="glass-card p-4">
            <div className="text-xs font-semibold text-white mb-3">Shipments</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {shipments.map(s => (
                <div key={s.id}
                  className={`glass-card px-3 py-2 cursor-pointer transition-all duration-200 ${selected?.id === s.id ? 'border-cyan-400/40' : ''}`}
                  onClick={() => setSelected(s === selected ? null : s)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono font-semibold" style={{ color: s.status_color }}>{s.id}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{s.origin} → {s.destination}</div>
                  <div className="mt-1.5 h-0.5 rounded-full bg-white/5">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${s.progress}%`, background: s.status_color, boxShadow: `0 0 4px ${s.status_color}` }} />
                  </div>
                  {selected?.id === s.id && (
                    <div className="mt-2 text-[10px] font-mono text-slate-400 grid grid-cols-2 gap-1">
                      <div>ETA: <span className="text-cyan-400">{s.eta_display}</span></div>
                      <div>Weight: <span className="text-slate-300">{s.weight_kg}kg</span></div>
                      <div>Carrier: <span className="text-slate-300">{s.carrier}</span></div>
                      <div>Priority: <span className="text-purple-400">P{s.priority}</span></div>
                      {s.delay_reason && <div className="col-span-2 text-orange-400">⚠ {s.delay_reason}</div>}
                      {weather && (
                        <div className="col-span-2 mt-2 p-2 rounded-lg border border-cyan-500/15"
                          style={{ background: 'rgba(0,229,255,0.04)' }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Cloud size={9} className="text-cyan-400" />
                            <span className="text-[9px] uppercase tracking-widest text-cyan-400 font-semibold">
                              Live Weather — Origin
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{weather.icon}</span>
                            <div>
                              <div className="text-[11px] font-semibold text-white">{weather.condition}</div>
                              <div className="text-[9px] text-slate-500">
                                {weather.temperature !== null ? `${weather.temperature}°C` : ''}
                                {weather.wind_speed ? ` · ${weather.wind_speed}km/h` : ''}
                              </div>
                            </div>
                            {weather.delay_factor > 0 && (
                              <div className="ml-auto text-right">
                                <div className="text-[9px] text-slate-500">Delay impact</div>
                                <div className="text-[11px] font-bold"
                                  style={{ color: weather.delay_impact === 'HIGH' ? '#ef4444' : weather.delay_impact === 'MEDIUM' ? '#fbbf24' : '#00ff87' }}>
                                  {weather.delay_impact}
                                </div>
                              </div>
                            )}
                          </div>
                          {weather.delay_factor > 0.1 && (
                            <div className="text-[9px] text-orange-400 mt-1">
                              ⚠ Weather adds ~{Math.round(weather.delay_factor * 100)}% delay risk
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
