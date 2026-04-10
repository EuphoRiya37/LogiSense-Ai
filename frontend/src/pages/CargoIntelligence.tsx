import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getCargoProfiles, analyzeCargo } from '../services/api'
import { SectionHeader, Spinner, ProgressBar } from '../components/ui'
import { Package, AlertTriangle, CheckCircle, Clock, Zap, Thermometer } from 'lucide-react'

const TERRAIN_OPTIONS = [
  { value: 'highway',     label: '🛣️ Highway' },
  { value: 'urban',       label: '🏙️ Urban Road' },
  { value: 'rural',       label: '🌲 Rural Road' },
  { value: 'dirt_road',   label: '🪨 Dirt / Unpaved' },
  { value: 'narrow_road', label: '🚧 Narrow Road' },
]

const SLA_COLORS: Record<string, string> = {
  LOW: '#00ff87', MEDIUM: '#fbbf24', HIGH: '#ff6b35', CRITICAL: '#ef4444',
}

export default function CargoIntelligence() {
  const [cargoType, setCargoType] = useState('standard')
  const [weight, setWeight]       = useState(500)
  const [distance, setDistance]   = useState(200)
  const [terrain, setTerrain]     = useState('highway')
  const [result, setResult]       = useState<any>(null)

  const { data: profilesData } = useQuery({
    queryKey: ['cargo-profiles'],
    queryFn: getCargoProfiles,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: () => analyzeCargo({ cargo_type: cargoType, weight_kg: weight, distance_km: distance, terrain }),
    onSuccess: setResult,
  })

  const profiles  = profilesData?.profiles || {}
  const selected  = profiles[cargoType]

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader
        title="Cargo Intelligence Engine"
        subtitle="Perishable windows · Cold chain enforcement · Fragile routing · Hazmat rules · Vehicle capability matching"
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Config panel */}
        <div className="xl:col-span-2 space-y-4">
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Package size={14} className="text-cyan-400" />
              <span className="text-sm font-semibold text-white">Cargo Configuration</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="stat-label block mb-1.5">Cargo Type</label>
                <select value={cargoType} onChange={e => setCargoType(e.target.value)} className="input-field">
                  {Object.entries(profiles).map(([k, v]: any) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>

              {selected && (
                <div className="glass-card p-3" style={{ border: '1px solid rgba(251,191,36,0.2)' }}>
                  <div className="text-[11px] text-yellow-400 font-mono font-semibold mb-1">
                    {selected.icon} {selected.label}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono leading-relaxed">{selected.notes}</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selected.max_transit_hours < 720 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono"
                        style={{ background: 'rgba(255,107,53,0.15)', color: '#ff6b35' }}>
                        ⏱ Max {selected.max_transit_hours}h transit
                      </span>
                    )}
                    {selected.requires_refrigeration && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono"
                        style={{ background: 'rgba(0,229,255,0.15)', color: '#00e5ff' }}>
                        ❄️ Cold chain required
                      </span>
                    )}
                    {selected.hazmat && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                        ⚠️ Hazmat Class {selected.hazmat_class}
                      </span>
                    )}
                    {selected.shock_sensitivity === 'critical' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono"
                        style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
                        🛡️ Critical: low vibration
                      </span>
                    )}
                    {selected.shock_sensitivity === 'high' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono"
                        style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
                        🛡️ High shock risk
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="stat-label block mb-1.5">Weight (kg)</label>
                  <input type="number" value={weight} min={1}
                    onChange={e => setWeight(Number(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label className="stat-label block mb-1.5">Distance (km)</label>
                  <input type="number" value={distance} min={1}
                    onChange={e => setDistance(Number(e.target.value))} className="input-field" />
                </div>
              </div>

              <div>
                <label className="stat-label block mb-1.5">Route Terrain</label>
                <select value={terrain} onChange={e => setTerrain(e.target.value)} className="input-field">
                  {TERRAIN_OPTIONS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <button className="btn-primary w-full flex items-center justify-center gap-2"
                onClick={() => mutate()} disabled={isPending}>
                {isPending
                  ? <><Spinner size={15} color="#020510" /> Analyzing…</>
                  : <><Zap size={14} /> Analyze Cargo Constraints</>}
              </button>
            </div>
          </div>

          {/* Vehicle legend */}
          {profilesData?.vehicles && (
            <div className="glass-card p-4">
              <div className="stat-label mb-3">Available Vehicle Types</div>
              <div className="space-y-2">
                {Object.entries(profilesData.vehicles).map(([id, v]: any) => (
                  <div key={id} className="flex items-center gap-2.5">
                    <span className="text-sm w-6">{v.icon?.split(' ')[0] || '🚛'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono text-slate-300 truncate">{v.label}</div>
                      <div className="text-[9px] font-mono text-slate-600">
                        Max {v.max_weight_kg?.toLocaleString()}kg · ${v.cost_per_km}/km
                        {v.refrigeration ? ` · ${v.refrigeration}` : ''}
                        {v.hazmat_certified ? ' · ⚠️ ADR certified' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="xl:col-span-3 space-y-4">
          {!result && !isPending && (
            <div className="glass-card p-10 flex flex-col items-center justify-center h-72 text-center">
              <Package size={40} className="text-slate-700 mb-4" />
              <div className="text-slate-500 font-mono text-sm">
                Configure cargo → Analyze to see vehicle matching,<br />
                spoilage risk, dispatch deadlines & SLA scoring
              </div>
            </div>
          )}

          {isPending && (
            <div className="glass-card p-10 flex flex-col items-center justify-center h-72 gap-4">
              <Spinner size={36} />
              <div className="text-slate-500 font-mono text-sm">Running cargo constraint engine…</div>
            </div>
          )}

          {result && !isPending && (
            <>
              {/* SLA Risk Banner */}
              <div className="glass-card p-4 flex items-center gap-4 fade-in-up"
                style={{ border: `1px solid ${SLA_COLORS[result.sla_risk]}40` }}>
                <div className="text-4xl">{result.cargo_profile?.icon}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">{result.cargo_profile?.label}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    {result.weight_kg}kg · {result.distance_km}km · {result.terrain}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 font-mono mb-0.5">SLA RISK</div>
                  <div className="text-3xl font-bold font-mono"
                    style={{ color: SLA_COLORS[result.sla_risk] }}>
                    {result.sla_risk}
                  </div>
                </div>
              </div>

              {/* Dispatch Deadline */}
              {result.dispatch_deadline && (
                <div className="glass-card p-4 flex items-center gap-3 fade-in-up"
                  style={{ border: '1px solid rgba(255,107,53,0.3)' }}>
                  <Clock size={20} className="text-orange-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-orange-400">⚠ Latest Safe Dispatch Deadline</div>
                    <div className="text-base font-bold font-mono text-white mt-0.5">
                      {new Date(result.dispatch_deadline).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {result.recommended_vehicle?.time_buffer_hours}h buffer before spoilage threshold
                    </div>
                  </div>
                </div>
              )}

              {/* Vehicle Options */}
              <div className="stat-label">Vehicle Compatibility Matrix</div>
              <div className="space-y-3">
                {result.vehicle_options?.map((v: any, i: number) => (
                  <div key={v.vehicle_id}
                    className={`glass-card p-4 fade-in-up ${!v.feasible ? 'opacity-50' : ''}`}
                    style={i === 0 && v.feasible ? { border: '1px solid rgba(0,255,135,0.35)' } : {}}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{v.vehicle_icon?.split(' ')[0] || '🚛'}</span>
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            {v.vehicle_label}
                            {i === 0 && v.feasible && (
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-mono"
                                style={{ background: 'rgba(0,255,135,0.15)', color: '#00ff87' }}>
                                ✓ RECOMMENDED
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Transit: {v.transit_hours}h · Cost: ${v.cost_usd} · CO₂: {v.co2_kg}kg
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold font-mono"
                          style={{ color: v.feasible ? (v.score > 75 ? '#00ff87' : '#fbbf24') : '#ef4444' }}>
                          {v.score}
                        </div>
                        <div className="text-[9px] text-slate-600 font-mono">/ 100</div>
                      </div>
                    </div>

                    <ProgressBar value={v.score} max={100}
                      color={v.feasible ? (v.score > 75 ? '#00ff87' : '#fbbf24') : '#ef4444'}
                      showLabel={false} />

                    <div className="mt-2 space-y-0.5">
                      {v.issues?.map((issue: string, j: number) => (
                        <div key={j} className="flex items-center gap-1.5 text-[10px] font-mono text-red-400">
                          <AlertTriangle size={9} /> {issue}
                        </div>
                      ))}
                      {v.warnings?.map((w: string, j: number) => (
                        <div key={j} className="flex items-center gap-1.5 text-[10px] font-mono text-yellow-400">
                          <AlertTriangle size={9} /> {w}
                        </div>
                      ))}
                      {v.feasible && v.damage_risk_pct > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 mt-1">
                          <CheckCircle size={9} className="text-slate-600" />
                          Damage probability: {v.damage_risk_pct}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
