const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },

    // Date(s)
    date: { type: Date, required: true },  // jour (00:00)
    endDate: { type: Date },               // optionnel (multi-jours)

    // Heures (optionnelles)
    startHour: { type: String }, // "HH:mm"
    endHour: { type: String },   // "HH:mm"

    location: { type: String },
    description: { type: String },
    color: { type: String },     // "#RRGGBB" optionnel
  imageUrl: { type: String },  // URL image (optionnelle) — si présente, prime sur color côté UI

    // Lien club optionnel
    club: { type: mongoose.Schema.Types.ObjectId, ref: 'ClubSchedule' },

    // Auteur requis
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Récurrence (optionnelle)
    recurrence: {
      // Accept both upper & lower; we normalize to lower in pre-save
      frequency: { type: String, enum: ['daily','weekly','monthly','yearly','DAILY','WEEKLY','MONTHLY','YEARLY'] },
      interval: { type: Number, default: 1 },
      count: { type: Number },
      until: { type: Date },
      byDay: [{ type: String }],
    },

    // Abonnés (users)
    subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

// Indexes for query performance
eventSchema.index({ date: 1 });
eventSchema.index({ club: 1, date: 1 });

// Normalize recurrence frequency before validation/save
eventSchema.pre('validate', function(next){
  if (this.recurrence && this.recurrence.frequency) {
    this.recurrence.frequency = String(this.recurrence.frequency).toLowerCase();
  }
  next();
});

// After normalization restrict final values to lowercase set
eventSchema.path('recurrence.frequency').validate(function(v){
  if (!v) return true;
  return ['daily','weekly','monthly','yearly'].includes(v);
}, 'Invalid recurrence frequency');

module.exports = mongoose.model('Event', eventSchema);