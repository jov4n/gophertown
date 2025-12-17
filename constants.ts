import { TileDef } from './types';

// -----------------------------------------------------------------------------
// ASSETS - Using local image files
// -----------------------------------------------------------------------------
// Tileset: file.png - Contains various terrain tiles, structures, and objects
// Avatar: IMG_7112.png - Contains 8 Go Gopher sprites in 4x2 grid layout
//   Row 0: Standing poses (front, right, back, left)
//   Row 1: Sitting poses (front, right, back, left)

// In Vite, we can reference images from the public folder or import them
// Since images are in root, we'll reference them directly
export const ASSETS = {
  TILESET_URL: '/file.png',
  AVATAR_URL: '/IMG_7112.png',
};

// Prebuilt map image dimensions (actual pixel size)
export const MAP_IMAGE = '/map_test.png';
export const MAP_WIDTH = 1536;  // Actual map image width in pixels
export const MAP_HEIGHT = 1024; // Actual map image height in pixels

// WebSocket configuration
// For Fly.io deployment, this will be the same domain as the frontend
// You can set VITE_WS_URL in a .env file or environment variable
// For local development, use ws://localhost:8080
export const WS_URL = (import.meta as any).env?.VITE_WS_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
    ? `wss://${window.location.hostname}` 
    : 'ws://localhost:8080');

// Legacy grid constants (kept for compatibility, but not used for movement/collisions)
export const GRID_WIDTH = 20;
export const GRID_HEIGHT = 15;
export const TILE_SIZE = 32;

// Tileset dimensions: 1414x949 pixels (actual)
// Avatar sheet dimensions: 1536x1024 pixels
// 4 columns x 2 rows = 8 sprites
// Sprite size: 384x512 pixels (will be scaled down in Avatar component)

// Tile mappings for file.png tileset
// Organized by typical tileset layout: terrain first, then structures, then objects
// Coordinates are in pixels (32x32 tile grid)
// Default tiles - can be overridden by tiles stored in localStorage
const DEFAULT_TILE_TYPES: Record<string, TileDef> = {
  // Row 0: Basic terrain
  GRASS: { id: 0, x: 0, y: 0, label: 'Grass' },
  GRASS_ALT: { id: 1, x: 32, y: 0, label: 'Grass Alt' },
  DIRT: { id: 2, x: 64, y: 0, label: 'Dirt' },
  DIRT_ALT: { id: 3, x: 96, y: 0, label: 'Dirt Alt' },
  STONE_PATH: { id: 4, x: 128, y: 0, label: 'Stone Path' },
  STONE_PATH_ALT: { id: 5, x: 160, y: 0, label: 'Stone Path Alt' },
  WOOD_FLOOR: { id: 6, x: 192, y: 0, label: 'Wood Floor' },
  WATER: { id: 7, x: 224, y: 0, label: 'Water', collision: true },
  
  // Row 1: More terrain variations
  WATER_EDGE: { id: 8, x: 0, y: 32, label: 'Water Edge', collision: true },
  SAND: { id: 9, x: 32, y: 32, label: 'Sand' },
  ROCK: { id: 10, x: 64, y: 32, label: 'Rock', collision: true },
  
  // Row 2-3: Vegetation
  TREE: { id: 11, x: 0, y: 64, label: 'Tree', collision: true, tall: true },
  TREE_SMALL: { id: 12, x: 32, y: 64, label: 'Small Tree', collision: true, tall: true },
  BUSH: { id: 13, x: 64, y: 64, label: 'Bush', collision: true },
  BUSH_FLOWERS: { id: 14, x: 96, y: 64, label: 'Flower Bush', collision: true },
  FLOWER: { id: 15, x: 128, y: 64, label: 'Flower' },
  GRASS_TUFT: { id: 16, x: 160, y: 64, label: 'Grass Tuft' },
  
  // Row 4-5: Structures
  HOUSE_BLUE: { id: 17, x: 0, y: 128, label: 'Blue House', collision: true, tall: true },
  HOUSE_ORANGE: { id: 18, x: 32, y: 128, label: 'Orange House', collision: true, tall: true },
  WALL_STONE: { id: 19, x: 64, y: 128, label: 'Stone Wall', collision: true, tall: true },
  FENCE: { id: 20, x: 96, y: 128, label: 'Fence', collision: true, tall: true },
  WELL: { id: 21, x: 128, y: 128, label: 'Well', collision: true, tall: true },
  FIREPLACE: { id: 22, x: 160, y: 128, label: 'Fireplace', collision: true, tall: true },
  BULLETIN_BOARD: { id: 23, x: 192, y: 128, label: 'Bulletin Board', collision: true, tall: true },
  MAILBOX: { id: 24, x: 224, y: 128, label: 'Mailbox', collision: true, tall: true },
  
  // Row 6-7: Furniture and objects
  BENCH: { id: 25, x: 0, y: 192, label: 'Bench', collision: true },
  TABLE: { id: 26, x: 32, y: 192, label: 'Table', collision: true },
  CAMPFIRE: { id: 27, x: 64, y: 192, label: 'Campfire', collision: true },
  BUCKET: { id: 28, x: 96, y: 192, label: 'Bucket' },
  WATERING_CAN: { id: 29, x: 128, y: 192, label: 'Watering Can' },
  SHOVEL: { id: 30, x: 160, y: 192, label: 'Shovel' },
  PICKAXE: { id: 31, x: 192, y: 192, label: 'Pickaxe' },
  COINS: { id: 32, x: 224, y: 192, label: 'Coins' },
};

// Load tiles from localStorage if available, otherwise use defaults
function loadTileTypes(): Record<string, TileDef> {
  try {
    const stored = localStorage.getItem('tileTypes');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert array back to Record format
      const tiles: Record<string, TileDef> = {};
      parsed.forEach((tile: TileDef) => {
        const key = tile.label.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
        // Handle duplicate keys
        let uniqueKey = key;
        let counter = 1;
        while (tiles[uniqueKey]) {
          uniqueKey = `${key}_${counter}`;
          counter++;
        }
        tiles[uniqueKey] = tile;
      });
      return tiles;
    }
  } catch (e) {
    console.warn('Failed to load tiles from localStorage:', e);
  }
  return DEFAULT_TILE_TYPES;
}

export const TILE_TYPES: Record<string, TileDef> = loadTileTypes();

// Function to update tiles (called from TileDebugger)
export function updateTileTypes(tiles: TileDef[]): void {
  // Store in localStorage
  localStorage.setItem('tileTypes', JSON.stringify(tiles));
  
  // Reload the page to apply changes
  window.location.reload();
}

// Get the first available tile ID for initial map (fallback to 0 if no tiles)
function getInitialTileId(): number {
  const grassTile = TILE_TYPES.GRASS || Object.values(TILE_TYPES).find(t => t.label.toLowerCase().includes('grass'));
  if (grassTile) return grassTile.id;
  const firstTile = Object.values(TILE_TYPES)[0];
  return firstTile ? firstTile.id : 0;
}

export const INITIAL_MAP = Array(GRID_WIDTH * GRID_HEIGHT).fill(getInitialTileId());