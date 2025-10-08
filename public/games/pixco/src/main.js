// import { GridRenderer } from './renderer.js';
import { GridRenderer } from './renderer.js';

const canvas = document.getElementById('board');
const colorEl = document.getElementById('color');
const cellSizeEl = document.getElementById('cellSize');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomLabel = document.getElementById('zoomLabel');
const infoEl = document.getElementById('info');
const paletteEl = document.getElementById('palette');

// Palette de base
const DEFAULT_PALETTE = [
  '#000000', '#ffffff', '#e4e4e4', '#888888',
  '#f44336', '#e91e63', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
  '#009688', '#4caf50', '#8bc34a', '#cddc39',
  '#ffeb3b', '#ffc107', '#ff9800', '#ff5722',
  '#795548', '#9e9e9e', '#607d8b'
];

let CONFIG = { w: 1000, h: 1000, cooldownSeconds: 1 };
const BASE_CELL_SIZE = 20; // fixe (utilisateur ne peut pas le changer)
let renderer;
let nextAvailableAt = 0;
let ws;
let currentColor = DEFAULT_PALETTE[0];

// Init
init().catch(console.error);

async function init() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) CONFIG = await res.json();
  } catch {}

  if (cellSizeEl) {
    cellSizeEl.value = String(BASE_CELL_SIZE);
    cellSizeEl.disabled = true;
  }

  buildPalette();

  if (colorEl) {
    colorEl.value = currentColor;
    colorEl.addEventListener('input', () => {
      currentColor = colorEl.value;
      const sel = paletteEl?.querySelector('.swatch.selected');
      if (sel) sel.classList.remove('selected');
    });
  }

  renderer = new GridRenderer(canvas, { gridW: CONFIG.w, gridH: CONFIG.h, cellSize: BASE_CELL_SIZE });
  updateZoomLabel();

  await loadSnapshot();
  connectWS();
  bindUI();
}

// Palette
function buildPalette() {
  if (!paletteEl) return;
  paletteEl.innerHTML = '';
  DEFAULT_PALETTE.forEach((hex, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.style.backgroundColor = hex;
    btn.title = hex;
    btn.addEventListener('click', () => {
      currentColor = hex;
      if (colorEl) colorEl.value = hex;
      paletteEl.querySelectorAll('.swatch.selected').forEach(el => el.classList.remove('selected'));
      btn.classList.add('selected');
    });
    if (i === 0) btn.classList.add('selected');
    paletteEl.appendChild(btn);
  });
}

// Snapshot
async function loadSnapshot() {
  try {
    const res = await fetch('/api/snapshot');
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    renderer.setRasterRGBA(buf);
  } catch {}
}

function bindUI() {
  // Pan (drag simple)
  let dragging = false;
  let last = { x: 0, y: 0 };

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    last = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    renderer.panBy(e.clientX - last.x, e.clientY - last.y);
    last = { x: e.clientX, y: e.clientY };
  });

  // Zoom (molette/trackpad)
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    renderer.zoomAt(e.clientX, e.clientY, factor);
    updateZoomLabel();
  }, { passive: false });

  // Boutons zoom
  zoomInBtn?.addEventListener('click', () => {
    const r = canvas.getBoundingClientRect();
    renderer.zoomAt(r.left + canvas.clientWidth / 2, r.top + canvas.clientHeight / 2, 1.1);
    updateZoomLabel();
  });
  zoomOutBtn?.addEventListener('click', () => {
    const r = canvas.getBoundingClientRect();
    renderer.zoomAt(r.left + canvas.clientWidth / 2, r.top + canvas.clientHeight / 2, 0.9);
    updateZoomLabel();
  });

  // Hover: infos (coord + cooldown)
  canvas.addEventListener('mousemove', (e) => {
    const g = renderer.toGrid(e.clientX, e.clientY);
    const cd = Math.max(0, Math.ceil((nextAvailableAt - Date.now()) / 1000));
    if (!g) {
      infoEl.textContent = `Case: -, Cooldown: ${cd > 0 ? cd + 's' : 'prêt'}`;
      return;
    }
    infoEl.textContent = `Case: (${g.x}, ${g.y}) | Cooldown: ${cd > 0 ? cd + 's' : 'prêt'}`;
  });

  // Double-clic: placer
  canvas.addEventListener('dblclick', async (e) => {
    const g = renderer.toGrid(e.clientX, e.clientY);
    if (!g) return;

    const now = Date.now();
    if (now < nextAvailableAt) {
      const secs = (nextAvailableAt - now) / 1000;
      flashInfo(`Cooldown: ${formatDuration(secs)} restant`);
      // Option: montrer aussi l’info de la case
      await onInspect(e);
      return;
    }

    await placeAtCell(g);
  });

  // Clic droit: inspect
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); onInspect(e); });

  // Clic simple + Shift: inspect
  canvas.addEventListener('click', (e) => {
    if (e.shiftKey) {
      e.preventDefault();
      onInspect(e);
    }
  });
}

// Place une case à la coordonnée donnée (utilisé par le double-clic)
async function placeAtCell(g) {
  const color = currentColor;
  const res = await fetch('/api/place', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ x: g.x, y: g.y, color })
  });

  if (res.status === 429) {
    const data = await res.json();
    const secs = data.retryAfter ?? (CONFIG.cooldownSeconds ?? 300);
    nextAvailableAt = Date.now() + secs * 1000;
    flashInfo(`Cooldown: ${formatDuration(secs)} restant`);
    return;
  }

  if (!res.ok) {
    flashInfo('Erreur');
    return;
  }

  const data = await res.json();
  nextAvailableAt = data.nextAvailableAt ?? (Date.now() + CONFIG.cooldownSeconds * 1000);
}

async function onInspect(e) {
  const g = renderer.toGrid(e.clientX, e.clientY);
  if (!g) return;
  const res = await fetch(`/api/pixel?x=${g.x}&y=${g.y}`);
  if (!res.ok) return;
  const p = await res.json();
  const who = p.userId ?? 'inconnu';
  const when = p.at ? new Date(p.at).toLocaleString() : '—';
  flashInfo(`(${p.x}, ${p.y}) — ${who} @ ${when}`);
}

function flashInfo(msg) {
  if (infoEl) infoEl.textContent = msg;
}

function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);
  ws.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === 'pixel') {
      renderer.setCell(msg.x, msg.y, msg.color, { userId: msg.userId ?? 'inconnu', color: msg.color, at: msg.at });
    }
  };
  ws.onclose = () => setTimeout(connectWS, 1000);
}