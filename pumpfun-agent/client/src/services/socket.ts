import { io, Socket } from 'socket.io-client';

// Connect to backend server on the same origin (port 3005) or fallback if Vite dev port 5173
const SOCKET_URL = typeof window !== 'undefined'
  ? (window.location.port === '5173' ? 'http://localhost:3005' : window.location.origin)
  : 'http://localhost:3005';

export const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});
