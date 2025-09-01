import React from "react";
import VideoChat from "./VideoChat";

export default function App() {
  const roomId = "my-room-1"; // hardcoded for now

  return (
    <div>
      <h1>Video Chat App</h1>
      <VideoChat roomId={roomId} />
    </div>
  );
}
