import { GRID_WIDTH, GRID_HEIGHT } from "../constants";

interface Point { x: number; y: number; }

export const findPath = (
  start: Point, 
  end: Point, 
  isWalkable: (x: number, y: number) => boolean
): Point[] | null => {
  if (!isWalkable(end.x, end.y)) return null;
  if (start.x === end.x && start.y === end.y) return [];

  const queue: { pos: Point; path: Point[] }[] = [{ pos: start, path: [] }];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);

  // Limit BFS depth for performance on large maps or mobile
  let iterations = 0;
  const MAX_ITERATIONS = 1000;

  while (queue.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    const { pos, path } = queue.shift()!;

    if (pos.x === end.x && pos.y === end.y) {
      return path;
    }

    // Directions: Up, Down, Left, Right
    const neighbors = [
      { x: pos.x, y: pos.y - 1 },
      { x: pos.x, y: pos.y + 1 },
      { x: pos.x - 1, y: pos.y },
      { x: pos.x + 1, y: pos.y },
    ];

    for (const n of neighbors) {
      const key = `${n.x},${n.y}`;
      if (
        n.x >= 0 && n.x < GRID_WIDTH &&
        n.y >= 0 && n.y < GRID_HEIGHT &&
        !visited.has(key) &&
        isWalkable(n.x, n.y)
      ) {
        visited.add(key);
        queue.push({ pos: n, path: [...path, n] });
      }
    }
  }
  return null;
};