import {
  ERA_SECONDS,
  MAP_TYPES,
  MAX_ERA,
  RESOURCE_LABELS,
  TERRAIN,
  TERRAIN_LABELS,
  WORK_RULES,
} from './constants.js';
import {
  DISASTER_DESCRIPTIONS,
  getDisasterAtmosphere,
  getEraDisasterEffects,
  getBuildingCount,
  getMapDisasterProfile,
  getWorkEfficiencyMultiplier,
} from './disasters.js';
import { getLegacyBonus, LEGACY_OPTIONS } from './legacy.js';
import { countTerrains, generateMap } from './map.js';
import {
  createInitialTechState,
  getResearchedTechNames,
  isTechUnlocked,
  TECH_DEFINITIONS,
} from './tech.js';

export function createGameUI(root, state) {
  if (!root) {
    return;
  }

  let timerId = null;
  let lastTickAt = 0;

  const stopTimer = () => {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  };

  const render = () => {
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
      renderMainPage(root, state, render, startTimer);
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
        advanceEra(state, deltaSeconds);
        if (state.currentPage === 'settlement') {
          stopTimer();
        }
        render();
      }
    }, 250);
  };

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
  const mapConfig = MAP_TYPES[state.mapType];
  const disasterProfile = getMapDisasterProfile(state.mapType);

  root.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <p class="eyebrow">第${state.generation}世</p>
        <h1>地图类型：${state.mapType}</h1>
        <div class="stat-grid">
          <div>草原 ${counts.grassland}</div>
          <div>森林 ${counts.forest}</div>
          <div>山地 ${counts.mountain}</div>
          <div>${mapConfig.earlyDisaster}</div>
          <div>${mapConfig.midDisaster}</div>
        </div>
        <div class="disaster-overview">
          <h2>灾害介绍</h2>
          <p>第4-5纪灾害：${disasterProfile.early}。${DISASTER_DESCRIPTIONS[disasterProfile.early]}</p>
          <p>第8-10纪灾害：${disasterProfile.mid}。${DISASTER_DESCRIPTIONS[disasterProfile.mid]}</p>
          <p>第12-15纪：终末失序。${DISASTER_DESCRIPTIONS.终末失序}</p>
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
    state.assignedWorkers = candidate.tileIndexes.map((tileIndex) => ({
      tileIndex,
      terrain: state.tiles[tileIndex].terrain,
      workers: 0,
      progress: 0,
    }));
    state.currentPage = 'main';
    render();
  });
}

function renderMainPage(root, state, render, startTimer) {
  const disasterEffects = getEraDisasterEffects(state.mapType, state.era, state);

  root.innerHTML = `
    <main class="app-shell game-layout">
      <section class="panel">
        <p class="eyebrow">原始聚落</p>
        <h1>第${state.generation}世 · 第${state.era}纪 / ${MAX_ERA}</h1>
        <div class="stat-grid">
          <div>户 ${state.households}/${state.householdCapacity}</div>
          <div>空闲户 ${state.idleHouseholds}</div>
          <div>食物 ${formatNumber(state.resources.food)}/${state.resourceCaps.food}</div>
          <div>燃料 ${formatNumber(state.resources.fuel)}/${state.resourceCaps.fuel}</div>
          <div>材料 ${formatNumber(state.resources.material)}/${state.resourceCaps.material}</div>
          <div>倒计时 ${formatNumber(state.timeLeft)}秒</div>
        </div>
        <div class="disaster-current">
          <strong>${disasterEffects.warning}</strong>
        </div>
        <div class="work-list">
          ${state.assignedWorkers.map((work, index) => renderWorkCard(state, work, index, state.isRunning, disasterEffects)).join('')}
        </div>
        ${renderSettlementDevelopmentPanel(state)}
        <div class="controls">
          <button class="primary-action" type="button" data-action="start-era" ${state.isRunning || state.timeLeft < ERA_SECONDS ? 'disabled' : ''}>开始本纪</button>
          <button type="button" data-action="pause">${state.isRunning ? '暂停' : '继续'}</button>
          <button type="button" data-speed="1" class="${state.speed === 1 ? 'is-selected' : ''}">1x</button>
          <button type="button" data-speed="2" class="${state.speed === 2 ? 'is-selected' : ''}">2x</button>
          <button type="button" data-speed="5" class="${state.speed === 5 ? 'is-selected' : ''}">5x</button>
        </div>
        ${renderTechPanel(state)}
      </section>
      <aside class="panel event-panel">
        <h2>事件 / 预警</h2>
        ${state.eventLog.length > 0 ? `<ul>${state.eventLog.map((event) => `<li>${event}</li>`).join('')}</ul>` : '<p>本纪尚未开始。</p>'}
      </aside>
    </main>
  `;

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

  root.querySelector('[data-action="expand-settlement"]')?.addEventListener('click', () => {
    expandSettlement(state);
    render();
  });

  root.querySelector('[data-action="build-warehouse"]')?.addEventListener('click', () => {
    buildWarehouse(state);
    render();
  });

  root.querySelector('[data-action="start-era"]').addEventListener('click', () => {
    state.isRunning = true;
    state.timeLeft = state.timeLeft > 0 ? state.timeLeft : ERA_SECONDS;
    state.productionThisEra = { food: 0, fuel: 0, material: 0 };
    state.eventLog = [`第${state.era}纪开始。`, disasterEffects.warning];
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
}

function renderSettlementPage(root, state, render) {
  root.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <p class="eyebrow">第${state.era}纪结算</p>
        <h1>本纪结算</h1>
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
      state.era += 1;
      state.currentPage = 'main';
      state.eventLog = [];
      state.timeLeft = ERA_SECONDS;
      state.isRunning = false;
      render();
    });
  }

  const lostButton = root.querySelector('[data-action="lost"]');
  if (lostButton) {
    lostButton.addEventListener('click', () => {
      state.currentPage = 'lost';
      render();
    });
  }

  const wonButton = root.querySelector('[data-action="won"]');
  if (wonButton) {
    wonButton.addEventListener('click', () => {
      state.currentPage = 'won';
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
          <div>扩建聚落次数 ${state.settlementExpansionCount}</div>
          <div>仓库数量 ${state.warehouseCount}</div>
          <div>可留下文明遗产 1 点</div>
        </div>
        <button class="primary-action" type="button" data-action="choose-legacy">选择文明遗产</button>
      </section>
    </main>
  `;

  root.querySelector('[data-action="choose-legacy"]').addEventListener('click', () => {
    state.pendingLegacyChoice = null;
    state.currentPage = 'legacy';
    render();
  });
}

function renderLegacyPage(root, state, render) {
  const selected = LEGACY_OPTIONS.find((option) => option.id === state.pendingLegacyChoice);

  root.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <p class="eyebrow">文明遗产</p>
        <h1>选择传给下一世的薪火</h1>
        <p>当前可用遗产点：1</p>
        <div class="legacy-options">
          ${LEGACY_OPTIONS.map((option) => `
            <button class="legacy-option ${state.pendingLegacyChoice === option.id ? 'is-selected' : ''}" type="button" data-legacy="${option.id}">
              <strong>${option.name}</strong>
              <span>${option.description}</span>
            </button>
          `).join('')}
        </div>
        <div class="notice">
          ${selected ? `<p>${selected.description}</p>` : '<p>请选择一个遗产选项。</p>'}
        </div>
        <button class="primary-action" type="button" data-action="confirm-legacy" ${selected ? '' : 'disabled'}>确认遗产，开始下一世</button>
      </section>
    </main>
  `;

  root.querySelectorAll('[data-legacy]').forEach((button) => {
    button.addEventListener('click', () => {
      state.pendingLegacyChoice = button.dataset.legacy;
      render();
    });
  });

  root.querySelector('[data-action="confirm-legacy"]').addEventListener('click', () => {
    const choice = LEGACY_OPTIONS.find((option) => option.id === state.pendingLegacyChoice);
    state.activeLegacyBonus = choice;
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
          <div>扩建聚落次数：${state.settlementExpansionCount}</div>
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

function renderTechPanel(state) {
  return `
    <section class="tech-panel">
      <h2>技术研究</h2>
      <div class="tech-list">
        ${Object.entries(TECH_DEFINITIONS).map(([techId, definition]) => renderTechCard(state, techId, definition)).join('')}
      </div>
    </section>
  `;
}

function renderSettlementDevelopmentPanel(state) {
  const canAct = !state.isRunning;
  const warehouseReduction = state.warehouseCount * 5;
  const growText = state.households >= state.householdCapacity
    ? '容量已满，需要扩建聚落。'
    : state.resources.food < 4
      ? '食物不足。'
      : `增户：消耗食物4，当前户数 ${state.households} / 容量 ${state.householdCapacity}。`;

  return `
    <section class="development-panel">
      <h2>聚落发展</h2>
      <div class="stat-grid">
        <div>核心聚落 1</div>
        <div>扩建次数 ${state.settlementExpansionCount}</div>
        <div>仓库数量 ${state.warehouseCount}</div>
        <div>建筑数 ${getBuildingCount(state)}</div>
        <div>户容量 ${state.householdCapacity}</div>
        <div>资源上限 食物${state.resourceCaps.food} / 燃料${state.resourceCaps.fuel} / 材料${state.resourceCaps.material}</div>
        <div>库存灾害减免 ${warehouseReduction}%</div>
      </div>
      <p>${growText}</p>
      <div class="controls">
        <button type="button" data-action="grow-household" ${!canAct || state.households >= state.householdCapacity || state.resources.food < 4 ? 'disabled' : ''}>增户</button>
        <button type="button" data-action="expand-settlement" ${!canAct || !canAfford(state, { food: 5, fuel: 5, material: 10 }) ? 'disabled' : ''}>扩建聚落</button>
        <button type="button" data-action="build-warehouse" ${!canAct || !canAfford(state, { food: 3, fuel: 5, material: 12 }) ? 'disabled' : ''}>建造仓库</button>
      </div>
    </section>
  `;
}

function renderTechCard(state, techId, definition) {
  const tech = state.techs[techId];
  const canEdit = !state.isRunning && !tech.unlocked;

  return `
    <article class="tech-card">
      <h3>${definition.name}</h3>
      <p>${definition.description}</p>
      <p>研究进度：${formatNumber(tech.progress)} / ${definition.requirement}</p>
      <p>研究户数：${tech.workers} / 3</p>
      <div class="worker-buttons">
        <button type="button" data-tech-unassign="${techId}" ${!canEdit || tech.workers <= 0 ? 'disabled' : ''}>-</button>
        <button type="button" data-tech-assign="${techId}" ${!canEdit || tech.workers >= 3 || state.idleHouseholds <= 0 ? 'disabled' : ''}>+</button>
      </div>
      ${tech.unlocked ? '<p class="safe-site-note">已解锁</p>' : ''}
    </article>
  `;
}

function renderWorkCard(state, work, index, isRunning, disasterEffects) {
  const rule = getWorkRule(state, work.terrain);
  const efficiency = getWorkEfficiencyMultiplier(disasterEffects, work.terrain);
  const seconds = work.workers > 0
    ? (Math.max(0, rule.progressNeeded - work.progress) / (work.workers * efficiency))
    : null;
  const progressPercent = Math.min(100, (work.progress / rule.progressNeeded) * 100);

  return `
    <article class="work-card">
      <h2>${TERRAIN_LABELS[work.terrain]}</h2>
      <p>当前工作：${rule.name}</p>
      <p>产出：${RESOURCE_LABELS[rule.resource]} +${rule.amount}</p>
      <p>已分配户数：${work.workers} / 3</p>
      <p>效率：${formatNumber(efficiency * 100)}%</p>
      <p>${RESOURCE_LABELS[rule.resource]} +${rule.amount} / ${seconds ? `${formatNumber(seconds)}秒` : '未分配'}</p>
      <div class="progress-bar"><span style="width: ${progressPercent}%"></span></div>
      <div class="worker-buttons">
        <button type="button" data-unassign="${index}" ${work.workers <= 0 || isRunning ? 'disabled' : ''}>-</button>
        <button type="button" data-assign="${index}" ${work.workers >= 3 || isRunning ? 'disabled' : ''}>+</button>
      </div>
    </article>
  `;
}

function renderSettlementAction(state) {
  if (state.households <= 0) {
    return '<button class="primary-action" type="button" data-action="lost">查看文明灭亡</button>';
  }

  if (state.era >= MAX_ERA) {
    return '<button class="primary-action" type="button" data-action="won">胜利（占位）</button>';
  }

  return '<button class="primary-action" type="button" data-action="next-era">进入下一纪准备</button>';
}

function advanceEra(state, deltaSeconds) {
  const adjustedDelta = deltaSeconds * state.speed;
  const previousElapsed = ERA_SECONDS - state.timeLeft;
  state.timeLeft = Math.max(0, state.timeLeft - adjustedDelta);
  const currentElapsed = ERA_SECONDS - state.timeLeft;

  produceResources(state, adjustedDelta);
  advanceResearch(state, adjustedDelta);
  triggerTimedEvents(state, previousElapsed, currentElapsed);

  if (state.timeLeft <= 0) {
    state.isRunning = false;
    state.timeLeft = 0;
    state.settlementLines = settleEra(state);
    state.currentPage = state.households > 0 && state.era >= MAX_ERA ? 'won' : 'settlement';
  }
}

function produceResources(state, deltaSeconds) {
  const disasterEffects = getEraDisasterEffects(state.mapType, state.era, state);

  state.assignedWorkers.forEach((work) => {
    if (work.workers <= 0) {
      return;
    }

    const rule = getWorkRule(state, work.terrain);
    work.progress += work.workers * deltaSeconds * getWorkEfficiencyMultiplier(disasterEffects, work.terrain);

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
  [20, 40].forEach((second) => {
    if (previousElapsed < second && currentElapsed >= second) {
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
        state.eventLog.push(`第${second}秒：${getDisasterAtmosphere(state.mapType, state.era)}`);
      }
    }
  });
}

function settleEra(state) {
  const disasterEffects = getEraDisasterEffects(state.mapType, state.era, state);
  const production = state.productionThisEra || { food: 0, fuel: 0, material: 0 };
  const beforeHouseholds = state.households;
  const foodNeed = 1;
  const fuelNeed = 0.5 * disasterEffects.fuelMultiplier + disasterEffects.extraFuelPerHousehold;
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
    ...createEfficiencySettlementLines(disasterEffects),
    ...inventoryLossLines,
    ...createFuelSettlementLines(disasterEffects),
    `食物/燃料供养计算：食物可供养 ${foodCanSupport} 户，燃料可供养 ${fuelCanSupport} 户，实际供养 ${supported}/${beforeHouseholds} 户。`,
    `消耗：食物 ${formatNumber(consumedFood)}，燃料 ${formatNumber(consumedFuel)}。`,
    materialResult.line,
    `死亡户数：${actualSupplyDeaths + materialResult.deaths} 户。`,
    `本世累计死亡：${state.currentCivilizationDeaths} 户。`,
    `所有世累计死亡：${state.totalDeathsAllCivilizations} 户。`,
    state.households <= 0
      ? '最终判定：文明灭亡。'
      : state.era >= MAX_ERA
        ? '最终判定：文明撑过了第十五纪。'
        : `最终判定：文明存续，可以进入第${state.era + 1}纪。`,
  ];
}

function applyInventoryLosses(state, disasterEffects) {
  const lines = [];
  const warehouseReduction = state.warehouseCount * 0.05;

  Object.entries(disasterEffects.inventoryLoss).forEach(([resource, rate]) => {
    if (rate <= 0) {
      return;
    }

    const effectiveRate = Math.max(0, rate - warehouseReduction);
    const before = state.resources[resource];
    const lost = Math.ceil(before * effectiveRate);
    const names = disasterEffects.inventoryNotes
      .filter((note) => note.resource === resource)
      .map((note) => note.name);
    const source = names.length > 0 ? `${[...new Set(names)].join('、')}造成` : '';
    state.resources[resource] = Math.max(0, before - lost);
    lines.push(`灾害库存损失：${source}${RESOURCE_LABELS[resource]}库存损失${formatNumber(rate * 100)}%。`);
    if (state.warehouseCount > 0) {
      lines.push(`仓库减免：仓库${state.warehouseCount}座，库存损失 -${formatNumber(warehouseReduction * 100)}%。`);
    }
    lines.push(lost > 0
      ? `实际${RESOURCE_LABELS[resource]}损失：${lost}。`
      : '仓库完全抵消了这项库存损失。');
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

function createFuelSettlementLines(disasterEffects) {
  const lines = [];

  if (disasterEffects.fuelMultiplier > 1) {
    lines.push(`灾害额外需求：基础燃料消耗 +${formatNumber((disasterEffects.fuelMultiplier - 1) * 100)}%。`);
  }

  if (disasterEffects.extraFuelPerHousehold > 0) {
    lines.push(`灾害额外需求：每户燃料需求 +${formatNumber(disasterEffects.extraFuelPerHousehold)}。`);
  }

  disasterEffects.techNotes.forEach((note) => {
    lines.push(note);
  });

  return lines.length > 0 ? lines : ['本纪无额外燃料需求。'];
}

function applyMaterialDemand(state, disasterEffects) {
  const demand = disasterEffects.materialDemand;

  if (demand <= 0) {
    return {
      deaths: 0,
      line: '本纪无额外材料需求。',
    };
  }

  const shortage = Math.max(0, demand - state.resources.material);

  if (shortage <= 0) {
    state.resources.material = roundResource(state.resources.material - demand);
    return {
      deaths: 0,
      line: `灾害材料需求：需要材料 ${demand}，材料充足。`,
    };
  }

  const deaths = Math.ceil(shortage);
  state.resources.material = 0;
  const actualDeaths = removeDeadHouseholds(state, deaths);

  return {
    deaths: actualDeaths,
    line: `灾害材料需求：需要材料 ${demand}，缺口 ${formatNumber(shortage)}，死亡 ${actualDeaths} 户。`,
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

  if (!canAdjust(state) || !work || state.idleHouseholds <= 0 || work.workers >= 3) {
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

function assignResearchWorker(state, techId) {
  const tech = state.techs[techId];

  if (!canAdjust(state) || !tech || tech.unlocked || state.idleHouseholds <= 0 || tech.workers >= 3) {
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
  if (!canAdjust(state) || state.households >= state.householdCapacity || state.resources.food < 4) {
    return;
  }

  state.resources.food -= 4;
  state.households += 1;
  state.idleHouseholds += 1;
  updateHighestHouseholds(state);
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
  state.resourceCaps.food += 10;
  state.resourceCaps.fuel += 10;
  state.resourceCaps.material += 10;
}

function buildWarehouse(state) {
  const cost = { food: 3, fuel: 5, material: 12 };

  if (!canAdjust(state) || !canAfford(state, cost)) {
    return;
  }

  if (!window.confirm('建造仓库将消耗 食物3、燃料5、材料12。效果：三资源上限+20，并减少灾害库存损失5%。是否确认？')) {
    return;
  }

  payCost(state, cost);
  state.warehouseCount += 1;
  state.resourceCaps.food += 20;
  state.resourceCaps.fuel += 20;
  state.resourceCaps.material += 20;
}

function canAfford(state, cost) {
  return Object.entries(cost).every(([resource, amount]) => state.resources[resource] >= amount);
}

function payCost(state, cost) {
  Object.entries(cost).forEach(([resource, amount]) => {
    state.resources[resource] = Math.max(0, state.resources[resource] - amount);
  });
}

function canAdjust(state) {
  return !state.isRunning;
}

function advanceResearch(state, deltaSeconds) {
  Object.entries(state.techs).forEach(([techId, tech]) => {
    if (tech.unlocked || tech.workers <= 0) {
      return;
    }

    const definition = TECH_DEFINITIONS[techId];
    tech.progress = Math.min(definition.requirement, tech.progress + tech.workers * deltaSeconds);

    if (tech.progress >= definition.requirement) {
      tech.unlocked = true;
      state.idleHouseholds += tech.workers;
      tech.workers = 0;
      state.eventLog.push(`${definition.name}研究完成。`);
    }
  });
}

function getWorkRule(state, terrain) {
  const baseRule = WORK_RULES[terrain];

  if (terrain === TERRAIN.FOREST && isTechUnlocked(state, 'ember')) {
    return {
      ...baseRule,
      name: '烧炭',
      amount: 5,
    };
  }

  if (terrain === TERRAIN.MOUNTAIN && isTechUnlocked(state, 'stone')) {
    return {
      ...baseRule,
      amount: baseRule.amount + 1,
    };
  }

  return baseRule;
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
  state.householdCapacity = 8;
  state.households = Math.min(state.householdCapacity, 4 + extraHouseholds);
  state.idleHouseholds = state.households;
  state.assignedWorkers = [];
  state.resources = {
    food: 12,
    fuel: 8 + getLegacyBonus(state, 'extraFuel'),
    material: 0 + getLegacyBonus(state, 'extraMaterial'),
  };
  state.resourceCaps = {
    food: 30,
    fuel: 30,
    material: 30,
  };
  state.currentCivilizationDeaths = 0;
  state.highestHouseholdsThisCivilization = state.households;
  state.settlementExpansionCount = 0;
  state.warehouseCount = 0;
  state.techs = createInitialTechState();
  state.eventLog = [];
  state.isRunning = false;
  state.timeLeft = ERA_SECONDS;
  state.speed = 1;
  state.settlementLines = [];
  state.pendingLegacyChoice = null;
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
  state.householdCapacity = 8;
  state.households = 4;
  state.idleHouseholds = 4;
  state.assignedWorkers = [];
  state.resources = { food: 12, fuel: 8, material: 0 };
  state.resourceCaps = { food: 30, fuel: 30, material: 30 };
  state.currentCivilizationDeaths = 0;
  state.totalDeathsAllCivilizations = 0;
  state.highestHouseholdsThisCivilization = 4;
  state.settlementExpansionCount = 0;
  state.warehouseCount = 0;
  state.activeLegacyBonus = null;
  state.pendingLegacyChoice = null;
  state.techs = createInitialTechState();
  state.eventLog = [];
  state.isRunning = false;
  state.timeLeft = ERA_SECONDS;
  state.speed = 1;
  state.settlementLines = [];
  state.revealedSettlementLines = 0;
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
  const highlightedTiles = new Set(selected?.tileIndexes ?? []);
  const classes = ['map-board', options.size === 'large' ? 'large-map' : 'mini-map'];

  return `
    <div class="${classes.join(' ')}" aria-label="12个六边形地块组成的小岛地图">
      ${state.tiles.map((terrain, index) => renderTile(
        terrain,
        options.size ?? 'mini',
        options.showIndexes ? index + 1 : '',
        highlightedTiles.has(index),
      )).join('')}
      ${options.showCandidates ? renderMapCandidates(state) : ''}
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

function renderTile(tile, size, label = '', isHighlighted = false) {
  return `<div class="hex ${tile.terrain} ${size} ${isHighlighted ? 'is-highlighted' : ''}" style="left: ${tile.x}%; top: ${tile.y}%;">${label || TERRAIN_LABELS[tile.terrain]}</div>`;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function roundResource(value) {
  return Math.round(value * 10) / 10;
}
