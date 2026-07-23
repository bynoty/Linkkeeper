/**
 * App.tsx - Root Application Orchestrator
 */

import React, { useState, useEffect, useTransition, useRef } from 'react';
import { User } from 'firebase/auth';
import { 
  initAuth, 
  googleSignIn, 
  logout as googleLogout,
  clearTokenCache
} from './lib/googleAuthService';
import { 
  findSpreadsheet, 
  createSpreadsheet, 
  initializeSpreadsheetStructure, 
  fetchLinksFromSheet, 
  fetchVaultFromSheet, 
  saveLinksToSheet, 
  saveVaultToSheet,
  mergeArrays
} from './lib/googleSheetsService';
import { 
  getLinks, 
  saveLink, 
  deleteLink, 
  getVault, 
  saveVault, 
  deleteVault, 
  loadSettings, 
  saveSettings, 
  exportBackup, 
  importBackup, 
  clearLocalCache,
  addVaultToSheets,
  parseNetscapeBookmarks,
  DEFAULT_SETTINGS
} from './lib/api';
import { LinkItem, VaultItem, AppSettings, ActiveTab, ToastMessage } from './types';
import Dashboard from './components/Dashboard';
import Vault from './components/Vault';
import QuickAdd from './components/QuickAdd';
import SettingsPanel from './components/SettingsPanel';
import { 
  Database, 
  Search, 
  Moon, 
  Sun, 
  Settings, 
  Bookmark, 
  Key, 
  PlusCircle, 
  RefreshCw, 
  X, 
  ShieldCheck, 
  CloudOff, 
  CloudLightning,
  LogOut,
  Sparkles,
  User as UserIcon,
  Wifi,
  WifiOff,
  HelpCircle
} from 'lucide-react';

export default function App() {
  const [, startTransition] = useTransition();

  // Search input ref for keyboard shortcut focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  // App State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Google Auth states
  const [user, setUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  // Google Sheets Direct Sync Diagnostics & Logging
  const [googleSyncLogs, setGoogleSyncLogs] = useState<string[]>([]);
  const [lastGoogleSyncTime, setLastGoogleSyncTime] = useState<string | null>(() => {
    try {
      return localStorage.getItem('link_keeper_last_google_sync_time');
    } catch {
      return null;
    }
  });
  const [googleSyncError, setGoogleSyncError] = useState<string | null>(() => {
    try {
      return localStorage.getItem('link_keeper_google_sync_error');
    } catch {
      return null;
    }
  });

  // Online/Offline Network & Sync Queue state
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncPending, setSyncPending] = useState<boolean>(() => {
    try {
      return localStorage.getItem('link_keeper_sync_pending') === 'true';
    } catch {
      return false;
    }
  });

  // Persist syncPending state
  useEffect(() => {
    try {
      localStorage.setItem('link_keeper_sync_pending', String(syncPending));
    } catch (err) {
      console.error('Failed to save sync pending state to localStorage:', err);
    }
  }, [syncPending]);

  // Monitor network online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('You are back online!', 'success');
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('You are offline. Changes will be saved locally and queued for synchronization.', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Automatically trigger sync when coming online if sync is pending
  useEffect(() => {
    if (isOnline && syncPending) {
      const runQueuedSync = async () => {
        if (settings.googleSyncEnabled && googleToken && settings.googleSpreadsheetId) {
          showToast('Connection restored! Synchronizing queued changes with Google Sheets...', 'info');
          try {
            await handleGoogleSheetsSync(googleToken, settings.googleSpreadsheetId, settings);
            setSyncPending(false);
          } catch (err) {
            console.error('Auto-sync on reconnect failed:', err);
          }
        } else if (settings.webAppUrl) {
          showToast('Connection restored! Synchronizing queued changes with Google Sheets...', 'info');
          try {
            await handleSync();
            setSyncPending(false);
          } catch (err) {
            console.error('Auto-sync on reconnect failed:', err);
          }
        } else {
          // No sync configured but state was set, clear it
          setSyncPending(false);
        }
      };

      runQueuedSync();
    }
  }, [isOnline, syncPending, googleToken, settings]);

  const addSyncLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}] ${msg}`;
    console.log(logLine);
    setGoogleSyncLogs(prev => [...prev, logLine]);
  };

  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      async (firebaseUser, token) => {
        setUser(firebaseUser);
        setGoogleToken(token);
        
        // If Google Sheets Sync is enabled and we have a spreadsheet ID, trigger an automatic sync
        const currentSettings = loadSettings();
        if (currentSettings.googleSyncEnabled && currentSettings.googleSpreadsheetId) {
          setTimeout(async () => {
            try {
              await handleGoogleSheetsSync(token, currentSettings.googleSpreadsheetId!, currentSettings);
            } catch (e) {
              console.error('Auto-sync on load failed:', e);
            }
          }, 200);
        }
      },
      () => {
        setUser(null);
        setGoogleToken(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Load Settings and Local/Sheets data on start
  useEffect(() => {
    const loadedSettings = loadSettings();
    setSettings(loadedSettings);

    // Apply theme
    applyTheme(loadedSettings.theme);

    // Initial load of links and vault
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        // Load whatever exists in local cache first so user gets instant screen paint
        const localLinks = await getLinks(loadedSettings);
        const localVault = await getVault(loadedSettings);
        setLinks(localLinks);
        setVaultItems(localVault);

        // If configured to sync on load, execute Sheets fetch
        if (loadedSettings.webAppUrl && loadedSettings.syncOnLoad) {
          showToast('Syncing with Google Sheets on load...', 'info');
          const syncedLinks = await getLinks(loadedSettings);
          const syncedVault = await getVault(loadedSettings);
          setLinks(syncedLinks);
          setVaultItems(syncedVault);
          showToast('Sync completed!', 'success');
        }
      } catch (err) {
        showToast(`Initial sync failed: ${(err as Error).message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Global Keyboard Shortcuts Effect
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Check if user is typing in a form input or textarea (unless they are pressing Esc or using Ctrl/Cmd shortcuts)
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // 1. Ctrl+K or Cmd+K: Focus Search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        showToast('Search focused (Ctrl+K)', 'info');
      }

      // 2. Ctrl+N or Cmd+N: Navigate to Quick Add
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        startTransition(() => {
          setActiveTab('quick-add');
        });
        showToast('Quick Add page opened (Ctrl+N)', 'success');
      }

      // 3. Escape: Clear search or general actions
      if (e.key === 'Escape') {
        // If search is focused or contains text, clear it and blur input
        if (searchTerm || document.activeElement === searchInputRef.current) {
          setSearchTerm('');
          searchInputRef.current?.blur();
          showToast('Search cleared (Esc)', 'info');
        }
      }

      // 4. '?': Toggle help modal (when not typing in an input)
      if (!isInputFocused && e.key === '?') {
        e.preventDefault();
        setShowHelpModal(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => {
      window.removeEventListener('keydown', handleGlobalShortcuts);
    };
  }, [searchTerm, settings]);

  // Theme Applier Helper
  const applyTheme = (theme: 'light' | 'dark') => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Toggle Theme
  const handleToggleTheme = () => {
    const nextTheme = settings.theme === 'light' ? 'dark' : 'light';
    const updated = { ...settings, theme: nextTheme };
    setSettings(updated);
    saveSettings(updated);
    applyTheme(nextTheme);
    showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'success');
  };

  // Toast Trigger Helper
  const showToast = (message: string, type: 'success' | 'info' | 'warning' | 'error') => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, message, type };
    setToasts(prev => [...prev, newToast]);

    // Auto-remove after 3.5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  // Update Settings from Child Components
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    // Apply theme immediately if modified
    applyTheme(newSettings.theme);
  };

  // Set Master Password Hash (ZKP token)
  const handleSetMasterPasswordHash = (hash: string) => {
    const updated = { ...settings, masterPasswordHash: hash };
    setSettings(updated);
    saveSettings(updated);
  };

  // Global Sync (manual trigger)
  const handleSync = async () => {
    setIsLoading(true);
    try {
      showToast('Fetching latest records from Google Sheets...', 'info');
      const syncedLinks = await getLinks(settings);
      const syncedVault = await getVault(settings);
      setLinks(syncedLinks);
      setVaultItems(syncedVault);
      showToast('Sync successful! Records refreshed.', 'success');
    } catch (err) {
      showToast(`Sheets Sync Failed: ${(err as Error).message}`, 'error');
      throw err; // throw back to child components if they require test failure tracking
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google API Errors (including token expiry)
  const handleGoogleError = (err: unknown, contextAction: string) => {
    console.error(`Google API error during ${contextAction}:`, err);
    const errMsg = err instanceof Error ? err.message : String(err);
    
    setGoogleSyncError(errMsg);
    try {
      localStorage.setItem('link_keeper_google_sync_error', errMsg);
    } catch (e) {
      console.error('Failed to save google sync error to localStorage:', e);
    }

    if (
      errMsg.includes('Unauthorized') || 
      errMsg.includes('unauthorized') || 
      errMsg.includes('401') || 
      errMsg.includes('invalid_grant') || 
      errMsg.includes('auth') || 
      errMsg.includes('token')
    ) {
      setGoogleToken(null);
      clearTokenCache();
      showToast('Google session expired. Please sign in again to refresh sync connection.', 'warning');
    } else {
      showToast(`Drive Sync Failed: ${errMsg}`, 'error');
    }
  };

  // Trigger a full direct Google Sheet synchronization
  const handleGoogleSheetsSync = async (token: string | null, spreadsheetId: string, currentSettings: AppSettings) => {
    if (!token) {
      console.warn('Google Sheets sync skipped: token is missing or expired.');
      setGoogleSyncError('Google OAuth session token missing or expired. Please click "Reconnect Google" to re-authorize.');
      showToast('Google token expired. Please click Reconnect Google to restore sync.', 'warning');
      return;
    }
    setIsLoading(true);
    setGoogleSyncLogs([]);
    addSyncLog('Initializing Google Sheets synchronization process...');
    try {
      showToast('Syncing with Google Drive...', 'info');

      // 1. Fetch remote data
      addSyncLog(`Step 1: Requesting remote records from spreadsheet ID: "${spreadsheetId}"...`);
      addSyncLog('Fetching remote links...');
      const remoteLinks = await fetchLinksFromSheet(token, spreadsheetId);
      addSyncLog(`Fetched ${remoteLinks.length} links from Google Sheet successfully.`);

      addSyncLog('Fetching remote vault credentials...');
      const remoteVault = await fetchVaultFromSheet(token, spreadsheetId);
      addSyncLog(`Fetched ${remoteVault.length} vault credentials from Google Sheet successfully.`);

      // 2. Load current local cache
      addSyncLog('Step 2: Retrieving local storage cache from your browser...');
      const localDataLinks = localStorage.getItem('link_keeper_links');
      const localLinks: LinkItem[] = localDataLinks ? JSON.parse(localDataLinks) : [];
      addSyncLog(`Found ${localLinks.length} local links in local cache.`);

      const localDataVault = localStorage.getItem('link_keeper_vault');
      const localVault: VaultItem[] = localDataVault ? JSON.parse(localDataVault) : [];
      addSyncLog(`Found ${localVault.length} local credentials in local cache.`);

      // 3. Merge
      addSyncLog('Step 3: Merging datasets (resolving conflicts by choosing the latest update time)...');
      const mergedLinks = mergeArrays(localLinks, remoteLinks);
      addSyncLog(`Merged links: total ${mergedLinks.length} items.`);
      
      const mergedVault = mergeArrays(localVault, remoteVault);
      addSyncLog(`Merged vault items: total ${mergedVault.length} items.`);

      // 4. Update state & local storage cache
      addSyncLog('Step 4: Writing merged records to in-app memory and local browser storage...');
      setLinks(mergedLinks);
      setVaultItems(mergedVault);
      localStorage.setItem('link_keeper_links', JSON.stringify(mergedLinks));
      localStorage.setItem('link_keeper_vault', JSON.stringify(mergedVault));

      // 5. Write merged data back to Google Sheet
      addSyncLog('Step 5: Overwriting Google Sheets with unified dataset back-ups...');
      addSyncLog(`Uploading ${mergedLinks.length} links to 'Links' tab...`);
      await saveLinksToSheet(token, spreadsheetId, mergedLinks);
      addSyncLog("Links backup completed successfully.");

      addSyncLog(`Uploading ${mergedVault.length} credentials to 'Vault' tab...`);
      await saveVaultToSheet(token, spreadsheetId, mergedVault);
      addSyncLog("Vault backup completed successfully.");

      addSyncLog('Step 6: Sync complete. All records synchronized!');
      
      const syncTime = new Date().toLocaleString();
      setLastGoogleSyncTime(syncTime);
      localStorage.setItem('link_keeper_last_google_sync_time', syncTime);
      
      setGoogleSyncError(null);
      localStorage.removeItem('link_keeper_google_sync_error');

      showToast('Google Drive sync successful!', 'success');
    } catch (err) {
      console.error('Google Sheets direct sync failed:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      addSyncLog(`CRITICAL SYNC ERROR DETECTED: ${errMsg}`);
      handleGoogleError(err, 'direct sync');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupGoogleSheet = async (token?: string) => {
    const activeToken = token || googleToken;
    if (!activeToken) {
      showToast('Please sign in with Google first', 'error');
      return;
    }

    setIsLoading(true);
    try {
      showToast('Connecting to Google Drive...', 'info');
      let spreadsheetId = await findSpreadsheet(activeToken);

      if (!spreadsheetId) {
        showToast('Creating new Google Sheet for LinkKeeper...', 'info');
        spreadsheetId = await createSpreadsheet(activeToken);
        showToast('Google Sheet created successfully!', 'success');
      } else {
        showToast('Found existing LinkKeeper spreadsheet. Initializing structures...', 'info');
        await initializeSpreadsheetStructure(activeToken, spreadsheetId);
        showToast('Google Sheet loaded successfully!', 'success');
      }

      const updatedSettings = {
        ...settings,
        googleSyncEnabled: true,
        googleSpreadsheetId: spreadsheetId,
      };
      setSettings(updatedSettings);
      saveSettings(updatedSettings);

      // Trigger sync
      await handleGoogleSheetsSync(activeToken, spreadsheetId, updatedSettings);

    } catch (err) {
      console.error('Setup Google Sheet failed:', err);
      handleGoogleError(err, 'setup sheet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setGoogleToken(res.accessToken);
        showToast(`Successfully logged in as ${res.user.email}!`, 'success');

        // Automate spreadsheet connection if sync is already requested or enabled
        await handleSetupGoogleSheet(res.accessToken);
      }
    } catch (err) {
      showToast(`Sign-in failed: ${(err as Error).message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    setIsLoading(true);
    try {
      await googleLogout();
      setUser(null);
      setGoogleToken(null);
      
      const updatedSettings = {
        ...settings,
        googleSyncEnabled: false,
      };
      setSettings(updatedSettings);
      saveSettings(updatedSettings);
      
      showToast('Logged out of Google account and disabled Google Sheets Sync', 'info');
    } catch (err) {
      showToast(`Logout failed: ${(err as Error).message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Link Crud Ops
  const handleSaveLink = async (item: Partial<LinkItem>, isNew: boolean) => {
    setIsLoading(true);
    try {
      const saved = await saveLink(settings, item, isNew);
      let nextLinks: LinkItem[] = [];
      setLinks(prev => {
        const list = isNew ? [saved, ...prev] : prev.map(l => (l.ID === saved.ID ? saved : l));
        nextLinks = list;
        return list;
      });

      if (settings.googleSyncEnabled && settings.googleSpreadsheetId && googleToken) {
        if (!isOnline) {
          setSyncPending(true);
          showToast('Offline: Changes saved locally. Synchronization queued.', 'info');
        } else {
          try {
            await saveLinksToSheet(googleToken, settings.googleSpreadsheetId, nextLinks);
          } catch (syncErr) {
            handleGoogleError(syncErr, 'save link');
            setSyncPending(true);
          }
        }
      }
    } catch (err) {
      showToast(`Save failed: ${(err as Error).message}`, 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    setIsLoading(true);
    try {
      await deleteLink(settings, id);
      let nextLinks: LinkItem[] = [];
      setLinks(prev => {
        const list = prev.filter(l => l.ID !== id);
        nextLinks = list;
        return list;
      });

      if (settings.googleSyncEnabled && settings.googleSpreadsheetId && googleToken) {
        if (!isOnline) {
          setSyncPending(true);
          showToast('Offline: Link deleted locally. Synchronization queued.', 'info');
        } else {
          try {
            await saveLinksToSheet(googleToken, settings.googleSpreadsheetId, nextLinks);
          } catch (syncErr) {
            handleGoogleError(syncErr, 'delete link');
            setSyncPending(true);
          }
        }
      }
    } catch (err) {
      showToast(`Delete failed: ${(err as Error).message}`, 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDeleteLinks = async (ids: string[]) => {
    setIsLoading(true);
    try {
      showToast(`Deleting ${ids.length} links...`, 'info');
      for (const id of ids) {
        await deleteLink(settings, id);
      }
      
      let nextLinks: LinkItem[] = [];
      setLinks(prev => {
        const list = prev.filter(l => !ids.includes(l.ID));
        nextLinks = list;
        return list;
      });

      if (settings.googleSyncEnabled && settings.googleSpreadsheetId && googleToken) {
        if (!isOnline) {
          setSyncPending(true);
          showToast('Offline: Links deleted locally. Synchronization queued.', 'info');
        } else {
          try {
            await saveLinksToSheet(googleToken, settings.googleSpreadsheetId, nextLinks);
          } catch (syncErr) {
            handleGoogleError(syncErr, 'bulk delete links');
            setSyncPending(true);
          }
        }
      }
      showToast(`Successfully deleted ${ids.length} links`, 'success');
    } catch (err) {
      showToast(`Bulk delete failed: ${(err as Error).message}`, 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkMoveLinks = async (ids: string[], newCategory: string) => {
    setIsLoading(true);
    try {
      showToast(`Moving ${ids.length} links to ${newCategory}...`, 'info');
      const itemsToUpdate = links.filter(l => ids.includes(l.ID));
      
      for (const item of itemsToUpdate) {
        await saveLink(settings, { ...item, Category: newCategory }, false);
      }
      
      let nextLinks: LinkItem[] = [];
      setLinks(prev => {
        const list = prev.map(l => ids.includes(l.ID) ? { ...l, Category: newCategory, UpdatedAt: new Date().toISOString() } : l);
        nextLinks = list;
        return list;
      });

      if (settings.googleSyncEnabled && settings.googleSpreadsheetId && googleToken) {
        if (!isOnline) {
          setSyncPending(true);
          showToast('Offline: Links moved locally. Synchronization queued.', 'info');
        } else {
          try {
            await saveLinksToSheet(googleToken, settings.googleSpreadsheetId, nextLinks);
          } catch (syncErr) {
            handleGoogleError(syncErr, 'bulk move links');
            setSyncPending(true);
          }
        }
      }
      showToast(`Successfully moved ${ids.length} links to ${newCategory}`, 'success');
    } catch (err) {
      showToast(`Bulk move failed: ${(err as Error).message}`, 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Vault Crud Ops
  const handleSaveVault = async (item: Partial<VaultItem>, isNew: boolean) => {
    setIsLoading(true);
    try {
      const saved = await saveVault(settings, item, isNew);
      let nextVault: VaultItem[] = [];
      setVaultItems(prev => {
        const list = isNew ? [saved, ...prev] : prev.map(c => (c.ID === saved.ID ? saved : c));
        nextVault = list;
        return list;
      });

      if (settings.googleSyncEnabled && settings.googleSpreadsheetId && googleToken) {
        if (!isOnline) {
          setSyncPending(true);
          showToast('Offline: Vault changes saved locally. Synchronization queued.', 'info');
        } else {
          try {
            await saveVaultToSheet(googleToken, settings.googleSpreadsheetId, nextVault);
          } catch (syncErr) {
            handleGoogleError(syncErr, 'save credential');
            setSyncPending(true);
          }
        }
      }
    } catch (err) {
      showToast(`Credential save failed: ${(err as Error).message}`, 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteVault = async (id: string) => {
    setIsLoading(true);
    try {
      await deleteVault(settings, id);
      let nextVault: VaultItem[] = [];
      setVaultItems(prev => {
        const list = prev.filter(c => c.ID !== id);
        nextVault = list;
        return list;
      });

      if (settings.googleSyncEnabled && settings.googleSpreadsheetId && googleToken) {
        if (!isOnline) {
          setSyncPending(true);
          showToast('Offline: Credential deleted locally. Synchronization queued.', 'info');
        } else {
          try {
            await saveVaultToSheet(googleToken, settings.googleSpreadsheetId, nextVault);
          } catch (syncErr) {
            handleGoogleError(syncErr, 'delete credential');
            setSyncPending(true);
          }
        }
      }
    } catch (err) {
      showToast(`Credential deletion failed: ${(err as Error).message}`, 'error');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Export Data Backup to File Download
  const handleExportBackup = () => {
    try {
      const backupJsonStr = exportBackup(settings);
      
      const blob = new Blob([backupJsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `link_keeper_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast('Backup file downloaded successfully!', 'success');
    } catch (err) {
      showToast(`Backup failed: ${(err as Error).message}`, 'error');
    }
  };

  // Import Backup String
  const handleImportBackup = (backupStr: string) => {
    try {
      const result = importBackup(backupStr);
      setSettings(result.settings);
      
      // Force reload states
      setLinks(JSON.parse(localStorage.getItem('link_keeper_links') || '[]'));
      setVaultItems(JSON.parse(localStorage.getItem('link_keeper_vault') || '[]'));
      
      showToast(`Restored backup! Imported ${result.linksCount} links and ${result.vaultCount} vault credentials.`, 'success');
    } catch (err) {
      showToast(`Restore failed: ${(err as Error).message}`, 'error');
    }
  };

  // Import Bookmarks HTML from Chrome/Edge
  const handleImportBookmarks = async (htmlText: string) => {
    setIsLoading(true);
    try {
      const parsed = parseNetscapeBookmarks(htmlText);
      if (parsed.length === 0) {
        showToast('No valid bookmarks found in the imported file.', 'warning');
        return;
      }

      showToast(`Importing ${parsed.length} bookmarks...`, 'info');

      // Check and add any new categories
      const newCategories = [...settings.categories];
      let categoriesUpdated = false;
      parsed.forEach(item => {
        if (item.Category && !newCategories.includes(item.Category)) {
          newCategories.push(item.Category);
          categoriesUpdated = true;
        }
      });

      if (categoriesUpdated) {
        const updatedSettings = { ...settings, categories: newCategories };
        setSettings(updatedSettings);
        saveSettings(updatedSettings);
      }

      // Map bookmarks to LinkItems
      const newLinkItems: LinkItem[] = parsed.map(b => ({
        ID: Math.random().toString(36).substring(2, 11),
        Title: b.Title,
        Content: b.Url,
        Category: b.Category,
        Tags: '',
        Note: 'Imported from Bookmarks',
        Favorite: false,
        Pinned: false,
        CreatedAt: b.CreatedAt,
        UpdatedAt: new Date().toISOString(),
      }));

      // Merge into existing links
      const mergedLinks = [...newLinkItems, ...links];
      setLinks(mergedLinks);
      localStorage.setItem('link_keeper_links', JSON.stringify(mergedLinks));

      // If Google sync is active, upload the bulk-merged list
      if (settings.googleSyncEnabled && settings.googleSpreadsheetId && googleToken) {
        if (!isOnline) {
          setSyncPending(true);
          showToast('Offline: Bookmarks imported locally. Synchronization queued.', 'info');
        } else {
          showToast('Uploading imported bookmarks to Google Sheets...', 'info');
          try {
            await saveLinksToSheet(googleToken, settings.googleSpreadsheetId, mergedLinks);
          } catch (syncErr) {
            handleGoogleError(syncErr, 'upload bookmarks');
            setSyncPending(true);
          }
        }
      }

      showToast(`Successfully imported ${parsed.length} bookmarks!`, 'success');
    } catch (err) {
      showToast(`Failed to import bookmarks: ${(err as Error).message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Import Vault items from external sources (e.g., Google Passwords CSV)
  const handleImportVaultItems = async (newItems: VaultItem[]) => {
    setIsLoading(true);
    try {
      // 1. Get current local vault items
      const localData = localStorage.getItem('link_keeper_vault');
      const currentItems: VaultItem[] = localData ? JSON.parse(localData) : [];
      
      // 2. Filter out duplicates (based on Service + Username)
      const filteredNewItems = newItems.filter(newItem => {
        return !currentItems.some(item => 
          item.Service.toLowerCase() === newItem.Service.toLowerCase() &&
          item.Username.toLowerCase() === newItem.Username.toLowerCase()
        );
      });

      if (filteredNewItems.length === 0) {
        showToast('All credentials in CSV already exist in your vault.', 'info');
        return;
      }

      // 3. Merge and save locally for immediate access
      const mergedItems = [...filteredNewItems, ...currentItems];
      localStorage.setItem('link_keeper_vault', JSON.stringify(mergedItems));
      setVaultItems(mergedItems);

      showToast(`Imported ${filteredNewItems.length} new credentials locally.`, 'success');

      // 4. Sync to Google Sheets if configured
      if (settings.webAppUrl) {
        showToast(`Syncing ${filteredNewItems.length} credentials to Google Sheets...`, 'info');
        
        let successfulSyncCount = 0;
        const chunkSize = 5;
        
        for (let i = 0; i < filteredNewItems.length; i += chunkSize) {
          const chunk = filteredNewItems.slice(i, i + chunkSize);
          await Promise.all(chunk.map(async (item) => {
            try {
              await addVaultToSheets(settings, item);
              successfulSyncCount++;
            } catch (err) {
              console.error(`Failed to sync credential: ${item.Service}`, err);
            }
          }));
        }
        
        showToast(`Successfully synchronized ${successfulSyncCount} of ${filteredNewItems.length} credentials to Google Sheets.`, 'success');
      }
    } catch (err) {
      showToast(`Import failed: ${(err as Error).message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear Local State Cache
  const handleClearLocalCache = () => {
    clearLocalCache();
    setLinks([]);
    setVaultItems([]);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      
      {/* Visual background accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        
        {/* Top Header Navigation */}
        <header className="bg-white/95 dark:bg-zinc-900/95 md:bg-white/70 md:dark:bg-zinc-900/60 md:backdrop-blur-md px-4 sm:px-6 py-4 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-emerald-600/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-white leading-none">
                Link Keeper
              </h1>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium tracking-wide">
                Personal Knowledge Base
              </span>
            </div>
          </div>

          {/* Centered Search Bar */}
          <div className="relative w-full md:max-w-md">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search links, notes, tags, credentials..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white transition-all"
            />
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* Sync Database Status Badge / Google Auth Widget */}
            {user ? (
              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                <button
                  onClick={() => startTransition(() => setActiveTab('settings'))}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-150 dark:hover:bg-zinc-800/60 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all cursor-pointer text-left"
                  title={`Logged in as ${user.email}. Click to view sync settings.`}
                >
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || 'Google User'} 
                      className="w-4 h-4 rounded-full shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[8px] font-bold shrink-0">
                      {user.email ? user.email[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <span className="hidden sm:inline truncate max-w-[120px]">{user.displayName || user.email}</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </button>

                {/* Google Logout Button */}
                <button
                  onClick={handleGoogleLogout}
                  disabled={isLoading}
                  className="p-2.5 bg-red-500/5 hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  title="Sign Out from Google"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 cursor-pointer transition-all shadow-xs shrink-0"
                title="Sign in with Google to enable cloud backup and sync across devices"
              >
                <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="hidden xs:inline">Sign In with Google</span>
                <span className="xs:hidden">Sign In</span>
              </button>
            )}

            {/* Manual Sync Trigger */}
            {(((settings.googleSyncEnabled && user && googleToken && settings.googleSpreadsheetId)) || settings.webAppUrl) && (
              <button
                onClick={async () => {
                  if (!isOnline) {
                    setSyncPending(true);
                    showToast('Offline: Sync queued and will run automatically when connection returns.', 'info');
                    return;
                  }
                  if (settings.googleSyncEnabled && googleToken && settings.googleSpreadsheetId) {
                    await handleGoogleSheetsSync(googleToken, settings.googleSpreadsheetId, settings);
                  } else {
                    await handleSync();
                  }
                }}
                disabled={isLoading}
                className="p-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                title="Sync Spreadsheet Database"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* Online/Offline Network Status Indicator */}
            <div 
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                isOnline 
                  ? 'bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/10' 
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse'
              }`}
              title={isOnline ? (syncPending ? 'Online. Unsynchronized changes are queued!' : 'Online') : 'Offline. Changes will be queued and synced when connection returns.'}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">Online</span>
                  {syncPending && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                  )}
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                  <span>Offline</span>
                  {syncPending && (
                    <span className="inline-flex items-center bg-amber-500/20 px-1 rounded text-[8px] ml-0.5">Queued</span>
                  )}
                </>
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={handleToggleTheme}
              className="p-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl transition-all cursor-pointer"
              title="Toggle Theme"
            >
              {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Keyboard Shortcuts & Help Button */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl transition-all cursor-pointer"
              title="Keyboard Shortcuts Help (?)"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Quick Settings Switch */}
            <button
              onClick={() => startTransition(() => setActiveTab('settings'))}
              className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
              }`}
              title="Configurations & Help"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

        </header>

        {/* Tab Navigation rails */}
        <nav className="flex justify-center">
          <div className="bg-white/95 dark:bg-zinc-900/95 md:bg-white/70 md:dark:bg-zinc-900/60 md:backdrop-blur-md p-1.5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 flex shadow-xs gap-1">
            {/* Tab: Dashboard */}
            <button
              onClick={() => startTransition(() => setActiveTab('dashboard'))}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50'
              }`}
            >
              <Bookmark className="w-4 h-4" /> Dashboard
            </button>

            {/* Tab: Secure Vault */}
            <button
              onClick={() => startTransition(() => setActiveTab('vault'))}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'vault'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50'
              }`}
            >
              <Key className="w-4 h-4" /> Vault
            </button>

            {/* Tab: Quick Add */}
            <button
              onClick={() => startTransition(() => setActiveTab('quick-add'))}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'quick-add'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50'
              }`}
            >
              <PlusCircle className="w-4 h-4" /> Quick Add
            </button>
          </div>
        </nav>

        {/* Search status banner */}
        {searchTerm && (
          <div className="text-center py-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              Filtering results by: "{searchTerm}"
              <button onClick={() => setSearchTerm('')} className="hover:text-emerald-500 transition-colors cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
        )}

        {/* View Switcher Main Panel */}
        <main className="min-h-[400px] animate-fade-in duration-200">
          {activeTab === 'dashboard' && (
            <Dashboard
              links={links}
              categories={settings.categories}
              onSaveLink={handleSaveLink}
              onDeleteLink={handleDeleteLink}
              onBulkDeleteLinks={handleBulkDeleteLinks}
              onBulkMoveLinks={handleBulkMoveLinks}
              onShowToast={showToast}
              searchTerm={searchTerm}
              isLoading={isLoading}
            />
          )}

          {activeTab === 'vault' && (
            <Vault
              vaultItems={vaultItems}
              onSaveVault={handleSaveVault}
              onDeleteVault={handleDeleteVault}
              onShowToast={showToast}
              masterPasswordHash={settings.masterPasswordHash}
              onSetMasterPasswordHash={handleSetMasterPasswordHash}
              searchTerm={searchTerm}
              autoLockEnabled={settings.autoLockEnabled}
              autoLockTimeout={settings.autoLockTimeout}
            />
          )}

          {activeTab === 'quick-add' && (
            <QuickAdd
              links={links}
              categories={settings.categories}
              onSaveLink={handleSaveLink}
              onSaveVault={handleSaveVault}
              onShowToast={showToast}
              masterPasswordHash={settings.masterPasswordHash}
              onNavigateToTab={(tab) => startTransition(() => setActiveTab(tab))}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onClearCache={handleClearLocalCache}
              onExportBackup={handleExportBackup}
              onImportBackup={handleImportBackup}
              onImportBookmarks={handleImportBookmarks}
              onImportVaultItems={handleImportVaultItems}
              onShowToast={showToast}
              onSync={handleSync}
              googleUser={user}
              googleToken={googleToken}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleLogout={handleGoogleLogout}
              onSetupGoogleSheet={handleSetupGoogleSheet}
              onGoogleSheetsSync={handleGoogleSheetsSync}
              vaultItems={vaultItems}
              lastGoogleSyncTime={lastGoogleSyncTime}
              googleSyncError={googleSyncError}
              googleSyncLogs={googleSyncLogs}
              onClearSyncLogs={() => setGoogleSyncLogs([])}
            />
          )}
        </main>

      </div>

      {/* Keyboard Shortcuts Help Modal */}
      {showHelpModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowHelpModal(false)}
        >
          <div 
            className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl relative animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-950/50 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Keyboard Shortcuts & Help</h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Boost your productivity with global hotkeys</p>
              </div>
            </div>

            {/* Shortcut List */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Global Shortcuts</h4>
                
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-zinc-600 dark:text-zinc-300 font-medium">Show / Hide Help Menu</span>
                  <kbd className="px-2 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-xs text-zinc-800 dark:text-zinc-200 font-mono">?</kbd>
                </div>

                <div className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-zinc-600 dark:text-zinc-300 font-medium">Focus Search Input</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-xs text-zinc-800 dark:text-zinc-200 font-mono">Ctrl</kbd>
                    <span className="text-zinc-400">+</span>
                    <kbd className="px-2 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-xs text-zinc-800 dark:text-zinc-200 font-mono">K</kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-zinc-600 dark:text-zinc-300 font-medium">Go to Quick Add Tab</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-xs text-zinc-800 dark:text-zinc-200 font-mono">Ctrl</kbd>
                    <span className="text-zinc-400">+</span>
                    <kbd className="px-2 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-xs text-zinc-800 dark:text-zinc-200 font-mono">N</kbd>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-100 dark:border-zinc-800/50">
                  <span className="text-zinc-600 dark:text-zinc-300 font-medium">Clear Search / Remove Focus</span>
                  <kbd className="px-2 py-1 text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-xs text-zinc-800 dark:text-zinc-200 font-mono">Esc</kbd>
                </div>
              </div>

              {/* General Tips */}
              <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/50 rounded-2xl p-3.5 space-y-1.5">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">Quick Pro-Tips</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  • <strong>Bulk Mode</strong>: In Dashboard, hold Ctrl or turn on the Multi-Select toggle to batch edit or delete bookmarks.
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  • <strong>QR Code Quick-Add</strong>: Use your mobile device camera inside the <strong className="text-emerald-600 dark:text-emerald-400">Quick Add</strong> tab to scan QR codes for fast link collection.
                </p>
              </div>
            </div>

            <button 
              onClick={() => setShowHelpModal(false)}
              className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Global Toast Overlay Notifications */}
      <div 
        className="fixed z-50 flex flex-col gap-2 p-4 pointer-events-none bottom-4 right-4 md:bottom-6 md:right-6 max-w-sm w-full"
        id="toast-container"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border text-xs font-medium flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-200 ${
              toast.type === 'success' 
                ? 'bg-emerald-600 text-white border-transparent' 
                : toast.type === 'error'
                ? 'bg-red-600 text-white border-transparent'
                : toast.type === 'warning'
                ? 'bg-amber-500 text-white border-transparent'
                : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent'
            }`}
          >
            <span>{toast.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-white/80 hover:text-white shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
