import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail} from "firebase/auth";


const firebaseConfig = {
  apiKey: "AIzaSyDg015yHZp085jag5rd4TdxEhQruMPOIlU",
  authDomain: "online-classroom-42fe3.firebaseapp.com",
  projectId: "online-classroom-42fe3",
  storageBucket: "online-classroom-42fe3.firebasestorage.app",
  messagingSenderId: "1025372282011",
  appId: "1:1025372282011:web:27c9b2b36968f485eb3a3e",
  measurementId: "G-EYVMGRMELW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginForm = document.querySelector(".login__form");


loginForm.addEventListener("submit", (e) => {
  e.preventDefault(); // stop form from refreshing page

  const email = loginForm.querySelector('input[type="email"]').value;
  const password = loginForm.querySelector('input[type="password"]').value;

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      alert("Login successful!");
      console.log("Login successful:", userCredential.user);
      window.location.href = "webpage.html";
    })
    .catch((error) => {
      alert(error.message);
    });
});
const forgotPasswordLink = document.querySelector(".login__forgot");
forgotPasswordLink.addEventListener("click", (e) => {
  e.preventDefault();

  const email = loginForm.querySelector('input[type="email"]').value;

  if (!email) {
    alert("Please enter your email first.");
    return;
  }

  sendPasswordResetEmail(auth, email)
    .then(() => {
      alert("Password reset email sent! Check your inbox.");
    })
    .catch((error) => {
      alert(error.message);
    });
});