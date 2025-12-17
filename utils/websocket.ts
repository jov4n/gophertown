// WebSocket client for multiplayer functionality
// Note: For GitHub Pages, you'll need a separate WebSocket server
// Options: Railway, Render, Fly.io, or any Node.js hosting service

export type WebSocketMessage = 
  | { type: 'player_join'; player: PlayerData; seq?: number; timestamp?: number }
  | { type: 'player_id_assigned'; playerId: string; player: PlayerData; seq?: number; timestamp?: number }
  | { type: 'player_move'; playerId: string; pos?: { x: number; y: number }; dx?: number; dy?: number; direction: string; isMoving: boolean; seq?: number; timestamp?: number }
  | { type: 'player_leave'; playerId: string; seq?: number; timestamp?: number }
  | { type: 'chat'; playerId: string; playerName?: string; message: string; seq?: number; timestamp?: number }
  | { type: 'player_update'; player: PlayerData; seq?: number; timestamp?: number }
  | { type: 'players_sync'; players: PlayerData[]; seq?: number; timestamp?: number }
  | { type: 'server_state'; players: PlayerData[]; seq: number; timestamp: number }
  | { type: 'batch'; updates: WebSocketMessage[] };

export interface PlayerData {
  id: string;
  name: string;
  pos: { x: number; y: number };
  direction: 'front' | 'back' | 'left' | 'right';
  isMoving: boolean;
  message?: string;
  color?: string; // Hex color for gopher body customization
}

export class GameWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private url: string;
  private onMessageHandlers: ((msg: WebSocketMessage) => void)[] = [];
  private onConnectHandlers: (() => void)[] = [];
  private onDisconnectHandlers: (() => void)[] = [];

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    // Don't reconnect if already connecting/connected
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.onConnectHandlers.forEach(handler => handler());
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.onMessageHandlers.forEach(handler => handler(message));
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        this.ws = null;
        this.onDisconnectHandlers.forEach(handler => handler());
        
        // Only reconnect if it wasn't a manual close
        if (event.code !== 1000) {
          this.attemptReconnect();
        }
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      this.ws = null;
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts} in ${delay}ms)`);
      setTimeout(() => {
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
          this.connect();
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  send(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Add timestamp to all outgoing messages
      const messageWithTimestamp = {
        ...message,
        timestamp: Date.now()
      };
      this.ws.send(JSON.stringify(messageWithTimestamp));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }
  
  // Send with binary protocol for better performance (optional optimization)
  sendBinary(data: ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  onMessage(handler: (msg: WebSocketMessage) => void) {
    this.onMessageHandlers.push(handler);
  }

  onConnect(handler: () => void) {
    this.onConnectHandlers.push(handler);
  }

  onDisconnect(handler: () => void) {
    this.onDisconnectHandlers.push(handler);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

