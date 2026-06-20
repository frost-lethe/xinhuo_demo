export const SAVE_KEY = 'xinhuo_save_v1';
export const SAVE_VERSION = 1;

export function sanitizeStateForSave(state) {
  const sanitized = JSON.parse(JSON.stringify(state));

  sanitized.isRunning = false;
  sanitized.speed = 1;
  sanitized.openPanel = null;
  sanitized.openPointId = null;
  sanitized.panelScrollTop = 0;
  sanitized.settingsOpen = false;
  sanitized.tutorialOpen = false;
  sanitized.debugConsoleOpen = false;

  if ('selectedPointId' in sanitized) {
    sanitized.selectedPointId = null;
  }
  if ('activePointId' in sanitized) {
    sanitized.activePointId = null;
  }
  if ('activeModal' in sanitized) {
    sanitized.activeModal = null;
  }
  if ('openModal' in sanitized) {
    sanitized.openModal = null;
  }

  return sanitized;
}

export function saveGame(state) {
  try {
    const record = {
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      state: sanitizeStateForSave(state),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(record));
    return { ok: true, savedAt: record.savedAt };
  } catch (error) {
    return { ok: false, error: '保存进度失败。', cause: error };
  }
}

export function loadGame() {
  const result = readSaveRecord();

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    savedAt: result.record.savedAt,
    state: result.record.state,
  };
}

export function hasSavedGame() {
  return readSaveRecord().ok;
}

export function getSaveMeta() {
  const result = readSaveRecord();

  if (!result.ok) {
    return null;
  }

  return {
    savedAt: result.record.savedAt,
    generation: result.record.state.generation,
    era: result.record.state.era,
    currentPage: result.record.state.currentPage,
  };
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

function readSaveRecord() {
  let raw;

  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch (error) {
    return { ok: false, error: '无法访问本地保存进度。', cause: error };
  }

  if (!raw) {
    return { ok: false, error: '暂无保存进度。' };
  }

  try {
    const record = JSON.parse(raw);

    if (record?.version !== SAVE_VERSION) {
      return { ok: false, error: '存档版本不兼容。' };
    }

    if (!record.state
      || typeof record.state !== 'object'
      || typeof record.state.currentPage !== 'string'
      || !Number.isFinite(record.state.generation)
      || !Number.isFinite(record.state.era)) {
      clearSave();
      return { ok: false, error: '保存进度已损坏。' };
    }

    return { ok: true, record };
  } catch (error) {
    clearSave();
    return { ok: false, error: '保存进度已损坏，已清除。', cause: error };
  }
}
