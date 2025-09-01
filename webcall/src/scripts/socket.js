import { io } from "socket.io-client";

const socket = io("https://render-host-z9qz.onrender.com", {
  transports: ["websocket"],
  withCredentials: true, // if your backend uses credentials
});

socket.on("connect", () => {
  console.log("✅ Connected to backend:", socket.id);
});


export default socket;