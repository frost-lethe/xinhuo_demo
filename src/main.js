import { createInitialState } from './state.js';
import { createGameUI } from './ui.js';

const state = createInitialState();

createGameUI(document.querySelector('#app'), state);
