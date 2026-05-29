export function renderApp(state) {
  const startButton = document.querySelector('.primary-action');

  if (!startButton) {
    return;
  }

  startButton.addEventListener('click', () => {
    startButton.textContent = `第 ${state.generation} 世文明尚未启程`;
  });
}
