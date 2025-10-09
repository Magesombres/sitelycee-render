#!/usr/bin/env node
/**
 * Script: reset_password.js
 * Usage:
 *   node scripts/reset_password.js <username> <nouveau_mot_de_passe>
 *
 * Variables d'environnement requises en production:
 *   MONGO_URI, JWT_SECRET (facultatif ici)
 *
 * Sécurité: N'exposez pas ce script publiquement. Ne le mettez pas dans une interface.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
require('dotenv').config();

(async () => {
  try {
    const [,, username, newPass] = process.argv;
    if (!username || !newPass) {
      console.error('❌ Usage: node scripts/reset_password.js <username> <nouveau_mot_de_passe>');
      process.exit(1);
    }

    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/sitelyceee';
    await mongoose.connect(uri);    

    const user = await User.findOne({ username });
    if (!user) {
      console.error(`❌ Utilisateur '${username}' introuvable`);
      process.exit(2);
    }

    const hash = await bcrypt.hash(newPass, 10);
    user.password = hash;
    await user.save();
    console.log(`✅ Mot de passe réinitialisé pour '${username}'`);
    process.exit(0);
  } catch (e) {
    console.error('Erreur:', e);
    process.exit(10);
  }
})();
