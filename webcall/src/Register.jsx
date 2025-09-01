import { useState } from "react";
import { auth } from "./scripts/firebase"; // your firebase.js file
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import  socket  from "./scripts/socket";


export default function RegistrationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  return (
    <form onSubmit={handleSubmit}>
      <h2>Register</h2>
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

      <button type="submit">Register</button>
    </form>
  );
}
