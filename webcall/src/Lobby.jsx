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
    getDoc,
    serverTimestamp,
  } from "firebase/firestore";
  import { FaTrash, FaPlus } from 'react-icons/fa';
  import {FaTrashAlt} from 'react-icons/fa';
  import "./Lobby.css";

  

  export default function Lobby() {
    const navigate = useNavigate();
    const [isRoomPopupOpen, setIsRoomPopupOpen] = useState(false);
    const [roomFullPopup, setRoomFullPopup] = useState(false);
    const [activeUsers, setActiveUsers] = useState({});
    const [activeUsersList, setActiveUsersList] = useState({});
    const [ownerPics, setOwnerPics] = useState({});

    const [profilePic,setProfilePic] = useState(null);

    const [text, setText] = useState(""); 
    const [rooms, setRooms] = useState([]);
    const [activeTab, setActiveTab] = useState("rooms");


    const ACTIVE_THRESHOLD = 5000;

    const user = auth.currentUser;

    const isUserActive = (user) => {
          if (!user.lastSeen) return false; 
          const lastSeenMs = user.lastSeen.toDate
            ? user.lastSeen.toDate().getTime()
            : new Date(user.lastSeen).getTime();
          return Date.now() - lastSeenMs < ACTIVE_THRESHOLD;
        };

        const getActiveUsers = (users) => {
          if (!users) return [];
          return users.filter(isUserActive);
        };

    const joinRoom = async (room) => {
            const ownerId = room.adminId;

            const mainRef = collection(db, "users", ownerId, "rooms", room.id, "activeUsers");
            const breakRef = collection(db, "users", ownerId, "rooms", room.id, "breakroom", room.id + "breakroom", "activeUsers");

            const [mainSnap, breakSnap] = await Promise.all([getDocs(mainRef), getDocs(breakRef)]);

            const allUsers = [
              ...mainSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })),
              ...breakSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
            ];

            const ACTIVE_THRESHOLD = 15000; 
            const now = Date.now();

            const active = getActiveUsers(allUsers);
                        if (active.length >= room.capacity) {
                setRoomFullPopup(true); 
                return;
              }

            if (active.length >= room.capacity) {
              alert("Room is full!");
              return;
            }

            
            await setDoc(
              doc(db, "users", ownerId, "rooms", room.id, "activeUsers", user.uid),
              {
                uid: user.uid,
                email: user.email,
                name: user.displayName,
                lastSeen: serverTimestamp(),
              },
              { merge: true }
            );
  navigate(`/room/${room.id}`, {
    state: { role: room.adminId === user.uid ? "admin" : "user" },
    ownerId: ownerId,
  });
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
          roomBackground:"https://firebasestorage.googleapis.com/v0/b/webcalls-78f47.firebasestorage.app/o/backgrounds%2Fbackground_rain.png?alt=media&token=619bc48a-0f3d-41dd-845b-104fbdf40f72"   
        });
        setText("");
        setIsRoomPopupOpen(false);
      } catch (e) {
        console.error("Error adding room:", e);
      }
    };

    const deleteRoom = async (room) => {
  if (!user) return;

  const confirmDelete = window.confirm(`Are you sure you want to delete "${room.name}"?`);
  if (!confirmDelete) return;

  try {
    await deleteDoc(doc(db, "users", user.uid, "rooms", room.id));

    alert(`Room "${room.name}" deleted successfully`);
  } catch (err) {
    console.error("Error deleting room:", err);
    alert("Failed to delete the room");
  }
};

    const getOwnerProfilePic = async (ownerId) => {
      try {
        const docRef = doc(db, "users", ownerId);
        const snap = await getDoc(docRef);
        if (snap.exists()) return snap.data().profilePic || null;
        return null;
      } catch (err) {
        console.error("Error fetching owner profilePic:", err);
        return null;
      }
    };
    
    useEffect(() => {
      rooms.forEach(async (room) => {
        if (!room.adminId) return;

        if (!ownerPics[room.adminId]) {
          const pic = await getOwnerProfilePic(room.adminId);
          setOwnerPics(prev => ({ ...prev, [room.adminId]: pic }));
        }
      });
    }, [rooms]);

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
  }, [user]);

        const getActiveUsersList = (users) => {
  if (!users) return [];
  const ACTIVE_THRESHOLD = 5000; // 5 seconds
  return users.filter(u => {
    if (!u.lastSeen) return false;
    const lastSeenMs = u.lastSeen.toDate ? u.lastSeen.toDate().getTime() : new Date(u.lastSeen).getTime();
    return Date.now() - lastSeenMs < ACTIVE_THRESHOLD;
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
              <span className="roomElements">
                <h1>Name</h1>
                <h1>Owner</h1>
                <h1>Online</h1>
                <h1>Users</h1>
              </span>
              <div className="RoomsButtons">
              {rooms.length === 0 && <p className="NoRooms">No rooms available. Create one!</p>}
              
              {rooms.map((room) => (
                <div key={room.id} className="roomWrapper">
                  <button
                    className="roomButton"
                    onClick={() => joinRoom(room)}
                  >
                    <h3>{room.name}</h3>
                    <div className="imageShower">
                      <img
                        src={room.adminId === user.uid ? profilePic : ownerPics[room.adminId]}
                        id="ownerPic"
                        alt="Profile"
                      />
                    </div>
                    <h1 className="roomPplcount">
                      {getActiveUsersList(activeUsersList[room.id]).length}/{room.capacity}
                    </h1>
                    <ul className="activeUsersList">
                      {getActiveUsers(activeUsersList[room.id]).map((user) => (
                        <li key={user.email}>{user.name}</li>
                      ))}
                    </ul>
                  </button>

                  {room.adminId === user.uid && (
                    
                      <FaTrashAlt id="iconDelete" onClick={() => deleteRoom(room)}/> 
                    
                  )}
                </div>
                  
                  ))}
              </div>
            </div>
            <div className="buttons">
              <button onClick={() => setIsRoomPopupOpen(true)} className="lobbyButton">
                <FaPlus/> Add room
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
