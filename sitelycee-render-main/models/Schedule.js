const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  day: { type: String, required: true },           // "Lundi"..."Vendredi"
  startHour: { type: String, required: true },     // "HH:mm"
  endHour: { type: String, required: true },       // "HH:mm"
  subject: { type: String, required: true },
  location: { type: String },

  color: { type: String },                         // "#RRGGBB" (optionnel)
  status: {                                        // état par défaut (les exceptions restent par date)
    type: String,
    enum: ['normal', 'annule', 'prof_absent'],
    default: 'normal',
  },

  // Semaine A/B facultative. Si non renseigné => visible en A et en B.
  weekType: { type: String, enum: ['A', 'B'], required: false },
}, { timestamps: true });

module.exports = mongoose.model('Schedule', scheduleSchema);