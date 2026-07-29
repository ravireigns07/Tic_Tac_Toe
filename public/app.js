const socket = io({ transports: ['websocket', 'polling'] });

const nameInput = document.getElementById('nameInput');
const nameSubmitBtn = document.getElementById('nameSubmitBtn');
const setupPanel = document.getElementById('setupPanel');
const setupStatus = document.getElementById('setupStatus');
const gamePanel = document.getElementById('gamePanel');
const gameCard = document.getElementById('gameCard');
const joinBtn = document.getElementById('joinBtn');
const resetBtn = document.getElementById('resetBtn');
const exitBtn = document.getElementById('exitBtn');
const statusEl = document.getElementById('status');
const turnInfo = document.getElementById('turnInfo');
const playerInfo = document.getElementById('playerInfo');
const myNameLabel = document.getElementById('myNameLabel');
const opponentNameLabel = document.getElementById('opponentNameLabel');
const myScoreEl = document.getElementById('myScore');
const opponentScoreEl = document.getElementById('opponentScore');
const scoreSummaryEl = document.getElementById('scoreSummary');
const cells = Array.from(document.querySelectorAll('.cell'));

let game = null;
let playerSymbol = null;
let playerName = '';
let opponentName = 'Opponent';
let myWins = 0;
let opponentWins = 0;
let draws = 0;
let gameOver = false;
let winningLine = [];
let winHighlightType = null;

function setStatus(message) {
  statusEl.textContent = message;
}

function updateScoreCard() {
  myNameLabel.textContent = playerName || 'You';
  opponentNameLabel.textContent = opponentName || 'Opponent';
  myScoreEl.textContent = myWins;
  opponentScoreEl.textContent = opponentWins;
  scoreSummaryEl.textContent = draws;
}

function updatePlayerInfoDisplay() {
  const symbol = playerSymbol || '?';
  playerInfo.textContent = `You: ${playerName} (${symbol}) | ${opponentName} (${symbol === 'X' ? 'O' : 'X'})`;
}

function showActiveGameUi() {
  gamePanel.classList.add('hidden');
  gameCard.classList.remove('hidden');
  exitBtn.classList.remove('hidden');
}

function showHomeUi() {
  setupPanel.classList.remove('hidden');
  gamePanel.classList.add('hidden');
  gameCard.classList.add('hidden');
  exitBtn.classList.add('hidden');
  setupStatus.textContent = 'Enter your name to begin.';
  setStatus('');
  playerName = '';
  nameInput.value = '';
  game = null;
  playerSymbol = null;
  opponentName = 'Opponent';
  myWins = 0;
  opponentWins = 0;
  draws = 0;
  gameOver = false;
  winningLine = [];
  winHighlightType = null;
  updateScoreCard();
  renderBoard();
}

function startGameUi() {
  const name = nameInput.value.trim();
  if (!name) {
    setupStatus.textContent = 'Please enter your name first.';
    return;
  }

  playerName = name;
  setupPanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  gameCard.classList.add('hidden');
  exitBtn.classList.add('hidden');
  setupStatus.textContent = '';
  updateScoreCard();
  setStatus('Enter a name to start playing.');
}

function renderBoard() {
  cells.forEach((cell, index) => {
    if (game) {
      const value = game.board[index] || '';
      cell.textContent = value;
    } else {
      cell.textContent = '';
    }
    cell.classList.toggle('winning-cell', winningLine.includes(index));
    cell.classList.toggle('my-win', winningLine.includes(index) && winHighlightType === 'mine');
    cell.classList.toggle('opponent-win', winningLine.includes(index) && winHighlightType === 'opponent');
    const cellOccupied = game && Boolean(game.board[index]);
    const gameActive = game && game.status === 'playing';
    const myTurn = game && game.currentPlayer === playerSymbol;
    cell.disabled = !game || cellOccupied || !gameActive || !myTurn;
  });
}

nameSubmitBtn.addEventListener('click', startGameUi);
nameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    startGameUi();
  }
});

joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name && !playerName) {
    setStatus('Please enter your name.');
    return;
  }

  if (!playerName) {
    playerName = nameInput.value.trim() || `Player ${Math.random().toString(36).slice(2, 6)}`;
  }

  playerInfo.textContent = `You: ${playerName}`;
  updateScoreCard();
  socket.emit('joinQueue', { name: playerName });
});

resetBtn.addEventListener('click', () => {
  showHomeUi();
});

exitBtn.addEventListener('click', () => {
  showHomeUi();
});

cells.forEach((cell) => {
  cell.addEventListener('click', () => {
    if (!game || game.status !== 'playing') {
      return;
    }

    const index = Number(cell.dataset.index);
    if (game.board[index]) {
      return;
    }

    if (game.currentPlayer !== playerSymbol) {
      statusEl.textContent = 'Wait for your turn.';
      return;
    }

    socket.emit('makeMove', { roomId: game.roomId, index });
  });
});

socket.on('connect', () => {
  statusEl.textContent = 'Connected. Enter your name to find a match.';
});

socket.on('connect_error', () => {
  statusEl.textContent = 'Connection issue. Please refresh and try again.';
});

socket.on('status', ({ message }) => {
  statusEl.textContent = message;
});

socket.on('gameStart', (payload) => {
  game = {
    roomId: payload.roomId,
    board: payload.board,
    currentPlayer: payload.currentPlayer,
    status: payload.status,
    winner: payload.winner,
    message: payload.message,
  };
  playerSymbol = payload.symbol;
  opponentName = payload.opponentName;
  turnInfo.textContent = payload.message;
  statusEl.textContent = `Match found! Playing against ${payload.opponentName}.`;
  updatePlayerInfoDisplay();
  updateScoreCard();
  showActiveGameUi();
  gameOver = false;
  winningLine = [];
  winHighlightType = null;
  renderBoard();
});

socket.on('gameState', (payload) => {
  const prevStatus = game ? game.status : null;
  game = {
    roomId: payload.roomId,
    board: payload.board,
    currentPlayer: payload.currentPlayer,
    status: payload.status,
    winner: payload.winner,
    message: payload.message,
  };

  if (payload.status === 'finished') {
    gameOver = true;
    const winner = payload.winner;
    if (winner === playerSymbol) {
      winHighlightType = 'mine';
      myWins += 1;
      turnInfo.textContent = '🎉 Joy!';
      statusEl.textContent = 'You won!';
    } else {
      winHighlightType = 'opponent';
      opponentWins += 1;
      turnInfo.textContent = '😢 Loss';
      statusEl.textContent = 'Your opponent won.';
    }
    // Compute winning line for highlighting
    const result = computeWinner(payload.board);
    winningLine = result ? result.line : [];
    updateScoreCard();
    renderBoard();
    autoResetGame();
    return;
  }

  if (payload.status === 'draw') {
    gameOver = true;
    draws += 1;
    winningLine = [];
    winHighlightType = null;
    turnInfo.textContent = '✨ Draw';
    statusEl.textContent = payload.message;
    updateScoreCard();
    renderBoard();
    autoResetGame();
    return;
  }

  // Game still in progress
  gameOver = false;
  winningLine = [];
  winHighlightType = null;
  turnInfo.textContent = payload.currentPlayer === playerSymbol ? 'Your turn' : 'Opponent turn';
  statusEl.textContent = payload.message;
  renderBoard();
});

function computeWinner(boardState) {
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
    if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
      return { winner: boardState[a], line: [a, b, c] };
    }
  }

  return null;
}

function autoResetGame() {
  setTimeout(() => {
    resetForNextRound();
  }, 1500);
}

function resetForNextRound() {
  if (!game) return;
  game.board = Array(9).fill('');
  game.status = 'playing';
  game.winner = null;
  game.currentPlayer = 'X';
  gameOver = false;
  winningLine = [];
  winHighlightType = null;
  turnInfo.textContent = 'Next round starting...';
  // Wait for the server to send the next game state
  renderBoard();
}

// Initial render
renderBoard();

