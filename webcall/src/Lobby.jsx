  import { useNavigate } from "react-router-dom";
  import { signOut } from "firebase/auth";
  import { auth, db, set } from "./scripts/firebase";
  import { useState, useEffect } from "react";
  import {
    collection,
    addDoc,
    onSnapshot,
    doc,
    deleteDoc,
    getDocs,
    setDoc,
    query,
    where,
    getDoc,
  } from "firebase/firestore";

  import "./Lobby.css";

  

  export default function Lobby() {
    const navigate = useNavigate();
    const [isRoomPopupOpen, setIsRoomPopupOpen] = useState(false);
    const [roomFullPopup, setRoomFullPopup] = useState(false);
    const [activeUsers, setActiveUsers] = useState({});
    const [activeUsersList, setActiveUsersList] = useState({});

    const [profilePic,setProfilePic] = useState(null);

    const [text, setText] = useState(""); 
    const [rooms, setRooms] = useState([]);
    const [activeTab, setActiveTab] = useState("rooms");

    const [selectedFriend, setSelectedFriend] = useState(null);
    const [selectedRoomId, setSelectedRoomId] = useState("");

    const ACTIVE_THRESHOLD = 5000;

    const user = auth.currentUser;

    const handleLogout = async () => {
      try {
        await signOut(auth);
        navigate("/login");
      } catch (error) {
        console.error("Logout failed:", error);
      }
    };

    const joinRoom = async (room) => {
    const ownerId = room.adminId;
    const activeUsersRef = collection(db, "users", ownerId, "rooms", room.id, "activeUsers");
    const snapshot = await getDocs(activeUsersRef);

    const totalActive = snapshot.size;

    if (totalActive >= room.capacity) {
      alert("Room is full!");
      return;
    }

    await setDoc(doc(db, "users", ownerId,"rooms", room.id, "activeUsers", user.uid ), {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
    });

    navigate(`/room/${room.id}`, { state: { role: room.adminId === user.uid ? "admin" : "user" },ownerId: ownerId,});
  };

    useEffect(() => {
      if (!user) return;
      const roomsRef = collection(db, "users", user.uid, "rooms");
      const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
        const RoomData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setRooms(RoomData);
      });
      return () => unsubscribe();
    }, [user]);

    

          useEffect(() => {
            if (!selectedRoomId) return;
          const roomRef = doc(db,"users",user.uid ,"rooms", selectedRoomId);

          const unsubscribe = onSnapshot(roomRef, (snapshot) => {
            if (snapshot.exists()) return; 
              const data = snapshot.data();
              if (data.timer) {
              setMode(data.timer.mode);
              setRemainingSeconds(data.timer.remainingSeconds);
            
            }
          });

          return () => unsubscribe();
        }, [selectedRoomId]);

          useEffect(() => {
        if (!user) return;

        const unsubList = rooms.map(room => {
          console.log("Room debug:", room);
          if (!room.id || !room.adminId) return () => {};

          const activeUsersRef = collection(db, "users", room.adminId, "rooms", room.id, "activeUsers");

          const unsub = onSnapshot(activeUsersRef, snapshot => {
            const users = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            setActiveUsersList(prev => ({ ...prev, [room.id]: users }));
            setActiveUsers(prev => ({ ...prev, [room.id]: users.length }));
          });

          return unsub;
        });

        return () => unsubList.forEach(unsub => unsub());
      }, [rooms, user]);

    const roomAdd = async () => {
      if (!user || text.trim() === "") return;
      try {
        await addDoc(collection(db, "users", user.uid, "rooms"), {
          name: text,
          createdAt: new Date(),
          adminId: user.uid,
          adminEmail: user.email,
          capacity: 5,     
        });
        setText("");
        setIsRoomPopupOpen(false);
      } catch (e) {
        console.error("Error adding room:", e);
      }
    };


   
    

        // 🔹 Send room invite
    

    const setUrl = async () => {
    try {
      const docRef = doc(db, "users", auth.currentUser.uid);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const profilePic = snap.data().profilePic;
        setProfilePic(profilePic);
        return profilePic;
      } else {
        console.log("Document does not exist");
        return null;
      }
    } catch (error) {
      console.error("Error fetching user document:", error);
    }
  };

  useEffect(() => {
    setUrl();
  });

    const getActiveUsers = (users) => {
          if (!users) return [];

          const now = Date.now();

          return users.filter(user => {
            if (!user.lastSeen) return true; 

            let lastSeenMs;

            if (user.lastSeen.toDate) {
              lastSeenMs = user.lastSeen.toDate().getTime();
            } else {
              lastSeenMs = new Date(user.lastSeen).getTime();
            }

            return now - lastSeenMs < ACTIVE_THRESHOLD;
          });
        };
    // =======================================================
    // 🖥️ RENDER
    // =======================================================
    return (
      <div className="returnLobby">
        {/* Popup: Add Room */}
        {isRoomPopupOpen && (
          <div className="popup-overlay">
            <div className="popup">
              <h3>Enter room name:</h3>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type here..."
                maxLength={15}
              />
              <div>
                <button onClick={roomAdd}>Submit</button>
                <button onClick={() => setIsRoomPopupOpen(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        
       

        
        {/* Rooms Tab */}
        {activeTab === "rooms" && (
          
          <div className="buttonList">
            <div className="tabButtons">
          
        
        </div>
            <div className="TitlesAndRooms">
              <h1 className="buttonlistTitle">Available Rooms:</h1>
              <span className="roomElements">
                <h1>Name</h1>
                <h1>Owner</h1>
                <h1>Online</h1>
                <h1>Users</h1>
              </span>
              <div className="RoomsButtons">
              {rooms.length === 0 && <p className="NoRooms">No rooms available. Create one!</p>}
              {rooms.map((room) => (
                <button
                  key={room.id}
                  className="roomButton"
                  onClick={() =>{alert(activeUsers[room.id]),joinRoom(room)}}
                >
                <h3>{room.name} 
                  </h3>
                <div className="imageShower">
                  {room.adminId === user.uid && <img
                          src={profilePic}
                          id="ownerPic"          
                        />}
                 </div>
                    <h1 className="roomPplcount">
                        {activeUsers[room.id]}/{room.capacity}
                    </h1>
                            <ul className="activeUsersList">
                              {getActiveUsers(activeUsersList[room.id]).map((user) => (
                                <li key={user.email}>{user.name}</li>
                              ))}
                            </ul>
                          
                          
                  </button>
                  ))}
              </div>
            </div>
            <div className="buttons">
              <button onClick={() => setIsRoomPopupOpen(true)} className="lobbyButton">
                Add Room
              </button>              
            </div>
          </div>
        )}

        {roomFullPopup && (
    <div className="popup-overlay">
      <div className="popup">
        <h2>🚫 Room is full!</h2>
        <p>This room has reached its maximum capacity.</p>
        <button onClick={() => setRoomFullPopup(false)}>Okay</button>
      </div>
    </div>
  )}

         
      </div>
    );
  }
