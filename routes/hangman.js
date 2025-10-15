const express = require('express');
const { z } = require('zod');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const HangmanStats = require('../models/HangmanStats');
const HangmanWord = require('../models/HangmanWord');
const HangmanGame = require('../models/HangmanGame');

const router = express.Router();

// GET /hangman/stats - Récupérer les stats de l'utilisateur connecté
router.get('/stats', authMiddleware, async (req, res, next) => {
  try {
    let stats = await HangmanStats.findOne({ userId: req.user.id });
    
    // Créer les stats si elles n'existent pas
    if (!stats) {
      stats = await HangmanStats.create({
        userId: req.user.id,
        username: req.user.username
      });
    }
    
    res.json(stats);
  } catch (e) { next(e); }
});

// GET /hangman/stats/:userId - Récupérer les stats d'un utilisateur spécifique
router.get('/stats/:userId', async (req, res, next) => {
  try {
    const stats = await HangmanStats.findOne({ userId: req.params.userId });
    if (!stats) return res.status(404).json({ error: 'Statistiques introuvables' });
    res.json(stats);
  } catch (e) { next(e); }
});

// PUT /hangman/stats/settings - Mettre à jour les paramètres
const updateSettingsSchema = z.object({
  theme: z.string().optional(),
  colors: z.object({
    background: z.string().optional(),
    text: z.string().optional(),
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
    correct: z.string().optional(),
    wrong: z.string().optional()
  }).optional(),
  displayMode: z.string().optional(),
  animations: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  musicEnabled: z.boolean().optional(),
  volume: z.number().min(0).max(1).optional(),
  showUsedLetters: z.boolean().optional(),
  autoHint: z.boolean().optional(),
  confirmQuit: z.boolean().optional()
});

router.put('/stats/settings', authMiddleware, validate(updateSettingsSchema), async (req, res, next) => {
  try {
    let stats = await HangmanStats.findOne({ userId: req.user.id });
    
    if (!stats) {
      stats = await HangmanStats.create({
        userId: req.user.id,
        username: req.user.username,
        settings: req.body
      });
    } else {
      stats.settings = { ...stats.settings.toObject(), ...req.body };
      await stats.save();
    }
    
    res.json({ settings: stats.settings });
  } catch (e) { next(e); }
});

// GET /hangman/leaderboard/:mode - Top 100 du classement par mode
router.get('/leaderboard/:mode', async (req, res, next) => {
  try {
    const { mode } = req.params;
    let sortField, limit = 100;
    
    switch(mode) {
      case 'duel':
        sortField = { 'duel.elo': -1 };
        break;
      case 'survival':
        sortField = { 'survival.bestStreak': -1 };
        break;
      case 'chrono':
        sortField = { 'chrono.bestTime': 1 }; // Meilleur temps = plus petit
        break;
      case 'normal':
        sortField = { 'normal.wins': -1 };
        break;
      case 'openRoom':
        sortField = { 'openRoom.wins': -1 };
        break;
      default:
        return res.status(400).json({ error: 'Mode invalide' });
    }
    
    const leaderboard = await HangmanStats.find()
      .sort(sortField)
      .limit(limit)
      .select(`username ${mode}`)
      .lean();
    
    res.json(leaderboard);
  } catch (e) { next(e); }
});

// POST /hangman/game/start - Démarrer une partie solo
const startGameSchema = z.object({
  mode: z.enum(['normal', 'chrono', 'survival']),
  difficulty: z.enum(['facile', 'moyen', 'difficile']).optional(),
  category: z.string().optional()
});

// Debug middleware to check req.user after authMiddleware
const debugUser = (req, res, next) => {
  console.log('[DEBUG AFTER AUTH] req.user:', req.user ? JSON.stringify(req.user) : 'UNDEFINED');
  next();
};

router.post('/game/start', authMiddleware, debugUser, validate(startGameSchema), async (req, res, next) => {
  // Log IMMEDIATELY at function entry - before ANY other code
  const userAtEntry = req.user;
  console.log('[DEBUG ROUTE ENTRY] req.user at function entry:', userAtEntry ? JSON.stringify(userAtEntry) : 'UNDEFINED');
  console.log('[DEBUG ROUTE ENTRY] req object keys:', Object.keys(req).join(', '));
  
  console.log('[DEBUG ROUTE] POST /hangman/game/start appelée !');
  console.log('[DEBUG ROUTE] req.body:', JSON.stringify(req.body));
  console.log('[DEBUG ROUTE] userAtEntry (captured at line 129):', userAtEntry ? JSON.stringify(userAtEntry) : 'UNDEFINED');
  console.log('[DEBUG ROUTE] req.user (accessing now):', req.user ? JSON.stringify(req.user) : 'UNDEFINED');
  try {
    console.log('[DEBUG ROUTE] Entering try block...');
    const { mode, difficulty = 'moyen', category } = req.body;
    console.log('[DEBUG ROUTE] Destructured body:', { mode, difficulty, category });
    
    // Générer un code de room unique
    const genCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };
    
    let roomCode = genCode();
    while (await HangmanGame.findOne({ roomCode })) {
      roomCode = genCode();
    }
    
    // Trouver un mot aléatoire selon les critères
    const query = { difficulty };
    if (category) query.category = category;
    
    const count = await HangmanWord.countDocuments(query);
    if (count === 0) {
      return res.status(404).json({ error: 'Aucun mot trouvé pour ces critères' });
    }
    
    const random = Math.floor(Math.random() * count);
    const word = await HangmanWord.findOne(query).skip(random);
    
    // Incrémenter le compteur d'utilisation
    word.usageCount += 1;
    await word.save();
    
    // Créer la partie
    const game = await HangmanGame.create({
      roomCode,
      mode,
      players: [{
        userId: userAtEntry.id,  // FIX: Use captured value instead of req.user
        username: userAtEntry.username,
        isReady: true,
        lives: mode === 'survival' ? 10 : 6
      }],
      status: 'playing',
      currentWord: {
        wordId: word._id,
        word: word.word,
        hint: word.hint,
        category: word.category
      },
      livesRemaining: mode === 'survival' ? 10 : 6,
      survivalLives: mode === 'survival' ? 10 : undefined,
      timeLimit: mode === 'chrono' ? 30 : undefined,
      startTime: new Date(),
      createdBy: userAtEntry.id  // FIX: Use captured value instead of req.user
    });
    
    res.json({
      roomCode: game.roomCode,
      mode: game.mode,
      wordLength: word.word.length,
      category: word.category,
      hint: word.hint,
      lives: game.livesRemaining,
      timeLimit: game.timeLimit
    });
    
  } catch (e) {
    console.log('[DEBUG ROUTE ERROR] Erreur dans POST /game/start:', e.message);
    console.log('[DEBUG ROUTE ERROR] Stack:', e.stack);
    next(e);
  }
});

// POST /hangman/game/guess - Proposer une lettre
const guessSchema = z.object({
  roomCode: z.string(),
  letter: z.string().length(1).regex(/^[A-Z]$/i)
});

router.post('/game/guess', authMiddleware, validate(guessSchema), async (req, res, next) => {
  try {
    const { roomCode, letter } = req.body;
    const letterUpper = letter.toUpperCase();
    
    const game = await HangmanGame.findOne({ roomCode });
    if (!game) return res.status(404).json({ error: 'Partie introuvable' });
    if (game.status !== 'playing') return res.status(400).json({ error: 'Partie terminée' });
    
    // Vérifier que le joueur fait partie de la partie
    const player = game.players.find(p => p.userId.toString() === req.user.id);
    if (!player) return res.status(403).json({ error: 'Vous ne participez pas à cette partie' });
    
    // Vérifier si la lettre a déjà été jouée
    if (game.guessedLetters.includes(letterUpper) || game.wrongGuesses.includes(letterUpper)) {
      return res.status(400).json({ error: 'Lettre déjà jouée' });
    }
    
    // Vérifier si la lettre est dans le mot
    const isCorrect = game.currentWord.word.includes(letterUpper);
    
    if (isCorrect) {
      game.guessedLetters.push(letterUpper);
    } else {
      game.wrongGuesses.push(letterUpper);
      game.livesRemaining -= 1;
      if (game.mode === 'survival') {
        game.survivalLives -= 1;
      }
    }
    
    // Vérifier victoire
    const allLettersFound = game.currentWord.word.split('').every(l => 
      game.guessedLetters.includes(l) || l === ' ' || l === '-'
    );
    
    let gameOver = false;
    let won = false;
    
    if (allLettersFound) {
      won = true;
      gameOver = game.mode !== 'survival'; // En survie, on continue avec un nouveau mot
      
      if (game.mode === 'survival') {
        game.wordsCompleted += 1;
        // Charger un nouveau mot
        // (simplifié ici, devrait être géré par Socket.IO pour le temps réel)
      }
    } else if (game.livesRemaining <= 0 || (game.mode === 'survival' && game.survivalLives <= 0)) {
      gameOver = true;
      won = false;
    }
    
    if (gameOver) {
      game.status = 'finished';
      game.endTime = new Date();
      
      if (won) {
        game.winner = {
          userId: player.userId,
          username: player.username,
          score: player.score
        };
      }
      
      // Mettre à jour les stats
      await updatePlayerStats(req.user.id, game, won);
    }
    
    await game.save();
    
    // Obtenir le mot révélé
    const revealedWord = game.currentWord.word.split('').map(l => 
      game.guessedLetters.includes(l) || l === ' ' || l === '-' ? l : '_'
    ).join('');
    
    res.json({
      correct: isCorrect,
      revealedWord,
      guessedLetters: game.guessedLetters,
      wrongGuesses: game.wrongGuesses,
      livesRemaining: game.livesRemaining,
      gameOver,
      won,
      word: gameOver ? game.currentWord.word : undefined
    });
    
    // Broadcast via Socket.IO si multiplayer
    if (['multiplayer', 'openRoom', 'duel'].includes(game.mode)) {
      const io = req.app.get('io');
      io.of('/hangman').to(roomCode).emit('letterGuessed', {
        player: player.username,
        letter: letterUpper,
        correct: isCorrect,
        revealedWord,
        livesRemaining: game.livesRemaining,
        gameOver,
        won
      });
    }
    
  } catch (e) { next(e); }
});

// GET /hangman/rooms - Liste des rooms publiques disponibles
router.get('/rooms', async (req, res, next) => {
  try {
    const rooms = await HangmanGame.find({
      isPublic: true,
      status: 'waiting'
    })
    .select('roomCode mode players maxPlayers createdAt')
    .lean();
    
    res.json(rooms.map(r => ({
      roomCode: r.roomCode,
      mode: r.mode,
      playerCount: r.players.length,
      maxPlayers: r.maxPlayers,
      createdAt: r.createdAt
    })));
  } catch (e) { next(e); }
});

// Fonction helper pour mettre à jour les stats
async function updatePlayerStats(userId, game, won) {
  let stats = await HangmanStats.findOne({ userId });
  if (!stats) return;
  
  const mode = game.mode;
  
  if (mode === 'normal') {
    stats.normal.gamesPlayed += 1;
    if (won) {
      stats.normal.wins += 1;
      stats.normal.currentStreak += 1;
      if (stats.normal.currentStreak > stats.normal.bestStreak) {
        stats.normal.bestStreak = stats.normal.currentStreak;
      }
    } else {
      stats.normal.losses += 1;
      stats.normal.currentStreak = 0;
    }
    stats.normal.totalGuesses += game.guessedLetters.length + game.wrongGuesses.length;
  }
  
  if (mode === 'chrono') {
    stats.chrono.gamesPlayed += 1;
    if (won) {
      stats.chrono.wins += 1;
      const timeTaken = (game.endTime - game.startTime) / 1000;
      if (!stats.chrono.bestTime || timeTaken < stats.chrono.bestTime) {
        stats.chrono.bestTime = timeTaken;
      }
    }
  }
  
  if (mode === 'survival') {
    stats.survival.gamesPlayed += 1;
    stats.survival.totalWords += game.wordsCompleted;
    if (game.wordsCompleted > stats.survival.bestStreak) {
      stats.survival.bestStreak = game.wordsCompleted;
    }
  }
  
  await stats.save();
}

module.exports = router;
