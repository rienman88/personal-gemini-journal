/**
 * LOCAL — ships in the frontend bundle. Only the Firebase *web* config
 * goes here — public-safe, unlike the Gemini key, which never appears
 * anywhere in this directory and lives only in Secret Manager.
 */

import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";
const appCheckEnabled = import.meta.env.VITE_ENABLE_APP_CHECK === "true";
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;

// App Check must initialize before Firebase services make their first request.
// It is deliberately disabled for emulator development, where no reCAPTCHA
// Enterprise token can be issued.
export const appCheck: AppCheck | null =
  appCheckEnabled && !useEmulators && recaptchaSiteKey
    ? initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      })
    : null;

if (appCheckEnabled && !recaptchaSiteKey) {
  console.error("App Check is enabled but VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is missing.");
}

export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulators) {
  connectAuthEmulator(auth, "http://localhost:9099");
  connectFirestoreEmulator(db, "localhost", 8080);
}

// Keep the same trusted-device behavior as major consumer web applications:
// Firebase persists the browser session locally until explicit sign-out or
// Firebase invalidates the session. This is not an application cookie.
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence);
