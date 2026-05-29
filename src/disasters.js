import { BUILDING_COUNT_P0 } from './constants.js';

export function getEraDisasterEffects(mapType, era) {
  const effects = {
    inventoryLoss: { food: 0, fuel: 0, material: 0 },
    efficiency: { all: 1, food: 1, fuel: 1, material: 1 },
    fuelMultiplier: 1,
    extraFuelPerHousehold: 0,
    materialDemand: 0,
    notes: [],
  };

  applyMapDisaster(effects, mapType, era);
  applyEndgameDisorder(effects, era);

  return effects;
}

export function getNextDisasterWarning(mapType, era) {
  const nextEra = era + 1;
  const effects = getEraDisasterEffects(mapType, nextEra);

  if (effects.notes.length === 0) {
    return '下一纪暂无明确灾难。';
  }

  return `下一纪预警：${effects.notes.join('；')}`;
}

function applyMapDisaster(effects, mapType, era) {
  if (mapType === '寒冷') {
    if (era === 4) addFuelMultiplier(effects, 0.2, '寒潮：基础燃料消耗 +20%。');
    if (era === 5) addExtraFuel(effects, 1, '寒潮：每户额外燃料需求 +1。');
  }

  if (mapType === '干燥' || mapType === '河谷') {
    if (era === 4) addFoodEfficiency(effects, 0.85, '干旱：草原工作效率 -15%。');
    if (era === 5) addInventoryLoss(effects, 'food', 0.15, '干旱：食物库存损失 15%。');
  }

  if (mapType === '山地' || mapType === '荒野') {
    if (era === 4) effects.notes.push('兽群：外派工作户有风险，P0 仅提示。');
    if (era === 5) addMaterialDemand(effects, 'households', 1, '兽群：材料需求 = 户数 x1。');
  }

  if (mapType === '寒冷') {
    if (era === 8) addFuelMultiplier(effects, 0.2, '严冬：基础燃料消耗 +20%。');
    if (era === 9) addFuelMultiplier(effects, 0.3, '严冬：基础燃料消耗 +30%。');
    if (era === 10) addExtraFuel(effects, 2, '严冬：每户额外燃料需求 +2。');
  }

  if (mapType === '干燥' || mapType === '荒野') {
    if (era === 8) addFoodEfficiency(effects, 0.8, '大旱：食物类工作效率 -20%。');
    if (era === 9) addFoodEfficiency(effects, 0.7, '大旱：食物类工作效率 -30%。');
    if (era === 10) addInventoryLoss(effects, 'food', 0.25, '大旱：食物库存损失 25%。');
  }

  if (mapType === '河谷') {
    if (era === 8) addInventoryLoss(effects, 'food', 0.1, '洪水：食物库存损失 10%。');
    if (era === 9) {
      addInventoryLoss(effects, 'food', 0.15, '洪水：食物库存损失 15%。');
      addInventoryLoss(effects, 'fuel', 0.1, '洪水：燃料库存损失 10%。');
    }
    if (era === 10) {
      addInventoryLoss(effects, 'food', 0.2, '洪水：食物库存损失 20%。');
      addMaterialDemand(effects, 'fixed', BUILDING_COUNT_P0 * 8, '洪水：材料需求 = 建筑数 x8。');
    }
  }

  if (mapType === '山地') {
    if (era === 8) effects.notes.push('地震：山体传来震动，P0 仅提示。');
    if (era === 9) addMaterialDemand(effects, 'fixed', BUILDING_COUNT_P0 * 5, '地震：材料需求 = 建筑数 x5。');
    if (era === 10) addMaterialDemand(effects, 'fixed', BUILDING_COUNT_P0 * 12, '地震：材料需求 = 建筑数 x12。');
  }
}

function applyEndgameDisorder(effects, era) {
  if (era < 12 || era > 15) {
    return;
  }

  ['food', 'fuel', 'material'].forEach((resource) => {
    effects.inventoryLoss[resource] += 0.1;
  });
  effects.notes.push('终末失序：全物资库存损失 10%。');

  if (era === 12) {
    effects.efficiency.all *= 0.9;
    addFuelMultiplier(effects, 0.2, '终末失序：所有工作效率 -10%，基础燃料消耗 +20%。');
  }

  if (era === 13) {
    addFoodEfficiency(effects, 0.8, '终末失序：食物类工作效率 -20%。');
    addInventoryLoss(effects, 'food', 0.2, '终末失序：食物库存损失 20%。');
  }

  if (era === 14) {
    addMaterialDemand(effects, 'fixed', BUILDING_COUNT_P0 * 10, '终末失序：材料需求 = 建筑数 x10。');
  }

  if (era === 15) {
    addExtraFuel(effects, 2, '终末失序：每户额外燃料需求 +2。');
    addInventoryLoss(effects, 'food', 0.25, '终末失序：食物库存损失 25%。');
    addMaterialDemand(effects, 'fixed', BUILDING_COUNT_P0 * 12, '终末失序：材料需求 = 建筑数 x12。');
  }
}

function addInventoryLoss(effects, resource, amount, note) {
  effects.inventoryLoss[resource] += amount;
  effects.notes.push(note);
}

function addFoodEfficiency(effects, multiplier, note) {
  effects.efficiency.food *= multiplier;
  effects.notes.push(note);
}

function addFuelMultiplier(effects, amount, note) {
  effects.fuelMultiplier += amount;
  effects.notes.push(note);
}

function addExtraFuel(effects, amount, note) {
  effects.extraFuelPerHousehold += amount;
  effects.notes.push(note);
}

function addMaterialDemand(effects, type, amount, note) {
  effects.materialDemand += type === 'households' ? -amount : amount;
  effects.notes.push(note);
}
