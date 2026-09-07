import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js';
import { wsManager } from '../services/websocket.js';

export const paymentsRouter = Router();

// POST /api/payments/initiate
paymentsRouter.post('/initiate', authenticate, (req: AuthenticatedRequest, res) => {
  const { ticketId, phoneNumber, provider } = req.body;

  if (!ticketId || !phoneNumber || !provider) {
    res.status(400).json({ error: 'ticketId, phoneNumber et provider sont requis' });
    return;
  }

  const ticket = db.getTicketById(ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket non trouvé' });
    return;
  }

  const service = db.getServiceById(ticket.serviceId);
  const amount = service?.bookingFee || 1000;

  const ref = 'MM-' + Math.random().toString(36).slice(2, 8).toUpperCase();

  const transaction = db.recordPayment({
    ticketId,
    patientId: req.user?.id || ticket.patientId,
    serviceId: ticket.serviceId,
    amount,
    phoneNumber,
    provider,
    reference: ref,
    status: 'pending'
  });

  res.json({
    message: 'Demande de paiement initialisée. Veuillez valider le prompt sur votre mobile.',
    transaction
  });
});

// POST /api/payments/:ticketId/confirm
paymentsRouter.post('/:ticketId/confirm', authenticate, (req: AuthenticatedRequest, res) => {
  const ticketId = String(req.params.ticketId);
  const { paymentRef, phoneNumber, provider } = req.body;

  const ticket = db.getTicketById(ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket non trouvé' });
    return;
  }

  const ref = paymentRef || ('PAY-' + Math.random().toString(36).slice(2, 8).toUpperCase());
  const updatedTicket = db.confirmPayment(ticketId, ref);

  if (phoneNumber && provider) {
    const service = db.getServiceById(ticket.serviceId);
    db.recordPayment({
      ticketId,
      patientId: ticket.patientId,
      serviceId: ticket.serviceId,
      amount: service?.bookingFee || 1000,
      phoneNumber,
      provider,
      reference: ref,
      status: 'success'
    });
  }

  if (req.user) {
    db.logActivity(req.user.id, req.user.name, `Paiement confirmé (${ref}) pour le ticket ${ticket.number}`, ticket.id);
  }

  // Création d'une notification pour le patient
  const notif = db.createNotification(
    ticket.patientId,
    `Paiement validé (${ref}). Votre ticket ${ticket.number} est maintenant dans la file d'attente.`,
    `Payment confirmed (${ref}). Your ticket ${ticket.number} is now in the active queue.`,
    'payment_confirmed'
  );

  wsManager.broadcast('PAYMENT_CONFIRMED', { ticket: updatedTicket, notification: notif });
  wsManager.broadcast('QUEUE_UPDATED', { serviceId: ticket.serviceId });

  res.json({
    ticket: updatedTicket,
    paymentRef: ref
  });
});
