const mongoose = require('mongoose');

const clubScheduleSchema = new mongoose.Schema({
  clubName: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  day: { type: String, enum: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'], required: true },
  startHour: { type: String, required: true },
  endHour: { type: String, required: true },
  location: { type: String },
  description: { type: String },

  // Image de fond (URL ou data URI)
  bgImageUrl: { type: String },

  // Horaires de club (créneaux hebdomadaires supplémentaires)
  weeklySlots: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      day: { type: String, enum: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'], required: true },
      startHour: { type: String, required: true }, // "HH:mm"
      endHour: { type: String, required: true },   // "HH:mm"
      location: { type: String },
      notes: { type: String },
      createdAt: { type: Date, default: Date.now },
    }
  ],

  // Cours/Disponibilités datées
  availabilities: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      date: { type: Date, required: true },        // jour (00:00)
      startHour: { type: String, required: true }, // "HH:mm"
      endHour: { type: String, required: true },   // "HH:mm"
      subject: { type: String, required: true },   // matière
      teacher: { type: String, required: true },   // intervenant
      capacity: { type: Number, default: 1 },
      notes: { type: String },
      createdAt: { type: Date, default: Date.now },
    }
  ],

  requests: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      availabilityId: { type: mongoose.Schema.Types.ObjectId, required: true },
      note: { type: String },
      status: { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    }
  ],

  externalLinks: [{
    title: { type: String, trim: true, maxlength: 80 },
    url: { type: String, trim: true, maxlength: 1024 },
    iconUrl: { type: String, trim: true, maxlength: 1024 }, // si présent => rendu image
  }],
  customHtml: { type: String, default: '' }, // HTML nettoyé côté serveur
});

// Useful indexes for lookup and filtering
clubScheduleSchema.index({ clubName: 1 });
clubScheduleSchema.index({ 'availabilities.date': 1 });

module.exports = mongoose.model('ClubSchedule', clubScheduleSchema);