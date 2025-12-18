import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket from "./scripts/socket";
import { db, auth, set } from "./scripts/firebase";
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
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
import { storage } from "./scripts/firebase";
import "./Room.css";

export default function Room() {
  const rain = useRef(new Audio("/sounds/rain.mp3"));
  const forest = useRef(new Audio("/sounds/forest.mp3"));
  const library = useRef(new Audio("/sounds/library.mp3"));
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState(null);

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
  const [breakTime, setbreakTime] = useState(40);
  const [mode, setMode] = useState("study");
  const [remainingSeconds, setRemaining] = useState(-1);
  const [showMessage, setShowMessage] = useState(false);
  const [noactiveUsers, setNoActiveUsers] = useState(true);
  const roomOwnerId = useRef(null);
  const [adminId, setAdminId] = useState(null);
  const [showFiles, setShowFiles] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null); 
  const [volume, setVolume] = useState(0.1); 
  const [backgroundImages, setBackgroundImages] = useState([]);
  const [background, setBackground] = useState(null);
  const [invalidValueMessageMaxStudy, setInvalidValueMessageMaxStudy] = useState(false);
  const [invalidValueMessageMinBreak, setInvalidValueMessageMinBreak] = useState(false);
  const [invalidValueMessageMaxBreak, setInvalidValueMessageMaxBreak] = useState(false);
  const isOwner = auth.currentUser?.uid === adminId;
  const user = auth.currentUser;

  const categories = ["medicine", "mathematics", "language", "science", "history", "art", "technology", "literature"];
  const settings = ["ambient sounds", "backgrounds"];


  const [category, setCategory] = useState("");
  const [setting, setSetting] = useState("Sounds");
  const [file, setFile] = useState(null);
  const [filesList, setFilesList] = useState([]);


const fileInputRef = useRef(null);

const uploadFile = async () => {
  if (!file || !category) return alert("Select category & file first!");

  const fileRef = ref(storage, `users/${adminId}/rooms/${roomId}/files/${category}/${file.name}`);
  await uploadBytes(fileRef, file);
  await loadFiles();

  setFile(null);
  fileInputRef.current.value = ""; 

  alert("Uploaded successfully!");
};

  const loadFiles = async () => {
    if (!category) return alert("Choose a category!");

    const folderRef = ref(storage, `users/${adminId}/rooms/${roomId}/files/${category}`);
    const items = await listAll(folderRef);

    const urls = await Promise.all(
      items.items.map(async (item) => ({
        name: item.name,
        url: await getDownloadURL(item),
      }))
    );

    setFilesList(urls);
  };

  const getFileIcon = (name, url) => {
    const ext = name.split(".").pop().toLowerCase();
    const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);

    if (isImage) return url;

    if (ext === "pdf")
      return "https://cdn-icons-png.flaticon.com/512/337/337946.png";

    if (["doc", "docx"].includes(ext))
      return "https://cdn-icons-png.flaticon.com/512/281/281760.png";

    if (["zip", "rar"].includes(ext))
      return "https://cdn-icons-png.flaticon.com/512/337/337947.png";

    if (["mp4", "mov"].includes(ext))
      return "https://cdn-icons-png.flaticon.com/512/727/727245.png";

    return "https://cdn-icons-png.flaticon.com/512/833/833524.png"; // default
  };

  useEffect(() => {
  if (category) {
    loadFiles();
  }
}, [category]);

useEffect(() => {
  if (!showSettings || setting !== "backgrounds") return;
  loadImages();
}, [showSettings, setting, adminId, roomId]);

useEffect(() => {
  if (adminId && roomId) loadBackground();
}, [adminId, roomId]);

useEffect(() => {
  rain.current.loop = true;
  forest.current.loop = true;
  library.current.loop = true;

}, []);

useEffect(() => {
  return () => {
    [rain, forest, library].forEach(audioRef => {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    });
  };
}, []);

const stopAllSounds = () => {
  [rain, forest, library].forEach(audioRef => {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  });
  setCurrentAudio(null);
};


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
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    setCurrentAudio(null);
  }
  const ref = doc(db, "users", auth.currentUser.uid , "rooms", roomId, "breakroom", roomId+"breakroom");  

  await setDoc(ref, {
    roomId: roomId,
    createdAt: Date.now(),
    breaktime: breakTime,
    studytime: studySession,
  });

  await deleteDoc(doc(db,"users",auth.currentUser.uid,"rooms",roomId,"activeUsers", auth.currentUser.uid));

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
    setIsRunning(false);
    updateTimerInDB(-1, mode, false);
  }   else if (remainingSeconds >= 0) {
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

  const updateTimerInDB = async (remainingSeconds, mode, isRunning) => {
  if (!adminId) {
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
    updateTimerInDB(newSeconds, newMode, isRunning); 
  }
};

useEffect(() => {
  if (!isRunning) return;
  if (!adminId) {
  }

  const interval = setInterval(() => {
    setRemaining(prev => {
      const updated = prev > 0 ? prev - 1 : 0;

      if (adminId && isOwner) {
        updateTimerInDB(updated, mode, isRunning);
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
  if (!adminId || !roomId) return;

  const messagesRef = collection(db, "users", adminId, "rooms", roomId, "messages");
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
  return async () => {
    if (!roomOwnerId.current || !auth.currentUser) return;

    await deleteDoc(
      doc(
        db,
        "users",
        roomOwnerId.current,
        "rooms",
        roomId,
        "activeUsers",
        auth.currentUser.uid
      )
    );
  };
}, []);


 useEffect(() => {
  if (!adminId || !roomId) return;

  const ACTIVE_TIMEOUT = 10000; 

  const mainRef = collection(
    db,
    "users",
    adminId,
    "rooms",
    roomId,
    "activeUsers"
  );

  const breakRef = collection(
    db,
    "users",
    adminId,
    "rooms",
    roomId,
    "breakroom",
    roomId + "breakroom",
    "activeUsers"
  );

  let mainActive = 0;
  let breakActive = 0;

  const countActive = (snapshot) => {
    const now = Date.now();
    let count = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.lastSeen) return;

      const diff = now - data.lastSeen.toMillis();
      if (diff < ACTIVE_TIMEOUT) count++;
    });

    return count;
  };

  const updateState = () => {
    const total = mainActive + breakActive;

    if (total === 0) {
      setNoActiveUsers(false);
      setIsRunning(false);
      updateTimerInDB(0, mode, false);
    } else {
      setNoActiveUsers(true);
    }
  };

  const unsubMain = onSnapshot(mainRef, (snap) => {
    mainActive = countActive(snap);
    updateState();
  });

  const unsubBreak = onSnapshot(breakRef, (snap) => {
    breakActive = countActive(snap);
    updateState();
  });

  return () => {
    unsubMain();
    unsubBreak();
  };
}, [adminId, roomId, mode]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/login");
      else {setUserEmail(user.email), setUserName(user.name)}
      
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
            if (!user) return;

            const interval = setInterval(async () => {
              await setDoc(
                doc(db, "users", user.uid, "rooms", roomId, "activeUsers", user.uid),
                { lastSeen: serverTimestamp() },
                { merge: true }
              );
            }, 5000); 

            return () => clearInterval(interval);
          }, [user, roomId]);

useEffect(() => {
  if (!userEmail) return;

  if (!socket.connected) socket.connect();

  socket.emit("join-room", {
    roomId,
    email: userEmail,
    userId: auth.currentUser.uid
  });

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localVideoRef.current.srcObject = stream;
      localStreamRef.current = stream;
    } catch (err) {
      console.warn("No camera — joining without video");
    }
  };

  startLocalStream();

  const handleExistingUsers = (users) => {
    users.forEach(peerId => {
      if (peerId === socket.id) return;
      handleNewPeer(peerId, true); 
    });
  };

  const handleUserJoined = ({ peerId }) => {
    handleNewPeer(peerId, false);
  };

  const handleOffer = ({ from, offer }) =>
    handleIncomingOffer(from, offer);

  const handleAnswer = ({ from, answer }) =>
    handleIncomingAnswer(from, answer);

  const handleIce = ({ from, candidate }) =>
    peerConnections.current[from]?.addIceCandidate(candidate);

  const handleUserLeft = ({ peerId }) =>
    removePeer(peerId);

  socket.on("existing-users", handleExistingUsers);
  socket.on("user-joined", handleUserJoined);
  socket.on("offer", handleOffer);
  socket.on("answer", handleAnswer);
  socket.on("ice-candidate", handleIce);
  socket.on("user-left", handleUserLeft);

  return () => {
    socket.off("existing-users", handleExistingUsers);
    socket.off("user-joined", handleUserJoined);
    socket.off("offer", handleOffer);
    socket.off("answer", handleAnswer);
    socket.off("ice-candidate", handleIce);
    socket.off("user-left", handleUserLeft);
    socket.disconnect();
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
    if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    setCurrentAudio(null);
  }
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    socket.emit("leave-room", { roomId });
   if (adminId) {
    await deleteDoc(
      doc(db, "users", adminId, "rooms", roomId, "activeUsers", user.uid)
    );
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

    await addDoc(collection(db, "users", adminId, "rooms", roomId, "messages"), {
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

const playSound = (audioRef) => {
  if (currentAudio && currentAudio !== audioRef.current) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  if (currentAudio === audioRef.current && !audioRef.current.paused) {
    audioRef.current.pause();
    setCurrentAudio(null);
  } else if (audioRef.current) {
    audioRef.current.play();
    setCurrentAudio(audioRef.current);
  }
};


   const chooseImage = async (url) => {
  if (!user) return;
  
  setBackgroundUrl(url);
  console.log("Selected Url is:", url);
};

 const saveBackgroundPic = async (url) => {
  const docRef = doc(db, "users", adminId, "rooms", roomId);
  await setDoc(docRef, { roomBackground: url }, { merge: true });
  setBackground(url);
};

const loadBackground = async () => {
  const docRef = doc(db, "users", adminId, "rooms", roomId);
  const snap = await getDoc(docRef);

  if (snap.exists()) {
    setBackground(snap.data().roomBackground || null);
  }
};

 const loadImages = async () => {
    if (!user) return;

    const folderRef = ref(storage, `backgrounds/`);
    const list = await listAll(folderRef);

    const urls = await Promise.all(
      list.items.map(i => getDownloadURL(i))
    );

    setBackgroundImages(urls);
  };

useEffect(() => {
  [rain, forest, library].forEach(audioRef => {
    if (audioRef.current) audioRef.current.volume = volume;
  });
}, [volume]);

async function getAndFormatTime() {
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
      <div className="room-container"
      style={{
        backgroundImage: background ? `url(${background})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}>
        <div className="timerDisplay">
  <h1>{remainingSeconds === -1 ? "00:00" : formatTime(remainingSeconds)}</h1>
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
                const isMe = msg.sender === userName;
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
            <img src="/images/files.png" className="chatPng" onClick={() => setShowFiles(true)} />
            <img src="/images/settings.png" className="chatPng2" onClick={() => setShowSettings(true)} />
          </div>
        )}
        
      </div>



        {showTimerPopup && (
  <div className="popup-overlay">
    <div className="customPomodoroPopup">
      <h3>Set Pomodoro Duration (max 120 min)</h3>


      <div className="timerBtns">
        <button onClick={() => {const secs = 25 ; setRemaining(secs), setbreakTime(5), setMode("study"),setIsRunning(true),setStudySession(25); updateTimerInDB( secs, "study"); getAndFormatTime();}}>25/5</button> 
        <button onClick={() => { const secs = 50 ;setRemaining(50 * 60), setbreakTime(10),setMode("study"),setIsRunning(true),setStudySession(50), updateTimerInDB( secs, "study" )}}>50/10</button> 
        <button onClick={() => { const secs = 90 ;setRemaining(90 * 60), setbreakTime(15), setMode("study"),setIsRunning(true),setStudySession(90), updateTimerInDB( secs, "study" )}}>90/15</button> 
        <button onClick={() => { setShowCustomTimerPopup(true), setShowTimerPopup(false)}}>Custom</button> 

        <button onClick={() => setShowTimerPopup(false)}>Cancel</button>
      </div>
    </div>
  </div>
)}

{showFiles && (
  <div className="popup-overlay">
    <div className="categoriesAndFiles">
         <div className="categorySelect">
          <div className="category-list">
            <h1>Categories List:</h1>
            {categories.map((cat) => (
                <div
                key={cat}
                className={`category-item ${category === cat ? "active" : ""}`}
                onClick={() => {setCategory(cat)}}
                >
                {cat}
                </div>
            ))}
            </div>
            </div>
    
        <div className="ViewFiles">
          <h3>Files in {category}</h3>
    
          {filesList.length === 0 && <p>No files here yet.</p>}
    
          <div className="file-grid">
            {filesList.map((file, index) => (
              <div className="file-item" key={index}>
                <img
                  src={getFileIcon(file.name, file.url)}
                  alt={file.name}
                  className="file-thumb"
                  onClick={() => window.open(file.url, "_blank")}
                />
    
                <p className="file-name">{file.name}</p>
    
              </div>
              
            ))}
            <div className="upload">
            <input type="file" ref={fileInputRef} id="uploadInput" onChange={(e) => setFile(e.target.files[0])} />
            <button id="uploadbutton" onClick={uploadFile}>Upload</button>
            </div>
            <button id="closebutton" onClick={() => setShowFiles(false)}>
              ❌
            </button>
            </div>
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

{showSettings && (
  <div className="popup-overlay">
    <div className="abientSoundsAndBackgrounds">
      <button id="closebutton" onClick={() => setShowSettings(false)}>
              ❌
            </button>
         <div className="settingSelect">
          <div className="settings-list">
            {settings.map((set) => (
                <div
                key={set}
                className={`settings-item ${setting === set ? "active" : ""}`}
                onClick={() => {setSetting(set)}}
                >
                {set}
                </div>
            ))}
            </div>
            </div>
    
        <div className="SoundsAndBackgrounds">
    
          {setting === "ambient sounds" && (
          <div className="sound-grid">
            <div className="sound-buttons">
            <button className="sound" onClick={()=> playSound(rain)}>Raining ☔</button>
            <button className="sound" onClick={()=> playSound(forest)}>Forest 🌳</button>
            <button className="sound" onClick={()=> playSound(library)}>Library 📚</button>
            </div>
            <label htmlFor="volume">Volume: {Math.round(volume * 100)}%</label>
            <input
              type="range"
              id="volume"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
            <button className="sound" onClick={(stopAllSounds)}>Turn Off</button>
          </div>
          
          
        )}

        {setting === "backgrounds" && (
          <div className="background-grid">
          {backgroundImages.map((url, index) => (
              <img
                key={index}
                src={url}
                alt=""
                width={400}
                height={200}
                style={{
                  cursor: "pointer",
                  borderRadius: 10,
                  border: "3px solid transparent"
                }}
                onClick={() => {
                  saveBackgroundPic(url);
                  setShowSettings(false);
                }}
              />
            ))}
          </div>
        )}
            
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
          if (value > 120) {setInvalidValueMessageMaxStudy(true), value=120}
          else{
            setInvalidValueMessageMaxStudy(false);
          }                
          if (value < 1) {setInvalidValueMessageMinBreak(true), value= ""}
          else{
            setInvalidValueMessageMinBreak(false);
          }          
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
          if (value > 50)  {setInvalidValueMessageMaxBreak(true), value= 50}
          else{
            setInvalidValueMessageMinBreak(false);
          }                // max 2 hours
          if (value < 1) {setInvalidValueMessageMinBreak(true), value= ""}
          else{
            setInvalidValueMessageMinBreak(false);
          }          
          setbreakTime(value);
        }}

        
      />
      {invalidValueMessageMinBreak && (<p className="error-message">Timer can't be less than 1 minute.</p>
        )}
        {invalidValueMessageMaxBreak && (<p className="error-message">Timer can't be more than 50 minutes.</p>
        )}
        {invalidValueMessageMaxStudy && (<p className="error-message">Timer can't be more than 120 minutes.</p>
        )}



      <div className="timerBtns">

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
