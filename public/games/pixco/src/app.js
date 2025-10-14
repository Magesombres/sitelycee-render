import { GridRenderer } from './renderer.js';

const canvas = document.getElementById('board');
const colorEl = document.getElementById('color');
const cellSizeEl = document.getElementById('cellSize');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomLabel = document.getElementById('zoomLabel');
const infoEl = document.getElementById('info');
const paletteEl = document.getElementById('palette');

const DEFAULT_PALETTE = [
  '#000000', '#ffffff', '#e4e4e4', '#888888',
  '#f44336', '#e91e63', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
  '#009688', '#4caf50', '#8bc34a', '#cddc39',
  '#ffeb3b', '#ffc107', '#ff9800', '#ff5722',
  '#795548', '#9e9e9e', '#607d8b'
];

let CONFIG = { w: 1000, h: 1000, cooldownSeconds: 300 };
const BASE_CELL_SIZE = 20;
let renderer;
let nextAvailableAt = 0;
let ws;
let currentColor = DEFAULT_PALETTE[0];

// Ajout: cache méta hover + debounce
const metaCache = new Map(); // key "x,y" -> { userId, at }
const HOVER_DEBOUNCE_MS = 100;
let hoverTimer = null;
let lastHoverKey = '';
let lastShownKey = '';
let lastRequestedKey = '';

init().catch(console.error);

async function init() {
  try {
    const res = await fetch('/pixco/config');
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

async function loadSnapshot() {
  try {
    const res = await fetch('/pixco/snapshot');
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    renderer.setRasterRGBA(buf);
  } catch {}
}

function bindUI() {
  // Pan
  let dragging = false;
  let last = { x: 0, y: 0 };
  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    last = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    renderer.panBy(e.clientX - last.x, e.clientY - last.y);
    last = { x: e.clientX, y: e.clientY };
  });

  // Zoom molette
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

  // Hover: coordonnées + auteur/date (sans clic)
  canvas.addEventListener('mousemove', (e) => {
    const g = renderer.toGrid(e.clientX, e.clientY);
    const cd = Math.max(0, Math.ceil((nextAvailableAt - Date.now()) / 1000));
    if (!g) {
      infoEl.textContent = `Case: -, Cooldown: ${cd > 0 ? cd + 's' : 'prêt'}`;
      return;
    }
    // Affichage immédiat depuis cache ou méta connue via WS
    showHoverInfo(g, cd);

    // Déclenche une requête (debounce) si méta manquante
    scheduleHoverFetch(g);
  });

  // Double-clic: poser
  canvas.addEventListener('dblclick', async (e) => {
    const g = renderer.toGrid(e.clientX, e.clientY);
    if (!g) return;

    const now = Date.now();
    if (now < nextAvailableAt) {
      const secs = (nextAvailableAt - now) / 1000;
      flashInfo(`Cooldown: ${formatDuration(secs)} restant`);
      return;
    }
    await placeAtCell(g);
  });

  // Clic droit/Shift+clic (optionnel): inspect manuel
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); onInspect(e); });
  canvas.addEventListener('click', (e) => { if (e.shiftKey) { e.preventDefault(); onInspect(e); } });
}

function showHoverInfo(g, cdSeconds) {
  const key = `${g.x},${g.y}`;
  if (lastShownKey === key) return;

  // 1) essayer depuis renderer (mis à jour par WS)
  const m1 = renderer.getCellMeta(g.x, g.y);
  if (m1) {
    const who = m1.userId ?? 'inconnu';
    const when = m1.at ? new Date(m1.at).toLocaleTimeString() : '—';
    infoEl.textContent = `Case: (${g.x}, ${g.y}) — ${who} @ ${when} | Cooldown: ${cdSeconds > 0 ? cdSeconds + 's' : 'prêt'}`;
    lastShownKey = key;
    return;
  }

  // 2) essayer depuis le cache
  const m2 = metaCache.get(key);
  if (m2) {
    const who = m2.userId ?? 'inconnu';
    const when = m2.at ? new Date(m2.at).toLocaleTimeString() : '—';
    infoEl.textContent = `Case: (${g.x}, ${g.y}) — ${who} @ ${when} | Cooldown: ${cdSeconds > 0 ? cdSeconds + 's' : 'prêt'}`;
    lastShownKey = key;
    return;
  }

  // 3) pas de méta: afficher coord + cooldown
  infoEl.textContent = `Case: (${g.x}, ${g.y}) | Cooldown: ${cdSeconds > 0 ? cdSeconds + 's' : 'prêt'}`;
  lastShownKey = key;
}

function scheduleHoverFetch(g) {
  const key = `${g.x},${g.y}`;
  if (lastHoverKey === key) return; // déjà programmé pour cette case
  lastHoverKey = key;

  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    // éviter les doublons réseau
    if (lastRequestedKey === key) return;
    lastRequestedKey = key;
    fetchPixelMeta(g.x, g.y).finally(() => {
      // libérer la clé de requête pour permettre les futures cases
      if (lastRequestedKey === key) lastRequestedKey = '';
    });
  }, HOVER_DEBOUNCE_MS);
}

async function fetchPixelMeta(x, y) {
  const key = `${x},${y}`;
  // déjà en cache
  if (metaCache.has(key)) return metaCache.get(key);
  try {
    const res = await fetch(`/pixco/pixel?x=${x}&y=${y}`);
    if (!res.ok) return null;
    const p = await res.json();
    const m = { userId: p.userId ?? null, at: p.at ?? null };
    metaCache.set(key, m);
    // rafraîchir la ligne d’info uniquement si on survole toujours cette case
    if (lastShownKey === key) {
      const cd = Math.max(0, Math.ceil((nextAvailableAt - Date.now()) / 1000));
      const who = m.userId ?? 'inconnu';
      const when = m.at ? new Date(m.at).toLocaleTimeString() : '—';
      infoEl.textContent = `Case: (${x}, ${y}) — ${who} @ ${when} | Cooldown: ${cd > 0 ? cd + 's' : 'prêt'}`;
    }
    return m;
  } catch {
    return null;
  }
}

function updateZoomLabel() {
  zoomLabel.textContent = `×${renderer.zoom.toFixed(2)} (case=${renderer.baseCellSize}px)`;
}

function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

async function placeAtCell(g) {
  const color = currentColor;
  const token = localStorage.getItem('token');
  
  const res = await fetch('/pixco/place', {
    method: 'POST',
    headers: { 
      'content-type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
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
  await fetchPixelMeta(g.x, g.y);
}

function flashInfo(msg) {
  if (infoEl) infoEl.textContent = msg;
}

function connectWS() {
  // Utiliser Socket.IO au lieu de WebSocket natif
  const script = document.createElement('script');
  script.src = '/socket.io/socket.io.js';
  script.onload = () => {
    // eslint-disable-next-line no-undef
    const socket = io('/pixco');
    
    socket.on('pixel', (msg) => {
      // mettre à jour rendu + cache méta
      renderer.setCell(msg.x, msg.y, msg.color, { userId: msg.username ?? 'inconnu', color: msg.color, at: msg.at });
      metaCache.set(`${msg.x},${msg.y}`, { userId: msg.username ?? 'inconnu', at: msg.at });
    });

    socket.on('disconnect', () => {
      console.log('[Pixco] Socket disconnected, reconnecting...');
    });
  };
  document.head.appendChild(script);
}