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
