// Game JavaScript - Hangman Game

const API_BASE = window.location.origin;
const token = localStorage.getItem('token');

// Get URL params
const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room');
const mode = urlParams.get('mode');

// State
let gameState = {
  word: '',
  revealedWord: '',
  category: '',
  hint: '',
  guessedLetters: [],
  wrongGuesses: [],
  livesRemaining: 6,
  gameOver: false,
  won: false,
  players: [],
  currentTurn: '',
  timeLimit: null,
  startTime: null
};

let settings = null;
let socket = null;
let timerInterval = null;

// Init
document.addEventListener('DOMContentLoaded', () => {
  if (!token || !roomCode) {
    alert('Paramètres invalides');
    window.location.href = './index.html';
    return;
  }

  loadSettings();
  setupEventListeners();
  createKeyboard();
  connectSocket();
  
  // Display mode
  document.getElementById('mode-display').textContent = getModeLabel(mode);
});

// Load settings
async function loadSettings() {
  try {
    const response = await fetch(`${API_BASE}/hangman/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
      const stats = await response.json();
      settings = stats.settings;
      applySettings();
    }
  } catch (err) {
    console.error('Erreur settings:', err);
  }
}

// Apply settings
function applySettings() {
  if (!settings) return;
  document.body.setAttribute('data-theme', settings.theme);
  document.body.setAttribute('data-display', settings.displayMode);
  document.body.setAttribute('data-animations', settings.animations);
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('btn-hint').addEventListener('click', showHint);
  document.getElementById('btn-chat').addEventListener('click', toggleChat);
  document.getElementById('btn-quit').addEventListener('click', quitGame);
  document.getElementById('btn-play-again').addEventListener('click', playAgain);
  document.getElementById('btn-back-lobby').addEventListener('click', () => {
    window.location.href = './index.html';
  });
  
  // Chat
  document.getElementById('btn-close-chat').addEventListener('click', toggleChat);
  document.getElementById('btn-send-chat').addEventListener('click', sendChatMessage);
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  // Keyboard events
  document.addEventListener('keypress', (e) => {
    const letter = e.key.toUpperCase();
    if (/^[A-Z]$/.test(letter) && !gameState.gameOver) {
      guessLetter(letter);
    }
  });
}

// Create keyboard
function createKeyboard() {
  const keyboard = document.getElementById('keyboard');
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  
  letters.forEach(letter => {
    const key = document.createElement('button');
    key.className = 'key';
    key.textContent = letter;
    key.dataset.letter = letter;
    key.addEventListener('click', () => guessLetter(letter));
    keyboard.appendChild(key);
  });
}

// Connect to Socket.IO
function connectSocket() {
  socket = io('/hangman');

  socket.on('connect', () => {
    console.log('[Hangman] Connecté au serveur');
    
    // Si solo game, on a déjà le room code de l'API
    if (['normal', 'chrono', 'survival'].includes(mode)) {
      loadGameState();
    }
  });

  socket.on('gameStarted', (data) => {
    console.log('[Hangman] Partie démarrée', data);
    gameState.word = '_'.repeat(data.wordLength);
    gameState.revealedWord = data.revealedWord;
    gameState.category = data.category;
    gameState.hint = data.hint;
    gameState.livesRemaining = data.lives;
    gameState.timeLimit = data.timeLimit;
    gameState.startTime = Date.now();
    
    updateUI();
    
    if (data.timeLimit) {
      startTimer(data.timeLimit);
    }
  });

  socket.on('letterGuessed', (data) => {
    console.log('[Hangman] Lettre jouée', data);
    
    gameState.revealedWord = data.revealedWord;
    gameState.guessedLetters = data.guessedLetters;
    gameState.wrongGuesses = data.wrongGuesses;
    gameState.livesRemaining = data.livesRemaining;
    gameState.currentTurn = data.currentTurn;
    
    updateKeyboard(data.letter, data.correct);
    updateUI();
    
    if (data.gameOver) {
      handleGameOver(data.won, data.word);
    }
    
    playSound(data.correct ? 'correct' : 'wrong');
  });

  socket.on('playerJoined', (data) => {
    console.log('[Hangman] Joueur rejoint', data);
    gameState.players = data.players;
    updatePlayers();
    showChatMessage('system', `${data.player} a rejoint la partie`);
  });

  socket.on('playerLeft', (data) => {
    console.log('[Hangman] Joueur parti', data);
    gameState.players = data.players;
    gameState.currentTurn = data.currentTurn;
    updatePlayers();
    showChatMessage('system', `${data.player} a quitté la partie`);
  });

  socket.on('playerReady', (data) => {
    console.log('[Hangman] Joueur prêt', data);
    gameState.players = data.players;
    updatePlayers();
  });

  socket.on('chatMessage', (data) => {
    showChatMessage(data.player, data.message);
  });

  socket.on('newWord', (data) => {
    console.log('[Hangman] Nouveau mot (survie)', data);
    gameState.word = '_'.repeat(data.wordLength);
    gameState.revealedWord = data.revealedWord;
    gameState.category = data.category;
    gameState.hint = data.hint;
    gameState.guessedLetters = [];
    gameState.wrongGuesses = [];
    
    resetKeyboard();
    updateUI();
    
    document.getElementById('streak-display').textContent = data.wordsCompleted;
    playSound('success');
  });

  socket.on('error', (data) => {
    console.error('[Hangman] Erreur:', data.message);
    showError(data.message);
  });

  socket.on('disconnect', () => {
    console.log('[Hangman] Déconnecté');
    showError('Déconnecté du serveur');
  });
}

// Load game state (solo modes)
async function loadGameState() {
  // For solo modes, load the game data from sessionStorage
  try {
    const gameDataStr = sessionStorage.getItem('hangmanGameData');
    if (!gameDataStr) {
      throw new Error('Données de partie manquantes');
    }
    
    const gameData = JSON.parse(gameDataStr);
    sessionStorage.removeItem('hangmanGameData'); // Clean up
    
    // Initialize game state with data from API
    gameState.word = '_'.repeat(gameData.wordLength);
    gameState.revealedWord = '_'.repeat(gameData.wordLength);
    gameState.category = gameData.category;
    gameState.hint = gameData.hint;
    gameState.livesRemaining = gameData.lives;
    gameState.timeLimit = gameData.timeLimit;
    gameState.startTime = Date.now();
    gameState.mode = mode;
    
    updateUI();
    
    // Start timer for chrono mode
    if (gameData.timeLimit) {
      startTimer(gameData.timeLimit);
    }
    
  } catch (err) {
    console.error('Erreur chargement:', err);
    showError('Impossible de charger la partie');
    setTimeout(() => {
      window.location.href = './index.html';
    }, 2000);
  }
}

// Guess letter
async function guessLetter(letter) {
  if (gameState.gameOver) return;
  if (gameState.guessedLetters.includes(letter) || gameState.wrongGuesses.includes(letter)) {
    return; // Déjà jouée
  }

  // Solo mode: call API
  if (['normal', 'chrono', 'survival'].includes(mode)) {
    try {
      const response = await fetch(`${API_BASE}/hangman/game/guess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roomCode, letter })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur');
      }

      const data = await response.json();
      
      gameState.revealedWord = data.revealedWord;
      gameState.guessedLetters = data.guessedLetters;
      gameState.wrongGuesses = data.wrongGuesses;
      gameState.livesRemaining = data.livesRemaining;
      
      updateKeyboard(letter, data.correct);
      updateUI();
      
      // Mode Survival: nouveau mot
      if (data.newWord && !data.gameOver) {
        showMessage(`Mot trouvé ! Mots complétés : ${data.wordsCompleted}`);
        setTimeout(() => {
          // Réinitialiser pour le nouveau mot
          gameState.word = '_'.repeat(data.newWord.wordLength);
          gameState.revealedWord = '_'.repeat(data.newWord.wordLength);
          gameState.category = data.newWord.category;
          gameState.hint = data.newWord.hint;
          gameState.guessedLetters = [];
          gameState.wrongGuesses = [];
          resetKeyboard();
          updateUI();
        }, 2000);
      } else if (data.gameOver) {
        handleGameOver(data.won, data.word);
      }
      
      playSound(data.correct ? 'correct' : 'wrong');
      
    } catch (err) {
      console.error('Erreur guess:', err);
      showError(err.message);
    }
  } 
  // Multiplayer: emit via Socket.IO
  else {
    socket.emit('guessLetter', { roomCode, letter });
  }
}

// Update keyboard
function updateKeyboard(letter, isCorrect) {
  const key = document.querySelector(`.key[data-letter="${letter}"]`);
  if (!key) return;
  
  key.classList.add(isCorrect ? 'correct' : 'wrong');
  key.classList.add('disabled');
}

// Reset keyboard
function resetKeyboard() {
  document.querySelectorAll('.key').forEach(key => {
    key.classList.remove('correct', 'wrong', 'disabled');
  });
}

// Update UI
function updateUI() {
  // Lives (prevent negative values)
  const livesLeft = Math.max(0, gameState.livesRemaining);
  const maxLives = gameState.mode === 'survival' ? 1 : 6;
  const hearts = '❤️'.repeat(livesLeft) + '🖤'.repeat(Math.max(0, maxLives - livesLeft));
  document.getElementById('lives-display').innerHTML = hearts;
  
  // Word
  displayWord();
  
  // Category
  document.getElementById('category-display').textContent = `Catégorie: ${gameState.category || '--'}`;
  
  // Hangman drawing
  updateHangman();
  
  // Used letters
  if (settings?.showUsedLetters) {
    const usedLetters = document.getElementById('used-letters');
    usedLetters.classList.remove('hidden');
    const usedList = document.getElementById('used-list');
    usedList.innerHTML = '';
    [...gameState.guessedLetters, ...gameState.wrongGuesses].forEach(letter => {
      const span = document.createElement('span');
      span.textContent = letter;
      usedList.appendChild(span);
    });
  }
  
  // Auto hint
  if (settings?.autoHint && gameState.wrongGuesses.length >= 3 && gameState.hint) {
    showHint();
  }
}

// Display word
function displayWord() {
  const container = document.getElementById('word-display');
  container.innerHTML = '';
  
  const letters = gameState.revealedWord.split('');
  letters.forEach((letter, index) => {
    const span = document.createElement('span');
    span.className = 'letter';
    if (letter !== '_') {
      span.classList.add('revealed');
    }
    span.textContent = letter === '_' ? '_' : letter;
    container.appendChild(span);
  });
}

// Update hangman drawing
function updateHangman() {
  const wrongCount = gameState.wrongGuesses.length;
  const parts = ['part-head', 'part-body', 'part-left-arm', 'part-right-arm', 'part-left-leg', 'part-right-leg'];
  
  parts.forEach((id, index) => {
    const part = document.getElementById(id);
    if (part) {
      if (index < wrongCount) {
        part.classList.remove('hidden');
      } else {
        part.classList.add('hidden');
      }
    }
  });
}

// Show hint
function showHint() {
  if (!gameState.hint) return;
  const hintEl = document.getElementById('hint-display');
  hintEl.textContent = `💡 ${gameState.hint}`;
  hintEl.classList.remove('hidden');
}

// Start timer (chrono mode)
function startTimer(seconds) {
  document.getElementById('timer-container').classList.remove('hidden');
  let remaining = seconds;
  
  timerInterval = setInterval(() => {
    remaining--;
    document.getElementById('timer-display').textContent = `${remaining}s`;
    
    if (remaining <= 0) {
      clearInterval(timerInterval);
      handleGameOver(false, gameState.word);
    }
  }, 1000);
}

// Handle game over
function handleGameOver(won, word) {
  gameState.gameOver = true;
  gameState.won = won;
  gameState.word = word;
  
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  const modal = document.getElementById('modal-game-over');
  const title = document.getElementById('game-over-title');
  const message = document.getElementById('result-message');
  const wordEl = document.getElementById('result-word');
  
  if (won) {
    title.textContent = '🎉 Victoire!';
    message.textContent = 'Félicitations!';
    playSound('win');
  } else {
    title.textContent = '💀 Perdu!';
    message.textContent = 'Dommage...';
    playSound('lose');
  }
  
  wordEl.textContent = word;
  
  // Stats
  const stats = document.getElementById('result-stats');
  const totalGuesses = gameState.guessedLetters.length + gameState.wrongGuesses.length;
  const timeTaken = gameState.startTime ? Math.round((Date.now() - gameState.startTime) / 1000) : 0;
  
  stats.innerHTML = `
    <div>
      <span>Lettres proposées:</span>
      <span>${totalGuesses}</span>
    </div>
    <div>
      <span>Erreurs:</span>
      <span>${gameState.wrongGuesses.length}</span>
    </div>
    ${timeTaken > 0 ? `
      <div>
        <span>Temps:</span>
        <span>${timeTaken}s</span>
      </div>
    ` : ''}
  `;
  
  modal.classList.remove('hidden');
}

// Play again
function playAgain() {
  window.location.href = `./index.html`;
}

// Quit game
function quitGame() {
  if (settings?.confirmQuit && !gameState.gameOver) {
    if (!confirm('Êtes-vous sûr de vouloir quitter la partie ?')) {
      return;
    }
  }
  
  if (socket) {
    socket.emit('leaveRoom', { roomCode });
    socket.disconnect();
  }
  
  window.location.href = './index.html';
}

// Toggle chat
function toggleChat() {
  const chat = document.getElementById('chat-panel');
  chat.classList.toggle('hidden');
}

// Send chat message
function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  
  if (!message) return;
  
  socket.emit('chat', { roomCode, message });
  input.value = '';
}

// Show chat message
function showChatMessage(player, message) {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-message';
  
  if (player === 'system') {
    div.innerHTML = `<em style="color: var(--text-secondary);">${message}</em>`;
  } else {
    div.innerHTML = `<strong>${player}:</strong> ${message}`;
  }
  
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// Update players list (multiplayer)
function updatePlayers() {
  if (gameState.players.length === 0) return;
  
  document.getElementById('players-panel').classList.remove('hidden');
  document.getElementById('btn-chat').classList.remove('hidden');
  
  const list = document.getElementById('players-list');
  list.innerHTML = '';
  
  gameState.players.forEach(player => {
    const div = document.createElement('div');
    div.className = 'player-item';
    if (player.username === gameState.currentTurn) {
      div.classList.add('active');
    }
    div.innerHTML = `
      <span class="player-name">${player.username}</span>
      <span class="player-score">${player.score || 0}</span>
    `;
    list.appendChild(div);
  });
  
  if (gameState.currentTurn) {
    document.getElementById('turn-indicator').classList.remove('hidden');
    document.getElementById('current-turn').textContent = gameState.currentTurn;
  }
}

// Get mode label
function getModeLabel(mode) {
  const labels = {
    'normal': 'Normal',
    'chrono': 'Chrono',
    'survival': 'Survie',
    'multiplayer': 'Multiplayer',
    'openRoom': 'Open Room',
    'duel': 'Duel'
  };
  return labels[mode] || mode;
}

// Play sound
function playSound(type) {
  if (!settings?.soundEnabled) return;
  
  // TODO: Implement sounds
  // const audio = new Audio(`./assets/sounds/${type}.mp3`);
  // audio.volume = settings.volume;
  // audio.play();
}

// Show error
function showError(message) {
  // TODO: Better error display
  console.error(message);
}

function showMessage(message) {
  // TODO: Better message display
  console.log('[INFO]', message);
  // Could create a toast notification here
}
