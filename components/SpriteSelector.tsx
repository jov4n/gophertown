import React, { useState, useEffect, useRef } from 'react';
import { ASSETS } from '../constants';

export interface SpriteArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpriteMapping {
  walkFront: SpriteArea;
  walkRight: SpriteArea;
  walkBack: SpriteArea;
  walkLeft: SpriteArea;
  sitFront: SpriteArea;
  sitRight: SpriteArea;
  sitBack: SpriteArea;
  sitLeft: SpriteArea;
}

// Default sprite mapping coordinates
export const DEFAULT_MAPPING: SpriteMapping = {
  walkFront: { x: 164, y: 137, width: 273, height: 296 },
  walkRight: { x: 1147, y: 133, width: 260, height: 298 },
  walkBack: { x: 830, y: 133, width: 247, height: 300 },
  walkLeft: { x: 1149, y: 129, width: 260, height: 304 },
  sitFront: { x: 187, y: 592, width: 256, height: 264 },
  sitRight: { x: 517, y: 137, width: 256, height: 298 },
  sitBack: { x: 853, y: 600, width: 230, height: 254 },
  sitLeft: { x: 517, y: 140, width: 256, height: 294 },
};

export const SpriteSelector: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedState, setSelectedState] = useState<keyof SpriteMapping>('walkFront');
  const [mapping, setMapping] = useState<SpriteMapping>(() => {
    try {
      const stored = localStorage.getItem('spriteMapping');
      if (stored) {
        return { ...DEFAULT_MAPPING, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load sprite mapping:', e);
    }
    return DEFAULT_MAPPING;
  });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = ASSETS.AVATAR_URL;

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      setImageSize({ width: img.width, height: img.height });
      ctx.drawImage(img, 0, 0);
      setImageLoaded(true);
      drawAreas(ctx, img.width, img.height);
    };
  }, [mapping, selectedState, currentSelection, isSelecting, selectionStart]);

  const drawAreas = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Draw all defined areas
    Object.entries(mapping).forEach(([state, area]) => {
      if (area.width > 0 && area.height > 0) {
        const isCurrentState = state === selectedState;
        ctx.fillStyle = isCurrentState ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(area.x, area.y, area.width, area.height);
        
        ctx.strokeStyle = isCurrentState ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = isCurrentState ? 3 : 1;
        ctx.strokeRect(area.x, area.y, area.width, area.height);
        
        // Label
        ctx.fillStyle = isCurrentState ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px monospace';
        ctx.fillText(state, area.x + 2, area.y + 14);
      }
    });

    // Draw current selection being made
    if (currentSelection) {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
      ctx.fillRect(
        currentSelection.x,
        currentSelection.y,
        currentSelection.width,
        currentSelection.height
      );
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
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

    setIsSelecting(true);
    setSelectionStart(coords);
    setCurrentSelection({ x: coords.x, y: coords.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !selectionStart) return;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    const x = Math.min(selectionStart.x, coords.x);
    const y = Math.min(selectionStart.y, coords.y);
    const width = Math.abs(coords.x - selectionStart.x);
    const height = Math.abs(coords.y - selectionStart.y);

    setCurrentSelection({ x, y, width, height });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !selectionStart || !currentSelection) return;

    const coords = getCanvasCoordinates(e);
    if (!coords) return;

    // Only save if selection has meaningful size
    if (currentSelection.width > 5 && currentSelection.height > 5) {
      setMapping(prev => ({
        ...prev,
        [selectedState]: {
          x: currentSelection!.x,
          y: currentSelection!.y,
          width: currentSelection!.width,
          height: currentSelection!.height
        }
      }));
    }

    setIsSelecting(false);
    setSelectionStart(null);
    setCurrentSelection(null);
  };

  const handleSave = () => {
    localStorage.setItem('spriteMapping', JSON.stringify(mapping));
    alert('Sprite mapping saved! The game will reload to apply changes.');
    window.location.reload();
  };

  const handleReset = () => {
    setMapping(DEFAULT_MAPPING);
  };

  const handleExport = () => {
    // Format as a code snippet that can be easily shared
    const exportCode = `export const DEFAULT_MAPPING: SpriteMapping = {
  walkFront: { x: ${Math.round(mapping.walkFront.x)}, y: ${Math.round(mapping.walkFront.y)}, width: ${Math.round(mapping.walkFront.width)}, height: ${Math.round(mapping.walkFront.height)} },
  walkRight: { x: ${Math.round(mapping.walkRight.x)}, y: ${Math.round(mapping.walkRight.y)}, width: ${Math.round(mapping.walkRight.width)}, height: ${Math.round(mapping.walkRight.height)} },
  walkBack: { x: ${Math.round(mapping.walkBack.x)}, y: ${Math.round(mapping.walkBack.y)}, width: ${Math.round(mapping.walkBack.width)}, height: ${Math.round(mapping.walkBack.height)} },
  walkLeft: { x: ${Math.round(mapping.walkLeft.x)}, y: ${Math.round(mapping.walkLeft.y)}, width: ${Math.round(mapping.walkLeft.width)}, height: ${Math.round(mapping.walkLeft.height)} },
  sitFront: { x: ${Math.round(mapping.sitFront.x)}, y: ${Math.round(mapping.sitFront.y)}, width: ${Math.round(mapping.sitFront.width)}, height: ${Math.round(mapping.sitFront.height)} },
  sitRight: { x: ${Math.round(mapping.sitRight.x)}, y: ${Math.round(mapping.sitRight.y)}, width: ${Math.round(mapping.sitRight.width)}, height: ${Math.round(mapping.sitRight.height)} },
  sitBack: { x: ${Math.round(mapping.sitBack.x)}, y: ${Math.round(mapping.sitBack.y)}, width: ${Math.round(mapping.sitBack.width)}, height: ${Math.round(mapping.sitBack.height)} },
  sitLeft: { x: ${Math.round(mapping.sitLeft.x)}, y: ${Math.round(mapping.sitLeft.y)}, width: ${Math.round(mapping.sitLeft.width)}, height: ${Math.round(mapping.sitLeft.height)} },
};`;

    // Copy to clipboard
    navigator.clipboard.writeText(exportCode).then(() => {
      alert('Coordinates copied to clipboard! You can now paste them to share.');
    }).catch((err) => {
      // Fallback: show in a textarea for manual copy
      const textarea = document.createElement('textarea');
      textarea.value = exportCode;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        alert('Coordinates copied to clipboard! You can now paste them to share.');
      } catch (e) {
        alert('Failed to copy. Here are your coordinates:\n\n' + exportCode);
      }
      document.body.removeChild(textarea);
    });
  };

  const states: Array<{ key: keyof SpriteMapping; label: string }> = [
    { key: 'walkFront', label: 'Walk Front' },
    { key: 'walkRight', label: 'Walk Right' },
    { key: 'walkBack', label: 'Walk Back' },
    { key: 'walkLeft', label: 'Walk Left' },
    { key: 'sitFront', label: 'Sit Front' },
    { key: 'sitRight', label: 'Sit Right' },
    { key: 'sitBack', label: 'Sit Back' },
    { key: 'sitLeft', label: 'Sit Left' },
  ];

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-white">Sprite Selector</h2>
          <div className="text-sm text-slate-400">
            Click on a sprite in the image to assign it to the selected state
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold text-white"
            title="Copy coordinates to clipboard"
          >
            Export Coords
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-bold text-white"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-bold text-white"
          >
            Save & Apply
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-bold text-white"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-800 p-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sprite Sheet */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900 p-4 rounded-lg">
              <h3 className="text-lg font-bold mb-2 text-white">Sprite Sheet</h3>
              <div className="border-2 border-slate-700 rounded overflow-hidden">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className="cursor-crosshair block w-full"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
              {!imageLoaded && (
                <div className="text-slate-400 text-sm mt-2">Loading sprite sheet...</div>
              )}
              <div className="mt-2 text-xs text-slate-400">
                Click and drag to select an area for "{states.find(s => s.key === selectedState)?.label}"
              </div>
              {mapping[selectedState].width > 0 && (
                <div className="mt-2 text-xs text-slate-300">
                  Current: x={Math.round(mapping[selectedState].x)}, y={Math.round(mapping[selectedState].y)}, 
                  w={Math.round(mapping[selectedState].width)}, h={Math.round(mapping[selectedState].height)}
                </div>
              )}
            </div>
          </div>

          {/* State Selector */}
          <div className="space-y-4">
            <div className="bg-slate-900 p-4 rounded-lg">
              <h3 className="text-lg font-bold mb-4 text-white">Animation States</h3>
              <div className="space-y-2">
                {states.map(state => {
                  const current = mapping[state.key];
                  const isSelected = selectedState === state.key;
                  return (
                    <div
                      key={state.key}
                      onClick={() => setSelectedState(state.key)}
                      className={`p-3 rounded cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-600 border-2 border-blue-400'
                          : 'bg-slate-800 border-2 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-bold text-white mb-1">{state.label}</div>
                      {current.width > 0 ? (
                        <div className="text-xs text-slate-300">
                          {Math.round(current.width)}×{Math.round(current.height)}px
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic">Not defined</div>
                      )}
                      {isSelected && (
                        <div className="text-xs text-blue-200 mt-1">
                          ✓ Click & drag to select area
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-slate-900 p-4 rounded-lg">
              <h3 className="text-lg font-bold mb-2 text-white">Preview</h3>
              <div className="bg-slate-800 p-4 rounded flex items-center justify-center">
                {mapping[selectedState].width > 0 ? (
                  <div
                    className="pixelated border-2 border-slate-600"
                    style={{
                      width: `${Math.min(128, mapping[selectedState].width * (128 / mapping[selectedState].width))}px`,
                      height: `${Math.min(128, mapping[selectedState].height * (128 / mapping[selectedState].height))}px`,
                      backgroundImage: `url(${ASSETS.AVATAR_URL})`,
                      backgroundSize: `${imageSize.width}px ${imageSize.height}px`,
                      backgroundPosition: `-${mapping[selectedState].x}px -${mapping[selectedState].y}px`,
                    }}
                  />
                ) : (
                  <div className="text-slate-500 text-sm">No area selected</div>
                )}
              </div>
              <div className="text-xs text-slate-400 mt-2 text-center">
                {states.find(s => s.key === selectedState)?.label}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

