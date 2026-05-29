import {
  ERA_SECONDS,
  MAP_TYPES,
  MAX_ERA,
  RESOURCE_LABELS,
  TERRAIN,
  TERRAIN_LABELS,
  WORK_RULES,
} from './constants.js';
import { countTerrains, generateMap } from './map.js';

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
      renderPlaceholderPage(root, '文明灭亡（占位）', '这一世文明已经熄灭，后续会接入遗产选择。');
      return;
    }

    if (state.currentPage === 'won') {
      renderPlaceholderPage(root, '胜利（占位）', '文明撑过了第十五纪，后续会接入完整胜利结算。');
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
    state.currentPage = 'map';
    state.mapType = mapData.mapType;
    state.tiles = mapData.tiles;
    state.coreCandidates = mapData.coreCandidates;
    state.selectedCoreIndex = null;
    state.assignedWorkers = [];
    render();
  });
}

function renderMapPage(root, state, render) {
  const counts = countTerrains(state.tiles);
  const mapConfig = MAP_TYPES[state.mapType];

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
        <div class="mini-map" aria-label="12个缩略六边形地块">
          ${state.tiles.map((terrain) => renderTile(terrain, 'mini')).join('')}
        </div>
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
        <div class="large-map">
          ${state.tiles.map((terrain, index) => renderTile(terrain, 'large', index + 1)).join('')}
        </div>
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
            <p>相邻地块：${selected.tileIndexes.map((tileIndex) => TERRAIN_LABELS[state.tiles[tileIndex]]).join('、')}</p>
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

  root.querySelector('[data-action="confirm"]').addEventListener('click', () => {
    const candidate = state.coreCandidates[state.selectedCoreIndex];
    state.assignedWorkers = candidate.tileIndexes.map((tileIndex) => ({
      tileIndex,
      terrain: state.tiles[tileIndex],
      workers: 0,
      progress: 0,
    }));
    state.currentPage = 'main';
    render();
  });
}

function renderMainPage(root, state, render, startTimer) {
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
        <div class="work-list">
          ${state.assignedWorkers.map((work, index) => renderWorkCard(work, index, state.isRunning)).join('')}
        </div>
        <div class="controls">
          <button class="primary-action" type="button" data-action="start-era" ${state.isRunning ? 'disabled' : ''}>开始本纪</button>
          <button type="button" data-action="pause">${state.isRunning ? '暂停' : '继续'}</button>
          <button type="button" data-speed="1" class="${state.speed === 1 ? 'is-selected' : ''}">1x</button>
          <button type="button" data-speed="2" class="${state.speed === 2 ? 'is-selected' : ''}">2x</button>
        </div>
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

  root.querySelector('[data-action="start-era"]').addEventListener('click', () => {
    state.isRunning = true;
    state.timeLeft = state.timeLeft > 0 ? state.timeLeft : ERA_SECONDS;
    state.productionThisEra = { food: 0, fuel: 0, material: 0 };
    state.eventLog = [`第${state.era}纪开始。`];
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

function renderWorkCard(work, index, isRunning) {
  const rule = WORK_RULES[work.terrain];
  const seconds = work.workers > 0
    ? (Math.max(0, rule.progressNeeded - work.progress) / work.workers)
    : null;
  const progressPercent = Math.min(100, work.progress);

  return `
    <article class="work-card">
      <h2>${TERRAIN_LABELS[work.terrain]}</h2>
      <p>当前工作：${rule.name}</p>
      <p>产出：${RESOURCE_LABELS[rule.resource]} +${rule.amount}</p>
      <p>已分配户数：${work.workers} / 3</p>
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
    return '<button class="primary-action" type="button" data-action="lost">文明灭亡（占位）</button>';
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
  triggerTimedEvents(state, previousElapsed, currentElapsed);

  if (state.timeLeft <= 0) {
    state.isRunning = false;
    state.timeLeft = 0;
    state.settlementLines = settleEra(state);
    state.currentPage = 'settlement';
  }
}

function produceResources(state, deltaSeconds) {
  state.assignedWorkers.forEach((work) => {
    if (work.workers <= 0) {
      return;
    }

    const rule = WORK_RULES[work.terrain];
    work.progress += work.workers * deltaSeconds;

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
          state.eventLog.push('一户流民加入了文明。');
        } else {
          state.eventLog.push('有流民经过，但无处安置。');
        }
      } else {
        state.eventLog.push(`第${second}秒：远处传来风声，族人更加警醒。`);
      }
    }
  });
}

function settleEra(state) {
  const production = state.productionThisEra || { food: 0, fuel: 0, material: 0 };
  const beforeHouseholds = state.households;
  const foodNeed = 1;
  const fuelNeed = 0.5;
  const foodCanSupport = Math.floor(state.resources.food / foodNeed);
  const fuelCanSupport = Math.floor(state.resources.fuel / fuelNeed);
  const supported = Math.min(state.households, foodCanSupport, fuelCanSupport);
  const consumedFood = supported * foodNeed;
  const consumedFuel = supported * fuelNeed;
  const deaths = state.households - supported;

  state.resources.food = roundResource(Math.max(0, state.resources.food - consumedFood));
  state.resources.fuel = roundResource(Math.max(0, state.resources.fuel - consumedFuel));

  if (deaths > 0) {
    removeDeadHouseholds(state, deaths);
  }

  return [
    `本纪资源产出：食物 +${formatNumber(production.food)}，燃料 +${formatNumber(production.fuel)}，材料 +${formatNumber(production.material)}。`,
    `食物/燃料供养计算：食物可供养 ${foodCanSupport} 户，燃料可供养 ${fuelCanSupport} 户，实际供养 ${supported}/${beforeHouseholds} 户。`,
    `消耗：食物 ${formatNumber(consumedFood)}，燃料 ${formatNumber(consumedFuel)}。`,
    `死亡户数：${deaths} 户。`,
    `本世累计死亡：${state.currentCivilizationDeaths} 户。`,
    `所有世累计死亡：${state.totalDeathsAllCivilizations} 户。`,
    state.households <= 0
      ? '最终判定：文明灭亡。'
      : state.era >= MAX_ERA
        ? '最终判定：文明撑过了第十五纪。'
        : `最终判定：文明存续，可以进入第${state.era + 1}纪。`,
  ];
}

function removeDeadHouseholds(state, deaths) {
  let remaining = Math.min(deaths, state.households);
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

  state.households -= deaths;
  state.currentCivilizationDeaths += deaths;
  state.totalDeathsAllCivilizations += deaths;
  state.idleHouseholds = Math.max(0, state.households - state.assignedWorkers.reduce((sum, work) => sum + work.workers, 0));
}

function assignWorker(state, index) {
  const work = state.assignedWorkers[index];

  if (!work || state.idleHouseholds <= 0 || work.workers >= 3) {
    return;
  }

  work.workers += 1;
  state.idleHouseholds -= 1;
}

function unassignWorker(state, index) {
  const work = state.assignedWorkers[index];

  if (!work || work.workers <= 0) {
    return;
  }

  work.workers -= 1;
  state.idleHouseholds += 1;
}

function renderTile(terrain, size, label = '') {
  return `<div class="hex ${terrain} ${size}">${label || TERRAIN_LABELS[terrain]}</div>`;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function roundResource(value) {
  return Math.round(value * 10) / 10;
}
