const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Log = require('../models/Log');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Middleware de vérification admin
const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Non autorisé' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Accès refusé' });
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide' });
  }
};

// GET /admin/users
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /admin/users
router.post('/users', verifyAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Champs manquants' });
  }

  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: 'Utilisateur déjà existant' });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashed, role });
    await newUser.save();

    await Log.create({ action: `Création de l'utilisateur "${username}"`, date: new Date() });

    res.status(201).json({ message: 'Utilisateur créé' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// DELETE /admin/users/:id
router.delete('/users/:id', verifyAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });

    await Log.create({ action: `Suppression de l'utilisateur "${user.username}"`, date: new Date() });

    res.json({ message: 'Utilisateur supprimé' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /admin/logs
router.get('/logs', verifyAdmin, async (req, res) => {
  try {
    const logs = await Log.find().sort({ date: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Erreur chargement logs' });
  }
});

// Stub admin (évite l’erreur "Cannot find module ./routes/admin")
router.get('/', (req, res) => res.json({ ok: true }));

module.exports = router;