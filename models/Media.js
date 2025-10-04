const mongoose = require('mongoose');

const MediaSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  originalName: String,
  mime: String,
  width: Number,
  height: Number,
  size: Number,
  storagePath: { type: String }, // relative path on disk (pending or approved)
  url: { type: String }, // public URL (only when approved)
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reason: String,
  flags: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('Media', MediaSchema);
