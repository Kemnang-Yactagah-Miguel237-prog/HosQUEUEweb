import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

export type WSEventType =
  | 'TICKET_CREATED'
  | 'TICKET_CALLED'
  | 'TICKET_SERVED'
  | 'TICKET_SKIPPED'
  | 'TICKET_CANCELLED'
  | 'PAYMENT_CONFIRMED'
  | 'NOTIFICATION_CREATED'
  | 'SERVICE_UPDATED'
  | 'QUEUE_UPDATED';

export interface WSMessage {
  type: WSEventType;
  payload: any;
  timestamp: string;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial connection acknowledgement
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        payload: { message: 'HosQUEUE WebSocket connected' },
        timestamp: new Date().toISOString()
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
        this.clients.delete(ws);
      });
    });

    console.log('⚡ WebSocket server mounted at /ws');
  }

  public broadcast(type: WSEventType, payload: any) {
    if (!this.wss) return;

    const message: WSMessage = {
      type,
      payload,
      timestamp: new Date().toISOString()
    };

    const data = JSON.stringify(message);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
}

export const wsManager = new WebSocketManager();
