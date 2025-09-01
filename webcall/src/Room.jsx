import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "./scripts/socket";

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef();
  const localStreamRef = useRef();
  const peerConnections = useRef({});
  const [remoteStreams, setRemoteStreams] = useState([]);

  useEffect(() => {
    const startLocalStream = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;
      localStreamRef.current = stream;
    };

    startLocalStream();
    socket.emit("join-room", { roomId, email: "user@example.com" }); // replace with real email

    socket.on("user-joined", ({ peerId }) => handleNewPeer(peerId, true));
    socket.on("offer", ({ from, offer }) => handleOffer(from, offer));
    socket.on("answer", ({ from, answer }) => handleAnswer(from, answer));
    socket.on("ice-candidate", ({ from, candidate }) => peerConnections.current[from]?.addIceCandidate(candidate));
    socket.on("user-left", ({ peerId }) => removePeer(peerId));

    return () => {
      Object.values(peerConnections.current).forEach(pc => pc.close());
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      socket.emit("leave-room", { roomId });
      socket.off();
    };
  }, []);

  const createPeerConnection = (peerId) => {
    if (peerConnections.current[peerId]) return peerConnections.current[peerId];
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    pc.ontrack = (event) => {
      setRemoteStreams(prev => [...prev.filter(s => s.id !== peerId), { id: peerId, stream: event.streams[0] }]);
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit("ice-candidate", { to: peerId, candidate: event.candidate });
    };
    peerConnections.current[peerId] = pc;
    return pc;
  };

  const handleNewPeer = async (peerId, isOfferer) => {
    const pc = createPeerConnection(peerId);
    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    if (isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { to: peerId, offer });
    }
  };

  const handleOffer = async (from, offer) => {
    const pc = createPeerConnection(from);
    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { to: from, answer });
  };

  const handleAnswer = async (from, answer) => {
    const pc = peerConnections.current[from];
    await pc.setRemoteDescription(answer);
  };

  const removePeer = (peerId) => {
    peerConnections.current[peerId]?.close();
    delete peerConnections.current[peerId];
    setRemoteStreams(prev => prev.filter(s => s.id !== peerId));
  };

  const leaveRoom = () => {
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    socket.emit("leave-room", { roomId });
    navigate("/lobby");
  };

  return (
    <div>
      <h2>Room: {roomId}</h2>
      <video ref={localVideoRef} autoPlay playsInline muted width="300" />
      {remoteStreams.map(remote => <RemoteVideo key={remote.id} stream={remote.stream} />)}
      <button onClick={leaveRoom}>Leave Room</button>
    </div>
  );
}

function RemoteVideo({ stream }) {
  const ref = useRef();
  useEffect(() => { ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline width="300" />;
}
