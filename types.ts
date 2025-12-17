export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  pos: Position;
  direction: 'front' | 'back' | 'left' | 'right';
  isMoving: boolean;
  message?: string;
  messageTimer?: number;
  color?: string; // Hex color for gopher body customization (e.g., "#FF6B6B")
}

export interface CollisionArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}