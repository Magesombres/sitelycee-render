const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  // room null => global
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: false, default: null },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true }, // snapshot to avoid extra populate
  content: { type: String, default: '', maxlength: 2000 },
  imageUrl: { type: String }, // optional approved image URL
  createdAt: { type: Date, default: Date.now },
});

ChatMessageSchema.index({ room: 1, createdAt: -1 });

ChatMessageSchema.pre('validate', function(next){
  if ((this.content && this.content.trim()) || (this.imageUrl && this.imageUrl.trim())) return next();
  this.invalidate('content', 'content or image required');
  next(new Error('content or image required'));
});

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
