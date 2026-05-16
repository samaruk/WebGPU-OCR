// src/main.js – entry point
import { App } from './app.js';

const app = new App();

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await app.init();
  } catch (e) {
    console.error('[main] Fatal init error:', e);
    const hdr = document.getElementById('hdr-status');
    if (hdr) { hdr.textContent = 'Init failed: ' + e.message; hdr.style.color = '#ff3d57'; }
  }
});
