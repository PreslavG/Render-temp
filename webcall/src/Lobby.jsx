import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "./scripts/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import  socket  from "./scripts/socket";

export default function Lobby() {
  const navigate = useNavigate();
  const [currentUserEmail, setCurrentUserEmail] = useState(null); // ✅ store email in state



  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserEmail(user.email); // save email in state
        socket.connect(); // connect once user is logged in
      } else {
        alert("Sign in first");
        navigate("/"); // redirect to login if not signed in
      }
    });


    return () => unsubscribe(); // cleanup listener on unmount
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login"); // go back to login page
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const joinRoom = (roomId) => {
    if (!currentUserEmail) {
      alert("User not logged in yet");
      return;
    }

    navigate(`/room/${roomId}`); // SPA navigation
    alert(socket.id + "     email:  " + currentUserEmail);
  };

  return (
    <div>
      <h1>Lobby</h1>
      <button onClick={() => joinRoom("my-room-1")}>Join Room 1</button>
      <button onClick={() => joinRoom("my-room-2")}>Join Room 2</button>
      <button onClick={() => joinRoom("my-room-3")}>Join Room 3</button>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
