 
import { use, useEffect, useRef, useState } from "react";
import { storage } from "./scripts/firebase"; 
import { ref,listAll, uploadBytes, getDownloadURL } from "firebase/storage";

import Modal from "react-modal";
import { useParams, useNavigate } from "react-router-dom";
import socket from "./scripts/socket";
import { db, auth } from "./scripts/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import "./Account.css";

Modal.setAppElement("#root");


 export default function AccountPage(){
  const [file, setFile] = useState(null);
  const [images, setImages] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const user = auth.currentUser;
  const username = user.displayName;
  const [profilePic, setProfilePic] = useState();

  useEffect(() =>{
    console.log("user", user.uid);
    console.log("Username", username);
    setUrl();
    console.log("ei go linka", profilePic);

  })

  const setUrl = async() =>{

    const docRef = doc(db, "users", auth.currentUser.uid);   // <-- your document ID
    const snap = await getDoc(docRef);

    if (snap.exists()) {
    const profilePic = snap.data().profilePic; 
    setProfilePic(profilePic);
     return profilePic;
  } else {
    console.log("Document does not exist");
    return null;
  }

  }

  const uploadImage = async () => {
    if (!user) return alert("Not logged in");
    if (!file) return alert("Choose a file first");

    const fileRef = ref(storage, `users/${user.uid}/images/${file.name}`);
    await uploadBytes(fileRef, file);

    alert("Uploaded!");
    loadImages(); 
  };

    const loadImages = async () => {
    if (!user) return;

    const folderRef = ref(storage, `users/${user.uid}/images`);
    const list = await listAll(folderRef);

    const urls = await Promise.all(
      list.items.map(i => getDownloadURL(i))
    );

    setImages(urls);
  };


  const chooseImage = async (url) => {
  if (!user) return;

  console.log("Saving profilePic to Firestore:", url);
  const docRef = doc(db, "users", user.uid);
  await setDoc(docRef, { profilePic: url }, { merge: true });
  setProfilePic(url);
};

  const saveProfilePic = async () => {
  if (!user) return alert("Not logged in");
  if (!profilePic) return alert("No profile picture selected");

  const docRef = doc(db, "users", user.uid);
  await setDoc(docRef, { profilePic: profilePic }, { merge: true });

  alert("Profile picture saved!");
};

   
  
 return (
    <div className="AccountPage">
        <div className="AccountElements">
        <div className="Account_info">
            <h1>{username}</h1>
             <div style={{ padding: 20 }}>
      <h2>Your Profile</h2>

      {/* PROFILE PIC */}
      {profilePic ? (
        <img
          src={profilePic}
          alt="Profile"
          width={120}
          style={{ borderRadius: "50%", marginBottom: 10 }}
        />
      ) : (
        <p>No profile pic set</p>
      )}

      <br />

      {/* OPEN GALLERY BUTTON */}
      <button onClick={() => setModalOpen(true)}>
        Choose Profile Picture
      </button>

      {/* UPLOAD SECTION */}
      <div style={{ marginTop: 20 }}>
        <input type="file" onChange={e => setFile(e.target.files[0])} />
        <button onClick={uploadImage}>Upload Image</button>
      </div>
      <button onClick={saveProfilePic}>Save</button>

      {/* MODAL: IMAGE PICKER */}
      <Modal
        isOpen={modalOpen}
        onRequestClose={() => setModalOpen(false)}
        style={{
          content: {
            width: "70%",
            margin: "auto",
            padding: 20
          }
        }}
      >
        <h2>Select an image</h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, 120px)",
          gap: "10px"
        }}>
          {images.map((url, index) => (
            <img
              key={index}
              src={url}
              alt=""
              width={120}
              style={{
                cursor: "pointer",
                borderRadius: 10,
                border: "3px solid transparent"
              }}
              onClick={() => chooseImage(url)}
            />
          ))}
        </div>
        

        <button style={{ marginTop: 20 }} onClick={() => setModalOpen(false)}>
          Close
        </button>
      </Modal>
    </div>
            <div>
    </div>
        </div>
        <div className="elementList">
            <h1>da</h1>
            <h1>nz</h1>
            <h1>bsad</h1>
        </div>
        </div>

    </div>
  );
};