import { io } from "socket.io-client";

export const socket = io("https://your-domain.com", {
  transports: ["websocket"],
});
