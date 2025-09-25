// ./firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,updateEmail, updatePassword, } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';
import { getFirestore, collection, addDoc,getDoc, getDocs, updateDoc, doc, query, where, onSnapshot, arrayUnion, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCvEmF2Usio9q7JW5SE0GEwnWE9H7RHMxA",
    authDomain: "oga-landlord-104b2.firebaseapp.com",
    projectId: "oga-landlord-104b2",
    storageBucket: "oga-landlord-104b2.firebasestorage.app",
    messagingSenderId: "593384161221",
    appId: "1:593384161221:web:b23d55494443c766be15ac"
};

let app, auth, db;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error('Firebase initialization failed:', error);
  throw error;
}

// Export everything needed by script.js
export {
  auth,
  db,
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  arrayUnion,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateEmail,
   updatePassword,
   deleteDoc
};