import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const env = import.meta.env
// `npm run dev:emuladores` corre todo local (con `npm run emuladores`), sin proyecto real ni cuenta de Google.
const emuladores = env.MODE === 'emuladores'

export const configurado = emuladores || Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID)

const app = initializeApp(emuladores
  ? { apiKey: 'demo', projectId: 'demo-entretanto', authDomain: 'localhost' }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      // Publicada, el login por redirección corre en el mismo dominio que la app (Firebase Hosting sirve /__/auth):
      // con otro dominio el navegador separa el almacenamiento y la sesión se pierde al volver de Google.
      // En desarrollo no se puede (Firebase exige https), así que se entra con la ventana emergente.
      authDomain: env.DEV ? env.VITE_FIREBASE_AUTH_DOMAIN : location.host,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    })

export const auth = getAuth(app)
auth.languageCode = 'es'
// Caché local: abre y anota sin señal; Firestore sube los cambios al volver la conexión.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true, // los campos opcionales vacíos no se guardan
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (emuladores) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, 'localhost', 8080)
}

export async function entrarConGoogle() {
  const proveedor = new GoogleAuthProvider()
  try {
    await signInWithPopup(auth, proveedor)
  } catch (e) {
    // Algunos celulares bloquean la ventana emergente; entonces se va a Google y regresa.
    if ((e as { code?: string }).code === 'auth/popup-blocked') await signInWithRedirect(auth, proveedor)
    else throw e
  }
}

export const salir = () => signOut(auth)
