// Menteur (cartes) — Variante personnalisée
// Paquet de base: 8x Roi, 8x Dame, 8x Valet, 8x As, 2x Joker => 34 cartes
// Règles spécifiques (de l'utilisateur):
// - 2 à 8 joueurs. 1 paquet pour ≤4 joueurs, 2 paquets sinon.
// - Début de manche: premier joueur pose 1 carte face visible (si Joker, choisir la figure), ça fixe la figure (rang_courant).
// - Tours suivants: le joueur DOIT poser +1 cartes face cachée, toutes annoncées rang_courant. Les Jokers sont sauvages (comptent comme rang_courant).
// - Seul le joueur suivant peut accuser. Pas de "passer".
// - L'exigence est bornée (cap = 10 par paquet: 8 de la figure + 2 jokers). Si exigence > cap, accusation obligatoire.
// - Cartes restantes non redistribuées jusqu'à fin de manche.

(function () {
  'use strict';

  // ---------- Utilitaires ----------
  const RANKS = ['Roi', 'Dame', 'Valet', 'As'];
  const JOKER = 'Joker';

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function buildPack() {
    const cards = [];
    for (const r of RANKS) {
      for (let i = 0; i < 8; i++) cards.push({ rank: r });
    }
    for (let j = 0; j < 2; j++) cards.push({ rank: JOKER });
    return cards; // 34
  }

  function buildDeck(numPlayers) {
    const numPacks = numPlayers <= 4 ? 1 : 2;
    let deck = [];
    for (let p = 0; p < numPacks; p++) deck = deck.concat(buildPack());
    shuffle(deck);
    return { deck, numPacks };
  }

  function computeCap(numPacks) {
    // Cap = 10 par paquet (8 figure + 2 jokers)
    return 10 * numPacks;
  }

  function el(id) { return document.getElementById(id); }
  function show(node) { node.classList.remove('hidden'); }
  function hide(node) { node.classList.add('hidden'); }

  function cardLabel(c) {
    return c.rank === JOKER ? 'Joker' : c.rank;
  }

  function renderCard(c, selectable = true) {
    const div = document.createElement('div');
    div.className = 'card' + (c.rank === JOKER ? ' joker' : '');
    div.dataset.rank = c.rank;
    if (selectable) div.tabIndex = 0;
    div.innerHTML = `<div class="rank">${cardLabel(c)}</div><div class="suit">${c.rank === JOKER ? '★' : '♛'}</div>`;
    return div;
  }

  // ---------- État du jeu ----------
  const state = {
    players: [], // { id, name, hand: Card[] }
    deck: [],
    reserve: [], // cartes écartées au début si non divisible exactement
    pile: [], // pile centrale (ordre: bas -> haut)
    currentPlayerIdx: 0,
    leaderIdx: 0, // celui qui ouvre la manche
  roundRank: null, // rang courant (dernière figure annoncée)
    requirement: 1,
    cap: 10,
    numPacks: 1,
    lastPlay: null, // { playerId, count, rank, cards: Card[], visibleFirst: Card|null }
    isRoundOpen: true,
  };

  // ---------- Distribution ----------
  function deal(deck, numPlayers) {
    const hands = Array.from({ length: numPlayers }, () => []);
    // Distribution strictement équitable: chacun floor(N/P) cartes.
    const perPlayer = Math.floor(deck.length / numPlayers);
    const totalDeal = perPlayer * numPlayers;
    for (let i = 0; i < totalDeal; i++) {
      hands[i % numPlayers].push(deck.pop());
    }
    // Le reste va en réserve et ne sera pas redistribué avant la fin de la manche.
    const reserve = deck.splice(0, deck.length); // tout ce qui reste (du bas du paquet, ordre non important ici)
    return { hands, reserve };
  }

  // ---------- UI: Setup ----------
  const setupForm = el('setup-form');
  const numPlayersInput = el('numPlayers');
  const playersConfig = el('players-config');
  const packsInfo = el('packs-info');
  const capInfo = el('cap-info');

  function refreshPlayersConfig() {
    const n = Math.max(2, Math.min(8, Number(numPlayersInput.value || 4)));
    const { numPacks } = buildDeck(n);
    const cap = computeCap(numPacks);
    packsInfo.textContent = `Auto: ${numPacks} paquet${numPacks > 1 ? 's' : ''} pour ${n} joueur(s).`;
    capInfo.textContent = `Cap: ${cap} (=${numPacks}×(8+2)).`;

    let html = '';
    for (let i = 0; i < n; i++) {
      html += `
        <div class="form-row">
          <label>Nom du joueur ${i + 1}</label>
          <input type="text" id="pname-${i}" value="Joueur ${i + 1}" />
        </div>`;
    }
    playersConfig.innerHTML = html;
  }

  numPlayersInput.addEventListener('input', refreshPlayersConfig);
  refreshPlayersConfig();

  setupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const n = Math.max(2, Math.min(8, Number(numPlayersInput.value || 4)));
    const names = [];
    for (let i = 0; i < n; i++) {
      const name = document.getElementById(`pname-${i}`).value.trim() || `Joueur ${i + 1}`;
      names.push(name);
    }
    startGame(names);
  });

  // ---------- Démarrage ----------
  const startScreen = el('start-screen');
  const gameScreen = el('game-screen');

  function startGame(names) {
    // Build deck
    const built = buildDeck(names.length);
    state.deck = built.deck;
    state.numPacks = built.numPacks;
    state.cap = computeCap(state.numPacks);

    // Deal
  const dealt = deal(state.deck, names.length);
  state.players = names.map((name, i) => ({ id: i, name, hand: dealt.hands[i] }));

    // Reset round
    state.pile = [];
  state.reserve = dealt.reserve || [];
    state.currentPlayerIdx = 0;
    state.leaderIdx = 0;
    state.roundRank = null;
  state.requirement = 1;
    state.lastPlay = null;
    state.isRoundOpen = true;

    hide(startScreen);
    show(gameScreen);
    renderEverything();
    promptLead();
  }

  // ---------- Rendu commun ----------
  const roundRankSpan = el('round-rank');
  const requirementSpan = el('requirement');
  const capSpan = el('cap');
  const pileCountSpan = el('pile-count');
  const reserveCountSpan = el('reserve-count');
  const playersLine = el('players-line');
  const currentPlayerName = el('current-player-name');
  const handDiv = el('hand');
  const lastPlayDiv = el('last-play-content');
  const tableRank = el('table-rank');
  const tableCount = el('table-count');
  const tableVisible = el('table-visible');
  const tableFaceDown = el('table-facedown');
  const stepBanner = el('step-banner');

  function renderTopbar() {
    roundRankSpan.textContent = state.roundRank ?? '—';
    requirementSpan.textContent = state.requirement;
    capSpan.textContent = state.cap;
    pileCountSpan.textContent = state.pile.length;
    reserveCountSpan.textContent = state.reserve.length;

    playersLine.innerHTML = '';
    state.players.forEach((p, idx) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip' + (idx === state.currentPlayerIdx ? ' active' : '');
      chip.innerHTML = `<span>${p.name}</span> <span class="count">${p.hand.length}</span>`;
      playersLine.appendChild(chip);
    });
  }

  function renderHand() {
    const p = state.players[state.currentPlayerIdx];
    currentPlayerName.textContent = p.name;
    handDiv.innerHTML = '';
    p.hand.forEach((c, i) => {
      const cardEl = renderCard(c);
      cardEl.dataset.index = String(i);
      handDiv.appendChild(cardEl);
    });
  }

  function renderLastPlay() {
    if (!state.lastPlay) { lastPlayDiv.textContent = 'Aucune'; return; }
    const { playerId, rank, count, cards, visibleFirst } = state.lastPlay;
    const playerName = state.players[playerId]?.name ?? '—';
    const div = document.createElement('div');
    const vis = visibleFirst ? cardLabel(visibleFirst) : '—';
    div.innerHTML = `
      <div><span class="tag">Joueur</span> ${playerName}</div>
      <div><span class="tag">Annonce</span> ${rank} × ${count}</div>
      <div><span class="tag">Ouverture</span> ${vis}</div>
      <div class="reveal-cards" id="last-reveal-cards"></div>
    `;
    lastPlayDiv.innerHTML = '';
    lastPlayDiv.appendChild(div);
    const cont = div.querySelector('#last-reveal-cards');
    cards.forEach(c => cont.appendChild(renderCard(c, false)));
  }

  function renderEverything() {
    renderTopbar();
    renderPlayersLine();
    renderHand();
    renderLastPlay();
  renderTable();
    updateActionHints('');
  updateStepBanner();
  }

  function renderPlayersLine() {
    // already handled in renderTopbar for chips
  }

  function updateActionHints(text) {
    el('action-hints').textContent = text || '';
  }

  function renderTable() {
    // Rank currently announced
    tableRank.textContent = state.roundRank ?? '—';
    // Count of cards on table
    tableCount.textContent = state.pile.length;
    // Visible: show the opening card of the current sequence if available
    tableVisible.innerHTML = '';
    let opening = null;
    if (state.lastPlay && state.lastPlay.visibleFirst) {
      opening = state.lastPlay.visibleFirst;
    }
    if (!opening && state.pile.length > 0) {
      // Fallback: best-effort, show the bottom-most card as visible placeholder
      opening = state.pile[0];
    }
    if (opening) {
      tableVisible.appendChild(renderCard(opening, false));
    }
    // Face-down stack: number of cards minus the visible opening one if it belongs to pile
    tableFaceDown.innerHTML = '';
    const facedown = Math.max(0, state.pile.length - (opening ? 1 : 0));
    const maxShow = Math.min(facedown, 10);
    for (let i = 0; i < maxShow; i++) {
      const fd = document.createElement('div');
      fd.className = 'face-down-card';
      tableFaceDown.appendChild(fd);
    }
  }

  function updateStepBanner() {
    const p = state.players[state.currentPlayerIdx];
    if (!p) { stepBanner.textContent = ''; return; }
    if (state.isRoundOpen) {
      stepBanner.textContent = `${p.name} · Ouvrir: 1 carte visible + annonce.`;
    } else {
      stepBanner.textContent = `${p.name} · Poser ${state.requirement} carte(s) + annonce.`;
    }
  }

  // ---------- Overlays / Modals ----------
  const overlay = el('overlay');
  const passModal = el('pass-device');
  const nextPlayerName = el('next-player-name');
  const btnReady = el('btn-ready');
  const accuseModal = el('accuse-modal');
  const accuseRank = el('accuse-rank');
  const accuseCount = el('accuse-count');
  const accusedName = el('accused-name');
  const btnAccuse = el('btn-accuse');
  const btnLetPass = el('btn-let-pass');
  const forceAccuseNote = el('force-accuse-note');
  const revealModal = el('reveal-modal');
  const revealDetails = el('reveal-details');
  const btnContinueAfterReveal = el('btn-continue-after-reveal');
  const winnerModal = el('winner-modal');
  const winnerName = el('winner-name');
  const btnNewRound = el('btn-new-round');
  const btnRestart = el('btn-restart');

  function openPassTo(nextIdx) {
    overlay.classList.remove('hidden');
    passModal.classList.remove('hidden');
    nextPlayerName.textContent = state.players[nextIdx].name;
  }
  btnReady.addEventListener('click', () => {
    overlay.classList.add('hidden');
    passModal.classList.add('hidden');
    renderEverything();
    if (state.isRoundOpen) promptLead(); else promptTurn();
  });

  function openAccusePrompt() {
  if (!state.lastPlay) return;
  accuseRank.textContent = state.lastPlay.rank;
  accuseCount.textContent = state.lastPlay.count;
  const prevIdx = (state.currentPlayerIdx - 1 + state.players.length) % state.players.length;
  if (accusedName) accusedName.textContent = state.players[prevIdx]?.name ?? '';
  const force = state.requirement > state.cap;
    forceAccuseNote.hidden = !force;
  btnLetPass.disabled = force;
    overlay.classList.remove('hidden');
    accuseModal.classList.remove('hidden');
  }

  btnLetPass.addEventListener('click', () => {
    // Let it pass: advance to next player and show pass-device
    accuseModal.classList.add('hidden');
    overlay.classList.add('hidden');
    advanceAfterNoAccuse();
  });

  btnAccuse.addEventListener('click', () => {
    accuseModal.classList.add('hidden');
    revealLastPlay();
  });

  function revealLastPlay() {
    // Resolve accusation against the previous play
  const accused = (state.currentPlayerIdx - 1 + state.players.length) % state.players.length;
    const lp = state.lastPlay;
    if (!lp) return;
    const targetRank = state.lastPlay.rank;
    const isTruth = lp.cards.every(c => c.rank === targetRank || c.rank === JOKER);

    let msg = '';
    if (isTruth) {
      msg = `<p>Vérifié: toutes les cartes sont bien ${targetRank} (les Jokers comptent).</p>`;
      // In normal mode: accuser ramasse la pile. In secret mode: roulette between accuser and pile behavior.
      if (state.secretMode) {
        // Accuser pulls trigger
        triggerRoulette(state.currentPlayerIdx, /*onSurvive*/() => {
          // Survived: accuser gains nothing special but play continues (we keep pile cleared)
          finishAfterRoulette(true, 'accuser');
        }, /*onDie*/() => {
          // Died: remove accuser from game
          finishAfterRoulette(false, 'accuser');
        });
        // show message in roulette handler
      } else {
        const accuserIdx = state.currentPlayerIdx; // the next player who accused
        takePile(accuserIdx);
        // New round led by accused (since he was correct)
        state.leaderIdx = accused;
        state.currentPlayerIdx = accused;
      }
    } else {
      msg = `<p>Mensonge: au moins une carte n'est pas ${targetRank}.</p>`;
      if (state.secretMode) {
        // Poseur pulls trigger
        triggerRoulette(accused, /*onSurvive*/() => {
          finishAfterRoulette(true, 'poseur');
        }, /*onDie*/() => {
          finishAfterRoulette(false, 'poseur');
        });
      } else {
        takePile(accused);
        // New round led by accuser (since poseur was wrong)
        const accuserIdx = state.currentPlayerIdx;
        state.leaderIdx = accuserIdx;
        state.currentPlayerIdx = accuserIdx;
      }
    }

    // Clear central pile and reset round
    const revealedDiv = document.createElement('div');
    revealedDiv.className = 'reveal-cards';
    lp.cards.forEach(c => revealedDiv.appendChild(renderCard(c, false)));
    revealDetails.innerHTML = msg;
    revealDetails.appendChild(revealedDiv);

    state.pile = [];
    state.roundRank = null;
    state.requirement = 1;
    state.lastPlay = null;
    state.isRoundOpen = true;
    // If secret mode triggered asynchronous roulette, roulette handler will call render. Otherwise show reveal modal now.
    if (!state.awaitingRoulette) {
      overlay.classList.remove('hidden');
      revealModal.classList.remove('hidden');
      renderEverything();
    }
  }

  btnContinueAfterReveal.addEventListener('click', () => {
    overlay.classList.add('hidden');
    revealModal.classList.add('hidden');
    checkForWinnerOrContinue();
  });

  function takePile(playerIdx) {
    const p = state.players[playerIdx];
    p.hand = p.hand.concat(state.pile);
    state.pile = [];
  }

  // ---------- Secret roulette logic ----------
  // Enabled when URL path contains 'debug' before the game name
  state.secretMode = false;
  state.awaitingRoulette = false;
  // Track a decreasing chamber: start at 6, then 5, then 4, ... per pull for the same player sequence.
  state.rouletteChamber = 6;

  function detectSecretMode() {
    try {
      const path = window.location.pathname || '';
      // If path contains '/debug/' segment, enable secret mode
      state.secretMode = path.split('/').includes('debug');
    } catch (e) {
      state.secretMode = false;
    }
  }
  detectSecretMode();

  function triggerRoulette(playerIdx, onSurvive, onDie) {
    state.awaitingRoulette = true;
    const details = el('roulette-details');
    const modal = el('roulette-modal');
    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    const chambers = state.rouletteChamber;
    details.innerHTML = `<p>${state.players[playerIdx].name} tire... chance de mourir 1/${chambers}</p>`;
    // simulate pull
    setTimeout(() => {
      const roll = Math.floor(Math.random() * chambers) + 1; // 1..chambers
      if (roll === 1) {
        details.innerHTML += `<p style="color: #ff6b6b">Coup fatal !</p>`;
        // remove player
        onDie();
      } else {
        details.innerHTML += `<p style="color: #8affc1">Survécu.</p>`;
        onSurvive();
      }
      // decrease next chamber (min 2)
      state.rouletteChamber = Math.max(2, state.rouletteChamber - 1);
      state.awaitingRoulette = false;
    }, 800);
  }

  const rouletteModal = el('roulette-modal');
  const btnRouletteContinue = el('btn-roulette-continue');
  if (btnRouletteContinue) btnRouletteContinue.addEventListener('click', () => {
    overlay.classList.add('hidden');
    rouletteModal.classList.add('hidden');
    // after roulette, continue normal flow: show reveal modal for transparency
    overlay.classList.remove('hidden');
    revealModal.classList.remove('hidden');
    renderEverything();
  });

  function finishAfterRoulette(survived, role) {
    // role: 'accuser' or 'poseur'
    if (!survived) {
      // find player to remove
      let removeIdx = null;
      if (role === 'accuser') removeIdx = state.currentPlayerIdx; else removeIdx = (state.currentPlayerIdx - 1 + state.players.length) % state.players.length;
      if (removeIdx !== null) {
        // remove player from players array
        state.players.splice(removeIdx, 1);
        // adjust indices
        if (state.currentPlayerIdx >= state.players.length) state.currentPlayerIdx = 0;
        if (state.leaderIdx >= state.players.length) state.leaderIdx = 0;
      }
    } else {
      // if survived, no one picks the pile in secret mode
    }
    // clear pile and reset round as usual
    state.pile = [];
    state.roundRank = null;
    state.requirement = 1;
    state.lastPlay = null;
    state.isRoundOpen = true;
    state.awaitingRoulette = false;
    // show reveal modal showing what happened
    const revealDetailsEl = el('reveal-details');
    revealDetailsEl.innerHTML = `<p>Résultat de la roulette: ${survived ? 'Survécu' : 'Mort'}</p>`;
    overlay.classList.remove('hidden');
    revealModal.classList.remove('hidden');
    renderEverything();
  }

  function checkForWinnerOrContinue() {
    const winners = state.players.filter(p => p.hand.length === 0);
    if (winners.length > 0) {
      winnerName.textContent = winners[0].name;
      overlay.classList.remove('hidden');
      winnerModal.classList.remove('hidden');
      return;
    }
    // Pass device to the new leader
    openPassTo(state.currentPlayerIdx);
  }

  btnNewRound.addEventListener('click', () => {
    // Keep players, reshuffle full packs, redeal
    const names = state.players.map(p => p.name);
    overlay.classList.add('hidden');
    winnerModal.classList.add('hidden');
    startGame(names);
  });

  btnRestart.addEventListener('click', () => {
    overlay.classList.add('hidden');
    winnerModal.classList.add('hidden');
    hide(gameScreen);
    show(startScreen);
  });

  // ---------- Ouverture de manche ----------
  const leadControls = el('lead-controls');
  const leadSelection = el('lead-selection');
  const announceRankPicker = el('announce-rank-picker');
  const announceRankSelect = el('announce-rank');
  const btnLeadPlay = el('btn-lead-play');

  function promptLead() {
    show(leadControls);
    hide(el('turn-controls'));
    renderLeadSelection();
  updateActionHints("Choisissez une carte d'ouverture et l'annonce (figure revendiquée).");
  }

  function renderLeadSelection() {
    const p = state.players[state.currentPlayerIdx];
    leadSelection.innerHTML = '';
    let selectedIdx = null;
    p.hand.forEach((c, i) => {
      const cEl = renderCard(c);
      cEl.addEventListener('click', () => {
        leadSelection.querySelectorAll('.card').forEach(n => n.classList.remove('selected'));
        cEl.classList.add('selected');
        selectedIdx = i;
  btnLeadPlay.disabled = false;
      });
      leadSelection.appendChild(cEl);
    });

    btnLeadPlay.onclick = () => {
      if (selectedIdx === null) return;
  const card = p.hand.splice(selectedIdx, 1)[0];
  const chosenRank = announceRankSelect.value;
  state.roundRank = chosenRank;
  // Next needed count after opening 1 visible
  state.requirement = 2;
      state.pile.push(card); // visible card goes on pile
      state.lastPlay = { playerId: p.id, count: 1, rank: chosenRank, cards: [card], visibleFirst: card };
      state.isRoundOpen = false;

  // Set current to next player to allow only-next accusation
  state.currentPlayerIdx = (state.currentPlayerIdx + 1) % state.players.length;
  renderEverything();
  openAccusePrompt();
    };
  }

  // ---------- Tour normal ----------
  const turnControls = el('turn-controls');
  const turnRequirementLabel = el('turn-requirement-label');
  const turnAnnounceRankPicker = el('turn-announce-rank-picker');
  const turnAnnounceRankSelect = el('turn-announce-rank');
  const turnSelectionGrid = el('turn-selection-grid');
  const turnSelectedCount = el('turn-selected-count');
  const turnNeedCount = el('turn-need-count');
  const btnTurnPlay = el('btn-turn-play');
  const btnAutofill = el('btn-autofill');
  const btnClearSel = el('btn-clear-selection');
  const countMatching = el('count-matching');
  const countNonMatching = el('count-nonmatching');

  function promptTurn() {
    hide(leadControls);
    show(turnControls);
  const need = state.requirement; // requirement is the needed count
    turnRequirementLabel.textContent = String(need);
    turnNeedCount.textContent = String(need);
    // Pré-sélectionner l'annonce avec la figure actuelle
    turnAnnounceRankSelect.value = state.roundRank || 'Roi';
    renderTurnSelection(need);
    updateActionHints(`Sélectionnez ${need} carte(s) et votre annonce. Jokers autorisés. Pas de passe.`);
  }

  function renderTurnSelection(need) {
    const p = state.players[state.currentPlayerIdx];
    turnSelectionGrid.innerHTML = '';
    let selected = new Set();
    const getAnnounced = () => (typeof turnAnnounceRankSelect !== 'undefined' && turnAnnounceRankSelect) ? turnAnnounceRankSelect.value : (state.roundRank || 'Roi');
    const updateCounters = () => {
      const announced = getAnnounced();
      let match = 0;
      let non = 0;
      selected.forEach(i => {
        const c = p.hand[i];
        if (c.rank === announced || c.rank === JOKER) match++; else non++;
      });
      if (countMatching) countMatching.textContent = String(match);
      if (countNonMatching) countNonMatching.textContent = String(non);
      turnSelectedCount.textContent = String(selected.size);
      btnTurnPlay.disabled = selected.size !== need;
    };
    p.hand.forEach((c, i) => {
      const cEl = renderCard(c);
      cEl.addEventListener('click', () => {
        if (selected.has(i)) { selected.delete(i); cEl.classList.remove('selected'); }
        else if (selected.size < need) { selected.add(i); cEl.classList.add('selected'); }
        updateCounters();
      });
      turnSelectionGrid.appendChild(cEl);
    });

    if (btnAutofill) {
      btnAutofill.onclick = () => {
        selected.clear();
        turnSelectionGrid.querySelectorAll('.card').forEach(n => n.classList.remove('selected'));
        const announced = getAnnounced();
        for (let i = 0; i < p.hand.length && selected.size < need; i++) {
          if (p.hand[i].rank === announced) {
            selected.add(i);
            turnSelectionGrid.children[i].classList.add('selected');
          }
        }
        for (let i = 0; i < p.hand.length && selected.size < need; i++) {
          if (p.hand[i].rank === JOKER) {
            selected.add(i);
            turnSelectionGrid.children[i].classList.add('selected');
          }
        }
        updateCounters();
      };
    }
    if (btnClearSel) {
      btnClearSel.onclick = () => {
        selected.clear();
        turnSelectionGrid.querySelectorAll('.card').forEach(n => n.classList.remove('selected'));
        updateCounters();
      };
    }
    if (typeof turnAnnounceRankSelect !== 'undefined' && turnAnnounceRankSelect) {
      turnAnnounceRankSelect.onchange = () => updateCounters();
    }

    updateCounters();

    btnTurnPlay.onclick = () => {
      if (selected.size !== need) return;
      const idxs = Array.from(selected).sort((a,b)=>b-a);
      const cards = idxs.map(i => p.hand.splice(i, 1)[0]);
  // Face cachée: on les ajoute à la pile
  const announced = turnAnnounceRankSelect.value;
  state.roundRank = announced; // la figure courante suit la dernière annonce
  state.pile.push(...cards);
  state.lastPlay = { playerId: p.id, count: need, rank: announced, cards, visibleFirst: null };
      // Prepare next needed count
      state.requirement = need + 1;
      // Set current to next player to allow only-next accusation
      state.currentPlayerIdx = (state.currentPlayerIdx + 1) % state.players.length;
      renderEverything();
      openAccusePrompt();
    };
  }

  function advanceAfterNoAccuse() {
    // After letting pass, check immediate victory (poseur précédent peut avoir vidé sa main)
    const winners = state.players.filter(p => p.hand.length === 0);
    if (winners.length > 0) {
      winnerName.textContent = winners[0].name;
      overlay.classList.remove('hidden');
      winnerModal.classList.remove('hidden');
      return;
    }
    // Current player remains the next player; requirement already set for them
    openPassTo(state.currentPlayerIdx);
  }

  // After accusation resolution, next leader starts with a lead
  // handled in checkForWinnerOrContinue -> openPassTo

  // On modal close after pass, we prompt either lead or turn depending on state.isRoundOpen

  // Initialize screen to start
})();
