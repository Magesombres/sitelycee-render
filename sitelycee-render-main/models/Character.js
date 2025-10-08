const mongoose = require('mongoose');

const characterSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  name: { type: String, required: true },
  guild: { type: mongoose.Schema.Types.ObjectId, ref: 'Guild' },

  // Position simple 2D + zone
  zone: { type: String, default: 'plaine' }, // ex: 'plaine', 'foret', `city:${guildId}`
  x: { type: Number, default: 10 },
  y: { type: Number, default: 10 },

  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Character', characterSchema);