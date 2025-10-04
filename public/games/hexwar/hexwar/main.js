const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
ctx.lineJoin = 'round';
ctx.lineCap = 'round';

const btnEndTurn = document.getElementById('btnEndTurn');
const btnBuild = document.getElementById('btnBuild');
const btnStrat = document.getElementById('btnStrat');
const btnRaise = document.getElementById('btnRaise');
const buildTypeSel = document.getElementById('buildType');
const terrainTypeSel = document.getElementById('terrainType');
const btnTerrain = document.getElementById('btnTerrain');
const goldRedEl = document.getElementById('goldRed');
const goldBlueEl = document.getElementById('goldBlue');
const actionsLeftEl = document.getElementById('actionsLeft');
const turnPill = document.getElementById('turnPill');
const msgEl = document.getElementById('msg');
// Panneau d'information (peut ne pas exister si ancienne UI)
const infoHex = document.getElementById('infoHex');
const infoOwner = document.getElementById('infoOwner');
const infoTerrain = document.getElementById('infoTerrain');
const infoBuilding = document.getElementById('infoBuilding');
const infoArmyOwner = document.getElementById('infoArmyOwner');
const infoArmyCount = document.getElementById('infoArmyCount');
const infoArmyComp = document.getElementById('infoArmyComp');
const infoArmyHP = document.getElementById('infoArmyHP');
const infoArmyRange = document.getElementById('infoArmyRange');
const infoArmyAtk = document.getElementById('infoArmyAtk');
// Barre de confirmation
const confirmBar = document.getElementById('confirmBar');
const btnConfirm = document.getElementById('btnConfirm');
const btnCancel = document.getElementById('btnCancel');
const confirmText = document.getElementById('confirmText');
// Menu principal
const menuOverlay = document.getElementById('menuOverlay');
const btnPlayBot = document.getElementById('btnPlayBot');
const btnPlayMulti = document.getElementById('btnPlayMulti');

// Config grille hex (axial pointes en haut)
const COLS = 8, ROWS = 8;
const R = 36;                       // rayon
const HEX_W = Math.sqrt(3) * R;     // largeur (pointes en haut)
const HEX_H = 2 * R;                // hauteur (pointes en haut)
const ORIGIN = { x: 80, y: 80 };    // décalage dessin
const FILL_EPS = 0.8;               // petit élargissement du fill pour éviter les interstices

// Joueurs
const NONE = 0, RED = 1, BLUE = 2;
const PLAYER_COLOR = {
  [NONE]: '#eeeeee',
  [RED]: '#e53935',
  [BLUE]: '#1e88e5'
};
const TILE_FILL = {
  [NONE]: '#fafafa',
  [RED]: '#ffebee',
  [BLUE]: '#e3f2fd'
};
const BUILD_COLORS = {
  outpost: '#8d6e63',
  town: '#4caf50',
  barracks: '#9c27b0',
  factory: '#546e7a',
  base: '#607d8b',
  capital: '#ffb300'
};

// Etat
const tiles = []; // owner/building per axial cell
// key "q,r" -> { p, troops: Array<{ type: 'inf'|'tank'|'arty', atk:number, range:number, hp:number }> }
const units = new Map();
let currentPlayer = RED;
let actionsLeft = 2;
let selected = null; // { q,r }
let usedStratagemThisTurn = false;
const gold = { [RED]: 5, [BLUE]: 5 };
let gameActive = false; // verrouille les interactions tant que le jeu n'a pas démarré
let gameMode = null; // 'bot' | 'pvp'
const BOT_PLAYER = BLUE; // le bot joue Bleu par défaut
let pendingAction = null; // { type:'move'|'attack'|'merge', from:{q,r}, to:{q,r} }

// coûts et revenus
const BUILD_COST = { outpost: 2, town: 5, barracks: 6, factory: 8 };
const RAISE_COST = 2; // coût levée de troupe
const INCOME_TOWN = 2; // or par ville
const OUTPOST_DEF_BONUS = 0.5; // bonus défense
const BASE_TURN_INCOME = 1; // +1 or par tour

// Types de troupes
const TROOP_STATS = {
  // Nouveaux profils: portée 0 = mêlée (adjacent)
  inf:   { atk: 1, range: 0, hp: 1 },      // infanterie
  tank:  { atk: 2, range: 0, hp: 3 },      // blindé
  arty:  { atk: 1, range: 3, hp: 2 },      // artillerie
};
function makeTroop(type = 'inf') { const b = TROOP_STATS[type]; return { type, atk: b.atk, range: b.range, hp: b.hp }; }

// Init carte
for (let q = 0; q < COLS; q++) {
  for (let r = 0; r < ROWS; r++) {
  tiles[idx(q, r)] = { owner: NONE, building: null, terrain: 'none' };
  }
}
// Positions de départ (capitale = Ville + Caserne)
placeBuilding(RED, 0, Math.floor(ROWS/2), 'capital');
placeArmyTroop(RED, 0, Math.floor(ROWS/2) + 1, makeTroop('inf'));

placeBuilding(BLUE, COLS - 1, Math.floor(ROWS/2), 'capital');
placeArmyTroop(BLUE, COLS - 1, Math.floor(ROWS/2) - 1, makeTroop('inf'));

// UI
btnEndTurn.addEventListener('click', endTurn);
btnBuild.addEventListener('click', () => {
  if (!selected) return;
  const t = tiles[idx(selected.q, selected.r)];
  const bType = buildTypeSel?.value || 'outpost';
  const hasUnit = units.has(key(selected.q, selected.r));
  if (t.owner !== currentPlayer) { flash('Construire: hex non contrôlé.'); return; }
  if (t.building) { flash('Construire: un bâtiment existe déjà.'); return; }
  // autorisé même si unité alliée présente
  const cost = BUILD_COST[bType] ?? 0;
  if (gold[currentPlayer] < cost) { flash(`Or insuffisant (coût ${cost}).`); return; }
  gold[currentPlayer] -= cost;
  t.building = bType;
  spendAction(`Construction: ${labelBuilding(bType)}`);
  render();
});
btnStrat.addEventListener('click', () => {
  if (!selected) return;
  const u = units.get(key(selected.q, selected.r));
  if (usedStratagemThisTurn) { flash('Déjà joué un stratagème ce tour.'); return; }
  if (u && u.p === currentPlayer) {
    // Ralliement: +1 pv à chaque troupe (cap 9)
    for (const t of u.troops) t.hp = Math.min(9, t.hp + 1);
    usedStratagemThisTurn = true;
    spendAction('Stratagème: +1 force');
    render();
  } else {
    flash('Aucune unité amie sélectionnée.');
  }
});
btnTerrain?.addEventListener('click', () => {
  if (!selected) return;
  const t = tiles[idx(selected.q, selected.r)];
  if (!t) return;
  // éditer terrain seulement si pas de bâtiment et contrôlé par le joueur actif
  if (t.building) { flash('Terrain: impossible sur une case avec bâtiment.'); return; }
  if (t.owner !== currentPlayer) { flash('Terrain: hex non contrôlé.'); return; }
  const tt = terrainTypeSel?.value || 'none';
  t.terrain = tt;
  spendAction(`Terrain placé: ${labelTerrain(tt)}`);
  render();
});
btnRaise?.addEventListener('click', () => {
  // Lévée de troupe: crée une unité 1 sur Ville/Caserne alliée (case libre)
  if (!selected) return;
  if (usedStratagemThisTurn) { flash('Déjà joué un stratagème ce tour.'); return; }
  const k = key(selected.q, selected.r);
  const t = tiles[idx(selected.q, selected.r)];
  if (!t || t.owner !== currentPlayer) { flash('Sélectionnez une case alliée.'); return; }
  if (!(t.building === 'town' || t.building === 'barracks' || t.building === 'capital')) { flash('Lévée: nécessite une Ville/Caserne/Capitale.'); return; }
  // Empilement autorisé sur case alliée
  if (gold[currentPlayer] < RAISE_COST) { flash(`Or insuffisant (coût ${RAISE_COST}).`); return; }
  gold[currentPlayer] -= RAISE_COST;
  // Lève une infanterie par défaut
  placeArmyTroop(currentPlayer, selected.q, selected.r, makeTroop('inf'));
  usedStratagemThisTurn = true;
  spendAction('Stratagème: Lévée de troupe');
  render();
});

// Interactions
canvas.addEventListener('click', onClickCanvas);
canvas.addEventListener('mousemove', onHoverCanvas);
window.addEventListener('resize', () => { resizeCanvas(); render(); });
btnConfirm?.addEventListener('click', () => {
  if (!pendingAction) return;
  const { type, from, to } = pendingAction;
  hideConfirm();
  if (type === 'move') {
    const t2 = tiles[idx(to.q, to.r)];
    moveArmy(from.q, from.r, to.q, to.r);
    if (t2) t2.owner = currentPlayer;
    spendAction('Déplacement + capture');
    render();
  } else if (type === 'attack') {
    resolveCombat(from.q, from.r, to.q, to.r);
  } else if (type === 'merge') {
    const a1 = units.get(key(from.q, from.r));
    const a2 = units.get(key(to.q, to.r));
    if (a1 && a2 && a1.p === a2.p) {
      a2.troops.push(...a1.troops);
      units.delete(key(from.q, from.r));
      selected = { q: to.q, r: to.r };
      spendAction('Rassemblement des troupes');
      render();
    }
  }
  pendingAction = null;
});
btnCancel?.addEventListener('click', () => {
  hideConfirm();
  pendingAction = null;
  render();
});

function showConfirm(text, action) {
  confirmText.textContent = text;
  confirmBar.style.display = '';
  pendingAction = action;
  // rendre tout de suite pour afficher la flèche d'aperçu
  render();
}
function hideConfirm() {
  confirmBar.style.display = 'none';
}

// Rendu initial
resizeCanvas();
updateHUD();
render();

// Menu: démarrage des modes
btnPlayBot?.addEventListener('click', () => {
  gameMode = 'bot';
  gameActive = true;
  menuOverlay.style.display = 'none';
  generateInitialTerrain();
  render();
  // si c'est au bot de commencer (non par défaut), lancer son tour
  maybeRunBotTurn();
});
btnPlayMulti?.addEventListener('click', () => {
  // PVP local, pour plus tard: on démarre quand même la partie
  gameMode = 'pvp';
  gameActive = true;
  menuOverlay.style.display = 'none';
  generateInitialTerrain();
  render();
});

// --- Logique principal ---

function onClickCanvas(e) {
  if (!gameActive) return; // jeu non lancé
  const { q, r } = screenToAxial(e.clientX, e.clientY) ?? {};
  if (!inBounds(q, r) || !inHexShape(q, r)) return;

  const u = units.get(key(q, r));

  // Si on a déjà une sélection: prioriser l'action (déplacement/attaque/merge)
  if (selected) {
    // Cliquer la même case -> désélection
    if (selected.q === q && selected.r === r) {
      selected = null;
      render();
      return;
    }
    // Si voisin -> tenter action
    if (isNeighbor(selected.q, selected.r, q, r)) {
      actWithSelectedOn(q, r);
      return;
    }
    // Sinon, déplacer la sélection sur la case cliquée
    selected = { q, r };
    render();
    return;
  }

  // Pas de sélection: cliquer une unité amie la sélectionne, sinon sélectionner l’hex
  if (u && u.p === currentPlayer) {
    selected = { q, r };
    render();
    return;
  }
  selected = { q, r };
  render();
}

function actWithSelectedOn(q2, r2) {
  if (!selected) return;
  const { q: q1, r: r1 } = selected;
  const a1 = units.get(key(q1, r1));
  if (!a1 || a1.p !== currentPlayer) {
    // Pas d'unité amie sur la case sélectionnée: déplace la sélection sur la case cliquée
    selected = { q: q2, r: r2 };
    render();
    return;
  }

  const a2 = units.get(key(q2, r2));
  const t2 = tiles[idx(q2, r2)];
  // Terrain infranchissable: lac et montagne
  if (t2?.terrain === 'lake') { flash('Lac: infranchissable.'); return; }
  if (t2?.terrain === 'mountain') { flash('Montagne: infranchissable.'); return; }
  // Ruines: seules les unités attaquantes/entrantes infanterie peuvent y entrer
  if (t2?.terrain === 'ruins') {
    const onlyInf = a1.troops.every(tr => tr.type === 'inf');
    if (!onlyInf && !units.has(key(q2, r2))) { flash('Ruines: seule l’infanterie peut entrer.'); return; }
  }

  const dist = axialDistance(q1, r1, q2, r2);
  const a1MaxRange = Math.max(...a1.troops.map(t=>t.range)); // 0 = mêlée, nécessite dist===1

  // 1) Si unité ennemie -> attaque (avec confirmation)
  if (a2 && a2.p !== currentPlayer) {
  if (dist <= a1MaxRange) {
      showConfirm('Confirmer l\'attaque ?', { type:'attack', from:{q:q1,r:r1}, to:{q:q2,r:r2} });
    } else {
      flash('Hors de portée.');
    }
    return;
  }

  // 2) Si unité alliée -> merge
  if (a2 && a2.p === currentPlayer) {
    // Vérifier ruines: seules infanteries peuvent y entrer (fusion = entrée sur to)
    if (t2?.terrain === 'ruins') {
      const onlyInf = a1.troops.every(tr => tr.type === 'inf');
      if (!onlyInf) { flash('Ruines: seule l’infanterie peut entrer.'); return; }
    }
    // Proposer la fusion
    showConfirm('Confirmer le rassemblement des troupes ?', { type:'merge', from:{q:q1,r:r1}, to:{q:q2,r:r2} });
    return;
  }

  // 3) Hex vide -> déplacement + capture (1 case, et règles terrain)
  if (dist !== 1) { flash('Déplacement: une case à la fois.'); return; }
  if (t2?.terrain === 'ruins') {
    const onlyInf = a1.troops.every(tr => tr.type === 'inf');
    if (!onlyInf) { flash('Ruines: seule l’infanterie peut entrer.'); return; }
  }
  showConfirm('Confirmer le déplacement ?', { type:'move', from:{q:q1,r:r1}, to:{q:q2,r:r2} });
}

function resolveCombat(q1, r1, q2, r2) {
  const atk = units.get(key(q1, r1));
  const def = units.get(key(q2, r2));
  if (!atk || !def) return;
  const t2 = tiles[idx(q2, r2)];

  // Sommes d'attaque/portée
  const sumAtk = (army) => army.troops.reduce((s,t)=>s+t.atk,0);
  const maxRange = (army) => Math.max(...army.troops.map(t=>t.range));
  const dist = axialDistance(q1, r1, q2, r2);

  // Terrain/bonus selon demande
  const DEFENSE_BONUS = { outpost: 0.5, town: 0.0, barracks: 0.0, factory: 0.0, capital: 1.0 };
  const buildBonus = (t)=> (t?.building ? (DEFENSE_BONUS[t.building]||0):0);
  const terrain = t2?.terrain || 'none';
  let terrainDefBonus = 0;
  let terrainAtkBonus = 0;
  if (terrain === 'trench') terrainDefBonus += 1;      // tranchée: défenseur +1
  if (terrain === 'hill') terrainAtkBonus += 1;         // colline: attaquant +1
  if (terrain === 'ruins') terrainDefBonus += 1;        // ruines: défenseur +1
  // lac et montagne sont infranchissables gérés côté mouvement; si combat déclenché, on est adjacent/autorisé

  // Attaque hors portée: aucune
  if (dist > maxRange(atk)) { flash('Hors de portée.'); return; }

  let damageToDef = Math.max(0, sumAtk(atk) + terrainAtkBonus - buildBonus(t2) - terrainDefBonus);
  // Riposte si portée côté défenseur
  let damageToAtk = 0;
  if (dist <= maxRange(def)) damageToAtk = Math.max(0, sumAtk(def));

  // Appliquer dégâts simultanément en vidant des troupes par ordre
  const applyDamage = (army, dmg) => {
    for (const tr of army.troops) {
      if (dmg <= 0) break;
      const taken = Math.min(tr.hp, dmg);
      tr.hp -= taken;
      dmg -= taken;
    }
    army.troops = army.troops.filter(tr => tr.hp > 0);
  };
  applyDamage(def, damageToDef);
  applyDamage(atk, damageToAtk);

  // Résultats
  if (def.troops.length === 0 && atk.troops.length === 0) {
    units.delete(key(q1, r1));
    units.delete(key(q2, r2));
    tiles[idx(q2, r2)].owner = NONE;
    selected = null;
    flash('Égalité: destructions réciproques');
  } else if (def.troops.length === 0) {
    // Défenseur éliminé: si attaque au contact, l’attaquant avance
    if (dist === 1) {
      units.set(key(q2, r2), atk);
      units.delete(key(q1, r1));
      tiles[idx(q2, r2)].owner = atk.p;
      selected = { q: q2, r: r2 };
    } else {
      // Tir à distance: rester en place mais la case devient neutre puis capturable
      units.delete(key(q2, r2));
      tiles[idx(q2, r2)].owner = NONE;
      selected = { q: q1, r: r1 };
    }
    flash('Cible neutralisée');
  } else if (atk.troops.length === 0) {
    // Attaquant éliminé
    units.set(key(q2, r2), def); // conserve défenseur
    units.delete(key(q1, r1));
    selected = null;
    flash('Attaque repoussée');
  } else {
    // Les deux survivants restent en place
    units.set(key(q1, r1), atk);
    units.set(key(q2, r2), def);
    selected = { q: q1, r: r1 };
    flash('Échange de tirs');
  }

  spendAction('Attaque');
  render();
}

function moveArmy(q1, r1, q2, r2) {
  const a = units.get(key(q1, r1));
  if (!a) return;
  units.set(key(q2, r2), a);
  units.delete(key(q1, r1));
  selected = { q: q2, r: r2 };
}

function placeArmyTroop(p, q, r, troop) {
  const k = key(q, r);
  const existing = units.get(k);
  if (existing) {
    if (existing.p !== p) { flash('Case occupée par l’ennemi.'); return; }
    existing.troops.push(troop);
    units.set(k, existing);
  } else {
    units.set(k, { p, troops: [troop] });
  }
  tiles[idx(q, r)].owner = p;
}
function placeBuilding(p, q, r, name) {
  const t = tiles[idx(q, r)] || { owner: NONE, building: null, terrain: 'none' };
  tiles[idx(q, r)] = { owner: p, building: name, terrain: t.terrain ?? 'none' };
}

function spendAction(label) {
  actionsLeft = Math.max(0, actionsLeft - 1);
  updateHUD();
  if (actionsLeft === 0) endTurn();
  else flash(`${label}. Actions restantes: ${actionsLeft}`);
}

function endTurn() {
  // revenus pour le joueur qui termine son tour
  addIncome(currentPlayer);
  currentPlayer = currentPlayer === RED ? BLUE : RED;
  actionsLeft = 2;
  usedStratagemThisTurn = false;
  // revenus
  selected = null;
  updateHUD();
  flash(`Tour: ${currentPlayer === RED ? 'Rouge' : 'Bleu'}`);
  render();
  maybeRunBotTurn();
}

function updateHUD() {
  actionsLeftEl.textContent = String(actionsLeft);
  goldRedEl.textContent = String(gold[RED]);
  goldBlueEl.textContent = String(gold[BLUE]);
  if (currentPlayer === RED) {
    turnPill.textContent = 'Rouge';
    turnPill.classList.remove('blue');
    turnPill.classList.add('red');
  } else {
    turnPill.textContent = 'Bleu';
    turnPill.classList.remove('red');
    turnPill.classList.add('blue');
  }
}

function flash(t) { msgEl.textContent = t; }

function onHoverCanvas(e) {
  const pos = screenToAxial(e.clientX, e.clientY);
  if (!pos) return;
  // Mettre à jour l’aperçu d’infos sans changer la sélection
  updateInfoPanel(pos);
}

function playerLabel(p) { return p === RED ? 'Rouge' : p === BLUE ? 'Bleu' : '—'; }

function updateInfoPanel(pos) {
  if (!infoHex) return; // panneau absent
  const target = pos ?? selected;
  if (!target || !inBounds(target.q, target.r) || !inHexShape(target.q, target.r)) {
    infoHex.textContent = '—';
    infoOwner.textContent = '—';
    infoTerrain.textContent = '—';
    infoBuilding.textContent = '—';
    infoArmyOwner.textContent = '—';
    infoArmyCount.textContent = '—';
    infoArmyComp.textContent = '—';
    infoArmyHP.textContent = '—';
    infoArmyRange.textContent = '—';
    infoArmyAtk.textContent = '—';
    return;
  }
  const { q, r } = target;
  infoHex.textContent = `${q},${r}`;
  const t = tiles[idx(q, r)];
  infoOwner.textContent = playerLabel(t?.owner ?? NONE);
  infoTerrain.textContent = labelTerrain(t?.terrain || 'none');
  infoBuilding.textContent = t?.building ? labelBuilding(t.building) : '—';
  const a = units.get(key(q, r));
  if (!a) {
    infoArmyOwner.textContent = '—';
    infoArmyCount.textContent = '—';
    infoArmyComp.textContent = '—';
    infoArmyHP.textContent = '—';
    infoArmyRange.textContent = '—';
    infoArmyAtk.textContent = '—';
  } else {
    infoArmyOwner.textContent = playerLabel(a.p);
    infoArmyCount.textContent = String(a.troops.length);
    const comp = { inf:0, tank:0, arty:0 };
    let hp = 0, atk = 0, rangeMax = 0;
    for (const tr of a.troops) { comp[tr.type]++; hp += tr.hp; atk += tr.atk; rangeMax = Math.max(rangeMax, tr.range); }
    infoArmyComp.textContent = `I:${comp.inf} B:${comp.tank} A:${comp.arty}`;
    infoArmyHP.textContent = String(hp);
    infoArmyRange.textContent = String(rangeMax);
    infoArmyAtk.textContent = String(atk);
  }
}

// --- Utils grille hex (axial q,r) ---

function idx(q, r) { return q * ROWS + r; }
function key(q, r) { return `${q},${r}`; }
function inBounds(q, r) { return Number.isInteger(q) && Number.isInteger(r) && q >= 0 && r >= 0 && q < COLS && r < ROWS; }
// Vérifie si la case (q, r) est dans l'hexagone central
function inHexShape(q, r) {
  // centre de la grille
  const centerQ = (COLS - 1) / 2;
  const centerR = (ROWS - 1) / 2;
  // rayon hexagone (distance max)
  const radius = Math.floor(Math.min(COLS, ROWS) / 2);
  // distance axiale
  const dq = Math.abs(q - centerQ);
  const dr = Math.abs(r - centerR);
  const ds = Math.abs((q - centerQ) + (r - centerR));
  return dq <= radius && dr <= radius && ds <= radius;
}

function axialToPixel(q, r) {
  // Formules pointy-top (Red Blob Games)
  const x = ORIGIN.x + Math.sqrt(3) * R * (q + r / 2);
  const y = ORIGIN.y + (3 / 2) * R * r;
  return { x, y };
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  // Échelle pour dessiner en unités CSS pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function screenToAxial(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  // Utiliser des pixels CSS; le dessin est déjà mis à l’échelle via setTransform(dpr,...)
  const x = (clientX - rect.left);
  const y = (clientY - rect.top);
  // inverser axialToPixel (approx), puis arrondir cube
  const px = x - ORIGIN.x;
  const py = y - ORIGIN.y;
  // Inverse pointy-top
  const rf = (2 / 3) * (py / R);
  const qf = (px / (Math.sqrt(3) * R)) - (rf / 2);
  const { q, r } = axialRound(qf, rf);
  if (!inBounds(q, r)) return null;
  return { q, r };
}
function axialRound(qf, rf) {
  // Convertir en cube, arrondir, reconvertir
  let x = qf, z = rf, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const x_diff = Math.abs(rx - x), y_diff = Math.abs(ry - y), z_diff = Math.abs(rz - z);
  if (x_diff > y_diff && x_diff > z_diff) rx = -ry - rz;
  else if (y_diff > z_diff) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

function isNeighbor(q1, r1, q2, r2) {
  const dirs = [[+1,0],[+1,-1],[0,-1],[-1,0],[-1,+1],[0,+1]]; // axial (pointy-top)
  return dirs.some(([dq, dr]) => q1 + dq === q2 && r1 + dr === r2);
}

// --- Génération de terrain initial ---
function generateInitialTerrain() {
  // Évite de bloquer autour des capitales
  const cap1 = { q: 0, r: Math.floor(ROWS/2) };
  const cap2 = { q: COLS - 1, r: Math.floor(ROWS/2) };
  const isNear = (q, r, c) => Math.abs(q - c.q) + Math.abs(r - c.r) <= 1;
  for (let q = 0; q < COLS; q++) {
    for (let r = 0; r < ROWS; r++) {
      if (!inHexShape(q, r)) continue;
      const t = tiles[idx(q, r)];
      if (!t || t.building) continue; // ne pas écraser capitales ou futurs bâtiments
      if (isNear(q, r, cap1) || isNear(q, r, cap2)) { t.terrain = 'none'; continue; }
      // Ratio cible: ~1/3 terrains spéciaux, ~2/3 terrain vierge
      const roll = Math.random();
      if (roll < 2/3) {
        t.terrain = 'none';
      } else {
        // Répartition au sein du tiers non-vierge
        const r2 = Math.random();
        if (r2 < 0.20) t.terrain = 'lake';        // ~6.7% global
        else if (r2 < 0.40) t.terrain = 'mountain'; // ~6.7%
        else if (r2 < 0.65) t.terrain = 'hill';     // ~8.3%
        else if (r2 < 0.90) t.terrain = 'trench';   // ~8.3%
        else t.terrain = 'ruins';                   // ~3.3%
      }
    }
  }
}

// --- Bot simple (Bleu) ---
function maybeRunBotTurn() {
  if (!gameActive) return;
  if (gameMode !== 'bot') return;
  if (currentPlayer !== BOT_PLAYER) return;
  // petit délai pour lisibilité
  setTimeout(botRunTurn, 350);
}

function botRunTurn() {
  if (currentPlayer !== BOT_PLAYER) return;
  if (actionsLeft <= 0) return;
  const acted = botStep();
  if (!acted) return; // botStep a pu terminer le tour
  setTimeout(botRunTurn, 300);
}

function botStep() {
  // 1) Chercher une attaque possible
  for (const [k, a] of units.entries()) {
    if (a.p !== BOT_PLAYER) continue;
    const [q, r] = k.split(',').map(Number);
    const neigh = [[+1,0],[+1,-1],[0,-1],[-1,0],[-1,+1],[0,+1]];
    for (const [dq, dr] of neigh) {
      const q2 = q + dq, r2 = r + dr;
      if (!inBounds(q2, r2) || !inHexShape(q2, r2)) continue;
      const t2 = tiles[idx(q2, r2)];
  if (t2?.terrain === 'lake' || t2?.terrain === 'mountain') continue;
      const a2 = units.get(key(q2, r2));
      if (a2 && a2.p !== BOT_PLAYER) {
        selected = { q, r };
        resolveCombat(q, r, q2, r2);
        return true;
      }
    }
  }
  // 2) Sinon, essayer de capturer un hex voisin libre
  for (const [k, a] of units.entries()) {
    if (a.p !== BOT_PLAYER) continue;
    const [q, r] = k.split(',').map(Number);
    const neigh = [[+1,0],[+1,-1],[0,-1],[-1,0],[-1,+1],[0,+1]];
    for (const [dq, dr] of neigh) {
      const q2 = q + dq, r2 = r + dr;
      if (!inBounds(q2, r2) || !inHexShape(q2, r2)) continue;
      const t2 = tiles[idx(q2, r2)];
      if (t2?.terrain === 'lake' || t2?.terrain === 'mountain') continue;
      if (t2?.terrain === 'ruins') {
        // entrer dans des ruines seulement si armée 100% infanterie
        const onlyInf = a.troops.every(tr => tr.type === 'inf');
        if (!onlyInf) continue;
      }
      if (units.has(key(q2, r2))) continue;
      moveArmy(q, r, q2, r2);
      t2.owner = BOT_PLAYER;
      spendAction('Bot: déplacement + capture');
      render();
      return true;
    }
  }
  // 3) Sinon, construire un avant-poste si possible
  if (gold[BOT_PLAYER] >= (BUILD_COST.outpost || 0)) {
    for (let q = 0; q < COLS; q++) {
      for (let r = 0; r < ROWS; r++) {
        if (!inHexShape(q, r)) continue;
        const t = tiles[idx(q, r)];
        if (t.owner === BOT_PLAYER && !t.building) {
          t.building = 'outpost';
          gold[BOT_PLAYER] -= BUILD_COST.outpost;
          spendAction('Bot: construit un avant‑poste');
          render();
          return true;
        }
      }
    }
  }
  // 4) Rien à faire: terminer le tour
  actionsLeft = 0;
  endTurn();
  return false;
}

// --- Rendu ---

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Hexes (affiche seulement celles dans la forme hexagonale)
  for (let q = 0; q < COLS; q++) {
    for (let r = 0; r < ROWS; r++) {
      if (!inHexShape(q, r)) continue;
      const t = tiles[idx(q, r)];
      drawHexCell(q, r, TILE_FILL[t.owner]);
  if (t.terrain && t.terrain !== 'none') drawTerrainOverlay(q, r, t.terrain);
      // Contour contrôle
      const borderColor = t.owner === NONE ? '#444' : PLAYER_COLOR[t.owner];
  strokeHex(q, r, borderColor, 1.5, 1.25);
      // Bâtiments
      if (t.building) drawBuilding(q, r, t.building, t.owner);
    }
  }

  // Surbrillance sélection + voisins
  if (selected && inHexShape(selected.q, selected.r)) {
    strokeHex(selected.q, selected.r, '#ff9800', 3, 0);
    // voisins
    const neigh = [[+1,0],[+1,-1],[0,-1],[-1,0],[-1,+1],[0,+1]];
    for (const [dq, dr] of neigh) {
      const q2 = selected.q + dq, r2 = selected.r + dr;
      if (!inBounds(q2, r2) || !inHexShape(q2, r2)) continue;
      strokeHex(q2, r2, 'rgba(255,152,0,0.4)', 3, 0);
    }
  }

  // Unités
  for (const [k, a] of units.entries()) {
    const [q, r] = k.split(',').map(Number);
    if (!inHexShape(q, r)) continue;
    drawArmy(q, r, a);
  }

  // Aperçu (flèche) lors d'une confirmation: vert pour déplacement/merge, rouge pour attaque
  if (pendingAction) {
    const color = pendingAction.type === 'attack' ? '#e74c3c' : '#2ecc71';
    drawMovePreview(pendingAction.from, pendingAction.to, color);
  }
  updateInfoPanel();
}

function drawHexCell(q, r, fill) {
  const { x, y } = axialToPixel(q, r);
  const t = tiles[idx(q, r)];
  const pts = hexCorners(x, y, R + FILL_EPS); // léger chevauchement des fills pour coller les hex
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  // couleur de fond selon terrain
  let base = fill;
  if (t?.terrain === 'lake') base = '#b3e5fc';
  else if (t?.terrain === 'mountain') base = '#cfd8dc';
  else if (t?.terrain === 'trench') base = '#d7ccc8';
  else if (t?.terrain === 'hill') base = '#e6ee9c';
  else if (t?.terrain === 'ruins') base = '#d1c4e9';
  ctx.fillStyle = base;
  ctx.fill();
}

function strokeHex(q, r, color, width = 2, inset = 0) {
  const { x, y } = axialToPixel(q, r);
  const rr = Math.max(0, R - (inset || 0));
  const pts = hexCorners(x, y, rr); // contour légèrement rentré pour voir les deux bords
  // Clip à l’intérieur de l’hex pour éviter les chevauchements de traits
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.clip();
  // tracer
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

function drawTerrainOverlay(q, r, terrain) {
  const { x, y } = axialToPixel(q, r);
  const pts = hexCorners(x, y, R - 2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.clip();

  if (terrain === 'trench') {
    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 1;
    const step = 6;
    const minX = x - HEX_W*0.6, maxX = x + HEX_W*0.6;
    const minY = y - HEX_H*0.6, maxY = y + HEX_H*0.6;
    for (let d = minX - maxY; d < maxX - minY; d += step) {
      ctx.beginPath();
      const p1 = { x: Math.max(minX, minY + d), y: Math.max(minY, minX - d) };
      const p2 = { x: Math.min(maxX, maxY + d), y: Math.min(maxY, maxX - d) };
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  } else if (terrain === 'mountain') {
    ctx.strokeStyle = '#455a64';
    ctx.fillStyle = '#90a4ae';
    ctx.lineWidth = 1.5;
    const peaks = [
      { ox: -8, oy: 6, s: 10 },
      { ox: 8, oy: 8, s: 8 },
      { ox: 0, oy: -2, s: 12 },
    ];
    for (const p of peaks) {
      ctx.beginPath();
      ctx.moveTo(x + p.ox - p.s * 0.7, y + p.oy + p.s * 0.6);
      ctx.lineTo(x + p.ox, y + p.oy - p.s);
      ctx.lineTo(x + p.ox + p.s * 0.7, y + p.oy + p.s * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (terrain === 'lake') {
    ctx.strokeStyle = '#0288d1';
    ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(x + i * 8, y + 2 * i, 10, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    }
  } else if (terrain === 'hill') {
    ctx.strokeStyle = '#827717';
    ctx.lineWidth = 1.5;
    // petites courbes de relief
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(x + i * 10, y + i * 2, 12, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    }
  } else if (terrain === 'ruins') {
    ctx.strokeStyle = '#5e35b1';
    ctx.lineWidth = 1.5;
    // croquis de murs effondrés
    ctx.beginPath();
    ctx.moveTo(x - 12, y + 6); ctx.lineTo(x - 6, y - 6); ctx.lineTo(x, y + 4);
    ctx.moveTo(x + 4, y + 8); ctx.lineTo(x + 10, y - 4);
    ctx.stroke();
  }
  ctx.restore();
}

function hexCorners(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
  // pointy-top, 0° à l’axe horizontal, pointe à 30°
  const a = Math.PI / 180 * (60 * i + 30);
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

function drawArmy(q, r, army) {
  const { x, y } = axialToPixel(q, r);
  const rr = R * 0.52;
  // disque de couleur joueur
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.fillStyle = PLAYER_COLOR[army.p];
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#00000020';
  ctx.stroke();

  // Afficher effectif et type dominant
  const count = army.troops.length;
  const typeCounts = { inf:0, tank:0, arty:0 };
  for (const t of army.troops) typeCounts[t.type]++;
  const dominant = Object.entries(typeCounts).sort((a,b)=>b[1]-a[1])[0][0];
  const typeLabel = dominant === 'inf' ? 'I' : dominant === 'tank' ? 'B' : 'A';

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${typeLabel}:${count}`, x, y);
}

function axialDistance(q1, r1, q2, r2) {
  const x1 = q1, z1 = r1, y1 = -x1 - z1;
  const x2 = q2, z2 = r2, y2 = -x2 - z2;
  return Math.max(Math.abs(x1-x2), Math.abs(y1-y2), Math.abs(z1-z2));
}

function drawMovePreview(from, to, color = '#2ecc71') {
  const p1 = axialToPixel(from.q, from.r);
  const p2 = axialToPixel(to.q, to.r);
  let dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  // Raccourcir pour ne pas rentrer dans les disques/unités
  const startOff = R * 0.6;
  const endOff = R * 0.8;
  const sx = p1.x + ux * startOff;
  const sy = p1.y + uy * startOff;
  const ex = p2.x - ux * endOff;
  const ey = p2.y - uy * endOff;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  // Pointe de flèche
  const head = 12;
  const ang = Math.atan2(dy, dx);
  const a1 = ang + Math.PI - Math.PI / 7;
  const a2 = ang + Math.PI + Math.PI / 7;
  const hx1 = ex + head * Math.cos(a1);
  const hy1 = ey + head * Math.sin(a1);
  const hx2 = ex + head * Math.cos(a2);
  const hy2 = ey + head * Math.sin(a2);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(hx1, hy1);
  ctx.lineTo(hx2, hy2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBuilding(q, r, name, owner) {
  const { x, y } = axialToPixel(q, r);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = BUILD_COLORS[name] || (owner === RED ? '#f06292' : '#64b5f6');
  if (name === 'base') {
    // maison simple
    ctx.beginPath();
    ctx.rect(-10, 0, 20, 14);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(0, -14);
    ctx.lineTo(12, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    // autre bâtiment
    if (name === 'outpost') {
      ctx.beginPath();
      ctx.moveTo(-8, 10); ctx.lineTo(0, -12); ctx.lineTo(8, 10); ctx.closePath();
      ctx.fill();
    } else if (name === 'town') {
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (name === 'barracks') {
      ctx.beginPath();
      ctx.rect(-10, -6, 20, 12);
      ctx.fill();
    } else if (name === 'factory') {
      ctx.beginPath();
      ctx.rect(-8, 0, 16, 10);
      ctx.fill();
      ctx.beginPath();
      ctx.rect(-4, -10, 8, 10);
      ctx.fill();
    } else if (name === 'capital') {
      // icône combinant ville + caserne
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2); // disque ville
      ctx.fill();
      ctx.fillStyle = '#fff8e1';
      ctx.beginPath();
      ctx.rect(-6, -4, 12, 8); // bâtiment caserne clair
      ctx.fill();
      ctx.fillStyle = BUILD_COLORS[name];
    }
  }
  ctx.restore();
}

function labelBuilding(b) {
  return b === 'outpost' ? 'Avant‑poste' : b === 'town' ? 'Ville' : b === 'barracks' ? 'Caserne' : b === 'factory' ? 'Usine' : b === 'capital' ? 'Capitale' : b;
}

function labelTerrain(t) {
  return t === 'trench' ? 'Tranchée' : t === 'mountain' ? 'Montagne' : t === 'lake' ? 'Lac' : t === 'hill' ? 'Colline' : t === 'ruins' ? 'Ruines' : 'Aucun';
}

function addIncome(player) {
  let towns = 0;
  let income = BASE_TURN_INCOME; // revenu de base
  // comptage des villes et usines
  for (let q = 0; q < COLS; q++) {
    for (let r = 0; r < ROWS; r++) {
      if (!inHexShape(q, r)) continue;
      const t = tiles[idx(q, r)];
      if (!t || t.owner !== player) continue;
  if (t.building === 'town' || t.building === 'capital') towns++;
    }
  }
  // revenu des villes
  income += towns * INCOME_TOWN;
  // revenu des usines = nombre de villes adjacentes alliées
  for (let q = 0; q < COLS; q++) {
    for (let r = 0; r < ROWS; r++) {
      if (!inHexShape(q, r)) continue;
      const t = tiles[idx(q, r)];
      if (!t || t.owner !== player) continue;
    if (t.building === 'factory') {
        let adjTowns = 0;
        const neigh = [[+1,0],[+1,-1],[0,-1],[-1,0],[-1,+1],[0,+1]];
        for (const [dq, dr] of neigh) {
          const q2 = q + dq, r2 = r + dr;
          if (!inBounds(q2, r2) || !inHexShape(q2, r2)) continue;
          const t2 = tiles[idx(q2, r2)];
      if (t2 && t2.owner === player && (t2.building === 'town' || t2.building === 'capital')) adjTowns++;
        }
        income += adjTowns; // 1 or par ville adjacente
      }
    }
  }
  gold[player] += income;
}