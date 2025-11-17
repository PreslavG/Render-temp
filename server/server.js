const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://frontend-deployment-nn8o.onrender.com",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.get("/", (req, res) => {
  res.send("Socket.IO server is running 🚀");
});

const rooms = {}; 

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, email }) => {
    if (!rooms[roomId]) rooms[roomId] = new Set();

    // 1️⃣ Уведомяване на новия за вече в стаята
    const existingUsers = Array.from(rooms[roomId]);
    socket.emit("existing-users", existingUsers);

    // 2️⃣ Добавяне на новия към стаята
    rooms[roomId].add(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.email = email;

    // 3️⃣ Уведомяване на останалите за новия
    socket.to(roomId).emit("user-joined", { peerId: socket.id, email });
  });

  socket.on("offer", ({ to, offer }) => io.to(to).emit("offer", { from: socket.id, offer }));
  socket.on("answer", ({ to, answer }) => io.to(to).emit("answer", { from: socket.id, answer }));
  socket.on("ice-candidate", ({ to, candidate }) => io.to(to).emit("ice-candidate", { from: socket.id, candidate }));

  socket.on("leave-room", () => {
    const roomId = socket.roomId;
    if (roomId) {
      socket.leave(roomId);
      rooms[roomId]?.delete(socket.id);
      socket.to(roomId).emit("user-left", { peerId: socket.id, email: socket.email });
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (roomId) {
      rooms[roomId]?.delete(socket.id);
      socket.to(roomId).emit("user-left", { peerId: socket.id, email: socket.email });
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
