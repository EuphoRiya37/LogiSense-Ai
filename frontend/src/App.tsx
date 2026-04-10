import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Brain, Route as RouteIcon, Radio, BarChart3, Package, Zap, Truck, Shield } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Predictions from './pages/Predictions'
import RouteOptimizer from './pages/RouteOptimizer'
import LiveTracking from './pages/LiveTracking'
import Analytics from './pages/Analytics'
import FleetAllocation from './pages/FleetAllocation'
import CargoIntelligence from './pages/CargoIntelligence'

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'       },
  { to: '/predict',   icon: Brain,           label: 'Predictions'     },
  { to: '/routes',    icon: RouteIcon,       label: 'Route Optimizer' },
  { to: '/fleet',     icon: Truck,           label: 'Fleet Allocation'},
  { to: '/cargo',     icon: Shield,          label: 'Cargo Intel'     },
  { to: '/tracking',  icon: Radio,           label: 'Live Tracking'   },
  { to: '/analytics', icon: BarChart3,       label: 'Analytics'       },
]

function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-60 flex flex-col z-40 scanline-bg"
      style={{ background: 'linear-gradient(180deg, #050918 0%, #020510 100%)', borderRight: '1px solid rgba(0,229,255,0.1)' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-cyan-500/10">
        <div className="relative">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#00e5ff,#0ea5e9)', boxShadow: '0 0 16px rgba(0,229,255,0.4)' }}>
            <Package size={16} color="#020510" strokeWidth={2.5} />
          </div>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-neon-green animate-pulse-slow" />
        </div>
        <div>
          <div className="font-display font-bold text-sm text-white tracking-wide">LogiSense</div>
          <div className="font-mono text-[10px] text-cyan-400 tracking-widest">AI PLATFORM</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative
            ${isActive ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`
          }>
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-cyan-400"
                    style={{ boxShadow: '0 0 8px rgba(0,229,255,0.8)' }} />
                )}
                <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200
                  ${isActive ? 'bg-cyan-400/15 text-cyan-400' : 'text-slate-600 group-hover:text-slate-400 group-hover:bg-white/5'}`}>
                  <Icon size={15} />
                </div>
                <span className="tracking-wide">{label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-cyan-500/10">
        <div className="glass-card px-3 py-2.5 flex items-center gap-2">
          <Zap size={12} className="text-cyan-400" />
          <div>
            <div className="text-[10px] font-mono text-slate-500">MODELS STATUS</div>
            <div className="text-[11px] font-mono text-neon-green font-semibold">● ONLINE</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div key={loc.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="flex-1 overflow-auto p-6">
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="ml-60 flex-1 flex flex-col overflow-hidden">
          <PageWrapper>
            <Routes>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/predict"   element={<Predictions />} />
              <Route path="/routes"    element={<RouteOptimizer />} />
              <Route path="/fleet"     element={<FleetAllocation />} />
              <Route path="/cargo"     element={<CargoIntelligence />} />
              <Route path="/tracking"  element={<LiveTracking />} />
              <Route path="/analytics" element={<Analytics />} />
            </Routes>
          </PageWrapper>
        </main>
      </div>
    </BrowserRouter>
  )
}
