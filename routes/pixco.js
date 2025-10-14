const express = require('express');
const Pixel = require('../models/Pixel');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Configuration du jeu
const CONFIG = {
  w: 1000,
  h: 1000,
  cooldownSeconds: 300, // 5 minutes
};

// Cooldown par utilisateur (stocké en mémoire, perdu au redémarrage)
const userCooldowns = new Map(); // userId -> timestamp

// GET /pixco/config - Récupère la configuration
router.get('/config', (req, res) => {
  res.json(CONFIG);
});

// GET /pixco/snapshot - Récupère l'état complet de la grille
router.get('/snapshot', async (req, res) => {
  try {
    // Créer un buffer RGBA (w * h * 4 bytes)
    const buffer = Buffer.alloc(CONFIG.w * CONFIG.h * 4, 255); // Blanc par défaut

    // Récupérer tous les pixels de la DB
    const pixels = await Pixel.find({}).lean();

    // Remplir le buffer
    pixels.forEach((pixel) => {
      const { x, y, color } = pixel;
      if (x < 0 || x >= CONFIG.w || y < 0 || y >= CONFIG.h) return;

      const idx = (y * CONFIG.w + x) * 4;
      
      // Convertir hex en RGB
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = 255; // Alpha
    });

    res.set('Content-Type', 'application/octet-stream');
    res.send(buffer);
  } catch (err) {
    console.error('Error generating snapshot:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /pixco/pixel?x=&y= - Récupère les métadonnées d'un pixel
router.get('/pixel', async (req, res) => {
  try {
    const x = parseInt(req.query.x, 10);
    const y = parseInt(req.query.y, 10);

    if (isNaN(x) || isNaN(y) || x < 0 || x >= CONFIG.w || y < 0 || y >= CONFIG.h) {
      return res.status(400).json({ error: 'Coordonnées invalides' });
    }

    const pixel = await Pixel.findOne({ x, y }).lean();

    if (!pixel) {
      return res.json({ userId: null, username: null, at: null, color: '#ffffff' });
    }

    res.json({
      userId: pixel.userId,
      username: pixel.username,
      at: pixel.at,
      color: pixel.color,
    });
  } catch (err) {
    console.error('Error fetching pixel:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /pixco/place - Place un pixel (authentification requise)
router.post('/place', authenticate, async (req, res) => {
  try {
    const { x, y, color } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    // Validation
    if (
      typeof x !== 'number' || typeof y !== 'number' ||
      x < 0 || x >= CONFIG.w || y < 0 || y >= CONFIG.h
    ) {
      return res.status(400).json({ error: 'Coordonnées invalides' });
    }

    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Couleur invalide' });
    }

    // Vérifier cooldown
    const now = Date.now();
    const lastPlaced = userCooldowns.get(userId) || 0;
    const cooldownMs = CONFIG.cooldownSeconds * 1000;
    const nextAvailable = lastPlaced + cooldownMs;

    if (now < nextAvailable) {
      const retryAfter = Math.ceil((nextAvailable - now) / 1000);
      return res.status(429).json({
        error: 'Cooldown actif',
        retryAfter,
        nextAvailableAt: nextAvailable,
      });
    }

    // Mettre à jour ou créer le pixel
    const pixel = await Pixel.findOneAndUpdate(
      { x, y },
      { color, userId, username, at: new Date() },
      { upsert: true, new: true }
    );

    // Mettre à jour le cooldown
    userCooldowns.set(userId, now);

    // Broadcaster via WebSocket (via io attaché à l'app)
    const io = req.app.get('io');
    if (io) {
      io.of('/pixco').emit('pixel', {
        type: 'pixel',
        x: pixel.x,
        y: pixel.y,
        color: pixel.color,
        userId: pixel.userId,
        username: pixel.username,
        at: pixel.at,
      });
    }

    res.json({
      success: true,
      nextAvailableAt: now + cooldownMs,
      pixel: {
        x: pixel.x,
        y: pixel.y,
        color: pixel.color,
        userId: pixel.userId,
        username: pixel.username,
        at: pixel.at,
      },
    });
  } catch (err) {
    console.error('Error placing pixel:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
