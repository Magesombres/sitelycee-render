const HangmanGame = require('../models/HangmanGame');
const HangmanWord = require('../models/HangmanWord');
const HangmanStats = require('../models/HangmanStats');

module.exports = function attachHangman(io) {
  const nsp = io.of('/hangman');

  // Génération de code de room
  const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const genCode = () => Array.from({length: 6}, () => codeChars[Math.floor(Math.random() * codeChars.length)]).join('');

  // Calculer l'ELO (pour mode Duel)
  const calculateElo = (winnerElo, loserElo, isDraw = false) => {
    const K = 32; // K-factor
    const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
    
    if (isDraw) {
      return {
        winner: Math.round(winnerElo + K * (0.5 - expectedWinner)),
        loser: Math.round(loserElo + K * (0.5 - expectedLoser))
      };
    }
    
    return {
      winner: Math.round(winnerElo + K * (1 - expectedWinner)),
      loser: Math.round(loserElo + K * (0 - expectedLoser))
    };
  };

  nsp.on('connection', (socket) => {
    console.log(`[Hangman] Client connecté: ${socket.id}`);

    // CREATE ROOM - Créer une room privée (multiplayer)
    socket.on('createRoom', async ({ username, mode = 'multiplayer', isPublic = false, maxPlayers = 4 }) => {
      try {
        let roomCode = genCode();
        while (await HangmanGame.findOne({ roomCode })) {
          roomCode = genCode();
        }

        const game = await HangmanGame.create({
          roomCode,
          mode,
          isPublic,
          maxPlayers,
          players: [{
            username,
            socketId: socket.id,
            isReady: false
          }],
          status: 'waiting',
          createdBy: socket.userId // Si authentifié
        });

        socket.join(roomCode);
        socket.emit('roomCreated', { 
          roomCode, 
          game: {
            roomCode: game.roomCode,
            mode: game.mode,
            players: game.players,
            status: game.status
          }
        });
        
        console.log(`[Hangman] Room ${roomCode} créée par ${username}`);
      } catch (err) {
        console.error('[Hangman] Erreur création room:', err);
        socket.emit('error', { message: 'Erreur lors de la création de la room' });
      }
    });

    // JOIN ROOM - Rejoindre une room existante
    socket.on('joinRoom', async ({ roomCode, username }) => {
      try {
        const game = await HangmanGame.findOne({ roomCode });
        
        if (!game) {
          return socket.emit('error', { message: 'Room introuvable' });
        }
        
        if (game.status !== 'waiting') {
          return socket.emit('error', { message: 'Partie déjà commencée' });
        }
        
        if (game.players.length >= game.maxPlayers) {
          return socket.emit('error', { message: 'Room complète' });
        }

        // Ajouter le joueur
        game.players.push({
          username,
          socketId: socket.id,
          isReady: false
        });
        
        await game.save();
        socket.join(roomCode);
        
        // Notifier tous les joueurs
        nsp.to(roomCode).emit('playerJoined', {
          player: username,
          players: game.players
        });
        
        socket.emit('roomJoined', {
          roomCode,
          game: {
            roomCode: game.roomCode,
            mode: game.mode,
            players: game.players,
            status: game.status,
            maxPlayers: game.maxPlayers
          }
        });
        
        console.log(`[Hangman] ${username} a rejoint la room ${roomCode}`);
      } catch (err) {
        console.error('[Hangman] Erreur rejoindre room:', err);
        socket.emit('error', { message: 'Erreur lors de la connexion à la room' });
      }
    });

    // READY - Marquer le joueur comme prêt
    socket.on('ready', async ({ roomCode }) => {
      try {
        const game = await HangmanGame.findOne({ roomCode });
        if (!game) return;

        const player = game.players.find(p => p.socketId === socket.id);
        if (!player) return;

        player.isReady = true;
        await game.save();

        nsp.to(roomCode).emit('playerReady', {
          player: player.username,
          players: game.players
        });

        // Si tous les joueurs sont prêts, démarrer la partie
        const allReady = game.players.every(p => p.isReady);
        if (allReady && game.players.length >= 1) {
          await startGame(game, nsp);
        }
      } catch (err) {
        console.error('[Hangman] Erreur ready:', err);
      }
    });

    // GUESS LETTER - Proposer une lettre
    socket.on('guessLetter', async ({ roomCode, letter }) => {
      try {
        const game = await HangmanGame.findOne({ roomCode });
        if (!game || game.status !== 'playing') return;

        const player = game.players.find(p => p.socketId === socket.id);
        if (!player) return;

        // Vérifier si c'est le tour du joueur (pour mode tour par tour)
        if (['multiplayer', 'duel'].includes(game.mode)) {
          const currentPlayer = game.players[game.currentTurn];
          if (currentPlayer.socketId !== socket.id) {
            return socket.emit('error', { message: 'Ce n\'est pas votre tour' });
          }
        }

        const letterUpper = letter.toUpperCase();

        // Vérifier si déjà jouée
        if (game.guessedLetters.includes(letterUpper) || game.wrongGuesses.includes(letterUpper)) {
          return socket.emit('error', { message: 'Lettre déjà jouée' });
        }

        // Vérifier si la lettre est correcte
        const isCorrect = game.currentWord.word.includes(letterUpper);

        if (isCorrect) {
          game.guessedLetters.push(letterUpper);
          player.score += 10;
        } else {
          game.wrongGuesses.push(letterUpper);
          game.livesRemaining -= 1;
          if (game.mode === 'survival') {
            game.survivalLives -= 1;
          }
        }

        // Historique
        game.turnHistory.push({
          playerId: socket.id,
          letter: letterUpper,
          correct: isCorrect,
          timestamp: new Date()
        });

        // Passer au joueur suivant (mode tour par tour)
        if (['multiplayer', 'duel'].includes(game.mode)) {
          game.currentTurn = (game.currentTurn + 1) % game.players.length;
        }

        // Vérifier victoire
        const allLettersFound = game.currentWord.word.split('').every(l => 
          game.guessedLetters.includes(l) || l === ' ' || l === '-'
        );

        const revealedWord = game.currentWord.word.split('').map(l => 
          game.guessedLetters.includes(l) || l === ' ' || l === '-' ? l : '_'
        ).join('');

        let gameOver = false;
        let winner = null;

        if (allLettersFound) {
          if (game.mode === 'survival') {
            // Charger le mot suivant
            game.wordsCompleted += 1;
            await loadNextWord(game);
          } else {
            gameOver = true;
            winner = player;
          }
        } else if (game.livesRemaining <= 0 || (game.mode === 'survival' && game.survivalLives <= 0)) {
          gameOver = true;
        }

        if (gameOver) {
          game.status = 'finished';
          game.endTime = new Date();
          
          if (winner) {
            game.winner = {
              userId: winner.userId,
              username: winner.username,
              score: winner.score
            };
          }

          // Mettre à jour les stats et ELO
          await updateStatsForGame(game);
        }

        await game.save();

        // Broadcast à tous les joueurs de la room
        nsp.to(roomCode).emit('letterGuessed', {
          player: player.username,
          letter: letterUpper,
          correct: isCorrect,
          revealedWord,
          guessedLetters: game.guessedLetters,
          wrongGuesses: game.wrongGuesses,
          livesRemaining: game.livesRemaining,
          survivalLives: game.survivalLives,
          currentTurn: game.players[game.currentTurn]?.username,
          gameOver,
          winner: winner?.username,
          word: gameOver ? game.currentWord.word : undefined,
          players: game.players
        });

      } catch (err) {
        console.error('[Hangman] Erreur guess letter:', err);
        socket.emit('error', { message: 'Erreur lors de la proposition' });
      }
    });

    // CHAT - Envoyer un message dans la room
    socket.on('chat', async ({ roomCode, message }) => {
      try {
        const game = await HangmanGame.findOne({ roomCode });
        if (!game) return;

        const player = game.players.find(p => p.socketId === socket.id);
        if (!player) return;

        nsp.to(roomCode).emit('chatMessage', {
          player: player.username,
          message,
          timestamp: new Date()
        });
      } catch (err) {
        console.error('[Hangman] Erreur chat:', err);
      }
    });

    // LEAVE ROOM - Quitter la room
    socket.on('leaveRoom', async ({ roomCode }) => {
      await handlePlayerLeave(socket, roomCode, nsp);
    });

    // DISCONNECT
    socket.on('disconnect', async () => {
      console.log(`[Hangman] Client déconnecté: ${socket.id}`);
      
      // Trouver et gérer la room du joueur
      const game = await HangmanGame.findOne({ 
        'players.socketId': socket.id,
        status: { $in: ['waiting', 'playing'] }
      });
      
      if (game) {
        await handlePlayerLeave(socket, game.roomCode, nsp);
      }
    });
  });

  // Fonction helper: démarrer une partie
  async function startGame(game, nsp) {
    try {
      // Charger un mot aléatoire
      const difficulty = 'moyen'; // Pourrait être paramétrable
      const count = await HangmanWord.countDocuments({ difficulty });
      const random = Math.floor(Math.random() * count);
      const word = await HangmanWord.findOne({ difficulty }).skip(random);

      if (!word) {
        nsp.to(game.roomCode).emit('error', { message: 'Aucun mot disponible' });
        return;
      }

      word.usageCount += 1;
      await word.save();

      game.currentWord = {
        wordId: word._id,
        word: word.word,
        hint: word.hint,
        category: word.category
      };
      game.status = 'playing';
      game.startTime = new Date();
      game.livesRemaining = 6;
      game.survivalLives = game.mode === 'survival' ? 10 : undefined;
      game.guessedLetters = [];
      game.wrongGuesses = [];

      await game.save();

      const revealedWord = '_'.repeat(word.word.length);

      nsp.to(game.roomCode).emit('gameStarted', {
        wordLength: word.word.length,
        category: word.category,
        hint: word.hint,
        revealedWord,
        lives: game.livesRemaining,
        survivalLives: game.survivalLives,
        currentTurn: game.players[0]?.username,
        players: game.players,
        timeLimit: game.mode === 'chrono' ? 30 : undefined
      });

      console.log(`[Hangman] Partie ${game.roomCode} démarrée`);
    } catch (err) {
      console.error('[Hangman] Erreur start game:', err);
    }
  }

  // Fonction helper: charger le mot suivant (mode survival)
  async function loadNextWord(game) {
    try {
      const count = await HangmanWord.countDocuments({ difficulty: 'moyen' });
      const random = Math.floor(Math.random() * count);
      const word = await HangmanWord.findOne({ difficulty: 'moyen' }).skip(random);

      if (!word) return;

      game.currentWord = {
        wordId: word._id,
        word: word.word,
        hint: word.hint,
        category: word.category
      };
      game.guessedLetters = [];
      game.wrongGuesses = [];
      game.livesRemaining = 6; // Reset pour le nouveau mot mais pas survivalLives

      await game.save();

      const revealedWord = '_'.repeat(word.word.length);

      nsp.to(game.roomCode).emit('newWord', {
        wordLength: word.word.length,
        category: word.category,
        hint: word.hint,
        revealedWord,
        wordsCompleted: game.wordsCompleted,
        survivalLives: game.survivalLives
      });
    } catch (err) {
      console.error('[Hangman] Erreur load next word:', err);
    }
  }

  // Fonction helper: gérer le départ d'un joueur
  async function handlePlayerLeave(socket, roomCode, nsp) {
    try {
      const game = await HangmanGame.findOne({ roomCode });
      if (!game) return;

      const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex === -1) return;

      const player = game.players[playerIndex];
      game.players.splice(playerIndex, 1);

      socket.leave(roomCode);

      if (game.players.length === 0) {
        // Supprimer la partie si plus de joueurs
        await HangmanGame.deleteOne({ roomCode });
        console.log(`[Hangman] Room ${roomCode} supprimée (vide)`);
      } else {
        // Ajuster le tour si nécessaire
        if (game.currentTurn >= game.players.length) {
          game.currentTurn = 0;
        }
        
        await game.save();

        nsp.to(roomCode).emit('playerLeft', {
          player: player.username,
          players: game.players,
          currentTurn: game.players[game.currentTurn]?.username
        });
      }
    } catch (err) {
      console.error('[Hangman] Erreur player leave:', err);
    }
  }

  // Fonction helper: mettre à jour les stats après une partie
  async function updateStatsForGame(game) {
    try {
      for (const player of game.players) {
        if (!player.userId) continue;

        let stats = await HangmanStats.findOne({ userId: player.userId });
        if (!stats) {
          stats = await HangmanStats.create({
            userId: player.userId,
            username: player.username
          });
        }

        const won = game.winner && game.winner.userId.toString() === player.userId.toString();
        const mode = game.mode;

        if (mode === 'multiplayer') {
          stats.multiplayer.gamesPlayed += 1;
          if (won) stats.multiplayer.wins += 1;
        }

        if (mode === 'openRoom') {
          stats.openRoom.gamesPlayed += 1;
          if (won) stats.openRoom.wins += 1;
          
          // Top 3 = podium
          const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
          const rank = sortedPlayers.findIndex(p => p.userId?.toString() === player.userId.toString());
          if (rank >= 0 && rank < 3) {
            stats.openRoom.podiums += 1;
          }
        }

        if (mode === 'duel') {
          stats.duel.gamesPlayed += 1;
          
          if (game.players.length === 2) {
            const opponent = game.players.find(p => p.userId?.toString() !== player.userId.toString());
            if (opponent && opponent.userId) {
              const opponentStats = await HangmanStats.findOne({ userId: opponent.userId });
              
              if (won) {
                stats.duel.wins += 1;
                const newElos = calculateElo(stats.duel.elo, opponentStats.duel.elo);
                stats.duel.elo = newElos.winner;
                if (opponentStats) {
                  opponentStats.duel.losses += 1;
                  opponentStats.duel.elo = newElos.loser;
                  await opponentStats.save();
                }
              } else if (!game.winner) {
                // Draw
                stats.duel.draws += 1;
                const newElos = calculateElo(stats.duel.elo, opponentStats.duel.elo, true);
                stats.duel.elo = newElos.winner;
                if (opponentStats) {
                  opponentStats.duel.draws += 1;
                  opponentStats.duel.elo = newElos.loser;
                  await opponentStats.save();
                }
              } else {
                stats.duel.losses += 1;
              }
            }
          }
        }

        await stats.save();
      }
    } catch (err) {
      console.error('[Hangman] Erreur update stats:', err);
    }
  }
};
