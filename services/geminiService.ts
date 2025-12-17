import { GoogleGenAI, Type } from "@google/genai";
import { GRID_HEIGHT, GRID_WIDTH, TILE_TYPES } from "../constants";

export const generateMapLayout = async (prompt: string): Promise<number[]> => {
  if (!process.env.API_KEY) {
    console.error("API Key missing");
    return [];
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are a map generator for a 2D RPG game.
    The map size is ${GRID_WIDTH}x${GRID_HEIGHT} (Total ${GRID_WIDTH * GRID_HEIGHT} tiles).
    
    Available Tile IDs:
    0: Grass (Walkable)
    1: Dirt (Walkable path)
    2: Water (Block)
    3: Stone (Walkable)
    5: Wall (Block)
    6: Tree (Block)
    7: House (Block)

    Generate a 1D array of integers representing the map grid.
    Focus on creating a playable, aesthetic layout (e.g., a village with paths, a lake, some forests).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a map based on this description: ${prompt}`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tiles: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
            },
            description: { type: Type.STRING }
          },
          required: ["tiles"]
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    
    // Validate output length
    let tiles = json.tiles || [];
    if (tiles.length !== GRID_WIDTH * GRID_HEIGHT) {
      // Fill or truncate
      tiles = tiles.slice(0, GRID_WIDTH * GRID_HEIGHT);
      while (tiles.length < GRID_WIDTH * GRID_HEIGHT) {
        tiles.push(0);
      }
    }
    return tiles;

  } catch (error) {
    console.error("Gemini Map Generation Error:", error);
    throw error;
  }
};
