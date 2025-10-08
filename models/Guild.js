const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  city: { type: mongoose.Schema.Types.ObjectId, ref: 'City' },
}, { timestamps: true });

module.exports = mongoose.model('Guild', guildSchema);