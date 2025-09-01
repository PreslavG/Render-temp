import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login";
import RegistrationForm from "./Register";
import Lobby from "./Lobby";
import Room from "./Room";
import { useEffect, useState } from "react";
import { auth } from "./scripts/firebase";
import { onAuthStateChanged } from "firebase/auth";


export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // to wait for auth check

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p>Loading...</p>; // optional: show while checking auth

  return (
    <BrowserRouter>
      <Routes>
        {/* Login page */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/lobby" />} />

        {/* Registration page */}
        <Route path="/register" element={!user ? <RegistrationForm /> : <Navigate to="/lobby" />} />

        {/* Lobby page */}
        <Route path="/lobby" element={user ? <Lobby /> : <Navigate to="/login" />} />

        <Route path="/room/:roomId" element={user ? <Room /> : <Navigate to="/login" />} />

        {/* Redirect unknown paths */}
        <Route path="*" element={<Navigate to={user ? "/lobby" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  )}