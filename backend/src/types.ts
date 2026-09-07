export type Role = 'admin' | 'medical' | 'patient';
export type TicketStatus = 'pending_payment' | 'waiting' | 'called' | 'served' | 'skipped' | 'cancelled';
export type NotifType = 'account_created' | 'payment_confirmed' | 'turn_soon' | 'your_turn' | 'general';
export type PaymentProvider = 'orange_money' | 'mtn_momo';
export type PaymentStatus = 'pending' | 'success' | 'failed';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // bcrypt hashed or plaintext fallback
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

export interface PaymentTransaction {
  id: string;
  ticketId: string;
  patientId: string;
  serviceId: string;
  amount: number;
  phoneNumber: string;
  provider: PaymentProvider;
  reference: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
  name: string;
}
