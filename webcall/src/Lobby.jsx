import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, db } from "./scripts/firebase";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, onSnapshot } from "firebase/firestore";
import "./Lobby.css";

export default function Lobby() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [rooms, setRooms] = useState([]);
  const user = auth.currentUser;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const joinRoom = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  useEffect(() => {
    if (!user) return;

    const roomsCollectionRef = collection(db, "users", user.uid, "rooms");

    const unsubscribe = onSnapshot(roomsCollectionRef, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRooms(data);
    });

    return () => unsubscribe();
  }, [user]);

  const roomAdd = async () => {
    if (!user) return;
    if (text.trim() === "") return;

    try {
      await addDoc(collection(db, "users", user.uid, "rooms"), {
        name: text,
        createdAt: new Date(),
      });

      setText("");
      setIsOpen(false);
    } catch (e) {
      console.error("Error adding room:", e);
    }
  };

  return (
    <div className="returnLobby">


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

      <div className="buttonList">
      <div className="TitlesAndRooms">
        <h1 className="buttonlistTitle">Your Rooms:</h1>
        <div className="RoomsButtons">
        {rooms.map((room) => (
          <button
            key={room.id}
            className="roomButton"
            onClick={() => joinRoom(`${room.id}`)}
          >
            {room.name}
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
      
    </div>
  );
}
