import React, { useState, useEffect, useRef } from 'react';

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

export interface CollisionArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CollisionEditorProps {
  mapImage: string;
  collisions: CollisionArea[];
  onCollisionsChange: (collisions: CollisionArea[]) => void;
  onClose: () => void;
}

export const CollisionEditor: React.FC<CollisionEditorProps> = ({
  mapImage,
  collisions,
  onCollisionsChange,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [localCollisions, setLocalCollisions] = useState<CollisionArea[]>(collisions);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<CollisionArea | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = mapImage;

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      setImageLoaded(true);
      drawCollisions(ctx);
    };
  }, [mapImage, localCollisions, currentSelection]);

  const drawCollisions = (ctx: CanvasRenderingContext2D) => {
    // Draw all collision areas
    localCollisions.forEach(area => {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(area.x, area.y, area.width, area.height);
      
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(area.x, area.y, area.width, area.height);
    });

    // Draw current selection being made
    if (currentSelection) {
      ctx.fillStyle = mode === 'add' ? 'rgba(255, 255, 0, 0.2)' : 'rgba(0, 255, 0, 0.2)';
      ctx.fillRect(
        currentSelection.x,
        currentSelection.y,
        currentSelection.width,
        currentSelection.height
      );
      ctx.strokeStyle = mode === 'add' ? 'rgba(255, 255, 0, 0.8)' : 'rgba(0, 255, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        currentSelection.x,
        currentSelection.y,
        currentSelection.width,
        currentSelection.height
      );
    }
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    setSelectionStart(coords);
    setCurrentSelection({ x: coords.x, y: coords.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !selectionStart) return;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    const x = Math.min(selectionStart.x, coords.x);
    const y = Math.min(selectionStart.y, coords.y);
    const width = Math.abs(coords.x - selectionStart.x);
    const height = Math.abs(coords.y - selectionStart.y);

    setCurrentSelection({ x, y, width, height });
    
    // Redraw
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          drawCollisions(ctx);
        };
        img.src = mapImage;
      }
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentSelection || !selectionStart) return;

    // Only save if selection has meaningful size
    if (currentSelection.width > 5 && currentSelection.height > 5) {
      if (mode === 'add') {
        setLocalCollisions(prev => [...prev, currentSelection!]);
      } else {
        // Remove collisions that overlap with selection
        setLocalCollisions(prev => prev.filter(area => {
          // Check if areas overlap
          return !(currentSelection!.x < area.x + area.width &&
                   currentSelection!.x + currentSelection!.width > area.x &&
                   currentSelection!.y < area.y + area.height &&
                   currentSelection!.y + currentSelection!.height > area.y);
        }));
      }
    }

    setIsDrawing(false);
    setSelectionStart(null);
    setCurrentSelection(null);
  };

  const handleSave = () => {
    onCollisionsChange(localCollisions);
    onClose();
  };

  const handleClear = () => {
    setLocalCollisions([]);
  };

  const handleLoad = () => {
    const stored = localStorage.getItem('mapCollisions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setLocalCollisions(parsed);
      } catch (e) {
        console.error('Failed to load collisions:', e);
      }
    }
  };

  const deleteCollision = (index: number) => {
    setLocalCollisions(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-white">Collision Editor</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('add')}
              className={`px-4 py-2 rounded font-bold ${mode === 'add' ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              Add Collisions
            </button>
            <button
              onClick={() => setMode('remove')}
              className={`px-4 py-2 rounded font-bold ${mode === 'remove' ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              Remove Collisions
            </button>
          </div>
          <div className="text-sm text-slate-400">
            {localCollisions.length} collision areas
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleLoad}>Load</Button>
          <Button variant="secondary" onClick={handleClear}>Clear All</Button>
          <Button onClick={handleSave}>Save & Close</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto bg-slate-800 p-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Canvas */}
          <div className="lg:col-span-3">
            <div className="bg-slate-900 p-4 rounded-lg">
              <h3 className="text-lg font-bold mb-2 text-white">Map</h3>
              <div className="border-2 border-slate-700 rounded overflow-hidden">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="cursor-crosshair block w-full"
                  style={{ imageRendering: 'pixelated', maxWidth: '100%', height: 'auto' }}
                />
              </div>
              {!imageLoaded && (
                <div className="text-slate-400 text-sm mt-2">Loading map image...</div>
              )}
              <div className="mt-2 text-xs text-slate-400">
                Click and drag to {mode === 'add' ? 'add' : 'remove'} collision areas
              </div>
            </div>
          </div>

          {/* Collision List */}
          <div className="bg-slate-900 p-4 rounded-lg">
            <h3 className="text-lg font-bold mb-2 text-white">Collision Areas</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {localCollisions.length === 0 ? (
                <div className="text-sm text-slate-400">No collision areas defined</div>
              ) : (
                localCollisions.map((area, index) => (
                  <div key={index} className="bg-slate-800 p-2 rounded text-sm">
                    <div className="font-mono text-xs text-slate-300">
                      {Math.round(area.x)}, {Math.round(area.y)}
                    </div>
                    <div className="font-mono text-xs text-slate-400">
                      {Math.round(area.width)} × {Math.round(area.height)}px
                    </div>
                    <button
                      onClick={() => deleteCollision(index)}
                      className="mt-1 px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-slate-900 border-t border-slate-800 text-sm text-slate-400">
        <p>Click and drag on the map to {mode === 'add' ? 'add' : 'remove'} collision areas. Red areas are collision zones.</p>
      </div>
    </div>
  );
};
