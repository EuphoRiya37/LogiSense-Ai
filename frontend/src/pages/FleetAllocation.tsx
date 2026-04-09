import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Truck, Plus, Trash2, PlayCircle, BarChart2, Clock } from 'lucide-react'
import { allocateShipments } from '../services/api'
import { SectionHeader, Spinner, ProgressBar } from '../components/ui'

const VEHICLE_ICONS: Record<string, string> = {
  Van: '🚐', Truck: '🚛', Heavy: '🚜', Express: '⚡'
}
const VEHICLE_COLORS: Record<string, string> = {
  Van: '#00e5ff', Truck: '#a78bfa', Heavy: '#ff6b35', Express: '#00ff87'
}

const randomShipment = (i: number) => ({
  id: `SHP-${String(i).padStart(4,'0')}`,
  destination: ['New York', 'Chicago', 'LA', 'Houston', 'Phoenix', 'Dallas', 'Seattle', 'Miami'][Math.floor(Math.random()*8)],
  weight_kg: Math.round(Math.random() * 800 + 20),
  priority: Math.ceil(Math.random() * 3) as 1|2|3,
  distance_km: Math.round(Math.random() * 400 + 30),
  product: ['Electronics', 'Furniture', 'Food', 'Automotive', 'Clothing'][Math.floor(Math.random()*5)],
})

const PRIORITY_LABEL: Record<number, {label: string; color: string}> = {
  3: { label: 'HIGH', color: '#00ff87' },
  2: { label: 'MED', color: '#fbbf24' },
  1: { label: 'LOW', color: '#94a3b8' },
}

export default function FleetAllocation() {
  const [shipments, setShipments] = useState(() =>
    Array.from({ length: 8 }, (_, i) => randomShipment(i + 1))
  )
  const [result, setResult] = useState<any>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => allocateShipments(shipments),
    onSuccess: setResult,
  })

  const addShipment = () =>
    setShipments(s => [...s, randomShipment(s.length + 1)])

  const removeShipment = (id: string) =>
    setShipments(s => s.filter(x => x.id !== id))

  const updatePriority = (id: string, p: number) =>
    setShipments(s => s.map(x => x.id === id ? { ...x, priority: p as 1|2|3 } : x))

  const updateWeight = (id: string, w: number) =>
    setShipments(s => s.map(x => x.id === id ? { ...x, weight_kg: w } : x))

  const totalWeight = shipments.reduce((a, b) => a + b.weight_kg, 0)

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader title="Fleet Allocation"
        subtitle="Automated Best-Fit Decreasing bin-packing — priority-aware vehicle assignment with schedule generation" />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Left: Shipment list */}
        <div className="xl:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck size={14} className="text-cyan-400" />
                <span className="text-sm font-semibold text-white">{shipments.length} Pending Shipments</span>
                <span className="text-xs font-mono text-slate-500">({totalWeight.toLocaleString()}kg total)</span>
              </div>
              <button className="btn-ghost text-xs flex items-center gap-1.5" onClick={addShipment}>
                <Plus size={12} /> Add
              </button>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto mb-4">
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
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">{s.product} → {s.destination}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" value={s.weight_kg} min={1}
                        onChange={e => updateWeight(s.id, Number(e.target.value))}
                        className="input-field w-16 text-xs py-1 px-2" />
                      <span className="text-[10px] text-slate-600 font-mono">kg</span>
                      <select value={s.priority}
                        onChange={e => updatePriority(s.id, Number(e.target.value))}
                        className="input-field text-xs py-1 px-2 w-14">
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
              {isPending ? <><Spinner size={15} color="#020510" />Allocating…</> : <><PlayCircle size={14} />Run Fleet Allocation</>}
            </button>
          </div>

          {/* Stats summary */}
          {result && (
            <div className="glass-card p-5" style={{ border: '1px solid rgba(0,229,255,0.2)' }}>
              <div className="stat-label mb-3 flex items-center gap-2">
                <BarChart2 size={12} className="text-cyan-400" />Allocation Summary
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Vehicles Used', val: result.stats?.total_vehicles_used, color: '#00e5ff' },
                  { label: 'Success Rate', val: `${result.stats?.allocation_success_rate}%`, color: '#00ff87' },
                  { label: 'Allocated', val: result.stats?.total_allocated, color: '#a78bfa' },
                  { label: 'Avg Utilization', val: `${result.stats?.avg_utilization_pct}%`, color: '#fbbf24' },
                ].map(stat => (
                  <div key={stat.label} className="glass-card p-3">
                    <div className="stat-label text-[9px] mb-1">{stat.label}</div>
                    <div className="text-xl font-bold font-mono" style={{ color: stat.color }}>{stat.val}</div>
                  </div>
                ))}
              </div>
              {result.stats?.unallocated_count > 0 && (
                <div className="mt-3 text-xs font-mono text-orange-400 flex items-center gap-1.5">
                  ⚠ {result.stats.unallocated_count} shipment(s) could not be allocated (overweight)
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Allocation results */}
        <div className="xl:col-span-3 space-y-4">
          {!result && !isPending && (
            <div className="glass-card p-10 flex flex-col items-center justify-center h-64 text-center">
              <Truck size={40} className="text-slate-700 mb-4" />
              <div className="text-slate-500 font-mono text-sm">
                Configure shipments and click<br/>
                <span className="text-cyan-400">Run Fleet Allocation</span> to assign vehicles
              </div>
            </div>
          )}

          {isPending && (
            <div className="glass-card p-10 flex flex-col items-center justify-center h-64 gap-4">
              <Spinner size={36} /><div className="text-slate-500 font-mono text-sm">Optimizing vehicle assignments…</div>
            </div>
          )}

          {result && !isPending && (
            <>
              {/* Vehicle cards */}
              <div className="grid grid-cols-1 gap-3">
                {result.allocations?.map((v: any) => {
                  const color = VEHICLE_COLORS[v.vehicle_type] || '#00e5ff'
                  const icon = VEHICLE_ICONS[v.vehicle_type] || '🚛'
                  return (
                    <div key={v.vehicle_id} className="glass-card p-4 fade-in-up"
                      style={{ border: `1px solid ${color}20` }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{icon}</span>
                          <div>
                            <div className="text-sm font-semibold" style={{ color }}>{v.vehicle_id}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{v.vehicle_type} · {v.capacity_kg.toLocaleString()}kg cap</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold font-mono" style={{ color }}>{v.utilization_pct}%</div>
                          <div className="text-[10px] text-slate-500 font-mono">utilization</div>
                        </div>
                      </div>

                      <ProgressBar value={v.utilization_pct} max={100} color={
                        v.utilization_pct > 85 ? '#ef4444' : v.utilization_pct > 65 ? '#fbbf24' : color
                      } showLabel={false} />

                      <div className="mt-3 text-xs font-mono text-slate-500">
                        {v.total_load_kg.toLocaleString()}kg / {v.capacity_kg.toLocaleString()}kg
                        &nbsp;·&nbsp;{v.shipment_count} shipments
                        &nbsp;·&nbsp;${v.cost_per_km}/km
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {v.shipments?.slice(0, 6).map((s: any) => {
                          const p = PRIORITY_LABEL[s.priority || 1]
                          return (
                            <span key={s.id} className="px-2 py-0.5 rounded text-[10px] font-mono glass-card"
                              style={{ color: p.color }}>
                              {s.id || `SHP-${Math.floor(Math.random()*9000)+1000}`}
                            </span>
                          )
                        })}
                        {v.shipment_count > 6 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 glass-card">
                            +{v.shipment_count - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Delivery Schedule */}
              {result.schedule?.length > 0 && (
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={13} className="text-purple-400" />
                    <span className="text-sm font-semibold text-white">Automated Delivery Schedule</span>
                    <span className="text-[10px] font-mono text-slate-500 ml-auto">Departure: 07:30</span>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {result.schedule.map((v: any) => {
                      const color = VEHICLE_COLORS[v.vehicle_type] || '#00e5ff'
                      return (
                        <div key={v.vehicle_id} className="glass-card p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                            <span className="text-xs font-mono font-semibold" style={{ color }}>{v.vehicle_id}</span>
                            <span className="text-[10px] text-slate-500 font-mono">departs {v.departure} → returns {v.estimated_return}</span>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {v.stops?.map((stop: any) => (
                              <div key={stop.seq} className="text-[10px] font-mono text-slate-400 glass-card px-2 py-1">
                                <span className="text-slate-600">{stop.seq}.</span> {stop.destination}
                                <span className="text-cyan-400 ml-1">@{stop.arrival}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
