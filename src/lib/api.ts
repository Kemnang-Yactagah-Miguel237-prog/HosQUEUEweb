import type { User, Service, Ticket, Notification, ActivityEntry } from './db';

const API_BASE = '/api';

export interface WSMessage {
  type: string;
  payload: any;
  timestamp: string;
}

// Token helpers
export function getToken(): string | null {
  return localStorage.getItem('hq_token') || sessionStorage.getItem('hq_token');
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem('hq_token', token);
    sessionStorage.setItem('hq_token', token);
  } else {
    localStorage.removeItem('hq_token');
    sessionStorage.removeItem('hq_token');
  }
}

// HTTP request wrapper
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Erreur HTTP ${response.status}`;
    const err = new Error(errorMsg);
    (err as any).code = data.code;
    (err as any).status = response.status;
    throw err;
  }

  return data as T;
}

// WebSocket client
type WSCallback = (msg: WSMessage) => void;
const wsListeners = new Set<WSCallback>();
let wsInstance: WebSocket | null = null;
let reconnectTimeout: any = null;

export function subscribeWS(callback: WSCallback): () => void {
  wsListeners.add(callback);

  if (!wsInstance || wsInstance.readyState === WebSocket.CLOSED || wsInstance.readyState === WebSocket.CLOSING) {
    connectWS();
  }

  return () => {
    wsListeners.delete(callback);
  };
}

function connectWS() {
  if (wsInstance && (wsInstance.readyState === WebSocket.OPEN || wsInstance.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws`;

  try {
    wsInstance = new WebSocket(wsUrl);

    wsInstance.onopen = () => {
      console.log('⚡ Connecté au WebSocket HosQUEUE');
    };

    wsInstance.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        wsListeners.forEach(fn => fn(msg));
      } catch (err) {
        console.error('Erreur parsing message WS:', err);
      }
    };

    wsInstance.onclose = () => {
      wsInstance = null;
      clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(connectWS, 3000);
    };

    wsInstance.onerror = () => {
      if (wsInstance) wsInstance.close();
    };
  } catch (err) {
    console.warn('Impossible de se connecter au WebSocket:', err);
  }
}

// Exported API Client
export const api = {
  // Auth
  auth: {
    login: async (email: string, password: string) => {
      const res = await request<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
      return res;
    },
    registerFirstAdmin: async (name: string, email: string, password: string) => {
      const res = await request<{ user: User; token: string }>('/auth/register-first-admin', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      setToken(res.token);
      return res;
    },
    getMe: async () => {
      return request<{ user: User }>('/auth/me');
    },
    hasAdmin: async () => {
      return request<{ hasAdmin: boolean }>('/auth/has-admin');
    },
    logout: async () => {
      try {
        await request('/auth/logout', { method: 'POST' });
      } catch {
        // Continue logout even if offline
      }
      setToken(null);
    },
  },

  // Services
  services: {
    getAll: () => request<Service[]>('/services'),
    getById: (id: string) => request<Service>(`/services/${id}`),
    create: (data: Omit<Service, 'id' | 'nextNumber'>) => request<Service>('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id: string, updates: Partial<Service>) => request<Service>(`/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
    delete: (id: string) => request<{ success: boolean }>(`/services/${id}`, {
      method: 'DELETE',
    }),
  },

  // Tickets
  tickets: {
    getAll: (params?: { serviceId?: string; patientId?: string; status?: string; today?: boolean }) => {
      const query = new URLSearchParams();
      if (params?.serviceId) query.set('serviceId', params.serviceId);
      if (params?.patientId) query.set('patientId', params.patientId);
      if (params?.status) query.set('status', params.status);
      if (params?.today) query.set('today', 'true');
      const qs = query.toString();
      return request<Ticket[]>(`/tickets${qs ? `?${qs}` : ''}`);
    },
    getById: (id: string) => request<Ticket>(`/tickets/${id}`),
    getPosition: (id: string) => request<{ position: number; estimatedWaitMinutes: number }>(`/tickets/${id}/position`),
    create: (serviceId: string) => request<Ticket>('/tickets', {
      method: 'POST',
      body: JSON.stringify({ serviceId }),
    }),
    callNext: (serviceId?: string) => request<Ticket>('/tickets/call-next', {
      method: 'POST',
      body: JSON.stringify({ serviceId }),
    }),
    serve: (id: string) => request<Ticket>(`/tickets/${id}/serve`, {
      method: 'POST',
    }),
    skip: (id: string) => request<Ticket>(`/tickets/${id}/skip`, {
      method: 'POST',
    }),
    cancel: (id: string) => request<Ticket>(`/tickets/${id}/cancel`, {
      method: 'POST',
    }),
  },

  // Payments
  payments: {
    initiate: (ticketId: string, phoneNumber: string, provider: string) =>
      request<{ message: string; transaction: any }>('/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({ ticketId, phoneNumber, provider }),
      }),
    confirm: (ticketId: string, paymentRef?: string, phoneNumber?: string, provider?: string) =>
      request<{ ticket: Ticket; paymentRef: string }>(`/payments/${ticketId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ paymentRef, phoneNumber, provider }),
      }),
  },

  // Users
  users: {
    getAll: () => request<User[]>('/users'),
    getById: (id: string) => request<User>(`/users/${id}`),
    create: (data: { name: string; email: string; password?: string; role: string; serviceId?: string }) =>
      request<{ user: User; generatedPassword?: string }>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, updates: Partial<User>) => request<User>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
    delete: (id: string) => request<{ success: boolean }>(`/users/${id}`, {
      method: 'DELETE',
    }),
    getActivity: (userId: string) => request<ActivityEntry[]>(`/users/${userId}/activity`),
  },

  // Notifications
  notifications: {
    getAll: () => request<Notification[]>('/notifications'),
    markRead: (id: string) => request<{ success: boolean }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),
    markAllRead: () => request<{ success: boolean }>('/notifications/mark-all-read', {
      method: 'POST',
    }),
    create: (userId: string, messageFr: string, messageEn: string, type?: string) =>
      request<Notification>('/notifications', {
        method: 'POST',
        body: JSON.stringify({ userId, messageFr, messageEn, type }),
      }),
  },

  // Activities & Stats
  activities: {
    getAll: (userId?: string) => request<ActivityEntry[]>(`/activities${userId ? `?userId=${userId}` : ''}`),
    log: (action: string, targetId?: string) => request<ActivityEntry>('/activities', {
      method: 'POST',
      body: JSON.stringify({ action, targetId }),
    }),
  },
  stats: {
    get: () => request<any>('/stats'),
  },
};
