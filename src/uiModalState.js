export function closePointModal(state) {
  state.openPointId = null;
  if ('selectedPointId' in state) {
    state.selectedPointId = null;
  }
  if ('activePointId' in state) {
    state.activePointId = null;
  }
  if (state.openModal === 'point') {
    state.openModal = null;
  }
}

export function closePanelModal(state) {
  state.openPanel = null;
  if (state.openModal === 'panel') {
    state.openModal = null;
  }
}

export function closeAllModals(state) {
  closePointModal(state);
  closePanelModal(state);
  if ('activeModal' in state) {
    state.activeModal = null;
  }
  if ('openModal' in state) {
    state.openModal = null;
  }
}
