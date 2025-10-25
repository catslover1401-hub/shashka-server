const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname + "/public"));

const rooms = {};

function initialBoard() {
  const board = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 8; x++) {
      if ((x + y) % 2 === 1) board[y][x] = "b";
    }
  }

  for (let y = 5; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if ((x + y) % 2 === 1) board[y][x] = "w";
    }
  }

  return board;
}

function hasCapture(board, color) {
  const dir = color === "w" ? -1 : 1;
  const enemy = color === "w" ? "b" : "w";

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (board[y][x] === color) {
        const dirs = [
          { dx: 1, dy: dir },
          { dx: -1, dy: dir },
          { dx: 1, dy: -dir },
          { dx: -1, dy: -dir },
        ];
        for (const d of dirs) {
          const nx = x + d.dx;
          const ny = y + d.dy;
          const jx = x + d.dx * 2;
          const jy = y + d.dy * 2;
          if (
            nx >= 0 &&
            ny >= 0 &&
            nx < 8 &&
            ny < 8 &&
            jx >= 0 &&
            jy >= 0 &&
            jy < 8 &&
            jx < 8 &&
            board[ny][nx] === enemy &&
            !board[jy][jx]
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

io.on("connection", (socket) => {
  console.log("Yangi foydalanuvchi:", socket.id);

  socket.on("joinRoom", (roomName) => {
    socket.join(roomName);
    if (!rooms[roomName]) {
      rooms[roomName] = {
        players: [socket.id],
        board: initialBoard(),
        currentTurn: null,
        playerColors: { [socket.id]: "w" },
      };
    } else if (rooms[roomName].players.length === 1) {
      rooms[roomName].players.push(socket.id);
      rooms[roomName].playerColors[socket.id] = "b";
      rooms[roomName].currentTurn = rooms[roomName].players[0];
      io.to(roomName).emit("gameStart", rooms[roomName]);
    }

    io.to(roomName).emit("message", `Yangi foydalanuvchi kirdi: ${socket.id}`);
  });

  socket.on("move", ({ room, from, to }) => {
    const game = rooms[room];
    if (!game) return;
    if (socket.id !== game.currentTurn) {
      socket.emit("message", "❌ Hozir sizning navbatingiz emas!");
      return;
    }

    const color = game.playerColors[socket.id];
    const piece = game.board[from.y][from.x];
    const enemy = color === "w" ? "b" : "w";

    if (!piece || piece !== color) return;

    const dx = to.x - from.x;
    const dy = to.y - from.y;

    const mustCapture = hasCapture(game.board, color);

    // oddiy yurish
    if (Math.abs(dx) === 1 && dy === (color === "w" ? -1 : 1)) {
      if (mustCapture) {
        socket.emit("message", "❌ Siz raqib toshini yeyishingiz kerak!");
        return;
      }
      if (!game.board[to.y][to.x]) {
        game.board[to.y][to.x] = color;
        game.board[from.y][from.x] = null;
      } else return;
    }

    // yeyish yurishi
    else if (Math.abs(dx) === 2 && Math.abs(dy) === 2) {
      const mx = from.x + dx / 2;
      const my = from.y + dy / 2;
      if (game.board[my][mx] === enemy && !game.board[to.y][to.x]) {
        game.board[to.y][to.x] = color;
        game.board[from.y][from.x] = null;
        game.board[my][mx] = null;
      } else return;
    } else {
      socket.emit("message", "❌ Noto‘g‘ri yurish!");
      return;
    }

    // navbatni almashtiramiz
    game.currentTurn = game.players.find((p) => p !== game.currentTurn);

    io.to(room).emit("updateBoard", {
      board: game.board,
      currentTurn: game.currentTurn,
    });
  });
});

server.listen(10000, () => console.log("Server ishga tushdi: 10000"));
