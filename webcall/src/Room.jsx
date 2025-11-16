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
  updateDoc,
  increment,
} from "firebase/firestore";
import "./Room.css";

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
  const [timeLeft, setTimeLeft] = useState(1 * 1);
  const [isRunning, setIsRunning] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [wide, setWide] = useState(false);

   useEffect(() => {
    let interval;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }

    if (timeLeft === 0 && isRunning) {
      setShowPopup(true);
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const resetTimer = () => {
  setIsRunning(false);
  setTimeLeft(25 * 60); 
  setShowPopup(false); 
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    const q = query(
      collection(db, "users", auth.currentUser.uid, "rooms", roomId, "messages"),
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

    await addDoc(collection(db, "users", auth.currentUser.uid, "rooms", roomId, "messages"), {
      text: newMessage,
      sender: auth.currentUser?.email || "Anonymous",
      createdAt: serverTimestamp(),
    });

    setNewMessage("");
  }
  const takeaBreak = () => {
    resetTimer;
    navigate("/room/breakRoom"); 
        };
  


  return (
    <div className="roomPage">
    <div className="room-container">
       
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

    <div className={`chatBox ${wide ? "wide" : "narrow"}`}>
       {wide ? (
    <div className="wideContent">
      <h1 className="arrow-right" onClick={() => setWide(!wide)}>❌</h1>
      <div className="messagesBox">
        {messages.map((msg) => {
             const isMe = msg.sender === userEmail;
        return (
          <div
        key={msg.id}
        className={`message ${isMe ? "message-me" : "message-other"}`}
         >
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
        <button
          type="submit"
          className="submitButton"
        >
          Send
        </button>
      </form>
      {/* Add more wide-only elements here */}
    </div>
  ) : (
    <div className="narrowContent">
      <img src="../public/images/chatPng.png" className="chatPng" onClick={() => setWide(!wide)} />

      {/* Add more narrow-only elements here */}
    </div>
  )}
      </div>

    </div>
  );

}

function RemoteVideo({ stream }) {
  const ref = useRef();
  useEffect(() => { ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay playsInline className="remote-video" />;
}
