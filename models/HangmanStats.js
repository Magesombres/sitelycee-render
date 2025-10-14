const mongoose = require('mongoose');

const hangmanStatsSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true 
  },
  username: { 
    type: String, 
    required: true 
  },
  
  // Statistiques par mode de jeu
  normal: {
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    totalGuesses: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 }
  },
  
  chrono: {
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    bestTime: { type: Number, default: null }, // en secondes
    totalScore: { type: Number, default: 0 },
    averageTime: { type: Number, default: 0 }
  },
  
  survival: {
    gamesPlayed: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 }, // nombre de mots consécutifs
    totalWords: { type: Number, default: 0 },
    averageLives: { type: Number, default: 0 }
  },
  
  duel: {
    elo: { type: Number, default: 1200 },
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 }
  },
  
  openRoom: {
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    podiums: { type: Number, default: 0 } // top 3
  },
  
  multiplayer: {
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    roomsCreated: { type: Number, default: 0 }
  },
  
  // Achievements débloqués
  achievements: [{ type: String }],
  
  // Paramètres personnalisés
  settings: {
    theme: { type: String, default: 'dark' }, // dark/light/chalkboard/neon/custom
    colors: {
      background: { type: String, default: '#1a1a2e' },
      text: { type: String, default: '#eaeaea' },
      primary: { type: String, default: '#0f3460' },
      secondary: { type: String, default: '#16213e' },
      accent: { type: String, default: '#e94560' },
      correct: { type: String, default: '#2ecc71' },
      wrong: { type: String, default: '#e74c3c' }
    },
    displayMode: { type: String, default: 'classic' }, // classic/modern/minimal
    animations: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true },
    musicEnabled: { type: Boolean, default: false },
    volume: { type: Number, default: 0.7 },
    showUsedLetters: { type: Boolean, default: true },
    autoHint: { type: Boolean, default: false },
    confirmQuit: { type: Boolean, default: true }
  }
  
}, { timestamps: true });

// Index pour les leaderboards
hangmanStatsSchema.index({ 'duel.elo': -1 });
hangmanStatsSchema.index({ 'survival.bestStreak': -1 });
hangmanStatsSchema.index({ 'chrono.bestTime': 1 });

module.exports = mongoose.model('HangmanStats', hangmanStatsSchema);
