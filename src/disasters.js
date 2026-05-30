import { RESOURCE_LABELS, TERRAIN } from './constants.js';

export const DISASTER_DESCRIPTIONS = Object.freeze({
  寒潮: '提高燃料压力。',
  干旱: '削弱食物生产或损失食物库存。',
  兽群: '需要材料抵御冲击。',
  严冬: '中期高燃料压力。',
  大旱: '中期食物压力。',
  洪水: '损失库存并消耗材料。',
  地震: '消耗材料维护聚落。',
  终末失序: '第12纪后世界秩序松动，库存会持续流失。',
});

export function getMapDisasterProfile(mapType) {
  const profiles = {
    寒冷: { early: '寒潮', mid: '严冬' },
    干燥: { early: '干旱', mid: '大旱' },
    河谷: { early: '干旱', mid: '洪水' },
    山地: { early: '兽群', mid: '地震' },
    荒野: { early: '兽群', mid: '大旱' },
  };

  return profiles[mapType];
}

export function getBuildingCount() {
  return 1;
}

export function getEraDisasterEffects(mapType, era, state = null) {
  const effects = {
    disasterNames: [],
    inventoryLoss: { food: 0, fuel: 0, material: 0 },
    efficiency: { all: 1, food: 1, fuel: 1, material: 1 },
    fuelMultiplier: 1,
    extraFuelPerHousehold: 0,
    materialDemand: 0,
    notes: [],
    inventoryNotes: [],
    efficiencyNotes: [],
    fuelNotes: [],
    materialNotes: [],
    warning: '本纪灾害：无。',
  };

  applyMapDisaster(effects, mapType, era, state);
  applyEndgameDisorder(effects, era, state);
  effects.warning = createWarning(effects);

  return effects;
}

export function getWorkEfficiencyMultiplier(effects, terrain) {
  const resource = terrain === TERRAIN.GRASSLAND
    ? 'food'
    : terrain === TERRAIN.FOREST
      ? 'fuel'
      : 'material';

  return effects.efficiency.all * effects.efficiency[resource];
}

export function getDisasterAtmosphere(mapType, era) {
  const effects = getEraDisasterEffects(mapType, era);
  const names = effects.disasterNames;

  if (names.includes('终末失序')) {
    return pick([
      '有人梦见第十五纪没有日出。',
      '储藏本身也开始失去意义。',
      '世界不是降下一场灾，而是在逐渐松开秩序。',
    ]);
  }

  if (names.includes('寒潮') || names.includes('严冬')) {
    return pick([
      '寒意正在聚拢，火种变得比粮食更重要。',
      '远处的风像刀一样吹过聚落边缘。',
    ]);
  }

  if (names.includes('干旱') || names.includes('大旱')) {
    return pick([
      '土地开始干裂，草原上的收获变得迟缓。',
      '谷物尚未枯死，但丰收已经远去。',
    ]);
  }

  if (names.includes('兽群')) {
    return pick([
      '夜里传来兽群的低吼。',
      '边缘的户说，他们看见了成群的影子。',
    ]);
  }

  if (names.includes('洪水')) {
    return pick([
      '河水上涨，仓储不再可靠。',
      '潮湿侵入燃料堆，库存开始变得脆弱。',
    ]);
  }

  if (names.includes('地震')) {
    return pick([
      '大地发出低沉的响声。',
      '墙体出现细纹，材料储备或许会派上用场。',
    ]);
  }

  return '远处传来风声，族人更加警醒。';
}

function applyMapDisaster(effects, mapType, era, state) {
  const profile = getMapDisasterProfile(mapType);

  if (profile?.early === '寒潮') {
    if (era === 4) addFuelMultiplier(effects, '寒潮', 0.1, '基础燃料消耗 +10%。');
    if (era === 5) addExtraFuel(effects, '寒潮', 0.5, '每户额外燃料需求 +0.5。');
  }

  if (profile?.early === '干旱') {
    if (era === 4) addFoodEfficiency(effects, '干旱', 0.9, '草原效率 -10%。');
    if (era === 5) addInventoryLoss(effects, '干旱', 'food', 0.08, '食物库存损失 8%。');
  }

  if (profile?.early === '兽群') {
    if (era === 4) addNoteOnly(effects, '兽群', '兽群逼近，外派工作风险上升。');
    if (era === 5) addMaterialDemand(effects, '兽群', Math.ceil((state?.households ?? 0) * 0.5), '材料需求 = ceil(当前户数 x0.5)。');
  }

  if (profile?.mid === '严冬') {
    if (era === 8) addFuelMultiplier(effects, '严冬', 0.1, '基础燃料消耗 +10%。');
    if (era === 9) addFuelMultiplier(effects, '严冬', 0.15, '基础燃料消耗 +15%。');
    if (era === 10) addExtraFuel(effects, '严冬', 1, '每户额外燃料需求 +1。');
  }

  if (profile?.mid === '大旱') {
    if (era === 8) addFoodEfficiency(effects, '大旱', 0.88, '食物类工作效率 -12%。');
    if (era === 9) addFoodEfficiency(effects, '大旱', 0.82, '食物类工作效率 -18%。');
    if (era === 10) addInventoryLoss(effects, '大旱', 'food', 0.12, '食物库存损失 12%。');
  }

  if (profile?.mid === '洪水') {
    if (era === 8) addInventoryLoss(effects, '洪水', 'food', 0.05, '食物库存损失 5%。');
    if (era === 9) {
      addInventoryLoss(effects, '洪水', 'food', 0.08, '食物库存损失 8%。');
      addInventoryLoss(effects, '洪水', 'fuel', 0.05, '燃料库存损失 5%。');
    }
    if (era === 10) {
      addMaterialDemand(effects, '洪水', getBuildingCount(state) * 4, '材料需求 = 建筑数 x4。');
      addInventoryLoss(effects, '洪水', 'food', 0.1, '食物库存损失 10%。');
    }
  }

  if (profile?.mid === '地震') {
    if (era === 8) addNoteOnly(effects, '地震', '地面传来细碎震动，建筑维护压力正在上升。');
    if (era === 9) addMaterialDemand(effects, '地震', getBuildingCount(state) * 3, '材料需求 = 建筑数 x3。');
    if (era === 10) addMaterialDemand(effects, '地震', getBuildingCount(state) * 5, '材料需求 = 建筑数 x5。');
  }
}

function applyEndgameDisorder(effects, era, state) {
  if (era < 12 || era > 15) {
    return;
  }

  ['food', 'fuel', 'material'].forEach((resource) => {
    addInventoryLoss(effects, '终末失序', resource, 0.05, `${RESOURCE_LABELS[resource]}库存损失 5%。`);
  });

  if (era === 12) {
    addAllEfficiency(effects, '终末失序', 0.92, '所有工作效率 -8%。');
    addFuelMultiplier(effects, '终末失序', 0.1, '基础燃料消耗 +10%。');
  }

  if (era === 13) {
    addFoodEfficiency(effects, '终末失序', 0.88, '食物类工作效率 -12%。');
    addInventoryLoss(effects, '终末失序', 'food', 0.1, '食物库存损失 10%。');
  }

  if (era === 14) {
    addMaterialDemand(effects, '终末失序', getBuildingCount(state) * 5, '材料需求 = 建筑数 x5。');
  }

  if (era === 15) {
    addExtraFuel(effects, '终末失序', 1, '每户额外燃料需求 +1。');
    addInventoryLoss(effects, '终末失序', 'food', 0.12, '食物库存损失 12%。');
    addMaterialDemand(effects, '终末失序', getBuildingCount(state) * 6, '材料需求 = 建筑数 x6。');
  }
}

function addDisasterName(effects, name) {
  if (!effects.disasterNames.includes(name)) {
    effects.disasterNames.push(name);
  }
}

function addNoteOnly(effects, name, note) {
  addDisasterName(effects, name);
  effects.notes.push(`${name}：${note}`);
}

function addInventoryLoss(effects, name, resource, amount, note) {
  addDisasterName(effects, name);
  effects.inventoryLoss[resource] += amount;
  effects.inventoryNotes.push({ name, resource, rate: amount, note });
  effects.notes.push(`${name}：${note}`);
}

function addFoodEfficiency(effects, name, multiplier, note) {
  addDisasterName(effects, name);
  effects.efficiency.food *= multiplier;
  effects.efficiencyNotes.push({ name, scope: '草原', multiplier, note });
  effects.notes.push(`${name}：${note}`);
}

function addAllEfficiency(effects, name, multiplier, note) {
  addDisasterName(effects, name);
  effects.efficiency.all *= multiplier;
  effects.efficiencyNotes.push({ name, scope: '所有工作', multiplier, note });
  effects.notes.push(`${name}：${note}`);
}

function addFuelMultiplier(effects, name, amount, note) {
  addDisasterName(effects, name);
  effects.fuelMultiplier += amount;
  effects.fuelNotes.push({ name, amount, note });
  effects.notes.push(`${name}：${note}`);
}

function addExtraFuel(effects, name, amount, note) {
  addDisasterName(effects, name);
  effects.extraFuelPerHousehold += amount;
  effects.fuelNotes.push({ name, amount, note, extra: true });
  effects.notes.push(`${name}：${note}`);
}

function addMaterialDemand(effects, name, amount, note) {
  addDisasterName(effects, name);
  effects.materialDemand += amount;
  effects.materialNotes.push({ name, amount, note });
  effects.notes.push(`${name}：${note}`);
}

function createWarning(effects) {
  if (effects.notes.length === 0) {
    return '本纪灾害：无。';
  }

  if (effects.disasterNames.includes('终末失序')) {
    return `终末失序正在发生：${effects.notes.join(' ')}`;
  }

  return `本纪灾害：${effects.disasterNames.join('、')}。${effects.notes.join(' ')}`;
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}
