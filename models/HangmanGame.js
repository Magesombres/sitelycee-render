const mongoose = require('mongoose');

const hangmanGameSchema = new mongoose.Schema({
  roomCode: { 
    type: String, 
    required: true,
    unique: true,
    uppercase: true
  },
  
  mode: { 
    type: String, 
    enum: ['normal', 'multiplayer', 'openRoom', 'chrono', 'survival', 'duel'],
    required: true 
  },
  
  // Joueurs participant
  players: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String, required: true },
    socketId: { type: String },
    score: { type: Number, default: 0 },
    isReady: { type: Boolean, default: false },
    lives: { type: Number, default: 6 }
  }],
  
  // État de la partie
  status: { 
    type: String, 
    enum: ['waiting', 'playing', 'finished'],
    default: 'waiting'
  },
  
  // Mot actuel
  currentWord: {
    wordId: { type: mongoose.Schema.Types.ObjectId, ref: 'HangmanWord' },
    word: { type: String, uppercase: true },
    hint: { type: String },
    category: { type: String }
  },
  
  // Progression
  guessedLetters: [{ type: String, uppercase: true }],
  wrongGuesses: [{ type: String, uppercase: true }],
  livesRemaining: { type: Number, default: 6 },
  
  // Pour mode multiplayer/duel
  currentTurn: { type: Number, default: 0 }, // index du joueur
  turnHistory: [{
    playerId: { type: String },
    letter: { type: String },
    correct: { type: Boolean },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Pour mode chrono
  timeLimit: { type: Number }, // en secondes
  startTime: { type: Date },
  endTime: { type: Date },
  
  // Pour mode survival
  wordsCompleted: { type: Number, default: 0 },
  survivalLives: { type: Number, default: 10 }, // pool de vies partagé
  
  // Résultat
  winner: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String },
    score: { type: Number }
  },
  
  // Métadonnées
  isPublic: { type: Boolean, default: false },
  maxPlayers: { type: Number, default: 4 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
}, { timestamps: true });

// Index pour recherche rapide
hangmanGameSchema.index({ roomCode: 1 });
hangmanGameSchema.index({ status: 1, mode: 1 });
hangmanGameSchema.index({ isPublic: 1, status: 1 });

module.exports = mongoose.model('HangmanGame', hangmanGameSchema);
