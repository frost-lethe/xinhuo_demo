import {
  ERA_SECONDS,
  INITIAL_ERA,
  INITIAL_GENERATION,
  INITIAL_HOUSEHOLD_CAPACITY,
  INITIAL_HOUSEHOLDS,
} from './constants.js';
import { createInitialTechState } from './tech.js';

export function createInitialState() {
  return {
    currentPage: 'start',
    generation: INITIAL_GENERATION,
    era: INITIAL_ERA,
    mapType: null,
    tiles: [],
    points: [],
    coreCandidates: [],
    selectedCoreIndex: null,
    selectedCorePointId: null,
    selectedCoreAdjacentTileIds: [],
    selectedTileIndex: null,
    openPointId: null,
    openPanel: null,
    panelScrollTop: 0,
    influenceLevel: 1,
    pointBuildings: {},
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
    baseResourceCaps: {
      food: 30,
      fuel: 30,
      material: 30,
    },
    currentCivilizationDeaths: 0,
    totalDeathsAllCivilizations: 0,
    highestHouseholdsThisCivilization: INITIAL_HOUSEHOLDS,
    settlementExpansionCount: 0,
    ordinarySettlementCount: 0,
    warehouseCount: 0,
    activeLegacyBonus: null,
    activeLegacyBonuses: [],
    pendingLegacyChoice: null,
    pendingLegacyChoices: [],
    techs: createInitialTechState(),
    eventLog: [],
    lastEventText: null,
    disasterPlan: null,
    scheduledDisaster: null,
    isRunning: false,
    timeLeft: ERA_SECONDS,
    speed: 1,
    eraStartResources: null,
    eraResourceGains: {
      food: 0,
      fuel: 0,
      material: 0,
    },
    lastEraLedger: null,
    settlementLines: [],
    revealedSettlementLines: 0,
    pendingVictory: false,
    settingsOpen: false,
    tutorialOpen: false,
  };
}

export function resetForNewRun(state) {
  Object.assign(state, createInitialState());
}
