// Full-stack server: WebSocket + Static file serving for Fly.io
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Parse PORT - ensure it's a number
// Render automatically provides PORT, don't override it
const PORT = parseInt(process.env.PORT || '10000', 10); // Render default is 10000
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error('❌ Invalid PORT environment variable:', process.env.PORT);
  console.error('PORT must be a number between 1 and 65535');
  process.exit(1);
}
console.log(`PORT environment variable value: "${process.env.PORT}" (parsed as ${PORT})`);

// Root directory (parent of server/)
const rootDir = path.resolve(__dirname, '..');

// Map dimensions - must match client constants.ts
const MAP_WIDTH = 1536;
const MAP_HEIGHT = 1024;

// MIME types for proper file serving
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.ts': 'application/typescript',
  '.tsx': 'application/typescript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.webp': 'image/webp'
};

// Create HTTP server
const server = http.createServer((req, res) => {
  // Health check endpoint for Render (before other processing)
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', port: PORT, timestamp: new Date().toISOString() }));
    return;
  }

  // WebSocket upgrade requests are handled by the WebSocket server
  // Don't process them here

  // Log request for debugging
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Determine file path - files are in dist/ after build (in parent directory)
  let urlPath = req.url.split('?')[0]; // Remove query strings
  if (urlPath === '/') {
    urlPath = '/index.html';
  }
  
  // dist/ is in the parent directory (root of project)
  let filePath = path.join(rootDir, 'dist', urlPath);
  
  // Security: prevent directory traversal
  const distPath = path.resolve(rootDir, 'dist');
  const resolvedPath = path.resolve(filePath);
  
  if (!resolvedPath.startsWith(distPath)) {
    console.warn(`Security: Blocked path traversal attempt: ${req.url}`);
    filePath = path.join(rootDir, 'dist', 'index.html');
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    // Try public folder for assets (also in root)
    const publicPath = path.join(rootDir, 'public', urlPath);
    if (fs.existsSync(publicPath)) {
      filePath = publicPath;
    } else {
      // Fallback to index.html for SPA routing
      filePath = path.join(rootDir, 'dist', 'index.html');
    }
  } else {
    // Check if it's a directory
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(rootDir, 'dist', 'index.html');
      }
    } catch (e) {
      filePath = path.join(rootDir, 'dist', 'index.html');
    }
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found, serve index.html for SPA routing
        const indexPath = path.join(rootDir, 'dist', 'index.html');
        fs.readFile(indexPath, (err, htmlContent) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found: ' + filePath);
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(htmlContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error: ' + error.code);
      }
    } else {
      // Set proper headers
      const headers = { 'Content-Type': contentType };
      
      // Add cache headers for static assets
      if (extname.match(/\.(jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        headers['Cache-Control'] = 'public, max-age=31536000';
      }
      
      res.writeHead(200, headers);
      res.end(content, 'utf-8');
    }
  });
});

// WebSocket server
const wss = new WebSocket.Server({ server });

const players = new Map(); // Map<playerId, playerData>
const wsToPlayerId = new Map(); // Map<WebSocket, playerId> - track which WS belongs to which player
const lastUpdateTime = new Map(); // Map<playerId, timestamp> - rate limiting
const UPDATE_RATE_LIMIT = 16; // Minimum 16ms between updates (60fps max)

// Generate unique player ID
function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.random().toString(36).substr(2, 9)}`;
}

console.log(`Server starting on port ${PORT}`);

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection from:', req.socket.remoteAddress);
  let playerId = null;

  // Send ping to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000); // Every 30 seconds

  ws.on('pong', () => {
    // Client responded to ping
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      
      switch (msg.type) {
        case 'player_join':
          // Server assigns unique ID - ignore client-provided ID
          if (!playerId) {
            playerId = generatePlayerId();
            wsToPlayerId.set(ws, playerId);
            console.log(`Assigned player ID: ${playerId} to connection from ${req.socket.remoteAddress}`);
          }
          
          // Create player object with server-assigned ID
          const playerData = {
            id: playerId,
            name: msg.player.name || 'Player',
            pos: msg.player.pos || { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }, // Default to center of map
            direction: msg.player.direction || 'front',
            isMoving: msg.player.isMoving || false,
            color: msg.player.color !== undefined && msg.player.color !== null && msg.player.color !== '' 
              ? msg.player.color 
              : undefined // Preserve color if provided, otherwise undefined
          };
          
          players.set(playerId, playerData);
          console.log(`Player joined: ${playerId} (${playerData.name})`, `Color: ${playerData.color}`);
          
          // Send assigned ID back to client
          ws.send(JSON.stringify({
            type: 'player_id_assigned',
            playerId: playerId,
            player: playerData
          }));
          
          // Broadcast to all OTHER clients (exclude the sender)
          broadcast({ type: 'player_join', player: playerData }, ws);
          
          // Send current players to new client (excluding themselves)
          const otherPlayers = Array.from(players.values()).filter(p => p.id !== playerId);
          // Ensure all player data including colors are included
          console.log(`Sending ${otherPlayers.length} players to new client`, 
            otherPlayers.map(p => ({ id: p.id, name: p.name, color: p.color })));
          ws.send(JSON.stringify({ 
            type: 'players_sync', 
            players: otherPlayers
          }));
          break;
        
        case 'player_move':
          // Use the server-assigned playerId for this connection
          const movePlayerId = playerId || wsToPlayerId.get(ws);
          // Security: Only allow movement for the player assigned to this connection
          if (movePlayerId && players.has(movePlayerId)) {
            // Validate that the message playerId matches the connection's assigned ID
            if (msg.playerId && msg.playerId !== movePlayerId) {
              console.warn(`Player ${movePlayerId} attempted to move as ${msg.playerId}, ignoring`);
              break;
            }
            
            // Rate limiting: prevent spam
            const now = Date.now();
            const lastUpdate = lastUpdateTime.get(movePlayerId) || 0;
            if (now - lastUpdate < UPDATE_RATE_LIMIT) {
              // Too frequent, ignore this update
              break;
            }
            lastUpdateTime.set(movePlayerId, now);
            
            const currentPlayer = players.get(movePlayerId);
            
            // Handle delta-compressed updates
            let validPos;
            if (msg.dx !== undefined && msg.dy !== undefined) {
              // Delta update: add to current position
              validPos = {
                x: Math.max(0, Math.min(MAP_WIDTH, currentPlayer.pos.x + msg.dx)),
                y: Math.max(0, Math.min(MAP_HEIGHT, currentPlayer.pos.y + msg.dy))
              };
            } else if (msg.pos) {
              // Full position update
              validPos = {
                x: Math.max(0, Math.min(MAP_WIDTH, msg.pos.x)),
                y: Math.max(0, Math.min(MAP_HEIGHT, msg.pos.y))
              };
            } else {
              // Invalid message format
              break;
            }
            
            // Server-side validation: check if movement is valid (basic collision check)
            // In a full implementation, you'd validate against server-side collision map
            const updatedPlayer = { 
              ...currentPlayer, 
              pos: validPos, 
              direction: msg.direction, 
              isMoving: msg.isMoving 
            };
            players.set(movePlayerId, updatedPlayer);
            
            // Broadcast with server timestamp for lag compensation
            // Always send full position (clients handle delta compression on receive)
            broadcast({ 
              type: 'player_move', 
              playerId: movePlayerId,
              pos: validPos,
              direction: msg.direction,
              isMoving: msg.isMoving,
              seq: msg.seq,
              timestamp: now
            }, ws);
          } else {
            console.warn(`Movement from unregistered player: ${movePlayerId || 'unknown'}`);
          }
          break;
        
        case 'chat':
          // Use server-assigned playerId and include player name from server registry
          const chatPlayerId = playerId || wsToPlayerId.get(ws);
          if (chatPlayerId && players.has(chatPlayerId)) {
            const chatPlayer = players.get(chatPlayerId);
            broadcast({ 
              type: 'chat', 
              playerId: chatPlayerId,
              playerName: chatPlayer.name, // Include name from server registry
              message: msg.message 
            }, ws);
          } else {
            console.warn(`Chat from unregistered player: ${chatPlayerId || 'unknown'}`);
          }
          break;
        
        case 'player_update':
          // Use server-assigned playerId
          const updatePlayerId = playerId || wsToPlayerId.get(ws);
          if (updatePlayerId && players.has(updatePlayerId)) {
            // Security: Only allow updates for the player assigned to this connection
            if (msg.player.id && msg.player.id !== updatePlayerId) {
              console.warn(`Player ${updatePlayerId} attempted to update as ${msg.player.id}, ignoring`);
              break;
            }
            
            const currentPlayer = players.get(updatePlayerId);
            // Only update name, color, and other non-position data (position comes from player_move)
            const updatedPlayer = {
              ...currentPlayer,
              name: msg.player.name || currentPlayer.name,
              color: msg.player.color !== undefined ? msg.player.color : currentPlayer.color,
              direction: msg.player.direction || currentPlayer.direction,
              isMoving: msg.player.isMoving !== undefined ? msg.player.isMoving : currentPlayer.isMoving
            };
            players.set(updatePlayerId, updatedPlayer);
            broadcast({ type: 'player_update', player: updatedPlayer }, ws);
          }
          break;
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  });

  ws.on('close', (code, reason) => {
    clearInterval(pingInterval);
    const leavingPlayerId = playerId || wsToPlayerId.get(ws);
    if (leavingPlayerId) {
      console.log(`Player left: ${leavingPlayerId} (code: ${code}, reason: ${reason})`);
      players.delete(leavingPlayerId);
      wsToPlayerId.delete(ws);
      broadcast({ type: 'player_leave', playerId: leavingPlayerId }, ws);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Optimized broadcast with batching for high-frequency updates
const movementUpdates = new Map(); // Map<client, latestUpdate>
let broadcastTimer = null;

function broadcast(message, excludeWs) {
  // For high-frequency movement updates, batch them to reduce network overhead
  if (message.type === 'player_move') {
    // Store the latest update for each client
    wss.clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        if (!movementUpdates.has(client)) {
          movementUpdates.set(client, []);
        }
        movementUpdates.get(client).push(message);
      }
    });
    
    // Start batching timer if not already running
    if (!broadcastTimer) {
      broadcastTimer = setInterval(() => {
        // Send batched updates every 16ms (60fps max)
        movementUpdates.forEach((updates, client) => {
          if (client.readyState === WebSocket.OPEN && updates.length > 0) {
            // Send all pending updates for this client
            if (updates.length === 1) {
              client.send(JSON.stringify(updates[0]));
            } else {
              // Batch multiple updates
              client.send(JSON.stringify({ type: 'batch', updates }));
            }
            updates.length = 0; // Clear the queue
          }
        });
        
        // Clean up if no more updates
        let hasUpdates = false;
        movementUpdates.forEach((updates) => {
          if (updates.length > 0) hasUpdates = true;
        });
        if (!hasUpdates) {
          clearInterval(broadcastTimer);
          broadcastTimer = null;
        }
      }, 16); // 60fps batching
    }
  } else {
    // Non-movement messages: send immediately (chat, joins, etc.)
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}

// Start the server
console.log(`Starting server on port ${PORT}, binding to 0.0.0.0...`);
console.log(`PORT environment variable: ${process.env.PORT || 'not set (using default 10000)'}`);

server.listen(PORT, '0.0.0.0', () => {
  const address = server.address();
  console.log(`✅ Server successfully bound to ${address.address}:${address.port}`);
  console.log(`✅ Listening on 0.0.0.0:${PORT}`);
  console.log(`Working directory: ${__dirname}`);
  console.log(`Root directory: ${rootDir}`);
  console.log(`Dist directory exists: ${fs.existsSync(path.join(rootDir, 'dist'))}`);
  if (fs.existsSync(path.join(rootDir, 'dist'))) {
    const distFiles = fs.readdirSync(path.join(rootDir, 'dist'));
    console.log(`Dist files: ${distFiles.slice(0, 10).join(', ')}...`);
  }
  const appName = process.env.RENDER_SERVICE_NAME || process.env.FLY_APP_NAME || 'localhost';
  const protocol = process.env.RENDER ? 'https' : 'http';
  const wsProtocol = process.env.RENDER ? 'wss' : 'ws';
  const domain = process.env.RENDER_EXTERNAL_URL 
    ? new URL(process.env.RENDER_EXTERNAL_URL).hostname 
    : `${appName}.onrender.com`;
  console.log(`Frontend: ${protocol}://${domain}`);
  console.log(`WebSocket: ${wsProtocol}://${domain}`);
  
  // Keep process alive
  console.log('Server is ready to accept connections');
});

// Add error handlers
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Keep server alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  wss.close();
  server.close();
});
