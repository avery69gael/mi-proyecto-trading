"use client";

import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc
} from "firebase/firestore";

// 🔹 Variables de entorno
const appId = process.env.NEXT_PUBLIC_APP_ID || "default-app-id";

let firebaseConfig = null;
try {
  firebaseConfig = process.env.NEXT_PUBLIC_FIREBASE_CONFIG
    ? JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG)
    : null;
} catch (err) {
  console.error("Error al parsear Firebase config:", err);
}

const initialAuthToken = process.env.NEXT_PUBLIC_INITIAL_AUTH_TOKEN || null;

// 🔹 Inicializa Firebase
let firebaseServices = {};
if (firebaseConfig) {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  firebaseServices = { app, db, auth };
}

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [alerts, setAlerts] = useState([]);

  // 🔹 Detectar cambios de usuario
  useEffect(() => {
    if (!firebaseServices.auth) return;
    const unsubscribe = onAuthStateChanged(firebaseServices.auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 🔹 Funciones de registro/inicio/cierre
  const handleSignUp = async (email, password) => {
    if (!firebaseServices.auth) return;
    try {
      await createUserWithEmailAndPassword(firebaseServices.auth, email, password);
      alert("Registro exitoso, inicia sesión.");
    } catch (error) {
      console.error(error);
      alert("Error en registro: " + error.message);
    }
  };

  const handleSignIn = async (email, password) => {
    if (!firebaseServices.auth) return;
    try {
      await signInWithEmailAndPassword(firebaseServices.auth, email, password);
      alert("Inicio de sesión exitoso!");
    } catch (error) {
      console.error(error);
      alert("Error al iniciar sesión: " + error.message);
    }
  };

  const handleSignOut = async () => {
    if (!firebaseServices.auth) return;
    try {
      await signOut(firebaseServices.auth);
      setAlerts([]);
      alert("Sesión cerrada.");
    } catch (error) {
      console.error(error);
      alert("Error al cerrar sesión: " + error.message);
    }
  };

  // 🔹 Firestore: colección de alertas
  const getAlertsCollection = useCallback(() => {
    if (!user || !firebaseServices.db) return null;
    return collection(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/alerts`);
  }, [user]);

  const handleAddAlert = async (coin, type, value) => {
    if (!getAlertsCollection()) return;
    try {
      await addDoc(getAlertsCollection(), { coin, type, value, createdAt: Date.now() });
      alert("Alerta guardada!");
    } catch (err) {
      console.error(err);
      alert("Error al guardar alerta");
    }
  };

  const handleRemoveAlert = async (alertId) => {
    if (!getAlertsCollection() || !alertId) return;
    try {
      const docRef = collection(firebaseServices.db, `artifacts/${appId}/users/${user.uid}/alerts`);
      await deleteDoc(docRef, alertId);
      alert("Alerta eliminada!");
    } catch (err) {
      console.error(err);
      alert("Error al eliminar alerta");
    }
  };

  // 🔹 Render
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Mi Web de Trading 🚀</h1>

      {user ? (
        <>
          <p>Usuario: {user.email || user.uid}</p>
          <button onClick={handleSignOut}>Cerrar sesión</button>
        </>
      ) : (
        <>
          <p>No has iniciado sesión</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSignIn(e.target.email.value, e.target.password.value);
            }}
          >
            <input name="email" placeholder="Email" required />
            <input name="password" placeholder="Password" type="password" required />
            <button type="submit">Iniciar sesión</button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSignUp(e.target.email.value, e.target.password.value);
            }}
          >
            <input name="email" placeholder="Email" required />
            <input name="password" placeholder="Password" type="password" required />
            <button type="submit">Registrarse</button>
          </form>
        </>
      )}
    </div>
  );
}
