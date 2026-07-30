const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve files from public/ directory (complete working version)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

let waitingPlayer = null;
const rooms = new Map();
const roomCodes = new Map(); // code -> roomId mapping

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoom(playerOne, playerTwo) {
  const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const room = {
    id: roomId,
    players: [
      { id: playerOne.socket.id, name: playerOne.name, symbol: 'X' },
      { id: playerTwo.socket.id, name: playerTwo.name, symbol: 'O' },
    ],
    board: Array(9).fill(''),
    currentPlayer: 'X',
    status: 'playing',
    winner: null,
    message: 'The game has started!',
  };

  rooms.set(roomId, room);
  playerOne.socket.join(roomId);
  playerTwo.socket.join(roomId);

  playerOne.socket.data.roomId = roomId;
  playerTwo.socket.data.roomId = roomId;

  const firstPlayerPayload = {
    roomId,
    board: room.board,
    currentPlayer: room.currentPlayer,
    symbol: 'X',
    opponentName: playerTwo.name,
    yourTurn: true,
    status: room.status,
    winner: room.winner,
    message: 'You are X. Make the first move.',
  };

  const secondPlayerPayload = {
    roomId,
    board: room.board,
    currentPlayer: room.currentPlayer,
    symbol: 'O',
    opponentName: playerOne.name,
    yourTurn: false,
    status: room.status,
    winner: room.winner,
    message: 'You are O. Wait for your turn.',
  };

  playerOne.socket.emit('gameStart', firstPlayerPayload);
  playerTwo.socket.emit('gameStart', secondPlayerPayload);
  io.to(roomId).emit('gameState', {
    roomId,
    board: room.board,
    currentPlayer: room.currentPlayer,
    status: room.status,
    winner: room.winner,
    message: room.message,
  });
}

function checkWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
}

io.on('connection', (socket) => {
  // Existing queue-based matchmaking
  socket.on('joinQueue', ({ name }) => {
    const playerName = (name || '').trim() || `Player ${socket.id.slice(0, 4)}`;
    socket.data.name = playerName;

    if (waitingPlayer) {
      const opponent = waitingPlayer;
      waitingPlayer = null;
      createRoom(opponent, { socket, name: playerName });
      return;
    }

    waitingPlayer = { socket, name: playerName };
    socket.emit('status', { message: 'Waiting for another player...' });
  });

  // Code-based room creation (host)
  socket.on('createRoom', ({ name }) => {
    const playerName = (name || '').trim() || `Player ${socket.id.slice(0, 4)}`;
    socket.data.name = playerName;

    let code = generateRoomCode();
    // Ensure unique code
    while (roomCodes.has(code)) {
      code = generateRoomCode();
    }

    const roomId = `code-room-${code}`;
    const room = {
      id: roomId,
      code: code,
      host: socket.id,
      players: [
        { id: socket.id, name: playerName, symbol: 'X' },
      ],
      board: Array(9).fill(''),
      currentPlayer: 'X',
      status: 'waiting', // waiting for opponent
      winner: null,
      message: 'Waiting for opponent to join...',
    };

    rooms.set(roomId, room);
    roomCodes.set(code, roomId);
    socket.join(roomId);
    socket.data.roomId = roomId;

    socket.emit('roomCreated', { code, roomId });
    socket.emit('status', { message: 'Room created! Share the code with your friend.' });
  });

  // Code-based room joining (joiner)
  socket.on('joinRoom', ({ code, name }) => {
    const normalizedCode = (code || '').trim().toUpperCase().slice(0, 6);
    if (!normalizedCode) {
      socket.emit('status', { message: 'Please enter a valid code.' });
      return;
    }

    const roomId = roomCodes.get(normalizedCode);
    if (!roomId) {
      socket.emit('status', { message: 'Invalid code. No room found.' });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('status', { message: 'Room no longer exists.' });
      roomCodes.delete(normalizedCode);
      return;
    }

    if (room.status !== 'waiting') {
      socket.emit('status', { message: 'Room is already full or game in progress.' });
      return;
    }

    const playerName = (name || '').trim() || `Player ${socket.id.slice(0, 4)}`;
    socket.data.name = playerName;

    // Add joiner as player O
    room.players.push({ id: socket.id, name: playerName, symbol: 'O' });
    room.status = 'playing';
    room.message = 'Game started! X goes first.';

    socket.join(roomId);
    socket.data.roomId = roomId;

    // Notify both players
    const hostPlayer = room.players[0];
    const joinerPlayer = room.players[1];

    io.to(hostPlayer.id).emit('gameStart', {
      roomId,
      board: room.board,
      currentPlayer: room.currentPlayer,
      symbol: 'X',
      opponentName: playerName,
      yourTurn: true,
      status: room.status,
      winner: room.winner,
      message: 'Your opponent joined! You are X. Make the first move.',
    });

    io.to(joinerPlayer.id).emit('gameStart', {
      roomId,
      board: room.board,
      currentPlayer: room.currentPlayer,
      symbol: 'O',
      opponentName: room.hostName || hostPlayer.name,
      yourTurn: false,
      status: room.status,
      winner: room.winner,
      message: 'You joined the game! You are O. Wait for your turn.',
    });

    // Store host name for reference
    room.hostName = hostPlayer.name;

    io.to(roomId).emit('gameState', {
      roomId,
      board: room.board,
      currentPlayer: room.currentPlayer,
      status: room.status,
      winner: room.winner,
      message: room.message,
    });
  });

  socket.on('makeMove', ({ roomId, index }) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== 'playing') {
      return;
    }

    const player = room.players.find((entry) => entry.id === socket.id);
    if (!player) {
      return;
    }

    if (room.currentPlayer !== player.symbol) {
      socket.emit('status', { message: 'Wait for your turn.' });
      return;
    }

    if (room.board[index] !== '') {
      socket.emit('status', { message: 'That square is already taken.' });
      return;
    }

    room.board[index] = player.symbol;
    const winner = checkWinner(room.board);

    if (winner) {
      room.status = 'finished';
      room.winner = winner;
      room.message = `${winner === 'X' ? 'X' : 'O'} wins!`;
      io.to(roomId).emit('gameState', {
        roomId,
        board: room.board,
        currentPlayer: room.currentPlayer,
        status: room.status,
        winner: room.winner,
        message: room.message,
      });
      return;
    }

    if (room.board.every(Boolean)) {
      room.status = 'draw';
      room.message = 'It is a draw!';
      io.to(roomId).emit('gameState', {
        roomId,
        board: room.board,
        currentPlayer: room.currentPlayer,
        status: room.status,
        winner: null,
        message: room.message,
      });
      return;
    }

    room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
    room.message = `${room.currentPlayer === 'X' ? 'X' : 'O'} turn`;
    io.to(roomId).emit('gameState', {
      roomId,
      board: room.board,
      currentPlayer: room.currentPlayer,
      status: room.status,
      winner: room.winner,
      message: room.message,
    });
  });

  socket.on('disconnect', () => {
    // Queue matchmaking
    if (waitingPlayer && waitingPlayer.socket.id === socket.id) {
      waitingPlayer = null;
      return;
    }

    const roomId = socket.data.roomId;
    if (!roomId) {
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      return;
    }

    // If it's a code-based room, clean up the code mapping
    if (room.code) {
      roomCodes.delete(room.code);
    }

    const opponent = room.players.find((player) => player.id !== socket.id);
    if (opponent) {
      io.to(opponent.id).emit('status', { message: 'Your opponent left the game.' });
    }
    rooms.delete(roomId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
