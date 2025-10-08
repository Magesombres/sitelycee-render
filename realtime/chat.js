// Socket.IO chat namespace: /chat
// Supports global room ('global') and dynamic room ids (Mongo ObjectId of ChatRoom)
const ChatMessage = require('../models/ChatMessage');
const ChatRoom = require('../models/ChatRoom');
const jwt = require('jsonwebtoken');

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

    socket.on('joinRoom', async ({ roomId }) => {
      try {
        if (!roomId || roomId === 'global') return; // already in global
        const room = await ChatRoom.findById(roomId).lean();
        if (!room) return socket.emit('error_msg', 'Salle introuvable');
        if (!room.members.map(String).includes(user.id)) return socket.emit('error_msg', 'Accès refusé');
        socket.join(roomId);
        socket.emit('joined', { roomId });
      } catch (e) {
        socket.emit('error_msg', 'Erreur joinRoom');
      }
    });

    socket.on('leaveRoom', ({ roomId }) => {
      if (roomId && roomId !== 'global') socket.leave(roomId);
    });

  socket.on('message', async ({ roomId = 'global', content, imageUrl }) => {
      try {
        const safeContent = (content || '').trim().slice(0, 2000);
        const safeImage = (imageUrl || '').trim();
        if (!safeContent && !safeImage) return;
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
        socket.emit('error_msg', 'Erreur envoi');
      }
    });

    socket.on('typing', ({ roomId = 'global', typing }) => {
      socket.to(roomId).emit('typing', { user: user.username, typing: !!typing });
    });

    socket.on('deleteMessage', async ({ id }) => {
      try {
        if (!id) return;
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
      } catch {
        socket.emit('error_msg', 'Erreur suppression');
      }
    });
  });
};
