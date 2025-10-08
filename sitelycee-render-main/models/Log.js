const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  action: String,
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Log', logSchema);
