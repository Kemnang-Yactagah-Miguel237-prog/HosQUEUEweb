export type Role = 'admin' | 'medical' | 'patient';
export type TicketStatus = 'pending_payment' | 'waiting' | 'called' | 'served' | 'skipped' | 'cancelled';
export type NotifType = 'account_created' | 'payment_confirmed' | 'turn_soon' | 'your_turn' | 'general';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  serviceId?: string;
  suspended: boolean;
  createdAt: string;
  createdBy?: string;
  lastLogin?: string;
}

export interface Service {
  id: string;
  nameFr: string;
  nameEn: string;
  capacity: number;
  bookingFee: number;
  active: boolean;
  nextNumber: number;
}

export interface Ticket {
  id: string;
  number: string;
  patientId: string;
  patientName: string;
  serviceId: string;
  status: TicketStatus;
  createdAt: string;
  calledAt?: string;
  servedAt?: string;
  paymentRef?: string;
}

export interface Notification {
  id: string;
  userId: string;
  messageFr: string;
  messageEn: string;
  read: boolean;
  createdAt: string;
  type: NotifType;
}

export interface ActivityEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetId?: string;
  createdAt: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const ts = () => new Date().toISOString();

const KEYS = {
  users: 'hq_users',
  services: 'hq_services',
  tickets: 'hq_tickets',
  notifications: 'hq_notifications',
  activity: 'hq_activity',
  initialized: 'hq_init',
};

function load<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function save<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

const SEED_USERS: User[] = [
  { id: 'u-med1', name: 'Dr. Marie Martin', email: 'dr.martin@hosqueue.com', password: 'Staff@123', role: 'medical', serviceId: 'svc-1', suspended: false, createdAt: '2025-01-02T08:00:00Z', createdBy: 'u-admin' },
  { id: 'u-med2', name: 'Dr. Ibrahim Koné', email: 'dr.kone@hosqueue.com', password: 'Staff@123', role: 'medical', serviceId: 'svc-2', suspended: false, createdAt: '2025-01-02T09:00:00Z', createdBy: 'u-admin' },
  { id: 'u-pat1', name: 'Jean Dupont', email: 'jean.dupont@hosqueue.com', password: 'Patient@123', role: 'patient', suspended: false, createdAt: '2025-01-03T08:00:00Z', createdBy: 'u-admin' },
  { id: 'u-pat2', name: 'Aissatou Bah', email: 'aissatou.bah@hosqueue.com', password: 'Patient@123', role: 'patient', suspended: false, createdAt: '2025-01-03T09:00:00Z', createdBy: 'u-admin' },
  { id: 'u-pat3', name: 'Mamadou Diallo', email: 'm.diallo@hosqueue.com', password: 'Patient@123', role: 'patient', suspended: false, createdAt: '2025-01-03T10:00:00Z', createdBy: 'u-admin' },
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

export function initDB() {
  if (localStorage.getItem(KEYS.initialized)) {
    const users = getUsers();
    const legacyAdmin = users.find(user => user.id === 'u-admin' && user.email === 'admin@hosqueue.com');
    if (legacyAdmin) save(KEYS.users, users.filter(user => user.id !== legacyAdmin.id));
    return;
  }
  save(KEYS.users, SEED_USERS);
  save(KEYS.services, SEED_SERVICES);
  save(KEYS.tickets, makeSeedTickets());
  save(KEYS.notifications, []);
  save(KEYS.activity, []);
  localStorage.setItem(KEYS.initialized, '1');
}

export function resetDB() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

// Users
export function getUsers(): User[] { return load<User>(KEYS.users); }
export function getUserById(id: string): User | undefined { return getUsers().find(u => u.id === id); }
export function getUserByEmail(email: string): User | undefined { return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase()); }

export function createUser(data: Omit<User, 'id' | 'createdAt' | 'suspended'>): { user: User; password: string } {
  const users = getUsers();
  const password = data.password || generatePassword();
  const user: User = { ...data, id: 'u-' + uid(), createdAt: ts(), suspended: false, password };
  save(KEYS.users, [...users, user]);
  return { user, password };
}

export function updateUser(id: string, updates: Partial<User>): User | null {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx < 0) return null;
  users[idx] = { ...users[idx], ...updates };
  save(KEYS.users, users);
  return users[idx];
}

export function deleteUser(id: string): boolean {
  const users = getUsers();
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) return false;
  save(KEYS.users, filtered);
  return true;
}

export function generatePassword(): string {
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

// Services
export function getServices(): Service[] { return load<Service>(KEYS.services); }
export function getServiceById(id: string): Service | undefined { return getServices().find(s => s.id === id); }

export function createService(data: Omit<Service, 'id' | 'nextNumber'>): Service {
  const services = getServices();
  const svc: Service = { ...data, id: 'svc-' + uid(), nextNumber: 1 };
  save(KEYS.services, [...services, svc]);
  return svc;
}

export function updateService(id: string, updates: Partial<Service>): Service | null {
  const services = getServices();
  const idx = services.findIndex(s => s.id === id);
  if (idx < 0) return null;
  services[idx] = { ...services[idx], ...updates };
  save(KEYS.services, services);
  return services[idx];
}

export function deleteService(id: string): boolean {
  const services = getServices().filter(s => s.id !== id);
  save(KEYS.services, services);
  return true;
}

// Tickets
export function getTickets(): Ticket[] { return load<Ticket>(KEYS.tickets); }
export function getTicketById(id: string): Ticket | undefined { return getTickets().find(t => t.id === id); }
export function getTicketsByService(serviceId: string): Ticket[] { return getTickets().filter(t => t.serviceId === serviceId); }
export function getTicketsByPatient(patientId: string): Ticket[] { return getTickets().filter(t => t.patientId === patientId); }

export function getWaitingTickets(serviceId: string): Ticket[] {
  return getTicketsByService(serviceId).filter(t => t.status === 'waiting').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getCalledTicket(serviceId: string): Ticket | undefined {
  return getTicketsByService(serviceId).find(t => t.status === 'called');
}

export function getTodayTickets(serviceId: string): Ticket[] {
  const today = new Date().toDateString();
  return getTicketsByService(serviceId).filter(t => new Date(t.createdAt).toDateString() === today);
}

function getServicePrefix(service: Service): string {
  const n = service.nameFr.replace(/[aeiouàâéèêëîïôùûü\s]/gi, '').slice(0, 3).toUpperCase();
  return n || 'SVC';
}

export function createTicket(patientId: string, patientName: string, serviceId: string): Ticket {
  const tickets = getTickets();
  const service = getServiceById(serviceId);
  if (!service) throw new Error('Service not found');
  const prefix = getServicePrefix(service);
  const number = `${prefix}-${String(service.nextNumber).padStart(3, '0')}`;
  updateService(serviceId, { nextNumber: service.nextNumber + 1 });
  const ticket: Ticket = { id: 'tk-' + uid(), number, patientId, patientName, serviceId, status: 'pending_payment', createdAt: ts() };
  save(KEYS.tickets, [...tickets, ticket]);
  return ticket;
}

export function updateTicket(id: string, updates: Partial<Ticket>): Ticket | null {
  const tickets = getTickets();
  const idx = tickets.findIndex(t => t.id === id);
  if (idx < 0) return null;
  tickets[idx] = { ...tickets[idx], ...updates };
  save(KEYS.tickets, tickets);
  return tickets[idx];
}

export function confirmPayment(ticketId: string): Ticket | null {
  const ref = 'PAY-' + uid().toUpperCase();
  return updateTicket(ticketId, { status: 'waiting', paymentRef: ref });
}

export function callNextPatient(serviceId: string): Ticket | null {
  const current = getCalledTicket(serviceId);
  if (current) return null; // must resolve current first
  const waiting = getWaitingTickets(serviceId);
  if (waiting.length === 0) return null;
  const next = waiting[0];
  return updateTicket(next.id, { status: 'called', calledAt: ts() });
}

export function markServed(ticketId: string): Ticket | null {
  return updateTicket(ticketId, { status: 'served', servedAt: ts() });
}

export function markSkipped(ticketId: string): Ticket | null {
  return updateTicket(ticketId, { status: 'skipped' });
}

export function getQueuePosition(ticketId: string): number {
  const ticket = getTicketById(ticketId);
  if (!ticket || ticket.status !== 'waiting') return 0;
  const waiting = getWaitingTickets(ticket.serviceId);
  return waiting.findIndex(t => t.id === ticketId) + 1;
}

export function getEstimatedWait(position: number): number {
  return position * 10; // 10 minutes per patient
}

// Notifications
export function getNotifications(): Notification[] { return load<Notification>(KEYS.notifications); }
export function getUserNotifications(userId: string): Notification[] {
  return getNotifications().filter(n => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function getUnreadCount(userId: string): number {
  return getUserNotifications(userId).filter(n => !n.read).length;
}

export function createNotification(userId: string, messageFr: string, messageEn: string, type: NotifType): Notification {
  const notifs = getNotifications();
  const n: Notification = { id: 'n-' + uid(), userId, messageFr, messageEn, read: false, createdAt: ts(), type };
  save(KEYS.notifications, [...notifs, n]);
  return n;
}

export function markNotificationRead(id: string) {
  const notifs = getNotifications();
  const idx = notifs.findIndex(n => n.id === id);
  if (idx >= 0) { notifs[idx].read = true; save(KEYS.notifications, notifs); }
}

export function markAllRead(userId: string) {
  const notifs = getNotifications().map(n => n.userId === userId ? { ...n, read: true } : n);
  save(KEYS.notifications, notifs);
}

// Activity
export function getActivity(): ActivityEntry[] { return load<ActivityEntry>(KEYS.activity); }

export function logActivity(userId: string, userName: string, action: string, targetId?: string) {
  const activity = getActivity();
  const entry: ActivityEntry = { id: 'a-' + uid(), userId, userName, action, targetId, createdAt: ts() };
  save(KEYS.activity, [...activity, entry]);
}

export function getUserActivity(userId: string): ActivityEntry[] {
  return getActivity().filter(a => a.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
