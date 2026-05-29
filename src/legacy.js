export const LEGACY_OPTIONS = Object.freeze([
  {
    id: 'ember',
    name: '火种遗产',
    description: '下一世初始燃料 +5。',
    key: 'extraFuel',
    value: 5,
  },
  {
    id: 'farming',
    name: '农耕记忆',
    description: '下一世草原采集产出 +2。',
    key: 'grasslandYield',
    value: 2,
  },
  {
    id: 'frontier',
    name: '开拓记忆',
    description: '下一世初始户 +1。',
    key: 'extraHouseholds',
    value: 1,
  },
]);

export function applyLegacyChoice(state, legacyId) {
  const choice = LEGACY_OPTIONS.find((option) => option.id === legacyId);

  if (!choice) {
    return;
  }

  state.activeLegacyBonus = {
    id: choice.id,
    name: choice.name,
    key: choice.key,
    value: choice.value,
  };
  state.generation += 1;
}
