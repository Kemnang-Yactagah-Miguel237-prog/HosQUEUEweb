import { Router } from 'express';
import { db } from '../db.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';

export const statsRouter = Router();

// GET /api/stats
statsRouter.get('/', optionalAuthenticate, (_req, res) => {
  const tickets = db.getTickets();
  const services = db.getServices();
  const users = db.getUsers();

  const today = new Date().toDateString();
  const todayTickets = tickets.filter(t => new Date(t.createdAt).toDateString() === today);

  const servedToday = todayTickets.filter(t => t.status === 'served').length;
  const waitingNow = tickets.filter(t => t.status === 'waiting').length;
  const calledNow = tickets.filter(t => t.status === 'called').length;

  const totalRevenue = todayTickets
    .filter(t => t.status === 'served' || t.status === 'waiting' || t.status === 'called')
    .reduce((sum, t) => {
      const svc = services.find(s => s.id === t.serviceId);
      return sum + (svc?.bookingFee || 0);
    }, 0);

  // Stats par service
  const serviceStats = services.map(svc => {
    const svcTickets = todayTickets.filter(t => t.serviceId === svc.id);
    const waiting = tickets.filter(t => t.serviceId === svc.id && t.status === 'waiting').length;
    const served = svcTickets.filter(t => t.status === 'served').length;
    const called = tickets.find(t => t.serviceId === svc.id && t.status === 'called') || null;

    return {
      serviceId: svc.id,
      nameFr: svc.nameFr,
      nameEn: svc.nameEn,
      capacity: svc.capacity,
      waiting,
      served,
      called,
      totalToday: svcTickets.length
    };
  });

  res.json({
    servedToday,
    waitingNow,
    calledNow,
    totalRevenue,
    totalUsers: users.length,
    activeServices: services.filter(s => s.active).length,
    services: serviceStats
  });
});
