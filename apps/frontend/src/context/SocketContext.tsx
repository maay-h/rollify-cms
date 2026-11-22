import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext.js';

export type SocketStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface SocketContextValue {
  socket: Socket | null;
  status: SocketStatus;
  latency: number | null;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<SocketStatus>('disconnected');
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setStatus('disconnected');
      }
      return;
    }

    setStatus('connecting');

    const backendUrl = import.meta.env.VITE_BACKEND_URL || undefined;
    const s = io(backendUrl, {
      auth: { token },
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    s.on('connect', () => {
      setStatus('connected');
      console.log('[Socket] Connected to server with ID:', s.id);

      // Measure round-trip ping
      const pingStart = Date.now();
      s.emit('pos:ping');
      s.once('pos:pong', () => {
        setLatency(Date.now() - pingStart);
      });
    });

    s.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setStatus('disconnected');
    });

    s.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      setStatus('error');
    });

    setSocket(s);

    // Heartbeat ping every 15s to track latency
    const interval = setInterval(() => {
      if (s.connected) {
        const pingStart = Date.now();
        s.emit('pos:ping');
        s.once('pos:pong', () => {
          setLatency(Date.now() - pingStart);
        });
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      s.disconnect();
    };
  }, [token, user?.id]);

  const reconnect = () => {
    if (socket) {
      socket.connect();
    }
  };

  return (
    <SocketContext.Provider value={{ socket, status, latency, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
};

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
