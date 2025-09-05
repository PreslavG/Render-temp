import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword,sendPasswordResetEmail } from "firebase/auth";
import { auth } from "./scripts/firebase";
import  socket  from "./scripts/socket";
import "./Login.css"

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

  const handleForgotPassword = async () => {
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


  return (
  <div className="Page">
    <div className="loginReturn">
      <h2 className="login title">Login</h2>
      <form className="formData">
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
        <a href="#" id="forgPass" onClick={handleForgotPassword}>Forgot password?</a>
        <button onClick={handleLogin} className="loginButton">Login</button>
        <p>Dont have a registration?</p>
        <button onClick={goToRegister} className="loginButton">Sign up</button>
      </form>
    </div>
    </div>
  );
}
