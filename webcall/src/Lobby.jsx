import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "./scripts/firebase";

export default function Lobby() {
  const navigate = useNavigate();

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

  return (
    <div>
      <h1>Lobby</h1>
      <div>
        <button onClick={() => joinRoom("my-room-1")}>Join Room 1</button>
        <button onClick={() => joinRoom("my-room-2")}>Join Room 2</button>
        <button onClick={() => joinRoom("my-room-3")}>Join Room 3</button>
      </div>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
