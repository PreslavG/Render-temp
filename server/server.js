import fs from "fs";
import https from "https";
import express from "express";
import { Server } from "socket.io";

// Load SSL certs
const privateKey = fs.readFileSync("./certs/privkey.pem", "utf8");
const certificate = fs.readFileSync("./certs/fullchain.pem", "utf8");
const credentials = { key: privateKey, cert: certificate };

const app = express();
const httpsServer = https.createServer(credentials, app);

const io = new Server(httpsServer, {
  cors: {
    origin: "https://your-frontend-domain.com", // frontend URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const rooms = {}; // roomId -> Set(socketId)

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, email }) => {
    if (!rooms[roomId]) rooms[roomId] = new Set();
    rooms[roomId].add(socket.id);
    socket.join(roomId);
    socket.roomId = roomId;
    socket.email = email;

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

httpsServer.listen(443, () => console.log("HTTPS Socket.IO server running on https://your-domain.com"));
