import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "./scripts/socket";
import { db, auth } from "./scripts/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState(null);

  const localVideoRef = useRef();
  const localStreamRef = useRef();
  const peerConnections = useRef({});
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe1 = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
    });

    return () => unsubscribe1();
  }, [roomId]);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login");
      } else {
        setUserEmail(user.email);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!userEmail) return;

    const startLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoRef.current.srcObject = stream;
        localStreamRef.current = stream;

        if (!socket.connected) socket.connect();
        socket.emit("join-room", { roomId, email: userEmail });
      } catch (err) {
        console.error("Cannot access camera/microphone:", err);
        alert("Cannot access camera/microphone.");
      }
    };

    

    startLocalStream();

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

  const createPeerConnection = (peerId) => {
    if (peerConnections.current[peerId]) return peerConnections.current[peerId];

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

    localStreamRef.current?.getTracks().forEach(track => {
      if (!pc.getSenders().some(sender => sender.track === track)) pc.addTrack(track, localStreamRef.current);
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
    localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = !track.enabled });
    setIsMuted(prev => !prev);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(track => { track.enabled = !track.enabled });
    setIsVideoOff(prev => !prev);
  };

  async function sendMessage(e) {
    e.preventDefault();
    if (newMessage.trim() === "") return;

    await addDoc(collection(db, "rooms", roomId, "messages"), {
      text: newMessage,
      sender: auth.currentUser?.email || "Anonymous",
      createdAt: serverTimestamp(),
    });

    setNewMessage("");
  }


  return (
    <div>
    <div className="room-container">
      <h2>Room: {roomId}</h2>
      <div className="videos">
        <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
        {remoteStreams.map(remote => <RemoteVideo key={remote.id} stream={remote.stream} />)}
      </div>
      <div className="controls">
        <button onClick={leaveRoom}>Leave Room</button>
        <button onClick={toggleVideo}>{isVideoOff ? "Start Video" : "Stop Video"}</button>
        <button onClick={toggleMute}>{isMuted ? "Unmute" : "Mute"}</button>
      </div>
    </div>

    <div className="flex flex-col h-screen p-4">
      <h2 className="text-xl font-bold mb-2">Room: {roomId}</h2>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto border rounded p-2 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className="p-2 rounded bg-gray-200">
            <strong>{msg.sender}:</strong> {msg.text}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex mt-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1 border rounded-l px-2"
          placeholder="Type your message..."
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 rounded-r"
        >
          Send
        </button>
      </form>
    </div>
    </div>
  );

}

function RemoteVideo({ stream }) {
  const ref = useRef();
  useEffect(() => { ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline className="remote-video" />;
}
