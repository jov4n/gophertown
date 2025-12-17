# WebSocket Setup for Multiplayer

This game uses WebSocket for real-time multiplayer functionality. Since GitHub Pages only serves static files, you'll need to host the WebSocket server separately.

## Setup Options

### Option 1: Railway (Recommended)
1. Create a new Railway project
2. Deploy a Node.js WebSocket server
3. Set the `VITE_WS_URL` environment variable to your Railway WebSocket URL (e.g., `wss://your-app.railway.app`)

### Option 2: Render
1. Create a new Web Service on Render
2. Deploy your WebSocket server
3. Update `WS_URL` in `constants.ts` to point to your Render WebSocket URL

### Option 3: Fly.io
1. Deploy your WebSocket server to Fly.io
2. Update `WS_URL` in `constants.ts` to your Fly.io WebSocket URL

### Option 4: Local Development
For local development, the default WebSocket URL is `ws://localhost:3001`. You'll need to run a WebSocket server on that port.

## WebSocket Server Requirements

Your WebSocket server should handle these message types:

### Client → Server Messages:
- `{ type: 'player_join', player: PlayerData }` - When a player joins
- `{ type: 'player_move', playerId: string, pos: {x, y}, direction: string, isMoving: boolean }` - Player movement updates
- `{ type: 'chat', playerId: string, message: string }` - Chat messages
- `{ type: 'player_update', player: PlayerData }` - Player info updates

### Server → Client Messages:
- `{ type: 'player_join', player: PlayerData }` - Broadcast when a new player joins
- `{ type: 'player_move', playerId: string, pos: {x, y}, direction: string, isMoving: boolean }` - Broadcast player movement
- `{ type: 'player_leave', playerId: string }` - When a player disconnects
- `{ type: 'chat', playerId: string, message: string }` - Broadcast chat messages
- `{ type: 'players_sync', players: PlayerData[] }` - Send all current players to a newly connected client

## Example WebSocket Server (Node.js)

```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3001 });

const players = new Map();

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    
    switch (msg.type) {
      case 'player_join':
        playerId = msg.player.id;
        players.set(playerId, msg.player);
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
          players.set(msg.playerId, { 
            ...players.get(msg.playerId), 
            pos: msg.pos, 
            direction: msg.direction, 
            isMoving: msg.isMoving 
          });
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
  });

  ws.on('close', () => {
    if (playerId) {
      players.delete(playerId);
      broadcast({ type: 'player_leave', playerId }, ws);
    }
  });
});

function broadcast(message, excludeWs) {
  wss.clients.forEach((client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}
```

## Environment Variables

Create a `.env` file in your project root:
```
VITE_WS_URL=wss://your-websocket-server.com
```

Or set it in your hosting platform's environment variables.

## Testing Without WebSocket Server

If no WebSocket server is available, the game will still work in single-player mode. Players just won't see other players or receive chat messages from them.

