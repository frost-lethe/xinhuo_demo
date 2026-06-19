import {
  DEFAULT_JOBS,
  ERA_SECONDS,
  JOB_DEFINITIONS,
  MAX_ERA,
  RESOURCE_LABELS,
  TERRAIN,
  TERRAIN_LABELS,
  WORKERS_PER_TILE_CAP,
  WORK_PROGRESS_PER_WORKER_PER_SECOND,
} from './constants.js';
import {
  getEraDisasterEffects,
  getEventLogText,
  getBuildingCount,
  getWarehouseProtectionPerWarehouse,
  getWarehouseProtectionRate,
  getWorkEfficiencyMultiplier,
  applyWarehouseProtectionToLoss,
  isTerminalDisaster,
  getCalendarDisasterReductionRate,
  applyCalendarReductionToDisasterCost,
  prepareDisasterPlanForState,
  ensureScheduledDisasterForEra,
  prepareScheduledDisasterForEra,
} from './disasters.js';
import { getLegacyBonus, LEGACY_OPTIONS } from './legacy.js';
import { countTerrains, generateMap } from './map.js';
import {
  createInitialTechState,
  getResearchedTechNames,
  isTechUnlocked,
  TECH_DEFINITIONS,
} from './tech.js';
import { updateDynamicUI } from './uiDynamicUpdates.js';
import { formatNumber, getTimerText } from './uiFormatters.js';
import { closeAllModals, closePanelModal, closePointModal } from './uiModalState.js';

const BUILDING_MAINTENANCE_MATERIAL_PER_BUILDING = 1;

export function createGameUI(root, state) {
  if (!root) {
    return;
  }

  const debugEnabled = new URLSearchParams(window.location.search).get('debug') === '1';
  let timerId = null;
  let lastTickAt = 0;

  const stopTimer = () => {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  };

  const handleKeyboardEvent = (event) => {
    if (debugEnabled && event.key === 'F9') {
      event.preventDefault();
      state.debugConsoleOpen = !state.debugConsoleOpen;
      render();
      return;
    }

    if (event.key !== 'Escape') {
      return;
    }

    if (state.openPointId) {
      closePointModal(state);
      render();
      return;
    }

    if (state.openPanel) {
      closePanelModal(state);
      render();
    }
  };

  const render = () => {
    rememberPanelScroll(root, state);

    if (state.currentPage !== 'main') {
      stopTimer();
    }

    if (state.currentPage === 'map') {
      renderMapPage(root, state, render);
      return;
    }

    if (state.currentPage === 'core') {
      renderCorePage(root, state, render);
      return;
    }

    if (state.currentPage === 'main') {
      renderMainPage(root, state, render, startTimer, debugEnabled);
      return;
    }

    if (state.currentPage === 'settlement') {
      renderSettlementPage(root, state, render);
      return;
    }

    if (state.currentPage === 'lost') {
      renderLostPage(root, state, render);
      return;
    }

    if (state.currentPage === 'legacy') {
      renderLegacyPage(root, state, render);
      return;
    }

    if (state.currentPage === 'won') {
      renderVictoryPage(root, state, render);
      return;
    }

    renderStartPage(root, state, render);
  };

  const startTimer = () => {
    stopTimer();
    lastTickAt = performance.now();
    timerId = window.setInterval(() => {
      const now = performance.now();
      const deltaSeconds = (now - lastTickAt) / 1000;
      lastTickAt = now;

      if (state.isRunning) {
        const tickResult = advanceEra(state, deltaSeconds);
        if (state.currentPage === 'settlement') {
          stopTimer();
        }
        if (state.currentPage !== 'main') {
          render();
          return;
        }

        if (tickResult.techUnlocked) {
          render();
          return;
        }

        updateDynamicUI(root, state, {
          getWorkRule,
          getWorkForTile,
          renderEventWarningPanel,
        });
      }
    }, 250);
  };

  document.onkeydown = handleKeyboardEvent;
  render();
}

function renderStartPage(root, state, render) {
  root.innerHTML = `
    <main class="app-shell">
      <section class="intro" aria-labelledby="game-title">
        <p class="eyebrow">文明生存 roguelite Demo</p>
        <h1 id="game-title">薪火</h1>
        <p class="tagline">一世一文明，传承薪火，撑过第十五纪。</p>
        <button class="primary-action" type="button" data-action="start">开始新局</button>
      </section>
    </main>
  `;

  root.querySelector('[data-action="start"]').addEventListener('click', () => {
    const mapData = generateMap();
    prepareGeneration(state, mapData);
    render();
  });
}

function renderMapPage(root, state, render) {
  const counts = countTerrains(state.tiles);

  root.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <p class="eyebrow">第${state.generation}世</p>
        <h1>地图类型：${state.mapType}</h1>
        <div class="stat-grid">
          <div>草原 ${counts.grassland}</div>
          <div>森林 ${counts.forest}</div>
          <div>山地 ${counts.mountain}</div>
          <div>第一阶段：第4-5纪</div>
          <div>第二阶段：第8-10纪</div>
        </div>
        <div class="disaster-overview">
          <h2>灾害介绍</h2>
          <p>本局会在地图生成时形成一条灾难主题，地图类型会影响主题倾向，但并不完全固定。</p>
          <p>第4-5纪出现第一阶段灾难，第8-10纪进入第二阶段灾难。</p>
          <p>第12-15纪进入固定的终末失序。同一纪内，预警与结算会读取同一个已排定灾害。</p>
        </div>
        ${renderIslandMap(state, { size: 'mini' })}
        <button class="primary-action" type="button" data-action="core">进入选址</button>
      </section>
    </main>
  `;

  root.querySelector('[data-action="core"]').addEventListener('click', () => {
    state.currentPage = 'core';
    render();
  });
}

function renderCorePage(root, state, render) {
  const selected = Number.isInteger(state.selectedCoreIndex)
    ? state.coreCandidates[state.selectedCoreIndex]
    : null;

  root.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <p class="eyebrow">核心聚落选址</p>
        <h1>选择第${state.generation}世的核心聚落</h1>
        ${renderIslandMap(state, { size: 'large', showIndexes: true, showCandidates: true })}
        <div class="candidate-list">
          ${state.coreCandidates.map((candidate, index) => `
            <button class="candidate-button ${state.selectedCoreIndex === index ? 'is-selected' : ''}" type="button" data-candidate="${index}">
              候选点 ${index + 1}
            </button>
          `).join('')}
        </div>
        <div class="notice">
          ${selected ? `
            <h2>候选核心聚落 ${state.selectedCoreIndex + 1}</h2>
            <p>相邻地块编号：${selected.adjacentTileIds.join('、')}</p>
            <p>相邻地块类型：${selected.tileIndexes.map((tileIndex) => TERRAIN_LABELS[state.tiles[tileIndex].terrain]).join('、')}</p>
            <p class="safe-site-note">该点资源完整，包含草原 / 森林 / 山地，可作为核心聚落。</p>
            <p>初始容量：8户</p>
            <p>资源上限：食物30 / 燃料30 / 材料30</p>
          ` : '<p>请选择一个候选核心聚落点。</p>'}
        </div>
        <button class="primary-action" type="button" data-action="confirm" ${selected ? '' : 'disabled'}>确认核心聚落</button>
      </section>
    </main>
  `;

  root.querySelectorAll('[data-candidate]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedCoreIndex = Number(button.dataset.candidate);
      render();
    });
  });

  root.querySelectorAll('[data-map-candidate]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedCoreIndex = Number(button.dataset.mapCandidate);
      render();
    });
  });

  root.querySelector('[data-action="confirm"]').addEventListener('click', () => {
    const candidate = state.coreCandidates[state.selectedCoreIndex];
    state.selectedCorePointId = candidate.id;
    state.selectedCoreAdjacentTileIds = [...candidate.adjacentTileIds];
    refreshWorkTilesFromSettlements(state);
    state.currentPage = 'main';
    render();
  });
}

function renderMainPage(root, state, render, startTimer, debugEnabled) {
  const disasterEffects = getEraDisasterEffects(state.mapType, state.era, state);

  root.innerHTML = `
    ${renderTopHud(state)}
    ${renderEventWarningPanel(state, disasterEffects)}
    ${renderRightActionRail()}
    <main class="app-shell game-layout main-hud-layout">
      <section class="panel main-stage-panel">
        ${renderMainMap(state, disasterEffects)}
      </section>
      ${renderPanelModal(state, disasterEffects)}
    </main>
    ${state.openPointId ? renderPointModal(state, disasterEffects) : ''}
    ${renderDebugConsole(state, debugEnabled)}
  `;

  root.querySelectorAll('[data-open-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      closePointModal(state);
      state.openPanel = button.dataset.openPanel;
      render();
    });
  });

  root.querySelector('[data-panel-modal-backdrop]')?.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (event.target.closest('[data-close-panel]')) {
      closePanelModal(state);
      render();
      return;
    }

    if (!event.target.closest('[data-panel-modal-panel]')) {
      closePanelModal(state);
      render();
    }
  });

  root.querySelector('[data-panel-modal-panel]')?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  root.querySelectorAll('[data-close-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      closePanelModal(state);
      render();
    });
  });

  restorePanelScroll(root, state);

  root.querySelectorAll('[data-assign]').forEach((button) => {
    button.addEventListener('click', () => {
      assignWorker(state, Number(button.dataset.assign));
      render();
    });
  });

  root.querySelectorAll('[data-unassign]').forEach((button) => {
    button.addEventListener('click', () => {
      unassignWorker(state, Number(button.dataset.unassign));
      render();
    });
  });

  root.querySelectorAll('[data-switch-job]').forEach((button) => {
    button.addEventListener('click', () => {
      switchWorkJob(state, Number(button.dataset.switchJob), button.dataset.targetJob);
      render();
    });
  });

  root.querySelectorAll('[data-main-point]').forEach((point) => {
    point.addEventListener('click', (event) => {
      event.stopPropagation();
      closePanelModal(state);
      state.openPointId = point.dataset.mainPoint;
      render();
    });
  });

  root.querySelector('[data-point-modal-backdrop]')?.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (event.target.closest('[data-close-point-modal]')) {
      closePointModal(state);
      render();
      return;
    }

    if (!event.target.closest('[data-point-modal-panel]')) {
      closePointModal(state);
      render();
    }
  });

  root.querySelector('[data-point-modal-panel]')?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  root.querySelectorAll('[data-close-point-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      closePointModal(state);
      render();
    });
  });

  root.querySelectorAll('[data-tech-assign]').forEach((button) => {
    button.addEventListener('click', () => {
      assignResearchWorker(state, button.dataset.techAssign);
      render();
    });
  });

  root.querySelectorAll('[data-tech-unassign]').forEach((button) => {
    button.addEventListener('click', () => {
      unassignResearchWorker(state, button.dataset.techUnassign);
      render();
    });
  });

  root.querySelector('[data-action="grow-household"]')?.addEventListener('click', () => {
    growHousehold(state);
    render();
  });

  root.querySelector('[data-action="upgrade-influence"]')?.addEventListener('click', () => {
    upgradeInfluence(state);
    render();
  });

  root.querySelector('[data-action="build-point-settlement"]')?.addEventListener('click', () => {
    buildOrdinarySettlement(state, state.openPointId);
    render();
  });

  root.querySelector('[data-action="build-point-warehouse"]')?.addEventListener('click', () => {
    buildPointWarehouse(state, state.openPointId);
    render();
  });

  root.querySelector('[data-action="start-era"]').addEventListener('click', () => {
    ensureScheduledDisasterForEra(state);
    const startDisasterEffects = getEraDisasterEffects(state.mapType, state.era, state);
    state.isRunning = true;
    state.timeLeft = state.timeLeft > 0 ? state.timeLeft : ERA_SECONDS;
    state.productionThisEra = { food: 0, fuel: 0, material: 0 };
    state.eventLog = [`第${state.era}纪开始。`, startDisasterEffects.warning];
    startTimer();
    render();
  });

  root.querySelector('[data-action="pause"]').addEventListener('click', () => {
    state.isRunning = !state.isRunning;
    if (state.isRunning) {
      startTimer();
    }
    render();
  });

  root.querySelectorAll('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => {
      state.speed = Number(button.dataset.speed);
      render();
    });
  });

  bindDebugConsoleControls(root, state, render, debugEnabled);
}

function renderTopHud(state) {
  return `
    <header class="top-hud">
      <div class="hud-left">
        <strong>原始聚落</strong>
        <span>地图 ${state.mapType}</span>
        <span>第 ${state.generation} 世</span>
        <span data-hud-era>第 ${state.era} / ${MAX_ERA} 纪</span>
        <span data-hud-households>总计 ${state.households} / ${state.householdCapacity} 户</span>
        <span data-hud-idle>空闲户 ${state.idleHouseholds}</span>
        <span data-hud-food>食物 ${formatNumber(state.resources.food)} / ${state.resourceCaps.food}</span>
        <span data-hud-fuel>燃料 ${formatNumber(state.resources.fuel)} / ${state.resourceCaps.fuel}</span>
        <span data-hud-material>材料 ${formatNumber(state.resources.material)} / ${state.resourceCaps.material}</span>
      </div>
      <div class="hud-timer" data-hud-timer>${getTimerText(state)}</div>
      <div class="hud-controls">
        <button class="primary-action" type="button" data-action="start-era" ${state.isRunning || state.timeLeft < ERA_SECONDS ? 'disabled' : ''}>开始本纪</button>
        <button type="button" data-action="pause">${state.isRunning ? '暂停' : '继续'}</button>
        <button type="button" data-speed="1" class="${state.speed === 1 ? 'is-selected' : ''}">1x</button>
        <button type="button" data-speed="2" class="${state.speed === 2 ? 'is-selected' : ''}">2x</button>
        <button type="button" data-speed="5" class="${state.speed === 5 ? 'is-selected' : ''}">5x</button>
        <button type="button" data-speed="10" class="${state.speed === 10 ? 'is-selected' : ''}">10x</button>
      </div>
    </header>
  `;
}

function renderEventWarningPanel(state, disasterEffects) {
  const recentEvents = state.eventLog.slice(-4);
  const eventKey = createEventWarningKey(state, disasterEffects);

  return `
    <aside class="event-warning-panel" data-event-warning-key="${eventKey}">
      <h2>事件与预警</h2>
      <p>${disasterEffects.warning}</p>
      ${recentEvents.length > 0
        ? `<ul>${recentEvents.map((event) => `<li>${event}</li>`).join('')}</ul>`
        : '<p>本纪尚未开始。</p>'}
    </aside>
  `;
}

function createEventWarningKey(state, disasterEffects) {
  return [
    state.era,
    disasterEffects.warning,
    state.eventLog.slice(-4).join('|'),
  ].join('::');
}

function renderRightActionRail() {
  return `
    <nav class="right-action-rail" aria-label="功能入口">
      <button class="action-rail-button" type="button" data-open-panel="tech">科技</button>
      <button class="action-rail-button" type="button" data-open-panel="development">聚落发展</button>
      <button class="action-rail-button" type="button" data-open-panel="work">工作分配</button>
    </nav>
  `;
}

function renderDebugConsole(state, debugEnabled) {
  if (!debugEnabled || !state.debugConsoleOpen) {
    return '';
  }

  const consoleStyle = 'position:fixed;right:16px;bottom:16px;z-index:2000;width:min(320px,calc(100vw - 32px));padding:12px;border:1px solid rgb(255 210 95 / 0.45);border-radius:8px;background:rgb(18 22 20 / 0.94);color:#fffdf7;box-shadow:0 16px 48px rgb(0 0 0 / 0.35);font-size:13px;pointer-events:auto;';
  const headerStyle = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;';
  const rowStyle = 'display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;margin:6px 0;';

  return `
    <aside class="debug-console" style="${consoleStyle}" data-debug-console>
      <header style="${headerStyle}">
        <strong>Debug Console / 上帝控制台</strong>
        <button type="button" data-debug-close>关闭</button>
      </header>
      <div style="${rowStyle}">
        <span>食物 ${formatNumber(state.resources.food)} / ${state.resourceCaps.food}</span>
        <button type="button" data-debug-resource="food" data-debug-delta="-10" ${state.resources.food <= 0 ? 'disabled' : ''}>-10</button>
        <button type="button" data-debug-resource="food" data-debug-delta="10" ${state.resources.food >= state.resourceCaps.food ? 'disabled' : ''}>+10</button>
      </div>
      <div style="${rowStyle}">
        <span>燃料 ${formatNumber(state.resources.fuel)} / ${state.resourceCaps.fuel}</span>
        <button type="button" data-debug-resource="fuel" data-debug-delta="-10" ${state.resources.fuel <= 0 ? 'disabled' : ''}>-10</button>
        <button type="button" data-debug-resource="fuel" data-debug-delta="10" ${state.resources.fuel >= state.resourceCaps.fuel ? 'disabled' : ''}>+10</button>
      </div>
      <div style="${rowStyle}">
        <span>材料 ${formatNumber(state.resources.material)} / ${state.resourceCaps.material}</span>
        <button type="button" data-debug-resource="material" data-debug-delta="-10" ${state.resources.material <= 0 ? 'disabled' : ''}>-10</button>
        <button type="button" data-debug-resource="material" data-debug-delta="10" ${state.resources.material >= state.resourceCaps.material ? 'disabled' : ''}>+10</button>
      </div>
      <div style="${rowStyle}">
        <span>户数 ${state.households} / ${state.householdCapacity}，空闲 ${state.idleHouseholds}</span>
        <button type="button" data-debug-households="-1" ${state.idleHouseholds <= 0 || state.households <= 0 ? 'disabled' : ''}>-1</button>
        <button type="button" data-debug-households="1" ${state.households >= state.householdCapacity ? 'disabled' : ''}>+1</button>
      </div>
    </aside>
  `;
}

function bindDebugConsoleControls(root, state, render, debugEnabled) {
  if (!debugEnabled || !state.debugConsoleOpen) {
    return;
  }

  root.querySelector('[data-debug-console]')?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  root.querySelector('[data-debug-close]')?.addEventListener('click', () => {
    state.debugConsoleOpen = false;
    render();
  });

  root.querySelectorAll('[data-debug-resource]').forEach((button) => {
    button.addEventListener('click', () => {
      adjustDebugResource(
        state,
        button.dataset.debugResource,
        Number(button.dataset.debugDelta),
      );
      render();
    });
  });

  root.querySelectorAll('[data-debug-households]').forEach((button) => {
    button.addEventListener('click', () => {
      adjustDebugHouseholds(state, Number(button.dataset.debugHouseholds));
      render();
    });
  });
}

function adjustDebugResource(state, resource, delta) {
  if (!['food', 'fuel', 'material'].includes(resource) || !Number.isFinite(delta)) {
    return;
  }

  const nextValue = Math.min(
    state.resourceCaps[resource],
    Math.max(0, state.resources[resource] + delta),
  );
  state.resources[resource] = roundResource(nextValue);
}

function adjustDebugHouseholds(state, delta) {
  if (delta > 0 && state.households < state.householdCapacity) {
    state.households += 1;
    state.idleHouseholds += 1;
    updateHighestHouseholds(state);
    return;
  }

  if (delta < 0 && state.idleHouseholds > 0 && state.households > 0) {
    state.households -= 1;
    state.idleHouseholds -= 1;
  }
}

function renderPanelModal(state, disasterEffects) {
  if (!state.openPanel) {
    return '';
  }

  const titles = {
    tech: '科技',
    development: '聚落发展',
    work: '工作分配',
  };
  const body = {
    tech: renderTechPanel(state),
    development: renderSettlementDevelopmentPanel(state),
    work: `
      <section class="work-assignment-panel">
        <div class="work-list">
          ${state.assignedWorkers.map((work, index) => renderWorkCard(state, work, index, state.isRunning, disasterEffects)).join('')}
        </div>
      </section>
    `,
  }[state.openPanel] ?? '';

  return `
    <div class="modal-overlay" data-panel-modal-backdrop>
      <section class="modal-panel" role="dialog" aria-modal="true" data-panel-modal data-panel-modal-panel>
        <header class="modal-header">
          <h2>${titles[state.openPanel] ?? '面板'}</h2>
          <button type="button" data-close-panel>关闭</button>
        </header>
        <div class="modal-body">
          ${body}
        </div>
      </section>
    </div>
  `;
}

function rememberPanelScroll(root, state) {
  const modalBody = root.querySelector?.('.modal-body');
  if (modalBody && state.openPanel) {
    state.panelScrollTop = modalBody.scrollTop;
  }
}

function restorePanelScroll(root, state) {
  const modalBody = root.querySelector?.('.modal-body');
  if (modalBody && Number.isFinite(state.panelScrollTop)) {
    modalBody.scrollTop = state.panelScrollTop;
  }
}

function renderSettlementPage(root, state, render) {
  const isTerminalSettlement = state.pendingVictory && state.era >= MAX_ERA;

  root.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <p class="eyebrow">第${state.era}纪结算</p>
        <h1>${isTerminalSettlement ? '第十五纪终末结算' : '本纪结算'}</h1>
        ${isTerminalSettlement ? '<p>第十五纪的灾难已经过去，文明没有完全熄灭。终末之后，先清点这一纪留下的代价。</p>' : ''}
        <ol class="settlement-lines">
          ${state.settlementLines.map((line) => `<li>${line}</li>`).join('')}
        </ol>
        ${renderSettlementAction(state)}
      </section>
    </main>
  `;

  const nextButton = root.querySelector('[data-action="next-era"]');
  if (nextButton) {
    nextButton.addEventListener('click', () => {
      closeAllModals(state);
      state.era += 1;
      prepareScheduledDisasterForEra(state);
      state.currentPage = 'main';
      state.eventLog = [];
      state.timeLeft = ERA_SECONDS;
      state.isRunning = false;
      state.panelScrollTop = 0;
      render();
    });
  }

  const lostButton = root.querySelector('[data-action="lost"]');
  if (lostButton) {
    lostButton.addEventListener('click', () => {
      closeAllModals(state);
      state.currentPage = 'lost';
      state.panelScrollTop = 0;
      render();
    });
  }

  const wonButton = root.querySelector('[data-action="won"]');
  if (wonButton) {
    wonButton.addEventListener('click', () => {
      closeAllModals(state);
      state.pendingVictory = false;
      state.currentPage = 'won';
      state.panelScrollTop = 0;
      render();
    });
  }
}

function renderPlaceholderPage(root, title, body) {
  root.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <h1>${title}</h1>
        <p>${body}</p>
      </section>
    </main>
  `;
}

function renderLostPage(root, state, render) {
  const researchedTechs = getResearchedTechNames(state);
  const legacyPoints = getAvailableLegacyPoints(state);

  root.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <p class="eyebrow">文明灭亡</p>
        <h1>第 ${state.generation} 世文明灭亡</h1>
        <div class="stat-grid">
          <div>终止于第 ${state.era} 纪</div>
          <div>本世损失户数 ${state.currentCivilizationDeaths}</div>
          <div>所有世累计损失 ${state.totalDeathsAllCivilizations}</div>
          <div>本世最高户数 ${state.highestHouseholdsThisCivilization}</div>
          <div>本世已研究科技 ${researchedTechs.length > 0 ? researchedTechs.join('、') : '无'}</div>
          <div>普通聚落数量 ${state.ordinarySettlementCount}</div>
          <div>仓库数量 ${state.warehouseCount}</div>
          <div>可留下文明遗产 ${legacyPoints} 点</div>
        </div>
        <button class="primary-action" type="button" data-action="choose-legacy">选择文明遗产</button>
      </section>
    </main>
  `;

  root.querySelector('[data-action="choose-legacy"]').addEventListener('click', () => {
    closeAllModals(state);
    state.pendingLegacyChoice = null;
    state.pendingLegacyChoices = [];
    state.currentPage = 'legacy';
    state.panelScrollTop = 0;
    render();
  });
}

function renderLegacyPage(root, state, render) {
  const legacyPoints = getAvailableLegacyPoints(state);
  const selectedIds = state.pendingLegacyChoices ?? (state.pendingLegacyChoice ? [state.pendingLegacyChoice] : []);
  const selectedOptions = LEGACY_OPTIONS.filter((option) => selectedIds.includes(option.id));
  const usedPoints = selectedIds.length;
  const remainingPoints = legacyPoints - usedPoints;

  root.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <p class="eyebrow">文明遗产</p>
        <h1>选择传给下一世的薪火</h1>
        <p>可用遗产点：${legacyPoints}</p>
        <p>已用遗产点：${usedPoints}</p>
        <p>剩余遗产点：${remainingPoints}</p>
        <p>已选遗产：${selectedOptions.length > 0 ? selectedOptions.map((option) => option.name).join('、') : '无'}</p>
        <div class="legacy-options">
          ${LEGACY_OPTIONS.map((option) => `
            <button class="legacy-option ${selectedIds.includes(option.id) ? 'is-selected' : ''}" type="button" data-legacy="${option.id}">
              <strong>${option.name}</strong>
              <span>${option.description}</span>
            </button>
          `).join('')}
        </div>
        <div class="notice">
          ${selectedOptions.length > 0 ? selectedOptions.map((option) => `<p>${option.description}</p>`).join('') : '<p>请选择遗产选项。</p>'}
          ${remainingPoints <= 0 ? '<p>遗产点已用完。</p>' : ''}
        </div>
        <button class="primary-action" type="button" data-action="confirm-legacy" ${selectedOptions.length > 0 ? '' : 'disabled'}>确认遗产，开始下一世</button>
      </section>
    </main>
  `;

  root.querySelectorAll('[data-legacy]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextSelectedIds = new Set(state.pendingLegacyChoices ?? []);
      if (nextSelectedIds.has(button.dataset.legacy)) {
        nextSelectedIds.delete(button.dataset.legacy);
      } else if (nextSelectedIds.size < legacyPoints) {
        nextSelectedIds.add(button.dataset.legacy);
      } else {
        window.alert?.('遗产点不足');
      }
      state.pendingLegacyChoices = Array.from(nextSelectedIds);
      state.pendingLegacyChoice = state.pendingLegacyChoices[0] ?? null;
      render();
    });
  });

  root.querySelector('[data-action="confirm-legacy"]').addEventListener('click', () => {
    const choices = LEGACY_OPTIONS.filter((option) => (state.pendingLegacyChoices ?? []).includes(option.id));
    state.activeLegacyBonuses = choices;
    state.activeLegacyBonus = choices[0] ?? null;
    state.generation += 1;
    prepareGeneration(state, generateMap());
    render();
  });
}

function renderVictoryPage(root, state, render) {
  const researchedTechs = getResearchedTechNames(state);

  root.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <p class="eyebrow">通关结算</p>
        <h1>文明撑过了第十五纪</h1>
        <div class="stat-grid">
          <div>通关世数：第 ${state.generation} 世</div>
          <div>所有世累计损失户数：${state.totalDeathsAllCivilizations}</div>
          <div>当前世损失户数：${state.currentCivilizationDeaths}</div>
          <div>最终户数：${state.households}</div>
          <div>当前世最高户数：${state.highestHouseholdsThisCivilization}</div>
          <div>食物 ${formatNumber(state.resources.food)} / ${state.resourceCaps.food}</div>
          <div>燃料 ${formatNumber(state.resources.fuel)} / ${state.resourceCaps.fuel}</div>
          <div>材料 ${formatNumber(state.resources.material)} / ${state.resourceCaps.material}</div>
          <div>已研究科技：${researchedTechs.length > 0 ? researchedTechs.join('、') : '无'}</div>
          <div>普通聚落数量：${state.ordinarySettlementCount}</div>
          <div>仓库数量：${state.warehouseCount}</div>
          <div>最终地图类型：${state.mapType}</div>
        </div>
        <p>第十五纪之后，世界仍未恢复秩序，但这一支文明已经把薪火带出了长夜。</p>
        <p>本版本暂不保存历史记录，建议截图保存本次结局。</p>
        <button class="primary-action" type="button" data-action="restart-run">开始新局</button>
      </section>
    </main>
  `;

  root.querySelector('[data-action="restart-run"]').addEventListener('click', () => {
    resetRunToStart(state);
    render();
  });
}

function renderMainMap(state, disasterEffects) {
  return `
    <section class="main-map-panel">
      <h2>文明地图</h2>
      ${renderIslandMap(state, {
        size: 'large',
        showIndexes: true,
        showCorePoint: true,
        showAllPoints: true,
        showWorkStatus: true,
        disasterEffects,
      })}
    </section>
  `;
}

function renderSelectedTilePanel(state, disasterEffects) {
  return '';
}

function renderPointModal(state, disasterEffects) {
  const point = state.points.find((item) => item.id === state.openPointId);

  if (!point) {
    return '';
  }

  const adjacentTypes = point.adjacentTileIds
    .map((tileId) => TERRAIN_LABELS[state.tiles[tileId - 1].terrain])
    .join('、');
  const pointType = getPointType(state, point.id);
  const distance = getNearestSettlementDistance(point.id, state);
  const inRange = isPointWithinInfluence(point.id, state);
  const buildable = isPointBuildable(point.id, state);
  const settlementCost = getBuildingCost(state, { food: 6, fuel: 8, material: 12 });
  const warehouseCost = getBuildingCost(state, { food: 3, fuel: 5, material: 12 });
  const typeLabel = {
    core: '核心聚落',
    ordinarySettlement: '普通聚落',
    warehouse: '仓库',
    empty: '空点',
  }[pointType];
  const adjacentWork = point.adjacentTileIds
    .map((tileId) => {
      const tileIndex = tileId - 1;
      const tile = state.tiles[tileIndex];
      const work = getWorkForTile(state, tileIndex);
      const rule = work ? getWorkRule(state, work) : getWorkRule(state, { terrain: tile.terrain });

      return `
        <li data-point-work-progress="${tileIndex}">
          地块${tileId} ${TERRAIN_LABELS[tile.terrain]}：
          ${rule.name}，工人 ${work?.workers ?? 0}/${WORKERS_PER_TILE_CAP}，进度 ${formatNumber(work?.progress ?? 0)}/${rule.progressNeeded}
        </li>
      `;
    })
    .join('');

  return `
    <div class="point-modal-backdrop" data-point-modal-backdrop>
      <div class="point-modal point-modal-panel" role="dialog" aria-modal="true" data-point-modal data-point-modal-panel>
        <button class="point-modal-close" type="button" data-close-point-modal aria-label="关闭点子页面">×</button>
        <h2>地图点 ${point.id.slice(0, 6)}</h2>
        <p>点类型：${typeLabel}</p>
        <p>相邻地块编号：${point.adjacentTileIds.join('、')}</p>
        <p>相邻地块类型：${adjacentTypes}</p>
        <p>到最近聚落的距离：${distance === Infinity ? '不可达' : distance}</p>
        <p>当前影响范围等级：${state.influenceLevel}</p>
        <p>是否在影响范围内：${inRange ? '是' : '否'}</p>
        <p>是否可建设：${buildable ? '是' : '否'}</p>
        ${pointType === 'core' ? `
          <div class="notice">
            <p>核心聚落</p>
            <p>影响范围来源：是</p>
            <p>户容量贡献：8</p>
            <p>基础资源上限贡献：食物30 / 燃料30 / 材料30</p>
            <p>相邻地块已纳入文明工作范围。</p>
          </div>
        ` : ''}
        ${pointType === 'ordinarySettlement' ? `
          <div class="notice">
            <p>普通聚落</p>
            <p>影响范围来源：是</p>
            <p>户容量贡献：6</p>
            <p>资源上限贡献：食物20 / 燃料20 / 材料20</p>
            <p>相邻地块已纳入工作范围。</p>
          </div>
        ` : ''}
        ${pointType === 'warehouse' ? `
          <div class="notice">
            <p>仓库</p>
            <p>影响范围来源：否</p>
            <p>资源上限贡献：食物20 / 燃料20 / 材料20</p>
            <p>库存保护：每座仓库减少最终库存损失 ${formatNumber(getWarehouseProtectionPerWarehouse(state) * 100)}%，总保护上限 60%。</p>
            <p>仓库不解锁相邻地块工作。</p>
          </div>
        ` : ''}
        ${pointType === 'empty' ? `
          <div class="notice">
            <p>当前为空点。</p>
            ${inRange ? '<p>该点位于文明影响范围内，可以作为建设候选。</p>' : `
              <p>该点超出文明影响范围。</p>
              <p>当前影响范围：${state.influenceLevel}。</p>
              <p>到最近聚落距离：${distance === Infinity ? '不可达' : distance}。</p>
              <p>请先升级影响范围，或在更近的位置建立普通聚落。</p>
            `}
            ${state.isRunning ? '<p>运行中不可建造，请暂停或等待本纪结束。</p>' : ''}
            <div class="controls">
              <button type="button" data-action="build-point-settlement" ${!buildable || !canAfford(state, settlementCost) ? 'disabled' : ''}>建造普通聚落（食物${settlementCost.food} / 燃料${settlementCost.fuel} / 材料${settlementCost.material}）</button>
              <button type="button" data-action="build-point-warehouse" ${!buildable || !canAfford(state, warehouseCost) ? 'disabled' : ''}>建造仓库（食物${warehouseCost.food} / 燃料${warehouseCost.fuel} / 材料${warehouseCost.material}）</button>
            </div>
          </div>
        ` : ''}
        <h3>相邻地块工作情况</h3>
        <ul>${adjacentWork}</ul>
      </div>
    </div>
  `;
}

function renderTechPanel(state) {
  const researchMultiplier = getResearchMultiplier(state);
  return `
    <section class="tech-panel">
      <h2>技术研究</h2>
      ${researchMultiplier > 1 ? '<p class="safe-site-note">文字已解锁：科研效率 +20%</p>' : ''}
      <div class="tech-list">
        ${Object.entries(TECH_DEFINITIONS).map(([techId, definition]) => renderTechCard(state, techId, definition)).join('')}
      </div>
    </section>
  `;
}

function renderSettlementDevelopmentPanel(state) {
  const canAct = !state.isRunning;
  const buildingMaintenanceCost = getBuildingMaintenanceCost(state);
  const warehouseProtectionPerWarehouse = formatNumber(getWarehouseProtectionPerWarehouse(state) * 100);
  const warehouseProtectionRate = getWarehouseProtectionRate(state);
  const warehouseProtection = formatNumber(warehouseProtectionRate * 100);
  const warehouseLossMultiplier = formatNumber((1 - warehouseProtectionRate) * 100);
  const nextInfluenceCost = getBuildingCost(state, getInfluenceUpgradeCost(state.influenceLevel + 1));
  const householdCost = getHouseholdGrowthCost(state);
  const householdCostNote = isTechUnlocked(state, 'agriculture') ? '农耕使增户成本降低。' : '';
  const growText = state.households >= state.householdCapacity
    ? `增户：消耗食物${householdCost.food}。容量已满，需要扩建聚落。`
    : state.resources.food < householdCost.food
      ? `增户：消耗食物${householdCost.food}。${householdCostNote}食物不足。`
      : `增户：消耗食物${householdCost.food}。${householdCostNote}当前户数 ${state.households} / 容量 ${state.householdCapacity}。`;

  return `
    <section class="development-panel">
      <h2>聚落发展</h2>
      <div class="stat-grid">
        <div>核心聚落 1</div>
        <div data-settlement-influence>影响范围等级 ${state.influenceLevel} / 4</div>
        <div>可建设距离 聚落周围 ${state.influenceLevel} 格点</div>
        <div data-settlement-ordinary>普通聚落数量 ${state.ordinarySettlementCount}</div>
        <div data-settlement-warehouses>仓库数量 ${state.warehouseCount}</div>
        <div>当前可建设点 ${getBuildablePoints(state).length}</div>
        <div data-settlement-buildings>建筑数 ${getBuildingCount(state)}</div>
        <div data-settlement-maintenance>建筑维护 材料-${buildingMaintenanceCost} / 纪</div>
        <div data-settlement-capacity>户容量 ${state.householdCapacity}</div>
        <div data-settlement-resources>资源上限 食物${state.resourceCaps.food} / 燃料${state.resourceCaps.fuel} / 材料${state.resourceCaps.material}</div>
        <div data-settlement-storage-reduction>仓库保护 每座${warehouseProtectionPerWarehouse}% / 当前${warehouseProtection}% / 上限60%，库存损失按 ${warehouseLossMultiplier}% 结算</div>
        <div data-settlement-households>当前户数 ${state.households}</div>
        <div data-settlement-idle>空闲户 ${state.idleHouseholds}</div>
      </div>
      <p>${state.influenceLevel >= 4 ? '已达到最高影响范围。' : `下一级升级成本：燃料${nextInfluenceCost.fuel} / 材料${nextInfluenceCost.material}。`}</p>
      <p>普通聚落和仓库现在需要点击地图上的可建设顶点建造。</p>
      <div class="map-legend">
        <span><b class="legend-dot core"></b>红：核心聚落</span>
        <span><b class="legend-dot settlement"></b>橙：普通聚落</span>
        <span><b class="legend-dot warehouse"></b>黄：仓库</span>
        <span><b class="legend-dot buildable"></b>绿：可建设点</span>
        <span><b class="legend-dot muted"></b>灰：超出影响范围</span>
      </div>
      <p>${growText}</p>
      <div class="controls">
        <button type="button" data-action="grow-household" ${!canAct || state.households >= state.householdCapacity || state.resources.food < householdCost.food ? 'disabled' : ''}>增户（食物${householdCost.food}）</button>
        <button type="button" data-action="upgrade-influence" ${!canAct || state.influenceLevel >= 4 || !canAfford(state, nextInfluenceCost) ? 'disabled' : ''}>升级影响范围</button>
      </div>
    </section>
  `;
}

function renderTechCard(state, techId, definition) {
  const tech = state.techs[techId];
  const prerequisiteName = definition.prerequisite
    ? TECH_DEFINITIONS[definition.prerequisite]?.name
    : null;
  const prerequisiteMet = !definition.prerequisite || isTechUnlocked(state, definition.prerequisite);
  const canEdit = !state.isRunning && !tech.unlocked && prerequisiteMet;

  return `
    <article class="tech-card" data-tech-card="${techId}">
      <h3>${definition.name}</h3>
      <p>${definition.description}</p>
      ${prerequisiteName ? `<p>前置：${prerequisiteName}${prerequisiteMet ? '（已满足）' : '（未满足）'}</p>` : ''}
      <p data-tech-progress="${techId}">研究进度：${formatNumber(tech.progress)} / ${definition.requirement}</p>
      <p data-tech-workers="${techId}">研究户数：${tech.workers} / 3</p>
      <div class="worker-buttons">
        <button type="button" data-tech-unassign="${techId}" ${!canEdit || tech.workers <= 0 ? 'disabled' : ''}>-</button>
        <button type="button" data-tech-assign="${techId}" ${!canEdit || tech.workers >= 3 || state.idleHouseholds <= 0 ? 'disabled' : ''}>+</button>
      </div>
      ${!prerequisiteMet ? `<p class="safe-site-note">需要先研究【${prerequisiteName}】</p>` : ''}
      <p class="safe-site-note" data-tech-status="${techId}">${tech.unlocked ? '已解锁' : ''}</p>
    </article>
  `;
}

function renderWorkCard(state, work, index, isRunning, disasterEffects) {
  const rule = getWorkRule(state, work);
  const efficiency = getWorkEfficiencyMultiplier(disasterEffects, work.terrain);
  const seconds = work.workers > 0
    ? (Math.max(0, rule.progressNeeded - work.progress) / (work.workers * WORK_PROGRESS_PER_WORKER_PER_SECOND * efficiency))
    : null;
  const progressPercent = Math.min(100, (work.progress / rule.progressNeeded) * 100);

  return `
    <article class="work-card" data-work-card="${work.tileIndex}">
      <h2>${TERRAIN_LABELS[work.terrain]}</h2>
      <p data-work-current-job="${work.tileIndex}">当前工作：${rule.name}</p>
      <p data-work-output="${work.tileIndex}">产出：${RESOURCE_LABELS[rule.resource]} +${rule.amount}</p>
      <p data-work-workers="${work.tileIndex}">已分配户数：${work.workers} / ${WORKERS_PER_TILE_CAP}</p>
      <p>效率：${formatNumber(efficiency * 100)}%</p>
      <p data-work-rate="${work.tileIndex}">${RESOURCE_LABELS[rule.resource]} +${rule.amount} / ${seconds ? `${formatNumber(seconds)}秒` : '未分配'}</p>
      <div class="progress-bar"><span data-work-progress="${work.tileIndex}" style="width: ${progressPercent}%"></span></div>
      <div class="worker-buttons">
        <button type="button" data-unassign="${index}" ${work.workers <= 0 || isRunning ? 'disabled' : ''}>-</button>
        <button type="button" data-assign="${index}" ${work.workers >= WORKERS_PER_TILE_CAP || state.idleHouseholds <= 0 || isRunning ? 'disabled' : ''}>+</button>
      </div>
      ${renderJobSwitchControl(state, work, index)}
    </article>
  `;
}

function renderJobSwitchControl(state, work, index) {
  if (![TERRAIN.GRASSLAND, TERRAIN.FOREST, TERRAIN.MOUNTAIN].includes(work.terrain)) {
    return '';
  }

  const currentJobId = normalizeWorkJob(state, work);
  const jobRows = Object.values(JOB_DEFINITIONS)
    .filter((job) => job.terrain === work.terrain)
    .map((job) => {
      const unlocked = !job.requiredTech || isTechUnlocked(state, job.requiredTech);
      const techName = job.requiredTech ? TECH_DEFINITIONS[job.requiredTech].name : '';
      const previewRule = getWorkRule(state, { terrain: work.terrain, jobId: job.id });

      if (job.id === currentJobId) {
        return `<p>${previewRule.name}：${RESOURCE_LABELS[previewRule.resource]} +${previewRule.amount} / ${previewRule.progressNeeded}（当前）</p>`;
      }

      if (!unlocked) {
        return `<p>${job.name}：需要科技【${techName}】</p>`;
      }

      return `
        <button type="button" data-switch-job="${index}" data-target-job="${job.id}" ${!canAdjust(state) ? 'disabled' : ''}>
          切换为${job.name}
        </button>
      `;
    })
    .join('');

  return `
    <div class="controls">
      ${jobRows}
    </div>
  `;
}

function renderSettlementAction(state) {
  if (state.households <= 0) {
    return '<button class="primary-action" type="button" data-action="lost">查看文明灭亡</button>';
  }

  if (state.era >= MAX_ERA) {
    return '<button class="primary-action" type="button" data-action="won">查看通关结算</button>';
  }

  return '<button class="primary-action" type="button" data-action="next-era">进入下一纪准备</button>';
}

function advanceEra(state, deltaSeconds) {
  const adjustedDelta = deltaSeconds * state.speed;
  const previousElapsed = ERA_SECONDS - state.timeLeft;
  state.timeLeft = Math.max(0, state.timeLeft - adjustedDelta);
  const currentElapsed = ERA_SECONDS - state.timeLeft;

  produceResources(state, adjustedDelta);
  const techUnlocked = advanceResearch(state, adjustedDelta);
  const eventTriggered = triggerTimedEvents(state, previousElapsed, currentElapsed);
  let eraEnded = false;

  if (state.timeLeft <= 0) {
    state.isRunning = false;
    state.timeLeft = 0;
    closeAllModals(state);
    state.panelScrollTop = 0;
    state.settlementLines = settleEra(state);
    state.pendingVictory = state.households > 0 && state.era >= MAX_ERA;
    state.currentPage = 'settlement';
    eraEnded = true;
  }

  return { techUnlocked, eventTriggered, eraEnded };
}

function produceResources(state, deltaSeconds) {
  const disasterEffects = getEraDisasterEffects(state.mapType, state.era, state);

  state.assignedWorkers.forEach((work) => {
    if (work.workers <= 0) {
      return;
    }

    const rule = getWorkRule(state, work);
    work.progress += work.workers * WORK_PROGRESS_PER_WORKER_PER_SECOND * deltaSeconds * getWorkEfficiencyMultiplier(disasterEffects, work.terrain);

    while (work.progress >= rule.progressNeeded) {
      work.progress -= rule.progressNeeded;
      const before = state.resources[rule.resource];
      state.resources[rule.resource] = Math.min(
        state.resourceCaps[rule.resource],
        state.resources[rule.resource] + rule.amount,
      );
      const gained = state.resources[rule.resource] - before;
      state.productionThisEra[rule.resource] += gained;
    }
  });
}

function triggerTimedEvents(state, previousElapsed, currentElapsed) {
  let triggered = false;

  [20, 40].forEach((second) => {
    if (previousElapsed < second && currentElapsed >= second) {
      triggered = true;
      if (Math.random() < 0.1) {
        if (state.households < state.householdCapacity) {
          state.households += 1;
          state.idleHouseholds += 1;
          updateHighestHouseholds(state);
          state.eventLog.push('一户流民加入了文明。');
        } else {
          state.eventLog.push('有流民经过，但无处安置。');
        }
      } else {
        state.eventLog.push(`第${second}秒：${getEventLogText(state, second)}`);
      }
    }
  });

  return triggered;
}

function settleEra(state) {
  ensureScheduledDisasterForEra(state);
  const disasterEffects = getEraDisasterEffects(state.mapType, state.era, state);
  const production = state.productionThisEra || { food: 0, fuel: 0, material: 0 };
  const beforeHouseholds = state.households;
  const foodNeed = 1;
  const baseFuelNeed = 0.5;
  const disasterFuelNeed = baseFuelNeed * (disasterEffects.fuelMultiplier - 1) + disasterEffects.extraFuelPerHousehold;
  const adjustedDisasterFuelNeed = applyCalendarReductionToDisasterCost(disasterFuelNeed, state, disasterEffects);
  const fuelNeed = baseFuelNeed + adjustedDisasterFuelNeed;
  const maintenanceResult = applyBuildingMaintenance(state);
  const inventoryLossLines = applyInventoryLosses(state, disasterEffects);
  const foodCanSupport = Math.floor(state.resources.food / foodNeed);
  const fuelCanSupport = Math.floor(state.resources.fuel / fuelNeed);
  const supported = Math.min(state.households, foodCanSupport, fuelCanSupport);
  const consumedFood = supported * foodNeed;
  const consumedFuel = supported * fuelNeed;
  const supplyDeaths = state.households - supported;

  state.resources.food = roundResource(Math.max(0, state.resources.food - consumedFood));
  state.resources.fuel = roundResource(Math.max(0, state.resources.fuel - consumedFuel));

  const actualSupplyDeaths = supplyDeaths > 0 ? removeDeadHouseholds(state, supplyDeaths) : 0;

  const materialResult = applyMaterialDemand(state, disasterEffects);

  return [
    `本纪资源产出：食物 +${formatNumber(production.food)}，燃料 +${formatNumber(production.fuel)}，材料 +${formatNumber(production.material)}。`,
    createBuildingMaintenanceLine(maintenanceResult),
    createDisasterSummaryLine(disasterEffects),
    ...createEfficiencySettlementLines(disasterEffects),
    ...inventoryLossLines,
    ...createFuelSettlementLines(disasterEffects, state),
    `食物/燃料供养计算：食物可供养 ${foodCanSupport} 户，燃料可供养 ${fuelCanSupport} 户，实际供养 ${supported}/${beforeHouseholds} 户。`,
    `消耗：食物 ${formatNumber(consumedFood)}，燃料 ${formatNumber(consumedFuel)}。`,
    materialResult.line,
    `死亡户数：${actualSupplyDeaths + materialResult.deaths} 户。`,
    `结算后户数：${state.households} 户（结算前 ${beforeHouseholds} 户）。`,
    `结算后资源：食物 ${formatNumber(state.resources.food)}，燃料 ${formatNumber(state.resources.fuel)}，材料 ${formatNumber(state.resources.material)}。`,
    `本世累计死亡：${state.currentCivilizationDeaths} 户。`,
    `所有世累计死亡：${state.totalDeathsAllCivilizations} 户。`,
    state.households <= 0
      ? '最终判定：文明灭亡。'
      : state.era >= MAX_ERA
        ? '最终判定：文明撑过了第十五纪。'
        : `最终判定：文明存续，可以进入第${state.era + 1}纪。`,
  ];
}

function createDisasterSummaryLine(disasterEffects) {
  if (disasterEffects.disasterNames.length === 0) {
    return '本纪灾害：无。';
  }

  const levelText = isTerminalDisaster(disasterEffects) ? '终末灾害' : '普通灾害';
  return `本纪灾害：${disasterEffects.disasterNames.join('、')}（${levelText}）。`;
}

function getBuildingMaintenanceCost(state) {
  return getBuildingCount(state) * BUILDING_MAINTENANCE_MATERIAL_PER_BUILDING;
}

function applyBuildingMaintenance(state) {
  const buildingCount = getBuildingCount(state);
  const required = getBuildingMaintenanceCost(state);
  const available = state.resources.material;
  const paid = Math.min(available, required);
  const shortage = Math.max(0, required - paid);

  state.resources.material = roundResource(Math.max(0, available - paid));

  return {
    buildingCount,
    required,
    paid,
    shortage,
  };
}

function createBuildingMaintenanceLine(result) {
  if (result.shortage > 0) {
    return `建筑维护：${result.buildingCount} 座建筑需要 ${result.required} 材料，实际消耗 ${formatNumber(result.paid)}，短缺 ${formatNumber(result.shortage)}。`;
  }

  return `建筑维护：${result.buildingCount} 座建筑消耗 ${formatNumber(result.paid)} 材料。`;
}

function applyInventoryLosses(state, disasterEffects) {
  const lines = [];
  const warehouseProtectionRate = getWarehouseProtectionRate(state);
  const calendarReductionRate = getCalendarDisasterReductionRate(state, disasterEffects);

  Object.entries(disasterEffects.inventoryLoss).forEach(([resource, rate]) => {
    if (rate <= 0) {
      return;
    }

    const before = state.resources[resource];
    const baseLoss = before * rate;
    const protectedLoss = applyWarehouseProtectionToLoss(baseLoss, state);
    const calendarAdjustedLoss = applyCalendarReductionToDisasterCost(protectedLoss, state, disasterEffects);
    const lost = roundResource(Math.min(before, calendarAdjustedLoss));
    const names = disasterEffects.inventoryNotes
      .filter((note) => note.resource === resource)
      .map((note) => note.name);
    const source = names.length > 0 ? `${[...new Set(names)].join('、')}造成` : '';
    state.resources[resource] = roundResource(Math.max(0, before - lost));
    lines.push(`灾害基础库存损失：${source}${RESOURCE_LABELS[resource]}库存损失${formatNumber(rate * 100)}%，基础损失 ${formatNumber(baseLoss)}。`);
    if (state.warehouseCount > 0) {
      lines.push(`仓库保护：仓库${state.warehouseCount}座，减少最终库存损失 ${formatNumber(warehouseProtectionRate * 100)}%，库存损失按 ${formatNumber((1 - warehouseProtectionRate) * 100)}% 结算。`);
    }
    if (calendarReductionRate > 0) {
      lines.push(`历法准备：最终库存损失 -${formatNumber(calendarReductionRate * 100)}%。`);
    }
    lines.push(lost > 0
      ? `最终实际${RESOURCE_LABELS[resource]}损失：${formatNumber(lost)}。`
      : `实际${RESOURCE_LABELS[resource]}损失：0。`);
  });

  return lines.length > 0 ? lines : ['本纪无库存灾害损失。'];
}

function createEfficiencySettlementLines(disasterEffects) {
  if (disasterEffects.efficiencyNotes.length === 0) {
    return ['本纪工作效率未受灾害影响。'];
  }

  return disasterEffects.efficiencyNotes.map((effect) => (
    `本纪工作效率受到影响：${effect.scope}效率 -${formatNumber((1 - effect.multiplier) * 100)}%。`
  ));
}

function createFuelSettlementLines(disasterEffects, state) {
  const lines = [];
  const calendarReductionRate = getCalendarDisasterReductionRate(state, disasterEffects);
  const disasterFuelNeed = 0.5 * (disasterEffects.fuelMultiplier - 1) + disasterEffects.extraFuelPerHousehold;

  if (disasterEffects.fuelMultiplier > 1) {
    lines.push(`灾害额外需求：基础燃料消耗 +${formatNumber((disasterEffects.fuelMultiplier - 1) * 100)}%。`);
  }

  if (disasterEffects.extraFuelPerHousehold > 0) {
    lines.push(`灾害额外需求：每户燃料需求 +${formatNumber(disasterEffects.extraFuelPerHousehold)}。`);
  }

  if (calendarReductionRate > 0 && disasterFuelNeed > 0) {
    lines.push(`历法准备：最终燃料灾害需求 -${formatNumber(calendarReductionRate * 100)}%。`);
  }

  disasterEffects.techNotes.forEach((note) => {
    lines.push(note);
  });

  return lines.length > 0 ? lines : ['本纪无额外燃料需求。'];
}

function applyMaterialDemand(state, disasterEffects) {
  const baseDemand = disasterEffects.materialDemand;
  const calendarReductionRate = getCalendarDisasterReductionRate(state, disasterEffects);

  if (baseDemand <= 0) {
    return {
      deaths: 0,
      line: '本纪无额外材料需求。',
    };
  }

  const demand = roundResource(applyCalendarReductionToDisasterCost(baseDemand, state, disasterEffects));
  const shortage = Math.max(0, demand - state.resources.material);
  const calendarText = calendarReductionRate > 0
    ? `历法准备后实际需求 ${formatNumber(demand)}，最终灾害代价 -${formatNumber(calendarReductionRate * 100)}%。`
    : '';

  if (shortage <= 0) {
    state.resources.material = roundResource(state.resources.material - demand);
    return {
      deaths: 0,
      line: `灾害材料需求：基础需求 ${formatNumber(baseDemand)}。${calendarText}材料充足。`,
    };
  }

  const deaths = Math.ceil(shortage);
  state.resources.material = 0;
  const actualDeaths = removeDeadHouseholds(state, deaths);

  return {
    deaths: actualDeaths,
    line: `灾害材料需求：基础需求 ${formatNumber(baseDemand)}。${calendarText}缺口 ${formatNumber(shortage)}，死亡 ${actualDeaths} 户。`,
  };
}

function removeDeadHouseholds(state, deaths) {
  const actualDeaths = Math.min(deaths, state.households);
  let remaining = actualDeaths;
  const priority = [TERRAIN.MOUNTAIN, TERRAIN.FOREST, TERRAIN.GRASSLAND];

  priority.forEach((terrain) => {
    state.assignedWorkers.forEach((work) => {
      if (remaining <= 0 || work.terrain !== terrain) {
        return;
      }

      const removed = Math.min(work.workers, remaining);
      work.workers -= removed;
      remaining -= removed;
    });
  });

  const idleRemoved = Math.min(state.idleHouseholds, remaining);
  state.idleHouseholds -= idleRemoved;

  state.households -= actualDeaths;
  state.currentCivilizationDeaths += actualDeaths;
  state.totalDeathsAllCivilizations += actualDeaths;
  state.idleHouseholds = Math.max(0, state.households - state.assignedWorkers.reduce((sum, work) => sum + work.workers, 0));
  return actualDeaths;
}

function assignWorker(state, index) {
  const work = state.assignedWorkers[index];

  if (!canAdjust(state) || !work || state.idleHouseholds <= 0 || work.workers >= WORKERS_PER_TILE_CAP) {
    return;
  }

  work.workers += 1;
  state.idleHouseholds -= 1;
}

function unassignWorker(state, index) {
  const work = state.assignedWorkers[index];

  if (!canAdjust(state) || !work || work.workers <= 0) {
    return;
  }

  work.workers -= 1;
  state.idleHouseholds += 1;
}

function switchWorkJob(state, index, targetJobId) {
  const work = state.assignedWorkers[index];
  const targetJob = JOB_DEFINITIONS[targetJobId];

  if (!canAdjust(state) || !work || !targetJob || targetJob.terrain !== work.terrain) {
    return;
  }

  normalizeWorkJob(state, work);

  if (work.jobId === targetJobId || (targetJob.requiredTech && !isTechUnlocked(state, targetJob.requiredTech))) {
    return;
  }

  if (!window.confirm('切换工作会清空该地块当前进度，并撤回该地块上的所有工人。是否确认？')) {
    return;
  }

  state.idleHouseholds += work.workers;
  work.workers = 0;
  work.progress = 0;
  work.jobId = targetJobId;
}

function assignResearchWorker(state, techId) {
  const tech = state.techs[techId];
  const definition = TECH_DEFINITIONS[techId];

  if (!canAdjust(state)
    || !tech
    || !definition
    || tech.unlocked
    || (definition.prerequisite && !isTechUnlocked(state, definition.prerequisite))
    || state.idleHouseholds <= 0
    || tech.workers >= 3) {
    return;
  }

  tech.workers += 1;
  state.idleHouseholds -= 1;
}

function unassignResearchWorker(state, techId) {
  const tech = state.techs[techId];

  if (!canAdjust(state) || !tech || tech.workers <= 0) {
    return;
  }

  tech.workers -= 1;
  state.idleHouseholds += 1;
}

function growHousehold(state) {
  const cost = getHouseholdGrowthCost(state);

  if (!canAdjust(state) || state.households >= state.householdCapacity || !canAfford(state, cost)) {
    return;
  }

  payCost(state, cost);
  state.households += 1;
  state.idleHouseholds += 1;
  updateHighestHouseholds(state);
}

function getHouseholdGrowthCost(state) {
  return {
    food: isTechUnlocked(state, 'agriculture') ? 3 : 4,
  };
}

function getBuildingCost(state, baseCost) {
  const multiplier = isTechUnlocked(state, 'iron')
    ? 0.8
    : isTechUnlocked(state, 'bronze')
      ? 0.9
      : 1;

  return Object.fromEntries(
    Object.entries(baseCost).map(([resource, amount]) => [
      resource,
      amount <= 0 ? 0 : Math.max(1, Math.ceil(amount * multiplier)),
    ]),
  );
}

function expandSettlement(state) {
  const cost = { food: 5, fuel: 5, material: 10 };

  if (!canAdjust(state) || !canAfford(state, cost)) {
    return;
  }

  if (!window.confirm('扩建聚落将消耗 食物5、燃料5、材料10。效果：户容量+4，三资源上限+10。是否确认？')) {
    return;
  }

  payCost(state, cost);
  state.settlementExpansionCount += 1;
  state.householdCapacity += 4;
  addResourceCaps(state, { food: 10, fuel: 10, material: 10 });
}

function buildWarehouse(state) {
  const cost = { food: 3, fuel: 5, material: 12 };
  const warehouseProtectionPerWarehouse = formatNumber(getWarehouseProtectionPerWarehouse(state) * 100);

  if (!canAdjust(state) || !canAfford(state, cost)) {
    return;
  }

  if (!window.confirm(`建造仓库将消耗 食物3、燃料5、材料12。效果：三资源上限+20，并使每座仓库减少最终灾害库存损失${warehouseProtectionPerWarehouse}%。是否确认？`)) {
    return;
  }

  payCost(state, cost);
  state.warehouseCount += 1;
  addResourceCaps(state, { food: 20, fuel: 20, material: 20 });
}

function upgradeInfluence(state) {
  const nextLevel = state.influenceLevel + 1;
  const cost = getBuildingCost(state, getInfluenceUpgradeCost(nextLevel));

  if (!canAdjust(state) || state.influenceLevel >= 4 || !canAfford(state, cost)) {
    return;
  }

  if (!window.confirm(`升级文明影响范围将消耗 燃料${cost.fuel}、材料${cost.material}。升级后可在距离聚落 ${nextLevel} 格内建设。是否确认？`)) {
    return;
  }

  payCost(state, cost);
  state.influenceLevel = nextLevel;
}

function buildOrdinarySettlement(state, pointId) {
  const cost = getBuildingCost(state, { food: 6, fuel: 8, material: 12 });

  if (!pointId || !canAdjust(state) || !isPointBuildable(pointId, state) || !canAfford(state, cost)) {
    return;
  }

  if (!window.confirm(`建造普通聚落将消耗 食物${cost.food}、燃料${cost.fuel}、材料${cost.material}。效果：户容量+6，三资源上限+20，并解锁相邻地块工作。是否确认？`)) {
    return;
  }

  payCost(state, cost);
  state.pointBuildings[pointId] = 'ordinarySettlement';
  state.ordinarySettlementCount += 1;
  state.householdCapacity += 6;
  addResourceCaps(state, { food: 20, fuel: 20, material: 20 });
  refreshWorkTilesFromSettlements(state);
}

function buildPointWarehouse(state, pointId) {
  const cost = getBuildingCost(state, { food: 3, fuel: 5, material: 12 });
  const warehouseProtectionPerWarehouse = formatNumber(getWarehouseProtectionPerWarehouse(state) * 100);

  if (!pointId || !canAdjust(state) || !isPointBuildable(pointId, state) || !canAfford(state, cost)) {
    return;
  }

  if (!window.confirm(`建造仓库将消耗 食物${cost.food}、燃料${cost.fuel}、材料${cost.material}。效果：三资源上限+20，并使每座仓库减少最终灾害库存损失${warehouseProtectionPerWarehouse}%。仓库不会扩展影响范围。是否确认？`)) {
    return;
  }

  payCost(state, cost);
  state.pointBuildings[pointId] = 'warehouse';
  state.warehouseCount += 1;
  addResourceCaps(state, { food: 20, fuel: 20, material: 20 });
}

function getInfluenceUpgradeCost(level) {
  return {
    2: { fuel: 6, material: 10 },
    3: { fuel: 10, material: 18 },
    4: { fuel: 16, material: 28 },
  }[level] ?? { fuel: 0, material: 0 };
}

function canAfford(state, cost) {
  return Object.entries(cost).every(([resource, amount]) => state.resources[resource] >= amount);
}

function payCost(state, cost) {
  Object.entries(cost).forEach(([resource, amount]) => {
    state.resources[resource] = Math.max(0, state.resources[resource] - amount);
  });
}

function addResourceCaps(state, caps) {
  ensureBaseResourceCaps(state);
  Object.entries(caps).forEach(([resource, amount]) => {
    state.baseResourceCaps[resource] += amount;
  });
  refreshResourceCaps(state);
}

function ensureBaseResourceCaps(state) {
  if (!state.baseResourceCaps) {
    state.baseResourceCaps = { ...state.resourceCaps };
  }
}

function refreshResourceCaps(state) {
  ensureBaseResourceCaps(state);
  const foodMultiplier = 1
    + (isTechUnlocked(state, 'pottery') ? 0.2 : 0)
    + (isTechUnlocked(state, 'storage') ? 0.25 : 0);
  const fuelMultiplier = 1 + (isTechUnlocked(state, 'storage') ? 0.15 : 0);
  const materialMultiplier = 1 + (isTechUnlocked(state, 'storage') ? 0.15 : 0);

  state.resourceCaps = {
    food: Math.ceil(state.baseResourceCaps.food * foodMultiplier),
    fuel: Math.ceil(state.baseResourceCaps.fuel * fuelMultiplier),
    material: Math.ceil(state.baseResourceCaps.material * materialMultiplier),
  };
}

function getResearchMultiplier(state) {
  return isTechUnlocked(state, 'writing') ? 1.2 : 1;
}

function getAvailableLegacyPoints(state) {
  return isTechUnlocked(state, 'writing') ? 2 : 1;
}

function canAdjust(state) {
  return !state.isRunning;
}

function advanceResearch(state, deltaSeconds) {
  let unlockedAny = false;

  Object.entries(state.techs).forEach(([techId, tech]) => {
    if (tech.unlocked || tech.workers <= 0) {
      return;
    }

    const definition = TECH_DEFINITIONS[techId];
    if (definition.prerequisite && !isTechUnlocked(state, definition.prerequisite)) {
      return;
    }

    tech.progress = Math.min(
      definition.requirement,
      tech.progress + tech.workers * deltaSeconds * getResearchMultiplier(state),
    );

    if (tech.progress >= definition.requirement) {
      tech.unlocked = true;
      unlockedAny = true;
      state.idleHouseholds += tech.workers;
      tech.workers = 0;
      if (techId === 'pottery' || techId === 'storage') {
        refreshResourceCaps(state);
      }
      state.eventLog.push(`${definition.name}研究完成。`);
    }
  });

  return unlockedAny;
}

function getWorkRule(state, work) {
  const terrain = typeof work === 'string' ? work : work?.terrain;
  const jobId = normalizeWorkJob(state, typeof work === 'string' ? { terrain } : work);
  const rule = JOB_DEFINITIONS[jobId] ?? JOB_DEFINITIONS[DEFAULT_JOBS[terrain]];

  if (rule.requiredTech && !isTechUnlocked(state, rule.requiredTech)) {
    return JOB_DEFINITIONS[DEFAULT_JOBS[terrain]];
  }

  if (jobId === 'stone_gathering' && isTechUnlocked(state, 'stone')) {
    return {
      ...rule,
      amount: rule.amount + 1,
    };
  }

  if (jobId === 'quarrying' && isTechUnlocked(state, 'iron')) {
    return {
      ...rule,
      amount: rule.amount + 1,
    };
  }

  return rule;
}

function normalizeWorkJob(state, work) {
  const defaultJobId = DEFAULT_JOBS[work?.terrain];

  if (!work) {
    return defaultJobId;
  }

  const job = JOB_DEFINITIONS[work.jobId];
  const shouldFallback = !job
    || job.terrain !== work.terrain
    || (job.requiredTech && !isTechUnlocked(state, job.requiredTech));

  if (shouldFallback) {
    work.jobId = defaultJobId;
  }

  return work.jobId;
}

function getWorkForTile(state, tileIndex) {
  return state.assignedWorkers.find((work) => work.tileIndex === tileIndex) ?? null;
}

function isTileInWorkRange(state, tileIndex) {
  return state.selectedCoreAdjacentTileIds.includes(tileIndex + 1);
}

function getPointType(state, pointId) {
  if (pointId === state.selectedCorePointId) {
    return 'core';
  }

  return state.pointBuildings[pointId] ?? 'empty';
}

function getSettlementSourcePointIds(state) {
  return [
    state.selectedCorePointId,
    ...Object.entries(state.pointBuildings)
      .filter(([, type]) => type === 'ordinarySettlement')
      .map(([pointId]) => pointId),
  ].filter(Boolean);
}

function getNearestSettlementDistance(pointId, state) {
  const sources = getSettlementSourcePointIds(state);

  if (sources.includes(pointId)) {
    return 0;
  }

  const visited = new Set(sources);
  const queue = sources.map((sourceId) => ({ pointId: sourceId, distance: 0 }));

  while (queue.length > 0) {
    const current = queue.shift();
    const point = state.points.find((item) => item.id === current.pointId);

    if (!point) {
      continue;
    }

    for (const neighborId of point.neighborPointIds ?? []) {
      if (visited.has(neighborId)) {
        continue;
      }

      const distance = current.distance + 1;
      if (neighborId === pointId) {
        return distance;
      }

      visited.add(neighborId);
      queue.push({ pointId: neighborId, distance });
    }
  }

  return Infinity;
}

function isPointWithinInfluence(pointId, state) {
  return getNearestSettlementDistance(pointId, state) <= state.influenceLevel;
}

function isPointBuildable(pointId, state) {
  return canAdjust(state)
    && getPointType(state, pointId) === 'empty'
    && isPointWithinInfluence(pointId, state);
}

function getBuildablePoints(state) {
  return state.points.filter((point) => isPointBuildable(point.id, state));
}

function refreshWorkTilesFromSettlements(state) {
  const tileIds = new Set();

  getSettlementSourcePointIds(state).forEach((pointId) => {
    const point = state.points.find((item) => item.id === pointId);
    point?.adjacentTileIds.forEach((tileId) => tileIds.add(tileId));
  });

  state.selectedCoreAdjacentTileIds = Array.from(tileIds).sort((a, b) => a - b);
  const existingByTile = new Map(state.assignedWorkers.map((work) => [work.tileIndex, work]));
  state.assignedWorkers = state.selectedCoreAdjacentTileIds.map((tileId) => {
    const tileIndex = tileId - 1;
    const existing = existingByTile.get(tileIndex);

    if (existing) {
      normalizeWorkJob(state, existing);
      return existing;
    }

    return {
      tileIndex,
      terrain: state.tiles[tileIndex].terrain,
      workers: 0,
      progress: 0,
      jobId: DEFAULT_JOBS[state.tiles[tileIndex].terrain],
    };
  });
}

function prepareGeneration(state, mapData) {
  const extraHouseholds = getLegacyBonus(state, 'extraHouseholds');

  state.currentPage = 'map';
  state.era = 1;
  state.mapType = mapData.mapType;
  state.tiles = mapData.tiles;
  state.points = mapData.points;
  state.coreCandidates = mapData.coreCandidates;
  state.selectedCoreIndex = null;
  state.selectedCorePointId = null;
  state.selectedCoreAdjacentTileIds = [];
  state.selectedTileIndex = null;
  closeAllModals(state);
  state.panelScrollTop = 0;
  state.influenceLevel = 1;
  state.pointBuildings = {};
  state.householdCapacity = 8;
  state.households = Math.min(state.householdCapacity, 4 + extraHouseholds);
  state.idleHouseholds = state.households;
  state.assignedWorkers = [];
  state.resources = {
    food: 12,
    fuel: 8 + getLegacyBonus(state, 'extraFuel'),
    material: 0 + getLegacyBonus(state, 'extraMaterial'),
  };
  state.baseResourceCaps = {
    food: 30,
    fuel: 30,
    material: 30,
  };
  state.resourceCaps = {
    food: 30,
    fuel: 30,
    material: 30,
  };
  state.currentCivilizationDeaths = 0;
  state.highestHouseholdsThisCivilization = state.households;
  state.settlementExpansionCount = 0;
  state.ordinarySettlementCount = 0;
  state.warehouseCount = 0;
  state.techs = createInitialTechState();
  state.eventLog = [];
  state.lastEventText = null;
  state.disasterPlan = null;
  state.scheduledDisaster = null;
  state.isRunning = false;
  state.timeLeft = ERA_SECONDS;
  state.speed = 1;
  state.settlementLines = [];
  state.pendingVictory = false;
  state.pendingLegacyChoice = null;
  state.pendingLegacyChoices = [];
  prepareDisasterPlanForState(state);
  prepareScheduledDisasterForEra(state);
}

function resetRunToStart(state) {
  state.currentPage = 'start';
  state.generation = 1;
  state.era = 1;
  state.mapType = null;
  state.tiles = [];
  state.points = [];
  state.coreCandidates = [];
  state.selectedCoreIndex = null;
  state.selectedCorePointId = null;
  state.selectedCoreAdjacentTileIds = [];
  state.selectedTileIndex = null;
  closeAllModals(state);
  state.panelScrollTop = 0;
  state.influenceLevel = 1;
  state.pointBuildings = {};
  state.householdCapacity = 8;
  state.households = 4;
  state.idleHouseholds = 4;
  state.assignedWorkers = [];
  state.resources = { food: 12, fuel: 8, material: 0 };
  state.baseResourceCaps = { food: 30, fuel: 30, material: 30 };
  state.resourceCaps = { food: 30, fuel: 30, material: 30 };
  state.currentCivilizationDeaths = 0;
  state.totalDeathsAllCivilizations = 0;
  state.highestHouseholdsThisCivilization = 4;
  state.settlementExpansionCount = 0;
  state.ordinarySettlementCount = 0;
  state.warehouseCount = 0;
  state.activeLegacyBonus = null;
  state.activeLegacyBonuses = [];
  state.pendingLegacyChoice = null;
  state.pendingLegacyChoices = [];
  state.techs = createInitialTechState();
  state.eventLog = [];
  state.lastEventText = null;
  state.disasterPlan = null;
  state.scheduledDisaster = null;
  state.isRunning = false;
  state.timeLeft = ERA_SECONDS;
  state.speed = 1;
  state.settlementLines = [];
  state.revealedSettlementLines = 0;
  state.pendingVictory = false;
}

function updateHighestHouseholds(state) {
  state.highestHouseholdsThisCivilization = Math.max(
    state.highestHouseholdsThisCivilization,
    state.households,
  );
}

function renderIslandMap(state, options = {}) {
  const selected = Number.isInteger(state.selectedCoreIndex)
    ? state.coreCandidates[state.selectedCoreIndex]
    : null;
  const highlightedTiles = new Set(
    options.showWorkStatus
      ? []
      : selected?.tileIndexes ?? [],
  );
  const classes = ['map-board', options.size === 'large' ? 'large-map' : 'mini-map'];

  return `
    <div class="${classes.join(' ')}" aria-label="12个六边形地块组成的小岛地图">
      ${state.tiles.map((terrain, index) => renderTile(
        terrain,
        options.size ?? 'mini',
        options.showIndexes ? index + 1 : '',
        highlightedTiles.has(index),
        index,
        options,
        state,
      )).join('')}
      ${options.showCandidates ? renderMapCandidates(state) : ''}
      ${options.showCorePoint ? renderCorePoint(state) : ''}
      ${options.showAllPoints ? renderAllPoints(state) : ''}
    </div>
  `;
}

function renderMapCandidates(state) {
  return state.coreCandidates.map((candidate, index) => `
    <button
      class="map-candidate ${state.selectedCoreIndex === index ? 'is-selected' : ''}"
      style="left: ${candidate.x}%; top: ${candidate.y}%;"
      type="button"
      data-map-candidate="${index}"
      aria-label="候选核心聚落 ${index + 1}"
    >⌂</button>
  `).join('');
}

function renderCorePoint(state) {
  const point = state.points.find((item) => item.id === state.selectedCorePointId);

  if (!point) {
    return '';
  }

  return `<button class="map-point core-point ${state.openPointId === point.id ? 'is-selected' : ''}" style="left: ${point.x}%; top: ${point.y}%;" type="button" data-main-point="${point.id}" aria-label="核心聚落点">⌂</button>`;
}

function renderAllPoints(state) {
  return state.points.filter((point) => point.id !== state.selectedCorePointId).map((point) => {
    const type = getPointType(state, point.id);
    const inInfluence = isPointWithinInfluence(point.id, state);
    const buildable = type === 'empty' && inInfluence;
    const selected = state.openPointId === point.id;

    return `<button class="map-point ${type} ${buildable ? 'buildable' : ''} ${selected ? 'is-selected' : ''} ${!inInfluence && type === 'empty' ? 'out-of-range' : ''}" style="left: ${point.x}%; top: ${point.y}%;" type="button" data-main-point="${point.id}" aria-label="地图点"></button>`;
  }).join('');
}

function renderTile(tile, size, label = '', isHighlighted = false, index = 0, options = {}, state = null) {
  const work = state ? getWorkForTile(state, index) : null;
  const rule = work && state ? getWorkRule(state, work) : null;
  const progressPercent = work && rule
    ? Math.min(100, Math.max(0, (work.progress / rule.progressNeeded) * 100))
    : 0;

  return `
    <div class="hex ${tile.terrain} ${size} ${isHighlighted ? 'is-highlighted' : ''} ${work?.workers > 0 ? 'has-workers' : ''}" style="left: ${tile.x}%; top: ${tile.y}%;">
      ${options.showWorkStatus ? `<span class="tile-progress-ring" data-map-tile-progress="${index}" style="--progress: ${progressPercent}%;"></span>` : ''}
      <span>${label || TERRAIN_LABELS[tile.terrain]}</span>
      ${options.showWorkStatus && work ? `<small data-map-tile-label="${index}" data-map-tile-workers="${index}">${rule.name} ${work.workers}/${WORKERS_PER_TILE_CAP}</small>` : ''}
    </div>
  `;
}

function roundResource(value) {
  return Math.round(value * 10) / 10;
}
