export const LEGACY_OPTIONS = Object.freeze([
  {
    id: 'emberLegacy',
    name: '火种遗产',
    description: '下一世初始燃料 +5。',
    key: 'extraFuel',
    value: 5,
  },
  {
    id: 'stoneLegacy',
    name: '石器遗存',
    description: '下一世初始材料 +5。',
    key: 'extraMaterial',
    value: 5,
  },
  {
    id: 'frontierLegacy',
    name: '开拓记忆',
    description: '下一世初始户 +1，但不超过初始容量 8。',
    key: 'extraHouseholds',
    value: 1,
  },
]);

export function getLegacyBonus(state, key) {
  if (!state.activeLegacyBonus || state.activeLegacyBonus.key !== key) {
    return 0;
  }

  return state.activeLegacyBonus.value;
}
