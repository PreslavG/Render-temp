import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, db, rtdb, ref, set, onDisconnect, serverTimestamp } from "./scripts/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp as fsTimestamp } from "firebase/firestore";

import Login from "./Login";
import RegistrationForm from "./Register";
import Lobby from "./Lobby";
import Room from "./Room";
import Breakroom from "./Breakroom";
import Account from "./Account";
import Files from "./Files";
import Friends from "./Friends";

import Layout from "./LayoutLogoNavbar";
import LayoutLogo from "./LayoutLogo";   

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const existing = await getDoc(userRef);

        if (!existing.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            name: currentUser.displayName || "Anonymous",
            email: currentUser.email,
            lastLogin: fsTimestamp(),
            profilePic: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHfd3PPulVSp4ZbuBFNkePoUR_fLJQe474Ag&s"
          });
        } else {
          await setDoc(
            userRef,
            { lastLogin: fsTimestamp() },
            { merge: true }
          );
        }

        const statusRef = ref(rtdb, `/status/${currentUser.uid}`);

        await set(statusRef, {
          state: "online",
          last_changed: serverTimestamp(),
        });

        onDisconnect(statusRef).set({
          state: "offline",
          last_changed: serverTimestamp(),
        });
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
      <Routes>
        <Route
          path="/login"
          element={
            <LayoutLogo>
                    {!user ? <Login /> : <Navigate to="/lobby" />}
            </LayoutLogo>
            }
        />

        <Route
          path="/register"
          element={!user ? <RegistrationForm /> : <Navigate to="/lobby" />}
        />

        <Route
          path="/lobby"
          element={<Layout>{user ? <Lobby /> : <Navigate to="/login" />}</Layout>}
        />

        <Route
          path="/room/:roomId"
          element={user ? <Room /> : <Navigate to="/login" />}
        />

        <Route
          path="/breakroom/:roomIdWithSuffix"
          element={user ? <Breakroom /> : <Navigate to="/login" />}
        />

        <Route
          path="/account"
          element={<Layout>{user ? <Account /> : <Navigate to="/login" />}</Layout>}
        />

        <Route
          path="/files"
          element={<Layout>{user ? <Files /> : <Navigate to="/login" />}</Layout>}
        />

        <Route
          path="/Friends"
          element={<Layout>{user ? <Friends /> : <Navigate to="/login" />}</Layout>}
        />

        <Route
          path="*"
          element={<Navigate to={user ? "/lobby" : "/login"} />}
        />
      </Routes>
  );
}
