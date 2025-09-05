import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "./scripts/firebase";
import { useState, useEffect } from "react";
import { db } from "./scripts/firebase.js";
import { collection, getDocs, addDoc, onSnapshot } from "firebase/firestore";
import "./Lobby.css"

export default function Lobby() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [buttons, setButtons] = useState([]);
  const [rooms, setRooms] = useState([]);

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


  function openPopup(){

  }

  function closePopup() {
    
  }


  
  function createButton(text, onClick){
    const buttonAddroom = document.createElement("button");

     button.addEventListener("click", onClick);

     document.body.appendChild(buttonAddroom);

    return buttonAddroom;

  }

  useEffect(() => {
    //set up a listener on "rooms" collection /
  const unsubscribe = onSnapshot(collection(db, "rooms"), (snapshot) => {
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setRooms(data); // update state in real time
  });

  // cleanup when component unmounts
  return () => unsubscribe();
}, []);




  async function roomAdd () {
    try {
    if (text.trim() === "") return;

    await addDoc(collection(db, "rooms"), {

      id: text
       
    });
    
      setText(""); // clear input
      setIsOpen(false); // close popup
    
  } catch (e) {
    console.error("Error adding document:", e);
  }
    
  }


  return (
    <div className="returnLobby">
      <div className="lobbyInfo">
        <h1 className="lobbyTitle">Lobby</h1>
        <h1 className="infoText">You are now in the lobby of the online classroom!</h1>
        <p>Now choose one of the few rooms we have to start studying like never before!
          And remember, 10, 11 or 12 hours aren't worth it if you don't remember anything at the end, so there is timer, to remember when to rest! 
        </p>

        <p>
          If you want you can always leave us 😔 or create a new room with button! 
        </p>
       <div className="buttons">
        <button onClick={handleLogout} className="lobbyButton">Logout</button>
        <button onClick={() => setIsOpen(true)} className="lobbyButton">Add Room</button>
        </div>

        <h2>Enjoy!</h2>

      </div>

        <div className="buttonList">
          <h1 className="buttonlistTitle">Rooms:</h1>
            {rooms.map((room) => (
            <button
              key={room.id}
               className="roomButton"
                onClick={() => joinRoom(`${room.id}`)}>
               {room.id}
            </button>
            ))}
        </div>


      {/* Popup */}
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

    </div>
  );
}


