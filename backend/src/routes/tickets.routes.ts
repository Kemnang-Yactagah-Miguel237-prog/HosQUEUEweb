import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, optionalAuthenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { wsManager } from '../services/websocket.js';

export const ticketsRouter = Router();

// GET /api/tickets (avec filtres de recherche)
ticketsRouter.get('/', optionalAuthenticate, (req: AuthenticatedRequest, res) => {
  const { serviceId, patientId, status, today } = req.query;

  let tickets = db.getTickets();

  if (serviceId) {
    tickets = tickets.filter(t => t.serviceId === String(serviceId));
  }
  if (patientId) {
    tickets = tickets.filter(t => t.patientId === String(patientId));
  }
  if (status) {
    tickets = tickets.filter(t => t.status === String(status));
  }
  if (today === 'true') {
    const todayStr = new Date().toDateString();
    tickets = tickets.filter(t => new Date(t.createdAt).toDateString() === todayStr);
  }

  res.json(tickets);
});

// GET /api/tickets/:id
ticketsRouter.get('/:id', optionalAuthenticate, (req, res) => {
  const ticketId = String(req.params.id);
  const ticket = db.getTicketById(ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket introuvable' });
    return;
  }
  res.json(ticket);
});

// GET /api/tickets/:id/position
ticketsRouter.get('/:id/position', (req, res) => {
  const ticketId = String(req.params.id);
  const position = db.getQueuePosition(ticketId);
  const estimatedWait = db.getEstimatedWait(position);
  res.json({ position, estimatedWaitMinutes: estimatedWait });
});

// POST /api/tickets (Création d'un ticket)
ticketsRouter.post('/', authenticate, (req: AuthenticatedRequest, res) => {
  const { serviceId } = req.body;
  if (!serviceId) {
    res.status(400).json({ error: 'serviceId requis' });
    return;
  }

  const patientId = req.user?.id;
  const patientName = req.user?.name;

  if (!patientId || !patientName) {
    res.status(401).json({ error: 'Utilisateur non identifié' });
    return;
  }

  try {
    const ticket = db.createTicket(patientId, patientName, serviceId);

    db.logActivity(patientId, patientName, `Réservation de ticket ${ticket.number}`, ticket.id);

    wsManager.broadcast('TICKET_CREATED', ticket);
    wsManager.broadcast('QUEUE_UPDATED', { serviceId });

    res.status(201).json(ticket);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la création du ticket' });
  }
});

// POST /api/tickets/call-next (Personnel médical)
ticketsRouter.post('/call-next', authenticate, requireRole(['medical', 'admin']), (req: AuthenticatedRequest, res) => {
  const { serviceId } = req.body;
  const targetServiceId = serviceId || req.user?.serviceId;

  if (!targetServiceId) {
    res.status(400).json({ error: 'serviceId requis pour appeler le patient suivant' });
    return;
  }

  const ticket = db.callNextPatient(targetServiceId);

  if (!ticket) {
    const current = db.getCalledTicket(targetServiceId);
    if (current) {
      res.status(400).json({ error: 'Un patient est déjà en cours de consultation.', currentTicket: current });
      return;
    }
    res.status(404).json({ error: 'Aucun patient en attente pour ce service.' });
    return;
  }

  if (req.user) {
    db.logActivity(req.user.id, req.user.name, `Appel du patient ticket ${ticket.number}`, ticket.id);
  }

  // Notifier le patient concerné
  const notif = db.createNotification(
    ticket.patientId,
    `C'est votre tour ! Veuillez vous présenter avec le ticket ${ticket.number}.`,
    `It's your turn! Please proceed to the consultation room with ticket ${ticket.number}.`,
    'your_turn'
  );

  // Broadcast temps réel
  wsManager.broadcast('TICKET_CALLED', { ticket, notification: notif });
  wsManager.broadcast('QUEUE_UPDATED', { serviceId: targetServiceId });

  res.json(ticket);
});

// POST /api/tickets/:id/serve (Consultation terminée)
ticketsRouter.post('/:id/serve', authenticate, requireRole(['medical', 'admin']), (req: AuthenticatedRequest, res) => {
  const ticketId = String(req.params.id);
  const ticket = db.markServed(ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket introuvable' });
    return;
  }

  if (req.user) {
    db.logActivity(req.user.id, req.user.name, `Consultation terminée pour le ticket ${ticket.number}`, ticket.id);
  }

  wsManager.broadcast('TICKET_SERVED', ticket);
  wsManager.broadcast('QUEUE_UPDATED', { serviceId: ticket.serviceId });

  res.json(ticket);
});

// POST /api/tickets/:id/skip (Patient absent / sauté)
ticketsRouter.post('/:id/skip', authenticate, requireRole(['medical', 'admin']), (req: AuthenticatedRequest, res) => {
  const ticketId = String(req.params.id);
  const ticket = db.markSkipped(ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket introuvable' });
    return;
  }

  if (req.user) {
    db.logActivity(req.user.id, req.user.name, `Patient absent/sauté ticket ${ticket.number}`, ticket.id);
  }

  wsManager.broadcast('TICKET_SKIPPED', ticket);
  wsManager.broadcast('QUEUE_UPDATED', { serviceId: ticket.serviceId });

  res.json(ticket);
});

// POST /api/tickets/:id/cancel
ticketsRouter.post('/:id/cancel', authenticate, (req: AuthenticatedRequest, res) => {
  const ticketId = String(req.params.id);
  const ticket = db.getTicketById(ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket introuvable' });
    return;
  }

  if (req.user?.role === 'patient' && ticket.patientId !== req.user.id) {
    res.status(403).json({ error: 'Action non autorisée sur ce ticket' });
    return;
  }

  const updated = db.updateTicket(ticketId, { status: 'cancelled' });

  if (req.user) {
    db.logActivity(req.user.id, req.user.name, `Annulation du ticket ${ticket.number}`, ticket.id);
  }

  wsManager.broadcast('TICKET_CANCELLED', updated);
  wsManager.broadcast('QUEUE_UPDATED', { serviceId: ticket.serviceId });

  res.json(updated);
});
