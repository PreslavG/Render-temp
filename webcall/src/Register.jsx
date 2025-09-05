import { useState } from "react";
import { auth } from "./scripts/firebase"; // your firebase.js file
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import  socket  from "./scripts/socket";
import "./Register.css"
import { Navigate, useNavigate } from "react-router-dom";


export default function RegistrationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); // prevent page refresh
    if (!email || !password || !name) {
      alert("Please fill out all fields");
      return;
    }

    try {
      // create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // update display name
      await updateProfile(user, { displayName: name });

      alert(`Registered successfully! Welcome, ${user.displayName}`);

      // optionally clear form
      setName("");
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error(error.code, error.message);
      alert("Registration failed. Please try again.");
    }
  };
  const goToLogin = () => {
    navigate("/login"); // navigate to registration page
        };

  return (
    <div className="Page">
      <div className="registerReturn">
          <form className="formData" onSubmit={handleSubmit}>
          <h2 className="registerTitle">Register</h2>
      <div>
        <label htmlFor="username">Name:</label>
        <input
          type="text"
          id="username"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="email">Email:</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="password">Password:</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <button className="registerButton" type="submit">Register</button>
         </form>
          <a href="" onClick={goToLogin}>Already have an account?</a>
      </div>
    </div>
  );
}
