import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  autoConnect : false,
  transports: ["websocket"],
  withCredentials: true, // if your backend uses credentials
});

socket.on("connect", () => {
  console.log("✅ Connected to backend:", socket.id);
});


export default socket;