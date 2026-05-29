import { MAX_EPOCH } from './constants.js';

export function hasWon(state) {
  return state.epoch > MAX_EPOCH;
}

export function isCivilizationLost(state) {
  return state.households <= 0;
}
