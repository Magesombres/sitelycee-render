const mongoose = require('mongoose');

const hangmanWordSchema = new mongoose.Schema({
  word: { 
    type: String, 
    required: true, 
    uppercase: true,
    trim: true 
  },
  category: { 
    type: String, 
    enum: ['animaux', 'villes', 'pays', 'metiers', 'objets', 'nourriture', 'sports', 'general'],
    default: 'general'
  },
  difficulty: {
    type: String,
    enum: ['facile', 'moyen', 'difficile'],
    default: 'moyen'
  },
  length: { 
    type: Number,
    required: true 
  },
  hint: { 
    type: String,
    default: '' 
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Index pour optimiser les requêtes
hangmanWordSchema.index({ difficulty: 1, length: 1 });
hangmanWordSchema.index({ category: 1 });

module.exports = mongoose.model('HangmanWord', hangmanWordSchema);
