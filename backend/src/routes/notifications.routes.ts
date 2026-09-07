import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js';
import { wsManager } from '../services/websocket.js';

export const notificationsRouter = Router();

// GET /api/notifications
notificationsRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Non authentifié' });
    return;
  }
  const notifs = db.getUserNotifications(req.user.id);
  res.json(notifs);
});

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', authenticate, (req: AuthenticatedRequest, res) => {
  const success = db.markNotificationRead(String(req.params.id));
  if (!success) {
    res.status(404).json({ error: 'Notification introuvable' });
    return;
  }
  res.json({ success: true });
});

// POST /api/notifications/mark-all-read
notificationsRouter.post('/mark-all-read', authenticate, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Non authentifié' });
    return;
  }
  db.markAllNotificationsRead(req.user.id);
  res.json({ success: true });
});

// POST /api/notifications (Envoi direct d'une alerte)
notificationsRouter.post('/', authenticate, (req: AuthenticatedRequest, res) => {
  const { userId, messageFr, messageEn, type } = req.body;

  if (!userId || !messageFr || !messageEn) {
    res.status(400).json({ error: 'userId, messageFr et messageEn sont requis' });
    return;
  }

  const notif = db.createNotification(userId, messageFr, messageEn, type || 'general');
  wsManager.broadcast('NOTIFICATION_CREATED', notif);

  res.status(201).json(notif);
});
