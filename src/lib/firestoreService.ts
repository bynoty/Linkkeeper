import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { LinkItem, VaultItem, AppSettings } from '../types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

/**
 * Real-time listener for user's links collection in Firestore
 */
export const subscribeUserLinks = (
  userId: string,
  onUpdate: (links: LinkItem[]) => void,
  onError?: (err: Error) => void
) => {
  const linksCol = collection(db, 'users', userId, 'links');
  return onSnapshot(
    linksCol,
    (snapshot) => {
      const items: LinkItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          ID: docSnap.id,
          Title: data.Title || '',
          Content: data.Content || '',
          Category: data.Category || 'General',
          Tags: typeof data.Tags === 'string' ? data.Tags : (Array.isArray(data.Tags) ? data.Tags.join(', ') : ''),
          Note: data.Note || '',
          Favorite: Boolean(data.Favorite),
          Pinned: Boolean(data.Pinned),
          CreatedAt: data.CreatedAt || new Date().toISOString(),
          UpdatedAt: data.UpdatedAt || new Date().toISOString(),
          ExpiresAt: data.ExpiresAt || undefined,
          HealthStatus: data.HealthStatus || 'unknown',
          StatusCode: data.StatusCode || undefined,
          LastCheckedAt: data.LastCheckedAt || undefined,
          AiSummary: data.AiSummary || undefined,
        });
      });
      // Sort newest first
      items.sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime());
      onUpdate(items);
    },
    (error) => {
      console.error('Firestore links subscription error:', error);
      if (onError) onError(error);
    }
  );
};

/**
 * Real-time listener for user's vault items collection in Firestore
 */
export const subscribeUserVault = (
  userId: string,
  onUpdate: (vault: VaultItem[]) => void,
  onError?: (err: Error) => void
) => {
  const vaultCol = collection(db, 'users', userId, 'vault');
  return onSnapshot(
    vaultCol,
    (snapshot) => {
      const items: VaultItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          ID: docSnap.id,
          Service: data.Service || '',
          Username: data.Username || '',
          Password: data.Password || '',
          Note: data.Note || '',
          Favorite: Boolean(data.Favorite),
          CreatedAt: data.CreatedAt || new Date().toISOString(),
          UpdatedAt: data.UpdatedAt || new Date().toISOString(),
        });
      });
      items.sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime());
      onUpdate(items);
    },
    (error) => {
      console.error('Firestore vault subscription error:', error);
      if (onError) onError(error);
    }
  );
};

/**
 * Save single Link to Firestore
 */
export const saveLinkToFirestore = async (userId: string, link: LinkItem) => {
  const linkDocRef = doc(db, 'users', userId, 'links', link.ID);
  await setDoc(linkDocRef, {
    ...link,
    UpdatedAt: new Date().toISOString()
  }, { merge: true });
};

/**
 * Delete single Link from Firestore
 */
export const deleteLinkFromFirestore = async (userId: string, linkId: string) => {
  const linkDocRef = doc(db, 'users', userId, 'links', linkId);
  await deleteDoc(linkDocRef);
};

/**
 * Batch save links to Firestore (for bulk import/sync)
 */
export const batchSaveLinksToFirestore = async (userId: string, links: LinkItem[]) => {
  if (!links.length) return;
  const batch = writeBatch(db);
  links.forEach((link) => {
    const linkDocRef = doc(db, 'users', userId, 'links', link.ID);
    batch.set(linkDocRef, {
      ...link,
      UpdatedAt: link.UpdatedAt || new Date().toISOString()
    }, { merge: true });
  });
  await batch.commit();
};

/**
 * Save single Vault item to Firestore
 */
export const saveVaultToFirestore = async (userId: string, vault: VaultItem) => {
  const vaultDocRef = doc(db, 'users', userId, 'vault', vault.ID);
  await setDoc(vaultDocRef, {
    ...vault,
    UpdatedAt: new Date().toISOString()
  }, { merge: true });
};

/**
 * Delete single Vault item from Firestore
 */
export const deleteVaultFromFirestore = async (userId: string, vaultId: string) => {
  const vaultDocRef = doc(db, 'users', userId, 'vault', vaultId);
  await deleteDoc(vaultDocRef);
};

/**
 * Batch save vault items to Firestore
 */
export const batchSaveVaultToFirestore = async (userId: string, items: VaultItem[]) => {
  if (!items.length) return;
  const batch = writeBatch(db);
  items.forEach((item) => {
    const vaultDocRef = doc(db, 'users', userId, 'vault', item.ID);
    batch.set(vaultDocRef, {
      ...item,
      UpdatedAt: item.UpdatedAt || new Date().toISOString()
    }, { merge: true });
  });
  await batch.commit();
};

/**
 * Save App Settings to Firestore
 */
export const saveSettingsToFirestore = async (userId: string, settings: AppSettings) => {
  const settingsDocRef = doc(db, 'users', userId, 'settings', 'user_settings');
  await setDoc(settingsDocRef, settings, { merge: true });
};

/**
 * Fetch App Settings from Firestore
 */
export const getSettingsFromFirestore = async (userId: string): Promise<AppSettings | null> => {
  const settingsDocRef = doc(db, 'users', userId, 'settings', 'user_settings');
  const snap = await getDoc(settingsDocRef);
  if (snap.exists()) {
    return snap.data() as AppSettings;
  }
  return null;
};
