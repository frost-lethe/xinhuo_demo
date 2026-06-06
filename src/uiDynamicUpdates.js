import { MAX_ERA, RESOURCE_LABELS, TERRAIN_LABELS } from './constants.js';
import {
  getBuildingCount,
  getEraDisasterEffects,
  getWorkEfficiencyMultiplier,
} from './disasters.js';
import { TECH_DEFINITIONS } from './tech.js';
import { setText } from './uiDomHelpers.js';
import { formatNumber, getTimerText } from './uiFormatters.js';

export function updateDynamicUI(root, state, dependencies) {
  updateHudDynamicFields(root, state);
  updateEventPanelDynamicFields(root, state, dependencies);
  updateMapDynamicFields(root, state, dependencies);
  updateOpenPanelDynamicFields(root, state, dependencies);
  updatePointModalDynamicFields(root, state, dependencies);
}

function updateHudDynamicFields(root, state) {
  setText(root.querySelector('[data-hud-timer]'), getTimerText(state));
  setText(root.querySelector('[data-hud-era]'), `第 ${state.era} / ${MAX_ERA} 纪`);
  setText(root.querySelector('[data-hud-households]'), `总计 ${state.households} / ${state.householdCapacity} 户`);
  setText(root.querySelector('[data-hud-idle]'), `空闲户 ${state.idleHouseholds}`);
  setText(root.querySelector('[data-hud-food]'), `食物 ${formatNumber(state.resources.food)} / ${state.resourceCaps.food}`);
  setText(root.querySelector('[data-hud-fuel]'), `燃料 ${formatNumber(state.resources.fuel)} / ${state.resourceCaps.fuel}`);
  setText(root.querySelector('[data-hud-material]'), `材料 ${formatNumber(state.resources.material)} / ${state.resourceCaps.material}`);
}

function updateEventPanelDynamicFields(root, state, dependencies) {
  const disasterEffects = getEraDisasterEffects(state.mapType, state.era, state);
  const eventPanel = root.querySelector('.event-warning-panel');

  if (eventPanel) {
    eventPanel.outerHTML = dependencies.renderEventWarningPanel(state, disasterEffects);
  }
}

function updateMapDynamicFields(root, state, dependencies) {
  state.assignedWorkers.forEach((work) => {
    const rule = dependencies.getWorkRule(state, work);
    const progressPercent = Math.min(100, Math.max(0, (work.progress / rule.progressNeeded) * 100));
    const ring = root.querySelector(`[data-map-tile-progress="${work.tileIndex}"]`);

    ring?.style.setProperty('--progress', `${progressPercent}%`);
    setText(root.querySelector(`[data-map-tile-label="${work.tileIndex}"]`), `${rule.name} ${work.workers}/3`);
  });
}

function updateOpenPanelDynamicFields(root, state, dependencies) {
  const disasterEffects = getEraDisasterEffects(state.mapType, state.era, state);

  if (state.openPanel === 'work') {
    updateWorkPanelDynamicFields(root, state, disasterEffects, dependencies);
  }

  if (state.openPanel === 'tech') {
    updateTechPanelDynamicFields(root, state);
  }

  if (state.openPanel === 'development') {
    updateSettlementPanelDynamicFields(root, state);
  }
}

function updateWorkPanelDynamicFields(root, state, disasterEffects, dependencies) {
  state.assignedWorkers.forEach((work) => {
    const rule = dependencies.getWorkRule(state, work);
    const efficiency = getWorkEfficiencyMultiplier(disasterEffects, work.terrain);
    const seconds = work.workers > 0
      ? (Math.max(0, rule.progressNeeded - work.progress) / (work.workers * efficiency))
      : null;
    const progressPercent = Math.min(100, (work.progress / rule.progressNeeded) * 100);
    const tileIndex = work.tileIndex;

    setText(root.querySelector(`[data-work-current-job="${tileIndex}"]`), `当前工作：${rule.name}`);
    setText(root.querySelector(`[data-work-output="${tileIndex}"]`), `产出：${RESOURCE_LABELS[rule.resource]} +${rule.amount}`);
    setText(root.querySelector(`[data-work-workers="${tileIndex}"]`), `已分配户数：${work.workers} / 3`);
    setText(root.querySelector(`[data-work-rate="${tileIndex}"]`), `${RESOURCE_LABELS[rule.resource]} +${rule.amount} / ${seconds ? `${formatNumber(seconds)}秒` : '未分配'}`);
    root.querySelector(`[data-work-progress="${tileIndex}"]`)?.style.setProperty('width', `${progressPercent}%`);
  });
}

function updateTechPanelDynamicFields(root, state) {
  Object.entries(TECH_DEFINITIONS).forEach(([techId, definition]) => {
    const tech = state.techs[techId];

    if (!tech) {
      return;
    }

    setText(root.querySelector(`[data-tech-progress="${techId}"]`), `研究进度：${formatNumber(tech.progress)} / ${definition.requirement}`);
    setText(root.querySelector(`[data-tech-workers="${techId}"]`), `研究户数：${tech.workers} / 3`);
    setText(root.querySelector(`[data-tech-status="${techId}"]`), tech.unlocked ? '已解锁' : '');
  });
}

function updateSettlementPanelDynamicFields(root, state) {
  const warehouseReduction = state.warehouseCount * 5;

  setText(root.querySelector('[data-settlement-households]'), `当前户数 ${state.households}`);
  setText(root.querySelector('[data-settlement-idle]'), `空闲户 ${state.idleHouseholds}`);
  setText(root.querySelector('[data-settlement-capacity]'), `户容量 ${state.householdCapacity}`);
  setText(root.querySelector('[data-settlement-resources]'), `资源上限 食物${state.resourceCaps.food} / 燃料${state.resourceCaps.fuel} / 材料${state.resourceCaps.material}`);
  setText(root.querySelector('[data-settlement-influence]'), `影响范围等级 ${state.influenceLevel} / 4`);
  setText(root.querySelector('[data-settlement-buildings]'), `建筑数 ${getBuildingCount(state)}`);
  setText(root.querySelector('[data-settlement-warehouses]'), `仓库数量 ${state.warehouseCount}`);
  setText(root.querySelector('[data-settlement-ordinary]'), `普通聚落数量 ${state.ordinarySettlementCount}`);
  setText(root.querySelector('[data-settlement-storage-reduction]'), `库存灾害减免 ${warehouseReduction}%`);
}

function updatePointModalDynamicFields(root, state, dependencies) {
  if (!state.openPointId) {
    return;
  }

  const point = state.points.find((item) => item.id === state.openPointId);
  point?.adjacentTileIds.forEach((tileId) => {
    const tileIndex = tileId - 1;
    const work = dependencies.getWorkForTile(state, tileIndex);
    const tile = state.tiles[tileIndex];
    const rule = work ? dependencies.getWorkRule(state, work) : dependencies.getWorkRule(state, { terrain: tile.terrain });
    setText(
      root.querySelector(`[data-point-work-progress="${tileIndex}"]`),
      `地块${tileId} ${TERRAIN_LABELS[tile.terrain]}：${rule.name}，工人 ${work?.workers ?? 0}/3，进度 ${formatNumber(work?.progress ?? 0)}/${rule.progressNeeded}`,
    );
  });
}
