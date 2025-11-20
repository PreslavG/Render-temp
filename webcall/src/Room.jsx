import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import socket from "./scripts/socket";
import { db, auth } from "./scripts/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  doc,
  onSnapshot,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import "./Room.css";

export default function Room() {
  const sound = new Audio("../public/sounds/end.mp3");
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [userEmail, setUserEmail] = useState(null);

  const localVideoRef = useRef();
  const localStreamRef = useRef();
  const peerConnections = useRef({});
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [wide, setWide] = useState(false);
  const [showTimerPopup, setShowTimerPopup] = useState(false);
  const [showCustomTimerPopup, setShowCustomTimerPopup] = useState(false);
  const [studySession, setStudySession] = useState(25);
  const [breakTime, setbreakTime] = useState(5);
  const [mode, setMode] = useState(null);
  const [remainingSeconds, setRemaining] = useState(25 * 60);
  const isLocalUpdate = useRef(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
  if (!roomId || !auth.currentUser) return;

  const timerRef = doc(db, "users", auth.currentUser.uid, "rooms", roomId);

  const unsubscribe = onSnapshot(timerRef, snapshot => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();
    if (!data.timer) return;

    console.log("🔥 Timer received from Firestore:", data.timer);

    setMode(data.timer.mode);
    setRemaining(data.timer.remainingSeconds);
  });

  return () => unsubscribe();
}, [roomId]);


  useEffect(() => {
    let interval;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    }
    if (timeLeft === 0 && isRunning) {alert,setShowPopup(true)};
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const updateTimerInDB = async (roomId, remainingSeconds, mode) => {
    

  if (mode === undefined || remainingSeconds === undefined) {
  return;
}

  const timerRef = doc(db, "users", auth.currentUser.uid, "rooms", roomId);
  
  await setDoc(timerRef, {
    timer:{
    mode,
    remainingSeconds,
    lastUpdated: serverTimestamp()
    }
  }, { merge: true });
};

const switchMode = () => {
  // ⛔ Block Firestore from overriding the new mode for 2 seconds
  isLocalUpdate.current = true;

  if (mode === "study") {
    const secs = breakTime;
    setMode("break");
    setRemaining(secs);
    updateTimerInDB(roomId, secs, "break");
  } else {
    const secs = studySession;
    setMode("study");
    setRemaining(secs);
    updateTimerInDB(roomId, secs, "study");
  }
};

useEffect(() => {
  if (!isRunning) return;

    sound.play();
    const interval = setInterval(() => {
    setRemaining(prev => {
      const updated = prev - 1;
      if (updated <= 0) {
        switchMode(mode, studySession * 60, breakTime);
        return 0;
      }
      return updated;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [isRunning, mode, breakTime, studySession]);

  useEffect(() => {
  if (!auth.currentUser || !roomId) return;

  const messagesRef = collection(db, "users", auth.currentUser.uid, "rooms", roomId, "messages");
  const q = query(messagesRef, orderBy("createdAt", "asc"));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setMessages(msgs);
  });

  return () => unsubscribe();
}, [roomId]);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/login");
      else setUserEmail(user.email);
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

      if (roomOwnerId) {
        const roomRef = doc(db, "users", roomOwnerId, "rooms", roomId);
      }

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

  // Room controls
  const leaveRoom = async () => {
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    socket.emit("leave-room", { roomId });

    await deleteDoc(doc(db, "users", auth.currentUser.uid, "rooms", roomId, "activeUsers", auth.currentUser.uid));

    navigate("/lobby");
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    setIsMuted(prev => !prev);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    setIsVideoOff(prev => !prev);
  };

  // Messages
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await addDoc(collection(db, "users", auth.currentUser.uid, "rooms", roomId, "messages"), {
      text: newMessage,
      sender: auth.currentUser?.email || "Anonymous",
      createdAt: serverTimestamp(),
    });

    setNewMessage("");
  };

  const formatTime = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

  return (
    <div className="roomPage">
      <div className="room-container">
        <div className="timerDisplay">
  <h1>{formatTime(remainingSeconds)}</h1>
  <p>Mode: {mode === "study" ? "📘 Study" : "☕ Break"}</p>
</div>
        <div className="videos">
          <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
          {remoteStreams.map(remote => <RemoteVideo key={remote.id} stream={remote.stream} />)}
        </div>
        <div className="controls">
          <button onClick={leaveRoom}>Leave Room</button>
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
            <img src="../public/images/chatPng.png" className="chatPng1" onClick={() => setWide(!wide)} />
            <img src="../public/images/timer.png" className="chatPng" onClick={() => setShowTimerPopup(true)} />
            <img src="../public/images/settings.png" className="chatPng"/>
          </div>
        )}
        
      </div>



        {showTimerPopup && (
  <div className="popup-overlay">
    <div className="customPomodoroPopup">
      <h3>Set Pomodoro Duration (max 120 min)</h3>


      <div>
        <button onClick={() => {const secs = 25 ; setRemaining(secs), setbreakTime(5), setMode("study"),setIsRunning(true),setStudySession(25); updateTimerInDB(roomId, secs, "study");}}>25/5</button> 
        <button onClick={() => { const secs = 50 ;setRemaining(50 * 60), setbreakTime(10),setMode("study"),setIsRunning(true),setStudySession(50), updateTimerInDB(roomId, secs, "study" )}}>50/10</button> 
        <button onClick={() => { const secs = 90 ;setRemaining(90 * 60), setbreakTime(15), setMode("study"),setIsRunning(true),setStudySession(90), updateTimerInDB(roomId, secs, "study" )}}>90/15</button> 
        <button onClick={() => { setShowCustomTimerPopup(true), setShowTimerPopup(false)}}>Custom</button> 

        <button onClick={() => setShowTimerPopup(false)}>Cancel</button>
      </div>
    </div>
  </div>
)}
{showCustomTimerPopup && (
  <div className="popup-overlay">
    <div className="customPomodoroPopup">
      <h3>Set Pomodoro Duration (max 120 min)</h3>
      <label htmlFor="studyTimer">Study timer</label>
      <input
        type="number"
        min={1}
        max={120}
        value={studySession}
        onChange={(e) => {
          let value = Number(e.target.value);
          if (value > 120) value = 120;      // max 2 hours
          if (value < 1) value = 1;          // min 1 minute
          setStudySession(value);
        }}
      />
      <label htmlFor="breakTimer">Break timer</label>
      <input
        type="number"
        min={1}
        max={120}
        value={breakTime}
        onChange={(e) => {
          let value = Number(e.target.value);
          if (value > 50) value = 50;      // max 2 hours
          if (value < 1) value = 1;          // min 1 minute
          setbreakTime(value);
        }}
      />


      <div>

        <button onClick={() => {
            const secs = studySession * 60;
               setMode("study");
               setIsRunning(true);
               setRemaining(secs);
               setRemaining(secs);
               setShowCustomTimerPopup(false);
               setStudySession(secs); 
               alert(secs);

             }}>
               Start
        </button>
        <button onClick={() => {setShowCustomTimerPopup(false), setShowTimerPopup(true)}}>Cancel</button>
      </div>
    </div>
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
