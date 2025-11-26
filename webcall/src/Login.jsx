import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "./scripts/firebase";
import socket from "./scripts/socket";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      alert("Login successful!");
      console.log("Logged in:", user.email);

      // Connect to socket
      socket.connect();
      socket.emit("user-connected", { email: user.email, socketId: socket.id });

      // Navigate to lobby
      navigate("/lobby");
    } catch (error) {
      alert("Login failed: " + error.message);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    if (!email) {
      alert("Please enter your email first");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent! Check your inbox.");
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  const goToRegister = () => {
    navigate("/register");
  };

  return (
     
  
     
    <div className="Page">
      <div className="loginReturn">
        <div className="lobbyInfo">
          <img src="logo_image.png" id="LogoLogin"/>


      </div>
      <div className="loginBox">
        <h2 className="login title">Login</h2>
        <form className="formData" onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <a href="#" id="forgPass" onClick={handleForgotPassword}>
            Forgot password?
          </a>
          <button className="loginButton" type="submit">
            Login
          </button>
        </form>
        <p>Don't have an account?</p>
        <button type="button" onClick={goToRegister} className="loginButton">
          Sign up
        </button>
      </div>
      </div>
    </div>
  );
}
