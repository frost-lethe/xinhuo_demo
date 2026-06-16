import { RESOURCE_LABELS, TERRAIN } from './constants.js';
import { isTechUnlocked } from './tech.js';

export const BASE_WAREHOUSE_PROTECTION_PER_WAREHOUSE = 0.05;
export const STORAGE_WAREHOUSE_PROTECTION_BONUS = 0.02;
export const WAREHOUSE_PROTECTION_CAP = 0.60;
export const CALENDAR_ORDINARY_DISASTER_REDUCTION = 0.10;
export const CALENDAR_TERMINAL_DISASTER_REDUCTION = 0.05;

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

export function getBuildingCount(state = null) {
  return 1
    + (state?.ordinarySettlementCount ?? 0)
    + (state?.warehouseCount ?? 0);
}

export function getWarehouseProtectionRate(state = null) {
  const warehouseCount = Math.max(0, state?.warehouseCount ?? 0);
  return Math.min(
    WAREHOUSE_PROTECTION_CAP,
    warehouseCount * getWarehouseProtectionPerWarehouse(state),
  );
}

export function getWarehouseProtectionPerWarehouse(state = null) {
  return BASE_WAREHOUSE_PROTECTION_PER_WAREHOUSE
    + (isTechUnlocked(state, 'storage') ? STORAGE_WAREHOUSE_PROTECTION_BONUS : 0);
}

export function applyWarehouseProtectionToLoss(baseLoss, state = null) {
  const protectionRate = getWarehouseProtectionRate(state);
  return Math.max(0, baseLoss * (1 - protectionRate));
}

export function isTerminalDisaster(effects = null) {
  return Boolean(effects?.disasterNames?.includes('终末失序'));
}

export function getCalendarDisasterReductionRate(state = null, effects = null) {
  if (!isTechUnlocked(state, 'calendar')) {
    return 0;
  }

  return isTerminalDisaster(effects)
    ? CALENDAR_TERMINAL_DISASTER_REDUCTION
    : CALENDAR_ORDINARY_DISASTER_REDUCTION;
}

export function applyCalendarReductionToDisasterCost(cost, state = null, effects = null) {
  const reductionRate = getCalendarDisasterReductionRate(state, effects);
  return Math.max(0, cost * (1 - reductionRate));
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
    techNotes: [],
    warning: '本纪灾害：无。',
  };

  applyMapDisaster(effects, mapType, era, state);
  applyEndgameDisorder(effects, era, state);
  applyTechModifiers(effects, state);
  effects.warning = createWarning(effects, state);

  return effects;
}

function applyTechModifiers(effects, state) {
  if (!state || !isTechUnlocked(state, 'ember') || effects.extraFuelPerHousehold <= 0) {
    return;
  }

  effects.extraFuelPerHousehold *= 0.8;
  effects.techNotes = ['火种减轻了额外燃料需求：-20%。'];
  effects.notes.push('火种已生效：额外燃料需求降低20%。');
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

export function getEventLogText(state, second) {
  const currentEffects = getEraDisasterEffects(state.mapType, state.era, state);
  const nextEffects = getEraDisasterEffects(state.mapType, state.era + 1, state);
  const currentCategory = getEventCategory(currentEffects.disasterNames);
  const nextCategory = getEventCategory(nextEffects.disasterNames);
  const resourceText = getLowResourceText(state);
  const techText = getTechText(state);
  let text = null;

  if (isTechUnlocked(state, 'calendar') && (currentCategory || (second === 40 && nextCategory))) {
    text = getCalendarEventText(currentCategory ?? nextCategory, currentCategory ? 'current' : 'next');
  } else if (currentCategory) {
    text = pick(EVENT_TEXTS.active[currentCategory]);
  } else if (second === 40 && nextCategory) {
    text = pick(EVENT_TEXTS.warning[nextCategory]);
  } else if (resourceText) {
    text = resourceText;
  } else if (techText) {
    text = techText;
  } else if (state.generation > 1 && Math.random() < 0.35) {
    text = pick(EVENT_TEXTS.legacy);
  } else if ([3, 7, 11].includes(state.era)) {
    text = pick(EVENT_TEXTS.uneasy);
  } else {
    text = pick([...EVENT_TEXTS.calm, ...EVENT_TEXTS.uneasy]);
  }

  if (text === state.lastEventText) {
    const fallback = currentCategory ? EVENT_TEXTS.active[currentCategory] : EVENT_TEXTS.calm;
    text = fallback.find((item) => item !== text) ?? text;
  }

  state.lastEventText = text;
  return text;
}

function getEventCategory(disasterNames) {
  if (disasterNames.includes('终末失序')) return '终末失序';
  if (disasterNames.includes('寒潮') || disasterNames.includes('严冬')) return '寒潮';
  if (disasterNames.includes('干旱') || disasterNames.includes('大旱')) return '干旱';
  if (disasterNames.includes('兽群')) return '兽群';
  if (disasterNames.includes('洪水')) return '洪水';
  if (disasterNames.includes('地震')) return '地震';
  return null;
}

function getLowResourceText(state) {
  if (state.resources.food < state.resourceCaps.food * 0.25) return pick(EVENT_TEXTS.low.food);
  if (state.resources.fuel < state.resourceCaps.fuel * 0.25) return pick(EVENT_TEXTS.low.fuel);
  if (state.resources.material < state.resourceCaps.material * 0.25) return pick(EVENT_TEXTS.low.material);
  return null;
}

function getTechText(state) {
  if (state.eventLog.some((item) => item.includes('火种研究完成'))) return pick(EVENT_TEXTS.tech.ember);
  if (state.eventLog.some((item) => item.includes('石器研究完成'))) return pick(EVENT_TEXTS.tech.stone);
  if (Object.values(state.techs ?? {}).some((tech) => tech.workers > 0 && !tech.unlocked)) {
    return pick(EVENT_TEXTS.tech.researching);
  }
  return null;
}

function applyMapDisaster(effects, mapType, era, state) {
  const profile = getMapDisasterProfile(mapType);

  if (profile?.early === '寒潮') {
    if (era === 4) addFuelMultiplier(effects, '寒潮', 0.15, '基础燃料消耗 +15%。');
    if (era === 5) addExtraFuel(effects, '寒潮', 1, '结算时每户额外燃料需求 +1。');
  }

  if (profile?.early === '干旱') {
    if (era === 4) addFoodEfficiency(effects, '干旱', 0.85, '草原工作效率 -15%。');
    if (era === 5) addInventoryLoss(effects, '干旱', 'food', 0.12, '食物库存损失 12%。');
  }

  if (profile?.early === '兽群') {
    if (era === 4) addNoteOnly(effects, '兽群', '兽群逼近，外派工作风险上升。');
    if (era === 5) addMaterialDemand(effects, '兽群', Math.ceil((state?.households ?? 0) * 0.8), '材料需求 = ceil(当前户数 x0.8)。');
  }

  if (profile?.mid === '严冬') {
    if (era === 8) addFuelMultiplier(effects, '严冬', 0.15, '基础燃料消耗 +15%。');
    if (era === 9) addFuelMultiplier(effects, '严冬', 0.25, '基础燃料消耗 +25%。');
    if (era === 10) addExtraFuel(effects, '严冬', 1.6, '结算时每户额外燃料需求 +1.6。');
  }

  if (profile?.mid === '大旱') {
    if (era === 8) addFoodEfficiency(effects, '大旱', 0.82, '食物类工作效率 -18%。');
    if (era === 9) addFoodEfficiency(effects, '大旱', 0.75, '食物类工作效率 -25%。');
    if (era === 10) addInventoryLoss(effects, '大旱', 'food', 0.18, '食物库存损失 18%。');
  }

  if (profile?.mid === '洪水') {
    if (era === 8) addInventoryLoss(effects, '洪水', 'food', 0.08, '食物库存损失 8%。');
    if (era === 9) {
      addInventoryLoss(effects, '洪水', 'food', 0.12, '食物库存损失 12%。');
      addInventoryLoss(effects, '洪水', 'fuel', 0.08, '燃料库存损失 8%。');
    }
    if (era === 10) {
      addMaterialDemand(effects, '洪水', getBuildingCount(state) * 6, '材料需求 = 建筑数 x6。');
      addInventoryLoss(effects, '洪水', 'food', 0.15, '食物库存损失 15%。');
    }
  }

  if (profile?.mid === '地震') {
    if (era === 8) addNoteOnly(effects, '地震', '地面传来细碎震动，建筑维护压力正在上升。');
    if (era === 9) addMaterialDemand(effects, '地震', getBuildingCount(state) * 4, '材料需求 = 建筑数 x4。');
    if (era === 10) addMaterialDemand(effects, '地震', getBuildingCount(state) * 7, '材料需求 = 建筑数 x7。');
  }
}

function applyEndgameDisorder(effects, era, state) {
  if (era < 12 || era > 15) {
    return;
  }

  ['food', 'fuel', 'material'].forEach((resource) => {
    addInventoryLoss(effects, '终末失序', resource, 0.1, `${RESOURCE_LABELS[resource]}库存损失 10%。`);
  });

  if (era === 12) {
    addAllEfficiency(effects, '终末失序', 0.88, '所有工作效率 -12%。');
    addFuelMultiplier(effects, '终末失序', 0.15, '基础燃料消耗 +15%。');
  }

  if (era === 13) {
    addFoodEfficiency(effects, '终末失序', 0.82, '食物类工作效率 -18%。');
    addInventoryLoss(effects, '终末失序', 'food', 0.15, '食物库存损失 15%。');
  }

  if (era === 14) {
    addMaterialDemand(effects, '终末失序', getBuildingCount(state) * 7, '材料需求 = 建筑数 x7。');
  }

  if (era === 15) {
    addExtraFuel(effects, '终末失序', 2, '结算时每户额外燃料需求 +2。');
    addInventoryLoss(effects, '终末失序', 'food', 0.18, '食物库存损失 18%。');
    addMaterialDemand(effects, '终末失序', getBuildingCount(state) * 8, '材料需求 = 建筑数 x8。');
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

function createWarning(effects, state = null) {
  if (effects.notes.length === 0) {
    return '本纪灾害：无。';
  }

  if (isTechUnlocked(state, 'calendar')) {
    return `历法预警：${getCalendarWarningText(effects)} ${effects.notes.join(' ')}`;
  }

  if (effects.disasterNames.includes('终末失序')) {
    return `终末失序正在发生：${effects.notes.join(' ')}`;
  }

  return `本纪灾害：${effects.disasterNames.join('、')}。${effects.notes.join(' ')}`;
}

function getCalendarWarningText(effects) {
  if (isTerminalDisaster(effects)) {
    return '旧年的刻痕与星象吻合，终末失序会让全部储备承压。';
  }

  if (effects.materialDemand > 0) {
    return '历法记录显示，材料储备需要提前准备。';
  }

  const lossResources = Object.entries(effects.inventoryLoss)
    .filter(([, rate]) => rate > 0)
    .map(([resource]) => RESOURCE_LABELS[resource]);

  if (lossResources.length > 0) {
    return `历法记录显示，下一轮灾害更可能冲击${lossResources.join('、')}储备。`;
  }

  if (effects.fuelMultiplier > 1 || effects.extraFuelPerHousehold > 0) {
    return '族中掌历者推算，寒暑失序将优先考验燃料。';
  }

  if (effects.efficiency.food < 1 || effects.efficiency.all < 1) {
    return '历法提示，食物生产将受到明确压力。';
  }

  return '历法提示：这不是偶然的风声，而是一次明确的灾前征兆。';
}

function getCalendarEventText(category, timing) {
  const timingText = timing === 'next' ? '下一纪' : '本纪';
  const texts = {
    寒潮: `历法记录显示，${timingText}寒暑失序将优先考验燃料。`,
    干旱: `历法记录显示，${timingText}干旱更可能冲击食物储备。`,
    兽群: `历法记录显示，${timingText}外部冲击需要提前准备材料。`,
    洪水: `旧年的水痕与星象吻合，${timingText}洪水会威胁库存与材料。`,
    地震: `族中掌历者推算，${timingText}地震将考验材料储备。`,
    终末失序: `历法提示：${timingText}终末失序不是偶然风声，全部储备都需要提前准备。`,
  };

  return texts[category] ?? '历法提示：这不是偶然的风声，而是一次明确的灾前征兆。';
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

const EVENT_TEXTS = Object.freeze({
  calm: [
    '一切安好，炊烟从聚落上方缓缓升起。',
    '孩子们在草地边追逐，老人说今年或许能多存下一些粮。',
    '文明正在蒸蒸日上，新的分工让每个人都看见了明天。',
    '仓储里的物资安静堆放着，今天没有坏消息。',
    '有人开始讨论下一处开拓地，火光照亮了他们的脸。',
    '聚落里传来敲打石器的声音，秩序正在形成。',
    '这一纪暂时平稳，文明得以喘息。',
  ],
  uneasy: [
    '族老说，风的方向不太对。',
    '巡行的户带回消息：远处的天色比往常更暗。',
    '有人梦见仓库空了，但醒来时火还在燃。',
    '野兽的足迹出现在更近的地方。',
    '草叶卷曲，土地似乎比昨日更沉默。',
    '孩子们不再追问远方有什么，大人们也没有回答。',
    '有人在夜里听见低沉的回响，像是大地在翻身。',
  ],
  warning: {
    寒潮: [
      '北方的风提前抵达，火堆旁的人坐得更近了。',
      '猎户说，林间的霜来得太早。',
      '有人开始担心燃料是否足够撑过下一纪。',
    ],
    干旱: [
      '草原的颜色正在变浅，土地失去湿意。',
      '取水的人回来得更晚了。',
      '族老提醒众人：下一纪也许不适合只依赖草原。',
    ],
    兽群: [
      '夜色里传来成群的低吼。',
      '边缘地带出现了凌乱的足迹。',
      '外出的人变少了，聚落边缘的火被添得更旺。',
    ],
    洪水: [
      '河水上涨得比往年更快。',
      '潮气钻进燃料堆，仓储变得不再可靠。',
      '低地传来水声，像有什么正在靠近。',
    ],
    地震: [
      '杯中的水面无风自颤。',
      '墙体出现细小裂纹，但没人愿意先说出口。',
      '大地偶尔传来沉闷的声响。',
    ],
    终末失序: [
      '有人梦见第十五纪没有日出。',
      '星象变得陌生，历法上的记号失去意义。',
      '储藏本身也开始让人不安，仿佛世界正在松开秩序。',
      '族老说，这不是一场灾，而是一切规则都开始疲惫。',
    ],
  },
  active: {
    寒潮: [
      '寒意压低了火焰，燃料变得比昨日更珍贵。',
      '风像刀一样掠过聚落边缘。',
      '每一户都在靠近火，但火也在更快地消耗。',
    ],
    干旱: [
      '土地干裂，草原上的收获变得迟缓。',
      '粮食没有立刻消失，但丰收已经远去。',
      '人们抬头看天，云却没有回应。',
    ],
    兽群: [
      '兽群逼近，边缘的户不再独自外出。',
      '夜里有影子掠过火光之外。',
      '材料被拿去加固屏障，而不是建造新屋。',
    ],
    洪水: [
      '水声淹没了低地，库存开始变得脆弱。',
      '潮湿侵入燃料堆，干燥的东西越来越少。',
      '人们把物资搬向高处，但仍有一部分留在水里。',
    ],
    地震: [
      '大地发出低沉的响声。',
      '墙体出现裂纹，材料储备被迅速消耗。',
      '没有人知道下一次震动会从哪里开始。',
    ],
    终末失序: [
      '世界不是降下一场灾，而是在逐渐松开秩序。',
      '储藏开始流失，仿佛物资本身也在遗忘形状。',
      '火还在燃，但火光照不清远方。',
      '第十五纪越来越近，所有人都开始沉默。',
    ],
  },
  low: {
    food: [
      '粮仓见底，聚落里的谈话声变轻了。',
      '有人开始数每一份食物能撑到哪一天。',
      '饥饿还没有夺走人，但已经夺走了笑声。',
    ],
    fuel: [
      '火堆变小了，夜晚显得更长。',
      '燃料不足，守夜的人把手缩进袖中。',
      '没有火的夜晚，比灾害本身更让人害怕。',
    ],
    material: [
      '材料储备不足，许多修补只能暂时搁置。',
      '人们知道墙需要加固，但仓里没有足够的石材。',
      '每一次建设都变成艰难选择。',
    ],
  },
  tech: {
    researching: [
      '有人把经验刻在石片上，试图让下一次不再从零开始。',
      '火边的讨论持续到深夜，知识正在慢慢成形。',
      '年轻人开始追问：为什么每一纪都要重复同样的错误？',
    ],
    ember: [
      '火种被更好地保存下来，寒冷不再完全不可抵抗。',
      '人们学会让火延续，而不只是等待它熄灭。',
    ],
    stone: [
      '石器变得更加锋利，山地不再只是危险，也成为资源。',
      '工具改变了手，也改变了文明理解世界的方式。',
    ],
  },
  legacy: [
    '上一世留下的记忆仍在影响这一世的选择。',
    '没有人完整记得过去，但某些做法被保留了下来。',
    '薪火不是同一群人活下来，而是某些东西没有断。',
    '这一世的人不知道前人的名字，却走在他们铺出的影子上。',
  ],
});
