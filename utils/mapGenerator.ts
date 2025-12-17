import { GRID_WIDTH, GRID_HEIGHT, TILE_TYPES } from '../constants';

export type MapTheme = 'village' | 'forest' | 'coastal' | 'plains' | 'random';

interface GenerationConfig {
  theme: MapTheme;
  waterChance: number;
  structureChance: number;
  pathChance: number;
}

/**
 * Procedural map generator creating village-style layouts
 */
export class MapGenerator {
  private config: GenerationConfig;
  private map: number[];
  private walkable: boolean[];
  private centerX: number;
  private centerY: number;

  constructor(theme: MapTheme = 'random') {
    this.config = this.getThemeConfig(theme);
    this.map = Array(GRID_WIDTH * GRID_HEIGHT).fill(TILE_TYPES.GRASS.id);
    this.walkable = Array(GRID_WIDTH * GRID_HEIGHT).fill(true);
    this.centerX = Math.floor(GRID_WIDTH / 2);
    this.centerY = Math.floor(GRID_HEIGHT / 2);
  }

  private getThemeConfig(theme: MapTheme): GenerationConfig {
    switch (theme) {
      case 'village':
        return { theme, waterChance: 0.08, structureChance: 0.2, pathChance: 0.15 };
      case 'forest':
        return { theme, waterChance: 0.05, structureChance: 0.15, pathChance: 0.1 };
      case 'coastal':
        return { theme, waterChance: 0.25, structureChance: 0.12, pathChance: 0.12 };
      case 'plains':
        return { theme, waterChance: 0.03, structureChance: 0.1, pathChance: 0.1 };
      default:
        return { theme, waterChance: 0.1, structureChance: 0.15, pathChance: 0.12 };
    }
  }

  /**
   * Generate a complete map
   */
  generate(): number[] {
    // Step 1: Generate base terrain
    this.generateTerrain();

    // Step 2: Create central plaza
    this.createCentralPlaza();

    // Step 3: Create main paths from plaza
    this.createMainPaths();

    // Step 4: Place water bodies (pond)
    this.generateWater();

    // Step 5: Place major structures (houses)
    this.placeHouses();

    // Step 6: Place functional structures (well, mailbox, board)
    this.placeFunctionalStructures();

    // Step 7: Place trees and vegetation
    this.placeVegetation();

    // Step 8: Place decorative elements (benches, tables, campfire)
    this.placeDecorations();

    // Step 9: Add small decorative touches
    this.addSmallDecorations();

    return [...this.map];
  }

  /**
   * Generate base terrain
   */
  private generateTerrain(): void {
    for (let i = 0; i < this.map.length; i++) {
      // Create some variation in grass
      if (Math.random() < 0.1) {
        this.map[i] = TILE_TYPES.GRASS_ALT.id;
      }
    }
  }

  /**
   * Create central stone plaza - make it larger and more prominent
   */
  private createCentralPlaza(): void {
    const radius = 3; // Larger plaza
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = this.centerX + dx;
        const y = this.centerY + dy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT && dist <= radius) {
          const idx = y * GRID_WIDTH + x;
          // Use stone path for plaza, with some variation
          this.map[idx] = Math.random() < 0.3 ? TILE_TYPES.STONE_PATH_ALT.id : TILE_TYPES.STONE_PATH.id;
          this.walkable[idx] = true;
        }
      }
    }
  }

  /**
   * Create main paths branching from plaza
   */
  private createMainPaths(): void {
    const directions = [
      { x: 0, y: -1, name: 'north' },
      { x: 0, y: 1, name: 'south' },
      { x: -1, y: 0, name: 'west' },
      { x: 1, y: 0, name: 'east' }
    ];

    // Create 3-4 main paths from center
    const numPaths = 3 + Math.floor(Math.random() * 2);
    const shuffled = [...directions].sort(() => Math.random() - 0.5);

    for (let i = 0; i < numPaths; i++) {
      const dir = shuffled[i];
      this.createPathFromCenter(dir.x, dir.y);
    }
  }

  /**
   * Create a path extending from center in a direction
   */
  private createPathFromCenter(dx: number, dy: number): void {
    let x = this.centerX;
    let y = this.centerY;
    const length = 6 + Math.floor(Math.random() * 3); // Longer, more visible paths

    // Start from edge of plaza
    x += dx * 4;
    y += dy * 4;

    for (let step = 0; step < length; step++) {
      if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
        const idx = y * GRID_WIDTH + x;
        // Use dirt paths for village theme - make them wider
        if (this.config.theme === 'village') {
          this.map[idx] = TILE_TYPES.DIRT.id;
          // Make paths 2 tiles wide for visibility
          if (dx === 0) { // Vertical path
            if (x > 0) this.map[y * GRID_WIDTH + (x - 1)] = TILE_TYPES.DIRT.id;
            if (x < GRID_WIDTH - 1) this.map[y * GRID_WIDTH + (x + 1)] = TILE_TYPES.DIRT.id;
          } else { // Horizontal path
            if (y > 0) this.map[(y - 1) * GRID_WIDTH + x] = TILE_TYPES.DIRT.id;
            if (y < GRID_HEIGHT - 1) this.map[(y + 1) * GRID_WIDTH + x] = TILE_TYPES.DIRT.id;
          }
        } else {
          this.map[idx] = TILE_TYPES.STONE_PATH.id;
        }
        this.walkable[idx] = true;
      }

      // Continue in direction, less randomness for straighter paths
      if (Math.random() < 0.9) {
        x += dx;
        y += dy;
      } else {
        // Slight curve
        if (Math.random() < 0.5) {
          x += dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : dx;
        } else {
          y += dy === 0 ? (Math.random() < 0.5 ? -1 : 1) : dy;
        }
      }
    }
  }

  /**
   * Generate water bodies (pond)
   */
  private generateWater(): void {
    // Place 1-2 water bodies
    const numPonds = this.config.theme === 'coastal' ? 2 : 1;
    
    for (let p = 0; p < numPonds; p++) {
      // Place pond in a corner or edge area
      const corner = Math.floor(Math.random() * 4);
      let startX: number, startY: number;
      
      switch (corner) {
        case 0: // Top-left
          startX = 2 + Math.floor(Math.random() * 4);
          startY = 2 + Math.floor(Math.random() * 3);
          break;
        case 1: // Top-right
          startX = GRID_WIDTH - 6 + Math.floor(Math.random() * 4);
          startY = 2 + Math.floor(Math.random() * 3);
          break;
        case 2: // Bottom-left
          startX = 2 + Math.floor(Math.random() * 4);
          startY = GRID_HEIGHT - 5 + Math.floor(Math.random() * 3);
          break;
        default: // Bottom-right
          startX = GRID_WIDTH - 6 + Math.floor(Math.random() * 4);
          startY = GRID_HEIGHT - 5 + Math.floor(Math.random() * 3);
          break;
      }

      // Create irregular pond shape
      const pondSize = 3 + Math.floor(Math.random() * 3);
      const pondCells: number[] = [];
      
      for (let dy = -pondSize; dy <= pondSize; dy++) {
        for (let dx = -pondSize; dx <= pondSize; dx++) {
          const x = startX + dx;
          const y = startY + dy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT) {
            // Create irregular shape
            if (dist < pondSize && Math.random() < (1 - dist / pondSize) * 0.8) {
              const idx = y * GRID_WIDTH + x;
              if (this.map[idx] !== TILE_TYPES.STONE_PATH.id && 
                  this.map[idx] !== TILE_TYPES.DIRT.id) {
                pondCells.push(idx);
              }
            }
          }
        }
      }

      // Apply water
      for (const idx of pondCells) {
        this.map[idx] = TILE_TYPES.WATER.id;
        this.walkable[idx] = false;
      }
    }
  }

  /**
   * Place houses in good locations - ensure they're always placed
   */
  private placeHouses(): void {
    const numHouses = this.config.theme === 'village' ? 3 : 2;
    const houseTypes = [TILE_TYPES.HOUSE_BLUE.id, TILE_TYPES.HOUSE_ORANGE.id];
    const placed: number[] = [];

    // Define good house locations (near edges, away from center) - more options
    const locations: { x: number; y: number }[] = [
      { x: GRID_WIDTH - 3, y: 2 }, // Top-right
      { x: GRID_WIDTH - 3, y: GRID_HEIGHT - 3 }, // Bottom-right
      { x: 2, y: GRID_HEIGHT - 3 }, // Bottom-left
      { x: 2, y: 2 }, // Top-left
      { x: GRID_WIDTH - 2, y: Math.floor(GRID_HEIGHT / 2) }, // Right side
      { x: 1, y: Math.floor(GRID_HEIGHT / 2) }, // Left side
      { x: Math.floor(GRID_WIDTH / 2), y: 1 }, // Top
      { x: Math.floor(GRID_WIDTH / 2), y: GRID_HEIGHT - 2 }, // Bottom
    ];

    // Try to place houses, ensuring we get at least numHouses
    let attempts = 0;
    while (placed.length < numHouses && attempts < locations.length * 2) {
      const loc = locations[Math.floor(Math.random() * locations.length)];
      const idx = loc.y * GRID_WIDTH + loc.x;
      
      // Check if location is valid
      if (idx >= 0 && idx < this.map.length && 
          this.walkable[idx] && 
          this.map[idx] !== TILE_TYPES.WATER.id &&
          this.map[idx] !== TILE_TYPES.STONE_PATH.id &&
          this.map[idx] !== TILE_TYPES.DIRT.id) {
        // Check minimum distance from other houses
        let tooClose = false;
        for (const placedIdx of placed) {
          const px = placedIdx % GRID_WIDTH;
          const py = Math.floor(placedIdx / GRID_WIDTH);
          const dist = Math.abs(loc.x - px) + Math.abs(loc.y - py);
          if (dist < 4) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose) {
          this.map[idx] = houseTypes[Math.floor(Math.random() * houseTypes.length)];
          this.walkable[idx] = false;
          placed.push(idx);
        }
      }
      attempts++;
    }
  }

  /**
   * Place functional structures (well, mailbox, bulletin board)
   */
  private placeFunctionalStructures(): void {
    // Place well near center or near a house
    const wellLocations = [
      { x: this.centerX + 3, y: this.centerY },
      { x: this.centerX - 3, y: this.centerY },
      { x: this.centerX, y: this.centerY + 3 },
    ];
    
    for (const loc of wellLocations) {
      if (loc.x >= 0 && loc.x < GRID_WIDTH && loc.y >= 0 && loc.y < GRID_HEIGHT) {
        const idx = loc.y * GRID_WIDTH + loc.x;
        if (this.walkable[idx] && this.map[idx] !== TILE_TYPES.WATER.id) {
          this.map[idx] = TILE_TYPES.WELL.id;
          this.walkable[idx] = false;
          break;
        }
      }
    }

    // Place bulletin board near center plaza
    const boardLocations = [
      { x: this.centerX - 2, y: this.centerY - 3 },
      { x: this.centerX + 2, y: this.centerY - 3 },
    ];
    
    for (const loc of boardLocations) {
      if (loc.x >= 0 && loc.x < GRID_WIDTH && loc.y >= 0 && loc.y < GRID_HEIGHT) {
        const idx = loc.y * GRID_WIDTH + loc.x;
        if (this.walkable[idx] && this.map[idx] !== TILE_TYPES.WATER.id) {
          this.map[idx] = TILE_TYPES.BULLETIN_BOARD.id;
          this.walkable[idx] = false;
          break;
        }
      }
    }

    // Place mailbox near a house or path
    const mailboxLocations = [
      { x: GRID_WIDTH - 5, y: 3 },
      { x: 3, y: GRID_HEIGHT - 4 },
    ];
    
    for (const loc of mailboxLocations) {
      if (loc.x >= 0 && loc.x < GRID_WIDTH && loc.y >= 0 && loc.y < GRID_HEIGHT) {
        const idx = loc.y * GRID_WIDTH + loc.x;
        if (this.walkable[idx] && this.map[idx] !== TILE_TYPES.WATER.id) {
          this.map[idx] = TILE_TYPES.MAILBOX.id;
          this.walkable[idx] = false;
          break;
        }
      }
    }
  }

  /**
   * Place trees and vegetation - ensure they're visible
   */
  private placeVegetation(): void {
    const treeCount = this.config.theme === 'forest' ? 12 : 10; // More trees for village
    const placed: number[] = [];
    let attempts = 0;
    const maxAttempts = treeCount * 10;

    while (placed.length < treeCount && attempts < maxAttempts) {
      // Prefer edges and corners for trees
      let x: number, y: number;
      if (Math.random() < 0.7) {
        // Place near edges
        if (Math.random() < 0.5) {
          x = Math.random() < 0.5 ? Math.floor(Math.random() * 4) : GRID_WIDTH - 1 - Math.floor(Math.random() * 4);
          y = Math.floor(Math.random() * GRID_HEIGHT);
        } else {
          x = Math.floor(Math.random() * GRID_WIDTH);
          y = Math.random() < 0.5 ? Math.floor(Math.random() * 4) : GRID_HEIGHT - 1 - Math.floor(Math.random() * 4);
        }
      } else {
        x = Math.floor(Math.random() * GRID_WIDTH);
        y = Math.floor(Math.random() * GRID_HEIGHT);
      }

      const idx = y * GRID_WIDTH + x;
      
      if (idx >= 0 && idx < this.map.length &&
          this.walkable[idx] && 
          this.map[idx] !== TILE_TYPES.WATER.id &&
          this.map[idx] !== TILE_TYPES.STONE_PATH.id &&
          this.map[idx] !== TILE_TYPES.DIRT.id &&
          this.map[idx] !== TILE_TYPES.STONE_PATH_ALT.id) {
        
        // Check distance from other trees and structures
        let tooClose = false;
        for (const placedIdx of placed) {
          const px = placedIdx % GRID_WIDTH;
          const py = Math.floor(placedIdx / GRID_WIDTH);
          const dist = Math.abs(x - px) + Math.abs(y - py);
          if (dist < 2) {
            tooClose = true;
            break;
          }
        }

        if (!tooClose) {
          this.map[idx] = Math.random() < 0.7 ? TILE_TYPES.TREE.id : TILE_TYPES.TREE_SMALL.id;
          this.walkable[idx] = false;
          placed.push(idx);
        }
      }
      attempts++;
    }
  }

  /**
   * Place decorative structures (benches, tables, campfire)
   */
  private placeDecorations(): void {
    // Place campfire in a corner area (top-left preferred)
    const campfireLocations = [
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 4, y: 3 },
    ];
    
    for (const loc of campfireLocations) {
      if (loc.x >= 0 && loc.x < GRID_WIDTH && loc.y >= 0 && loc.y < GRID_HEIGHT) {
        const idx = loc.y * GRID_WIDTH + loc.x;
        if (this.walkable[idx] && this.map[idx] !== TILE_TYPES.WATER.id) {
          this.map[idx] = TILE_TYPES.CAMPFIRE.id;
          this.walkable[idx] = false;
          break;
        }
      }
    }

    // Place picnic table
    const tableLocations = [
      { x: 4, y: GRID_HEIGHT - 4 },
      { x: GRID_WIDTH - 5, y: 4 },
    ];
    
    for (const loc of tableLocations) {
      if (loc.x >= 0 && loc.x < GRID_WIDTH && loc.y >= 0 && loc.y < GRID_HEIGHT) {
        const idx = loc.y * GRID_WIDTH + loc.x;
        if (this.walkable[idx] && this.map[idx] !== TILE_TYPES.WATER.id) {
          this.map[idx] = TILE_TYPES.TABLE.id;
          this.walkable[idx] = false;
          break;
        }
      }
    }

    // Place benches near paths or plaza
    const benchCount = 2;
    const benchLocations = [
      { x: this.centerX - 4, y: this.centerY },
      { x: this.centerX + 4, y: this.centerY },
      { x: this.centerX, y: this.centerY - 4 },
      { x: this.centerX, y: this.centerY + 4 },
    ];

    let benchesPlaced = 0;
    for (const loc of benchLocations) {
      if (benchesPlaced >= benchCount) break;
      if (loc.x >= 0 && loc.x < GRID_WIDTH && loc.y >= 0 && loc.y < GRID_HEIGHT) {
        const idx = loc.y * GRID_WIDTH + loc.x;
        if (this.walkable[idx] && this.map[idx] !== TILE_TYPES.WATER.id) {
          this.map[idx] = TILE_TYPES.BENCH.id;
          this.walkable[idx] = false;
          benchesPlaced++;
        }
      }
    }
  }

  /**
   * Add small decorative touches (flowers, grass tufts, bushes)
   */
  private addSmallDecorations(): void {
    const decorationTiles = [
      TILE_TYPES.FLOWER.id,
      TILE_TYPES.GRASS_TUFT.id,
      TILE_TYPES.BUSH.id,
      TILE_TYPES.BUSH_FLOWERS.id,
    ];

    for (let i = 0; i < this.map.length; i++) {
      if (this.walkable[i] && 
          this.map[i] === TILE_TYPES.GRASS.id &&
          Math.random() < 0.12) {
        this.map[i] = decorationTiles[Math.floor(Math.random() * decorationTiles.length)];
      }
    }
  }
}

/**
 * Generate a procedural map
 */
export function generateProceduralMap(theme: MapTheme = 'random'): number[] {
  const generator = new MapGenerator(theme);
  return generator.generate();
}
