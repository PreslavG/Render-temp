import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "./scripts/firebase";
import { useState, useEffect } from "react";
import { db } from "./scripts/firebase.js";
import { collection, getDocs, addDoc, onSnapshot } from "firebase/firestore";

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
     <div>
      <h1>Lobby</h1>

      <div className="p-4 space-y-2">
      {rooms.map((room) => (
        <button
          key={room.id}
          className="px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600"
          onClick={() => joinRoom(`${room.id}`)}
          
        >
          {room.id}
        </button>
      ))}
    </div>

     <button onClick={handleLogout}>Logout</button>



    
      <button onClick={() => setIsOpen(true)}>Add Button</button>

      {/* Popup */}
      {isOpen && (
        <div>
          <h3>Enter button text:</h3>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type here..."
          />
          <div>
            <button onClick={roomAdd}>Submit</button>
            <button onClick={() => setIsOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}


