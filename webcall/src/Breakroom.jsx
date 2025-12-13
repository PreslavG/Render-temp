import { use, useEffect, useRef, useState } from "react";
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
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import "./Breakroom.css";

export default function Breakroom() {
  const sound = new Audio("/sounds/endBreak.mp3");
  const sound30seconds = new Audio("/sounds/30seconds.mp3");
  const navigate = useNavigate();
  const { roomIdWithSuffix } = useParams();
  const roomId = roomIdWithSuffix.replace(/-breakroom$/, "");

  const [userEmail, setUserEmail] = useState(null);
  const [ownerId, setOwnerId] = useState();
  const [mode, setMode] = useState(null);
  const [remainingSeconds, setRemaining] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [BreakTime, setBreakTime] = useState();
  const [StudyTime, setStudyTime]= useState();
  const [adminId, setAdminId] = useState(null);



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

 useEffect(() => {
  if (!roomId || !auth.currentUser) return;
  const roomRef = doc(db, "users", auth.currentUser.uid, "rooms", roomId);
  getDoc(roomRef).then(snap => {
    if (!snap.exists()) {
      return;
    }
    setAdminId(snap.data().adminId);
  }).catch(err => console.error("failed to read adminId:", err));
}, [roomId]);

  useEffect(() => {
    return auth.onAuthStateChanged((user) => {
      if (!user) navigate("/login");
      else setUserEmail(user.email);
    });
  }, []);

  useEffect(() => {
    if (!adminId || !roomId) return;

    const msgRef = collection(db,"users", adminId, "rooms", roomId,"breakroom",roomId+"breakroom", "messages");
    const q = query(msgRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);
    });

    return () => unsub();
  }, [roomId, adminId]);


  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await addDoc(collection(db,"users", adminId, "rooms", roomId,"breakroom",roomId+"breakroom", "messages"), {
      text: newMessage,
      sender: userEmail,
      createdAt: serverTimestamp(),
    });

    setNewMessage("");
  };


  useEffect(() => {
    if (remainingSeconds===0) return;
    if(remainingSeconds === remainingSeconds - (remainingSeconds - 30) && mode === "break"){
      console.log("30 seconds left");
      sound30seconds.volume = 0.2;
      sound30seconds.play();

    } 

    if(remainingSeconds === remainingSeconds - (remainingSeconds - 4) && mode === "break"){
      console.log("bratle 4 sekundi ostavat")
      sound.volume = 0.2;
      sound.play();
    }
  }, [remainingSeconds]);

  useEffect(() => {
  if (!roomId) return;

  const StudyAndBreakTimes = async () => {
    const roomRef = doc(db, "users", auth.currentUser.uid, "rooms", roomId, "breakroom", roomId+"breakroom");
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      console.log("Room document not found!");
      return;
    }

    setStudyTime(roomSnap.data().studytime);
    setBreakTime(roomSnap.data().breaktime);

  }

  StudyAndBreakTimes();
}, [roomId]);

useEffect(() => {
  if (!isRunning || !ownerId || !StudyTime || !BreakTime) return;

  const interval = setInterval(() => {
    setRemaining(prev => {
      if (prev > 0) {
        updateTimerInDB(prev - 1, mode, true);
        return prev - 1;
      } else {
        const newMode = mode === "study" ? "break" : "study";
        const newSeconds = newMode === "study" ? StudyTime : BreakTime;

        updateTimerInDB(newSeconds, newMode, true);
        setMode(newMode);
        return newSeconds;
      }
    });
  }, 1000);

  return () => clearInterval(interval);
}, [isRunning, ownerId, mode, StudyTime, BreakTime]);

const switchMode = () => {
  const newMode = mode === "break" ? "study" : "break";
  const newSeconds = newMode === "break" ? BreakTime : StudyTime ;

  

  setMode(newMode);
  setRemaining(newSeconds);

  
    updateTimerInDB(newSeconds, newMode, true); 
}


  /*WEBRTC*/
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


async function goBack() {

  navigate(`/room/${roomId}`);
}

async function deleteActiveUser() {

  await deleteDoc(doc(db,"users",auth.currentUser.uid,"rooms",roomId,"breakroom", roomId+"breakroom","activeUsers", auth.currentUser.uid));
  
}

async function addActiveUser() {
  const ref = doc(db, "users", auth.currentUser.uid , "rooms", roomId, "activeUsers", auth.currentUser.uid);  

  await setDoc(ref, {
    roomId: roomId,
    createdAt: Date.now(),
  });
  
}

useEffect(() => {
  if (!auth.currentUser || !roomId) return;

  const fetchAdminId = async () => {
    const roomRef = doc(db, "users", auth.currentUser.uid, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      console.log("Room document not found!");
      return;
    }

    setOwnerId(roomSnap.data().adminId);
  };

  fetchAdminId();
}, [auth.currentUser, roomId]);

/* ------------------------ READ TIMER FROM OWNER ------------------------ */
useEffect(() => {
  if (!ownerId || !roomId) return;

  const roomRef = doc(db, "users", ownerId, "rooms", roomId);
  const unsub = onSnapshot(roomRef, snap => {
    if (!snap.exists()) return;
    const timer = snap.data().timer;
    setRemaining(timer.remainingSeconds);
    setMode(timer.mode);
    setIsRunning(true);
  });

  return () => unsub();
}, [ownerId, roomId]);

  const updateTimerInDB = async (remainingSeconds, mode, isRunning = true) => {
  if (!ownerId) {
    // nothing to write yet — ownerId not known
    return;
  }
  try {
    const timerRef = doc(db, "users", ownerId, "rooms", roomId);
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

 useEffect(() => {
  if (!adminId || !roomId) return;

  const messagesRef = collection(db, "users", adminId, "rooms", roomId,"breakroom",roomId+"breakroom", "messages");
  const q = query(messagesRef, orderBy("createdAt", "asc"));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setMessages(msgs);
  });

  return () => unsubscribe();
}, [adminId,roomId]);

  
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
        <button onClick={() =>(leave(), deleteActiveUser())}>Lobby</button>
        <button onClick={() => (addActiveUser(),deleteActiveUser(),goBack())}>Go back</button>
        <button onClick={toggleVideo}>{isVideoOff ? "Start Video" : "Stop Video"}</button>
        <button onClick={toggleMute}>{isMuted ? "Unmute" : "Mute"}</button>
      </div>

        <div className="timerDisplay">
          <h1>{Math.floor(remainingSeconds / 60)}:
            {String(remainingSeconds % 60).padStart(2, "0")}</h1>
            <p>Mode: {mode === "study" ? "📘 Study" : "☕ Break"}</p>
             
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
