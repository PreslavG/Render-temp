 
import { useEffect, useState } from "react";
import { storage } from "./scripts/firebase"; 
import { ref,listAll, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { signOut } from "firebase/auth";
import {  updateProfile, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail} from "firebase/auth";
import Modal from "react-modal";
import { db, auth } from "./scripts/firebase";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import "./Account.css";
import { FaUpload } from "react-icons/fa";


Modal.setAppElement("#root");


 export default function AccountPage(){
  const [file, setFile] = useState(null);
  const [images, setImages] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const user = auth.currentUser;
  const [newUsername, setNewUsername] = useState(auth.currentUser.displayName);
  const [newEmail, setNewEmail] = useState(auth.currentUser.email);
  const [info, setInfo] = useState("");
  const [PhotoUrl, setPhotoUrl] = useState();
  const [profilePic, setProfilePic] = useState();
  const [locked, setLocked] = useState(true);
  const [popupdelorSet, setPopupdelorSet] = useState(false);
  const [urlLink, setUrlLink] = useState("");

  useEffect(() =>{
    setUrl();
    loadImages();
    console.log("Providers:", auth.currentUser.providerData);
    
  },[])

  
 const deleteImage = async (url) => {
  try {
    const imageRef = ref(storage, `users/${user.uid}/images/${url.split('%2F').pop().split('?')[0]}`); 
    await deleteObject(imageRef);

    alert("Image deleted successfully");
    loadImages(); 
  } catch (error) {
    console.error("Error deleting image:", error);
    alert("Failed to delete image");
  }
};
  const handleLogout = async () => {
        try {
          await signOut(auth);
          navigate("/login");
        } catch (error) {
          console.error("Logout failed:", error);
        }
      };

  const setUrl = async() =>{

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

  }

  const uploadImage = async () => {
    if (!user) return alert("Not logged in");
    if (!file) return alert("Choose a file first");

    const fileRef = ref(storage, `users/${user.uid}/images/${file.name}`);
    await uploadBytes(fileRef, file);

    alert("Picture is uploaded");
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
  
  setPhotoUrl(url);
  console.log("Selected Url is:", url);
};

  const saveProfilePic = async () => {
  if (!PhotoUrl) return;

   const photourl = PhotoUrl;
   const docRef = doc(db, "users", user.uid);
  await setDoc(docRef, { profilePic: photourl }, { merge: true });

   setProfilePic(photourl);
   window.location.reload();
   console.log("ProficePic Link is set to: ", photourl);

};

const saveChanges = async () => {
  if (!user) return;

  try {
    const password = prompt("Enter your password to verify identity:");
    const credential = EmailAuthProvider.credential(user.email, password);

    await reauthenticateWithCredential(user, credential);
    console.log("Reauth success");

    await updateProfile(user, {
      displayName: newUsername
    });

    if (newEmail !== auth.currentUser.email) {
      await verifyBeforeUpdateEmail(user, newEmail);
      alert("A verification email has been sent to the new address. Please confirm it.");
    }


    const userRef = doc(db, "users", user.uid);
    await setDoc(
      userRef,
      {
        name: newUsername,
        email: newEmail,
        info: info
      },
      { merge: true }
    );

    

    setLocked(true);

    if (newEmail !== auth.currentUser.email) {
      alert("You will now be signed out. Log in again after verifying your new email.");
      await signOut(auth);
      navigate("/login");
    }

  } catch (error) {
    console.error("Update failed:", error);
    alert(error.message);
  }
};


 return (
      <div className="AccountPage">
          <div className="AccountElements">
          <div className="Account_info">
              <h1>{newUsername}</h1>
              <div className="profileDiv" >
        

        {/* PROFILE PIC */}
        {PhotoUrl ? (
          <img
            src={PhotoUrl}
            alt="Profile"
            width={200}
            height={200}
            style={{ borderRadius: "50%", marginBottom: 10 }}
          />
        ) : (
          <img
            src={profilePic}  
            alt="Default"
            width={150}
            height={150}
            style={{ borderRadius: "50%", marginBottom: 10}}
          />
        )}

        <br />

        {/* OPEN GALLERY BUTTON */}
        <button className="uploadButton" onClick={() => setModalOpen(true)}>
          Choose Profile Picture
        </button>

        {/* UPLOAD SECTION */}
        <div style={{ marginTop: 20 }}>
          <input type="file" onChange={e => setFile(e.target.files[0])} />
          <button className="uploadButton" onClick={uploadImage}><FaUpload/> Upload </button>
        </div>
        <button className="Save" onClick={saveProfilePic}>Save</button>
        <button  className="Logout" onClick={handleLogout}>
           Logout
         </button>

        
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
          {images.length === 0 ? <p>No images available, upload first!</p> : <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, 120px)",
            gap: "90px"
          }}>
            {images.map((url, index) => (
              <img
                key={index}
                src={url}
                alt=""
                width={200}
                height={200}
                style={{
                  cursor: "pointer",
                  borderRadius: 10,
                  border: "3px solid transparent"
                }}
                onClick={() => { setUrlLink(url) ,setPopupdelorSet(true)}}
              />
            ))}
          </div>
          }
          
          {popupdelorSet && (
            <div className="blurOverlay">
            <div className="popupdelorSet">
              <h3>Do you want to set this picture as your profile picture?</h3>
              <button className="uploadButtonProfile" onClick={() => {chooseImage(urlLink), setModalOpen(false), setPopupdelorSet(false)}}>Set as Profile Picture</button>
              <button className="deleteButton" onClick={() => {deleteImage(urlLink), setPopupdelorSet(false)}}>Delete </button>
            </div>
            </div>
          )}
            

          <button style={{ marginTop: 20 }} onClick={() => setModalOpen(false)}>
            Close
          </button>
        </Modal>
      </div>
              <div>
      </div>
          </div>
          <div className="Elements">
          <div className="elementList">
            <h1>Username: </h1>
            <div className="username">
              <input id="userName" type="text" value={newUsername} readOnly={locked} onChange={e => setNewUsername(e.target.value)}/>
            </div>
              <h1>Email address: </h1>
            <div className="email">
              <input id="userEmail" type="email" value={newEmail} readOnly={locked} onChange={e => setNewEmail(e.target.value)}/>
            </div>
              <h1>Info:</h1>
              <div className="Info">
                <input type="text" placeholder="Info:" value={info} readOnly={locked} onChange={e => setInfo(e.target.value)}/>
              </div>   

              <button className="Edit" onClick={() => setLocked(!locked)}>
                {locked ? "Edit 📝" : "Cancel"}
              </button>

              {!locked && (
                <button className="Edit" onClick={saveChanges}>Save Changes</button>
              )}

          </div>
          </div>
          </div>

    </div>
  );
};