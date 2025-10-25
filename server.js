// server.js
const express = require("express");
const { WebSocketServer } = require("ws");
const http = require("http");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let rooms = {}; // har bir xonada 2ta o'yinchi bo'ladi

wss.on("connection", (ws) => {
  let roomId = null;

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    // foydalanuvchini xonaga qo'shish
    if (data.type === "join") {
      roomId = data.room;
      if (!rooms[roomId]) rooms[roomId] = [];
      rooms[roomId].push(ws);

      console.log(`Yangi foydalanuvchi xonaga kirdi: ${roomId}`);

      if (rooms[roomId].length === 2) {
        rooms[roomId].forEach((client, i) =>
          client.send(
            JSON.stringify({
              type: "start",
              player: i === 0 ? "oq" : "qora",
              msg: "O'yin boshlandi!",
            })
          )
        );
      }
    }

    // yurishlarni yuborish
    if (data.type === "move" && roomId) {
      rooms[roomId]
        .filter((c) => c !== ws)
        .forEach((client) => client.send(JSON.stringify(data)));
    }
  });

  ws.on("close", () => {
    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter((c) => c !== ws);
      if (rooms[roomId].length === 0) delete rooms[roomId];
    }
  });
});

app.get("/", (req, res) => {
  res.send("Shashka WebSocket server ishlayapti ✅");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ishga tushdi: ${PORT}`));
