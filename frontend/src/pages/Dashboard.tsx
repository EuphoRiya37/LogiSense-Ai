import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import { Package, TrendingUp, Clock, AlertTriangle, DollarSign, Activity, Lightbulb, CloudRain } from 'lucide-react'
import { getSummary, getTrends, getModePerformance, getInsights, getGlobalWeather } from '../services/api'
import { KPICard, SectionHeader, Spinner, ProgressBar } from '../components/ui'

const PALETTE = ['#00e5ff', '#a78bfa', '#00ff87', '#fbbf24', '#f472b6', '#60a5fa', '#fb923c']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs font-mono">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { data: summary, isLoading: loadSummary } = useQuery({ queryKey: ['summary'], queryFn: getSummary })
  const { data: trends }   = useQuery({ queryKey: ['trends'],  queryFn: getTrends })
  const { data: modePerf } = useQuery({ queryKey: ['modeperf'], queryFn: getModePerformance })

  if (loadSummary) return (
    <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
      <Spinner /><span className="font-mono text-sm">Loading analytics…</span>
    </div>
  )

  if (!summary) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <div className="text-3xl">🔌</div>
      <div className="text-slate-400 font-mono text-sm">Cannot reach backend.<br/>Make sure the API is running on <span className="text-cyan-400">http://localhost:8000</span></div>
    </div>
  )

  const s = summary

  // Build chart data — guard every field
  const statusData = Object.entries(s.delivery_status_dist || {}).map(([name, value]) => ({ name, value: Number(value) }))
  const modeData = Object.entries(s.shipping_mode_dist || {}).map(([name, value]) => ({ name: name.replace(' Class', ''), value: Number(value) }))
  const dowData  = Object.entries(s.delay_by_dow || {}).map(([day, rate]) => ({ day, 'Delay Rate': Number((Number(rate) * 100).toFixed(1)) }))
  const categoryData = Object.entries(s.delay_by_category || {}).slice(0, 6).map(([cat, rate]) => ({
    cat: cat.slice(0, 12),
    rate: Number((Number(rate) * 100).toFixed(1))
  }))

  return (
    <div className="space-y-6 max-w-[1400px]">
      <SectionHeader title="Mission Control" subtitle="Real-time logistics intelligence overview" />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard label="Total Shipments" value={s.total_shipments.toLocaleString()}
          icon={<Package size={16} />} accent="#00e5ff"
          sublabel="In dataset" />
        <KPICard label="On-Time Rate" value={s.on_time_rate.toFixed(1)} unit="%"
          icon={<TrendingUp size={16} />} accent="#00ff87"
          trend={s.on_time_rate - 75} sublabel="vs 75% baseline" />
        <KPICard label="Late Rate" value={s.late_rate.toFixed(1)} unit="%"
          icon={<AlertTriangle size={16} />} accent="#ff6b35"
          trend={-(s.late_rate - 25)} sublabel="Late deliveries" />
        <KPICard label="Avg Shipping" value={s.avg_shipping_days.toFixed(1)} unit="days"
          icon={<Clock size={16} />} accent="#a78bfa"
          sublabel="Actual average" />
        <KPICard label="Avg Delay" value={s.avg_delay_days.toFixed(2)} unit="days"
          icon={<Activity size={16} />} accent="#fbbf24"
          sublabel="Mean delay delta" />
        <KPICard label="Avg Order" value={`$${s.avg_order_value.toFixed(0)}`}
          icon={<DollarSign size={16} />} accent="#60a5fa"
          sublabel="Revenue per order" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Delivery Status Pie */}
        <div className="glass-card p-5">
          <div className="stat-label mb-4">Delivery Status Breakdown</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                paddingAngle={3} dataKey="value">
                {statusData.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]}
                    stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8}
                formatter={(v) => <span className="text-[11px] text-slate-400 font-mono">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Shipping Mode Bar */}
        <div className="glass-card p-5">
          <div className="stat-label mb-4">Shipments by Mode</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={modeData} barSize={28}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,229,255,0.04)' }} />
              <Bar dataKey="value" name="Shipments" radius={[4, 4, 0, 0]}>
                {modeData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Delay by Day of Week */}
        <div className="glass-card p-5">
          <div className="stat-label mb-4">Delay Rate by Day of Week</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dowData} barSize={24}>
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,107,53,0.04)' }} />
              <Bar dataKey="Delay Rate" fill="#ff6b35" radius={[4, 4, 0, 0]}
                style={{ filter: 'drop-shadow(0 0 4px rgba(255,107,53,0.4))' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend line - dual Y axis */}
      {trends && trends.length > 0 && (
        <div className="glass-card p-5">
          <div className="stat-label mb-4">Monthly Late Delivery Rate & Avg Shipping Days</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} interval={2} />
              <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${(Number(v) * 100).toFixed(0)}%`} domain={[0, 'auto']} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${Number(v).toFixed(1)}d`} />
              <Tooltip content={<CustomTooltip />} />
              <Line yAxisId="left" type="monotone" dataKey="late_pct" stroke="#ff6b35" strokeWidth={2} dot={false} name="Late Rate" />
              <Line yAxisId="right" type="monotone" dataKey="avg_days" stroke="#00e5ff" strokeWidth={2} dot={false} name="Avg Days" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Mode performance table */}
      {modePerf && modePerf.length > 0 && (
        <div className="glass-card p-5">
          <div className="stat-label mb-4">Shipping Mode Performance Matrix</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-cyan-500/10">
                  {['Mode', 'Volume', 'Avg Days', 'Avg Delay', 'Late Rate', 'Avg Profit'].map(h => (
                    <th key={h} className="text-left text-slate-500 pb-2 pr-4 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modePerf.map((row: any, i: number) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-cyan-500/[0.03] transition-colors">
                    <td className="py-2 pr-4 font-semibold" style={{ color: PALETTE[i] }}>{row.shipping_mode}</td>
                    <td className="py-2 pr-4 text-slate-300">{Number(row.count).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-slate-300">{Number(row.avg_days).toFixed(2)}d</td>
                    <td className="py-2 pr-4" style={{ color: Number(row.avg_delay) > 0 ? '#ff6b35' : '#00ff87' }}>
                      {Number(row.avg_delay) > 0 ? '+' : ''}{Number(row.avg_delay).toFixed(2)}d
                    </td>
                    <td className="py-2 pr-4">
                      <ProgressBar value={Number(row.late_rate) * 100} max={100} color="#ff6b35" showLabel={false} />
                      <span className="text-slate-400">{(Number(row.late_rate) * 100).toFixed(1)}%</span>
                    </td>
                    <td className="py-2 text-slate-300">${Number(row.avg_profit).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Region delay heatmap */}
      {s.delay_by_region && (
        <div className="glass-card p-5">
          <div className="stat-label mb-4">Delay Rate by Region</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(Object.entries(s.delay_by_region as Record<string, number>))
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .map(([region, rate], i) => {
              const pct = Number(rate) * 100
              const color = pct > 50 ? '#ef4444' : pct > 35 ? '#ff6b35' : pct > 20 ? '#fbbf24' : '#00ff87'
              return (
                <div key={i} className="glass-card p-3">
                  <div className="text-[10px] text-slate-500 font-mono mb-1 truncate">{region}</div>
                  <div className="text-lg font-bold font-mono" style={{ color }}>{pct.toFixed(1)}%</div>
                  <ProgressBar value={pct} max={100} color={color} showLabel={false} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
