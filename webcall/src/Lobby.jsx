import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db, rtdb } from "./scripts/firebase";
import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot } from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import "./Lobby.css";

export default function Lobby() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeTab, setActiveTab] = useState("rooms");
  const user = auth.currentUser;

  // Sign out
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Join room
  const joinRoom = (room) => {
    if (!user) return;
    const role = room.adminId === user.uid ? "admin" : "user";
    navigate(`/room/${room.id}`, { state: { role } });
  };

  // Fetch rooms
  useEffect(() => {
    if (!user) return;
    const roomsRef = collection(db, "rooms");
    const unsubscribe = onSnapshot(roomsRef, (snapshot) => {
      setRooms(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch all users
  useEffect(() => {
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      setUsers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Listen for online users
 useEffect(() => {
  const statusRef = ref(rtdb, "status");
  onValue(statusRef, (snapshot) => {
    const data = snapshot.val() || {};
    const onlineList = Object.entries(data)
      .filter(([_, val]) => val.state === "online")
      .map(([uid]) => uid);
    setOnlineUsers(onlineList);
  });
}, []);

  // Add room
  const roomAdd = async () => {
    if (!user) return;
    if (text.trim() === "") return;
    try {
      await addDoc(collection(db, "rooms"), {
        name: text,
        createdAt: new Date(),
        adminId: user.uid,
        adminEmail: user.email,
      });
      setText("");
      setIsOpen(false);
    } catch (e) {
      console.error("Error adding room:", e);
    }
  };

  return (
    <div className="returnLobby">

      {/* Room popup */}
      {isOpen && (
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
              <button onClick={() => setIsOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabButtons">
        <button className={activeTab === "rooms" ? "activeTab" : ""} onClick={() => setActiveTab("rooms")}>Rooms</button>
        <button className={activeTab === "users" ? "activeTab" : ""} onClick={() => setActiveTab("users")}>Users</button>
        <button className={activeTab === "online" ? "activeTab" : ""} onClick={() => setActiveTab("online")}>Online</button>
      </div>

      {/* ROOMS TAB */}
      {activeTab === "rooms" && (
        <div className="buttonList">
          <div className="TitlesAndRooms">
            <h1 className="buttonlistTitle">Available Rooms:</h1>
            <div className="RoomsButtons">
              {rooms.map((room) => (
                <button key={room.id} className="roomButton" onClick={() => joinRoom(room)}>
                  {room.name} {room.adminId === user.uid && <span>👑</span>}
                  <h1 className="roomPplcount">5👤</h1>
                </button>
              ))}
            </div>
          </div>
          <div className="buttons">
            <button onClick={() => setIsOpen(true)} className="lobbyButton">Add Room</button>
            <button onClick={handleLogout} className="lobbyButton">Logout</button>
          </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === "users" && (
        <div className="usersList">
          <h1 className="buttonlistTitle">All Users:</h1>
          <div className="UsersContainer">
            {users.map((u) => (
              <div key={u.id} className="userCard">
                <img src={u.photoURL || "https://via.placeholder.com/50"} alt="User" className="userAvatar" />
                <div>
                  <p className="userName">{u.name || "Anonymous"}</p>
                  <p className="userEmail">{u.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ONLINE USERS TAB */}
      {activeTab === "online" && (
        <div className="usersList">
          <h1 className="buttonlistTitle">Online Now:</h1>
          <div className="UsersContainer">
            {users
              .filter((u) => onlineUsers && onlineUsers[u.id]?.state === "online")
              .map((u) => (
                <div key={u.id} className="userCard">
                  <img src={u.photoURL || "https://via.placeholder.com/50"} alt="User" className="userAvatar" />
                  <div>
                    <p className="userName">{u.name || "Anonymous"}</p>
                    <p className="userEmail">{u.email}</p>
                    <span className="onlineDot"></span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
