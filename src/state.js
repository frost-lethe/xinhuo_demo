import {
  ERA_SECONDS,
  INITIAL_ERA,
  INITIAL_GENERATION,
  INITIAL_HOUSEHOLD_CAPACITY,
  INITIAL_HOUSEHOLDS,
} from './constants.js';

export function createInitialState() {
  return {
    currentPage: 'start',
    generation: INITIAL_GENERATION,
    era: INITIAL_ERA,
    mapType: null,
    tiles: [],
    coreCandidates: [],
    selectedCoreIndex: null,
    households: INITIAL_HOUSEHOLDS,
    householdCapacity: INITIAL_HOUSEHOLD_CAPACITY,
    idleHouseholds: INITIAL_HOUSEHOLDS,
    assignedWorkers: [],
    resources: {
      food: 12,
      fuel: 8,
      material: 0,
    },
    resourceCaps: {
      food: 30,
      fuel: 30,
      material: 30,
    },
    currentCivilizationDeaths: 0,
    totalDeathsAllCivilizations: 0,
    activeLegacyBonus: null,
    eventLog: [],
    isRunning: false,
    timeLeft: ERA_SECONDS,
    speed: 1,
    settlementLines: [],
    revealedSettlementLines: 0,
  };
}

export function resetForNewRun(state) {
  Object.assign(state, createInitialState());
}
