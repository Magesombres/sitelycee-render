require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  const [,, username] = process.argv;
  if (!username) {
    console.log('Usage: node scripts/make_admin.js <username>');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ username });
  if (!user) {
    console.log(`Utilisateur "${username}" introuvable.`);
  } else {
    user.role = 'admin';
    await user.save();
    console.log(`Utilisateur "${username}" est maintenant admin.`);
  }
  await mongoose.disconnect();
})();