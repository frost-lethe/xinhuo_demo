import { MAP_TYPES, TERRAIN } from './constants.js';

const HEX_SIZE = 50;
const BOARD_PADDING = 28;

export const HEX_COORDS = Object.freeze([
  { id: 1, q: 0, r: 0 },
  { id: 2, q: 1, r: 0 },
  { id: 3, q: 2, r: 0 },
  { id: 4, q: -1, r: 1 },
  { id: 5, q: 0, r: 1 },
  { id: 6, q: 1, r: 1 },
  { id: 7, q: 2, r: 1 },
  { id: 8, q: -1, r: 2 },
  { id: 9, q: 0, r: 2 },
  { id: 10, q: 1, r: 2 },
  { id: 11, q: -1, r: 3 },
  { id: 12, q: 0, r: 3 },
]);

export function generateMap() {
  const mapType = pickRandom(Object.keys(MAP_TYPES));
  const counts = MAP_TYPES[mapType].counts;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const mapData = createMapData(mapType, createTerrains(counts));

    if (mapData.coreCandidates.length >= 3) {
      return mapData;
    }
  }

  return createMapData(mapType, createSafeTerrains(counts));
}

export function countTerrains(tiles) {
  return tiles.reduce(
    (counts, tile) => {
      counts[tile.terrain] += 1;
      return counts;
    },
    { [TERRAIN.GRASSLAND]: 0, [TERRAIN.FOREST]: 0, [TERRAIN.MOUNTAIN]: 0 },
  );
}

function createTerrains(counts) {
  const terrains = [];

  Object.entries(counts).forEach(([terrain, count]) => {
    for (let index = 0; index < count; index += 1) {
      terrains.push(terrain);
    }
  });

  return shuffle(terrains);
}

function createMapData(mapType, terrains) {
  const geometry = createMapGeometry();
  const tiles = HEX_COORDS.map((coord, index) => ({
    ...coord,
    terrain: terrains[index],
    x: geometry.tileCenters[index].x,
    y: geometry.tileCenters[index].y,
  }));
  const points = geometry.points;
  const coreCandidates = points
    .filter((point) => point.adjacentTileIds.length >= 3)
    .filter((point) => isResourceCompleteCandidate(point, tiles))
    .slice(0, 6)
    .map((point, index) => ({
      ...point,
      candidateNumber: index + 1,
      tileIndexes: point.adjacentTileIds.map((tileId) => tileId - 1),
    }));

  return {
    mapType,
    tiles,
    points,
    coreCandidates,
  };
}

function isResourceCompleteCandidate(point, tiles) {
  const terrains = new Set(
    point.adjacentTileIds.map((tileId) => tiles[tileId - 1].terrain),
  );

  return terrains.has(TERRAIN.GRASSLAND)
    && terrains.has(TERRAIN.FOREST)
    && terrains.has(TERRAIN.MOUNTAIN);
}

function createSafeTerrains(counts) {
  const terrains = Array(HEX_COORDS.length).fill(null);
  const remaining = { ...counts };
  const safeSlots = [
    [0, TERRAIN.GRASSLAND],
    [1, TERRAIN.FOREST],
    [2, TERRAIN.GRASSLAND],
    [3, TERRAIN.GRASSLAND],
    [4, TERRAIN.MOUNTAIN],
    [5, TERRAIN.MOUNTAIN],
    [7, TERRAIN.FOREST],
  ];

  safeSlots.forEach(([index, terrain]) => {
    terrains[index] = terrain;
    remaining[terrain] -= 1;
  });

  HEX_COORDS.forEach((coord, index) => {
    if (terrains[index]) {
      return;
    }

    const terrain = Object.keys(remaining).find((key) => remaining[key] > 0);
    terrains[index] = terrain;
    remaining[terrain] -= 1;
  });

  return terrains;
}

function createMapGeometry() {
  const rawTiles = HEX_COORDS.map((coord) => {
    const center = axialToPixel(coord.q, coord.r);
    const vertices = createVertices(center);

    return {
      ...coord,
      center,
      vertices,
    };
  });
  const bounds = getBounds(rawTiles.flatMap((tile) => tile.vertices));
  const boardWidth = bounds.maxX - bounds.minX + BOARD_PADDING * 2;
  const boardHeight = bounds.maxY - bounds.minY + BOARD_PADDING * 2;
  const pointMap = new Map();

  rawTiles.forEach((tile) => {
    tile.vertices.forEach((vertex) => {
      const normalized = normalizePoint(vertex, bounds, boardWidth, boardHeight);
      const key = `${Math.round(vertex.x * 1000)},${Math.round(vertex.y * 1000)}`;

      if (!pointMap.has(key)) {
        pointMap.set(key, {
          id: key,
          x: normalized.x,
          y: normalized.y,
          adjacentTileIds: [],
        });
      }

      pointMap.get(key).adjacentTileIds.push(tile.id);
    });
  });

  return {
    tileCenters: rawTiles.map((tile) => normalizePoint(tile.center, bounds, boardWidth, boardHeight)),
    points: Array.from(pointMap.values()).map((point) => ({
      ...point,
      adjacentTileIds: point.adjacentTileIds.sort((a, b) => a - b),
    })),
  };
}

function axialToPixel(q, r) {
  return {
    x: HEX_SIZE * Math.sqrt(3) * (q + r / 2),
    y: HEX_SIZE * 1.5 * r,
  };
}

function createVertices(center) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((-90 + 60 * index) * Math.PI) / 180;

    return {
      x: center.x + HEX_SIZE * Math.cos(angle),
      y: center.y + HEX_SIZE * Math.sin(angle),
    };
  });
}

function getBounds(points) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

function normalizePoint(point, bounds, boardWidth, boardHeight) {
  return {
    x: ((point.x - bounds.minX + BOARD_PADDING) / boardWidth) * 100,
    y: ((point.y - bounds.minY + BOARD_PADDING) / boardHeight) * 100,
  };
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}
