import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile} from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCpjDc8MrZKjYdYuJPSw5Q3E26aY9pfQtg",
  authDomain: "webcalls-78f47.firebaseapp.com",
  projectId: "webcalls-78f47",
  storageBucket: "webcalls-78f47.firebasestorage.app",
  messagingSenderId: "749637623028",
  appId: "1:749637623028:web:19066f18450b34535652a1",
  measurementId: "G-8DKB3HSN7K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);



document.querySelector("#registrationForm").addEventListener("submit", (e) => {
  e.preventDefault(); // stop form from refreshing page

const name = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;


if (!email || !password) {
    alert("Please fill out all fields");
    return;
  }

  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      // save name into Firebase user profile
      return updateProfile(user, { displayName: name }).then(() => user);
    })
    .then((user) => {
      alert(`Registered successfully! Welcome, ${user.displayName}`);
      window.location.href = "index.html";
    })
    .catch((error) => {
      alert("Ne taka bratlee");
      console.error(error.code, error.messag);
    });
});