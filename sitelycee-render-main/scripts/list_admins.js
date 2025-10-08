require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const admins = await User.find({ role: 'admin' }, { username: 1, _id: 0 });
  console.log('Admins:', admins);
  await mongoose.disconnect();
})();