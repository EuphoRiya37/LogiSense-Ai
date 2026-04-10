import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts'
import { Brain, Zap, AlertTriangle, CheckCircle, GitCompare, List, Plus, Trash2, Download } from 'lucide-react'
import { predictFull, predictWhatIf, predictBatch, getModelPerformance } from '../services/api'
import type { ShipmentInput, PredictionResult } from '../types'
import { SectionHeader, Spinner, RiskBadge, ConfidenceGauge, ProgressBar } from '../components/ui'

const DEFAULT: ShipmentInput = {
  shipping_mode: 'Standard Class', scheduled_shipping_days: 5,
  order_region: 'North America', category_name: 'Electronics',
  customer_segment: 'Consumer', market: 'US', payment_type: 'DEBIT',
  order_country: 'USA', quantity: 3, sales: 299.99, order_total: 299.99,
  profit: 60.0, discount_rate: 0.05, profit_ratio: 0.2, benefit_per_order: 60.0,
  latitude: 39.5, longitude: -98.0, order_day_of_week: 2,
  order_month: 6, order_quarter: 2, order_year: 2024,
}

const REGIONS = ['North America','Western Europe','Central America','South America','Southeast Asia','Eastern Europe','Western Africa','East of USA']
const CATEGORIES = ['Electronics','Clothing','Furniture','Sports','Books','Food','Automotive','Health & Beauty']
const MODES = ['Standard Class','Second Class','First Class','Same Day']

type TabType = 'single' | 'whatif' | 'batch'

const Label = ({ ch }: { ch: React.ReactNode }) => <label className="stat-label block mb-1.5">{ch}</label>

function ShipmentForm({ form, onChange, compact = false }: {
  form: ShipmentInput; onChange: (k: keyof ShipmentInput, v: any) => void; compact?: boolean
}) {
  const set = (k: keyof ShipmentInput) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    onChange(k, e.target.type === 'number' ? Number(e.target.value) : e.target.value)

  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2'}`}>
      <div><Label ch="Shipping Mode" />
        <select value={form.shipping_mode} onChange={set('shipping_mode')} className="input-field text-sm">
          {MODES.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div><Label ch="Scheduled Days" />
        <input type="number" value={form.scheduled_shipping_days} onChange={set('scheduled_shipping_days')} min={1} max={30} className="input-field text-sm" />
      </div>
      <div><Label ch="Region" />
        <select value={form.order_region} onChange={set('order_region')} className="input-field text-sm">
          {REGIONS.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div><Label ch="Category" />
        <select value={form.category_name} onChange={set('category_name')} className="input-field text-sm">
          {CATEGORIES.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      {!compact && (<>
        <div><Label ch="Segment" />
          <select value={form.customer_segment} onChange={set('customer_segment')} className="input-field text-sm">
            {['Consumer','Corporate','Home Office'].map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
        <div><Label ch="Market" />
          <select value={form.market} onChange={set('market')} className="input-field text-sm">
            {['US','Europe','LATAM','APAC','Africa'].map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
      </>)}
      <div><Label ch="Quantity" />
        <input type="number" value={form.quantity} onChange={set('quantity')} min={1} className="input-field text-sm" />
      </div>
      <div><Label ch="Order Value ($)" />
        <input type="number" value={form.sales} onChange={set('sales')} min={0} step={0.01} className="input-field text-sm" />
      </div>
      <div><Label ch="Discount Rate" />
        <input type="number" value={form.discount_rate} onChange={set('discount_rate')} min={0} max={1} step={0.01} className="input-field text-sm" />
      </div>
      <div><Label ch="Month" />
        <input type="number" value={form.order_month} onChange={set('order_month')} min={1} max={12} className="input-field text-sm" />
      </div>
    </div>
  )
}

function SinglePredict() {
  const [form, setForm] = useState<ShipmentInput>(DEFAULT)
  const [result, setResult] = useState<PredictionResult | null>(null)
  const { data: modelPerf } = useQuery({ queryKey: ['modelperf'], queryFn: getModelPerformance })
  const { mutate, isPending } = useMutation({ mutationFn: () => predictFull(form), onSuccess: setResult })
  const update = (k: keyof ShipmentInput, v: any) => setForm(f => ({ ...f, [k]: v }))

  const fimpData = modelPerf?.eta_feature_importance?.XGBoost?.slice(0, 8).map((f: any) => ({
    name: f.feature.replace(/_enc$/, '').replace(/_/g, ' '), value: f.importance,
  })) || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={14} className="text-cyan-400" />
            <span className="text-sm font-semibold text-white">Shipment Parameters</span>
          </div>
          <ShipmentForm form={form} onChange={update} />
          <button className="btn-primary w-full flex items-center justify-center gap-2 mt-4"
            onClick={() => mutate()} disabled={isPending}>
            {isPending ? <><Spinner size={16} color="#020510" /> Predicting…</> : <><Zap size={14} /> Run Prediction</>}
          </button>
        </div>
        {modelPerf && (
          <div className="glass-card p-4">
            <div className="stat-label mb-3">Model Performance</div>
            {Object.entries(modelPerf.eta_model?.individual || {}).map(([name, m]: any, i) => {
              const colors = ['#00e5ff','#a78bfa','#00ff87']
              return (
                <div key={name} className="mb-2">
                  <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                    <span style={{ color: colors[i] }}>{name}</span>
                    <span>MAE: {m.mae} · R²: {m.r2}</span>
                  </div>
                  <ProgressBar value={m.r2 * 100} max={100} color={colors[i]} showLabel={false} />
                </div>
              )
            })}
            <div className="text-[11px] font-mono text-slate-500 border-t border-cyan-500/10 pt-2 mt-2">
              Ensemble · MAE: <span className="text-cyan-400">{modelPerf.eta_model?.ensemble?.mae}</span>
              &nbsp;· R²: <span className="text-cyan-400">{modelPerf.eta_model?.ensemble?.r2}</span>
              &nbsp;· AUC: <span className="text-neon-green">{modelPerf.delay_model?.auc}</span>
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-3 space-y-4">
        {!result && !isPending && (
          <div className="glass-card p-10 flex flex-col items-center justify-center h-64 text-center">
            <Brain size={40} className="text-slate-700 mb-4" />
            <div className="text-slate-500 font-mono text-sm">Configure parameters → Run Prediction</div>
          </div>
        )}
        {isPending && (
          <div className="glass-card p-10 flex flex-col items-center justify-center h-64 gap-4">
            <Spinner size={36} /><div className="text-slate-500 font-mono text-sm">Running ensemble inference…</div>
          </div>
        )}
        {result && !isPending && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-5 text-center" style={{ border: '1px solid rgba(0,229,255,0.25)' }}>
                <div className="stat-label mb-2">Estimated Delivery</div>
                <div className="text-5xl font-bold font-mono text-cyan-400 mb-1">{result.eta_days}</div>
                <div className="text-slate-500 text-sm font-mono mb-2">DAYS</div>
                <div className="text-xs font-mono text-slate-600">90% CI: [{result.confidence_lower} – {result.confidence_upper}]</div>
                <div className="mt-3 relative h-2 rounded-full bg-cyan-500/10">
                  <div className="absolute h-full rounded-full bg-cyan-400/30"
                    style={{ left: `${(result.confidence_lower/(result.confidence_upper*1.2))*100}%`, right: `${100-(result.confidence_upper/(result.confidence_upper*1.2))*100}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-2 h-4 rounded bg-cyan-400"
                    style={{ left: `${(result.eta_days/(result.confidence_upper*1.2))*100}%`, boxShadow:'0 0 8px #00e5ff' }} />
                </div>
              </div>
              <div className="glass-card p-5 text-center" style={{ border: `1px solid ${result.risk_color}30` }}>
                <div className="stat-label mb-2">Delay Risk</div>
                <div className="flex justify-center mb-1"><ConfidenceGauge value={result.delay_probability} color={result.risk_color} /></div>
                <RiskBadge level={result.risk_level} />
                <div className="mt-2 flex items-center justify-center gap-1 text-xs font-mono text-slate-500">
                  {result.is_predicted_delayed
                    ? <><AlertTriangle size={10} className="text-orange-400" /> Delay likely</>
                    : <><CheckCircle size={10} className="text-neon-green" /> On-time likely</>}
                </div>
              </div>
            </div>
            {result.weather_adjustment && (
              <div className="glass-card p-4 fade-in-up flex items-center gap-3"
                style={{ border: '1px solid rgba(251,191,36,0.3)' }}>
                <span className="text-2xl">{result.weather_adjustment.icon}</span>
                <div>
                  <div className="text-xs font-semibold text-yellow-400">Weather Adjustment Applied</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    {result.weather_adjustment.weather_reason}
                  </div>
                </div>
                <div className="ml-auto text-lg font-bold font-mono text-yellow-400">
                  +{result.weather_adjustment.weather_delay_days}d
                </div>
              </div>
            )}

            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="stat-label">Individual Model Predictions</div>
                <div className="text-[10px] font-mono text-slate-600 max-w-xs text-right">
                  "speed × scheduled" = shipping class speed × planned days — strongest ETA signal
                </div>
              </div>
              {Object.entries(result.individual_predictions).map(([model, val], i) => {
                const colors = ['#00e5ff','#a78bfa','#00ff87']
                return (
                  <div key={model} className="flex items-center gap-3 mb-2">
                    <div className="w-24 text-xs font-mono" style={{ color: colors[i] }}>{model}</div>
                    <div className="flex-1">
                      <ProgressBar value={val} max={Math.max(...Object.values(result.individual_predictions))*1.3} color={colors[i]} showLabel={false} />
                    </div>
                    <div className="w-14 text-right text-sm font-mono font-bold" style={{ color: colors[i] }}>{val.toFixed(1)}d</div>
                  </div>
                )
              })}
              <div className="flex items-center gap-3 border-t border-cyan-500/10 pt-2">
                <div className="w-24 text-xs font-mono font-bold text-white">ENSEMBLE</div>
                <div className="flex-1"><ProgressBar value={result.eta_days} max={Math.max(...Object.values(result.individual_predictions))*1.3} color="#ffffff" showLabel={false} /></div>
                <div className="w-14 text-right text-sm font-mono font-bold text-white">{result.eta_days}d</div>
              </div>
            </div>
          </>
        )}
        {fimpData.length > 0 && (
          <div className="glass-card p-4">
            <div className="stat-label mb-3">Feature Importance (XGBoost)</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={fimpData} layout="vertical" barSize={10}>
                <XAxis type="number" tick={{ fill:'#64748b', fontSize:9, fontFamily:'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill:'#94a3b8', fontSize:10, fontFamily:'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="glass-card px-3 py-1 text-xs font-mono text-cyan-400">
                        {typeof payload[0].value === 'number'
                          ? payload[0].value.toFixed(4)
                          : String(payload[0].value)}
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="value" radius={[0,4,4,0]}>
                  {fimpData.map((_:any, i:number) => <Cell key={i} fill={`rgba(0,229,255,${0.9-i*0.09})`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

function WhatIfAnalysis() {
  const [base, setBase] = useState<ShipmentInput>(DEFAULT)
  const [results, setResults] = useState<any[]>([])
  const { mutate, isPending } = useMutation({
    mutationFn: () => predictWhatIf(base, [
      { label: 'Same Day Shipping', changes: { shipping_mode: 'Same Day', scheduled_shipping_days: 1 } },
      { label: 'First Class', changes: { shipping_mode: 'First Class', scheduled_shipping_days: 2 } },
      { label: 'Second Class', changes: { shipping_mode: 'Second Class', scheduled_shipping_days: 3 } },
      { label: 'Peak Season (Dec)', changes: { order_month: 12, order_quarter: 4 } },
      { label: 'High Discount (30%)', changes: { discount_rate: 0.30 } },
    ]),
    onSuccess: (d) => setResults(d.scenarios || []),
  })
  const update = (k: keyof ShipmentInput, v: any) => setBase(f => ({ ...f, [k]: v }))

  const maxEta = results.length ? Math.max(...results.map(r => r.eta_days || 0)) : 10

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitCompare size={14} className="text-purple-400" />
            <span className="text-sm font-semibold text-white">Base Shipment</span>
            <span className="text-xs text-slate-500 font-mono ml-1">— 5 auto-scenarios compared</span>
          </div>
          <ShipmentForm form={base} onChange={update} compact />
          <button className="btn-primary w-full flex items-center justify-center gap-2 mt-4"
            onClick={() => mutate()} disabled={isPending}>
            {isPending ? <><Spinner size={16} color="#020510" /> Analysing…</> : <><GitCompare size={14} /> Run What-If Analysis</>}
          </button>
        </div>
        <div className="glass-card p-4 text-sm text-slate-500 font-mono">
          <div className="text-cyan-400 font-semibold mb-2 text-xs">Auto-generated scenarios:</div>
          {['Same Day Shipping','First Class','Second Class','Peak Season (Dec)','High Discount (30%)'].map((s,i) => (
            <div key={i} className="flex items-center gap-2 py-1 border-b border-white/[0.03]">
              <div className="w-2 h-2 rounded-full" style={{ background: ['#00e5ff','#a78bfa','#00ff87','#ff6b35','#fbbf24'][i] }} />
              <span className="text-xs text-slate-400">{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-3 space-y-4">
        {!results.length && !isPending && (
          <div className="glass-card p-10 flex flex-col items-center justify-center h-64 text-center">
            <GitCompare size={40} className="text-slate-700 mb-4" />
            <div className="text-slate-500 font-mono text-sm">Set base shipment → Run What-If to compare scenarios</div>
          </div>
        )}
        {isPending && (
          <div className="glass-card p-10 flex flex-col items-center justify-center h-64 gap-4">
            <Spinner size={36} /><div className="text-slate-500 font-mono text-sm">Running scenario simulations…</div>
          </div>
        )}
        {results.length > 0 && !isPending && (
          <>
            <div className="glass-card p-5">
              <div className="stat-label mb-4">ETA Comparison — All Scenarios</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={results.filter(r => !r.error)} barSize={28}>
                  <XAxis dataKey="label" tick={{ fill:'#64748b', fontSize:10, fontFamily:'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill:'#64748b', fontSize:10, fontFamily:'JetBrains Mono' }} axisLine={false} tickLine={false} unit="d" />
                  <Tooltip content={({ active, payload, label }) => active&&payload?.length ?
                    <div className="glass-card px-3 py-2 text-xs font-mono">
                      <div className="text-white mb-1">{label}</div>
                      <div className="text-cyan-400">ETA: {payload[0].value}d</div>
                    </div> : null
                  } />
                  <Bar dataKey="eta_days" name="ETA" radius={[4,4,0,0]}>
                    {results.filter(r=>!r.error).map((_,i) => (
                      <Cell key={i} fill={i===0 ? '#475569' : ['#00e5ff','#a78bfa','#00ff87','#ff6b35','#fbbf24'][i-1]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {results.filter(r => !r.error).map((r, i) => {
                const colors = ['#475569','#00e5ff','#a78bfa','#00ff87','#ff6b35','#fbbf24']
                const color = colors[i % colors.length]
                const diff = i > 0 ? r.eta_days - results[0].eta_days : 0
                return (
                  <div key={i} className="glass-card px-4 py-3 flex items-center gap-4 fade-in-up"
                    style={{ border: `1px solid ${color}20` }}>
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div className="flex-1">
                      <div className="text-sm font-semibold" style={{ color }}>{r.label}</div>
                      <div className="text-xs text-slate-500 font-mono">Delay risk: {r.delay_probability?.toFixed(1)}% · <RiskBadge level={r.risk_level} /></div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold font-mono" style={{ color }}>{r.eta_days}d</div>
                      {i > 0 && (
                        <div className="text-xs font-mono" style={{ color: diff < 0 ? '#00ff87' : diff > 0 ? '#ff6b35' : '#94a3b8' }}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}d vs baseline
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BatchPredict() {
  const DEFAULT_BATCH: ShipmentInput[] = [
    { ...DEFAULT, shipping_mode: 'Standard Class', order_region: 'North America', order_month: 12 },
    { ...DEFAULT, shipping_mode: 'First Class', order_region: 'Western Europe', sales: 899 },
    { ...DEFAULT, shipping_mode: 'Same Day', order_region: 'Southeast Asia', scheduled_shipping_days: 1 },
    { ...DEFAULT, shipping_mode: 'Second Class', order_region: 'South America', discount_rate: 0.3 },
    { ...DEFAULT, shipping_mode: 'Standard Class', order_region: 'Eastern Europe', order_month: 11 },
  ]

  const [shipments, setShipments] = useState<ShipmentInput[]>(DEFAULT_BATCH)
  const [results, setResults] = useState<any[]>([])
  const { mutate, isPending } = useMutation({
    mutationFn: () => predictBatch(shipments),
    onSuccess: d => setResults(d.results || []),
  })

  const addRow = () => setShipments(s => [...s, { ...DEFAULT, order_region: 'North America' }])
  const removeRow = (i: number) => setShipments(s => s.filter((_, idx) => idx !== i))

  const downloadCSV = () => {
    if (!results.length) return
    const headers = ['Region','Mode','Scheduled','ETA Days','CI Lower','CI Upper','Delay %','Risk Level']
    const rows = results.map((r, i) => [
      shipments[i]?.order_region, shipments[i]?.shipping_mode,
      shipments[i]?.scheduled_shipping_days,
      r.eta_days, r.confidence_lower, r.confidence_upper,
      r.delay_probability, r.risk_level
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'logisense_batch_predictions.csv'; a.click()
  }

  return (
    <div className="space-y-5">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <List size={14} className="text-cyan-400" />
            <span className="text-sm font-semibold text-white">Batch Shipment Predictor</span>
            <span className="text-xs text-slate-500 font-mono">— predict ETA + risk for {shipments.length} shipments at once</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost text-xs flex items-center gap-1" onClick={addRow}><Plus size={11} /> Add Row</button>
            {results.length > 0 && (
              <button className="btn-ghost text-xs flex items-center gap-1" onClick={downloadCSV}><Download size={11} /> CSV</button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-cyan-500/10 text-slate-500 uppercase tracking-wider">
                <th className="text-left py-2 pr-3">#</th>
                <th className="text-left py-2 pr-3">Mode</th>
                <th className="text-left py-2 pr-3">Region</th>
                <th className="text-left py-2 pr-3">Sched.</th>
                <th className="text-left py-2 pr-3">Month</th>
                <th className="text-left py-2 pr-3">Sales</th>
                {results.length > 0 && <>
                  <th className="text-left py-2 pr-3 text-cyan-400">ETA</th>
                  <th className="text-left py-2 pr-3 text-cyan-400">CI</th>
                  <th className="text-left py-2 pr-3 text-cyan-400">Risk</th>
                </>}
                <th />
              </tr>
            </thead>
            <tbody>
              {shipments.map((s, i) => {
                const r = results[i]
                return (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-cyan-500/[0.03]">
                    <td className="py-2 pr-3 text-slate-600">{i+1}</td>
                    <td className="py-2 pr-3">
                      <select value={s.shipping_mode} onChange={e => setShipments(sh => sh.map((x,j)=>j===i?{...x,shipping_mode:e.target.value}:x))} className="input-field text-[11px] py-1 px-2 w-28">
                        {MODES.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <select value={s.order_region} onChange={e => setShipments(sh => sh.map((x,j)=>j===i?{...x,order_region:e.target.value}:x))} className="input-field text-[11px] py-1 px-2 w-32">
                        {REGIONS.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3"><input type="number" value={s.scheduled_shipping_days} min={1} max={30} onChange={e => setShipments(sh => sh.map((x,j)=>j===i?{...x,scheduled_shipping_days:Number(e.target.value)}:x))} className="input-field text-[11px] py-1 px-2 w-14" /></td>
                    <td className="py-2 pr-3"><input type="number" value={s.order_month} min={1} max={12} onChange={e => setShipments(sh => sh.map((x,j)=>j===i?{...x,order_month:Number(e.target.value)}:x))} className="input-field text-[11px] py-1 px-2 w-12" /></td>
                    <td className="py-2 pr-3"><input type="number" value={s.sales} min={0} step={1} onChange={e => setShipments(sh => sh.map((x,j)=>j===i?{...x,sales:Number(e.target.value)}:x))} className="input-field text-[11px] py-1 px-2 w-20" /></td>
                    {r && <>
                      <td className="py-2 pr-3 font-bold text-cyan-400">{r.eta_days}d</td>
                      <td className="py-2 pr-3 text-slate-500">[{r.confidence_lower}–{r.confidence_upper}]</td>
                      <td className="py-2 pr-3"><RiskBadge level={r.risk_level} /></td>
                    </>}
                    <td className="py-2"><button onClick={()=>removeRow(i)} className="text-slate-700 hover:text-red-400 transition-colors"><Trash2 size={11} /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <button className="btn-primary w-full flex items-center justify-center gap-2 mt-4"
          onClick={() => mutate()} disabled={isPending || !shipments.length}>
          {isPending ? <><Spinner size={16} color="#020510" /> Processing {shipments.length} shipments…</> : <><Zap size={14} /> Predict All ({shipments.length} shipments)</>}
        </button>
      </div>

      {results.length > 0 && (
        <div className="glass-card p-5">
          <div className="stat-label mb-3">Batch Summary</div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Avg ETA', val: `${(results.reduce((a,r)=>a+(r.eta_days||0),0)/results.length).toFixed(1)}d`, color:'#00e5ff' },
              { label: 'High/Critical Risk', val: results.filter(r=>['HIGH','CRITICAL'].includes(r.risk_level)).length, color:'#ff6b35' },
              { label: 'Low Risk', val: results.filter(r=>r.risk_level==='LOW').length, color:'#00ff87' },
              { label: 'Avg Delay Prob', val: `${(results.reduce((a,r)=>a+(r.delay_probability||0),0)/results.length).toFixed(1)}%`, color:'#fbbf24' },
            ].map(stat => (
              <div key={stat.label} className="glass-card p-3 text-center">
                <div className="stat-label text-[9px] mb-1">{stat.label}</div>
                <div className="text-xl font-bold font-mono" style={{ color: stat.color }}>{stat.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Predictions() {
  const [tab, setTab] = useState<TabType>('single')
  const tabs: Array<{id: TabType; label: string; icon: React.ReactNode}> = [
    { id: 'single', label: 'Single Predict', icon: <Brain size={13} /> },
    { id: 'whatif', label: 'What-If Analysis', icon: <GitCompare size={13} /> },
    { id: 'batch',  label: 'Batch Predict', icon: <List size={13} /> },
  ]

  return (
    <div className="space-y-5 max-w-[1400px]">
      <SectionHeader title="AI Prediction Engine"
        subtitle="ETA estimation + delay risk analysis powered by XGBoost / GradientBoost / Random Forest ensemble" />

      <div className="flex gap-1 p-1 glass-card w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              tab === t.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
            style={tab === t.id ? { background: 'rgba(0,229,255,0.12)', color: '#00e5ff', boxShadow: '0 0 12px rgba(0,229,255,0.15)' } : {}}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'single' && <SinglePredict />}
      {tab === 'whatif' && <WhatIfAnalysis />}
      {tab === 'batch'  && <BatchPredict />}
    </div>
  )
}
