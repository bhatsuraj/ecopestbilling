// Firebase initialization — single instance, lazy modular SDK.
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Guard Firebase init — the app's primary login path uses simple email/password
// auth, so Firebase env vars may be absent in dev/preview. We swallow init
// errors here so the bundle can still load; pages that actually use Firebase
// will surface their own errors when invoked.
let _app = null;
let _auth = null;
try {
  if (firebaseConfig.apiKey) {
    _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    _auth = getAuth(_app);
    setPersistence(_auth, browserLocalPersistence).catch(() => {});
  }
} catch (err) {
  console.warn('Firebase init skipped:', err?.message || err);
}

export const firebaseApp = _app;
export const firebaseAuth = _auth;

// Used by sendSignInLinkToEmail / signInWithEmailLink for the magic-link callback
export const EMAIL_LINK_SETTINGS = {
  url: `${window.location.origin}/login?mode=emailLink`,
  handleCodeInApp: true,
};
