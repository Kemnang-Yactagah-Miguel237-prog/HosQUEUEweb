import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import type { User, Service, Ticket, Notification, ActivityEntry, PaymentTransaction, Role, TicketStatus, NotifType } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'hosqueue_db.json');

interface DatabaseSchema {
  users: User[];
  services: Service[];
  tickets: Ticket[];
  notifications: Notification[];
  activities: ActivityEntry[];
  payments: PaymentTransaction[];
}

const uid = () => Math.random().toString(36).slice(2, 10);
const ts = () => new Date().toISOString();

const SEED_USERS: User[] = [
  { id: 'u-admin', name: 'Admin Principal', email: 'admin@hosqueue.com', password: '', role: 'admin', suspended: false, createdAt: '2025-01-01T08:00:00Z', createdBy: 'system' },
  { id: 'u-med1', name: 'Dr. Marie Martin', email: 'dr.martin@hosqueue.com', password: '', role: 'medical', serviceId: 'svc-1', suspended: false, createdAt: '2025-01-02T08:00:00Z', createdBy: 'u-admin' },
  { id: 'u-med2', name: 'Dr. Ibrahim Koné', email: 'dr.kone@hosqueue.com', password: '', role: 'medical', serviceId: 'svc-2', suspended: false, createdAt: '2025-01-02T09:00:00Z', createdBy: 'u-admin' },
  { id: 'u-pat1', name: 'Jean Dupont', email: 'jean.dupont@hosqueue.com', password: '', role: 'patient', suspended: false, createdAt: '2025-01-03T08:00:00Z', createdBy: 'u-admin' },
  { id: 'u-pat2', name: 'Aissatou Bah', email: 'aissatou.bah@hosqueue.com', password: '', role: 'patient', suspended: false, createdAt: '2025-01-03T09:00:00Z', createdBy: 'u-admin' },
  { id: 'u-pat3', name: 'Mamadou Diallo', email: 'm.diallo@hosqueue.com', password: '', role: 'patient', suspended: false, createdAt: '2025-01-03T10:00:00Z', createdBy: 'u-admin' },
];

const SEED_SERVICES: Service[] = [
  { id: 'svc-1', nameFr: 'Consultation Générale', nameEn: 'General Consultation', capacity: 50, bookingFee: 1000, active: true, nextNumber: 8 },
  { id: 'svc-2', nameFr: 'Pédiatrie', nameEn: 'Pediatrics', capacity: 30, bookingFee: 1500, active: true, nextNumber: 5 },
  { id: 'svc-3', nameFr: 'Urgences', nameEn: 'Emergency', capacity: 20, bookingFee: 500, active: true, nextNumber: 3 },
];

function makeSeedTickets(): Ticket[] {
  const today = new Date();
  const d = (h: number, m: number) => { const dt = new Date(today); dt.setHours(h, m, 0, 0); return dt.toISOString(); };
  return [
    { id: 'tk-1', number: 'CG-001', patientId: 'u-pat1', patientName: 'Jean Dupont', serviceId: 'svc-1', status: 'served', createdAt: d(8, 5), paymentRef: 'PAY-001', servedAt: d(8, 30) },
    { id: 'tk-2', number: 'CG-002', patientId: 'u-pat2', patientName: 'Aissatou Bah', serviceId: 'svc-1', status: 'waiting', createdAt: d(8, 15), paymentRef: 'PAY-002' },
    { id: 'tk-3', number: 'CG-003', patientId: 'u-pat3', patientName: 'Mamadou Diallo', serviceId: 'svc-1', status: 'waiting', createdAt: d(8, 20), paymentRef: 'PAY-003' },
    { id: 'tk-4', number: 'CG-004', patientId: 'u-pat1', patientName: 'Jean Dupont', serviceId: 'svc-1', status: 'waiting', createdAt: d(8, 25), paymentRef: 'PAY-004' },
    { id: 'tk-5', number: 'CG-005', patientId: 'u-pat2', patientName: 'Aissatou Bah', serviceId: 'svc-1', status: 'called', createdAt: d(8, 10), paymentRef: 'PAY-005', calledAt: d(8, 45) },
    { id: 'tk-6', number: 'PED-001', patientId: 'u-pat3', patientName: 'Mamadou Diallo', serviceId: 'svc-2', status: 'waiting', createdAt: d(8, 30), paymentRef: 'PAY-006' },
    { id: 'tk-7', number: 'PED-002', patientId: 'u-pat1', patientName: 'Jean Dupont', serviceId: 'svc-2', status: 'waiting', createdAt: d(8, 35), paymentRef: 'PAY-007' },
    { id: 'tk-8', number: 'URG-001', patientId: 'u-pat2', patientName: 'Aissatou Bah', serviceId: 'svc-3', status: 'served', createdAt: d(7, 30), paymentRef: 'PAY-008', servedAt: d(7, 45) },
    { id: 'tk-9', number: 'URG-002', patientId: 'u-pat3', patientName: 'Mamadou Diallo', serviceId: 'svc-3', status: 'waiting', createdAt: d(8, 0), paymentRef: 'PAY-009' },
    { id: 'tk-10', number: 'CG-006', patientId: 'u-pat3', patientName: 'Mamadou Diallo', serviceId: 'svc-1', status: 'skipped', createdAt: d(7, 50), paymentRef: 'PAY-010' },
  ];
}

class Database {
  private data: DatabaseSchema = {
    users: [],
    services: [],
    tickets: [],
    notifications: [],
    activities: [],
    payments: []
  };

  constructor() {
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        // Ensure all arrays exist
        this.data.users = this.data.users || [];
        this.data.services = this.data.services || [];
        this.data.tickets = this.data.tickets || [];
        this.data.notifications = this.data.notifications || [];
        this.data.activities = this.data.activities || [];
        this.data.payments = this.data.payments || [];
        return;
      } catch (err) {
        console.error('Error reading db file, seeding fresh database...', err);
      }
    }

    this.seed();
  }

  private seed() {
    const salt = bcrypt.genSaltSync(10);
    const adminPwd = bcrypt.hashSync('Admin@123', salt);
    const staffPwd = bcrypt.hashSync('Staff@123', salt);
    const patientPwd = bcrypt.hashSync('Patient@123', salt);

    const seededUsers = SEED_USERS.map(u => {
      let pwd = patientPwd;
      if (u.role === 'admin') pwd = adminPwd;
      else if (u.role === 'medical') pwd = staffPwd;
      return { ...u, password: pwd };
    });

    this.data = {
      users: seededUsers,
      services: SEED_SERVICES,
      tickets: makeSeedTickets(),
      notifications: [
        {
          id: 'n-1',
          userId: 'u-pat1',
          messageFr: 'Bienvenue sur HosQUEUE ! Votre compte est prêt.',
          messageEn: 'Welcome to HosQUEUE! Your account is ready.',
          read: true,
          createdAt: ts(),
          type: 'account_created'
        }
      ],
      activities: [
        {
          id: 'act-1',
          userId: 'u-admin',
          userName: 'Admin Principal',
          action: 'Initialisation du système HosQUEUE',
          createdAt: ts()
        }
      ],
      payments: []
    };

    this.persist();
  }

  public persist() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  // --- USERS ---
  public getUsers(): User[] {
    return this.data.users;
  }

  public getUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public getUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(userData: { name: string; email: string; password?: string; role: Role; serviceId?: string; createdBy?: string }): { user: User; rawPassword: string } {
    const rawPassword = userData.password || this.generateRandomPassword();
    const hashedPassword = bcrypt.hashSync(rawPassword, 10);

    const user: User = {
      id: 'u-' + uid(),
      name: userData.name,
      email: userData.email.toLowerCase(),
      password: hashedPassword,
      role: userData.role,
      serviceId: userData.serviceId,
      suspended: false,
      createdAt: ts(),
      createdBy: userData.createdBy
    };

    this.data.users.push(user);
    this.persist();
    return { user, rawPassword };
  }

  public updateUser(id: string, updates: Partial<User>): User | null {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx === -1) return null;

    if (updates.password && !updates.password.startsWith('$2a$') && !updates.password.startsWith('$2b$')) {
      updates.password = bcrypt.hashSync(updates.password, 10);
    }

    this.data.users[idx] = { ...this.data.users[idx], ...updates };
    this.persist();
    return this.data.users[idx];
  }

  public deleteUser(id: string): boolean {
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter(u => u.id !== id);
    const deleted = this.data.users.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  public verifyPassword(user: User, candidate: string): boolean {
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      return bcrypt.compareSync(candidate, user.password);
    }
    // Fallback if raw password was saved
    return user.password === candidate;
  }

  public generateRandomPassword(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '@#$!';
    const all = upper + lower + digits + special;
    let pwd = upper[Math.floor(Math.random() * upper.length)]
      + lower[Math.floor(Math.random() * lower.length)]
      + digits[Math.floor(Math.random() * digits.length)]
      + special[Math.floor(Math.random() * special.length)];
    for (let i = 0; i < 4; i++) pwd += all[Math.floor(Math.random() * all.length)];
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
  }

  // --- SERVICES ---
  public getServices(): Service[] {
    return this.data.services;
  }

  public getServiceById(id: string): Service | undefined {
    return this.data.services.find(s => s.id === id);
  }

  public createService(data: Omit<Service, 'id' | 'nextNumber'>): Service {
    const svc: Service = {
      id: 'svc-' + uid(),
      nameFr: data.nameFr,
      nameEn: data.nameEn,
      capacity: data.capacity,
      bookingFee: data.bookingFee,
      active: data.active ?? true,
      nextNumber: 1
    };
    this.data.services.push(svc);
    this.persist();
    return svc;
  }

  public updateService(id: string, updates: Partial<Service>): Service | null {
    const idx = this.data.services.findIndex(s => s.id === id);
    if (idx === -1) return null;
    this.data.services[idx] = { ...this.data.services[idx], ...updates };
    this.persist();
    return this.data.services[idx];
  }

  public deleteService(id: string): boolean {
    const initialLen = this.data.services.length;
    this.data.services = this.data.services.filter(s => s.id !== id);
    const deleted = this.data.services.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  // --- TICKETS ---
  public getTickets(): Ticket[] {
    return this.data.tickets;
  }

  public getTicketById(id: string): Ticket | undefined {
    return this.data.tickets.find(t => t.id === id);
  }

  public getTicketsByService(serviceId: string): Ticket[] {
    return this.data.tickets.filter(t => t.serviceId === serviceId);
  }

  public getTicketsByPatient(patientId: string): Ticket[] {
    return this.data.tickets.filter(t => t.patientId === patientId);
  }

  public getWaitingTickets(serviceId: string): Ticket[] {
    return this.data.tickets
      .filter(t => t.serviceId === serviceId && t.status === 'waiting')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  public getCalledTicket(serviceId: string): Ticket | undefined {
    return this.data.tickets.find(t => t.serviceId === serviceId && t.status === 'called');
  }

  public getTodayTickets(serviceId?: string): Ticket[] {
    const todayStr = new Date().toDateString();
    return this.data.tickets.filter(t => {
      const matchDate = new Date(t.createdAt).toDateString() === todayStr;
      return serviceId ? (matchDate && t.serviceId === serviceId) : matchDate;
    });
  }

  private getServicePrefix(service: Service): string {
    const n = service.nameFr.replace(/[aeiouàâéèêëîïôùûü\s]/gi, '').slice(0, 3).toUpperCase();
    return n || 'SVC';
  }

  public createTicket(patientId: string, patientName: string, serviceId: string): Ticket {
    const service = this.getServiceById(serviceId);
    if (!service) throw new Error('Service introuvable');

    const prefix = this.getServicePrefix(service);
    const number = `${prefix}-${String(service.nextNumber).padStart(3, '0')}`;
    this.updateService(serviceId, { nextNumber: service.nextNumber + 1 });

    const ticket: Ticket = {
      id: 'tk-' + uid(),
      number,
      patientId,
      patientName,
      serviceId,
      status: 'pending_payment',
      createdAt: ts()
    };

    this.data.tickets.push(ticket);
    this.persist();
    return ticket;
  }

  public updateTicket(id: string, updates: Partial<Ticket>): Ticket | null {
    const idx = this.data.tickets.findIndex(t => t.id === id);
    if (idx === -1) return null;
    this.data.tickets[idx] = { ...this.data.tickets[idx], ...updates };
    this.persist();
    return this.data.tickets[idx];
  }

  public confirmPayment(ticketId: string, paymentRef?: string): Ticket | null {
    const ref = paymentRef || ('PAY-' + uid().toUpperCase());
    return this.updateTicket(ticketId, { status: 'waiting', paymentRef: ref });
  }

  public callNextPatient(serviceId: string): Ticket | null {
    const current = this.getCalledTicket(serviceId);
    if (current) return null; // Une consultation est déjà en cours
    const waiting = this.getWaitingTickets(serviceId);
    if (waiting.length === 0) return null;
    const next = waiting[0];
    return this.updateTicket(next.id, { status: 'called', calledAt: ts() });
  }

  public markServed(ticketId: string): Ticket | null {
    return this.updateTicket(ticketId, { status: 'served', servedAt: ts() });
  }

  public markSkipped(ticketId: string): Ticket | null {
    return this.updateTicket(ticketId, { status: 'skipped' });
  }

  public getQueuePosition(ticketId: string): number {
    const ticket = this.getTicketById(ticketId);
    if (!ticket || ticket.status !== 'waiting') return 0;
    const waiting = this.getWaitingTickets(ticket.serviceId);
    return waiting.findIndex(t => t.id === ticketId) + 1;
  }

  public getEstimatedWait(position: number): number {
    return Math.max(0, position * 10); // 10 minutes d'estimation par patient
  }

  // --- NOTIFICATIONS ---
  public getNotifications(): Notification[] {
    return this.data.notifications;
  }

  public getUserNotifications(userId: string): Notification[] {
    return this.data.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public createNotification(userId: string, messageFr: string, messageEn: string, type: NotifType): Notification {
    const n: Notification = {
      id: 'n-' + uid(),
      userId,
      messageFr,
      messageEn,
      read: false,
      createdAt: ts(),
      type
    };
    this.data.notifications.push(n);
    this.persist();
    return n;
  }

  public markNotificationRead(id: string): boolean {
    const idx = this.data.notifications.findIndex(n => n.id === id);
    if (idx === -1) return false;
    this.data.notifications[idx].read = true;
    this.persist();
    return true;
  }

  public markAllNotificationsRead(userId: string): void {
    this.data.notifications = this.data.notifications.map(n => n.userId === userId ? { ...n, read: true } : n);
    this.persist();
  }

  // --- ACTIVITIES ---
  public getActivities(): ActivityEntry[] {
    return this.data.activities.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public logActivity(userId: string, userName: string, action: string, targetId?: string): ActivityEntry {
    const entry: ActivityEntry = {
      id: 'a-' + uid(),
      userId,
      userName,
      action,
      targetId,
      createdAt: ts()
    };
    this.data.activities.push(entry);
    this.persist();
    return entry;
  }

  public getUserActivity(userId: string): ActivityEntry[] {
    return this.data.activities
      .filter(a => a.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // --- PAYMENTS ---
  public recordPayment(payment: Omit<PaymentTransaction, 'id' | 'createdAt'>): PaymentTransaction {
    const entry: PaymentTransaction = {
      id: 'pay-' + uid(),
      ...payment,
      createdAt: ts()
    };
    this.data.payments.push(entry);
    this.persist();
    return entry;
  }

  public getPayments(): PaymentTransaction[] {
    return this.data.payments;
  }
}

export const db = new Database();
