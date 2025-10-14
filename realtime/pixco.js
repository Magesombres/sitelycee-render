// WebSocket handler pour Pixco
// Synchronisation temps réel des pixels placés

module.exports = function (io) {
  const pixcoNamespace = io.of('/pixco');

  pixcoNamespace.on('connection', (socket) => {
    console.log(`[Pixco] Client connecté: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Pixco] Client déconnecté: ${socket.id}`);
    });

    // Pas besoin de listener côté client pour l'instant
    // Les pixels sont broadcastés depuis la route POST /place
  });
};
