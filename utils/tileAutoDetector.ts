// Auto-detection utilities for tileset mapping
import { TileDefinition } from '../components/TileDebugger';

export interface ExistingTileMapping {
  [key: string]: {
    id: number;
    x: number;
    y: number;
    label: string;
  };
}

export interface AutoDetectOptions {
  tileSize: number;
  imageWidth: number;
  imageHeight: number;
  existingTiles: TileDefinition[];
  minTileSize?: number;
  maxTileSize?: number;
}

/**
 * Parse the user's existing tile mapping and fix issues
 */
export function parseExistingTiles(mappingString: string): TileDefinition[] {
  const tiles: TileDefinition[] = [];
  const seen = new Set<string>();
  let currentId = 0;

  // Extract tile definitions from the string
  const tileRegex = /(\w+):\s*{\s*id:\s*(\d+),\s*x:\s*(\d+),\s*y:\s*(\d+),\s*label:\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = tileRegex.exec(mappingString)) !== null) {
    const [, key, idStr, xStr, yStr, label] = match;
    const id = parseInt(idStr);
    const x = parseInt(xStr);
    const y = parseInt(yStr);

    // Create unique key to avoid duplicates
    const uniqueKey = `${x}_${y}`;
    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      
      // Determine properties from label
      const collision = label.toLowerCase().includes('sign') || 
                       label.toLowerCase().includes('bush') ||
                       label.toLowerCase().includes('lake');
      const tall = label.toLowerCase().includes('sign') || 
                   label.toLowerCase().includes('tree');

      tiles.push({
        id: currentId++,
        x,
        y,
        label: label.trim(),
        collision,
        tall,
      });
    }
  }

  return tiles;
}

/**
 * Suggest potential tile positions based on existing tiles
 * Looks for patterns in the grid and nearby positions
 */
export function suggestTilePositions(
  existingTiles: TileDefinition[],
  tileSize: number = 32,
  imageWidth: number = 1414,
  imageHeight: number = 949
): Array<{x: number, y: number, reason: string, suggestedLabel?: string}> {
  const suggestions: Array<{x: number, y: number, reason: string, suggestedLabel?: string}> = [];
  const occupied = new Set<string>();
  
  // Mark occupied positions
  existingTiles.forEach(tile => {
    occupied.add(`${tile.x}_${tile.y}`);
  });

  // Find patterns - look for tiles in rows/columns
  const rows = new Map<number, {x: number, label: string}[]>();
  const cols = new Map<number, {y: number, label: string}[]>();
  
  existingTiles.forEach(tile => {
    if (!rows.has(tile.y)) rows.set(tile.y, []);
    rows.get(tile.y)!.push({x: tile.x, label: tile.label});
    
    if (!cols.has(tile.x)) cols.set(tile.x, []);
    cols.get(tile.x)!.push({y: tile.y, label: tile.label});
  });

  // Suggest tiles in same rows (likely same type variations)
  rows.forEach((tilesInRow, y) => {
    const xPositions = tilesInRow.map(t => t.x).sort((a, b) => a - b);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);
    
    // Get common label prefix from this row
    const labels = tilesInRow.map(t => t.label);
    const commonPrefix = getCommonPrefix(labels);
    
    // Check for gaps in the row (within the range of existing tiles)
    for (let x = minX; x <= maxX + tileSize * 3; x += tileSize) {
      const key = `${x}_${y}`;
      if (!occupied.has(key) && x < imageWidth && x >= 0) {
        const distance = Math.min(...xPositions.map(px => Math.abs(x - px)));
        suggestions.push({
          x,
          y,
          reason: `Gap in row at y=${y} (${commonPrefix || 'similar'} tiles nearby)`,
          suggestedLabel: commonPrefix ? `${commonPrefix} ${Math.floor((x - minX) / tileSize) + 1}` : undefined
        });
      }
    }
    
    // Also suggest tiles before and after the row
    for (let offset = -tileSize * 2; offset <= tileSize * 2; offset += tileSize) {
      if (offset === 0) continue;
      const checkX = minX + offset;
      const key = `${checkX}_${y}`;
      if (!occupied.has(key) && checkX >= 0 && checkX < imageWidth) {
        suggestions.push({
          x: checkX,
          y,
          reason: `Near ${commonPrefix || 'similar'} tiles in row y=${y}`,
          suggestedLabel: commonPrefix ? `${commonPrefix} Variant` : undefined
        });
      }
    }
  });

  // Suggest tiles in same columns
  cols.forEach((tilesInCol, x) => {
    const yPositions = tilesInCol.map(t => t.y).sort((a, b) => a - b);
    const minY = Math.min(...yPositions);
    const maxY = Math.max(...yPositions);
    
    const labels = tilesInCol.map(t => t.label);
    const commonPrefix = getCommonPrefix(labels);
    
    for (let y = minY; y <= maxY + tileSize * 3; y += tileSize) {
      const key = `${x}_${y}`;
      if (!occupied.has(key) && y < imageHeight && y >= 0) {
        suggestions.push({
          x,
          y,
          reason: `Gap in column at x=${x} (${commonPrefix || 'similar'} tiles nearby)`,
          suggestedLabel: commonPrefix ? `${commonPrefix} ${Math.floor((y - minY) / tileSize) + 1}` : undefined
        });
      }
    }
  });

  // Suggest tiles adjacent to existing ones (8-directional)
  existingTiles.forEach(tile => {
    const directions = [
      {dx: tileSize, dy: 0, name: 'right'},
      {dx: -tileSize, dy: 0, name: 'left'},
      {dx: 0, dy: tileSize, name: 'below'},
      {dx: 0, dy: -tileSize, name: 'above'},
      {dx: tileSize, dy: tileSize, name: 'bottom-right'},
      {dx: -tileSize, dy: tileSize, name: 'bottom-left'},
      {dx: tileSize, dy: -tileSize, name: 'top-right'},
      {dx: -tileSize, dy: -tileSize, name: 'top-left'},
    ];
    
    directions.forEach(dir => {
      const newX = tile.x + dir.dx;
      const newY = tile.y + dir.dy;
      const key = `${newX}_${newY}`;
      
      if (!occupied.has(key) && 
          newX >= 0 && newX < imageWidth && 
          newY >= 0 && newY < imageHeight) {
        suggestions.push({
          x: newX,
          y: newY,
          reason: `${dir.name} of "${tile.label}"`,
          suggestedLabel: `${tile.label} ${dir.name}`
        });
      }
    });
  });

  // Remove duplicates and sort by relevance
  const unique = new Map<string, typeof suggestions[0]>();
  suggestions.forEach(s => {
    const key = `${s.x}_${s.y}`;
    if (!unique.has(key) || (s.suggestedLabel && !unique.get(key)!.suggestedLabel)) {
      unique.set(key, s);
    }
  });

  return Array.from(unique.values()).slice(0, 50); // More suggestions
}

/**
 * Auto-detect ALL tiles in the entire image
 */
export async function autoDetectAllTiles(
  imageUrl: string,
  options: AutoDetectOptions
): Promise<TileDefinition[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      
      const tiles: TileDefinition[] = [];
      const occupied = new Set<string>();
      
      // Mark existing tiles as occupied
      options.existingTiles.forEach(tile => {
        occupied.add(`${tile.x}_${tile.y}`);
      });
      
      const tileSize = options.tileSize;
      const cols = Math.floor(img.width / tileSize);
      const rows = Math.floor(img.height / tileSize);
      
      let nextId = options.existingTiles.length > 0 
        ? Math.max(...options.existingTiles.map(t => t.id)) + 1 
        : 0;
      
      // Scan entire image in grid pattern
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * tileSize;
          const y = row * tileSize;
          const key = `${x}_${y}`;
          
          // Skip if already defined
          if (occupied.has(key)) continue;
          
          // Check if this tile area has content (not completely transparent/empty)
          if (hasTileContent(imageData, x, y, tileSize, img.width)) {
            // Try to infer label from position and nearby tiles
            const label = inferTileLabel(x, y, options.existingTiles, row, col);
            const properties = inferTileProperties(label, options.existingTiles, x, y);
            
            tiles.push({
              id: nextId++,
              x,
              y,
              label,
              ...properties
            });
          }
        }
      }
      
      resolve(tiles);
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
  });
}

/**
 * Check if a tile area has actual content (not empty/transparent)
 */
function hasTileContent(
  imageData: ImageData,
  x: number,
  y: number,
  tileSize: number,
  imageWidth: number
): boolean {
  // Sample a few pixels in the tile to see if it has content
  const samples = [
    {x: x + tileSize / 4, y: y + tileSize / 4},
    {x: x + tileSize / 2, y: y + tileSize / 2},
    {x: x + tileSize * 3 / 4, y: y + tileSize * 3 / 4},
  ];
  
  for (const sample of samples) {
    const pixelX = Math.floor(sample.x);
    const pixelY = Math.floor(sample.y);
    const index = (pixelY * imageWidth + pixelX) * 4;
    
    if (index < imageData.data.length) {
      const alpha = imageData.data[index + 3];
      // If pixel has some opacity, consider it content
      if (alpha > 10) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Infer tile label based on position and nearby tiles
 */
function inferTileLabel(
  x: number,
  y: number,
  existingTiles: TileDefinition[],
  row: number,
  col: number
): string {
  // Check for nearby tiles with similar coordinates
  const nearbyTiles = existingTiles.filter(t => {
    const dx = Math.abs(t.x - x);
    const dy = Math.abs(t.y - y);
    return dx < 128 && dy < 128; // Within 4 tiles
  });
  
  if (nearbyTiles.length > 0) {
    // Find most common label prefix
    const labels = nearbyTiles.map(t => t.label);
    const prefix = getCommonPrefix(labels);
    if (prefix) {
      // Check if it's a variant (different position in same row/column)
      const sameRow = nearbyTiles.filter(t => Math.abs(t.y - y) < 32);
      const sameCol = nearbyTiles.filter(t => Math.abs(t.x - x) < 32);
      
      if (sameRow.length > 0) {
        const rowTiles = sameRow.sort((a, b) => a.x - b.x);
        const index = rowTiles.findIndex(t => t.x > x) !== -1 
          ? rowTiles.findIndex(t => t.x > x)
          : rowTiles.length;
        return `${prefix} ${index + 1}`;
      }
      
      if (sameCol.length > 0) {
        const colTiles = sameCol.sort((a, b) => a.y - b.y);
        const index = colTiles.findIndex(t => t.y > y) !== -1
          ? colTiles.findIndex(t => t.y > y)
          : colTiles.length;
        return `${prefix} ${index + 1}`;
      }
      
      return `${prefix} Variant`;
    }
  }
  
  // Default naming based on position
  const categories = [
    {yMax: 200, name: 'Terrain'},
    {yMax: 400, name: 'Vegetation'},
    {yMax: 600, name: 'Structures'},
    {yMax: 800, name: 'Objects'},
    {yMax: Infinity, name: 'Misc'}
  ];
  
  const category = categories.find(c => y < c.yMax) || categories[categories.length - 1];
  return `${category.name} (${col},${row})`;
}

/**
 * Infer tile properties (collision, tall) based on label and nearby tiles
 */
function inferTileProperties(
  label: string,
  existingTiles: TileDefinition[],
  x: number,
  y: number
): {collision?: boolean, tall?: boolean} {
  const labelLower = label.toLowerCase();
  
  // Check label keywords
  const collisionKeywords = ['sign', 'bush', 'tree', 'house', 'wall', 'fence', 'well', 'lake', 'water', 'rock', 'stone', 'bench', 'table', 'campfire'];
  const tallKeywords = ['sign', 'tree', 'house', 'wall', 'fence', 'well'];
  
  const collision = collisionKeywords.some(kw => labelLower.includes(kw));
  const tall = tallKeywords.some(kw => labelLower.includes(kw));
  
  // Also check nearby tiles for similar properties
  const nearby = existingTiles.filter(t => {
    const dx = Math.abs(t.x - x);
    const dy = Math.abs(t.y - y);
    return dx < 64 && dy < 64;
  });
  
  if (nearby.length > 0) {
    const nearbyCollision = nearby.filter(t => t.collision).length;
    const nearbyTall = nearby.filter(t => t.tall).length;
    
    // If most nearby tiles have a property, apply it
    if (nearbyCollision > nearby.length / 2 && !collision) {
      return { collision: true, tall: nearbyTall > nearby.length / 2 || tall };
    }
    if (nearbyTall > nearby.length / 2 && !tall) {
      return { collision: collision || nearbyCollision > nearby.length / 2, tall: true };
    }
  }
  
  return { collision: collision || undefined, tall: tall || undefined };
}

/**
 * Get common prefix from array of labels
 */
function getCommonPrefix(labels: string[]): string | null {
  if (labels.length === 0) return null;
  if (labels.length === 1) {
    // Try to extract base name (remove numbers, variants, etc.)
    return labels[0].split(/\s+/)[0];
  }
  
  const words = labels.map(l => l.split(/\s+/));
  const firstWords = words.map(w => w[0].toLowerCase());
  
  // Check if all start with same word
  const firstWord = firstWords[0];
  if (firstWords.every(w => w === firstWord)) {
    return labels[0].split(/\s+/)[0];
  }
  
  return null;
}

/**
 * Fix common issues in tile mapping
 */
export function fixTileMapping(tiles: TileDefinition[]): TileDefinition[] {
  const fixed: TileDefinition[] = [];
  const seen = new Map<string, TileDefinition>();
  let nextId = 0;

  tiles.forEach(tile => {
    const key = `${tile.x}_${tile.y}`;
    
    // Fix duplicate coordinates (keep first occurrence)
    if (!seen.has(key)) {
      // Fix typos in labels
      let fixedLabel = tile.label;
      if (fixedLabel.toLowerCase().includes('gross')) {
        fixedLabel = fixedLabel.replace(/gross/gi, 'Grass');
      }
      
      fixed.push({
        ...tile,
        id: nextId++,
        label: fixedLabel,
      });
      seen.set(key, tile);
    }
  });

  return fixed;
}

