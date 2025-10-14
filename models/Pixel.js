const mongoose = require('mongoose');

const pixelSchema = new mongoose.Schema({
  x: {
    type: Number,
    required: true,
    min: 0,
    max: 999,
  },
  y: {
    type: Number,
    required: true,
    min: 0,
    max: 999,
  },
  color: {
    type: String,
    required: true,
    match: /^#[0-9a-fA-F]{6}$/,
  },
  userId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  at: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Index composé pour recherche rapide par coordonnées
pixelSchema.index({ x: 1, y: 1 }, { unique: true });

// Index pour récupération rapide de tous les pixels (snapshot)
pixelSchema.index({ at: 1 });

const Pixel = mongoose.model('Pixel', pixelSchema);

module.exports = Pixel;
