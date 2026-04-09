import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ScatterChart,
  Scatter, ZAxis, CartesianGrid, LineChart, Line, Legend,
} from 'recharts'
import { BarChart3, Activity, TrendingUp, Cpu } from 'lucide-react'
import { getSummary, getTrends, getModePerformance, getModelPerformance } from '../services/api'
import { SectionHeader, Spinner, ProgressBar } from '../components/ui'

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs font-mono">
      {label && <div className="text-slate-400 mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || '#00e5ff' }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(3) : p.value}
        </div>
      ))}
    </div>
  )
}

const COLORS = ['#00e5ff', '#a78bfa', '#00ff87', '#fbbf24', '#f472b6', '#60a5fa', '#fb923c']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function Analytics() {
  const { data: summary, isLoading } = useQuery({ queryKey: ['summary'], queryFn: getSummary })
  const { data: trends }   = useQuery({ queryKey: ['trends'],   queryFn: getTrends })
  const { data: modePerfRaw } = useQuery({ queryKey: ['modeperf'], queryFn: getModePerformance })
  const { data: modelPerf } = useQuery({ queryKey: ['modelperf'], queryFn: getModelPerformance })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
      <Spinner /><span className="font-mono text-sm">Loading analytics…</span>
    </div>
  )

  if (!summary) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="text-slate-400 font-mono text-sm">Backend not reachable — start the API server first.</div>
    </div>
  )

  const s = summary

  // Monthly delay rate
  const monthlyData = Object.entries(s.delay_by_month || {}).map(([m, rate]) => ({
    month: MONTHS[Number(m) - 1] || String(m),
    'Late Rate %': Number((Number(rate) * 100).toFixed(1)),
  }))

  // Category breakdown
  const catData = Object.entries(s.delay_by_category || {}).map(([cat, rate]) => ({
    cat: cat.slice(0, 12),
    rate: Number((Number(rate) * 100).toFixed(1)),
  })).sort((a, b) => b.rate - a.rate)

  // Mode performance radar
  const modePerf = (modePerfRaw || []).map((m: any) => ({
    mode: m.shipping_mode?.replace(' Class', '').replace('Standard', 'Std'),
    'On-Time': Number(((1 - m.late_rate) * 100).toFixed(1)),
    'Avg Days': Number(m.avg_days?.toFixed(1)),
    'Profit': Math.max(0, Number(m.avg_profit?.toFixed(1))),
  }))

  // Trend data
  const trendData = (trends || []).map((t: any) => ({
    label: t.label,
    late: Number((t.late_pct * 100).toFixed(1)),
    days: Number(t.avg_days?.toFixed(2)),
    sales: Number(t.avg_sales?.toFixed(0)),
  }))

  return (
    <div className="space-y-6 max-w-[1400px]">
      <SectionHeader title="Analytics Center" subtitle="Historical performance, delay patterns, and model diagnostics" />

      {/* Model performance */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <Cpu size={14} className="text-cyan-400" />
          <span className="text-sm font-semibold text-white">ML Model Performance Dashboard</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {modelPerf && [
            { label: 'Ensemble MAE', val: modelPerf.eta_model?.ensemble?.mae, unit: 'days', color: '#00e5ff' },
            { label: 'Ensemble R²', val: modelPerf.eta_model?.ensemble?.r2, unit: '', color: '#a78bfa' },
            { label: 'Delay AUC-ROC', val: modelPerf.delay_model?.auc, unit: '', color: '#00ff87' },
            { label: 'Delay F1 Score', val: modelPerf.delay_model?.f1, unit: '', color: '#fbbf24' },
          ].map((m, i) => (
            <div key={i} className="glass-card p-4 text-center">
              <div className="stat-label mb-1">{m.label}</div>
              <div className="text-2xl font-bold font-mono" style={{ color: m.color }}>
                {m.val !== undefined ? Number(m.val).toFixed(4) : '—'}
              </div>
              {m.unit && <div className="text-xs text-slate-600 font-mono">{m.unit}</div>}
            </div>
          ))}
        </div>

        {/* Feature importance chart */}
        {modelPerf?.delay_feature_importance?.length > 0 && (
          <div>
            <div className="stat-label mb-3">Delay Prediction — Feature Importance</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={modelPerf.delay_feature_importance.slice(0, 10)} layout="vertical" barSize={10}>
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="feature" width={130} tick={{ fill: '#94a3b8', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                  {modelPerf.delay_feature_importance.slice(0, 10).map((_: any, i: number) => (
                    <Cell key={i} fill={`rgba(0,255,135,${0.9 - i * 0.07})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Monthly delay trend */}
        {monthlyData.length > 0 && (
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={13} className="text-orange-400" />
              <span className="stat-label">Monthly Late Rate Pattern</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} barSize={20}>
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<Tip />} cursor={{ fill: 'rgba(255,107,53,0.04)' }} />
                <Bar dataKey="Late Rate %" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((d, i) => (
                    <Cell key={i} fill={d['Late Rate %'] > 35 ? '#ef4444' : d['Late Rate %'] > 25 ? '#ff6b35' : '#fbbf24'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Category delay */}
        {catData.length > 0 && (
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={13} className="text-purple-400" />
              <span className="stat-label">Delay Rate by Product Category</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={catData} layout="vertical" barSize={16}>
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="cat" width={100} tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="rate" name="Late Rate %" radius={[0, 4, 4, 0]}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Trends line chart */}
      {trendData.length > 5 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={13} className="text-cyan-400" />
            <span className="stat-label">Historical Trends — Late Rate & Avg Shipping Days</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} interval={2} />
              <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} unit="%" />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} unit="d" />
              <Tooltip content={<Tip />} />
              <Legend formatter={v => <span className="text-xs text-slate-400 font-mono">{v}</span>} />
              <Line yAxisId="left" type="monotone" dataKey="late" stroke="#ff6b35" strokeWidth={2} dot={false} name="Late Rate %" />
              <Line yAxisId="right" type="monotone" dataKey="days" stroke="#00e5ff" strokeWidth={2} dot={false} name="Avg Days" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Mode radar */}
      {modePerf.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="glass-card p-5">
            <div className="stat-label mb-4">Shipping Mode — On-Time Performance Comparison</div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={modePerf}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="mode" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                <Radar name="On-Time %" dataKey="On-Time" stroke="#00e5ff" fill="#00e5ff" fillOpacity={0.15} strokeWidth={2} />
                <Radar name="Avg Days" dataKey="Avg Days" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.1} strokeWidth={2} />
                <Legend formatter={v => <span className="text-xs text-slate-400 font-mono">{v}</span>} />
                <Tooltip content={<Tip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* DOW heatmap */}
          {s.delay_by_dow && (
            <div className="glass-card p-5">
              <div className="stat-label mb-4">Day of Week × Delay Rate Heatmap</div>
              <div className="flex flex-col gap-2">
                {Object.entries(s.delay_by_dow).map(([day, rate], i) => {
                  const pct = rate * 100
                  const intensity = Math.min(1, pct / 50)
                  const color = `rgba(255,107,53,${0.2 + intensity * 0.8})`
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <span className="w-8 text-xs font-mono text-slate-400">{day}</span>
                      <div className="flex-1 h-7 rounded-md flex items-center px-3 transition-all"
                        style={{ background: color, border: `1px solid rgba(255,107,53,${intensity * 0.4})` }}>
                        <span className="text-xs font-mono font-semibold text-white">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
