import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Truck, Plus, Trash2, Zap, Package, BarChart3, Clock, CheckCircle } from 'lucide-react'
import { allocateShipments } from '../services/api'
import { SectionHeader, Spinner, ProgressBar } from '../components/ui'

const VEHICLE_COLORS: Record<string, string> = {
  Express: '#ff6b35',
  Van: '#00e5ff',
  Truck: '#a78bfa',
  Heavy: '#fbbf24',
}

const VEHICLE_ICONS: Record<string, string> = {
  Express: '⚡',
  Van: '🚐',
  Truck: '🚛',
  Heavy: '🏗️',
}

interface ShipmentRow {
  id: string
  destination: string
  weight_kg: number
  priority: number
  distance_km: number
}

const DEFAULT_SHIPMENTS: ShipmentRow[] = [
  { id: 'ORD-001', destination: 'New York',    weight_kg: 150,   priority: 3, distance_km: 80 },
  { id: 'ORD-002', destination: 'Boston',       weight_kg: 3500,  priority: 1, distance_km: 220 },
  { id: 'ORD-003', destination: 'Chicago',      weight_kg: 80,    priority: 3, distance_km: 120 },
  { id: 'ORD-004', destination: 'Houston',      weight_kg: 12000, priority: 1, distance_km: 350 },
  { id: 'ORD-005', destination: 'Phoenix',      weight_kg: 200,   priority: 2, distance_km: 180 },
  { id: 'ORD-006', destination: 'Philadelphia', weight_kg: 600,   priority: 2, distance_km: 95 },
  { id: 'ORD-007', destination: 'Dallas',       weight_kg: 170,   priority: 3, distance_km: 300 },
  { id: 'ORD-008', destination: 'San Antonio',  weight_kg: 8000,  priority: 1, distance_km: 380 },
]

const PRIORITY_LABEL = ['', 'Standard', 'Priority', 'Express']
const PRIORITY_COLOR = ['', '#94a3b8', '#fbbf24', '#00ff87']

export default function Allocation() {
  const [shipments, setShipments] = useState<ShipmentRow[]>(DEFAULT_SHIPMENTS)
  const [result, setResult] = useState<any>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => allocateShipments(shipments),
    onSuccess: setResult,
  })

  const addRow = () => setShipments(s => [...s, {
    id: `ORD-${String(s.length + 1).padStart(3, '0')}`,
    destination: 'New City',
    weight_kg: 100,
    priority: 2,
    distance_km: 100,
  }])

  const removeRow = (id: string) => setShipments(s => s.filter(x => x.id !== id))

  const update = (id: string, key: keyof ShipmentRow, val: any) =>
    setShipments(s => s.map(x => x.id === id ? { ...x, [key]: val } : x))

  const totalWeight = shipments.reduce((a, s) => a + s.weight_kg, 0)

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Fleet Allocation"
        subtitle="Intelligent shipment-to-vehicle assignment using Best-Fit Decreasing bin-packing, priority-aware routing"
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Input panel */}
        <div className="xl:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package size={14} className="text-cyan-400" />
                <span className="text-sm font-semibold text-white">{shipments.length} Shipments</span>
                <span className="text-xs font-mono text-slate-500">({(totalWeight / 1000).toFixed(1)}t total)</span>
              </div>
              <button onClick={addRow} className="btn-ghost flex items-center gap-1.5 text-xs">
                <Plus size={12} /> Add
              </button>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {shipments.map((s) => (
                <div key={s.id} className="glass-card p-3 group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-cyan-400">{s.id}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                        style={{ background: `${PRIORITY_COLOR[s.priority]}20`, color: PRIORITY_COLOR[s.priority] }}>
                        {PRIORITY_LABEL[s.priority]}
                      </span>
                    </div>
                    <button onClick={() => removeRow(s.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <label className="text-[9px] text-slate-600 font-mono uppercase">Destination</label>
                      <input value={s.destination}
                        onChange={e => update(s.id, 'destination', e.target.value)}
                        className="input-field text-[11px] py-1 px-2 mt-0.5 w-full" />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-600 font-mono uppercase">Weight kg</label>
                      <input type="number" value={s.weight_kg} min={1}
                        onChange={e => update(s.id, 'weight_kg', Number(e.target.value))}
                        className="input-field text-[11px] py-1 px-2 mt-0.5 w-full" />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-600 font-mono uppercase">Priority</label>
                      <select value={s.priority}
                        onChange={e => update(s.id, 'priority', Number(e.target.value))}
                        className="input-field text-[11px] py-1 px-2 mt-0.5 w-full">
                        <option value={1}>1 — Std</option>
                        <option value={2}>2 — Pri</option>
                        <option value={3}>3 — Exp</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
              onClick={() => mutate()} disabled={isPending}>
              {isPending
                ? <><Spinner size={15} color="#020510" /> Allocating…</>
                : <><Zap size={14} /> Allocate Fleet</>}
            </button>
          </div>

          {/* Fleet legend */}
          <div className="glass-card p-4">
            <div className="stat-label mb-3">Available Fleet</div>
            <div className="space-y-2">
              {[
                { type: 'Express', cap: '200 kg',   count: 2, desc: '1.8× speed, $2.50/km' },
                { type: 'Van',     cap: '800 kg',   count: 2, desc: '1.3× speed, $0.70/km' },
                { type: 'Truck',   cap: '5,000 kg', count: 3, desc: '1.0× speed, $1.20/km' },
                { type: 'Heavy',   cap: '20,000 kg',count: 2, desc: '0.75× speed, $2.00/km' },
              ].map(v => (
                <div key={v.type} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center text-sm"
                    style={{ background: `${VEHICLE_COLORS[v.type]}18` }}>
                    {VEHICLE_ICONS[v.type]}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="text-xs font-mono font-semibold" style={{ color: VEHICLE_COLORS[v.type] }}>
                        {v.type} ×{v.count}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{v.cap}</span>
                    </div>
                    <div className="text-[10px] text-slate-600 font-mono">{v.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results panel */}
        <div className="xl:col-span-3 space-y-4">
          {!result && !isPending && (
            <div className="glass-card p-10 flex flex-col items-center justify-center text-center h-72">
              <Truck size={40} className="text-slate-700 mb-4" />
              <div className="text-slate-500 font-mono text-sm">
                Add shipments and click Allocate Fleet<br />to see intelligent vehicle assignment
              </div>
            </div>
          )}

          {isPending && (
            <div className="glass-card p-10 flex flex-col items-center justify-center h-72 gap-4">
              <Spinner size={36} />
              <div className="text-slate-500 font-mono text-sm">Running Best-Fit Decreasing algorithm…</div>
            </div>
          )}

          {result && !isPending && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Vehicles Used', val: result.stats?.total_vehicles_used, color: '#00e5ff' },
                  { label: 'Allocated',     val: result.stats?.total_allocated,    color: '#00ff87' },
                  { label: 'Avg Util %',    val: `${result.stats?.avg_utilization_pct}%`, color: '#a78bfa' },
                  { label: 'Success Rate',  val: `${result.stats?.allocation_success_rate}%`, color: '#fbbf24' },
                ].map((k, i) => (
                  <div key={i} className="glass-card p-3 text-center">
                    <div className="stat-label mb-1">{k.label}</div>
                    <div className="text-xl font-bold font-mono" style={{ color: k.color }}>{k.val}</div>
                  </div>
                ))}
              </div>

              {/* Allocations */}
              <div className="space-y-3">
                {result.allocations?.map((alloc: any) => {
                  const color = VEHICLE_COLORS[alloc.vehicle_type] || '#00e5ff'
                  return (
                    <div key={alloc.vehicle_id} className="glass-card p-4"
                      style={{ borderColor: `${color}25` }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{VEHICLE_ICONS[alloc.vehicle_type]}</span>
                          <div>
                            <div className="text-sm font-bold font-mono" style={{ color }}>
                              {alloc.vehicle_id}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {alloc.vehicle_type} · ${alloc.cost_per_km}/km
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono font-semibold" style={{ color }}>
                            {alloc.shipment_count} shipments
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {alloc.total_load_kg.toLocaleString()} / {alloc.capacity_kg.toLocaleString()} kg
                          </div>
                        </div>
                      </div>

                      <ProgressBar
                        value={alloc.utilization_pct} max={100}
                        color={alloc.utilization_pct > 85 ? '#ff6b35' : alloc.utilization_pct > 60 ? '#fbbf24' : color}
                        showLabel={false}
                      />
                      <div className="text-[10px] font-mono mt-1 mb-3" style={{ color }}>
                        {alloc.utilization_pct}% utilization
                      </div>

                      <div className="space-y-1">
                        {alloc.shipments?.map((sh: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                            <span className="text-slate-600">#{i + 1}</span>
                            <span className="text-slate-300 flex-1">{sh.id}</span>
                            <span className="text-slate-500">{sh.destination}</span>
                            <span className="text-slate-400">{sh.weight_kg}kg</span>
                            <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                              style={{ background: `${PRIORITY_COLOR[sh.priority] || '#94a3b8'}20`,
                                       color: PRIORITY_COLOR[sh.priority] || '#94a3b8' }}>
                              P{sh.priority}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Schedule */}
              {result.schedule?.length > 0 && (
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={13} className="text-cyan-400" />
                    <span className="stat-label">Automated Delivery Schedule</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-cyan-500/10">
                          {['Vehicle', 'Departure', 'Stops', 'Est. Return'].map(h => (
                            <th key={h} className="text-left text-slate-500 pb-2 pr-6 uppercase tracking-wider text-[10px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.schedule.map((sch: any) => (
                          <tr key={sch.vehicle_id} className="border-b border-white/[0.03] hover:bg-cyan-500/[0.03]">
                            <td className="py-2 pr-6">
                              <span className="font-semibold" style={{ color: VEHICLE_COLORS[sch.vehicle_type] || '#00e5ff' }}>
                                {VEHICLE_ICONS[sch.vehicle_type]} {sch.vehicle_id}
                              </span>
                            </td>
                            <td className="py-2 pr-6 text-slate-300">{sch.departure}</td>
                            <td className="py-2 pr-6">
                              <div className="space-y-0.5">
                                {sch.stops?.slice(0, 3).map((stop: any) => (
                                  <div key={stop.seq} className="flex gap-2 items-center">
                                    <span className="text-slate-600">#{stop.seq}</span>
                                    <span className="text-slate-400 truncate max-w-[100px]">{stop.destination}</span>
                                    <span className="text-cyan-400">{stop.arrival}</span>
                                  </div>
                                ))}
                                {sch.stops?.length > 3 && (
                                  <div className="text-slate-600">+{sch.stops.length - 3} more stops</div>
                                )}
                              </div>
                            </td>
                            <td className="py-2 text-slate-300">{sch.estimated_return}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Unallocated */}
              {result.unallocated?.length > 0 && (
                <div className="glass-card p-4 border-red-500/20">
                  <div className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-2">
                    <span>⚠</span> {result.unallocated.length} shipments could not be allocated (overweight)
                  </div>
                  {result.unallocated.map((s: any) => (
                    <div key={s.id} className="text-[11px] font-mono text-slate-500">
                      {s.id} — {s.weight_kg}kg
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
