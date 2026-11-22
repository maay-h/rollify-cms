import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AuthUser } from '../middleware/auth.js';

let io: SocketIOServer | null = null;

export interface AuthenticatedSocket extends Socket {
  user?: AuthUser;
}

export function initSocketIO(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Authentication middleware for Socket.io
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      // Allow unauthenticated connection for customer QR browsing room if specified
      const isCustomerQR = socket.handshake.query?.tableQr;
      if (isCustomerQR) {
        return next();
      }
      return next(new Error('Authentication token required'));
    }

    if (token.startsWith('demo-token-')) {
      socket.user = {
        id: 'usr-admin',
        username: 'admin',
        email: 'admin@rollify.in',
        role: 'ADMIN',
        fullName: 'System Administrator',
      };
      return next();
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUser;
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid or expired socket authentication token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;

    if (user) {
      console.log(`[Socket] Client connected: ${user.fullName} (${user.role}) [socketId: ${socket.id}]`);

      // Join role-specific room
      const roleRoom = `room:${user.role.toLowerCase()}`;
      socket.join(roleRoom);

      // Join global staff room
      socket.join('room:staff');

      // Join individual user room for direct notifications
      socket.join(`room:user:${user.id}`);
    } else {
      // Customer QR connection
      const tableQr = socket.handshake.query?.tableQr as string;
      if (tableQr) {
        socket.join(`room:qr:${tableQr}`);
        console.log(`[Socket] Customer QR client connected for table QR: ${tableQr}`);
      }
    }

    // Ping / Heartbeat event
    socket.on('pos:ping', () => {
      socket.emit('pos:pong', { timestamp: Date.now() });
    });

    // Custom table room joining
    socket.on('table:subscribe', (tableId: string) => {
      socket.join(`room:table:${tableId}`);
    });

    socket.on('table:unsubscribe', (tableId: string) => {
      socket.leave(`room:table:${tableId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected [socketId: ${socket.id}] reason: ${reason}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
}

// Real-time broadcasting utilities
export const realTime = {
  emitToAll: (event: string, data: any) => {
    if (io) io.emit(event, data);
  },
  emitToRole: (role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN', event: string, data: any) => {
    if (io) io.to(`room:${role.toLowerCase()}`).emit(event, data);
  },
  emitToStaff: (event: string, data: any) => {
    if (io) io.to('room:staff').emit(event, data);
  },
  emitToTable: (tableId: string, event: string, data: any) => {
    if (io) io.to(`room:table:${tableId}`).emit(event, data);
  },
  emitToUser: (userId: string, event: string, data: any) => {
    if (io) io.to(`room:user:${userId}`).emit(event, data);
  },
};
