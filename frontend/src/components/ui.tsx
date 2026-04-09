import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

/* ── KPI Card ──────────────────────────────────────────────────── */
interface KPIProps {
  label: string
  value: string | number
  unit?: string
  icon: ReactNode
  trend?: number   // positive = good, negative = bad
  accent?: string  // hex color
  sublabel?: string
}

export function KPICard({ label, value, unit, icon, trend, accent = '#00e5ff', sublabel }: KPIProps) {
  const TrendIcon = trend === undefined ? null : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const trendColor = trend === undefined ? '' : trend > 0 ? '#00ff87' : '#ff6b35'

  return (
    <div className="glass-card-hover p-5 relative overflow-hidden fade-in-up">
      {/* background glow */}
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-8 blur-2xl pointer-events-none"
        style={{ background: accent }} />

      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
        {TrendIcon && trend !== undefined && (
          <div className="flex items-center gap-1 text-xs font-mono font-semibold"
            style={{ color: trendColor }}>
            <TrendIcon size={12} />
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="stat-label mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="stat-value" style={{ color: accent }}>{value}</span>
        {unit && <span className="text-slate-500 text-sm font-mono">{unit}</span>}
      </div>
      {sublabel && <div className="text-xs text-slate-600 mt-1 font-mono">{sublabel}</div>}
    </div>
  )
}

/* ── Section Header ────────────────────────────────────────────── */
export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-display font-bold text-white tracking-wide">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-1 font-mono">{subtitle}</p>}
    </div>
  )
}

/* ── Loading Spinner ───────────────────────────────────────────── */
export function Spinner({ size = 20, color = '#00e5ff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke={`${color}30`} strokeWidth="3" fill="none" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/* ── Status Badge ──────────────────────────────────────────────── */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    in_transit:             { label: 'In Transit',      color: '#00e5ff', bg: 'rgba(0,229,255,0.12)' },
    out_for_delivery:       { label: 'Out for Delivery', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    delayed:                { label: 'Delayed',          color: '#ff6b35', bg: 'rgba(255,107,53,0.12)' },
    delivered:              { label: 'Delivered',        color: '#00ff87', bg: 'rgba(0,255,135,0.12)' },
    pending:                { label: 'Pending',          color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    delivery_attempt_failed:{ label: 'Failed Attempt',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  }
  const s = map[status] || map['pending']
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold"
      style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  )
}

/* ── Risk Level Badge ──────────────────────────────────────────── */
export function RiskBadge({ level }: { level: string }) {
  const cls = { LOW: 'badge-low', MEDIUM: 'badge-medium', HIGH: 'badge-high', CRITICAL: 'badge-critical' }
  return <span className={cls[level as keyof typeof cls] || 'badge-medium'}>{level}</span>
}

/* ── Confidence Gauge ──────────────────────────────────────────── */
export function ConfidenceGauge({ value, color = '#00e5ff' }: { value: number; color?: string }) {
  const r = 36, circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, value))
  const dash = (pct / 100) * circ

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
        <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '45px 45px', transition: 'stroke-dasharray 0.5s ease' }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-bold font-mono" style={{ color }}>{pct.toFixed(0)}%</div>
      </div>
    </div>
  )
}

/* ── Progress Bar ──────────────────────────────────────────────── */
export function ProgressBar({ value, max = 100, color = '#00e5ff', showLabel = true }: {
  value: number; max?: number; color?: string; showLabel?: boolean
}) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs font-mono text-slate-500 mb-1">
          <span>{value.toFixed(1)}</span><span style={{ color }}>{pct.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-1.5 rounded-full w-full" style={{ background: `${color}20` }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                   boxShadow: `0 0 6px ${color}60` }} />
      </div>
    </div>
  )
}
