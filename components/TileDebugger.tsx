import React, { useState, useEffect, useRef } from 'react';
import { ASSETS, updateTileTypes } from '../constants';
import { parseExistingTiles, suggestTilePositions, fixTileMapping, autoDetectAllTiles } from '../utils/tileAutoDetector';

export interface TileDefinition {
  id: number;
  x: number;
  y: number;
  label: string;
  collision?: boolean;
  tall?: boolean;
}

export const TileDebugger: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTile, setSelectedTile] = useState<{x: number, y: number} | null>(null);
  const [tileSize, setTileSize] = useState(32);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [tiles, setTiles] = useState<TileDefinition[]>([]);
  const [editingTile, setEditingTile] = useState<TileDefinition | null>(null);
  const [newTileLabel, setNewTileLabel] = useState('');
  const [newTileCollision, setNewTileCollision] = useState(false);
  const [newTileTall, setNewTileTall] = useState(false);
  const [importText, setImportText] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{x: number, y: number, reason: string, suggestedLabel?: string}>>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionProgress, setDetectionProgress] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = ASSETS.TILESET_URL;
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      setImageLoaded(true);
      
      // Draw grid overlay
      drawGrid(ctx, img.width, img.height, tileSize);
      
      // Draw markers for already defined tiles
      drawTileMarkers(ctx);
    };
  }, [tileSize, tiles]);

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, size: number) => {
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    
    for (let x = 0; x < width; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y < height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  const drawTileMarkers = (ctx: CanvasRenderingContext2D) => {
    tiles.forEach(tile => {
      // Draw a colored rectangle at the tile position
      ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
      ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
      
      // Draw border
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(tile.x, tile.y, tileSize, tileSize);
      
      // Draw label
      ctx.fillStyle = 'white';
      ctx.font = '10px monospace';
      ctx.fillText(tile.label.substring(0, 8), tile.x + 2, tile.y + 12);
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    
    // Snap to grid
    const gridX = Math.floor(x / tileSize) * tileSize;
    const gridY = Math.floor(y / tileSize) * tileSize;
    
    setSelectedTile({ x: gridX, y: gridY });
    
    // Check if this tile is already defined
    const existingTile = tiles.find(t => t.x === gridX && t.y === gridY);
    if (existingTile) {
      setEditingTile(existingTile);
      setNewTileLabel(existingTile.label);
      setNewTileCollision(existingTile.collision || false);
      setNewTileTall(existingTile.tall || false);
    } else {
      setEditingTile(null);
      setNewTileLabel('');
      setNewTileCollision(false);
      setNewTileTall(false);
    }
  };

  const saveTile = () => {
    if (!selectedTile || !newTileLabel.trim()) return;

    const newTile: TileDefinition = {
      id: tiles.length,
      x: selectedTile.x,
      y: selectedTile.y,
      label: newTileLabel.trim(),
      collision: newTileCollision,
      tall: newTileTall,
    };

    if (editingTile) {
      // Update existing tile
      setTiles(tiles.map(t => 
        t.x === selectedTile.x && t.y === selectedTile.y ? newTile : t
      ));
    } else {
      // Add new tile
      setTiles([...tiles, newTile]);
    }

    // Reset form
    setSelectedTile(null);
    setEditingTile(null);
    setNewTileLabel('');
    setNewTileCollision(false);
    setNewTileTall(false);
  };

  const deleteTile = (tile: TileDefinition) => {
    setTiles(tiles.filter(t => t.x !== tile.x || t.y !== tile.y));
  };

  const importTiles = () => {
    if (!importText.trim()) return;
    
    try {
      const imported = parseExistingTiles(importText);
      const fixed = fixTileMapping(imported);
      setTiles(fixed);
      setImportText('');
      alert(`Imported ${fixed.length} tiles!`);
      
      // Generate suggestions based on imported tiles
      const newSuggestions = suggestTilePositions(fixed, tileSize, 1414, 949);
      setSuggestions(newSuggestions);
    } catch (error) {
      alert('Error importing tiles. Please check the format.');
      console.error(error);
    }
  };

  const generateSuggestions = () => {
    if (tiles.length === 0) {
      alert('Add some tiles first to generate suggestions!');
      return;
    }
    const newSuggestions = suggestTilePositions(tiles, tileSize, 1414, 949);
    setSuggestions(newSuggestions);
  };

  const autoDetectAll = async () => {
    if (!imageLoaded) {
      alert('Please wait for the image to load first.');
      return;
    }
    
    setIsDetecting(true);
    setDetectionProgress(0);
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setDetectionProgress(prev => Math.min(prev + 5, 90));
      }, 100);
      
      const detectedTiles = await autoDetectAllTiles(ASSETS.TILESET_URL, {
        tileSize,
        imageWidth: 1414,
        imageHeight: 949,
        existingTiles: tiles,
      });
      
      clearInterval(progressInterval);
      setDetectionProgress(100);
      
      // Merge with existing tiles (don't overwrite)
      const existingKeys = new Set(tiles.map(t => `${t.x}_${t.y}`));
      const newTiles = detectedTiles.filter(t => !existingKeys.has(`${t.x}_${t.y}`));
      
      setTiles([...tiles, ...newTiles]);
      
      setTimeout(() => {
        setIsDetecting(false);
        setDetectionProgress(0);
        alert(`Auto-detected ${newTiles.length} new tiles! Review and edit labels as needed.`);
      }, 500);
      
    } catch (error) {
      setIsDetecting(false);
      setDetectionProgress(0);
      alert('Error during auto-detection: ' + (error as Error).message);
      console.error(error);
    }
  };

  const useSuggestion = (suggestion: {x: number, y: number, reason: string, suggestedLabel?: string}) => {
    setSelectedTile({ x: suggestion.x, y: suggestion.y });
    if (suggestion.suggestedLabel) {
      setNewTileLabel(suggestion.suggestedLabel);
    }
    setSuggestions(suggestions.filter(s => s.x !== suggestion.x || s.y !== suggestion.y));
  };

  const exportTiles = () => {
    const code = `export const TILE_TYPES: Record<string, TileDef> = {\n${tiles.map((tile, idx) => {
      const key = tile.label.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      // Handle duplicate keys by appending number
      let uniqueKey = key;
      let counter = 1;
      const existingKeys = tiles.slice(0, idx).map(t => t.label.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''));
      while (existingKeys.includes(uniqueKey)) {
        uniqueKey = `${key}_${counter}`;
        counter++;
      }
      
      const props = [
        `id: ${tile.id}`,
        `x: ${tile.x}`,
        `y: ${tile.y}`,
        `label: '${tile.label}'`,
        tile.collision ? `collision: true` : '',
        tile.tall ? `tall: true` : ''
      ].filter(p => p).join(', ');
      return `  ${uniqueKey}: { ${props} },`;
    }).join('\n')}\n};`;
    
    navigator.clipboard.writeText(code);
    alert('Tile definitions copied to clipboard! Paste into constants.ts to update the game.');
  };

  const applyTilesToGame = async () => {
    if (tiles.length === 0) {
      alert('No tiles to apply!');
      return;
    }

    // Sort tiles by y, then x for better organization
    const sortedTiles = [...tiles].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    // Apply tiles directly to the game using localStorage
    updateTileTypes(sortedTiles);
    
    alert(`✅ ${tiles.length} tiles applied! The game will reload automatically.`);
  };

  return (
    <div className="p-4 bg-slate-900 text-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Tile Debugger - Select and Name Your Tiles</h2>
        
        <div className="mb-4 space-y-2">
          <div className="flex gap-4 items-center flex-wrap">
            <div>
              <label className="mr-2">Tile Size:</label>
              <input 
                type="number" 
                value={tileSize} 
                onChange={(e) => setTileSize(parseInt(e.target.value) || 32)}
                className="bg-slate-800 text-white px-2 py-1 rounded w-20"
              />
            </div>
            <button
              onClick={exportTiles}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-bold"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={applyTilesToGame}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded font-bold"
              disabled={tiles.length === 0}
            >
              Apply to Game
            </button>
            <button
              onClick={generateSuggestions}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold"
              disabled={tiles.length === 0}
            >
              Generate Suggestions
            </button>
            <button
              onClick={autoDetectAll}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold"
              disabled={isDetecting || !imageLoaded}
            >
              {isDetecting ? `Detecting... ${detectionProgress}%` : 'Auto-Detect All Tiles'}
            </button>
            <div className="text-sm text-slate-400">
              {tiles.length} tiles defined
            </div>
          </div>
          
          {/* Import Section */}
          <div className="bg-slate-800 p-3 rounded">
            <label className="text-sm font-bold block mb-2">Import Existing Tiles (paste your TILE_TYPES code):</label>
            <div className="flex gap-2">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste your TILE_TYPES definition here..."
                className="flex-1 bg-slate-700 text-white px-2 py-1 rounded text-xs font-mono h-20"
              />
              <button
                onClick={importTiles}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold whitespace-nowrap"
              >
                Import
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Canvas */}
          <div className="lg:col-span-2">
            <div className="mb-4 max-w-full overflow-auto border-2 border-slate-700 bg-slate-800">
              <canvas 
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="cursor-crosshair block"
                style={{ 
                  imageRendering: 'pixelated',
                  maxWidth: '100%',
                  height: 'auto'
                }}
              />
            </div>
            {!imageLoaded && (
              <div className="text-slate-400 text-sm">Loading tileset image...</div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Selected Tile Info */}
            {selectedTile && (
              <div className="bg-slate-800 p-4 rounded-lg">
                <h3 className="font-bold mb-2">Selected Tile</h3>
                <p className="text-sm font-mono mb-4">
                  x: {selectedTile.x}, y: {selectedTile.y}
                </p>
                
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Label:</label>
                    <input
                      type="text"
                      value={newTileLabel}
                      onChange={(e) => setNewTileLabel(e.target.value)}
                      placeholder="e.g., Grass, Dirt, House"
                      className="w-full bg-slate-700 text-white px-2 py-1 rounded text-sm"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="collision"
                      checked={newTileCollision}
                      onChange={(e) => setNewTileCollision(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="collision" className="text-sm">Collision (blocking)</label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="tall"
                      checked={newTileTall}
                      onChange={(e) => setNewTileTall(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="tall" className="text-sm">Tall (extends upward)</label>
                  </div>
                  
                  <button
                    onClick={saveTile}
                    disabled={!newTileLabel.trim()}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editingTile ? 'Update Tile' : 'Add Tile'}
                  </button>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="bg-slate-800 p-4 rounded-lg">
                <h3 className="font-bold mb-2">Suggestions ({suggestions.length})</h3>
                <p className="text-xs text-slate-400 mb-2">Click "Use" to select and auto-fill label</p>
                <div className="space-y-1 max-h-64 overflow-y-auto text-xs">
                  {suggestions.map((suggestion, idx) => (
                    <div key={idx} className="bg-slate-700 p-2 rounded flex justify-between items-center">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs">({suggestion.x}, {suggestion.y})</div>
                        <div className="text-slate-400 text-xs truncate">{suggestion.reason}</div>
                        {suggestion.suggestedLabel && (
                          <div className="text-blue-400 text-xs mt-1">→ "{suggestion.suggestedLabel}"</div>
                        )}
                      </div>
                      <button
                        onClick={() => useSuggestion(suggestion)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs whitespace-nowrap ml-2"
                      >
                        Use
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Defined Tiles List */}
            <div className="bg-slate-800 p-4 rounded-lg">
              <h3 className="font-bold mb-2">Defined Tiles ({tiles.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {tiles.length === 0 ? (
                  <p className="text-sm text-slate-400">No tiles defined yet. Click on the tileset to add tiles, or import existing tiles above.</p>
                ) : (
                  tiles.map((tile, idx) => (
                    <div key={idx} className="bg-slate-700 p-2 rounded text-sm flex justify-between items-center">
                      <div>
                        <div className="font-bold">{tile.label}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          ({tile.x}, {tile.y}) {tile.collision && '🚫'} {tile.tall && '⬆️'}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTile(tile)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs"
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
      </div>
    </div>
  );
};

