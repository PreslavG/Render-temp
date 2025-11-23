import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import socket from "./scripts/socket";
import { db, auth } from "./scripts/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
  doc,
  getDocs,
  onSnapshot,
  deleteDoc,
  setDoc,
  where,
} from "firebase/firestore";
import "./Room.css";

export default function Room() {
  const sound = new Audio("../public/sounds/end.mp3");
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
  const [isRunning, setIsRunning] = useState();
  const [wide, setWide] = useState(false);
  const [showTimerPopup, setShowTimerPopup] = useState(false);
  const [showCustomTimerPopup, setShowCustomTimerPopup] = useState(false);
  const [studySession, setStudySession] = useState(25);
  const [breakTime, setbreakTime] = useState(50);
  const [mode, setMode] = useState(null);
  const [remainingSeconds, setRemaining] = useState(25);
  const [showMessage, setShowMessage] = useState(false);
  const roomOwnerId = useRef(null);
  const [adminId, setAdminId] = useState(null);
  const isOwner = auth.currentUser?.uid === adminId;
  const user = auth.currentUser;


 useEffect(() => {
  if (!roomId || !auth.currentUser) return;
  const roomRef = doc(db, "users", auth.currentUser.uid, "rooms", roomId);
  getDoc(roomRef).then(snap => {
    if (!snap.exists()) {
      console.warn("room doc not found at current user's path — adminId read failed");
      return;
    }
    setAdminId(snap.data().adminId);
  }).catch(err => console.error("failed to read adminId:", err));
}, [roomId]);

const joinRoom = async (room) => {
    const activeUsersRef = collection(db, "users", adminId, "rooms", roomId, "breakroom", roomId+"breakroom", "activeUsers");
    const snapshot = await getDocs(activeUsersRef);

    const totalActive = snapshot.size;

    await setDoc(doc(db, "users", adminId,"rooms", roomId,"breakroom", roomId+"breakroom", "activeUsers", user.uid ), {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
    });

    console.log(`User ${user.email} joined breakroom. Total active users: ${totalActive}`);
    console.log(`User ${user.email} joined breakroom.`);
    console.log(`Acive user: uid: ${user.uid}, email: ${user.email}, name: ${user.displayName}`);

   };


const goToBreakroom = async () => {
  const ref = doc(db, "users", auth.currentUser.uid , "rooms", roomId, "breakroom", roomId+"breakroom");  

  await setDoc(ref, {
    roomId: roomId,
    createdAt: Date.now(),
    breaktime: breakTime,
    studytime: studySession,
  });

  navigate(`/breakroom/${roomId}-breakroom`);
};

useEffect(() => {
  if (!adminId || !roomId) return;

  const activeMainRef = collection(
    db,
    "users",
    adminId,
    "rooms",
    roomId,
    "activeUsers"
  );

  const activeBreakRef = collection(
    db,
    "users",
    adminId,
    "rooms",
    roomId,
    "breakroom",
    roomId + "breakroom",
    "activeUsers"
  );

  let mainCount = 0;
  let breakCount = 0;

  const unsubMain = onSnapshot(activeMainRef, (snapshot) => {
    mainCount = snapshot.size;
    checkBoth();
  });

  const unsubBreak = onSnapshot(activeBreakRef, (snapshot) => {
    breakCount = snapshot.size;
    checkBoth();
  });

  function checkBoth() {
  if (mainCount + breakCount === 0) { 
    console.log("⚠️ Both rooms empty — stopping timer");
    setIsRunning(false);
    updateTimerInDB(remainingSeconds, mode, false);
  } else {
    setIsRunning(true); 
  }
}

  return () => {
    unsubMain();
    unsubBreak();
  };
}, [adminId, roomId, remainingSeconds, mode]);


 useEffect(() => {
  if (!adminId) return;

  const timerRef = doc(db, "users", adminId, "rooms", roomId);
  const unsubscribe = onSnapshot(timerRef, (snapshot) => {
    if (!snapshot.exists()) return;

    const data = snapshot.data();
    if (!data.timer) return; 

    setMode(data.timer.mode);
    setRemaining(data.timer.remainingSeconds);
    setIsRunning(data.timer.isRunning);
  });

  return () => unsubscribe();
}, [adminId, roomId]);

  const updateTimerInDB = async (remainingSeconds, mode, isRunning = true) => {
  if (!adminId) {
    // nothing to write yet — adminId not known
    console.warn("updateTimerInDB: adminId not available yet");
    return;
  }
  try {
    const timerRef = doc(db, "users", adminId, "rooms", roomId);
    await setDoc(timerRef, {
      timer: {
        remainingSeconds,
        mode,
        isRunning,
        lastUpdated: serverTimestamp(),
      }
    }, { merge: true });
  } catch (error) {
    console.error("Error updating timer:", error);
  }
};

const switchMode = () => {
  const newMode = mode === "study" ? "break" : "study";
  const newSeconds = newMode === "study" ? studySession : breakTime ;

  

  setMode(newMode);
  setRemaining(newSeconds);

  if (isOwner) {
    updateTimerInDB(newSeconds, newMode, true); 
  }
};

useEffect(() => {
  if (!isRunning) return;
  if (!adminId) {
    console.warn("Timer running locally but adminId not ready — waiting to sync");
  }

  const interval = setInterval(() => {
    setRemaining(prev => {
      const updated = prev > 0 ? prev - 1 : 0;

      if (adminId && isOwner) {
        updateTimerInDB(updated, mode, true);
      }

      if (updated <= 0) {
        clearInterval(interval);
        setShowMessage(true);
      }
      return updated;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [isRunning, mode, adminId, isOwner]);

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
  if (!auth.currentUser || !roomId) return;

  let interval;

  const setupHeartbeat = async () => {
    const roomRef = doc(db, "users", auth.currentUser.uid, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;

    roomOwnerId.current = roomSnap.data().ownerId;
    if (!roomOwnerId.current) return;

    await setDoc(doc(db, "users", roomOwnerId.current, "rooms", roomId, "activeUsers", auth.currentUser.uid), {
      email: auth.currentUser.email,
      name: auth.currentUser.displayName,
      lastSeen: serverTimestamp(),
    }, { merge: true });

    interval = setInterval(() => {
      setDoc(doc(db, "users", roomOwnerId.current, "rooms", roomId, "activeUsers", auth.currentUser.uid), 
      {
        lastSeen: serverTimestamp()},
       { merge: true });
    }, 5000);
  };

  setupHeartbeat();

  return () => clearInterval(interval);
}, [roomId, auth.currentUser]);

   

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/login");
      else setUserEmail(user.email);
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
  const handleBeforeUnload = async (event) => {
    if (auth.currentUser) {
      const activeUserRef = doc(
        db,
        "users",
        auth.currentUser.uid,  
        "rooms",
        roomId,
        "activeUsers",
        auth.currentUser.uid
      );
      try {
        await deleteDoc(activeUserRef);
      } catch (err) {
        console.error("Failed to remove user on close:", err);
      }
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);

  return () => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  };
}, [roomId, auth.currentUser]);

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
   if (roomOwnerId) {
    await deleteDoc(doc(db, "users", auth.currentUser.uid, "rooms", roomId, "activeUsers", auth.currentUser.uid));
   }
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
  if (typeof secs !== "number" || isNaN(secs)) return "00:00"
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

async function getAndFormatTime() {
  // Example: find a user with a specific email
  const timerRef = doc(db, "users", auth.currentUser.uid, "rooms", roomId );
  const timerSnap = await getDoc(timerRef);

      if (timerSnap.exists()) {
        const data = timerSnap.data();
       const timerData = data.timer;
      if (!timerData || typeof timerData.remainingSeconds !== "number") {
        console.log("Timer data is missing or invalid:", timerData);
      } else {
        const secs = timerData.remainingSeconds;
        const formatted = formatTime(secs);
        console.log("Formatted time:", formatted);
      }}
      }
  return (
    <div className="roomPage">
      <div className="room-container">
        <div className="timerDisplay">
  <h1>{formatTime(remainingSeconds)}</h1>
  <p>Mode: {mode === "study" ? "📘 Study" : "☕ Break"}</p>
</div>
    <button className="breakroomButton" disabled={mode=='study'} onClick={() => {goToBreakroom(), joinRoom()}}>Go to breakroom</button>
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
            <img src="/images/chatPng.png" className="chatPng1" onClick={() => setWide(!wide)} />
            <img src="/images/timer.png" className="chatPng" onClick={() => setShowTimerPopup(true)} />
            <img src="/images/settings.png" className="chatPng"/>
          </div>
        )}
        
      </div>



        {showTimerPopup && (
  <div className="popup-overlay">
    <div className="customPomodoroPopup">
      <h3>Set Pomodoro Duration (max 120 min)</h3>


      <div>
        <button onClick={() => {const secs = 20 ; setRemaining(secs), setbreakTime(5), setMode("study"),setIsRunning(true),setStudySession(25); updateTimerInDB( secs, "study"); getAndFormatTime();}}>25/5</button> 
        <button onClick={() => { const secs = 50 ;setRemaining(50 * 60), setbreakTime(10),setMode("study"),setIsRunning(true),setStudySession(50), updateTimerInDB( secs, "study" )}}>50/10</button> 
        <button onClick={() => { const secs = 90 ;setRemaining(90 * 60), setbreakTime(15), setMode("study"),setIsRunning(true),setStudySession(90), updateTimerInDB( secs, "study" )}}>90/15</button> 
        <button onClick={() => { setShowCustomTimerPopup(true), setShowTimerPopup(false)}}>Custom</button> 

        <button onClick={() => setShowTimerPopup(false)}>Cancel</button>
      </div>
    </div>
  </div>
)}

{showMessage && (
  <div className="popup-overlay">
    <div className="popup-box">
      <p>Time's up!</p>
      <button onClick={() => {
        switchMode();       
        setShowMessage(false); 
      }}> Stay
      </button>
       
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
               updateTimerInDB( secs, "study");
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
