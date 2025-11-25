// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getFirestore} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, set, onDisconnect, serverTimestamp } from "firebase/database";
import { getStorage } from "firebase/storage";

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
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

export { auth, db, rtdb, storage, ref, set, onDisconnect, serverTimestamp };
