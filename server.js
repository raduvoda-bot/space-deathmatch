const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

// ── STAREA JOCULUI PE SERVER ──
const MAX_PLAYERS = 4;
let rooms = {}; // suportam o singura camera deocamdata

function createRoom() {
  return {
    players: {},      // socketId -> { id, name, shipType, ready, move }
    phase: 'lobby',   // lobby | selection | input | animating
    turn: 1,
    gameState: null,  // starea jocului dupa fiecare tura
  };
}

// Camera default
rooms['default'] = createRoom();

function getRoom() { return rooms['default']; }

function broadcast(room, msg) {
  Object.values(room.players).forEach(p => {
    if (p.ws && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(msg));
    }
  });
}

function broadcastRoomState(room) {
  const playerList = Object.values(room.players).map(p => ({
    id: p.id, name: p.name, shipType: p.shipType,
    ready: p.ready, connected: true,
    hasMove: !!p.move,
  }));
  broadcast(room, { type: 'room_state', players: playerList, phase: room.phase, turn: room.turn });
}

function checkAllReady(room) {
  const players = Object.values(room.players);
  if (players.length < 2) return false;
  return players.every(p => p.ready);
}

function checkAllMoves(room) {
  const players = Object.values(room.players);
  if (players.length < 2) return false;
  return players.every(p => !!p.move);
}

function startGame(room) {
  room.phase = 'input';
  room.turn = 1;
  // Trimitem starea initiala cu pozitiile navelor
  const playerList = Object.values(room.players);
  broadcast(room, {
    type: 'game_start',
    players: playerList.map(p => ({ id: p.id, name: p.name, shipType: p.shipType })),
    turn: room.turn,
  });
}

function executeTurn(room) {
  room.phase = 'animating';
  const moves = {};
  Object.values(room.players).forEach(p => { moves[p.id] = p.move; });

  // Trimitem toate miscarile la toti clientii — ei calculeaza animatia local
  broadcast(room, { type: 'execute_turn', moves, turn: room.turn });

  // Asteptam animatia (client trimite 'anim_done' cand termina)
  // Reset moves
  Object.values(room.players).forEach(p => { p.move = null; });
}

wss.on('connection', (ws) => {
  const room = getRoom();
  const playerCount = Object.keys(room.players).length;

  if (playerCount >= MAX_PLAYERS) {
    ws.send(JSON.stringify({ type: 'error', msg: 'Camera plina! Max 4 jucatori.' }));
    ws.close();
    return;
  }

  // Generam ID unic
  const playerId = 'p' + Date.now() + Math.floor(Math.random() * 1000);
  const playerNum = playerCount + 1;

  room.players[playerId] = {
    ws, id: playerId,
    name: `Jucător ${playerNum}`,
    shipType: null,
    ready: false,
    move: null,
  };

  ws.send(JSON.stringify({ type: 'welcome', playerId, playerNum }));
  broadcastRoomState(room);
  console.log(`Jucator conectat: ${playerId} (${playerNum}/${MAX_PLAYERS})`);

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    const player = room.players[playerId];
    if (!player) return;

    switch (msg.type) {

      case 'set_name':
        player.name = msg.name.substring(0, 20);
        broadcastRoomState(room);
        break;

      case 'select_ship':
        if (room.phase !== 'lobby' && room.phase !== 'selection') return;
        room.phase = 'selection';
        // Verificam daca nava e deja luata
        const taken = Object.values(room.players).some(p => p.id !== playerId && p.shipType === msg.shipType);
        if (taken) { ws.send(JSON.stringify({ type: 'error', msg: 'Nava deja selectata de alt jucator!' })); return; }
        player.shipType = msg.shipType;
        player.ready = false;
        broadcastRoomState(room);
        break;

      case 'set_ready':
        if (!player.shipType) { ws.send(JSON.stringify({ type: 'error', msg: 'Selecteaza o nava mai intai!' })); return; }
        player.ready = msg.ready;
        broadcastRoomState(room);
        if (checkAllReady(room)) {
          setTimeout(() => startGame(room), 1000);
        }
        break;

      case 'submit_move':
        if (room.phase !== 'input') return;
        player.move = msg.move;
        broadcastRoomState(room);
        if (checkAllMoves(room)) {
          setTimeout(() => executeTurn(room), 500);
        }
        break;

      case 'anim_done':
        // Cand un client termina animatia, verificam daca toti au terminat
        player.animDone = true;
        const allDone = Object.values(room.players).every(p => p.animDone);
        if (allDone) {
          Object.values(room.players).forEach(p => { p.animDone = false; });
          room.phase = 'input';
          room.turn++;

          // Verificam daca jocul s-a terminat
          if (msg.gameOver) {
            broadcast(room, { type: 'game_over', winner: msg.winner });
            // Reset camera
            setTimeout(() => {
              rooms['default'] = createRoom();
            }, 5000);
          } else {
            broadcast(room, { type: 'next_turn', turn: room.turn });
          }
        }
        break;

      case 'eliminate_player':
        // Un client raporteaza ca o nava a murit
        broadcast(room, { type: 'player_eliminated', eliminatedId: msg.eliminatedId });
        break;
    }
  });

  ws.on('close', () => {
    delete room.players[playerId];
    console.log(`Jucator deconectat: ${playerId}`);
    broadcast(room, { type: 'player_left', playerId });
    broadcastRoomState(room);
    // Daca camera e goala, resetam
    if (Object.keys(room.players).length === 0) {
      rooms['default'] = createRoom();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server pornit pe portul ${PORT}`);
  console.log(`Deschide http://localhost:${PORT} in browser`);
});
