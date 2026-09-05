import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBuBuFipylqYXaU5dzXuMRvp0sMuoucOlg",
  authDomain: "willian-calorie-tracker.firebaseapp.com",
  projectId: "willian-calorie-tracker",
  storageBucket: "willian-calorie-tracker.firebasestorage.app",
  messagingSenderId: "358007741111",
  appId: "1:358007741111:web:1d9b7e790fd74d07c90b32"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

// Firebase Auth Methods
export async function loginWithEmail(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email, password) {
  return await createUserWithEmailAndPassword(auth, email, password);
}

export async function loginWithGoogle() {
  return await signInWithPopup(auth, googleProvider);
}

export async function loginAsGuest() {
  return await signInAnonymously(auth);
}

export async function logoutUser() {
  return await firebaseSignOut(auth);
}

// Firestore User Data Sync Helpers
export async function getUserProfile(uid) {
  try {
    const docRef = doc(db, "users", uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().profile || null;
    }
    return null;
  } catch (err) {
    console.error("Erro ao buscar perfil no Firestore:", err);
    return null;
  }
}

export async function saveUserProfile(uid, profileData) {
  try {
    const docRef = doc(db, "users", uid);
    await setDoc(docRef, { profile: profileData, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error("Erro ao salvar perfil no Firestore:", err);
  }
}

export async function getUserFoodLog(uid, dateKey) {
  try {
    const docRef = doc(db, "users", uid, "foodlogs", dateKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().entries || [];
    }
    return [];
  } catch (err) {
    console.error("Erro ao buscar refeições no Firestore:", err);
    return [];
  }
}

export async function saveUserFoodLog(uid, dateKey, entries) {
  try {
    const docRef = doc(db, "users", uid, "foodlogs", dateKey);
    await setDoc(docRef, { entries, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error("Erro ao salvar refeições no Firestore:", err);
  }
}

export async function getUserWorkouts(uid, dateKey) {
  try {
    const docRef = doc(db, "users", uid, "workouts", dateKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().items || [];
    }
    return [];
  } catch (err) {
    console.error("Erro ao buscar treinos no Firestore:", err);
    return [];
  }
}

export async function saveUserWorkouts(uid, dateKey, items) {
  try {
    const docRef = doc(db, "users", uid, "workouts", dateKey);
    await setDoc(docRef, { items, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error("Erro ao salvar treinos no Firestore:", err);
  }
}

export async function getUserWeighIn(uid, dateKey) {
  try {
    const docRef = doc(db, "users", uid, "weighins", dateKey);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().weight ?? null;
    }
    return null;
  } catch (err) {
    console.error("Erro ao buscar peso no Firestore:", err);
    return null;
  }
}

export async function saveUserWeighIn(uid, dateKey, weight) {
  try {
    const docRef = doc(db, "users", uid, "weighins", dateKey);
    await setDoc(docRef, { weight, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error("Erro ao salvar peso no Firestore:", err);
  }
}
