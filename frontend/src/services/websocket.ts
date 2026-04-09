import type { LiveShipment, Alert } from '../types';

const WS_URL = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000') + '/ws/tracking';

type TrackingCallback = (data: {
  shipments: LiveShipment[];
  alerts: Alert[];
  kpis: { total: number; in_transit: number; delayed: number; delivered: number; on_time_rate: number };
}) => void;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<TrackingCallback>();

export function subscribeTracking(cb: TrackingCallback) {
  listeners.add(cb);
  if (!socket || socket.readyState > 1) connect();
  return () => listeners.delete(cb);
}

function connect() {
  if (socket?.readyState === WebSocket.OPEN) return;
  socket = new WebSocket(WS_URL);

  socket.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'tracking_update' || msg.type === 'initial') {
        listeners.forEach(cb => cb({
          shipments: msg.shipments || [],
          alerts: msg.alerts || [],
          kpis: msg.kpis || {},
        }));
      }
    } catch { /* ignore malformed */ }
  };

  socket.onclose = () => {
    if (listeners.size > 0) {
      reconnectTimer = setTimeout(connect, 3000);
    }
  };
}

export function disconnectTracking() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  socket?.close();
  socket = null;
}
