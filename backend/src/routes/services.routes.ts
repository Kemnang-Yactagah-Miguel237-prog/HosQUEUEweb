import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { wsManager } from '../services/websocket.js';

export const servicesRouter = Router();

// GET /api/services
servicesRouter.get('/', (_req, res) => {
  const services = db.getServices();
  res.json(services);
});

// GET /api/services/:id
servicesRouter.get('/:id', (req, res) => {
  const serviceId = String(req.params.id);
  const service = db.getServiceById(serviceId);
  if (!service) {
    res.status(404).json({ error: 'Service non trouvé' });
    return;
  }
  res.json(service);
});

// POST /api/services (Admin)
servicesRouter.post('/', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res) => {
  const { nameFr, nameEn, capacity, bookingFee, active } = req.body;

  if (!nameFr || !nameEn || capacity === undefined || bookingFee === undefined) {
    res.status(400).json({ error: 'Champs requis manquants.' });
    return;
  }

  const newService = db.createService({
    nameFr,
    nameEn,
    capacity: Number(capacity),
    bookingFee: Number(bookingFee),
    active: active ?? true
  });

  if (req.user) {
    db.logActivity(req.user.id, req.user.name, `Création du service ${newService.nameFr}`, newService.id);
  }

  wsManager.broadcast('SERVICE_UPDATED', newService);

  res.status(201).json(newService);
});

// PATCH /api/services/:id (Admin)
servicesRouter.patch('/:id', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res) => {
  const serviceId = String(req.params.id);
  const updated = db.updateService(serviceId, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Service non trouvé' });
    return;
  }

  if (req.user) {
    db.logActivity(req.user.id, req.user.name, `Modification du service ${updated.nameFr}`, updated.id);
  }

  wsManager.broadcast('SERVICE_UPDATED', updated);

  res.json(updated);
});

// DELETE /api/services/:id (Admin)
servicesRouter.delete('/:id', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res) => {
  const serviceId = String(req.params.id);
  const service = db.getServiceById(serviceId);
  const success = db.deleteService(serviceId);

  if (!success) {
    res.status(404).json({ error: 'Service non trouvé' });
    return;
  }

  if (req.user && service) {
    db.logActivity(req.user.id, req.user.name, `Suppression du service ${service.nameFr}`, service.id);
  }

  wsManager.broadcast('SERVICE_UPDATED', { deletedId: serviceId });

  res.json({ success: true });
});
