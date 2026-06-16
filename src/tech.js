export const TECH_DEFINITIONS = Object.freeze({
  ember: {
    id: 'ember',
    name: '火种',
    requirement: 60,
    description: '减轻寒潮 / 严冬 / 终末额外燃料需求 20%，并解锁森林工作【烧炭】。',
  },
  stone: {
    id: 'stone',
    name: '石器',
    requirement: 60,
    description: '山地拾石产出 +1。',
  },
  agriculture: {
    id: 'agriculture',
    name: '农耕',
    requirement: 80,
    prerequisite: 'ember',
    description: '解锁草原工作【耕种】，并使增户成本从食物4降低为食物3。',
  },
  pottery: {
    id: 'pottery',
    name: '陶器',
    requirement: 70,
    prerequisite: 'ember',
    description: '食物上限 +20%。',
  },
  storage: {
    id: 'storage',
    name: '仓储',
    requirement: 120,
    prerequisite: 'pottery',
    description: '将陶器、粮囤与记账方式结合：食物上限 +25%，燃料上限 +15%，材料上限 +15%，每座仓库对最终库存损失的保护率 +2%。',
  },
  bronze: {
    id: 'bronze',
    name: '青铜',
    requirement: 100,
    prerequisite: 'stone',
    description: '解锁山地采石，建设成本 -10%。',
  },
  iron: {
    id: 'iron',
    name: '铁器',
    requirement: 150,
    prerequisite: 'bronze',
    description: '更坚硬的工具与武备让建设折扣提升到 20%，山地采石产出 +1。',
  },
  writing: {
    id: 'writing',
    name: '文字',
    requirement: 100,
    prerequisite: 'stone',
    description: '科研效率 +20%，灭亡后遗产点 +1。',
  },
  calendar: {
    id: 'calendar',
    name: '历法',
    requirement: 130,
    prerequisite: 'writing',
    description: '以文字记录天象、寒暑与洪旱的循环：灾害预警更明确，普通灾害最终代价 -10%，终末灾害最终代价 -5%。',
  },
});

export function createInitialTechState() {
  return Object.fromEntries(
    Object.keys(TECH_DEFINITIONS).map((techId) => [
      techId,
      {
        progress: 0,
        workers: 0,
        unlocked: false,
      },
    ]),
  );
}

export function isTechUnlocked(state, techId) {
  return Boolean(state.techs?.[techId]?.unlocked);
}

export function getResearchedTechNames(state) {
  return Object.entries(state.techs ?? {})
    .filter(([, tech]) => tech.unlocked)
    .map(([techId]) => TECH_DEFINITIONS[techId].name);
}
