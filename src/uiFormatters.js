import { ERA_SECONDS } from './constants.js';

export function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function getTimerText(state) {
  return state.isRunning
    ? `${String(Math.ceil(state.timeLeft)).padStart(2, '0')}s`
    : state.timeLeft < ERA_SECONDS
      ? `${String(Math.ceil(state.timeLeft)).padStart(2, '0')}s`
      : '准备阶段';
}
