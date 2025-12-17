// WebSocket server with static file serving (if you want to serve frontend from Fly.io)
// This is optional - GitHub Pages is recommended for frontend

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// MIME types for proper file serving
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

// Create HTTP server
const server = http.createServer((req, res) => {
  // Handle WebSocket upgrade
  if (req.headers.upgrade === 'websocket') {
    return; // Let WebSocket server handle it
  }

  // Serve static files from dist directory (if frontend is built)
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './dist/index.html';
  } else if (!filePath.startsWith('./dist/')) {
    filePath = './dist' + req.url;
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found, try index.html
        fs.readFile('./dist/index.html', (err, content) => {
          if (err) {
            res.writeHead(404);
            res.end('File not found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// WebSocket server
const wss = new WebSocket.Server({ server });

const players = new Map();

console.log(`Server running on port ${PORT}`);

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
          
          broadcast({ type: 'player_join', player: msg.player }, ws);
          
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

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket URL: wss://${process.env.FLY_APP_NAME || 'localhost'}.fly.dev`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  wss.close();
  server.close();
});

