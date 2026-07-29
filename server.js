const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

let waitingPlayer = null;
const rooms = new Map();

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
