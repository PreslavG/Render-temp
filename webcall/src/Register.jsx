import { useState } from "react";
import { auth, db } from "./scripts/firebase"; 
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore"; 
import { useNavigate } from "react-router-dom";
import "./Register.css";

export default function RegistrationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    if (!email || !password || !name) {
      alert("Please fill out all fields");
      return;
    }

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update display name in Auth profile
      await updateProfile(user, { displayName: name });

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: user.email,
        createdAt: new Date(),
      });

      alert(`Registered successfully! Welcome, ${name}`);

      // Reset fields
      setName("");
      setEmail("");
      setPassword("");

      // Redirect to login (or dashboard, your choice)
      navigate("/login");

    } catch (error) {
      console.error(error.code, error.message);
      alert("Registration failed. Please try again.");
    }
  };

  const goToLogin = () => {
    navigate("/login"); 
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

        <button type="button" onClick={goToLogin} className="registerButton">
          Already have an account?
        </button>
      </div>
    </div>
  );
}
