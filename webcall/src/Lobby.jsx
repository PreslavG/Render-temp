import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "./scripts/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function Lobby() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        alert("Sign in first");
        navigate("/login");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const joinRoom = (roomId) => {
    // just navigate; Room will handle Firebase email automatically
    navigate(`/room/${roomId}`);
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
