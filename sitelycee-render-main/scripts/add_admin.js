require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const [,, username, password] = process.argv;
  if (!username || !password) {
    console.log('Usage: node scripts/add_admin.js <username> <password>');
    process.exit(1);
  }

  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sitelyee';
  await mongoose.connect(uri);

  try {
    let user = await User.findOne({ username });
    if (user) {
      user.role = 'admin';
      if (password) user.password = password; // sera hashé par le pre('save')
      await user.save();
      console.log(`OK: L'utilisateur ${username} est admin.`);
    } else {
      user = new User({ username, password, role: 'admin' });
      await user.save();
      console.log(`OK: Admin créé: ${username}`);
    }
    process.exit(0);
  } catch (e) {
    console.error('Erreur add_admin:', e.message);
    process.exit(2);
  } finally {
    await mongoose.disconnect();
  }
}

main();