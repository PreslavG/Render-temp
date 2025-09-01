import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./scripts/firebase";
import { socket } from "./scripts/socket";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const user = userCredential.user;
        alert("Login successful!");
        console.log("Logged in:", user.email);

        // Connect socket now
        socket.connect();
        socket.emit("user-connected", { email: user.email, socketId: socket.id });

        // Navigate to Lobby
        navigate("/lobby");
      })
      .catch((err) => {
        alert(err.message);
      });
      const handleLogin = async () => {
  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, password);
    navigate("/lobby");
  } catch (error) {
    alert("Login failed: " + error.message);
  }
};

      
    };
     const goToRegister = () => {
    navigate("/register"); // navigate to registration page
        };

        

  return (
    <div>
      <h2>Login</h2>
      <form >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin}>Login</button>
        <p>Dont have a registration</p>
        <button onClick={goToRegister}>Sign up</button>
      </form>
    </div>
  );
}
