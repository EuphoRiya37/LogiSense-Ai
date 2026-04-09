import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      // Never throw to the error boundary — show inline errors instead
      throwOnError: false,
    },
  },
})

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 text-center px-8">
          <div className="text-4xl">⚠️</div>
          <div className="text-white font-display text-lg font-semibold">Something went wrong</div>
          <div className="text-slate-500 font-mono text-sm max-w-md">
            {(this.state.error as Error).message}
          </div>
          <button className="btn-primary mt-2" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
