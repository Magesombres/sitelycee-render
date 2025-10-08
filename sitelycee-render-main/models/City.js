const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  guild: { type: mongoose.Schema.Types.ObjectId, ref: 'Guild', required: true },
  name: { type: String, required: true },
  level: { type: Number, default: 1 },
  resources: {
    wood: { type: Number, default: 0 },
    stone: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
  },
  buildings: [
    {
      key: { type: String, required: true }, // ex: 'townhall', 'barracks'
      level: { type: Number, default: 1 },
    }
  ],
}, { timestamps: true });

module.exports = mongoose.model('City', citySchema);