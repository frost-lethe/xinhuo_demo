import { MAP_TYPES, TERRAIN } from './constants.js';

export function generateMap() {
  const mapType = pickRandom(Object.keys(MAP_TYPES));
  const tiles = createTiles(MAP_TYPES[mapType].counts);
  const coreCandidates = createCoreCandidates(tiles.length);

  return {
    mapType,
    tiles,
    coreCandidates,
  };
}

export function countTerrains(tiles) {
  return tiles.reduce(
    (counts, terrain) => {
      counts[terrain] += 1;
      return counts;
    },
    { [TERRAIN.GRASSLAND]: 0, [TERRAIN.FOREST]: 0, [TERRAIN.MOUNTAIN]: 0 },
  );
}

function createTiles(counts) {
  const tiles = [];

  Object.entries(counts).forEach(([terrain, count]) => {
    for (let index = 0; index < count; index += 1) {
      tiles.push(terrain);
    }
  });

  return shuffle(tiles);
}

function createCoreCandidates() {
  return [
    [0, 1, 4],
    [1, 2, 5],
    [3, 4, 7],
    [4, 5, 8],
    [5, 6, 9],
    [7, 8, 10],
  ].map((tileIndexes, index) => ({
    id: index,
    tileIndexes,
  }));
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
