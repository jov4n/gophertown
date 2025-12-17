// Simple WebSocket server example for free hosting platforms
// Deploy this to Railway, Render, Fly.io, or any Node.js hosting service

const WebSocket = require('ws');

// Use PORT from environment variable (required by most hosting platforms)
const PORT = process.env.PORT || 3001;

const wss = new WebSocket.Server({ port: PORT });

const players = new Map();

console.log(`WebSocket server running on port ${PORT}`);

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      switch (msg.type) {
        case 'player_join':
          playerId = msg.player.id;
          players.set(playerId, msg.player);
          console.log(`Player joined: ${playerId} (${msg.player.name})`);
          
          // Broadcast to all clients
          broadcast({ type: 'player_join', player: msg.player }, ws);
          
          // Send current players to new client
          ws.send(JSON.stringify({ 
            type: 'players_sync', 
            players: Array.from(players.values()) 
          }));
          break;
        
        case 'player_move':
          if (players.has(msg.playerId)) {
            const updatedPlayer = { 
              ...players.get(msg.playerId), 
              pos: msg.pos, 
              direction: msg.direction, 
              isMoving: msg.isMoving 
            };
            players.set(msg.playerId, updatedPlayer);
            broadcast({ type: 'player_move', ...msg }, ws);
          }
          break;
        
        case 'chat':
          broadcast({ type: 'chat', ...msg }, ws);
          break;
        
        case 'player_update':
          if (players.has(msg.player.id)) {
            players.set(msg.player.id, msg.player);
            broadcast({ type: 'player_update', player: msg.player }, ws);
          }
          break;
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  });

  ws.on('close', () => {
    if (playerId) {
      console.log(`Player left: ${playerId}`);
      players.delete(playerId);
      broadcast({ type: 'player_leave', playerId }, ws);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

function broadcast(message, excludeWs) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Keep server alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  wss.close();
});

