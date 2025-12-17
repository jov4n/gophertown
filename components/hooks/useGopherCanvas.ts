import { useEffect, useRef, useState, RefObject } from 'react';

// --- MATH HELPERS ---

// Convert RGB (0-255) to HSL (0-360, 0-1, 0-1)
function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

// Convert HSL back to RGB (0-255)
function hslToRgb(h: number, s: number, l: number) {
  let r, g, b;
  h /= 360; // normalize to 0-1

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// --- THE HOOK ---

export function useGopherCanvas(
  canvasRef: RefObject<HTMLCanvasElement>, 
  imageUrl: string, 
  targetColorHex?: string
) {
  // Store the "clean" original image data
  const originalImageDataRef = useRef<ImageData | null>(null);
  
  // Performance optimization: Only store indices of pixels that are "Blue Fur"
  const furIndicesRef = useRef<number[]>([]); 
  const furLightnessRef = useRef<number[]>([]);
  
  const animationFrameRef = useRef<number | null>(null);
  
  // Track when image is loaded to trigger re-render
  const [imageLoaded, setImageLoaded] = useState(false);

  // 1. INITIAL LOAD & INDEXING (Runs once per image URL)
  useEffect(() => {
    if (!imageUrl) return;
    
    let timeoutId: NodeJS.Timeout | null = null;
    let cancelled = false;
    
    // Helper function to load and process the image
    const loadImage = () => {
      if (cancelled) return;
      
      if (!canvasRef.current) {
        // Canvas not ready yet, retry after a short delay
        timeoutId = setTimeout(loadImage, 50);
        return;
      }

      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = imageUrl;

      img.onload = () => {
        if (cancelled) return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Set internal resolution to match the image exactly
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        const indices: number[] = [];
        const lightness: number[] = [];

        // ONE-TIME SCAN: Find the fur pixels
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 10) continue; // Skip transparency

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const [h, s, l] = rgbToHsl(r, g, b);

          // Detect Blue/Cyan Fur (Range 170-260)
          // Saturation > 0.15 ensures we don't pick up white eyes or grey shadows
          const isBlueFur = (h > 170 && h < 260) && (s > 0.15);

          if (isBlueFur) {
            indices.push(i);       // Save location
            lightness.push(l);     // Save shading
          }
        }

        originalImageDataRef.current = imgData;
        furIndicesRef.current = indices;
        furLightnessRef.current = lightness;
        setImageLoaded(true); // Trigger re-render when image is loaded
      };
    };

    loadImage();
    
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      setImageLoaded(false); // Reset when image URL changes
    };
  }, [imageUrl]);

  // 2. RENDER LOOP (Handles Color Swaps & Animations)
  useEffect(() => {
    // Stop any running animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Ensure data is ready
    if (!originalImageDataRef.current || !canvasRef.current || !imageLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If no color provided, just render the original image
    if (!targetColorHex) {
      ctx.putImageData(originalImageDataRef.current, 0, 0);
      return;
    }

    const isRainbow = targetColorHex === '#000' || targetColorHex === '#000000';
    const width = originalImageDataRef.current.width;

    // The Draw Function
    const drawFrame = () => {
      // 1. Reset canvas with clean original data (Fastest method)
      const currentData = new ImageData(
        new Uint8ClampedArray(originalImageDataRef.current!.data),
        originalImageDataRef.current!.width,
        originalImageDataRef.current!.height
      );
      const data = currentData.data;
      
      const indices = furIndicesRef.current;
      const lightness = furLightnessRef.current;
      
      // Calculate target HSL (if not rainbow)
      let targetH = 0, targetS = 0;
      if (!isRainbow) {
        let hex = targetColorHex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const tr = parseInt(hex.substring(0, 2), 16);
        const tg = parseInt(hex.substring(2, 4), 16);
        const tb = parseInt(hex.substring(4, 6), 16);
        [targetH, targetS] = rgbToHsl(tr, tg, tb);
      }

      // Animation time factor (slower = smoother)
      const time = Date.now() / 50; 

      // 2. ONLY loop through the pre-calculated fur pixels
      for (let j = 0; j < indices.length; j++) {
        const i = indices[j]; // The pixel index
        const l = lightness[j]; // The original lightness

        let newRgb;

        if (isRainbow) {
          // --- RAINBOW MATH ---
          const pixelIndex = i / 4;
          const x = pixelIndex % width;
          const y = Math.floor(pixelIndex / width);

          // (x+y) creates diagonal lines.
          // No multiplier = Wide bands.
          // + time = Animation.
          const rainbowHue = (x + y + time) % 360; 
          
          // 0.9 Saturation for vibrant colors
          newRgb = hslToRgb(rainbowHue, 0.9, l); 
        } else {
          // STATIC COLOR
          newRgb = hslToRgb(targetH, targetS, l);
        }

        data[i] = newRgb[0];
        data[i + 1] = newRgb[1];
        data[i + 2] = newRgb[2];
      }

      // 3. Blast data to GPU
      ctx.putImageData(currentData, 0, 0);

      // 4. Loop if rainbow
      if (isRainbow) {
        animationFrameRef.current = requestAnimationFrame(drawFrame);
      }
    };

    // Kick off the draw
    drawFrame();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };

  }, [targetColorHex, imageLoaded]);
}

