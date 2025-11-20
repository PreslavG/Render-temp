import { io } from "socket.io-client";

const socket = io("https://backend-deploy-wwgl.onrender.com", {
  autoConnect : false,
  transports: ["websocket"],
  withCredentials: true, 
});

socket.on("connect", () => {
  console.log("✅ Connected to backend:", socket.id);
});


export default socket;