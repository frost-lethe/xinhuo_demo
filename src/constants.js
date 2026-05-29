export const GAME_TITLE = '薪火';
export const MAX_ERA = 15;
export const ERA_SECONDS = 60;
export const INITIAL_GENERATION = 1;
export const INITIAL_ERA = 1;
export const INITIAL_HOUSEHOLDS = 4;
export const INITIAL_HOUSEHOLD_CAPACITY = 8;
export const BUILDING_COUNT_P0 = 1;

export const RESOURCE_KEYS = ['food', 'fuel', 'material'];

export const TERRAIN = Object.freeze({
  GRASSLAND: 'grassland',
  FOREST: 'forest',
  MOUNTAIN: 'mountain',
});

export const TERRAIN_LABELS = Object.freeze({
  grassland: '草原',
  forest: '森林',
  mountain: '山地',
});

export const RESOURCE_LABELS = Object.freeze({
  food: '食物',
  fuel: '燃料',
  material: '材料',
});

export const WORK_RULES = Object.freeze({
  grassland: {
    name: '采集',
    resource: 'food',
    amount: 3,
    progressNeeded: 50,
  },
  forest: {
    name: '伐木',
    resource: 'fuel',
    amount: 3,
    progressNeeded: 50,
  },
  mountain: {
    name: '拾石',
    resource: 'material',
    amount: 3,
    progressNeeded: 50,
  },
});

export const MAP_TYPES = Object.freeze({
  寒冷: {
    counts: { grassland: 3, forest: 5, mountain: 4 },
    earlyDisaster: '第4-5纪寒潮',
    midDisaster: '第8-10纪严冬',
  },
  干燥: {
    counts: { grassland: 5, forest: 3, mountain: 4 },
    earlyDisaster: '第4-5纪干旱',
    midDisaster: '第8-10纪大旱',
  },
  河谷: {
    counts: { grassland: 4, forest: 4, mountain: 4 },
    earlyDisaster: '第4-5纪干旱',
    midDisaster: '第8-10纪洪水',
  },
  山地: {
    counts: { grassland: 3, forest: 4, mountain: 5 },
    earlyDisaster: '第4-5纪兽群',
    midDisaster: '第8-10纪地震',
  },
  荒野: {
    counts: { grassland: 4, forest: 3, mountain: 5 },
    earlyDisaster: '第4-5纪兽群',
    midDisaster: '第8-10纪大旱',
  },
});
