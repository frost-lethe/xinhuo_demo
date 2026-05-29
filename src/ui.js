export function createGameUI(root, state) {
  if (!root) {
    return;
  }

  root.innerHTML = `
    <main class="app-shell">
      <section class="intro" aria-labelledby="game-title">
        <p class="eyebrow">文明生存 roguelite Demo</p>
        <h1 id="game-title">薪火</h1>
        <p class="tagline">一世一文明，传承薪火，撑过第十五纪。</p>
        <button class="primary-action" type="button">开始新局</button>
      </section>

      <section class="notice" aria-labelledby="demo-note-title">
        <h2 id="demo-note-title">早期 Demo</h2>
        <p>当前版本正在修复入口渲染。完整 P0 闭环会在入口稳定后继续推进。</p>
      </section>
    </main>
  `;

  const startButton = root.querySelector('.primary-action');
  startButton.addEventListener('click', () => {
    startButton.textContent = `第 ${state.generation} 世文明准备中`;
  });
}
