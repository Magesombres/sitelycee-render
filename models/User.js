// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['eleve', 'admin'], default: 'eleve' },

    // Clubs que l'utilisateur peut gérer
  managerClubs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ClubSchedule' }],
  // Clubs suivis (follow)
  followingClubs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ClubSchedule' }],
  // Événements auxquels l'utilisateur est abonné
  subscribedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  // Événements épinglés (ajoutés à l'emploi du temps personnel)
  pinnedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  },
  { timestamps: true }
);

// Hash du mot de passe
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
