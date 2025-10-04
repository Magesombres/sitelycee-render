require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Schedule = require('../models/Schedule');

// A PERSONNALISER
const TARGET_OLD = 'admin';
const TARGET_NEW = 'Magesombre';
const TARGET_PASSWORD = 'Ethan/C/2800';

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    let user = await User.findOne({ username: TARGET_OLD });
    if (!user) {
      user = await User.findOne({ username: TARGET_NEW });
    }

    if (!user) {
      user = new User({ username: TARGET_NEW, password: TARGET_PASSWORD, role: 'admin' });
      await user.save();
      console.log(`Admin créé: ${TARGET_NEW}`);
    } else {
      user.username = TARGET_NEW;
      user.password = TARGET_PASSWORD; // re-hash via pre('save')
      user.role = 'admin';
      await user.save();
      console.log(`Admin mis à jour: ${TARGET_NEW}`);
    }

    const users = await User.find({}, { _id: 0, username: 1, role: 1 }).lean();
    console.log('Utilisateurs:', users);

    // Utilisateur de test
    const demoUser = await User.findOne({ username: 'demo' }) ||
      await new User({ username: 'demo', password: 'demo123', role: 'eleve' }).save();

    // Cours de test
    const hasCourse = await Schedule.findOne({ user: demoUser._id });
    if (!hasCourse) {
      await Schedule.create([
        { user: demoUser._id, day: 'Lundi', startHour: '09:00', endHour: '10:00', subject: 'Maths', location: 'A101' },
        { user: demoUser._id, day: 'Mardi', startHour: '10:00', endHour: '12:00', subject: 'Français', location: 'B202' }
      ]);
    }

    // Événement de test
    const today = new Date(); today.setHours(0,0,0,0);
    const hasEvent = await Event.findOne({});
    if (!hasEvent) {
      await Event.create({
        title: 'Réunion',
        date: today,
        startHour: '14:00',
        endHour: '15:00',
        location: 'Salle des profs',
        color: '#93C5FD',
        createdBy: demoUser._id, // <- important
      });
    }

    console.log('Seed OK');
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('seed error:', e);
    process.exit(1);
  }
})();