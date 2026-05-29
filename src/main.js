import { createInitialState } from './state.js';
import { renderApp } from './ui.js';

const state = createInitialState();

renderApp(state);
