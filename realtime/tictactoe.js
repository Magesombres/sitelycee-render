module.exports = function attachTicTacToe(io) {
  const nsp = io.of('/tictactoe');
  const rooms = new Map(); // code -> state

  const WIN_LINES = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  const winnerOf = (board) => {
    for (const [a,b,c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
  };

  const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const genCode = () => Array.from({length:5}, () => codeChars[Math.floor(Math.random()*codeChars.length)]).join('');

  const publicState = (r) => ({
    code: r.code,
    board: r.board,
    turn: r.turn,
    status: r.status, // 'playing' | 'won' | 'draw'
    names: r.names,
    winner: r.winner || null,
  });

  const findRoomBySocket = (sid) => {
    for (const r of rooms.values()) {
      if (r.players.X === sid || r.players.O === sid) return r;
    }
    return null;
  };

  nsp.on('connection', (socket) => {
    socket.on('create', ({ name } = {}) => {
      let code = genCode();
      while (rooms.has(code)) code = genCode();
      const room = {
        code,
        players: { X: socket.id, O: null },
        names: { X: (name || 'J1'), O: 'J2' },
        board: Array(9).fill(null),
        turn: 'X',
        status: 'playing',
        winner: null,
      };
      rooms.set(code, room);
      socket.join(code);
      socket.emit('created', { code, mark: 'X', state: publicState(room) });
    });

    socket.on('join', ({ code, name } = {}) => {
      const room = code ? rooms.get(String(code).toUpperCase()) : null;
      if (!room) return socket.emit('error_msg', 'Salle introuvable');
      if (room.players.O) return socket.emit('error_msg', 'Salle complète');
      room.players.O = socket.id;
      room.names.O = name || 'J2';
      socket.join(room.code);
      nsp.to(room.code).emit('state', publicState(room));
      socket.emit('joined', { code: room.code, mark: 'O', state: publicState(room) });
    });

    socket.on('play', ({ code, idx, mark }) => {
      const room = rooms.get(String(code).toUpperCase());
      if (!room || room.status !== 'playing') return;
      if (idx < 0 || idx > 8) return;
      const isPlayer =
        (mark === 'X' && room.players.X === socket.id) ||
        (mark === 'O' && room.players.O === socket.id);
      if (!isPlayer) return;
      if (room.turn !== mark) return;
      if (room.board[idx]) return;

      room.board[idx] = mark;
      const w = winnerOf(room.board);
      if (w) {
        room.status = 'won';
        room.winner = w;
      } else if (room.board.every(Boolean)) {
        room.status = 'draw';
      } else {
        room.turn = mark === 'X' ? 'O' : 'X';
      }
      nsp.to(room.code).emit('state', publicState(room));
    });

    socket.on('reset', ({ code }) => {
      const room = rooms.get(String(code).toUpperCase());
      if (!room) return;
      // reset seulement si 2 joueurs
      if (!room.players.X || !room.players.O) return;
      room.board = Array(9).fill(null);
      room.turn = 'X';
      room.status = 'playing';
      room.winner = null;
      nsp.to(room.code).emit('state', publicState(room));
    });

    socket.on('leave', ({ code }) => {
      const room = code ? rooms.get(String(code).toUpperCase()) : findRoomBySocket(socket.id);
      if (!room) return;
      nsp.to(room.code).emit('room_closed');
      rooms.delete(room.code);
      nsp.in(room.code).socketsLeave(room.code);
    });

    socket.on('disconnect', () => {
      const room = findRoomBySocket(socket.id);
      if (!room) return;
      nsp.to(room.code).emit('room_closed');
      rooms.delete(room.code);
      nsp.in(room.code).socketsLeave(room.code);
    });
  });
};