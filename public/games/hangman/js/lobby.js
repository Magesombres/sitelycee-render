// Lobby JavaScript - Hangman Game

const API_BASE = window.location.origin;
const token = localStorage.getItem('token');

// State
let stats = null;
let settings = null;

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadMiniLeaderboard();
  setupEventListeners();
  applySettings();
});

// Setup Event Listeners
function setupEventListeners() {
  // Mode selection
  document.querySelectorAll('.btn-play').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.target.dataset.mode;
      handleModeSelection(mode);
    });
  });

  // Navbar buttons
  document.getElementById('btn-stats').addEventListener('click', showStatsModal);
  document.getElementById('btn-leaderboard').addEventListener('click', showLeaderboardModal);
  document.getElementById('btn-settings').addEventListener('click', showSettingsModal);
  document.getElementById('btn-logout').addEventListener('click', () => {
    window.location.href = '/';
  });

  // Modal close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal').classList.add('hidden');
    });
  });

  // Settings
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
  document.getElementById('setting-volume').addEventListener('input', (e) => {
    document.getElementById('volume-value').textContent = e.target.value + '%';
  });

  // Leaderboard tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      loadLeaderboard(e.target.dataset.mode);
    });
  });
}

// Load user stats
async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/hangman/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        alert('Session expirée. Veuillez vous reconnecter.');
        window.location.href = '/';
        return;
      }
      throw new Error('Erreur chargement stats');
    }

    stats = await response.json();
    settings = stats.settings;
    displayQuickStats();
    applySettings();
  } catch (err) {
    console.error('Erreur stats:', err);
    showError('Impossible de charger vos statistiques');
  }
}

// Display quick stats
function displayQuickStats() {
  if (!stats) return;

  // Normal
  const normalWins = stats.normal.wins || 0;
  const normalLosses = stats.normal.losses || 0;
  const normalWinrate = normalWins + normalLosses > 0 
    ? Math.round((normalWins / (normalWins + normalLosses)) * 100) 
    : 0;
  document.getElementById('stat-normal-record').textContent = `${normalWins}W - ${normalLosses}L`;
  document.getElementById('stat-normal-winrate').textContent = `${normalWinrate}%`;

  // Chrono
  const chronoBest = stats.chrono.bestTime 
    ? `${stats.chrono.bestTime.toFixed(1)}s` 
    : '--';
  document.getElementById('stat-chrono-best').textContent = chronoBest;

  // Survival
  document.getElementById('stat-survival-streak').textContent = stats.survival.bestStreak || 0;

  // Duel ELO
  document.getElementById('stat-duel-elo').textContent = stats.duel.elo || 1200;
  document.getElementById('stat-duel-rank').textContent = '#--'; // TODO: calculer le rang
}

// Load mini leaderboard
async function loadMiniLeaderboard() {
  try {
    const response = await fetch(`${API_BASE}/hangman/leaderboard/duel`);
    const leaderboard = await response.json();

    const container = document.getElementById('mini-leaderboard');
    container.innerHTML = '';

    leaderboard.slice(0, 5).forEach((entry, index) => {
      const item = document.createElement('div');
      item.className = 'leaderboard-item';
      
      const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
      
      item.innerHTML = `
        <span class="leaderboard-rank ${rankClass}">#${index + 1}</span>
        <span class="leaderboard-name">${entry.username}</span>
        <span class="leaderboard-score">${entry.duel.elo}</span>
      `;
      container.appendChild(item);
    });
  } catch (err) {
    console.error('Erreur leaderboard:', err);
  }
}

// Handle mode selection
function handleModeSelection(mode) {
  if (!token) {
    alert('Vous devez être connecté pour jouer');
    window.location.href = '/';
    return;
  }

  switch (mode) {
    case 'normal':
    case 'chrono':
    case 'survival':
      startSoloGame(mode);
      break;
    case 'multiplayer':
      showJoinModal(true); // Create room
      break;
    case 'openRoom':
      joinOpenRoom();
      break;
    case 'duel':
      findDuelMatch();
      break;
  }
}

// Start solo game
async function startSoloGame(mode) {
  try {
    const response = await fetch(`${API_BASE}/hangman/game/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ mode, difficulty: 'moyen' })
    });

    if (!response.ok) throw new Error('Erreur démarrage partie');

    const game = await response.json();
    
    // Redirect to game page with room code
    window.location.href = `./game.html?room=${game.roomCode}&mode=${mode}`;
  } catch (err) {
    console.error('Erreur démarrage:', err);
    showError('Impossible de démarrer la partie');
  }
}

// Show join modal
function showJoinModal(isCreate = false) {
  const modal = document.getElementById('modal-join');
  modal.classList.remove('hidden');

  if (isCreate) {
    // TODO: Create multiplayer room via Socket.IO
    // For now, redirect to game page
    alert('Création de room multiplayer - À implémenter');
  }
}

// Join open room
function joinOpenRoom() {
  // TODO: Implement open room matchmaking
  alert('Open Room - À implémenter');
}

// Find duel match
function findDuelMatch() {
  // TODO: Implement duel matchmaking
  alert('Duel matchmaking - À implémenter');
}

// Show stats modal
function showStatsModal() {
  const modal = document.getElementById('modal-stats');
  const content = document.getElementById('stats-content');
  
  if (!stats) {
    content.innerHTML = '<div class="loading">Chargement...</div>';
    modal.classList.remove('hidden');
    return;
  }

  content.innerHTML = `
    <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); gap: 1rem;">
      <div class="stat-card">
        <div class="stat-label">Mode Normal</div>
        <div class="stat-value">${stats.normal.wins}W - ${stats.normal.losses}L</div>
        <div class="stat-detail">Meilleur streak: ${stats.normal.bestStreak}</div>
        <div class="stat-detail">Parties: ${stats.normal.gamesPlayed}</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Mode Chrono</div>
        <div class="stat-value">${stats.chrono.bestTime ? stats.chrono.bestTime.toFixed(1) + 's' : '--'}</div>
        <div class="stat-detail">Victoires: ${stats.chrono.wins}</div>
        <div class="stat-detail">Parties: ${stats.chrono.gamesPlayed}</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Mode Survie</div>
        <div class="stat-value">${stats.survival.bestStreak}</div>
        <div class="stat-detail">Mots totaux: ${stats.survival.totalWords}</div>
        <div class="stat-detail">Parties: ${stats.survival.gamesPlayed}</div>
      </div>
      
      <div class="stat-card highlight">
        <div class="stat-label">Mode Duel</div>
        <div class="stat-value">${stats.duel.elo}</div>
        <div class="stat-detail">${stats.duel.wins}W - ${stats.duel.losses}L - ${stats.duel.draws}D</div>
        <div class="stat-detail">Parties: ${stats.duel.gamesPlayed}</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Open Room</div>
        <div class="stat-value">${stats.openRoom.wins}</div>
        <div class="stat-detail">Podiums: ${stats.openRoom.podiums}</div>
        <div class="stat-detail">Parties: ${stats.openRoom.gamesPlayed}</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-label">Multiplayer</div>
        <div class="stat-value">${stats.multiplayer.wins}</div>
        <div class="stat-detail">Rooms créées: ${stats.multiplayer.roomsCreated}</div>
        <div class="stat-detail">Parties: ${stats.multiplayer.gamesPlayed}</div>
      </div>
    </div>
  `;
  
  modal.classList.remove('hidden');
}

// Show leaderboard modal
function showLeaderboardModal() {
  const modal = document.getElementById('modal-leaderboard');
  modal.classList.remove('hidden');
  loadLeaderboard('duel');
}

// Load leaderboard
async function loadLeaderboard(mode) {
  const content = document.getElementById('leaderboard-content');
  content.innerHTML = '<div class="loading">Chargement...</div>';

  try {
    const response = await fetch(`${API_BASE}/hangman/leaderboard/${mode}`);
    const leaderboard = await response.json();

    if (leaderboard.length === 0) {
      content.innerHTML = '<div class="loading">Aucune donnée disponible</div>';
      return;
    }

    content.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'leaderboard-list';

    leaderboard.forEach((entry, index) => {
      const item = document.createElement('div');
      item.className = 'leaderboard-item';
      
      const rankClass = index === 0 ? 'top-1' : index === 1 ? 'top-2' : index === 2 ? 'top-3' : '';
      
      let scoreValue;
      switch (mode) {
        case 'duel':
          scoreValue = entry.duel.elo;
          break;
        case 'survival':
          scoreValue = `${entry.survival.bestStreak} mots`;
          break;
        case 'chrono':
          scoreValue = entry.chrono.bestTime ? `${entry.chrono.bestTime.toFixed(1)}s` : '--';
          break;
        case 'normal':
          scoreValue = `${entry.normal.wins} victoires`;
          break;
        case 'openRoom':
          scoreValue = `${entry.openRoom.wins} victoires`;
          break;
      }
      
      item.innerHTML = `
        <span class="leaderboard-rank ${rankClass}">#${index + 1}</span>
        <span class="leaderboard-name">${entry.username}</span>
        <span class="leaderboard-score">${scoreValue}</span>
      `;
      list.appendChild(item);
    });

    content.appendChild(list);
  } catch (err) {
    console.error('Erreur leaderboard:', err);
    content.innerHTML = '<div class="loading">Erreur de chargement</div>';
  }
}

// Show settings modal
function showSettingsModal() {
  const modal = document.getElementById('modal-settings');
  
  if (settings) {
    document.getElementById('setting-theme').value = settings.theme;
    document.getElementById('setting-display').value = settings.displayMode;
    document.getElementById('setting-animations').checked = settings.animations;
    document.getElementById('setting-sound').checked = settings.soundEnabled;
    document.getElementById('setting-music').checked = settings.musicEnabled;
    document.getElementById('setting-volume').value = Math.round(settings.volume * 100);
    document.getElementById('volume-value').textContent = Math.round(settings.volume * 100) + '%';
    document.getElementById('setting-show-used').checked = settings.showUsedLetters;
    document.getElementById('setting-auto-hint').checked = settings.autoHint;
    document.getElementById('setting-confirm-quit').checked = settings.confirmQuit;
  }
  
  modal.classList.remove('hidden');
}

// Save settings
async function saveSettings() {
  const newSettings = {
    theme: document.getElementById('setting-theme').value,
    displayMode: document.getElementById('setting-display').value,
    animations: document.getElementById('setting-animations').checked,
    soundEnabled: document.getElementById('setting-sound').checked,
    musicEnabled: document.getElementById('setting-music').checked,
    volume: parseInt(document.getElementById('setting-volume').value) / 100,
    showUsedLetters: document.getElementById('setting-show-used').checked,
    autoHint: document.getElementById('setting-auto-hint').checked,
    confirmQuit: document.getElementById('setting-confirm-quit').checked
  };

  try {
    const response = await fetch(`${API_BASE}/hangman/stats/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newSettings)
    });

    if (!response.ok) throw new Error('Erreur sauvegarde');

    const data = await response.json();
    settings = data.settings;
    applySettings();
    
    document.getElementById('modal-settings').classList.add('hidden');
    showSuccess('Paramètres sauvegardés !');
  } catch (err) {
    console.error('Erreur settings:', err);
    showError('Impossible de sauvegarder les paramètres');
  }
}

// Apply settings to UI
function applySettings() {
  if (!settings) return;

  document.body.setAttribute('data-theme', settings.theme);
  document.body.setAttribute('data-display', settings.displayMode);
  document.body.setAttribute('data-animations', settings.animations);
}

// Utility functions
function showError(message) {
  alert('❌ ' + message);
}

function showSuccess(message) {
  alert('✅ ' + message);
}
