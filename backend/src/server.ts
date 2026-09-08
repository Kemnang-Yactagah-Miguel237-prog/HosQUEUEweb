import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { wsManager } from './services/websocket.js';
import { authRouter } from './routes/auth.routes.js';
import { servicesRouter } from './routes/services.routes.js';
import { ticketsRouter } from './routes/tickets.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { activitiesRouter } from './routes/activities.routes.js';
import { statsRouter } from './routes/stats.routes.js';
import { db } from './db.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Initialize WebSockets
wsManager.init(server);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'HosQUEUE Backend API',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/services', servicesRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/users', usersRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/stats', statsRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Erreur interne du serveur', message: err.message });
});

// Start Server
void db.ready.then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 HosQUEUE Backend running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket endpoint available at ws://localhost:${PORT}/ws`);
  });
}).catch((error: unknown) => {
  console.error('Failed to initialize MySQL database:', error);
  process.exitCode = 1;
});
