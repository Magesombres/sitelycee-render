const express = require('express');
const { z } = require('zod');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');

const router = express.Router();

// Create group room
const createRoomSchema = z.object({
  name: z.string().min(1).max(60).trim(),
  members: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1).optional(),
});
router.post('/rooms', authMiddleware, validate(createRoomSchema), async (req, res, next) => {
  try {
    const { name, members = [] } = req.body;
    const uniqueMembers = [...new Set(members.filter((m) => m !== req.user.id))];
    const room = await ChatRoom.create({
      name,
      isGroup: true,
      members: [req.user.id, ...uniqueMembers],
      createdBy: req.user.id,
    });
    res.status(201).json({ id: room._id.toString(), name: room.name, members: room.members.map(String) });
  } catch (e) { next(e); }
});

// List rooms user is member of + global room descriptor
router.get('/rooms', authMiddleware, async (req, res, next) => {
  try {
    const rooms = await ChatRoom.find({ members: req.user.id }).lean();
    const data = rooms.map((r) => ({ id: r._id.toString(), name: r.name, members: (r.members || []).map(String) }));
    // Add implicit global room (id 'global')
    data.unshift({ id: 'global', name: 'Général', members: [] });
    res.json(data);
  } catch (e) { next(e); }
});

// Get last messages of a room
router.get('/rooms/:roomId/messages', authMiddleware, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    if (roomId !== 'global') {
      const room = await ChatRoom.findById(roomId).lean();
      if (!room) return res.status(404).json({ error: 'Salle introuvable' });
      if (!room.members.map(String).includes(req.user.id)) return res.status(403).json({ error: 'Accès refusé' });
    }
  const messages = await ChatMessage.find({ room: roomId === 'global' ? null : roomId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(messages.reverse().map((m) => ({
      id: m._id.toString(),
      user: m.user?.toString(),
      username: m.username,
      content: m.content,
  imageUrl: m.imageUrl,
      createdAt: m.createdAt,
      room: m.room ? m.room.toString() : 'global',
    })));
  } catch (e) { next(e); }
});

module.exports = router;

// Delete a message (owner or admin)
router.delete('/messages/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const msg = await ChatMessage.findById(id);
    if (!msg) return res.status(404).json({ error: 'Message introuvable' });
    const isOwner = String(msg.user) === String(req.user.id);
    const isAdm = req.user.role === 'admin';
    if (!(isOwner || isAdm)) return res.status(403).json({ error: 'Interdit' });
    const roomId = msg.room ? String(msg.room) : 'global';
    await msg.deleteOne();
    // Emit via Socket.IO if available
    try {
      const io = req.app.get('io');
      if (io) io.of('/chat').to(roomId).emit('messageDeleted', { id, room: roomId });
    } catch {}
    res.json({ ok: true });
  } catch (e) { next(e); }
});
