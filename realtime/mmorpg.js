const jwt = require('jsonwebtoken');
const Character = require('../models/Character');

module.exports = function attachMMO(io) {
  const nsp = io.of('/mmorpg');

  const zones = new Map(); // zone -> Map(socketId -> {name,x,y,userId})
  const getZone = (z) => { if (!zones.has(z)) zones.set(z, new Map()); return zones.get(z); };

  const authFromSocket = (socket) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return null;
      const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
      const p = jwt.verify(token, secret);
      return { id: p.id, username: p.username };
    } catch { return null; }
  };

  const clamp = (v) => Math.max(0, Math.min(49, v)); // 50x50

  nsp.on('connection', async (socket) => {
    const user = authFromSocket(socket);
    if (!user) { socket.emit('error_msg', 'Auth requise'); socket.disconnect(true); return; }

    let ch = await Character.findOne({ user: user.id });
    if (!ch) ch = await Character.create({ user: user.id, name: user.username.slice(0, 24) || 'Joueur', zone: 'plaine', x: 10, y: 10 });

    let currentZone = ch.zone || 'plaine';
    socket.join(currentZone);
    getZone(currentZone).set(socket.id, { name: ch.name, x: ch.x, y: ch.y, userId: String(ch.user) });

    // Etat initial
    socket.emit('zone_state', { zone: currentZone, size: 50, players: Array.from(getZone(currentZone).values()) });
    socket.to(currentZone).emit('player_join', { name: ch.name, x: ch.x, y: ch.y });

    socket.on('move', async ({ dx, dy }) => {
      const z = getZone(currentZone);
      const rec = z.get(socket.id);
      if (!rec) return;
      const nx = clamp(rec.x + (Number(dx) || 0));
      const ny = clamp(rec.y + (Number(dy) || 0));
      rec.x = nx; rec.y = ny;
      z.set(socket.id, rec);

      // Émettre à toute la room (inclut l’émetteur -> le joueur voit son déplacement)
      nsp.to(currentZone).emit('player_move', { name: rec.name, x: nx, y: ny });

      try { await Character.updateOne({ user: user.id }, { $set: { x: nx, y: ny, lastSeen: new Date() } }); } catch {}
    });

    socket.on('change_zone', async ({ zone }) => {
      const target = String(zone || '').slice(0, 64) || 'plaine';
      if (target === currentZone) return;

      // Quitter ancienne zone
      const oldMap = getZone(currentZone);
      const prev = oldMap.get(socket.id);
      if (prev) {
        socket.to(currentZone).emit('player_leave', { name: prev.name });
        oldMap.delete(socket.id);
      }
      socket.leave(currentZone);

      // Joindre nouvelle zone
      currentZone = target; // <- important
      socket.join(currentZone);
      const rec2 = { name: ch.name, x: 10, y: 10, userId: String(ch.user) };
      getZone(currentZone).set(socket.id, rec2);

      socket.emit('zone_state', { zone: currentZone, size: 50, players: Array.from(getZone(currentZone).values()) });
      socket.to(currentZone).emit('player_join', { name: rec2.name, x: rec2.x, y: rec2.y });

      try { await Character.updateOne({ user: user.id }, { $set: { zone: currentZone, x: 10, y: 10, lastSeen: new Date() } }); } catch {}
    });

    socket.on('disconnect', () => {
      const z = getZone(currentZone);
      const rec = z.get(socket.id);
      if (rec) {
        socket.to(currentZone).emit('player_leave', { name: rec.name });
        z.delete(socket.id);
      }
    });
  });
};