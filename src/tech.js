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
  bronze: {
    id: 'bronze',
    name: '青铜',
    requirement: 100,
    prerequisite: 'stone',
    description: '解锁山地采石，建设成本 -10%。',
  },
  writing: {
    id: 'writing',
    name: '文字',
    requirement: 100,
    prerequisite: 'stone',
    description: '科研效率 +20%，灭亡后遗产点 +1。',
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
