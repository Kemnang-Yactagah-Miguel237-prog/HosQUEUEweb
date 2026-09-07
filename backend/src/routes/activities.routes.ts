import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js';

export const activitiesRouter = Router();

// GET /api/activities
activitiesRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const { userId } = req.query;

  if (userId) {
    res.json(db.getUserActivity(String(userId)));
    return;
  }

  res.json(db.getActivities());
});

// POST /api/activities (Log an action)
activitiesRouter.post('/', authenticate, (req: AuthenticatedRequest, res) => {
  const { action, targetId } = req.body;
  if (!action) {
    res.status(400).json({ error: 'action requise' });
    return;
  }

  const userId = req.user?.id || 'system';
  const userName = req.user?.name || 'System';

  const entry = db.logActivity(userId, userName, action, targetId);
  res.status(201).json(entry);
});
