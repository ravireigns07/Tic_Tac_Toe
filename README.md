# Tic Tac Toe Online

A real-time two-player tic-tac-toe game with two versions:

## Version 1: PeerJS (Standalone / GitHub Pages)
Located in the root directory (`index.html`, `app.js`, `styles.css`).
- Uses **PeerJS (WebRTC)** for peer-to-peer connection
- Features: Create Game / Join Game with shareable codes, Play vs Computer (AI)
- Score card, winning line highlighting, alternating first-player logic
- Can be hosted on **GitHub Pages** directly

### Run locally
Open the site directly in a browser, or run a simple local server:
```bash
python -m http.server 8000
```
Then open http://localhost:8000.

### Deploy to GitHub Pages
1. Push this repository to GitHub.
2. Open the repository settings.
3. Go to Pages.
4. Select the main branch as the source.
5. Save and wait for the deployment to finish.

## Version 2: Socket.io (Online Multiplayer)
Located in the `public/` directory (`public/index.html`, `public/app.js`, `public/styles.css`).
- Uses **Socket.io + Express** for real-time multiplayer via WebSockets
- Room-based matchmaking system
- Requires a Node.js server to run
- Deployable to **Render** via `render.yaml`

### Run locally
```bash
npm install
npm start
```
Then open http://localhost:3000.

### Deploy to Render
1. Push this repository to GitHub.
2. Connect your repository to Render.
3. Render will automatically detect `render.yaml` and deploy.

## Fixes Applied
- Fixed server to serve `public/` directory (Socket.io version) instead of root
- Fixed `nextStarter` alternating move logic in PeerJS multiplayer
- Fixed `winHighlightType` for proper winning line highlighting in multiplayer
- Fixed `showCelebration` function call with extra argument
- Enhanced Socket.io frontend with score tracking, exit/reset buttons, and winning line highlights

