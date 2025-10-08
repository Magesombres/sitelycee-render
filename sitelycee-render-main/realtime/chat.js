// Socket.IO chat namespace: /chat
// Supports global room ('global') and dynamic room ids (Mongo ObjectId of ChatRoom)
const ChatMessage = require('../models/ChatMessage');
const ChatRoom = require('../models/ChatRoom');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

// Schémas de validation Zod
const joinRoomSchema = z.object({
  roomId: z.string().min(1).max(100).optional(),
});

const messageSchema = z.object({
  roomId: z.string().max(100).default('global'),
  content: z.string().max(2000).optional(),
  imageUrl: z.string().url().max(500).optional(),
}).refine(data => data.content || data.imageUrl, {
  message: 'Content ou imageUrl requis',
});

const typingSchema = z.object({
  roomId: z.string().max(100).default('global'),
  typing: z.boolean().optional(),
});

const deleteMessageSchema = z.object({
  id: z.string().min(1).max(100),
});

module.exports = function attachChat(io) {
  const nsp = io.of('/chat');

  // Simple auth via token query (JWT) for socket handshake
  nsp.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('AUTH_REQUIRED'));
  const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
  socket.user = { id: payload.id, username: payload.username, role: payload.role };
      next();
    } catch {
      next(new Error('BAD_TOKEN'));
    }
  });

  nsp.on('connection', (socket) => {
    const user = socket.user;
    socket.join('global');
    socket.emit('connected', { user });

    socket.on('joinRoom', async (data) => {
      try {
        const validated = joinRoomSchema.parse(data);
        const { roomId } = validated;
        
        if (!roomId || roomId === 'global') return; // already in global
        const room = await ChatRoom.findById(roomId).lean();
        if (!room) return socket.emit('error_msg', 'Salle introuvable');
        if (!room.members.map(String).includes(user.id)) return socket.emit('error_msg', 'Accès refusé');
        socket.join(roomId);
        socket.emit('joined', { roomId });
      } catch (e) {
        if (e instanceof z.ZodError) {
          return socket.emit('error_msg', 'Données invalides: ' + e.errors[0].message);
        }
        socket.emit('error_msg', 'Erreur joinRoom');
      }
    });

    socket.on('leaveRoom', ({ roomId }) => {
      if (roomId && roomId !== 'global') socket.leave(roomId);
    });

  socket.on('message', async (data) => {
      try {
        const validated = messageSchema.parse(data);
        const { roomId = 'global', content, imageUrl } = validated;
        
        const safeContent = (content || '').trim();
        const safeImage = (imageUrl || '').trim();
        
        if (safeImage && !(safeImage.startsWith('http://') || safeImage.startsWith('https://') || safeImage.startsWith('/uploads/approved/'))) {
          return socket.emit('error_msg', 'Image non autorisée');
        }
        
        let targetRoom = roomId;
        if (roomId !== 'global') {
          const room = await ChatRoom.findById(roomId).lean();
            if (!room) return socket.emit('error_msg', 'Salle introuvable');
            if (!room.members.map(String).includes(user.id)) return socket.emit('error_msg', 'Accès refusé');
        } else {
          targetRoom = 'global';
        }
        
        const msgDoc = await ChatMessage.create({
          room: targetRoom === 'global' ? null : targetRoom,
          user: user.id,
          username: user.username,
          content: safeContent,
          imageUrl: safeImage || undefined,
        });
        
        const payload = {
          id: msgDoc._id.toString(),
          room: targetRoom,
          user: user.id,
          username: user.username,
          content: safeContent,
          imageUrl: msgDoc.imageUrl || undefined,
          createdAt: msgDoc.createdAt,
        };
        nsp.to(targetRoom).emit('message', payload);
      } catch (e) {
        if (e instanceof z.ZodError) {
          return socket.emit('error_msg', 'Données invalides: ' + e.errors[0].message);
        }
        socket.emit('error_msg', 'Erreur envoi');
      }
    });

    socket.on('typing', (data) => {
      try {
        const validated = typingSchema.parse(data);
        const { roomId = 'global', typing } = validated;
        socket.to(roomId).emit('typing', { user: user.username, typing: !!typing });
      } catch (e) {
        if (e instanceof z.ZodError) {
          socket.emit('error_msg', 'Données invalides: ' + e.errors[0].message);
        }
      }
    });

    socket.on('deleteMessage', async (data) => {
      try {
        const validated = deleteMessageSchema.parse(data);
        const { id } = validated;
        
        const msg = await ChatMessage.findById(id);
        if (!msg) return socket.emit('error_msg', 'Message introuvable');
        const isOwner = String(msg.user) === String(user.id);
        let isAdm = false;
        try {
          // lightweight role check via JWT not on socket; rely on DB if needed
          isAdm = !!socket.user?.role && socket.user.role === 'admin';
        } catch {}
        if (!(isOwner || isAdm)) return socket.emit('error_msg', 'Interdit');
        const roomId = msg.room ? String(msg.room) : 'global';
        await msg.deleteOne();
        nsp.to(roomId).emit('messageDeleted', { id, room: roomId });
      } catch (e) {
        if (e instanceof z.ZodError) {
          return socket.emit('error_msg', 'Données invalides: ' + e.errors[0].message);
        }
        socket.emit('error_msg', 'Erreur suppression');
      }
    });
  });
};
