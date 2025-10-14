// Socket.IO Handler for Hangman Multiplayer

class SocketHandler {
  constructor(namespace = '/hangman') {
    this.socket = null;
    this.namespace = namespace;
    this.handlers = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Connect to server
  connect() {
    if (this.socket) return;

    this.socket = io(this.namespace);

    this.socket.on('connect', () => {
      console.log('[Socket] Connecté');
      this.reconnectAttempts = 0;
      if (this.handlers.connect) {
        this.handlers.connect();
      }
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Déconnecté');
      if (this.handlers.disconnect) {
        this.handlers.disconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Erreur de connexion:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        if (this.handlers.maxReconnectFailed) {
          this.handlers.maxReconnectFailed();
        }
      }
    });

    // Game events
    this.socket.on('roomCreated', (data) => {
      if (this.handlers.roomCreated) {
        this.handlers.roomCreated(data);
      }
    });

    this.socket.on('playerJoined', (data) => {
      if (this.handlers.playerJoined) {
        this.handlers.playerJoined(data);
      }
    });

    this.socket.on('playerLeft', (data) => {
      if (this.handlers.playerLeft) {
        this.handlers.playerLeft(data);
      }
    });

    this.socket.on('playerReady', (data) => {
      if (this.handlers.playerReady) {
        this.handlers.playerReady(data);
      }
    });

    this.socket.on('gameStarted', (data) => {
      if (this.handlers.gameStarted) {
        this.handlers.gameStarted(data);
      }
    });

    this.socket.on('letterGuessed', (data) => {
      if (this.handlers.letterGuessed) {
        this.handlers.letterGuessed(data);
      }
    });

    this.socket.on('newWord', (data) => {
      if (this.handlers.newWord) {
        this.handlers.newWord(data);
      }
    });

    this.socket.on('chatMessage', (data) => {
      if (this.handlers.chatMessage) {
        this.handlers.chatMessage(data);
      }
    });

    this.socket.on('error', (data) => {
      if (this.handlers.error) {
        this.handlers.error(data);
      }
    });
  }

  // Register event handler
  on(event, handler) {
    this.handlers[event] = handler;
  }

  // Emit events
  createRoom(mode, isPrivate = false) {
    if (!this.socket) return;
    this.socket.emit('createRoom', { mode, isPrivate });
  }

  joinRoom(roomCode) {
    if (!this.socket) return;
    this.socket.emit('joinRoom', { roomCode });
  }

  ready(roomCode) {
    if (!this.socket) return;
    this.socket.emit('ready', { roomCode });
  }

  guessLetter(roomCode, letter) {
    if (!this.socket) return;
    this.socket.emit('guessLetter', { roomCode, letter });
  }

  sendChat(roomCode, message) {
    if (!this.socket) return;
    this.socket.emit('chat', { roomCode, message });
  }

  leaveRoom(roomCode) {
    if (!this.socket) return;
    this.socket.emit('leaveRoom', { roomCode });
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Check connection status
  isConnected() {
    return this.socket && this.socket.connected;
  }
}
