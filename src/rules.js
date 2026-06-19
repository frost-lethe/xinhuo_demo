import {
  ERA_SECONDS,
  MAX_ERA,
  RESOURCE_KEYS,
  TERRAIN,
  WORKERS_PER_TILE_CAP,
  WORK_PROGRESS_PER_WORKER_PER_SECOND,
  WORK_RULES,
} from './constants.js';
import {
  ensureScheduledDisasterForEra,
  getEraDisasterEffects,
  prepareDisasterPlanForState,
  prepareScheduledDisasterForEra,
} from './disasters.js';

export function prepareGeneration(state, mapData) {
  state.currentPage = 'map';
  state.era = 1;
  state.mapType = mapData.mapType;
  state.tiles = mapData.tiles;
  state.coreCandidates = mapData.coreCandidates;
  state.selectedCoreIndex = null;
  state.householdCapacity = 8;
  state.households = 4 + getLegacyValue(state, 'extraHouseholds');
  state.idleHouseholds = state.households;
  state.assignedWorkers = [];
  state.resources = {
    food: 12,
    fuel: 8 + getLegacyValue(state, 'extraFuel'),
    material: 0,
  };
  state.resourceCaps = {
    food: 30,
    fuel: 30,
    material: 30,
  };
  state.currentCivilizationDeaths = 0;
  state.eventLog = [];
  state.disasterPlan = null;
  state.scheduledDisaster = null;
  state.isRunning = false;
  state.timeLeft = ERA_SECONDS;
  state.speed = 1;
  state.settlementLines = [];
  state.revealedSettlementLines = 0;
  state.pendingVictory = false;
  prepareDisasterPlanForState(state);
  prepareScheduledDisasterForEra(state);
}

export function chooseCore(state, candidateIndex) {
  state.selectedCoreIndex = candidateIndex;
  const candidate = state.coreCandidates[candidateIndex];

  state.assignedWorkers = candidate.tileIndexes.map((tileIndex) => ({
    tileIndex,
    terrain: state.tiles[tileIndex],
    workers: 0,
    progress: 0,
  }));
}

export function startEra(state) {
  ensureScheduledDisasterForEra(state);
  const disasterEffects = getEraDisasterEffects(state.mapType, state.era, state);
  state.isRunning = true;
  state.timeLeft = ERA_SECONDS;
  state.eventLog = [
    `第 ${state.era} 纪开始。${disasterEffects.notes.join(' ') || '本纪风平浪静。'}`,
  ];
}

export function pauseEra(state) {
  state.isRunning = false;
}

export function setSpeed(state, speed) {
  state.speed = speed;
}

export function assignWorker(state, workIndex) {
  const work = state.assignedWorkers[workIndex];

  if (!work || state.idleHouseholds <= 0 || work.workers >= WORKERS_PER_TILE_CAP || state.isRunning) {
    return;
  }

  work.workers += 1;
  state.idleHouseholds -= 1;
}

export function unassignWorker(state, workIndex) {
  const work = state.assignedWorkers[workIndex];

  if (!work || work.workers <= 0 || state.isRunning) {
    return;
  }

  work.workers -= 1;
  state.idleHouseholds += 1;
}

export function tickEra(state, deltaSeconds) {
  if (!state.isRunning) {
    return;
  }

  const previousElapsed = ERA_SECONDS - state.timeLeft;
  state.timeLeft = Math.max(0, state.timeLeft - deltaSeconds * state.speed);
  const currentElapsed = ERA_SECONDS - state.timeLeft;
  triggerTimedEvents(state, previousElapsed, currentElapsed);
  produceResources(state, deltaSeconds * state.speed);

  if (state.timeLeft <= 0) {
    state.isRunning = false;
    state.settlementLines = settleEra(state);
    state.revealedSettlementLines = 1;
    state.pendingVictory = state.households > 0 && state.era >= MAX_ERA;
    state.currentPage = 'settlement';
  }
}

export function goToNextEra(state) {
  state.era += 1;
  prepareScheduledDisasterForEra(state);
  state.currentPage = 'main';
  state.eventLog = [];
  state.timeLeft = ERA_SECONDS;
  state.isRunning = false;
  state.settlementLines = [];
  state.revealedSettlementLines = 0;
  state.pendingVictory = false;
}

export function revealNextSettlementLine(state) {
  state.revealedSettlementLines = Math.min(
    state.settlementLines.length,
    state.revealedSettlementLines + 1,
  );
}

export function revealAllSettlementLines(state) {
  state.revealedSettlementLines = state.settlementLines.length;
}

export function getSettlementOutcome(state) {
  if (state.households <= 0) {
    return 'lost';
  }

  if (state.era >= MAX_ERA) {
    return 'won';
  }

  return 'survived';
}

function produceResources(state, deltaSeconds) {
  const effects = getEraDisasterEffects(state.mapType, state.era, state);

  state.assignedWorkers.forEach((work) => {
    if (work.workers <= 0) {
      return;
    }

    const rule = WORK_RULES[work.terrain];
    const resourceMultiplier = effects.efficiency[rule.resource] ?? 1;
    work.progress += work.workers * WORK_PROGRESS_PER_WORKER_PER_SECOND * deltaSeconds * effects.efficiency.all * resourceMultiplier;

    while (work.progress >= rule.progressNeeded) {
      work.progress -= rule.progressNeeded;
      const legacyBonus = rule.resource === 'food' ? getLegacyValue(state, 'grasslandYield') : 0;
      addResource(state, rule.resource, rule.amount + legacyBonus);
      state.eventLog.push(`${rule.name}完成：${rule.resource === 'food' ? '食物' : rule.resource === 'fuel' ? '燃料' : '材料'} +${rule.amount + legacyBonus}。`);
    }
  });
}

function triggerTimedEvents(state, previousElapsed, currentElapsed) {
  [20, 40].forEach((eventSecond) => {
    if (previousElapsed < eventSecond && currentElapsed >= eventSecond) {
      state.eventLog.push(`第 ${eventSecond} 秒：族人报告远处天色有变。`);

      if (Math.random() < 0.1) {
        if (state.households < state.householdCapacity) {
          state.households += 1;
          state.idleHouseholds += 1;
          state.eventLog.push('一户流民加入了文明。');
        } else {
          state.eventLog.push('有流民经过，但无处安置。');
        }
      }
    }
  });
}

function settleEra(state) {
  ensureScheduledDisasterForEra(state);
  const lines = [];
  const effects = getEraDisasterEffects(state.mapType, state.era, state);

  const lossParts = [];
  RESOURCE_KEYS.forEach((resource) => {
    const rate = effects.inventoryLoss[resource];
    if (rate <= 0) {
      return;
    }

    const before = state.resources[resource];
    const lost = Math.ceil(before * rate);
    state.resources[resource] = Math.max(0, before - lost);
    lossParts.push(`${resourceName(resource)} -${lost}`);
  });
  lines.push(lossParts.length > 0 ? `库存损失：${lossParts.join('，')}。` : '库存损失：本纪没有库存损失。');

  const foodNeed = 1;
  const fuelNeed = 0.5 * effects.fuelMultiplier + effects.extraFuelPerHousehold;
  const foodCanSupply = Math.floor(state.resources.food / foodNeed);
  const fuelCanSupply = fuelNeed <= 0 ? state.households : Math.floor(state.resources.fuel / fuelNeed);
  const supplied = Math.min(state.households, foodCanSupply, fuelCanSupply);
  const consumedFood = supplied * foodNeed;
  const consumedFuel = supplied * fuelNeed;
  state.resources.food = roundResource(Math.max(0, state.resources.food - consumedFood));
  state.resources.fuel = roundResource(Math.max(0, state.resources.fuel - consumedFuel));
  const supplyDeaths = state.households - supplied;
  if (supplyDeaths > 0) killHouseholds(state, supplyDeaths);
  lines.push(`食物/燃料供应：可供应 ${supplied}/${state.households + supplyDeaths} 户，消耗食物 ${formatNumber(consumedFood)}，燃料 ${formatNumber(consumedFuel)}，死亡 ${supplyDeaths} 户。`);

  const materialDemand = effects.materialDemand < 0 ? state.households * Math.abs(effects.materialDemand) : effects.materialDemand;
  if (materialDemand > 0) {
    const shortage = Math.max(0, materialDemand - state.resources.material);
    if (shortage > 0) {
      state.resources.material = 0;
      const materialDeaths = Math.ceil(shortage);
      killHouseholds(state, materialDeaths);
      lines.push(`材料需求：需要 ${materialDemand}，缺口 ${shortage}，死亡 ${materialDeaths} 户。`);
    } else {
      state.resources.material -= materialDemand;
      lines.push(`材料需求：需要 ${materialDemand}，材料充足。`);
    }
  } else {
    lines.push('材料需求：本纪没有额外材料需求。');
  }

  lines.push(`死亡统计：本世损失 ${state.currentCivilizationDeaths} 户，历世累计损失 ${state.totalDeathsAllCivilizations} 户。`);

  if (state.households <= 0) {
    lines.push(`最终判定：第 ${state.generation} 世文明终止于第 ${state.era} 纪。`);
  } else if (state.era >= MAX_ERA) {
    lines.push('最终判定：文明撑过了第十五纪。');
  } else {
    lines.push(`最终判定：文明存续，准备进入第 ${state.era + 1} 纪。`);
  }

  return lines;
}

function killHouseholds(state, amount) {
  let remaining = Math.min(amount, state.households);
  const priority = [TERRAIN.MOUNTAIN, TERRAIN.FOREST, TERRAIN.GRASSLAND];

  priority.forEach((terrain) => {
    state.assignedWorkers.forEach((work) => {
      if (remaining <= 0 || work.terrain !== terrain) {
        return;
      }

      const deaths = Math.min(work.workers, remaining);
      work.workers -= deaths;
      remaining -= deaths;
    });
  });

  const idleDeaths = Math.min(state.idleHouseholds, remaining);
  state.idleHouseholds -= idleDeaths;
  remaining -= idleDeaths;

  const deaths = Math.min(amount, state.households);
  state.households -= deaths;
  state.currentCivilizationDeaths += deaths;
  state.totalDeathsAllCivilizations += deaths;
  state.idleHouseholds = Math.max(0, Math.min(state.idleHouseholds, state.households - assignedCount(state)));
}

function assignedCount(state) {
  return state.assignedWorkers.reduce((sum, work) => sum + work.workers, 0);
}

function addResource(state, resource, amount) {
  state.resources[resource] = Math.min(state.resourceCaps[resource], state.resources[resource] + amount);
}

function getLegacyValue(state, key) {
  if (!state.activeLegacyBonus || state.activeLegacyBonus.key !== key) {
    return 0;
  }

  return state.activeLegacyBonus.value;
}

function resourceName(resource) {
  return {
    food: '食物',
    fuel: '燃料',
    material: '材料',
  }[resource];
}

function roundResource(value) {
  return Math.round(value * 10) / 10;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
