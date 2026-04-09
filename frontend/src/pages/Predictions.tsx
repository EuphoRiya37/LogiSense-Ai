import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Brain, Zap, AlertTriangle, CheckCircle, Clock, ChevronRight } from 'lucide-react'
import { predictFull, getModelPerformance } from '../services/api'
import type { ShipmentInput, PredictionResult } from '../types'
import { SectionHeader, Spinner, RiskBadge, ConfidenceGauge, ProgressBar } from '../components/ui'

const DEFAULT: ShipmentInput = {
  shipping_mode: 'Standard Class',
  scheduled_shipping_days: 5,
  order_region: 'North America',
  category_name: 'Electronics',
  customer_segment: 'Consumer',
  market: 'US',
  payment_type: 'DEBIT',
  order_country: 'USA',
  quantity: 3,
  sales: 299.99,
  order_total: 299.99,
  profit: 60.0,
  discount_rate: 0.05,
  profit_ratio: 0.2,
  benefit_per_order: 60.0,
  latitude: 39.5,
  longitude: -98.0,
  order_day_of_week: 2,
  order_month: 6,
  order_quarter: 2,
  order_year: 2024,
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="stat-label block mb-1.5">{children}</label>
)

const Select = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className="input-field">
    {options.map(o => <option key={o}>{o}</option>)}
  </select>
)

const NumberInput = ({ value, onChange, min, max, step = 1 }: any) => (
  <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
    min={min} max={max} step={step} className="input-field" />
)

export default function Predictions() {
  const [form, setForm] = useState<ShipmentInput>(DEFAULT)
  const [result, setResult] = useState<PredictionResult | null>(null)

  const { data: modelPerf } = useQuery({ queryKey: ['modelperf'], queryFn: getModelPerformance })

  const { mutate, isPending } = useMutation({
    mutationFn: (data: ShipmentInput) => predictFull(data),
    onSuccess: (data) => setResult(data),
  })

  const update = (key: keyof ShipmentInput) => (val: string | number) =>
    setForm(f => ({ ...f, [key]: val }))

  const fimpData = modelPerf?.eta_feature_importance?.XGBoost?.slice(0, 10).map((f: any) => ({
    name: f.feature.replace(/_enc$/, '').replace(/_/g, ' '),
    value: f.importance,
  })) || []

  return (
    <div className="space-y-6 max-w-[1300px]">
      <SectionHeader title="AI Prediction Engine" subtitle="ETA estimation + delay risk analysis powered by XGBoost / LightGBM / Random Forest ensemble" />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Form ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain size={15} className="text-cyan-400" />
              <span className="text-sm font-semibold text-white">Shipment Parameters</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Shipping Mode</Label>
                <Select value={form.shipping_mode} onChange={update('shipping_mode')}
                  options={['Standard Class','Second Class','First Class','Same Day']} />
              </div>
              <div><Label>Scheduled Days</Label>
                <NumberInput value={form.scheduled_shipping_days} onChange={update('scheduled_shipping_days')} min={1} max={30} />
              </div>
              <div><Label>Region</Label>
                <Select value={form.order_region} onChange={update('order_region')}
                  options={['North America','Western Europe','Central America','South America','Southeast Asia','Eastern Europe','Western Africa','East of USA']} />
              </div>
              <div><Label>Category</Label>
                <Select value={form.category_name} onChange={update('category_name')}
                  options={['Electronics','Clothing','Furniture','Sports','Books','Food','Automotive','Health & Beauty']} />
              </div>
              <div><Label>Customer Segment</Label>
                <Select value={form.customer_segment} onChange={update('customer_segment')}
                  options={['Consumer','Corporate','Home Office']} />
              </div>
              <div><Label>Market</Label>
                <Select value={form.market} onChange={update('market')}
                  options={['US','Europe','LATAM','APAC','Africa']} />
              </div>
              <div><Label>Quantity</Label>
                <NumberInput value={form.quantity} onChange={update('quantity')} min={1} max={500} />
              </div>
              <div><Label>Order Value ($)</Label>
                <NumberInput value={form.sales} onChange={update('sales')} min={0} step={0.01} />
              </div>
              <div><Label>Discount Rate</Label>
                <NumberInput value={form.discount_rate} onChange={update('discount_rate')} min={0} max={1} step={0.01} />
              </div>
              <div><Label>Month</Label>
                <NumberInput value={form.order_month} onChange={update('order_month')} min={1} max={12} />
              </div>
            </div>

            <button className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              onClick={() => mutate(form)} disabled={isPending}>
              {isPending ? <><Spinner size={16} color="#020510" /> Predicting…</> : <><Zap size={15} /> Run Prediction</>}
            </button>
          </div>

          {/* Model performance summary */}
          {modelPerf && (
            <div className="glass-card p-5">
              <div className="stat-label mb-3">Model Performance</div>
              <div className="space-y-3">
                {Object.entries(modelPerf.eta_model?.individual || {}).map(([name, m]: any) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                      <span style={{ color: name === 'XGBoost' ? '#00e5ff' : name === 'LightGBM' ? '#a78bfa' : '#00ff87' }}>{name}</span>
                      <span>MAE: {m.mae} | R²: {m.r2}</span>
                    </div>
                    <ProgressBar value={m.r2 * 100} max={100} color={name === 'XGBoost' ? '#00e5ff' : name === 'LightGBM' ? '#a78bfa' : '#00ff87'} showLabel={false} />
                  </div>
                ))}
                <div className="border-t border-cyan-500/10 pt-2 text-[11px] font-mono text-slate-500">
                  Ensemble MAE: <span className="text-cyan-400">{modelPerf.eta_model?.ensemble?.mae}</span>
                  {'  '}R²: <span className="text-cyan-400">{modelPerf.eta_model?.ensemble?.r2}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Results ── */}
        <div className="lg:col-span-3 space-y-4">
          {!result && !isPending && (
            <div className="glass-card p-10 flex flex-col items-center justify-center text-center h-64">
              <Brain size={40} className="text-slate-700 mb-4" />
              <div className="text-slate-500 font-mono text-sm">Configure shipment parameters and click<br/>Run Prediction to see results</div>
            </div>
          )}

          {isPending && (
            <div className="glass-card p-10 flex flex-col items-center justify-center h-64 gap-4">
              <Spinner size={36} />
              <div className="text-slate-500 font-mono text-sm">Running ensemble inference…</div>
            </div>
          )}

          {result && !isPending && (
            <>
              {/* Main result cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* ETA */}
                <div className="glass-card p-5 text-center" style={{ border: '1px solid rgba(0,229,255,0.25)' }}>
                  <div className="stat-label mb-2">Estimated Delivery</div>
                  <div className="text-5xl font-bold font-mono text-cyan-400 mb-1">{result.eta_days}</div>
                  <div className="text-slate-500 text-sm font-mono mb-3">DAYS</div>
                  <div className="text-xs font-mono text-slate-600">
                    90% CI: [{result.confidence_lower} – {result.confidence_upper}] days
                  </div>
                  {/* CI bar */}
                  <div className="mt-3 relative h-2 rounded-full bg-cyan-500/10">
                    <div className="absolute h-full rounded-full bg-cyan-400/30"
                      style={{
                        left: `${(result.confidence_lower / (result.confidence_upper * 1.2)) * 100}%`,
                        right: `${100 - (result.confidence_upper / (result.confidence_upper * 1.2)) * 100}%`,
                      }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-2 h-4 rounded bg-cyan-400"
                      style={{ left: `${(result.eta_days / (result.confidence_upper * 1.2)) * 100}%`, boxShadow: '0 0 8px #00e5ff' }} />
                  </div>
                </div>

                {/* Delay Risk */}
                <div className="glass-card p-5 text-center"
                  style={{ border: `1px solid ${result.risk_color}30` }}>
                  <div className="stat-label mb-2">Delay Risk</div>
                  <div className="flex justify-center mb-2">
                    <ConfidenceGauge value={result.delay_probability} color={result.risk_color} />
                  </div>
                  <RiskBadge level={result.risk_level} />
                  <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-mono text-slate-500">
                    {result.is_predicted_delayed
                      ? <><AlertTriangle size={11} className="text-orange-400" /> Delay predicted</>
                      : <><CheckCircle size={11} className="text-neon-green" /> On-time predicted</>}
                  </div>
                </div>
              </div>

              {/* Confidence */}
              <div className="glass-card p-5 flex items-center gap-4">
                <div className="flex-shrink-0">
                  <ConfidenceGauge value={result.confidence_score} color="#a78bfa" />
                </div>
                <div className="flex-1">
                  <div className="stat-label mb-1">Prediction Confidence</div>
                  <div className="text-2xl font-bold font-mono text-purple-400">{result.confidence_score}%</div>
                  <div className="text-xs text-slate-500 font-mono mt-1">
                    Based on ensemble agreement across XGBoost, LightGBM and Random Forest
                  </div>
                </div>
              </div>

              {/* Model comparison */}
              <div className="glass-card p-5">
                <div className="stat-label mb-3">Individual Model Predictions (days)</div>
                <div className="space-y-3">
                  {Object.entries(result.individual_predictions).map(([model, val], i) => {
                    const colors = ['#00e5ff', '#a78bfa', '#00ff87']
                    return (
                      <div key={model} className="flex items-center gap-3">
                        <div className="w-20 text-xs font-mono" style={{ color: colors[i] }}>{model}</div>
                        <div className="flex-1">
                          <ProgressBar value={val} max={Math.max(...Object.values(result.individual_predictions)) * 1.2}
                            color={colors[i]} showLabel={false} />
                        </div>
                        <div className="w-12 text-right text-sm font-mono font-bold" style={{ color: colors[i] }}>
                          {val.toFixed(1)}d
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex items-center gap-3 border-t border-cyan-500/10 pt-3">
                    <div className="w-20 text-xs font-mono text-white font-semibold">ENSEMBLE</div>
                    <div className="flex-1">
                      <ProgressBar value={result.eta_days} max={Math.max(...Object.values(result.individual_predictions)) * 1.2}
                        color="#ffffff" showLabel={false} />
                    </div>
                    <div className="w-12 text-right text-sm font-mono font-bold text-white">{result.eta_days}d</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Feature importance */}
          {fimpData.length > 0 && (
            <div className="glass-card p-5">
              <div className="stat-label mb-3">Top Predictive Features (XGBoost)</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={fimpData} layout="vertical" barSize={12}>
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div className="glass-card px-3 py-1.5 text-xs font-mono text-cyan-400">
                      {payload[0].value?.toFixed(4)}
                    </div>
                  ) : null} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {fimpData.map((_: any, i: number) => (
                      <Cell key={i} fill={`rgba(0,229,255,${0.9 - i * 0.07})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
