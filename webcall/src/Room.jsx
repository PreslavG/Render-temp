import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "./scripts/socket";
import "./App.css"


export default function Room() {
  let roomId;
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState(null);

  const localVideoRef = useRef();
  const localStreamRef = useRef();
  const peerConnections = useRef({}); // peerId => RTCPeerConnection
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  
  // Main WebRTC logic
  useEffect(() => {
    if (!userEmail) return;
    alert(roomId); // wait until email is ready

    const startLocalStream = async () => {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;
      localStreamRef.current = stream;

    };
    startLocalStream();

    if (!socket.connected) socket.connect();

    // Join room
    socket.emit("join-room", { roomId, email: userEmail });

    // Event handlers
    const handleUserJoined = ({ peerId }) => handleNewPeer(peerId, true);
    const handleOffer = ({ from, offer }) => handleIncomingOffer(from, offer);
    const handleAnswer = ({ from, answer }) => handleIncomingAnswer(from, answer);
    const handleIce = ({ from, candidate }) => peerConnections.current[from]?.addIceCandidate(candidate);
    const handleUserLeft = ({ peerId }) => removePeer(peerId);

    socket.on("user-joined", handleUserJoined);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIce);
    socket.on("user-left", handleUserLeft);

    return () => {
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
      localStreamRef.current?.getTracks().forEach(track => track.stop());

      socket.emit("leave-room", { roomId });
      socket.off("user-joined", handleUserJoined);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIce);
      socket.off("user-left", handleUserLeft);
    };
  }, [roomId, userEmail]);

  // Create peer connection only once per peer
  const createPeerConnection = (peerId) => {
    if (peerConnections.current[peerId]) return peerConnections.current[peerId];

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    // Add local tracks only once
    localStreamRef.current.getTracks().forEach(track => {
      if (!pc.getSenders().some(sender => sender.track === track)) {
        pc.addTrack(track, localStreamRef.current);
      }
    });

    pc.ontrack = (event) => {
      setRemoteStreams(prev => [
        ...prev.filter(s => s.id !== peerId),
        { id: peerId, stream: event.streams[0] }
      ]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit("ice-candidate", { to: peerId, candidate: event.candidate });
    };

    peerConnections.current[peerId] = pc;
    return pc;
  };

  // Handle new peer
  const handleNewPeer = async (peerId, isOfferer) => {
    const pc = createPeerConnection(peerId);
    if (isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { to: peerId, offer });
    }
  };

  const handleIncomingOffer = async (from, offer) => {
    const pc = createPeerConnection(from);
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit("answer", { to: from, answer });
  };

  const handleIncomingAnswer = async (from, answer) => {
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

  const toggleMute = () => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsMuted(prev => !prev);
  };

  // Toggle video
  const toggleVideo = () => {
    if (!localStreamRef.current) return;

    localStreamRef.current.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsVideoOff(prev => !prev);
  };


  return (
    <div>
      <h2>{roomId}</h2>
      <video ref={localVideoRef} autoPlay playsInline width="300" />
      {remoteStreams.map(remote => (
        <RemoteVideo key={remote.id} stream={remote.stream} />
      ))}
      <button onClick={leaveRoom}>Leave Room</button>
      <button onClick={toggleVideo}>
        {isVideoOff ? "Start Video" : "Stop Video"}
      </button>

      {/* Audio toggle button */}
      <button onClick={toggleMute}>
        {isMuted ? "Unmute" : "Mute"}
      </button>

    </div>
  );
}

function RemoteVideo({ stream }) {
  const ref = useRef();
  useEffect(() => { ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline width="300" />;
}
