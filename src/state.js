import { INITIAL_EPOCH, INITIAL_GENERATION, STARTING_HOUSEHOLDS } from './constants.js';

export function createInitialState() {
  return {
    generation: INITIAL_GENERATION,
    epoch: INITIAL_EPOCH,
    households: STARTING_HOUSEHOLDS,
    resources: {
      food: 0,
      fuel: 0,
      material: 0,
    },
    legacy: [],
  };
}
