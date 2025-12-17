import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, User, X, Settings } from 'lucide-react';
import { ASSETS, MAP_WIDTH, MAP_HEIGHT, MAP_IMAGE, WS_URL } from './constants';
import { Player, ChatMessage, CollisionArea } from './types';
import { Avatar } from './components/Avatar';
import { SpriteSelector } from './components/SpriteSelector';
import { GameWebSocket } from './utils/websocket';

// --- Utility Components ---
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }> = ({ children, className, variant = 'primary', ...props }) => {
  const baseClass = "flex items-center gap-2 px-4 py-2 rounded font-bold shadow-sm transition-transform active:scale-95 disabled:opacity-50 select-none";
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
    ghost: 'bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white shadow-none'
  };
  return (
    <button className={`${baseClass} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

// --- Main App ---
export default function App() {
  const [showNameInput, setShowNameInput] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showSpriteSelector, setShowSpriteSelector] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Load collision data from localStorage (pixel-based areas)
  const [collisions, setCollisions] = useState<CollisionArea[]>(() => {
    try {
      const stored = localStorage.getItem('mapCollisions');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load collisions:', e);
    }
    return [];
  });
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Player positions in map pixel coordinates
  const initialPos = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
  const [myPlayer, setMyPlayer] = useState<Player>(() => {
    const savedName = localStorage.getItem('playerName');
    const savedColor = localStorage.getItem('playerColor');
    return {
      id: 'me', 
      name: savedName || 'You', 
      pos: initialPos, 
      direction: 'front', 
      isMoving: false,
      color: savedColor || undefined // Load saved color or use default
    };
  });
  
  const moveQueue = useRef<{x:number, y:number}[]>([]);
  const isProcessingQueue = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const wsRef = useRef<GameWebSocket | null>(null);
  const lastPositionRef = useRef<{ x: number; y: number }>(initialPos);
  const keysPressed = useRef<Set<string>>(new Set());
  const playerPosRef = useRef<{ x: number; y: number }>(initialPos);
  
  // Multiplayer synchronization state
  const commandSequenceRef = useRef<number>(0);
  const pendingCommandsRef = useRef<Map<number, { pos: { x: number; y: number }, direction: string, isMoving: boolean, timestamp: number }>>(new Map());
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const networkUpdateIntervalRef = useRef<number>(0);
  
  // Interpolation state for other players
  const otherPlayersInterpolationRef = useRef<Map<string, {
    startPos: { x: number; y: number };
    targetPos: { x: number; y: number };
    startTime: number;
    duration: number;
    direction: string;
    isMoving: boolean;
    lastUpdateTime: number;
  }>>(new Map());
  
  const [otherPlayers, setOtherPlayers] = useState<Player[]>([]);
  
  // Sync playerPosRef when myPlayer.pos changes (for initial load)
  useEffect(() => {
    playerPosRef.current = { ...myPlayer.pos };
  }, []);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // -- Movement Logic --
  // Store collisions in ref to avoid dependency issues
  const collisionsRef = useRef<CollisionArea[]>(collisions);
  useEffect(() => {
    collisionsRef.current = collisions;
  }, [collisions]);
  
  // Check if a pixel position is walkable (checks character bounding box against pixel-based collision areas)
  // All coordinates are in map image pixel space (1536x1024)
  // Use ref to avoid dependency issues that restart animation loop
  const isWalkable = useCallback((pixelX: number, pixelY: number) => {
    const collisions = collisionsRef.current;
    // Character size (avatar is 64x64, but we'll check a slightly smaller area for better feel)
    const charSize = 48; // Check 48x48 area (slightly smaller than 64x64 for better feel)
    const charHalf = charSize / 2;
    
    // Character bounding box
    const charLeft = pixelX - charHalf;
    const charRight = pixelX + charHalf;
    const charTop = pixelY - charHalf;
    const charBottom = pixelY + charHalf;
    
    // Check bounds (map image dimensions)
    if (charLeft < 0 || charRight >= MAP_WIDTH || 
        charTop < 0 || charBottom >= MAP_HEIGHT) return false;
    
    // Check if character bounding box overlaps with any collision area
    for (const area of collisions) {
      const areaRight = area.x + area.width;
      const areaBottom = area.y + area.height;
      
      // Check for overlap between character box and collision area
      if (charLeft < areaRight && charRight > area.x &&
          charTop < areaBottom && charBottom > area.y) {
        return false;
      }
    }
    
    return true;
  }, []); // No dependencies - use ref instead

  const handleTapToMove = useCallback((pixelX: number, pixelY: number) => {
    // Check if target is walkable
    if (!isWalkable(pixelX, pixelY)) {
      return; // Can't move to unwalkable position
    }

    // Get current position from state (don't use myPlayer directly as it might be stale)
    setMyPlayer(prev => {
      const currentPos = prev.pos;
      const dx = pixelX - currentPos.x;
      const dy = pixelY - currentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If we're already very close, don't move
      if (distance < 2) {
        return prev;
      }
      
      // Clear any existing movement queue and add new target
      moveQueue.current = [{ x: pixelX, y: pixelY }];
      isProcessingQueue.current = true; // Start processing the queue
      
      // Send initial movement start via WebSocket immediately
      // The animation loop will send continuous updates after this
      if (wsRef.current?.isConnected()) {
        // Determine initial direction
        let direction = prev.direction;
        if (Math.abs(dx) > Math.abs(dy)) {
          direction = dx > 0 ? 'right' : 'left';
        } else {
          direction = dy > 0 ? 'front' : 'back';
        }
        
        // Send immediate update to start movement
        const seq = commandSequenceRef.current++;
        const now = Date.now();
        
        pendingCommandsRef.current.set(seq, {
          pos: { ...currentPos },
          direction: direction,
          isMoving: true,
          timestamp: now
        });
        
        wsRef.current.send({
          type: 'player_move',
          playerId: prev.id,
          pos: currentPos,
          direction: direction,
          isMoving: true,
          seq: seq
        });
        
        // Reset last update time to ensure continuous updates start immediately
        lastUpdateTimeRef.current = now;
        lastPositionRef.current = { ...currentPos };
      }
      
      return prev; // Don't change position here, let animation loop handle it
    });
  }, [isWalkable]);
  
  // -- Map Logic --
  const handleMapClick = useCallback((e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!mapContainerRef.current) return;
    
    // Don't handle clicks on input elements or their containers
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('input') || target.closest('textarea') || target.closest('form')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = mapContainerRef.current.getBoundingClientRect();
    
    // Get click coordinates relative to viewport
    let clientX: number;
    let clientY: number;
    
    if ('touches' in e && e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return; // Can't determine coordinates
    }
    
    // Calculate position relative to map container (including border)
    const borderWidth = 4;
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    
    // The container's actual rendered size (including border)
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    
    // The content area (after border) should match MAP_WIDTH x MAP_HEIGHT
    const contentWidth = containerWidth - (borderWidth * 2);
    const contentHeight = containerHeight - (borderWidth * 2);
    
    // Calculate position within the content area (subtract border offset)
    const contentX = relativeX - borderWidth;
    const contentY = relativeY - borderWidth;
    
    // Calculate scale factor - how much the content is scaled from actual map size
    // If the container is larger/smaller than MAP_WIDTH x MAP_HEIGHT, we need to scale
    const scaleX = contentWidth > 0 ? MAP_WIDTH / contentWidth : 1;
    const scaleY = contentHeight > 0 ? MAP_HEIGHT / contentHeight : 1;
    
    // Convert click position to map pixel coordinates
    let mapX = contentX * scaleX;
    let mapY = contentY * scaleY;
    
    // Clamp to map bounds (ensure coordinates are valid)
    mapX = Math.max(0, Math.min(MAP_WIDTH - 1, mapX));
    mapY = Math.max(0, Math.min(MAP_HEIGHT - 1, mapY));
    
    handleTapToMove(mapX, mapY);
  }, [handleTapToMove]);

  const handleCollisionsChange = (newCollisions: CollisionArea[]) => {
    setCollisions(newCollisions);
    // Save to localStorage
    localStorage.setItem('mapCollisions', JSON.stringify(newCollisions));
  };

  // Interpolation loop for other players (runs independently for smooth movement)
  // Use a ref to track if we should run interpolation
  const interpolationEnabledRef = useRef(false);
  
  useEffect(() => {
    // Enable interpolation after component is fully mounted
    interpolationEnabledRef.current = true;
    
    let frameId: number | null = null;
    let isRunning = true;
    
    let lastFrameTime = performance.now();
    
    const interpolateOthers = (currentTime: number) => {
      if (!isRunning || !interpolationEnabledRef.current) {
        if (frameId) cancelAnimationFrame(frameId);
        return;
      }
      
      // Calculate delta time for frame-rate independent interpolation
      const deltaTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;
      
      try {
        setOtherPlayers(prev => {
          // Guard: ensure we have valid state
          if (!prev || !Array.isArray(prev)) return prev;
          if (!otherPlayersInterpolationRef.current) return prev;
          
          // Optimize for many players: only process players with active interpolations
          const interpolations = otherPlayersInterpolationRef.current;
          if (interpolations.size === 0) return prev;
          
          let updated = false;
          const now = Date.now();
          
          // Use Map for O(1) lookups instead of find() for each player
          const playerMap = new Map(prev.map(p => [p.id, p]));
          const updatedPlayers = new Map<string, Player>();
          
          // Process only players with active interpolations (more efficient for many players)
          interpolations.forEach((interpolation, playerId) => {
            const p = playerMap.get(playerId);
            if (!p) {
              // Player no longer exists, clean up
              interpolations.delete(playerId);
              return;
            }
            
            const elapsed = now - interpolation.startTime;
            const progress = Math.min(elapsed / interpolation.duration, 1);
            
            // Use linear interpolation to match actual movement (constant speed)
            if (progress < 1) {
              // Linear interpolation for constant speed movement
              const newX = interpolation.startPos.x + (interpolation.targetPos.x - interpolation.startPos.x) * progress;
              const newY = interpolation.startPos.y + (interpolation.targetPos.y - interpolation.startPos.y) * progress;
              
              // Validate interpolated position is within bounds
              const clampedX = Math.max(0, Math.min(MAP_WIDTH - 1, newX));
              const clampedY = Math.max(0, Math.min(MAP_HEIGHT - 1, newY));
              
              updated = true;
              updatedPlayers.set(playerId, {
                ...p,
                pos: { x: clampedX, y: clampedY },
                direction: interpolation.direction as any,
                isMoving: interpolation.isMoving
              });
            } else {
              // Interpolation complete, snap to target
              const clampedX = Math.max(0, Math.min(MAP_WIDTH - 1, interpolation.targetPos.x));
              const clampedY = Math.max(0, Math.min(MAP_HEIGHT - 1, interpolation.targetPos.y));
              
              // If player stopped moving, remove interpolation immediately
              if (!interpolation.isMoving) {
                interpolations.delete(playerId);
                updated = true;
                updatedPlayers.set(playerId, {
                  ...p,
                  pos: { x: clampedX, y: clampedY },
                  direction: interpolation.direction as any,
                  isMoving: false
                });
              } else {
                // Only delete if we haven't received a new update recently
                const timeSinceLastUpdate = now - interpolation.lastUpdateTime;
                if (timeSinceLastUpdate > 150) {
                  interpolations.delete(playerId);
                }
                
                updated = true;
                updatedPlayers.set(playerId, {
                  ...p,
                  pos: { x: clampedX, y: clampedY },
                  direction: interpolation.direction as any,
                  isMoving: interpolation.isMoving
                });
              }
            }
          });
          
          // Only rebuild array if we have updates (optimization for many players)
          if (updated && updatedPlayers.size > 0) {
            return prev.map(p => updatedPlayers.get(p.id) || p);
          }
          
          return prev;
        });
      } catch (error) {
        console.error('Interpolation error:', error);
        isRunning = false;
        return;
      }
      
      if (isRunning) {
        frameId = requestAnimationFrame(interpolateOthers);
      }
    };
    
    // Start interpolation loop immediately
    if (isRunning && interpolationEnabledRef.current) {
      lastFrameTime = performance.now();
      frameId = requestAnimationFrame(interpolateOthers);
    }
    
    return () => {
      isRunning = false;
      interpolationEnabledRef.current = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  // Unified smooth pixel-based movement (handles both click-to-move and WASD)
  // CRITICAL: This must NEVER restart - use refs for all dependencies
  useEffect(() => {
    let isActive = true;
    
    const animate = () => {
      if (!isActive) return;
      
      // Always continue the animation loop
      animationFrameRef.current = requestAnimationFrame(animate);
      
      setMyPlayer(prev => {
        // Update ref to current position
        playerPosRef.current = { ...prev.pos };
        let newX = prev.pos.x;
        let newY = prev.pos.y;
        let newDirection = prev.direction;
        let isMoving = false;
        
        // Handle click-to-move
        if (moveQueue.current.length > 0 && isProcessingQueue.current) {
          const target = moveQueue.current[0];
          const dx = target.x - playerPosRef.current.x;
          const dy = target.y - playerPosRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 2) {
            // Reached target
            moveQueue.current.shift();
            if (moveQueue.current.length === 0) {
              isProcessingQueue.current = false;
              newX = target.x;
              newY = target.y;
              isMoving = false;
              
              // Send final position update via WebSocket
              if (wsRef.current?.isConnected()) {
                wsRef.current.send({
                  type: 'player_move',
                  playerId: prev.id,
                  pos: { x: newX, y: newY },
                  direction: prev.direction,
                  isMoving: false
                });
              }
            }
          } else {
            // Move towards target
            const speed = 2;
            const moveX = (dx / distance) * speed;
            const moveY = (dy / distance) * speed;
            
            newX = playerPosRef.current.x + moveX;
            newY = playerPosRef.current.y + moveY;
            
            // Don't overshoot
            if ((dx > 0 && newX > target.x) || (dx < 0 && newX < target.x)) newX = target.x;
            if ((dy > 0 && newY > target.y) || (dy < 0 && newY < target.y)) newY = target.y;
            
            if (isWalkable(newX, newY)) {
              isMoving = true;
              if (Math.abs(dx) > Math.abs(dy)) {
                newDirection = dx > 0 ? 'right' : 'left';
              } else {
                newDirection = dy > 0 ? 'front' : 'back';
              }
            } else {
              // Blocked - try single axis movement
              if (isWalkable(playerPosRef.current.x, newY)) {
                newX = playerPosRef.current.x;
                isMoving = true;
                newDirection = dy > 0 ? 'front' : 'back';
              } else if (isWalkable(newX, playerPosRef.current.y)) {
                newY = playerPosRef.current.y;
                isMoving = true;
                newDirection = dx > 0 ? 'right' : 'left';
              } else {
                // Completely blocked
                moveQueue.current.shift();
                isProcessingQueue.current = false;
                newX = playerPosRef.current.x;
                newY = playerPosRef.current.y;
              }
            }
          }
        }
        // Handle WASD movement (only if not processing click-to-move)
        else if (keysPressed.current.size > 0) {
          let dx = 0, dy = 0;
          if (keysPressed.current.has('arrowup') || keysPressed.current.has('w')) dy = -1;
          if (keysPressed.current.has('arrowdown') || keysPressed.current.has('s')) dy = 1;
          if (keysPressed.current.has('arrowleft') || keysPressed.current.has('a')) dx = -1;
          if (keysPressed.current.has('arrowright') || keysPressed.current.has('d')) dx = 1;
          
          if (dx !== 0 || dy !== 0) {
            const speed = 2;
            newX = playerPosRef.current.x + (dx * speed);
            newY = playerPosRef.current.y + (dy * speed);
            
            if (isWalkable(newX, newY)) {
              isMoving = true;
              if (dx > 0) newDirection = 'right';
              else if (dx < 0) newDirection = 'left';
              else if (dy > 0) newDirection = 'front';
              else if (dy < 0) newDirection = 'back';
            } else {
              newX = playerPosRef.current.x;
              newY = playerPosRef.current.y;
            }
          }
        } else {
          // No keys pressed - explicitly stop movement if we were moving
          if (prev.isMoving) {
            isMoving = false;
            // Force state update to send stop signal
            newX = prev.pos.x;
            newY = prev.pos.y;
          }
        }
        
        // Only update state if position actually changed OR movement state changed (important for stop signals)
        if (newX !== prev.pos.x || newY !== prev.pos.y || newDirection !== prev.direction || isMoving !== prev.isMoving) {
          const newPos = { x: newX, y: newY };
          const now = Date.now();
          
          // High-frequency updates: Send every frame if moving, but throttle network sends
          if (wsRef.current?.isConnected()) {
            const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
            const lastPos = lastPositionRef.current;
            const posDelta = Math.sqrt(
              Math.pow(newPos.x - lastPos.x, 2) + Math.pow(newPos.y - lastPos.y, 2)
            );
            
            // Optimized for high player counts: Adaptive throttling based on movement speed
            // Faster movement = more frequent updates, slower = less frequent
            // Base rate: 20fps (50ms) for moving, 5fps (200ms) for idle
            // Scale based on speed: if moving fast (>4px/frame), send at 25fps, else 15fps
            const movementSpeed = posDelta / Math.max(timeSinceLastUpdate, 1) * 1000; // pixels per second
            const minUpdateInterval = isMoving 
              ? (movementSpeed > 120 ? 40 : 66) // 25fps for fast, 15fps for slow
              : 200; // 5fps when idle
            
            // Send if enough time passed and significant position change or state change
            const isMovementStateChange = isMoving !== prev.isMoving;
            // Higher threshold for position delta to reduce network traffic
            const minPosDelta = isMoving ? 1.0 : 0.5; // Require 1px movement when moving
            // Always send immediately when stopping (isMoving changed from true to false)
            const isStopping = !isMoving && prev.isMoving;
            const shouldSend = isStopping || (timeSinceLastUpdate >= minUpdateInterval && 
              (posDelta >= minPosDelta || isMovementStateChange || !isMoving));
            
            if (shouldSend) {
              // Increment sequence number for this command
              const seq = commandSequenceRef.current++;
              
              // Store command for reconciliation
              pendingCommandsRef.current.set(seq, {
                pos: { ...newPos },
                direction: newDirection,
                isMoving: isMoving,
                timestamp: now
              });
              
              // Keep only last 100 commands for reconciliation
              if (pendingCommandsRef.current.size > 100) {
                const firstKey = pendingCommandsRef.current.keys().next().value;
                pendingCommandsRef.current.delete(firstKey);
              }
              
              // Only send if player ID is valid (not temp or me)
              if (prev.id && prev.id !== 'me' && prev.id !== 'temp') {
                // Send delta-compressed update: only send position delta if small change
                // For large changes, send full position
                const lastSentPos = lastPositionRef.current;
                const dx = newPos.x - lastSentPos.x;
                const dy = newPos.y - lastSentPos.y;
                
                // Use delta compression for small movements (saves bandwidth)
                if (Math.abs(dx) < 50 && Math.abs(dy) < 50 && Math.abs(dx) > 0.1 && Math.abs(dy) > 0.1) {
                  // Send delta (more compact)
                  wsRef.current.send({
                    type: 'player_move',
                    playerId: prev.id,
                    dx: Math.round(dx * 10) / 10, // Round to 0.1 precision
                    dy: Math.round(dy * 10) / 10,
                    direction: newDirection,
                    isMoving: isMoving,
                    seq: seq
                  });
                } else {
                  // Send full position for large movements or first update
                  wsRef.current.send({
                    type: 'player_move',
                    playerId: prev.id,
                    pos: { x: Math.round(newPos.x * 10) / 10, y: Math.round(newPos.y * 10) / 10 }, // Round to 0.1 precision
                    direction: newDirection,
                    isMoving: isMoving,
                    seq: seq
                  });
                }
              }
              
              lastPositionRef.current = { ...newPos };
              lastUpdateTimeRef.current = now;
            }
          }
          
          return { ...prev, pos: newPos, direction: newDirection, isMoving: isMoving };
        }
        
        return prev;
      });
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []); // NO DEPENDENCIES - animation loop must never restart

  // Keyboard input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Enter key for chat toggle (only when not in input)
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setShowChat(prev => {
          const willShow = !prev;
          // If opening chat, focus the input after a brief delay
          if (willShow) {
            setTimeout(() => {
              const chatInput = document.querySelector('input[placeholder="Type a message..."]') as HTMLInputElement;
              chatInput?.focus();
            }, 100);
          }
          return willShow;
        });
        return;
      }
      
      if (document.activeElement?.tagName === 'INPUT') return;
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysPressed.current.add(key);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showChat]);


  // -- WebSocket Connection --
  useEffect(() => {
    // Initialize WebSocket connection
    const ws = new GameWebSocket(WS_URL);
    wsRef.current = ws;

    // Handle incoming messages
    const handleMessage = (msg: any) => {
      switch (msg.type) {
        case 'player_id_assigned':
          // Server assigned us a unique ID - update our player ID
          console.log(`Server assigned player ID: ${msg.playerId}`, `Color: ${msg.player.color}`);
          setMyPlayer(prev => ({
            ...prev,
            id: msg.playerId,
            pos: msg.player.pos || prev.pos,
            direction: msg.player.direction || prev.direction,
            isMoving: msg.player.isMoving || prev.isMoving,
            color: msg.player.color !== undefined ? msg.player.color : prev.color // Preserve color from server
          }));
          break;
        case 'player_join':
          // Another player joined - add them to otherPlayers
          setMyPlayer(currentPlayer => {
            // Don't add ourselves to otherPlayers
            if (msg.player.id === currentPlayer.id) {
              console.log(`Received own player_join broadcast (ID: ${msg.player.id}), ignoring`);
              return currentPlayer;
            }
            
            // This is another player joining, add them to otherPlayers
            setOtherPlayers(prev => {
              // Check if player already exists
              const exists = prev.find(p => p.id === msg.player.id);
              if (exists) {
                // Update existing player
                console.log(`Updating existing player: ${msg.player.name} (${msg.player.id})`);
                return prev.map(p => p.id === msg.player.id ? msg.player as Player : p);
              }
              // Add new player
              console.log(`New player joined: ${msg.player.name} (${msg.player.id})`);
              return [...prev, msg.player as Player];
            });
            
            return currentPlayer;
          });
          break;
        case 'player_update':
          // Player name, color, or other data updated
          setMyPlayer(currentPlayer => {
            if (msg.player.id === currentPlayer.id) {
              // Our own update - update name/color if changed
              const updates: Partial<Player> = {};
              if (msg.player.name !== currentPlayer.name) {
                updates.name = msg.player.name;
              }
              if (msg.player.color !== currentPlayer.color) {
                updates.color = msg.player.color;
              }
              if (Object.keys(updates).length > 0) {
                return { ...currentPlayer, ...updates };
              }
              return currentPlayer;
            }
            
            // Another player's update
            setOtherPlayers(prev => {
              const exists = prev.find(p => p.id === msg.player.id);
              if (exists) {
                return prev.map(p => 
                  p.id === msg.player.id 
                    ? { ...p, name: msg.player.name, color: msg.player.color, direction: msg.player.direction, isMoving: msg.player.isMoving }
                    : p
                );
              }
              // Player not found, add them
              return [...prev, msg.player as Player];
            });
            
            return currentPlayer;
          });
          break;
        case 'player_move':
          // Use functional update to get current player ID
          setMyPlayer(currentPlayer => {
            // Ignore our own movement messages (we handle our own position locally)
            if (msg.playerId === currentPlayer.id) {
              // Server reconciliation: if server position differs significantly, reconcile
              const serverPos = msg.pos;
              const clientPos = currentPlayer.pos;
              const distance = Math.sqrt(
                Math.pow(serverPos.x - clientPos.x, 2) + Math.pow(serverPos.y - clientPos.y, 2)
              );
              
              // If server position is significantly different (>5px), reconcile
              if (distance > 5) {
                console.log(`Reconciling position: server=${JSON.stringify(serverPos)}, client=${JSON.stringify(clientPos)}`);
                return {
                  ...currentPlayer,
                  pos: serverPos,
                  direction: msg.direction as any,
                  isMoving: msg.isMoving
                };
              }
              return currentPlayer;
            }
            
            // This is another player's movement, update them
            setOtherPlayers(prev => {
              const playerExists = prev.find(p => p.id === msg.playerId);
              if (!playerExists) {
                console.warn(`Received move for unknown player: ${msg.playerId}, ignoring`);
                return prev;
              }
              
              // Update the player's position with interpolation
              const currentPlayer = playerExists;
              const targetPos = msg.pos;
              const currentPos = currentPlayer.pos;
              
              // Validate target position is within map bounds
              if (targetPos.x < 0 || targetPos.x >= MAP_WIDTH || targetPos.y < 0 || targetPos.y >= MAP_HEIGHT) {
                console.warn(`Invalid target position for player ${msg.playerId}:`, targetPos);
                return prev; // Don't update if position is invalid
              }
              
              // Get current interpolated position if interpolation is in progress
              const existingInterpolation = otherPlayersInterpolationRef.current.get(msg.playerId);
              let actualCurrentPos = currentPos;
              
              if (existingInterpolation) {
                // Calculate where we currently are in the interpolation
                const now = Date.now();
                const elapsed = now - existingInterpolation.startTime;
                const progress = Math.min(elapsed / existingInterpolation.duration, 1);
                
                // Use current interpolated position as starting point for new interpolation
                actualCurrentPos = {
                  x: existingInterpolation.startPos.x + (existingInterpolation.targetPos.x - existingInterpolation.startPos.x) * progress,
                  y: existingInterpolation.startPos.y + (existingInterpolation.targetPos.y - existingInterpolation.startPos.y) * progress
                };
              }
              
              // Calculate distance from actual current position
              const distance = Math.sqrt(
                Math.pow(targetPos.x - actualCurrentPos.x, 2) + Math.pow(targetPos.y - actualCurrentPos.y, 2)
              );
              
              // If the distance is very large, something is wrong - snap immediately
              if (distance > 100) {
                console.warn(`Large position jump for player ${msg.playerId}: ${distance}px, snapping immediately`);
                otherPlayersInterpolationRef.current.delete(msg.playerId);
                return prev.map(p => 
                  p.id === msg.playerId 
                    ? { ...p, pos: targetPos, direction: msg.direction as any, isMoving: msg.isMoving }
                    : p
                );
              }
              
              // If player stopped moving, immediately update isMoving state and snap to position
              if (!msg.isMoving) {
                otherPlayersInterpolationRef.current.delete(msg.playerId);
                return prev.map(p => 
                  p.id === msg.playerId 
                    ? { ...p, pos: targetPos, direction: msg.direction as any, isMoving: false }
                    : p
                );
              }
              
              // Calculate interpolation duration based on actual movement speed
              // Player moves at 2 pixels per frame, at 60fps that's 120 pixels per second
              // Duration should be distance / speed, but we account for network latency
              const movementSpeed = 120; // pixels per second (2 pixels * 60 fps)
              const estimatedLatency = msg.timestamp ? Math.max(0, Date.now() - msg.timestamp) : 50;
              const baseDuration = (distance / movementSpeed) * 1000; // Convert to milliseconds
              
              // Add latency compensation - we want to interpolate over the time it took to receive the update
              // plus a small buffer for smoothness
              const interpolationDuration = Math.max(16, Math.min(baseDuration + estimatedLatency * 0.5, 300));
              
              // Store interpolation data - start from actual current position
              otherPlayersInterpolationRef.current.set(msg.playerId, {
                startPos: { ...actualCurrentPos },
                targetPos: { ...targetPos },
                startTime: Date.now(),
                duration: interpolationDuration,
                direction: msg.direction,
                isMoving: msg.isMoving,
                lastUpdateTime: Date.now()
              });
              
              // Immediately update isMoving state even during interpolation
              // This ensures the sit animation shows as soon as the player stops
              return prev.map(p => 
                p.id === msg.playerId 
                  ? { ...p, isMoving: msg.isMoving, direction: msg.direction as any }
                  : p
              );
            });
            
            return currentPlayer;
          });
          break;
        case 'player_leave':
          setOtherPlayers(prev => prev.filter(p => p.id !== msg.playerId));
          break;
        case 'chat':
          // Server sends playerName with chat message - use it for display (tied to unique playerId)
          setMyPlayer(currentPlayer => {
            const isMyMessage = msg.playerId === currentPlayer.id;
            // Use server-provided playerName, fallback to current player name if it's our message
            const playerName = msg.playerName || (isMyMessage ? currentPlayer.name : 'Unknown');
            
            // Add chat message with nickname (tied to unique ID)
            addChatMessage(msg.playerId, playerName, msg.message);
            
            if (isMyMessage) {
              // Show message bubble on my avatar
              setMyPlayer(prev => ({ ...prev, message: msg.message }));
              setTimeout(() => {
                setMyPlayer(prev => ({ ...prev, message: undefined }));
              }, 3000);
            } else {
              // Show message bubble on other player's avatar
              setOtherPlayers(prev => {
                const playerExists = prev.find(p => p.id === msg.playerId);
                if (playerExists) {
                  return prev.map(p => 
                    p.id === msg.playerId 
                      ? { ...p, message: msg.message }
                      : p
                  );
                }
                // If player doesn't exist in our list yet, create a temporary entry
                return [...prev, {
                  id: msg.playerId,
                  name: playerName,
                  pos: { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
                  direction: 'front' as const,
                  isMoving: false,
                  message: msg.message
                }];
              });
              setTimeout(() => {
                setOtherPlayers(prev => prev.map(p => 
                  p.id === msg.playerId ? { ...p, message: undefined } : p
                ));
              }, 3000);
            }
            
            return currentPlayer;
          });
          break;
        case 'players_sync':
          // Load all existing players, excluding myself
          // Use functional update to get current player ID
          setMyPlayer(currentPlayer => {
            const existingPlayers = msg.players.filter(p => p.id !== currentPlayer.id) as Player[];
            // Ensure all players have their color property preserved
            const playersWithColors = existingPlayers.map(p => ({
              ...p,
              color: p.color || undefined // Preserve color, or undefined if not set
            }));
            setOtherPlayers(playersWithColors);
            console.log(`Loaded ${playersWithColors.length} existing players (my ID: ${currentPlayer.id})`, 
              playersWithColors.map(p => ({ id: p.id, name: p.name, color: p.color })));
            return currentPlayer;
          });
          break;
      }
    };
    
    ws.onMessage((msg) => {
      // Handle batched updates for performance (reduces network overhead)
      if (msg.type === 'batch' && Array.isArray(msg.updates)) {
        msg.updates.forEach((update) => {
          handleMessage(update);
        });
      } else {
        handleMessage(msg);
      }
    });

    ws.onConnect(() => {
      // Server will assign us a unique ID - send join request with temporary ID
      console.log('WebSocket connected, requesting player join...');
      
      // Send player join message - server will assign unique ID
      if (wsRef.current?.isConnected()) {
        setMyPlayer(prev => {
          wsRef.current?.send({
            type: 'player_join',
            player: {
              id: 'temp', // Temporary ID, server will assign real one
              name: prev.name,
              pos: prev.pos,
              direction: prev.direction,
              isMoving: prev.isMoving,
              color: prev.color // Include color when joining
            }
          });
          return prev;
        });
      }
    });

    ws.connect();

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, []); // Only run once on mount - WebSocket connection is persistent

  // REMOVED: This useEffect was causing re-renders that interfered with movement
  // Movement updates are now handled entirely in the animation loop

  // Send name/color updates when they change - use ref to avoid interrupting animation
  const lastSentNameRef = useRef<string>(myPlayer.name);
  const lastSentColorRef = useRef<string | undefined>(myPlayer.color);
  useEffect(() => {
    if (!wsRef.current?.isConnected()) return;
    // Don't send update if player ID is not set yet (still connecting)
    if (!myPlayer.id || myPlayer.id === 'me' || myPlayer.id === 'temp') return;
    // Only send if name or color actually changed
    const nameChanged = myPlayer.name !== lastSentNameRef.current;
    const colorChanged = myPlayer.color !== lastSentColorRef.current;
    if (!nameChanged && !colorChanged) return;
    
    lastSentNameRef.current = myPlayer.name;
    lastSentColorRef.current = myPlayer.color;
    
    // Use setTimeout to defer update and avoid blocking animation loop
    setTimeout(() => {
      if (wsRef.current?.isConnected()) {
        wsRef.current.send({
          type: 'player_update',
          player: {
            id: myPlayer.id,
            name: myPlayer.name,
            color: myPlayer.color,
            pos: myPlayer.pos,
            direction: myPlayer.direction,
            isMoving: myPlayer.isMoving
          }
        });
      }
    }, 0);
  }, [myPlayer.name, myPlayer.color, myPlayer.id]);

  // -- Chat System --
  const addChatMessage = (senderId: string, senderName: string, text: string) => {
    const newMessage: ChatMessage = { id: Date.now().toString() + Math.random(), senderId, senderName, text, timestamp: Date.now() };
    setChatHistory(prev => [...prev, newMessage]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const messageText = chatInput.trim();
    
    // Add message to local chat immediately with current player info
    addChatMessage(myPlayer.id, myPlayer.name, messageText);
    
    // Show message bubble on avatar
    setMyPlayer(prev => ({ ...prev, message: messageText }));
    setTimeout(() => {
      setMyPlayer(prev => ({ ...prev, message: undefined }));
    }, 4000);
    
    // Send chat message via WebSocket
    if (wsRef.current?.isConnected()) {
      wsRef.current.send({
        type: 'chat',
        playerId: myPlayer.id,
        message: messageText
      });
    }
    
    setChatInput("");
    
    // Close chat after sending message (mobile-friendly)
    setShowChat(false);
  };

  // No longer using tile-based rendering - using prebuilt map image

  return (
    <div className="h-screen w-screen bg-slate-950 overflow-hidden relative">
      {/* Map Container - useMemo to prevent re-renders */}
      <main className="absolute inset-0 flex items-center justify-center select-none touch-none" style={{ pointerEvents: 'auto' }}>
        <div 
            ref={mapContainerRef}
            data-map-container
            className="relative shadow-2xl rounded-sm overflow-hidden border-4 border-slate-800 select-none bg-slate-900"
            style={{ 
              width: `${MAP_WIDTH}px`, 
              height: `${MAP_HEIGHT}px`,
              minWidth: `${MAP_WIDTH}px`,
              minHeight: `${MAP_HEIGHT}px`,
              maxWidth: `${MAP_WIDTH}px`,
              maxHeight: `${MAP_HEIGHT}px`,
              pointerEvents: 'auto',
              cursor: 'crosshair',
              touchAction: 'none',
              willChange: 'contents' // Optimize for frequent updates
            }}
            onPointerDown={handleMapClick}
            onTouchStart={handleMapClick}
        >
            {/* Prebuilt map image */}
            <img 
                src={MAP_IMAGE} 
                alt="Map" 
                className="pixelated"
                style={{ 
                  imageRendering: 'pixelated',
                  width: `${MAP_WIDTH}px`,
                  height: `${MAP_HEIGHT}px`,
                  display: 'block',
                  pointerEvents: 'none'
                }}
            />
            
            {/* Players */}
            <>
                {otherPlayers.map(p => <Avatar key={p.id} player={p} />)}
                <Avatar player={myPlayer} />
            </>
        </div>
      </main>

      {/* MMO-Style Chat Overlay - Mobile Responsive */}
      {showChat && (
        <div className="absolute bottom-0 left-0 right-0 sm:bottom-4 sm:left-4 sm:right-auto w-full sm:w-96 max-w-full sm:max-w-[calc(100vw-2rem)] z-30 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-md rounded-t-lg sm:rounded-lg border border-slate-700/50 border-b-0 sm:border-b border-t-0 sm:border-t shadow-2xl overflow-hidden pointer-events-auto h-[40vh] sm:h-auto max-h-[50vh] sm:max-h-none flex flex-col">
            {/* Chat Header */}
            <div className="px-3 sm:px-3 py-2.5 sm:py-2 bg-black/40 border-b border-slate-700/50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="sm:w-[14px] sm:h-[14px] text-slate-400" />
                <span className="text-sm sm:text-xs font-bold text-slate-300 uppercase tracking-wider">Chat</span>
              </div>
              <button
                onClick={() => setShowChat(false)}
                className="text-slate-400 hover:text-white active:text-white transition-colors p-2 sm:p-1 touch-manipulation"
                title="Hide Chat"
                aria-label="Hide Chat"
              >
                <X size={18} className="sm:w-[14px] sm:h-[14px]" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-3 space-y-2 no-scrollbar min-h-0">
              {chatHistory.length === 0 && (
                <div className="text-center text-xs sm:text-xs text-slate-500 italic mt-4">Welcome! Tap to move, type to chat.</div>
              )}
              {chatHistory.map(msg => (
                <div key={msg.id} className="flex flex-col">
                  <span className="text-xs sm:text-xs text-slate-400 mb-0.5">{msg.senderName}</span>
                  <div className="text-sm sm:text-sm text-slate-200 break-words">{msg.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={sendChat} className="p-2.5 sm:p-2 bg-black/40 border-t border-slate-700/50 flex-shrink-0">
              <div className="relative flex items-center gap-2">
                <input 
                  type="text" 
                  value={chatInput} 
                  onChange={(e) => {
                    e.stopPropagation();
                    setChatInput(e.target.value);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onBlur={(e) => e.stopPropagation()}
                  placeholder="Type a message..." 
                  className="flex-1 bg-slate-900/80 border border-slate-700/50 text-slate-200 text-base sm:text-sm rounded-lg sm:rounded px-4 sm:px-3 py-3 sm:py-2 focus:outline-none focus:border-blue-500 transition-colors touch-manipulation" 
                />
                <button 
                  type="submit" 
                  disabled={!chatInput.trim()} 
                  className="px-4 sm:px-3 py-3 sm:py-2 bg-blue-600 text-white rounded-lg sm:rounded hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 touch-manipulation min-w-[48px] sm:min-w-0"
                  aria-label="Send message"
                >
                  <Send size={18} className="sm:w-[14px] sm:h-[14px]" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Show Chat Button (when hidden) - Mobile Responsive */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="absolute bottom-4 left-4 z-30 p-4 sm:p-3 bg-black/70 backdrop-blur-md rounded-lg border border-slate-700/50 hover:bg-black/80 active:bg-black/90 transition-colors pointer-events-auto touch-manipulation"
          title="Show Chat"
          aria-label="Show Chat"
        >
          <MessageSquare size={24} className="sm:w-5 sm:h-5 text-slate-300" />
        </button>
      )}

      {/* Name Button (Top Right) - Mobile Responsive */}
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-30 pointer-events-none flex items-center gap-2">
        {/* Sprite Selector Button */}
        <button
          onClick={() => setShowSpriteSelector(true)}
          className="bg-black/70 backdrop-blur-md rounded-lg border border-slate-700/50 shadow-lg p-3 sm:p-2 hover:bg-black/80 active:bg-black/90 transition-colors pointer-events-auto touch-manipulation"
          title="Sprite Settings"
          aria-label="Sprite Settings"
        >
          <Settings size={20} className="sm:w-4 sm:h-4 text-slate-300" />
        </button>

        {showNameInput ? (
          <div className="bg-black/70 backdrop-blur-md rounded-lg border border-slate-700/50 shadow-2xl p-3 sm:p-3 pointer-events-auto min-w-[200px] sm:min-w-[200px] w-[calc(100vw-4rem)] sm:w-auto max-w-[280px]">
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={myPlayer.name} 
                onChange={(e) => {
                  e.stopPropagation();
                  const newName = e.target.value.slice(0, 20);
                  // Use functional update to avoid interrupting animation
                  setMyPlayer(prev => ({ ...prev, name: newName }));
                  localStorage.setItem('playerName', newName);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  e.stopPropagation();
                  setShowNameInput(false);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    setShowNameInput(false);
                  }
                }}
                placeholder="Your name..." 
                className="flex-1 bg-slate-900/80 border border-slate-700/50 text-slate-200 text-base sm:text-sm rounded-lg sm:rounded px-4 sm:px-3 py-3 sm:py-2 focus:outline-none focus:border-blue-500 transition-colors touch-manipulation" 
                autoFocus
              />
              <button 
                onClick={() => setShowNameInput(false)}
                className="px-3 sm:px-2 py-3 sm:py-2 bg-slate-700/80 hover:bg-slate-600/80 active:bg-slate-500/80 text-slate-200 rounded-lg sm:rounded text-sm transition-colors touch-manipulation min-w-[44px] sm:min-w-0"
                aria-label="Close"
              >
                <X size={18} className="sm:w-[14px] sm:h-[14px]" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Color Picker Button */}
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="bg-black/70 backdrop-blur-md rounded-lg border border-slate-700/50 shadow-lg p-2.5 sm:p-2 hover:bg-black/80 active:bg-black/90 transition-colors pointer-events-auto touch-manipulation"
              title="Change Gopher Color"
              aria-label="Change Gopher Color"
            >
              <div 
                className="w-4 h-4 sm:w-3 sm:h-3 rounded border-2 border-slate-400"
                style={{
                  backgroundColor: myPlayer.color || '#94a3b8'
                }}
              />
            </button>
            
            {/* Name Button */}
            <button
              onClick={() => setShowNameInput(true)}
              className="bg-black/70 backdrop-blur-md rounded-lg border border-slate-700/50 shadow-lg px-3 sm:px-4 py-2.5 sm:py-2 hover:bg-black/80 active:bg-black/90 transition-colors pointer-events-auto flex items-center gap-2 touch-manipulation"
              aria-label="Change name"
            >
              <User size={18} className="sm:w-4 sm:h-4 text-slate-300" />
              <span className="text-sm sm:text-sm font-semibold text-slate-200 truncate max-w-[120px] sm:max-w-none">{myPlayer.name}</span>
            </button>
          </div>
        )}
      </div>

      {/* Color Picker - Mobile Responsive */}
      {showColorPicker && (
        <div className="absolute top-16 sm:top-20 right-2 sm:right-4 z-40 pointer-events-auto">
          <div className="bg-black/90 backdrop-blur-md rounded-lg border border-slate-700/50 shadow-2xl p-4 sm:p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-200">Gopher Color</span>
              <button
                onClick={() => setShowColorPicker(false)}
                className="text-slate-400 hover:text-white transition-colors p-1 touch-manipulation"
                aria-label="Close color picker"
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Preset Colors */}
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 mb-3">
              {[
                '#94a3b8', // Default gray
                '#FF6B6B', // Red
                '#4ECDC4', // Teal
                '#45B7D1', // Blue
                '#FFA07A', // Orange
                '#98D8C8', // Mint
                '#F7DC6F', // Yellow
                '#BB8FCE', // Purple
                '#85C1E2', // Light Blue
                '#F8B739', // Gold
                '#52BE80', // Green
                '#EC7063', // Coral
                '#5DADE2', // Sky Blue
                '#F1948A', // Pink
                '#82E0AA', // Light Green
                '#F4D03F', // Bright Yellow
                '#A569BD', // Dark Purple
                '#48C9B0', // Turquoise
              ].map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setMyPlayer(prev => ({ ...prev, color }));
                    localStorage.setItem('playerColor', color);
                    setShowColorPicker(false);
                  }}
                  className={`w-8 h-8 sm:w-7 sm:h-7 rounded border-2 transition-all touch-manipulation ${
                    myPlayer.color === color 
                      ? 'border-white scale-110' 
                      : 'border-slate-600 hover:border-slate-400'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
            
            {/* Custom Color Picker */}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={myPlayer.color || '#94a3b8'}
                onChange={(e) => {
                  const newColor = e.target.value.toLowerCase(); // Normalize to lowercase
                  setMyPlayer(prev => {
                    // Update state
                    const updated = { ...prev, color: newColor };
                    localStorage.setItem('playerColor', newColor);
                    
                    // Send update immediately if connected
                    if (wsRef.current?.isConnected() && updated.id && updated.id !== 'me' && updated.id !== 'temp') {
                      setTimeout(() => {
                        if (wsRef.current?.isConnected()) {
                          wsRef.current.send({
                            type: 'player_update',
                            player: {
                              id: updated.id,
                              name: updated.name,
                              color: updated.color,
                              pos: updated.pos,
                              direction: updated.direction,
                              isMoving: updated.isMoving
                            }
                          });
                          // Update ref to prevent duplicate sends
                          lastSentColorRef.current = newColor;
                        }
                      }, 0);
                    }
                    
                    return updated;
                  });
                }}
                className="w-full h-10 sm:h-8 rounded border border-slate-700/50 cursor-pointer touch-manipulation"
                title="Custom color"
              />
              <button
                onClick={() => {
                  setMyPlayer(prev => ({ ...prev, color: undefined }));
                  localStorage.removeItem('playerColor');
                  setShowColorPicker(false);
                }}
                className="px-3 py-2 bg-slate-700/80 hover:bg-slate-600/80 active:bg-slate-500/80 text-slate-200 rounded text-sm transition-colors touch-manipulation whitespace-nowrap"
                title="Reset to default"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sprite Selector Modal - Mobile Responsive */}
      {showSpriteSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-2 sm:p-4">
          <div className="relative bg-slate-900 rounded-lg shadow-2xl max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-auto m-0 sm:m-4">
            <button
              onClick={() => setShowSpriteSelector(false)}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 p-3 sm:p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-lg touch-manipulation"
              aria-label="Close sprite selector"
            >
              <X size={24} className="sm:w-5 sm:h-5" />
            </button>
            <SpriteSelector onClose={() => setShowSpriteSelector(false)} />
          </div>
        </div>
      )}
    </div>
  );
}