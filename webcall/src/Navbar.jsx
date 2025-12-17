import { useNavigate } from "react-router-dom";
import { db, auth } from "./scripts/firebase";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import "./Navbar.css";


export default function Navbar() {
  const navigate = useNavigate();
  const [profilePic,setProfilePic] = useState(null);

  const setUrl = async () => {
    try {
      const docRef = doc(db, "users", auth.currentUser.uid);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const profilePic = snap.data().profilePic;
        setProfilePic(profilePic);
        return profilePic;
      } else {
        console.log("Document does not exist");
        return null;
      }
    } catch (error) {
      console.error("Error fetching user document:", error);
    }
  };

  useEffect(() => {
    setUrl();
  });

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <nav
    >

        <button className="navButton"
            onClick={() => navigate("/friends")} >
            Friends
          </button>

        <button className="navButton"
          onClick={() => navigate("/lobby")} >
          Rooms
        </button>
      
      <button className="navButtonLogout"
          onClick={handleLogout}
          
        >
          Logout
        </button>

        {profilePic ? (
          <img
            src={profilePic}
            id="Profile" onClick={()=> navigate("/Account")}           
          />
        ) : (
          <div className="ProfileDef"/>
        )}

    </nav>
  );
}