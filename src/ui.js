import { MAP_TYPES, MAX_ERA, TERRAIN_LABELS } from './constants.js';
import { countTerrains, generateMap } from './map.js';

export function createGameUI(root, state) {
  if (!root) {
    return;
  }

  const render = () => {
    if (state.currentPage === 'map') {
      renderMapPage(root, state, render);
      return;
    }

    if (state.currentPage === 'core') {
      renderCorePage(root, state, render);
      return;
    }

    if (state.currentPage === 'main') {
      renderMainPage(root, state);
      return;
    }

    renderStartPage(root, state, render);
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

function renderMainPage(root, state) {
  root.innerHTML = `
    <main class="app-shell">
      <section class="panel">
        <p class="eyebrow">原始聚落</p>
        <h1>第${state.generation}世 · 第${state.era}纪 / ${MAX_ERA}</h1>
        <div class="stat-grid">
          <div>户 ${state.households}/${state.householdCapacity}</div>
          <div>食物 ${state.resources.food}/${state.resourceCaps.food}</div>
          <div>燃料 ${state.resources.fuel}/${state.resourceCaps.fuel}</div>
          <div>材料 ${state.resources.material}/${state.resourceCaps.material}</div>
        </div>
        <button class="primary-action" type="button">开始本纪</button>
      </section>
    </main>
  `;
}

function renderTile(terrain, size, label = '') {
  return `<div class="hex ${terrain} ${size}">${label || TERRAIN_LABELS[terrain]}</div>`;
}
