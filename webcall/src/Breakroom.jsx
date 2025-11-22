import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "./scripts/socket";
import { db, auth } from "./scripts/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import "./Breakroom.css";

export default function Breakroom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [userEmail, setUserEmail] = useState(null);

  // Video refs
  const localVideoRef = useRef();
  const localStreamRef = useRef();
  const peerConnections = useRef({});
  const [remoteStreams, setRemoteStreams] = useState([]);

  // Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Chat
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [wide, setWide] = useState(false);



  /* ------------------------ AUTH WATCH ------------------------ */
  useEffect(() => {
    return auth.onAuthStateChanged((user) => {
      if (!user) navigate("/login");
      else setUserEmail(user.email);
    });
  }, []);

  /* ------------------------ CHAT LISTENER ------------------------ */
  useEffect(() => {
    if (!userEmail || !roomId) return;

    const msgRef = collection(db, "rooms", roomId, "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);
    });

    return () => unsub();
  }, [roomId, userEmail]);

  /* ------------------------ SEND MESSAGE ------------------------ */
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await addDoc(collection(db, "rooms", roomId, "messages"), {
      text: newMessage,
      sender: userEmail,
      createdAt: serverTimestamp(),
    });

    setNewMessage("");
  };

  /* ------------------------ WEBRTC SETUP ------------------------ */
  useEffect(() => {
    if (!userEmail || !localVideoRef.current) return;

    const startLocalStream = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    } else {
      console.warn("Video element not ready yet.");
      return;
    }

    localStreamRef.current = stream;

    if (!socket.connected) socket.connect();
    socket.emit("join-room", { roomId, email: userEmail });

  } catch (err) {
    console.error("Cannot access camera/microphone:", err);
    alert("Cannot access camera/microphone.");
  }
};

  startLocalStream();

    socket.on("user-joined", ({ peerId }) => handleNewPeer(peerId, true));
    socket.on("offer", ({ from, offer }) => handleIncomingOffer(from, offer));
    socket.on("answer", ({ from, answer }) => handleIncomingAnswer(from, answer));
    socket.on("ice-candidate", ({ from, candidate }) =>
      peerConnections.current[from]?.addIceCandidate(candidate)
    );
    socket.on("user-left", ({ peerId }) => removePeer(peerId));

    return () => {
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      peerConnections.current = {};
      localStreamRef.current?.getTracks().forEach((t) => t.stop());

      socket.emit("leave-room", { roomId });
      socket.off();
    };
  }, [userEmail]);

  /* ------------------------ PEER CONNECTION ------------------------ */
  const createPeer = (peerId) => {
    if (peerConnections.current[peerId]) return peerConnections.current[peerId];

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => [
        ...prev.filter((s) => s.id !== peerId),
        { id: peerId, stream: event.streams[0] },
      ]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { to: peerId, candidate: event.candidate });
      }
    };

    peerConnections.current[peerId] = pc;
    return pc;
  };

  const handleNewPeer = async (peerId, isOfferer) => {
    const pc = createPeer(peerId);

    if (isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { to: peerId, offer });
    }
  };

  const handleIncomingOffer = async (from, offer) => {
    const pc = createPeer(from);
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
    setRemoteStreams((prev) => prev.filter((v) => v.id !== peerId));
  };

  /* ------------------------ CONTROLS ------------------------ */
  const toggleMute = () => {
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = !t.enabled));
    setIsMuted((p) => !p);
  };

  const toggleVideo = () => {
    localStreamRef.current
      ?.getVideoTracks()
      .forEach((t) => (t.enabled = !t.enabled));
    setIsVideoOff((p) => !p);
  };

  const leave = () => navigate("/lobby");

  /* ------------------------ UI ------------------------ */
  return (
    <div className="roomPage">
     <div className="room-container-break">
      <div className="videos">
        <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />

        {remoteStreams.map((r) => (
          <RemoteVideo key={r.id} stream={r.stream} />
        ))}
      </div>

      <div className="controls">
        <button onClick={leave}>Leave</button>
        <button onClick={toggleVideo}>{isVideoOff ? "Start Video" : "Stop Video"}</button>
        <button onClick={toggleMute}>{isMuted ? "Unmute" : "Mute"}</button>
      </div>

       <div className={`chatBox ${wide ? "wide" : "narrow"}`}>
        {wide ? (
          <div className="wideContent">
            <h1 className="arrow-right" onClick={() => setWide(!wide)}>❌</h1>
            <div className="messagesBox">
              {messages.map((msg) => {
                const isMe = msg.sender === userEmail;
                return (
                  <div key={msg.id} className={`message ${isMe ? "message-me" : "message-other"}`}>
                    {!isMe && <strong>{msg.sender}: </strong>}
                    {msg.text}
                  </div>
                );
              })}
            </div>
            <form onSubmit={sendMessage} className="sumbitMessages">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="messageRaw"
                placeholder="Type your message..."
              />
              <button type="submit" className="submitButton">Send</button>
            </form>
          </div>
        ) : (
          <div className="narrowContent">
            <img src="/images/chatPng.png" className="chatPng1" onClick={() => setWide(!wide)} />
            <img src="/images/timer.png" className="chatPng" onClick={() => setShowTimerPopup(true)} />
            <img src="/images/settings.png" className="chatPng"/>
          </div>
        )}
        
      </div>
     </div>
    </div>
  );
}

/* ---------- Remote Video component ---------- */
function RemoteVideo({ stream }) {
  const ref = useRef();
  useEffect(() => {
    ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline className="remote-video" />;
}
