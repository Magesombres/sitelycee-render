const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');

const { validatePassword } = require('../utils/validation');

// Profil courant
router.get('/me', authMiddleware, async (req, res) => {
  try {
  const user = await User.findById(req.user.id).select('username role followingClubs subscribedEvents managerClubs pinnedEvents').lean();
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({
      username: user.username,
      role: user.role,
      followingClubs: (user.followingClubs || []).map(String),
      subscribedEvents: (user.subscribedEvents || []).map(String),
      pinnedEvents: (user.pinnedEvents || []).map(String),
      managerClubs: (user.managerClubs || []).map(String),
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Changer son mot de passe
router.patch('/password', authMiddleware, async (req, res) => {
  try {
    const currentPassword = (req.body?.currentPassword || '').trim();
    const newPassword = (req.body?.newPassword || '').trim();
    const confirmNewPassword = (req.body?.confirmNewPassword || '').trim();

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ error: 'Champs manquants' });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });
    }
    const complexityError = validatePassword(newPassword);
    if (complexityError) {
      return res.status(400).json({ error: complexityError });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(401).json({ error: 'Mot de passe actuel invalide' });

    user.password = newPassword; // sera hashé par le pre('save')
    await user.save();
    res.json({ message: 'Mot de passe mis à jour' });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Changer son username (réservé aux admins)
router.patch('/username', authMiddleware, isAdmin, async (req, res) => {
  try {
    const newUsername = (req.body?.username || '').trim();
    if (!newUsername) return res.status(400).json({ error: 'Nom d’utilisateur requis' });

    const exists = await User.findOne({ username: newUsername });
    if (exists && String(exists._id) !== req.user.id) {
      return res.status(400).json({ error: 'Nom d’utilisateur déjà pris' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    user.username = newUsername;
    await user.save();

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ message: 'Nom d’utilisateur mis à jour', token, user: { username: user.username, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Assigner/retirer un club à un utilisateur (admin)
router.post('/:userId/manager-clubs', authMiddleware, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { clubId, action } = req.body || {};
    if (!clubId || !['add','remove'].includes(action)) {
      return res.status(400).json({ error: 'clubId et action (add|remove) requis' });
    }
    const update = action === 'add'
      ? { $addToSet: { managerClubs: clubId } }
      : { $pull: { managerClubs: clubId } };
    const user = await User.findByIdAndUpdate(userId, update, { new: true }).lean();
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ id: user._id.toString(), managerClubs: (user.managerClubs || []).map(String) });
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Liste des utilisateurs (admin) avec leurs clubs gérés
router.get('/', authMiddleware, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'username role managerClubs')
      .populate('managerClubs', 'clubName')
      .lean();

    const data = users.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      role: u.role,
      managerClubs: (u.managerClubs || []).map((c) => ({
        id: (c?._id || c)?.toString(),
        clubName: c?.clubName,
      })),
    }));

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;