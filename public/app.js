const socketOptions = {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelayMax: 3000,
  timeout: 30000,
};
const socket = (typeof io !== 'undefined' && io) ? io(socketOptions) : null;
const multiplayerEnabled = Boolean(socket);

const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const enterBtn = document.getElementById('enterBtn');
const soloBtn = document.getElementById('soloBtn');
const codeInput = document.getElementById('codeInput');
const codeInputRow = document.getElementById('codeInputRow');
const codeLabel = document.getElementById('codeLabel');
const shareCodeBox = document.getElementById('shareCodeBox');
const shareCodeValue = document.getElementById('shareCodeValue');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatPopup = document.getElementById('chatPopup');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const emojiPicker = document.getElementById('emojiPicker');
const chatCloseBtn = document.getElementById('chatCloseBtn');
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
let isSoloMode = false;
let nextStarter = 'X';

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

function setStatus(message) {
  statusEl.textContent = message;
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

function setMultiplayerLoading(loading) {
  createBtn.disabled = loading;
  joinBtn.disabled = loading;
  soloBtn.disabled = loading;
  codeInput.disabled = loading;
  enterBtn.disabled = loading;
  copyCodeBtn.disabled = loading;
}

function showShareCode(code) {
  shareCodeValue.textContent = code;
  shareCodeBox.classList.remove('hidden');
  copyCodeBtn.classList.remove('hidden');
}

function hideShareCode() {
  shareCodeValue.textContent = '';
  shareCodeBox.classList.add('hidden');
}

function updateScoreCard() {
  myNameLabel.textContent = playerName || 'You';
  opponentNameLabel.textContent = isSoloMode ? 'Computer' : (opponentName || 'Opponent');
  if (gameCard.classList.contains('hidden')) {
    return;
  }
  myScoreEl.textContent = myWins;
  opponentScoreEl.textContent = opponentWins;
  scoreSummaryEl.textContent = draws;
}

function updatePlayerInfoDisplay() {
  if (isSoloMode) {
    playerInfo.textContent = `You: ${playerName} (X) | Computer: O`;
    return;
  }
  const symbol = playerSymbol || '?';
  playerInfo.textContent = `You: ${playerName} (${symbol}) | ${opponentName} (${symbol === 'X' ? 'O' : 'X'})`;
}

function showActiveGameUi() {
  gamePanel.classList.add('hidden');
  gameCard.classList.remove('hidden');
  exitBtn.classList.remove('hidden');
}

function showLobbyUi() {
  setupPanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  gameCard.classList.add('hidden');
  exitBtn.classList.add('hidden');
  hideShareCode();
  hideJoinInput();
  setChatButtonVisible(false);
  setChatVisible(false);
  setStatus('Create a game or join with a code.');
  game = null;
  playerSymbol = null;
  opponentName = 'Opponent';
  gameOver = false;
  winningLine = [];
  winHighlightType = null;
  isSoloMode = false;
  nextStarter = 'X';
  updatePlayerInfoDisplay();
  updateScoreCard();
  renderBoard();
}

function setChatVisible(visible) {
  if (!chatPopup || !chatToggleBtn) return;
  chatPopup.classList.toggle('hidden', !visible);
  if (visible) {
    chatToggleBtn.classList.remove('chat-notify');
  }
  chatToggleBtn.classList.toggle('hidden', false);
}

function setChatButtonVisible(visible) {
  if (!chatToggleBtn) return;
  chatToggleBtn.classList.toggle('hidden', !visible);
}

function appendChatMessage(sender, message, own = false) {
  if (!chatMessages) return;
  const chatItem = document.createElement('div');
  chatItem.className = `chat-message${own ? ' own' : ''}`;
  chatItem.innerHTML = `
    <strong>${sender}</strong>
    <span>${escapeHtml(message)}</span>
  `;
  chatMessages.appendChild(chatItem);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sendChatMessage() {
  if (!chatInput || !chatInput.value.trim() || !socket || !game || !game.roomId) return;
  const message = chatInput.value.trim();
  appendChatMessage('You', message, true);
  chatInput.value = '';
  socket.timeout(20000).emit('sendChat', { roomId: game.roomId, message }, (err, response) => {
    if (err || !response || !response.success) {
      setStatus('Message may not have been delivered. Network is slow.');
    }
  });
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
  game = null;
  playerSymbol = null;
  opponentName = 'Opponent';
  myWins = 0;
  opponentWins = 0;
  draws = 0;
  gameOver = false;
  winningLine = [];
  winHighlightType = null;
  isSoloMode = false;
  setChatButtonVisible(false);
  setChatVisible(false);
  nextStarter = 'X';
  hideShareCode();
  hideJoinInput();
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
  setStatus('Create a game or join with a code.');
}

function renderBoard() {
  cells.forEach((cell, index) => {
    if (game && !isSoloMode) {
      cell.textContent = game.board[index] || '';
    } else if (isSoloMode) {
      cell.textContent = soloBoard[index] || '';
    } else {
      cell.textContent = '';
    }
    cell.classList.toggle('winning-cell', winningLine.includes(index));
    cell.classList.toggle('my-win', winningLine.includes(index) && winHighlightType === 'mine');
    cell.classList.toggle('opponent-win', winningLine.includes(index) && winHighlightType === 'opponent');
    const occupied = isSoloMode ? Boolean(soloBoard[index]) : (game && Boolean(game.board[index]));
    const active = isSoloMode ? !soloGameOver : (game && game.status === 'playing');
    const myTurn = isSoloMode ? soloMyTurn : (game && game.currentPlayer === playerSymbol);
    cell.disabled = !active || occupied || !myTurn;
  });
}

// ============ SOLO MODE (vs Computer) ============
let soloBoard = Array(9).fill('');
let soloMyTurn = true;
let soloGameOver = false;

function resetSoloGame() {
  soloBoard = Array(9).fill('');
  soloGameOver = false;
  winningLine = [];
  winHighlightType = null;
  soloMyTurn = true;
  updateScoreCard();
  turnInfo.textContent = 'Your turn';
  renderBoard();
}

function soloHandleMove(index) {
  if (soloBoard[index] || soloGameOver || !soloMyTurn) return;

  soloBoard[index] = 'X';
  const result = checkWinner(soloBoard);
  winningLine = result.line;
  const winner = result.winner;
  renderBoard();

  if (winner) {
    soloGameOver = true;
    winHighlightType = 'mine';
    myWins += 1;
    turnInfo.textContent = '🎉 Joy!';
    setStatus('You won!');
    updateScoreCard();
    setTimeout(resetSoloGame, 1200);
    return;
  }

  if (soloBoard.every(Boolean)) {
    soloGameOver = true;
    draws += 1;
    turnInfo.textContent = '✨ Draw';
    setStatus('It is a draw.');
    updateScoreCard();
    setTimeout(resetSoloGame, 1200);
    return;
  }

  soloMyTurn = false;
  turnInfo.textContent = 'Computer thinking...';
  setTimeout(makeComputerMove, 600);
}

function makeComputerMove() {
  const emptyIndexes = soloBoard.map((v, i) => (v === '' ? i : -1)).filter((i) => i !== -1);
  if (emptyIndexes.length === 0) return;

  const winningMove = getBestSoloMove('O');
  const blockingMove = getBestSoloMove('X');
  let bestMove = null;

  if (winningMove !== null) bestMove = winningMove;
  else if (blockingMove !== null) bestMove = blockingMove;
  else if (soloBoard[4] === '') bestMove = 4;
  else bestMove = emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];

  soloBoard[bestMove] = 'O';
  const result = checkWinner(soloBoard);
  winningLine = result.line;
  const winner = result.winner;
  renderBoard();

  if (winner) {
    soloGameOver = true;
    winHighlightType = 'opponent';
    opponentWins += 1;
    turnInfo.textContent = '😢 Loss';
    setStatus('Computer won.');
    updateScoreCard();
    setTimeout(resetSoloGame, 1200);
    return;
  }

  if (soloBoard.every(Boolean)) {
    soloGameOver = true;
    draws += 1;
    turnInfo.textContent = '✨ Draw';
    setStatus('It is a draw.');
    updateScoreCard();
    setTimeout(resetSoloGame, 1200);
    return;
  }

  soloMyTurn = true;
  turnInfo.textContent = 'Your turn';
  renderBoard();
}

function getBestSoloMove(symbol) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    const vals = [soloBoard[a], soloBoard[b], soloBoard[c]];
    const empties = [a, b, c].filter((i) => soloBoard[i] === '');
    if (vals.filter((v) => v === symbol).length === 2 && empties.length === 1) {
      return empties[0];
    }
  }
  return null;
}
// ============ END SOLO MODE ============

function checkWinner(boardState) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
      return { winner: boardState[a], line: [a, b, c] };
    }
  }
  return { winner: null, line: [] };
}

// ============ EVENT LISTENERS ============
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
});

createBtn.addEventListener('click', () => {
  if (!playerName) {
    setStatus('Enter your name first.');
    return;
  }
  if (!multiplayerEnabled) {
    setStatus('Multiplayer unavailable. Use vs Computer.');
    return;
  }

  hideJoinInput();
  isSoloMode = false;
  setStatus('Creating room...');
  setMultiplayerLoading(true);
  socket.timeout(20000).emit('createRoom', { name: playerName }, (err, response) => {
    setMultiplayerLoading(false);
    if (err) {
      setStatus('Network slow. Could not create room yet. Try again.');
      return;
    }
    if (!response || !response.success) {
      setStatus(response?.message || 'Could not create room. Please try again.');
      return;
    }
    setStatus(response.message || 'Room created! Share the code with your friend.');
  });
});

joinBtn.addEventListener('click', () => {
  if (!playerName) {
    setStatus('Enter your name first.');
    return;
  }
  if (!multiplayerEnabled) {
    setStatus('Multiplayer unavailable. Use vs Computer.');
    return;
  }

  showJoinInput();
  updateEnterButtonVisibility();
  setStatus('Enter your friend\'s game code.');
});

enterBtn.addEventListener('click', () => {
  if (!playerName) {
    setStatus('Enter your name first.');
    return;
  }
  if (!multiplayerEnabled) {
    setStatus('Multiplayer unavailable. Use vs Computer.');
    return;
  }
  if (!codeInput.value.trim()) {
    setStatus('Enter a game code first.');
    return;
  }
  hideShareCode();
  const code = codeInput.value.trim().toUpperCase();
  setStatus('Joining game... Please wait.');
  setMultiplayerLoading(true);

  socket.timeout(15000).emit('joinRoom', { code, name: playerName }, (err, response) => {
    setMultiplayerLoading(false);
    if (err) {
      setStatus('Network slow or unavailable. Please try again or wait a moment.');
      return;
    }
    if (!response || !response.success) {
      setStatus(response?.message || 'Could not join the game. Try again.');
      return;
    }
    setStatus(response.message || 'Joined game. Waiting for the match to start...');
  });
});

// Copy code to clipboard
copyCodeBtn.addEventListener('click', () => {
  const code = shareCodeValue.textContent;
  if (!code) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      showToast('✅ Code copied! Share it with your friend.');
    }).catch(() => fallbackCopy(code));
  } else {
    fallbackCopy(code);
  }
});

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast('✅ Code copied!'); }
  catch (e) { showToast('Tap and hold to copy the code.'); }
  document.body.removeChild(ta);
}

soloBtn.addEventListener('click', () => {
  if (!playerName) {
    setStatus('Enter your name first.');
    return;
  }

  showActiveGameUi();
  hideShareCode();
  hideJoinInput();
  isSoloMode = true;
  opponentName = 'Computer';
  soloBoard = Array(9).fill('');
  soloGameOver = false;
  soloMyTurn = true;
  winningLine = [];
  winHighlightType = null;
  setStatus('Playing against the computer.');
  updatePlayerInfoDisplay();
  resetSoloGame();
});

exitBtn.addEventListener('click', () => {
  if (!isSoloMode && socket && game && game.roomId) {
    socket.emit('leaveRoom', { roomId: game.roomId });
  }
  showLobbyUi();
  setChatButtonVisible(false);
  setChatVisible(false);
});

if (socket) {
  socket.on('playerLeft', () => {
    setStatus('Your opponent exited the game. Returning to menu.');
    showLobbyUi();
  });
}

cells.forEach((cell, index) => {
  cell.addEventListener('click', () => {
    if (isSoloMode) {
      soloHandleMove(index);
      return;
    }

    if (!game || game.status !== 'playing') return;
    if (game.board[index]) return;
    if (game.currentPlayer !== playerSymbol) {
      setStatus('Wait for your turn.');
      return;
    }
    socket.emit('makeMove', { roomId: game.roomId, index });
  });
});

chatSendBtn?.addEventListener('click', sendChatMessage);
chatInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    sendChatMessage();
  }
});

emojiPicker?.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || !chatInput) return;
  chatInput.value += button.textContent;
  chatInput.focus();
});

chatToggleBtn?.addEventListener('click', () => {
  setChatVisible(true);
});

chatCloseBtn?.addEventListener('click', () => {
  setChatVisible(false);
});

// ============ SOCKET EVENTS ============
if (socket) {
  socket.on('connect', () => {
    setStatus('Connected. Create a game or join with a code.');
  });

  socket.on('connect_error', () => {
    setStatus('Connection issue. Waiting to reconnect...');
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io client disconnect') return;
    setStatus('Disconnected. Trying to reconnect...');
  });

  socket.on('reconnect_attempt', (attempt) => {
    setStatus(`Reconnecting... attempt ${attempt} of 10`);
  });

  socket.on('reconnect', () => {
    setStatus('Reconnected. Waiting for game updates...');
  });

  socket.on('reconnect_failed', () => {
    setStatus('Unable to reconnect. Please refresh and try again.');
  });

  socket.on('reconnect_error', () => {
    setStatus('Reconnect failed. Network still slow.');
  });

  socket.on('status', ({ message }) => {
    setStatus(message);
  });

  socket.on('roomCreated', ({ code }) => {
    showShareCode(code);
    setStatus('Room created! Share the code with your friend.');
  });

  socket.on('playerLeft', () => {
    setStatus('Your opponent exited the game. Returning to menu.');
    showLobbyUi();
  });

  socket.on('chatMessage', ({ sender, message }) => {
    if (!sender || !message) return;
    appendChatMessage(sender, message, false);
    if (sender !== 'System' && chatPopup?.classList.contains('hidden')) {
      chatToggleBtn?.classList.add('chat-notify');
    }
  });

  socket.on('gameStart', (payload) => {
    isSoloMode = false;
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
    setStatus(`Playing against ${payload.opponentName}.`);
    updatePlayerInfoDisplay();
    updateScoreCard();
    showActiveGameUi();
    setChatButtonVisible(true);
    appendChatMessage('System', 'Chat is ready! Tap the Chat button to open it.');
    gameOver = false;
    winningLine = [];
    winHighlightType = null;
    hideShareCode();
    hideJoinInput();
    renderBoard();
  });

  socket.on('gameState', (payload) => {
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
        setStatus('You won!');
      } else {
        winHighlightType = 'opponent';
        opponentWins += 1;
        turnInfo.textContent = '😢 Loss';
        setStatus('Your opponent won.');
      }
      const result = checkWinner(payload.board);
      winningLine = result ? result.line : [];
      updateScoreCard();
      renderBoard();
      setTimeout(() => {
        game.board = Array(9).fill('');
        game.status = 'playing';
        game.currentPlayer = 'X';
        gameOver = false;
        winningLine = [];
        winHighlightType = null;
        turnInfo.textContent = 'Next round starting...';
        renderBoard();
      }, 1500);
      return;
    }

    if (payload.status === 'draw') {
      gameOver = true;
      draws += 1;
      winningLine = [];
      winHighlightType = null;
      turnInfo.textContent = '✨ Draw';
      setStatus(payload.message);
      updateScoreCard();
      renderBoard();
      setTimeout(() => {
        game.board = Array(9).fill('');
        game.status = 'playing';
        game.currentPlayer = 'X';
        gameOver = false;
        winningLine = [];
        winHighlightType = null;
        turnInfo.textContent = 'Next round starting...';
        renderBoard();
      }, 1500);
      return;
    }

    gameOver = false;
    winningLine = [];
    winHighlightType = null;
    turnInfo.textContent = payload.message;
    setStatus('Game updated.');
    updateScoreCard();
    renderBoard();
  });
} else {
  setStatus('Multiplayer unavailable on this host. Start game and use vs Computer.');
}

// Initial render
renderBoard();
