// -----------------------------------------------------------------------------
// ASSETS - Using local image files
// -----------------------------------------------------------------------------
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