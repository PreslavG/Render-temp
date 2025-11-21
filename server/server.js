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
const userToSocket = {};   
const roomAdmins = {};    

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, email, userId, adminId }) => {
    if (!rooms[roomId]) rooms[roomId] = new Set();

    socket.emit("existing-users", Array.from(rooms[roomId]));

    rooms[roomId].add(socket.id);
    socket.join(roomId);

    userToSocket[userId] = socket.id;
    socket.userId = userId;
    socket.roomId = roomId;
    socket.email = email;

    if (!roomAdmins[roomId]) {
      roomAdmins[roomId] = adminId;
    }

    socket.to(roomId).emit("user-joined", { peerId: socket.id, email });
  });

  socket.on("offer", ({ to, offer }) =>
    io.to(to).emit("offer", { from: socket.id, offer })
  );

  socket.on("answer", ({ to, answer }) =>
    io.to(to).emit("answer", { from: socket.id, answer })
  );

  socket.on("ice-candidate", ({ to, candidate }) =>
    io.to(to).emit("ice-candidate", { from: socket.id, candidate })
  );

  socket.on("timer-action", ({ action, roomId }) => {
    const adminId = roomAdmins[roomId];
    const adminSocketId = userToSocket[adminId];

    if (adminSocketId) {
      io.to(adminSocketId).emit("admin-apply-timer-action", { action });
    }
  });

  socket.on("leave-room", () => {
    const roomId = socket.roomId;
    if (roomId) {
      rooms[roomId]?.delete(socket.id);
      socket.leave(roomId);
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
