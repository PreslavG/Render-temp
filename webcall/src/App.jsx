import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth } from "./scripts/firebase";
import { onAuthStateChanged } from "firebase/auth";

import Login from "./Login";
import RegistrationForm from "./Register";
import Lobby from "./Lobby";
import Room from "./Room";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p>Loading...</p>; 

  return (
    <BrowserRouter>
      <Routes>
        {/* Login / Register */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/lobby" />} />
        <Route path="/register" element={!user ? <RegistrationForm /> : <Navigate to="/lobby" />} />

        {/* Lobby */}
        <Route path="/lobby" element={user ? <Lobby /> : <Navigate to="/login" />} />

        {/* Room */}
        <Route path="/room/:roomId" element={user ? <Room /> : <Navigate to="/login" />} />

        {/* Redirect unknown paths */}
        <Route path="*" element={<Navigate to={user ? "/lobby" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}
