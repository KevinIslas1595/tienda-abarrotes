// Conexión con Firebase: Authentication (cuentas) y Firestore (base de datos).
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { firebaseConfig } from './config.js';

// Con "npm run dev:emulador" todo se guarda en el emulador local (para pruebas).
export const usandoEmulador = import.meta.env.MODE === 'emulador';

const config = usandoEmulador
  ? { apiKey: 'demo-key', authDomain: 'demo-tienda.firebaseapp.com', projectId: 'demo-tienda', appId: 'demo-app' }
  : firebaseConfig;

// Mientras no se peguen los datos del proyecto en config.js, la app avisa.
export const firebaseListo = Boolean(config.apiKey && config.projectId);

export let auth = null;
export let db = null;

if (firebaseListo) {
  const app = initializeApp(config);
  // Sin ventanas emergentes: solo correo y contraseña (funciona igual en la app de Android).
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  // Copia local de los datos: la app sigue funcionando sin internet y
  // sube los cambios cuando vuelve la conexión.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (usandoEmulador) {
    connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true });
    // 8085 y no 8080: en esta PC el 8080 lo usa Docker (Airflow).
    connectFirestoreEmulator(db, location.hostname, 8085);
  }
}
