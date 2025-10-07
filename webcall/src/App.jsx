import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, db, rtdb, ref, set, onDisconnect, serverTimestamp } from "./scripts/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, serverTimestamp as fsTimestamp } from "firebase/firestore";

import Login from "./Login";
import RegistrationForm from "./Register";
import Lobby from "./Lobby";
import Room from "./Room";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔹 Track authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // ✅ Save / update user profile in Firestore
        const userRef = doc(db, "users", currentUser.uid);
        await setDoc(
          userRef,
          {
            uid: currentUser.uid,
            name: currentUser.displayName || "Anonymous",
            email: currentUser.email,
            photoURL: currentUser.photoURL || "",
            lastLogin: fsTimestamp(),
          },
          { merge: true }
        );

        // ✅ Handle online presence in Realtime Database
        const statusRef = ref(rtdb, `/status/${currentUser.uid}`);

        const isOnline = {
          state: "online",
          last_changed: serverTimestamp(),
        };

        const isOffline = {
          state: "offline",
          last_changed: serverTimestamp(),
        };

        // Set user online
        await set(statusRef, isOnline);

        // Auto-set offline when disconnected
        onDisconnect(statusRef).set(isOffline);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <BrowserRouter>
      <Routes>
        {/* 🔑 Auth Pages */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/lobby" />}
        />
        <Route
          path="/register"
          element={!user ? <RegistrationForm /> : <Navigate to="/lobby" />}
        />

        {/* 🏠 Lobby */}
        <Route
          path="/lobby"
          element={user ? <Lobby /> : <Navigate to="/login" />}
        />

        {/* 🎥 Room */}
        <Route
          path="/room/:roomId"
          element={user ? <Room /> : <Navigate to="/login" />}
        />

        {/* 🚦 Catch-all redirect */}
        <Route
          path="*"
          element={<Navigate to={user ? "/lobby" : "/login"} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
