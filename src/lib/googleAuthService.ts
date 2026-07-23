import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Sheets and Google Drive (file-level) scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;
const GOOGLE_TOKEN_KEY = 'link_keeper_google_token';
const GOOGLE_TOKEN_TIME_KEY = 'link_keeper_google_token_time';
const TOKEN_MAX_AGE_MS = 50 * 60 * 1000; // 50 minutes token freshness window

// Try to recover token from localStorage if not expired
try {
  const storedToken = localStorage.getItem(GOOGLE_TOKEN_KEY);
  const storedTime = localStorage.getItem(GOOGLE_TOKEN_TIME_KEY);
  if (storedToken && storedTime) {
    const age = Date.now() - parseInt(storedTime, 10);
    if (age < TOKEN_MAX_AGE_MS) {
      cachedAccessToken = storedToken;
    } else {
      console.warn('Stored Google OAuth access token is expired (>50m). Resetting cached token.');
      localStorage.removeItem(GOOGLE_TOKEN_KEY);
      localStorage.removeItem(GOOGLE_TOKEN_TIME_KEY);
      cachedAccessToken = null;
    }
  } else if (storedToken) {
    cachedAccessToken = storedToken;
  }
} catch (e) {
  console.error('Failed to read Google token from localStorage:', e);
}

/**
 * Initialize auth state listener.
 * Keeps user logged in if Firebase Auth session is active, even if OAuth token expires.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Sign in with Google using Popup.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Sign-In');
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem(GOOGLE_TOKEN_KEY, cachedAccessToken);
      localStorage.setItem(GOOGLE_TOKEN_TIME_KEY, Date.now().toString());
    } catch (e) {
      console.error('Failed to save Google token to localStorage:', e);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieve cached access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Clear the Google token cache in memory and storage.
 */
export const clearTokenCache = () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
    localStorage.removeItem(GOOGLE_TOKEN_TIME_KEY);
  } catch (e) {
    console.error('Failed to remove Google token from localStorage:', e);
  }
};

/**
 * Log out of the Google session.
 */
export const logout = async () => {
  await auth.signOut();
  clearTokenCache();
};
