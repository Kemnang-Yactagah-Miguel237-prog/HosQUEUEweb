import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js';
import { wsManager } from '../services/websocket.js';
import { campayService } from '../services/campay.service.js';

export const paymentsRouter = Router();

// POST /api/payments/create-link (Redirection vers le portail de paiement Campay)
paymentsRouter.post('/create-link', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { ticketId, redirectUrl } = req.body;

    if (!ticketId) {
      res.status(400).json({ error: 'ticketId est requis' });
      return;
    }

    const ticket = db.getTicketById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket non trouvé' });
      return;
    }

    if (ticket.patientId !== req.user?.id && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Vous ne pouvez payer que votre propre ticket.' });
      return;
    }

    const service = db.getServiceById(ticket.serviceId);
    const originalAmount = service?.bookingFee || 1000;
    const effectiveAmount = campayService.getEffectiveAmount(originalAmount);

    const paymentLinkResult = await campayService.getPaymentLink({
      amount: originalAmount,
      description: `Ticket ${ticket.number} - ${service?.nameFr || 'HosQUEUE'}`,
      externalReference: ticket.id,
      redirectUrl: redirectUrl || undefined,
    });

    // Enregistrement de la transaction en attente
    const transaction = db.recordPayment({
      ticketId,
      patientId: req.user?.id || ticket.patientId,
      serviceId: ticket.serviceId,
      amount: effectiveAmount,
      phoneNumber: '',
      provider: 'mtn_momo',
      reference: paymentLinkResult.reference,
      status: 'pending'
    });

    res.json({
      link: paymentLinkResult.link,
      reference: paymentLinkResult.reference,
      effectiveAmount: paymentLinkResult.effectiveAmount,
      originalAmount,
      environment: campayService.getEnvironment(),
      transaction
    });
  } catch (err: any) {
    console.error('Erreur create payment link:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la génération du lien de paiement Campay' });
  }
});

// POST /api/payments/initiate (Push USSD direct)
paymentsRouter.post('/initiate', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
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

    if (ticket.patientId !== req.user?.id && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Vous ne pouvez initier le paiement que pour votre propre ticket.' });
      return;
    }

    const service = db.getServiceById(ticket.serviceId);
    const originalAmount = service?.bookingFee || 1000;

    // Déclenchement de la collecte Campay (Push USSD sur le téléphone)
    const campayResult = await campayService.collect({
      amount: originalAmount,
      phoneNumber,
      description: `Frais réservation ticket ${ticket.number} (${service?.nameFr || 'HosQUEUE'})`,
      externalReference: ticket.id,
    });

    const transaction = db.recordPayment({
      ticketId,
      patientId: req.user?.id || ticket.patientId,
      serviceId: ticket.serviceId,
      amount: campayResult.effectiveAmount,
      phoneNumber: campayService.formatPhoneNumber(phoneNumber),
      provider,
      reference: campayResult.reference,
      status: 'pending'
    });

    res.json({
      message: 'Demande de paiement Campay initialisée. Veuillez valider le prompt USSD sur votre mobile.',
      reference: campayResult.reference,
      ussdCode: campayResult.ussdCode,
      operator: campayResult.operator,
      effectiveAmount: campayResult.effectiveAmount,
      originalAmount,
      environment: campayService.getEnvironment(),
      transaction
    });
  } catch (err: any) {
    console.error('Erreur initiate payment:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de l\'initialisation du paiement Campay' });
  }
});

// GET /api/payments/:ticketId/status
paymentsRouter.get('/:ticketId/status', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const ticketId = String(req.params.ticketId);
    const ticket = db.getTicketById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket non trouvé' });
      return;
    }

    if (ticket.patientId !== req.user?.id && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Accès non autorisé.' });
      return;
    }

    const transaction = db.getLatestPaymentForTicket(ticketId);
    if (!transaction) {
      res.status(404).json({ error: 'Aucun paiement trouvé pour ce ticket.' });
      return;
    }

    res.json({ status: transaction.status, reference: transaction.reference });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur statut paiement' });
  }
});

// GET /api/payments/status/:reference
paymentsRouter.get('/status/:reference', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const reference = String(req.params.reference);
    const payment = db.getPaymentByReference(reference);

    if (!payment) {
      res.status(404).json({ error: 'Transaction non trouvée' });
      return;
    }

    // Si déjà validé dans notre DB
    if (payment.status === 'success') {
      const ticket = db.getTicketById(payment.ticketId);
      res.json({
        status: 'SUCCESSFUL',
        ticket,
        paymentRef: reference,
      });
      return;
    }

    // Vérification auprès de l'API Campay
    const campayStatus = await campayService.checkTransactionStatus(reference);

    if (campayStatus.status === 'SUCCESSFUL') {
      const ticket = db.getTicketById(payment.ticketId);
      if (ticket && ticket.status === 'pending_payment') {
        const updatedTicket = db.confirmPayment(ticket.id, reference);
        db.updatePaymentStatus(reference, 'success');

        if (req.user) {
          db.logActivity(req.user.id, req.user.name, `Paiement Campay validé (${reference}) pour le ticket ${ticket.number}`, ticket.id);
        }

        const notif = db.createNotification(
          ticket.patientId,
          `Paiement validé (${reference}). Votre ticket ${ticket.number} est maintenant dans la file d'attente.`,
          `Payment confirmed (${reference}). Your ticket ${ticket.number} is now in the active queue.`,
          'payment_confirmed'
        );

        wsManager.broadcast('PAYMENT_CONFIRMED', { ticket: updatedTicket, notification: notif });
        wsManager.broadcast('QUEUE_UPDATED', { serviceId: ticket.serviceId });

        res.json({
          status: 'SUCCESSFUL',
          ticket: updatedTicket,
          paymentRef: reference
        });
        return;
      }
    } else if (campayStatus.status === 'FAILED') {
      db.updatePaymentStatus(reference, 'failed');
      res.json({
        status: 'FAILED',
        message: 'Le paiement a échoué ou a été annulé par l\'utilisateur.'
      });
      return;
    }

    res.json({
      status: 'PENDING',
      message: 'En attente de validation sur votre téléphone.'
    });
  } catch (err: any) {
    console.error('Erreur check payment status:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la vérification du statut Campay' });
  }
});

// POST /api/payments/webhook/campay (Appelé automatiquement par Campay lors du succès d'un paiement)
paymentsRouter.post('/webhook/campay', async (req, res) => {
  try {
    const { reference, status, external_reference } = req.body;
    console.log(`🔔 Webhook Campay reçu pour la référence ${reference}, statut: ${status}`);

    if (status === 'SUCCESSFUL') {
      const payment = db.getPaymentByReference(reference);
      const ticketId = external_reference || payment?.ticketId;

      if (ticketId) {
        const ticket = db.getTicketById(ticketId);
        if (ticket && ticket.status === 'pending_payment') {
          const updatedTicket = db.confirmPayment(ticket.id, reference);
          db.updatePaymentStatus(reference, 'success');

          const notif = db.createNotification(
            ticket.patientId,
            `Paiement Campay confirmé (${reference}). Votre ticket ${ticket.number} est actif.`,
            `Campay payment confirmed (${reference}). Your ticket ${ticket.number} is active.`,
            'payment_confirmed'
          );

          wsManager.broadcast('PAYMENT_CONFIRMED', { ticket: updatedTicket, notification: notif });
          wsManager.broadcast('QUEUE_UPDATED', { serviceId: ticket.serviceId });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Erreur Webhook Campay:', err);
    res.status(500).json({ error: 'Erreur traitement webhook' });
  }
});

// POST /api/payments/:ticketId/confirm (Confirmation manuelle / directe)
paymentsRouter.post('/:ticketId/confirm', authenticate, (req: AuthenticatedRequest, res) => {
  const ticketId = String(req.params.ticketId);
  const { paymentRef, phoneNumber, provider } = req.body;

  const ticket = db.getTicketById(ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket non trouvé' });
    return;
  }

  const ref = paymentRef || ('CAMPAY-' + Math.random().toString(36).slice(2, 8).toUpperCase());
  const updatedTicket = db.confirmPayment(ticketId, ref);

  if (phoneNumber && provider) {
    const service = db.getServiceById(ticket.serviceId);
    db.recordPayment({
      ticketId,
      patientId: ticket.patientId,
      serviceId: ticket.serviceId,
      amount: campayService.getEffectiveAmount(service?.bookingFee || 1000),
      phoneNumber,
      provider,
      reference: ref,
      status: 'success'
    });
  }

  if (req.user) {
    db.logActivity(req.user.id, req.user.name, `Paiement confirmé (${ref}) pour le ticket ${ticket.number}`, ticket.id);
  }

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
