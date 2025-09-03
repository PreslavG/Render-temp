import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "./scripts/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function Lobby() {
  const navigate = useNavigate();

  // Check if user is logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        alert("Sign in first");
        navigate("/login");
      }
    });

    return () => unsubscribe();
  });

  // Logout function
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Join a room
  const joinRoom = (roomId) => {
    navigate(roomId);
  };

  return (
    <div>
      <h1>Lobby</h1>
      <button onClick={() => joinRoom("Math")}>Join Math</button>
      <button onClick={() => joinRoom("Medicine")}>Join Medicine</button>
      <button onClick={() => joinRoom("Programming")}>Join Programming</button>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
