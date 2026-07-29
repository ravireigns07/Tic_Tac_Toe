const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const enterBtn = document.getElementById('enterBtn');
const soloBtn = document.getElementById('soloBtn');
const resetBtn = document.getElementById('resetBtn');
const codeInput = document.getElementById('codeInput');
const codeInputRow = document.getElementById('codeInputRow');
const codeLabel = document.getElementById('codeLabel');
const shareCodeBox = document.getElementById('shareCodeBox');
const statusEl = document.getElementById('status');
const turnInfo = document.getElementById('turnInfo');
const playerInfo = document.getElementById('playerInfo');
const nameInput = document.getElementById('nameInput');
const nameSubmitBtn = document.getElementById('nameSubmitBtn');
const setupPanel = document.getElementById('setupPanel');
const gamePanel = document.getElementById('gamePanel');
const gameCard = document.getElementById('gameCard');
const exitBtn = document.getElementById('exitBtn');
const setupStatus = document.getElementById('setupStatus');
const myNameLabel = document.getElementById('myNameLabel');
const opponentNameLabel = document.getElementById('opponentNameLabel');
const myScoreEl = document.getElementById('myScore');
const opponentScoreEl = document.getElementById('opponentScore');
const scoreSummaryEl = document.getElementById('scoreSummary');
const cells = Array.from(document.querySelectorAll('.cell'));

let peer;
let connection;
let myId = '';
let gameCode = '';
let playerName = '';
let mySymbol = 'X';
let opponentSymbol = 'O';
let board = Array(9).fill('');
let myTurn = true;
let gameOver = false;
let opponentName = 'Opponent';
let isSoloMode = false;
let isHostSession = false;
let myWins = 0;
let opponentWins = 0;
let draws = 0;
let winningLine = [];
let lastWinner = null;
let winHighlightType = null;
let nextStarter = 'X';

function setStatus(message) {
  statusEl.textContent = message;
}

function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function normalizeGameCode(value) {
  return value.trim().toUpperCase().slice(0, 6);
}

function updateEnterButtonVisibility() {
  const code = codeInput.value.trim();
  enterBtn.classList.toggle('hidden', !code);
}

function showJoinInput() {
  codeInputRow.classList.remove('hidden');
  codeLabel.classList.remove('hidden');
  enterBtn.classList.remove('hidden');
}

function hideJoinInput() {
  codeInputRow.classList.add('hidden');
  codeLabel.classList.add('hidden');
  enterBtn.classList.add('hidden');
  codeInput.value = '';
}

function showShareCode(code) {
  shareCodeBox.textContent = code;
  shareCodeBox.classList.remove('hidden');
}

function hideShareCode() {
  shareCodeBox.textContent = '';
  shareCodeBox.classList.add('hidden');
}

function updateScoreCard() {
  myNameLabel.textContent = playerName || 'You';
  opponentNameLabel.textContent = isSoloMode ? 'Computer' : (opponentName || 'Opponent');
  if (gameCard.classList.contains('hidden')) {
    return;
  }
  myScoreEl.textContent = myWins;
  opponentScoreEl.textContent = isSoloMode ? opponentWins : opponentWins;
  scoreSummaryEl.textContent = draws;
}

function updatePlayerInfoDisplay() {
  if (isSoloMode) {
    playerInfo.textContent = `You: ${playerName} (X) | Computer: O`;
    return;
  }

  const otherName = opponentName || 'Opponent';
  playerInfo.textContent = `You: ${playerName} (${mySymbol}) | ${otherName} (${opponentSymbol})`;
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
  codeInput.value = '';
  setStatus('');
  playerName = '';
  nameInput.value = '';
  connection = null;
  peer = null;
  myId = '';
  gameCode = '';
  opponentName = 'Opponent';
  myWins = 0;
  opponentWins = 0;
  draws = 0;
  board = Array(9).fill('');
  gameOver = false;
  winningLine = [];
  lastWinner = null;
  winHighlightType = null;
  myTurn = true;
  isSoloMode = false;
  isHostSession = false;
  mySymbol = 'X';
  opponentSymbol = 'O';
  nextStarter = 'X';
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
  updatePlayerInfoDisplay();
  updateScoreCard();
  hideShareCode();
  hideJoinInput();
  setStatus('Choose a mode to begin.');
}

function renderBoard() {
  cells.forEach((cell, index) => {
    cell.textContent = board[index];
    cell.classList.toggle('winning-cell', winningLine.includes(index));
    cell.classList.toggle('my-win', winningLine.includes(index) && winHighlightType === 'mine');
    cell.classList.toggle('opponent-win', winningLine.includes(index) && winHighlightType === 'opponent');
    cell.disabled = Boolean(board[index]) || gameOver || (!myTurn && !isSoloMode);
  });
}

function showCelebration(message) {
  turnInfo.textContent = message;
}

function autoResetGame() {
  setTimeout(() => {
    resetGame();
  }, 1200);
}

function resetGame() {
  board = Array(9).fill('');
  gameOver = false;
  winningLine = [];
  lastWinner = null;
  winHighlightType = null;
  myTurn = mySymbol === nextStarter;
  updateScoreCard();
  if (isSoloMode) {
    turnInfo.textContent = myTurn ? 'Your turn' : 'Computer turn';
  } else {
    turnInfo.textContent = myTurn ? 'Your turn' : 'Opponent turn';
  }
  renderBoard();
  if (isSoloMode && !myTurn) {
    setTimeout(makeComputerMove, 600);
  }
}

function checkWinner(boardState = board) {
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

  return { winner: null, line: [] };
}

function updateScoreAfterRound(result) {
  if (result === 'win') {
    myWins += 1;
  } else if (result === 'loss') {
    opponentWins += 1;
  } else if (result === 'draw') {
    draws += 1;
  }
  updateScoreCard();
}

function handleMove(index) {
  if (board[index] || gameOver || (!myTurn && !isSoloMode)) {
    return;
  }

  board[index] = mySymbol;

  const result = checkWinner();
  winningLine = result.line;
  lastWinner = result.winner;
  const winner = result.winner;
  renderBoard();

  if (winner) {
    gameOver = true;
    winHighlightType = winner === mySymbol ? 'mine' : 'opponent';
    if (winner === mySymbol) {
      showCelebration('🎉 Joy!');
    } else {
      showCelebration('😢 Loss');
    }
    nextStarter = winner;
    if (winner === mySymbol) {
      updateScoreAfterRound('win');
    } else {
      updateScoreAfterRound('loss');
    }
    setStatus(winner === mySymbol ? 'You won!' : 'Computer won.');
    if (!isSoloMode && connection) {
      connection.send({ type: 'game-over', board, winner });
    }
    autoResetGame();
    return;
  }

  if (board.every(Boolean)) {
    gameOver = true;
    showCelebration('✨ Draw');
    updateScoreAfterRound('draw');
    setStatus('It is a draw.');
    if (!isSoloMode && connection) {
      connection.send({ type: 'draw', board });
    }
    autoResetGame();
    return;
  }

  if (isSoloMode) {
    myTurn = false;
    turnInfo.textContent = 'Computer thinking...';
    setTimeout(makeComputerMove, 600);
  } else {
    myTurn = false;
    turnInfo.textContent = 'Opponent turn';
    connection.send({ type: 'move', index, board });
  }
}

function makeComputerMove() {
  const emptyIndexes = board.map((value, index) => (value === '' ? index : -1)).filter((index) => index !== -1);
  if (emptyIndexes.length === 0) {
    return;
  }

  const winningMove = getBestMove(opponentSymbol);
  const blockingMove = getBestMove(mySymbol);
  const centerMove = 4;

  let bestMove = null;

  if (winningMove !== null) {
    bestMove = winningMove;
  } else if (blockingMove !== null && board[centerMove] === '') {
    bestMove = centerMove;
  } else if (blockingMove !== null) {
    bestMove = blockingMove;
  } else if (board[centerMove] === '') {
    bestMove = centerMove;
  } else {
    bestMove = emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
  }

  board[bestMove] = opponentSymbol;

  const result = checkWinner();
  winningLine = result.line;
  lastWinner = result.winner;
  const winner = result.winner;
  renderBoard();

  if (winner) {
    gameOver = true;
    nextStarter = winner;
    showCelebration('😢 Loss');
    updateScoreAfterRound('loss');
    setStatus('Computer won.');
    autoResetGame();
    return;
  }

  if (board.every(Boolean)) {
    gameOver = true;
    showCelebration('✨ Draw');
    updateScoreAfterRound('draw');
    setStatus('It is a draw.');
    autoResetGame();
    return;
  }

  myTurn = true;
  turnInfo.textContent = 'Your turn';
  renderBoard();
}

function getBestMove(symbol) {
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
    const values = [board[a], board[b], board[c]];
    const empties = [a, b, c].filter((index) => board[index] === '');
    if (values.filter((value) => value === symbol).length === 2 && empties.length === 1) {
      return empties[0];
    }
  }

  return null;
}

function startPeer(peerId = null, updateCodeField = false) {
  const idToUse = peerId || generateGameCode();
  peer = new Peer(idToUse);
  peer.on('open', (id) => {
    myId = id;
    gameCode = id;
    if (updateCodeField) {
      setStatus('Your game code is ready. Share it with your friend.');
    } else {
      setStatus('Connecting to the game...');
    }
    updatePlayerInfoDisplay();
  });

  peer.on('error', (err) => {
    console.error(err);
    if (err.type === 'unavailable') {
      setStatus('This code is already taken. Please try another one.');
    } else {
      setStatus('Could not start the game.');
    }
  });

  peer.on('connection', (conn) => {
    connection = conn;
    connection.on('open', () => {
      connection.send({ type: 'player-info', name: playerName });
    });
    connection.on('data', (data) => {
      if (data.type === 'player-info') {
        opponentName = data.name;
        updatePlayerInfoDisplay();
        updateScoreCard();
        return;
      }

      if (data.type === 'move') {
        board[data.index] = opponentSymbol;
        myTurn = true;
        turnInfo.textContent = 'Your turn';
        renderBoard();
      }

      if (data.type === 'game-over') {
        board = data.board;
        const result = checkWinner(board);
        winningLine = result.line;
        lastWinner = result.winner;
        winHighlightType = 'opponent';
        gameOver = true;
        nextStarter = data.winner;
        showCelebration('😢 Loss');
        updateScoreAfterRound('loss');
        setStatus('Your opponent won.');
        renderBoard();
      }

      if (data.type === 'draw') {
        board = data.board;
        gameOver = true;
        winHighlightType = null;
        showCelebration('✨ Draw');
        updateScoreAfterRound('draw');
        setStatus('It is a draw.');
        renderBoard();
      }
    });

    showActiveGameUi();
    setStatus('Connected! Your friend joined.');
    updatePlayerInfoDisplay();
    opponentName = opponentName || 'Opponent';
    updateScoreCard();
    turnInfo.textContent = 'Your turn';
    myTurn = true;
    resetGame();
  });
}

nameSubmitBtn.addEventListener('click', startGameUi);
nameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    startGameUi();
  }
});

codeInput.addEventListener('input', () => {
  codeInput.value = normalizeGameCode(codeInput.value);
  updateEnterButtonVisibility();

  if (!isHostSession && !isSoloMode && !connection && codeInput.value.length === 6) {
    connectToGame(codeInput.value);
  }
});

createBtn.addEventListener('click', () => {
  if (!playerName) {
    setStatus('Enter your name first.');
    return;
  }

  hideJoinInput();
  isHostSession = true;
  isSoloMode = false;
  mySymbol = 'X';
  opponentSymbol = 'O';
  nextStarter = 'X';
  const generatedCode = generateGameCode();
  gameCode = generatedCode;
  showShareCode(generatedCode);
  setStatus('Game created. Share this code with your friend.');
  startPeer(generatedCode, true);
});

function connectToGame(code) {
  const normalizedCode = normalizeGameCode(code);
  if (!normalizedCode) {
    setStatus('Enter a game code first.');
    return;
  }

  if (connection) {
    return;
  }

  // Clean up any existing peer before creating a new one for joining
  if (peer) {
    peer.destroy();
    peer = null;
  }

  isHostSession = false;
  mySymbol = 'O';
  opponentSymbol = 'X';

  setStatus('Connecting to the game...');

  // Create a fresh Peer with auto-generated ID (for joining, we need random ID)
  peer = new Peer(null);

  peer.on('open', () => {
    myId = peer.id;
    updatePlayerInfoDisplay();

    // Peer is now ready - connect to the host's game code
    connection = peer.connect(normalizedCode, { reliable: true });

    connection.on('open', () => {
      // Send player info first so host knows who joined
      connection.send({ type: 'player-info', name: playerName });
      setStatus('Connected!');
      showActiveGameUi();
      updatePlayerInfoDisplay();
      opponentName = opponentName || 'Opponent';
      updateScoreCard();
      turnInfo.textContent = 'Your turn';
      myTurn = false;
      resetGame();
    });

    connection.on('data', (data) => {
      if (data.type === 'player-info') {
        opponentName = data.name;
        updatePlayerInfoDisplay();
        updateScoreCard();
        return;
      }

      if (data.type === 'move') {
        board[data.index] = opponentSymbol;
        myTurn = true;
        turnInfo.textContent = 'Your turn';
        renderBoard();
      }

      if (data.type === 'game-over') {
        board = data.board;
        const result = checkWinner(board);
        winningLine = result.line;
        lastWinner = result.winner;
        winHighlightType = 'opponent';
        gameOver = true;
        nextStarter = data.winner;
        showCelebration('😢 Loss');
        updateScoreAfterRound('loss');
        setStatus('Your opponent won.');
        renderBoard();
      }

      if (data.type === 'draw') {
        board = data.board;
        gameOver = true;
        winHighlightType = null;
        showCelebration('✨ Draw');
        updateScoreAfterRound('draw');
        setStatus('It is a draw.');
        renderBoard();
      }
    });

    connection.on('error', (err) => {
      console.error('Connection error:', err);
      setStatus('Could not connect. Please check the code and try again.');
      connection = null;
    });
  });

  peer.on('error', (err) => {
    console.error('Peer error:', err);
    setStatus('Could not connect. Please check the code and try again.');
    connection = null;
  });
}

joinBtn.addEventListener('click', () => {
  if (!playerName) {
    setStatus('Enter your name first.');
    return;
  }

  showJoinInput();
  updateEnterButtonVisibility();
  setStatus('Paste your friend\'s game code to join.');
});

enterBtn.addEventListener('click', () => {
  if (!playerName) {
    setStatus('Enter your name first.');
    return;
  }
  if (!codeInput.value.trim()) {
    setStatus('Enter a game code first.');
    return;
  }
  hideShareCode();
  connectToGame(codeInput.value.trim());
});

soloBtn.addEventListener('click', () => {
  if (!playerName) {
    setStatus('Enter your name first.');
    return;
  }

  showActiveGameUi();
  hideShareCode();
  hideJoinInput();
  isHostSession = false;
  isSoloMode = true;
  mySymbol = 'X';
  opponentSymbol = 'O';
  nextStarter = 'X';
  connection = null;
  opponentName = 'Computer';
  setStatus('Playing against the computer.');
  updatePlayerInfoDisplay();
  resetGame();
});

resetBtn.addEventListener('click', () => {
  setStatus('Game reset. Choose a mode to begin.');
  resetGame();
});

exitBtn.addEventListener('click', () => {
  showHomeUi();
});

cells.forEach((cell, index) => {
  cell.addEventListener('click', () => handleMove(index));
});

renderBoard();
