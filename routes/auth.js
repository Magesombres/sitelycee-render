const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const User = require('../models/User');
const { validate } = require('../middleware/validate');

const router = express.Router();

const { validatePassword } = require('../utils/validation');

// Schemas
const registerSchema = z.object({
  username: z.string().min(3).max(40).trim(),
  password: z.string(),
  confirmPassword: z.string(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Inscription
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { username, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });
    }
    const complexityError = validatePassword(password);
    if (complexityError) {
      return res.status(400).json({ error: complexityError });
    }
    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(400).json({ error: 'Utilisateur déjà existant' });
    }
    const user = new User({ username, password, role: 'eleve' });
    await user.save();
    return res.status(201).json({ message: 'Utilisateur créé' });
  } catch (err) {
    return next(err);
  }
});

// Connexion
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).lean();
    if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });

    const payload = {
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      managerClubs: (user.managerClubs || []).map(String),
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret_change_me', { expiresIn: '7d' });
    return res.json({ token, user: payload });
  } catch (e) {
    return next(e);
  }
});

module.exports = router;