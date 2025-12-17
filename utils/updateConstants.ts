// Utility to update constants.ts with new tile definitions
// This will be called from the TileDebugger component

export async function updateConstantsFile(tileTypesCode: string): Promise<boolean> {
  try {
    // Read current constants.ts
    const response = await fetch('/constants.ts');
    if (!response.ok) {
      throw new Error('Could not read constants.ts');
    }
    
    let content = await response.text();
    
    // Find and replace TILE_TYPES definition
    const startMarker = 'export const TILE_TYPES: Record<string, TileDef> = {';
    const endMarker = '};';
    
    const startIndex = content.indexOf(startMarker);
    if (startIndex === -1) {
      throw new Error('Could not find TILE_TYPES definition');
    }
    
    // Find the end of TILE_TYPES (look for closing brace and semicolon)
    let braceCount = 0;
    let endIndex = startIndex;
    let foundStart = false;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    
    // Replace the TILE_TYPES section
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex);
    const newContent = before + tileTypesCode + '\n' + after;
    
    // Write back (this would require a backend API, so for now we'll use clipboard)
    // For now, return false to use clipboard fallback
    return false;
  } catch (error) {
    console.error('Error updating constants:', error);
    return false;
  }
}

