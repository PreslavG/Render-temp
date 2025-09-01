import { use, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5173/"); // Use your Render URL

export default function VideoChat() {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pcRef = useRef(); // RTCPeerConnection
  const [started, setStarted] = useState(false);

  useEffect(() => {
    pcRef.current = new RTCPeerConnection();

  });

  const startCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(track => pcRef.current.addTrack(track, stream));

    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { candidate: event.candidate, target: "target-socket-id" });
      }
    };
};

  const idteller = () => {
    socket.on("connect", () => {
      console.log("Connected with ID:", socket.id);
    })};

   const joinCall = async () => {
    const stream1 = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    remoteVideoRef.current.srcObject = stream1;
    stream1.getTracks().forEach(track => pcRef.current.addTrack(track, stream1));
   



    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { candidate: event.candidate, target: "target-socket-id1" });
      }
    };
  }
}

  return (
    <div>
      <video ref={localVideoRef} autoPlay playsInline muted width="300" />
      <video ref={remoteVideoRef} autoPlay playsInline width="300" />
      <button onClick={startCall}>Start Call</button>
      <button onClick={joinCall}>Join Call</button>   

      <button onClick={idteller}></button>
    </div>
  );

