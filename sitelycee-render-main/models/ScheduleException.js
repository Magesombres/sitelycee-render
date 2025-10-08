const mongoose = require('mongoose');

const scheduleExceptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  schedule: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', required: true },
  date: { type: Date, required: true }, // jour (00:00)
  status: { type: String, enum: ['normal', 'annule', 'prof_absent'], default: 'normal' }
}, { timestamps: true });

scheduleExceptionSchema.index({ user: 1, schedule: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('ScheduleException', scheduleExceptionSchema);