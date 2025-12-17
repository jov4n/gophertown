import React, { useEffect, useState, useRef } from 'react';
import { ASSETS } from '../constants';
import { Player } from '../types';
import { SpriteMapping, DEFAULT_MAPPING, SpriteArea } from './SpriteSelector';
import { useGopherCanvas } from './hooks/useGopherCanvas';

interface Item {
  id: string;
  spriteUrl: string;
  layer: 'behind' | 'front';
}

interface AvatarProps {
  player: Player;
  items?: Item[];
}

export const Avatar: React.FC<AvatarProps> = ({ player, items = [] }) => {
  const [frame, setFrame] = useState(0);
  const [spriteMapping, setSpriteMapping] = useState<SpriteMapping>(DEFAULT_MAPPING);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  
  // --- NEW: Canvas Ref for the Body ---
  const bodyCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Debug: Log color when it changes
  useEffect(() => {
    if (player.color) {
      console.log(`Avatar for ${player.name} (${player.id}) - Color: ${player.color}`);
    }
  }, [player.color, player.id, player.name]);
  
  // --- NEW: Connect Hook to Canvas ---
  useGopherCanvas(bodyCanvasRef, ASSETS.AVATAR_URL, player.color);

  const [bobOffset, setBobOffset] = useState(0);
  const bobAnimationRef = useRef<number | null>(null);
  const bobStartTimeRef = useRef<number>(0);
  const isMovingRef = useRef<boolean>(player.isMoving);
  const bobOffsetRef = useRef<number>(0);
  
  const isMoving = player.isMoving;
  
  // Keep refs in sync
  useEffect(() => { isMovingRef.current = isMoving; }, [isMoving]);
  useEffect(() => { bobOffsetRef.current = bobOffset; }, [bobOffset]);

  // Load sprite mapping
  useEffect(() => {
    try {
      const stored = localStorage.getItem('spriteMapping');
      if (stored) {
        setSpriteMapping({ ...DEFAULT_MAPPING, ...JSON.parse(stored) });
      }
      const img = new Image();
      img.onload = () => setImageSize({ width: img.width, height: img.height });
      img.src = ASSETS.AVATAR_URL;
    } catch (e) {
      console.warn('Failed to load sprite mapping:', e);
    }
  }, []);

  // Animation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % 4);
    }, 200);
    return () => clearInterval(interval);
  }, []);
  
  // Calculate Sprite Area
  let spriteArea: SpriteArea;
  let scaleX = 1;

  if (isMoving) {
    switch (player.direction) {
      case 'front': spriteArea = spriteMapping.walkFront; break;
      case 'right': spriteArea = spriteMapping.walkLeft; scaleX = -1; break;
      case 'back': spriteArea = spriteMapping.walkBack; break;
      case 'left': spriteArea = spriteMapping.walkLeft; scaleX = 1; break;
      default: spriteArea = spriteMapping.walkFront;
    }
  } else {
    switch (player.direction) {
      case 'front': spriteArea = spriteMapping.sitFront; break;
      case 'right': spriteArea = spriteMapping.sitLeft; scaleX = -1; break;
      case 'back': spriteArea = spriteMapping.sitBack; break;
      case 'left': spriteArea = spriteMapping.sitLeft; scaleX = 1; break;
      default: spriteArea = spriteMapping.sitFront;
    }
  }

  // Bobbing Animation
  useEffect(() => {
    if (bobAnimationRef.current) {
      cancelAnimationFrame(bobAnimationRef.current);
      bobAnimationRef.current = null;
    }
    
    if (!isMoving) {
      const returnToZero = () => {
        const current = bobOffsetRef.current;
        const newOffset = current * 0.8;
        if (Math.abs(newOffset) < 0.1) {
          setBobOffset(0);
          return;
        }
        setBobOffset(newOffset);
        if (!isMovingRef.current) bobAnimationRef.current = requestAnimationFrame(returnToZero);
      };
      if (Math.abs(bobOffsetRef.current) > 0.1) bobAnimationRef.current = requestAnimationFrame(returnToZero);
      else setBobOffset(0);
      return;
    }
    
    bobStartTimeRef.current = performance.now();
    const animate = (currentTime: number) => {
      if (!isMovingRef.current) return;
      const elapsed = (currentTime - bobStartTimeRef.current) * 0.015;
      const offset = Math.sin(elapsed) * 2;
      setBobOffset(offset);
      bobAnimationRef.current = requestAnimationFrame(animate);
    };
    bobAnimationRef.current = requestAnimationFrame(animate);
    return () => { if (bobAnimationRef.current) cancelAnimationFrame(bobAnimationRef.current); };
  }, [isMoving]);

  // Helper for Item Styles (Background Images)
  const getItemStyle = (url: string) => ({
    backgroundImage: `url(${url})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: imageSize.width > 0 && spriteArea.width > 0 
      ? `${(64 / spriteArea.width) * imageSize.width}px ${(64 / spriteArea.height) * imageSize.height}px` 
      : '0 0',
    backgroundPosition: spriteArea.width > 0 
      ? `${-(spriteArea.x * (64 / spriteArea.width))}px ${-(spriteArea.y * (64 / spriteArea.height))}px` 
      : '0 0',
    transform: `scaleX(${scaleX})`,
    transformOrigin: 'center',
  });

  return (
    <div 
      data-avatar
      className="absolute z-10 flex flex-col items-center pointer-events-none"
      style={{
        left: `${player.pos.x - 32}px`,
        top: `${player.pos.y - 48 - bobOffset}px`,
        width: '64px',
        height: '96px',
        zIndex: Math.floor(player.pos.y) + 10,
        transition: isMoving ? 'none' : 'top 0.2s ease-out'
      }}
    >
      {/* Chat Bubble */}
      {player.message && (
        <div className="absolute -top-20 flex flex-col items-center z-50 animate-bounce-slight">
           <div className="bg-white text-slate-900 text-sm font-bold px-4 py-2.5 rounded-2xl border-2 border-slate-300 shadow-xl max-w-[200px] text-center leading-tight break-words">
            {player.message}
          </div>
          <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-slate-300 -mt-[1px]"></div>
        </div>
      )}

      {/* Name Tag */}
      <div 
        className="absolute top-1 left-1/2 -translate-x-1/2 z-30 text-xs font-bold text-white drop-shadow-md bg-black/60 px-2 sm:px-3 py-1 rounded-full backdrop-blur-sm whitespace-normal text-center"
        style={{ width: 'max-content', maxWidth: '300px' }}
      >
        {player.name}
      </div>

      {/* COMPOSITE SPRITE CONTAINER */}
      <div className="relative mt-auto z-0" style={{ width: '64px', height: '64px' }}>
        
        {/* Shadow */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-2.5 bg-black/40 rounded-full blur-[1px]" />

        {/* Layer 1: Items BEHIND */}
        {items.filter(i => i.layer === 'behind').map((item, idx) => (
           <div key={`back-${idx}`} className="pixelated absolute inset-0 z-0" 
                style={getItemStyle(item.spriteUrl)} />
        ))}

        {/* Layer 2: GOPHER BODY (CANVAS) */}
        {/* The wrapper handles clipping the sprite sheet */}
        <div 
           className="absolute inset-0 z-10 overflow-hidden"
           style={{
             transform: `scaleX(${scaleX})`, 
             transformOrigin: 'center',
             visibility: imageSize.width > 0 && spriteArea.width > 0 ? 'visible' : 'hidden'
           }}
        >
          {/* The canvas holds the FULL sprite sheet image */}
          <canvas
            ref={bodyCanvasRef}
            className="pixelated"
            style={{
               // We replicate background-size using physical width/height
               width: imageSize.width > 0 && spriteArea.width > 0 
                 ? `${(64 / spriteArea.width) * imageSize.width}px` 
                 : '0px', 
               height: imageSize.width > 0 && spriteArea.height > 0
                 ? `${(64 / spriteArea.height) * imageSize.height}px`
                 : '0px',
               // We replicate background-position using translate
               transform: imageSize.width > 0 && spriteArea.width > 0
                 ? `translate(${-(spriteArea.x * (64 / spriteArea.width))}px, ${-(spriteArea.y * (64 / spriteArea.height))}px)`
                 : 'none',
               position: 'absolute',
               top: 0,
               left: 0
            }}
          />
        </div>

        {/* Layer 3: Items IN FRONT */}
        {items.filter(i => i.layer === 'front').map((item, idx) => (
           <div key={`front-${idx}`} className="pixelated absolute inset-0 z-20" 
                style={getItemStyle(item.spriteUrl)} />
        ))}

      </div>
    </div>
  );
};