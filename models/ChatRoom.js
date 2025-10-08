const mongoose = require('mongoose');

const ChatRoomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  isGroup: { type: Boolean, default: true }, // false => global/public
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // group members (exclude for global)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

ChatRoomSchema.index({ name: 1 });
ChatRoomSchema.index({ members: 1 });

module.exports = mongoose.model('ChatRoom', ChatRoomSchema);
