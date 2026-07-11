/**
 * App.tsx - Root Application Orchestrator
 */

import React, { useState, useEffect, useTransition, useRef } from 'react';
import { User } from 'firebase/auth';
import { 
  initAuth, 
  googleSignIn, 
  logout as googleLogout 
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
  Sparkles
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

  // Google Auth states
  const [user, setUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

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

  // Trigger a full direct Google Sheet synchronization
  const handleGoogleSheetsSync = async (token: string, spreadsheetId: string, currentSettings: AppSettings) => {
    setIsLoading(true);
    try {
      showToast('Syncing with Google Drive...', 'info');

      // 1. Fetch remote data
      const remoteLinks = await fetchLinksFromSheet(token, spreadsheetId);
      const remoteVault = await fetchVaultFromSheet(token, spreadsheetId);

      // 2. Load current local cache
      const localDataLinks = localStorage.getItem('link_keeper_links');
      const localLinks: LinkItem[] = localDataLinks ? JSON.parse(localDataLinks) : [];

      const localDataVault = localStorage.getItem('link_keeper_vault');
      const localVault: VaultItem[] = localDataVault ? JSON.parse(localDataVault) : [];

      // 3. Merge
      const mergedLinks = mergeArrays(localLinks, remoteLinks);
      const mergedVault = mergeArrays(localVault, remoteVault);

      // 4. Update state & local storage cache
      setLinks(mergedLinks);
      setVaultItems(mergedVault);
      localStorage.setItem('link_keeper_links', JSON.stringify(mergedLinks));
      localStorage.setItem('link_keeper_vault', JSON.stringify(mergedVault));

      // 5. Write merged data back to Google Sheet
      await saveLinksToSheet(token, spreadsheetId, mergedLinks);
      await saveVaultToSheet(token, spreadsheetId, mergedVault);

      showToast('Google Drive sync successful!', 'success');
    } catch (err) {
      console.error('Google Sheets direct sync failed:', err);
      showToast(`Drive Sync Failed: ${(err as Error).message}`, 'error');
      throw err;
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
      showToast(`Connection failed: ${(err as Error).message}`, 'error');
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
        await saveLinksToSheet(googleToken, settings.googleSpreadsheetId, nextLinks);
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
        await saveLinksToSheet(googleToken, settings.googleSpreadsheetId, nextLinks);
      }
    } catch (err) {
      showToast(`Delete failed: ${(err as Error).message}`, 'error');
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
        await saveVaultToSheet(googleToken, settings.googleSpreadsheetId, nextVault);
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
        await saveVaultToSheet(googleToken, settings.googleSpreadsheetId, nextVault);
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
        <header className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md px-4 sm:px-6 py-4 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          
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
            {/* Sync Database Status Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
              {settings.googleSyncEnabled && user ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Google Drive Direct Sync</span>
                </>
              ) : settings.webAppUrl ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Google Sheets Sync</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Local Storage Only</span>
                </>
              )}
            </div>

            {/* Manual Sync Trigger */}
            {(((settings.googleSyncEnabled && user && googleToken && settings.googleSpreadsheetId)) || settings.webAppUrl) && (
              <button
                onClick={async () => {
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

            {/* Dark Mode Toggle */}
            <button
              onClick={handleToggleTheme}
              className="p-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl transition-all cursor-pointer"
              title="Toggle Theme"
            >
              {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md p-1.5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 flex shadow-xs gap-1">
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
            />
          )}

          {activeTab === 'quick-add' && (
            <QuickAdd
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
              onImportVaultItems={handleImportVaultItems}
              onShowToast={showToast}
              onSync={handleSync}
              googleUser={user}
              googleToken={googleToken}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleLogout={handleGoogleLogout}
              onSetupGoogleSheet={handleSetupGoogleSheet}
              onGoogleSheetsSync={handleGoogleSheetsSync}
            />
          )}
        </main>

      </div>

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
