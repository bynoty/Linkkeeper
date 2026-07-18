/**
 * SettingsPanel.tsx - Application settings, category management, data backups, and Google Sheets setup instructions.
 */

import React, { useState } from 'react';
import CryptoJS from 'crypto-js';
import { User } from 'firebase/auth';
import { AppSettings, VaultItem } from '../types';
import { validateAndParseVaultCsv, RawCsvVaultItem } from '../lib/api';
import { 
  Database, 
  Tag, 
  Key, 
  Download, 
  Upload, 
  Trash2, 
  HelpCircle, 
  Check, 
  AlertTriangle,
  BookOpen,
  Copy,
  Plus,
  Lock,
  Unlock,
  Sparkles,
  FileText,
  LogOut,
  Cloud,
  ExternalLink,
  RefreshCw,
  Activity,
  Terminal,
  X
} from 'lucide-react';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onClearCache: () => void;
  onExportBackup: () => void;
  onImportBackup: (backupStr: string) => void;
  onImportBookmarks?: (htmlText: string) => Promise<void>;
  onImportVaultItems: (items: VaultItem[]) => Promise<void>;
  onShowToast: (msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  onSync: () => Promise<void>;
  googleUser?: User | null;
  googleToken?: string | null;
  onGoogleSignIn?: () => Promise<void>;
  onGoogleLogout?: () => Promise<void>;
  onSetupGoogleSheet?: (token?: string) => Promise<void>;
  onGoogleSheetsSync?: (token: string, spreadsheetId: string, currentSettings: AppSettings) => Promise<void>;
  vaultItems: VaultItem[];
  lastGoogleSyncTime?: string | null;
  googleSyncError?: string | null;
  googleSyncLogs?: string[];
  onClearSyncLogs?: () => void;
}

export default function SettingsPanel({
  settings,
  onUpdateSettings,
  onClearCache,
  onExportBackup,
  onImportBackup,
  onImportBookmarks,
  onImportVaultItems,
  onShowToast,
  onSync,
  googleUser,
  googleToken,
  onGoogleSignIn,
  onGoogleLogout,
  onSetupGoogleSheet,
  onGoogleSheetsSync,
  vaultItems,
  lastGoogleSyncTime,
  googleSyncError,
  googleSyncLogs = [],
  onClearSyncLogs,
}: SettingsPanelProps) {
  // Sync form state
  const [webAppUrl, setWebAppUrl] = useState(settings.webAppUrl || '');
  const [apiToken, setApiToken] = useState(settings.apiToken || '');
  const [syncOnLoad, setSyncOnLoad] = useState(settings.syncOnLoad || false);
  const [isTestingSync, setIsTestingSync] = useState(false);

  // Diagnostic overlay state
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [isRetryingSync, setIsRetryingSync] = useState(false);

  // Category addition state
  const [newCategory, setNewCategory] = useState('');

  // Setup Guide Toggle
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Domain Troubleshoot Toggle
  const [showDomainTroubleshoot, setShowDomainTroubleshoot] = useState(false);

  // Clear cache custom confirm modal state
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false);

  // Google Passwords CSV Import State
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvImportRows, setCsvImportRows] = useState<RawCsvVaultItem[]>([]);
  const [importMasterPassword, setImportMasterPassword] = useState('');
  const [importNewMasterPassword, setImportNewMasterPassword] = useState('');
  const [importConfirmMasterPassword, setImportConfirmMasterPassword] = useState('');
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  // Google Passwords CSV Export State
  const [showCsvExportModal, setShowCsvExportModal] = useState(false);
  const [exportMasterPassword, setExportMasterPassword] = useState('');
  const [isProcessingExport, setIsProcessingExport] = useState(false);

  // Esc keyboard shortcut to close active modals
  React.useEffect(() => {
    const handleSettingsEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showClearCacheConfirm) {
          setShowClearCacheConfirm(false);
        }
        if (showCsvImportModal) {
          setShowCsvImportModal(false);
          setCsvImportRows([]);
        }
        if (showCsvExportModal) {
          setShowCsvExportModal(false);
          setExportMasterPassword('');
        }
      }
    };
    window.addEventListener('keydown', handleSettingsEsc);
    return () => window.removeEventListener('keydown', handleSettingsEsc);
  }, [showClearCacheConfirm, showCsvImportModal, showCsvExportModal]);

  // Handle Sheet Sync form save
  const handleSaveSyncSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTestingSync(true);

    try {
      const updated: AppSettings = {
        ...settings,
        webAppUrl: webAppUrl.trim(),
        apiToken: apiToken.trim(),
        syncOnLoad: syncOnLoad,
      };

      onUpdateSettings(updated);

      if (updated.webAppUrl) {
        // Run a sync to test connection
        onShowToast('Testing sync connection with Google Sheets...', 'info');
        await onSync();
        onShowToast('Google Sheets sync connection successful!', 'success');
      } else {
        onShowToast('Saved settings. Running in Local Storage offline mode.', 'success');
      }
    } catch (err) {
      onShowToast(`Sheets Sync failed: ${(err as Error).message}. Double-check Web App URL and deployment access.`, 'error');
    } finally {
      setIsTestingSync(false);
    }
  };

  // Category Management
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedCat = newCategory.trim();
    if (!formattedCat) return;

    if (settings.categories.some(c => c.toLowerCase() === formattedCat.toLowerCase())) {
      onShowToast('Category already exists!', 'warning');
      return;
    }

    const updatedCategories = [...settings.categories, formattedCat];
    onUpdateSettings({
      ...settings,
      categories: updatedCategories,
    });
    setNewCategory('');
    onShowToast(`Added category: ${formattedCat}`, 'success');
  };

  const handleDeleteCategory = (cat: string) => {
    if (cat === 'General' || cat === 'Work' || cat === 'Personal') {
      onShowToast('Default system categories cannot be deleted.', 'warning');
      return;
    }
    const updatedCategories = settings.categories.filter(c => c !== cat);
    onUpdateSettings({
      ...settings,
      categories: updatedCategories,
    });
    onShowToast(`Removed category: ${cat}`, 'success');
  };

  // Import Backup File Selector Handler
  const handleFileImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        if (file.name.toLowerCase().endsWith('.csv')) {
          // Validate and parse the CSV safely using the dedicated helper function
          const parsed = validateAndParseVaultCsv(text);
          
          setCsvImportRows(parsed);
          setImportMasterPassword('');
          setImportNewMasterPassword('');
          setImportConfirmMasterPassword('');
          setShowCsvImportModal(true);
        } else {
          onImportBackup(text);
        }
      } catch (err) {
        onShowToast(`Import failed: ${(err as Error).message}`, 'error');
      }
    };
    reader.readAsText(file);
    // Reset file input target
    e.target.value = '';
  };

  // Import Bookmarks HTML Selector Handler
  const handleBookmarksImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        if (onImportBookmarks) {
          onImportBookmarks(text);
        } else {
          onShowToast('Bookmark import is not supported in this view.', 'warning');
        }
      } catch (err) {
        onShowToast(`Import failed: ${(err as Error).message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Submit secure CSV import
  const handleCsvImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessingImport) return;

    const hasExistingHash = !!settings.masterPasswordHash;

    if (hasExistingHash) {
      if (!importMasterPassword) {
        onShowToast('Please enter your Master Password', 'warning');
        return;
      }
      try {
        const bytes = CryptoJS.AES.decrypt(settings.masterPasswordHash, importMasterPassword);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
        if (decryptedText !== 'link-keeper-verify') {
          onShowToast('Incorrect Master Password. Please try again.', 'error');
          return;
        }
      } catch (err) {
        onShowToast('Verification failed. Invalid Master Password.', 'error');
        return;
      }
    } else {
      if (!importNewMasterPassword) {
        onShowToast('Please enter a Master Password', 'warning');
        return;
      }
      if (importNewMasterPassword.length < 6) {
        onShowToast('Master Password must be at least 6 characters', 'warning');
        return;
      }
      if (importNewMasterPassword !== importConfirmMasterPassword) {
        onShowToast('Passwords do not match', 'error');
        return;
      }

      try {
        const verifyToken = 'link-keeper-verify';
        const newHash = CryptoJS.AES.encrypt(verifyToken, importNewMasterPassword).toString();
        onUpdateSettings({
          ...settings,
          masterPasswordHash: newHash,
        });
      } catch (err) {
        onShowToast(`Failed to initialize Master Password: ${(err as Error).message}`, 'error');
        return;
      }
    }

    setIsProcessingImport(true);
    try {
      const activeKey = hasExistingHash ? importMasterPassword : importNewMasterPassword;

      const vaultItemsToImport: VaultItem[] = csvImportRows.map(row => {
        const encryptedPassword = CryptoJS.AES.encrypt(row.Password, activeKey).toString();

        return {
          ID: Math.random().toString(36).substring(2, 11),
          Service: row.Service || 'Unknown Service',
          Username: row.Username || '',
          Password: encryptedPassword,
          Note: row.Note || '',
          Favorite: false,
          CreatedAt: new Date().toISOString(),
          UpdatedAt: new Date().toISOString(),
        };
      });

      await onImportVaultItems(vaultItemsToImport);
      setShowCsvImportModal(false);
      setCsvImportRows([]);
      onShowToast('Passwords CSV imported successfully!', 'success');
    } catch (err) {
      onShowToast(`Import failed: ${(err as Error).message}`, 'error');
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Double Check Cache Clearing
  const handleConfirmClearCache = () => {
    setShowClearCacheConfirm(true);
  };

  const executeClearCache = () => {
    onClearCache();
    onShowToast('Local cache cleared successfully', 'success');
    setShowClearCacheConfirm(false);
  };

  // Download Sample Google Passwords CSV Template
  const handleDownloadSampleCsv = () => {
    const csvContent = "name,url,username,password,note\n" +
      "Google Account,https://accounts.google.com,user@gmail.com,p@ssword123,My primary Google account\n" +
      "Router Settings,http://192.168.1.1,admin,admin,Default login for home router\n";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "google_passwords_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Sample CSV template downloaded successfully', 'success');
  };

  // Export Vault items to Google/Bitwarden compatible CSV format
  const decryptPasswordHelper = (encryptedText: string, key: string): string => {
    if (!encryptedText) return '';
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, key);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      if (!originalText) return '[Decryption Error]';
      return originalText;
    } catch (err) {
      return '[Decryption Error]';
    }
  };

  const exportVaultCsv = (verificationKey: string | null) => {
    setIsProcessingExport(true);
    try {
      // Prepare CSV content with UTF-8 BOM for Excel/spreadsheets compatibility
      let csvContent = '\uFEFFname,url,username,password,note\n';

      const escapeCsvValue = (val: string) => {
        if (!val) return '';
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      };

      vaultItems.forEach(item => {
        const decryptedPass = verificationKey
          ? decryptPasswordHelper(item.Password, verificationKey)
          : item.Password;

        const service = item.Service || '';
        const looksLikeUrl = service.includes('.') || service.startsWith('http://') || service.startsWith('https://');
        const url = looksLikeUrl ? (service.startsWith('http') ? service : `https://${service}`) : '';

        const nameValue = escapeCsvValue(service);
        const urlValue = escapeCsvValue(url);
        const usernameValue = escapeCsvValue(item.Username || '');
        const passwordValue = escapeCsvValue(decryptedPass);
        const noteValue = escapeCsvValue(item.Note || '');

        csvContent += `${nameValue},${urlValue},${usernameValue},${passwordValue},${noteValue}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", downloadUrl);
      link.setAttribute("download", `linkkeeper_vault_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setShowCsvExportModal(false);
      onShowToast(`Successfully exported ${vaultItems.length} passwords to CSV!`, 'success');
    } catch (err) {
      onShowToast(`Export failed: ${(err as Error).message}`, 'error');
    } finally {
      setIsProcessingExport(false);
    }
  };

  const handleExportVaultCsvClick = () => {
    if (!vaultItems || vaultItems.length === 0) {
      onShowToast('No passwords found in the vault to export.', 'warning');
      return;
    }

    if (settings.masterPasswordHash) {
      setExportMasterPassword('');
      setShowCsvExportModal(true);
    } else {
      exportVaultCsv(null);
    }
  };

  const handleCsvExportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessingExport) return;

    if (!exportMasterPassword) {
      onShowToast('Please enter your Master Password', 'warning');
      return;
    }

    try {
      const bytes = CryptoJS.AES.decrypt(settings.masterPasswordHash!, exportMasterPassword);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
      if (decryptedText !== 'link-keeper-verify') {
        onShowToast('Incorrect Master Password. Please try again.', 'error');
        return;
      }
    } catch (err) {
      onShowToast('Verification failed. Invalid Master Password.', 'error');
      return;
    }

    exportVaultCsv(exportMasterPassword);
  };

  // Copy Snippet Helper
  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    onShowToast('Copied script snippet!', 'success');
  };

  const appsScriptCodeExample = `/**
 * Google Apps Script Web App REST API Setup
 * Deploy this in Extensions > Apps Script in your spreadsheet
 */

// Paste the Code.gs, LinkService.gs, VaultService.gs, Utils.gs code here.
// Full code is located in the /backend folder in your project file tree!`;

  return (
    <div className="max-w-4xl mx-auto space-y-6" id="settings-tab">
      
      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Category Manager & Backup Options */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Security & Auto-Lock Settings */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-600" />
              Security & Auto-Lock
            </h3>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
              Automatically lock the credentials vault if the application remains inactive.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Enable Auto-Lock</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !settings.autoLockEnabled;
                    onUpdateSettings({
                      ...settings,
                      autoLockEnabled: nextVal,
                    });
                    onShowToast(`Auto-Lock ${nextVal ? 'enabled' : 'disabled'}.`, 'success');
                  }}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    settings.autoLockEnabled ? 'bg-emerald-600' : 'bg-zinc-200 dark:bg-zinc-800'
                  }`}
                  aria-label="Toggle Auto-Lock"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      settings.autoLockEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {settings.autoLockEnabled && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label htmlFor="auto-lock-select" className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    Inactivity Timeout
                  </label>
                  <select
                    id="auto-lock-select"
                    value={settings.autoLockTimeout || 15}
                    onChange={(e) => {
                      const mins = parseInt(e.target.value, 10);
                      onUpdateSettings({
                        ...settings,
                        autoLockTimeout: mins,
                      });
                      onShowToast(`Auto-Lock timeout set to ${mins} minutes.`, 'success');
                    }}
                    className="w-full text-xs font-medium bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value={1}>1 Minute</option>
                    <option value={3}>3 Minutes</option>
                    <option value={5}>5 Minutes</option>
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={60}>1 Hour</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Categories Management */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 shadow-xs">
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
              <Tag className="w-4 h-4 text-emerald-600" />
              Manage Categories
            </h3>

            {/* List and delete existing categories */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {settings.categories.map(cat => (
                <div key={cat} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/40 px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800/30">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{cat}</span>
                  {cat !== 'Work' && cat !== 'Personal' && cat !== 'General' && (
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="p-1 text-zinc-400 hover:text-red-500 rounded-md hover:bg-white dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                      title={`Delete ${cat}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add custom category form */}
            <form onSubmit={handleAddCategory} className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="New category"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                maxLength={20}
                className="flex-1 px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:outline-hidden dark:text-white"
              />
              <button
                type="submit"
                className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center justify-center cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Backup & Restore */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-4 h-4 text-emerald-600" />
              Local Backups
            </h3>
            
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
              Download your configurations, notes, and encrypted passwords as a JSON backup file, or import JSON backups, Google Passwords CSV exports, and Chrome/Edge Bookmarks HTML files.
            </p>

            <div className="space-y-2">
              {/* Export backup button */}
              <button
                onClick={onExportBackup}
                className="w-full py-2 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all text-center"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="text-center">Export Data Backup</span>
              </button>

              {/* Import backup file selector wrapper */}
              <label className="w-full py-2 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all text-center">
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span className="text-center">Import Data Backup (JSON/CSV)</span>
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileImportChange}
                  className="hidden"
                />
              </label>

              {/* Import Bookmarks HTML from Chrome/Edge */}
              <label className="w-full py-2 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all text-center">
                <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-center">Import Bookmarks (HTML from Chrome/Edge)</span>
                <input
                  type="file"
                  accept=".html,.htm"
                  onChange={handleBookmarksImportChange}
                  className="hidden"
                />
              </label>

              {/* Export Vault to CSV */}
              <button
                type="button"
                onClick={handleExportVaultCsvClick}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs text-center"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="text-center">Export Vault to CSV (Google/Bitwarden)</span>
              </button>

              {/* Download Sample CSV Template */}
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-emerald-100 dark:border-emerald-900/30 text-center"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-center">Download Sample CSV Template</span>
              </button>
            </div>
          </div>

          {/* Cache Cleaning */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 shadow-xs space-y-3">
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Developer Tools
            </h3>

            <button
              onClick={handleConfirmClearCache}
              className="w-full py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Client Cache
            </button>
          </div>

        </div>

        {/* Right Side: Google Sheets REST API Settings */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Direct Google Sheets Integration Card (OAuth One-Click Setup) */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200/70 dark:border-zinc-800 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-emerald-600" />
                Google Drive Direct Synchronization
              </h3>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                Recommended
              </span>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Enable automated, seamless cloud sync using your own Google Drive. Sign in securely via Google to locate or automatically create your database spreadsheet.
            </p>

            {!googleUser ? (
              <div className="space-y-4 w-full">
                <div className="flex flex-col items-center justify-center p-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/40 gap-3">
                  <Cloud className="w-8 h-8 text-zinc-300 dark:text-zinc-700 animate-pulse" />
                  <div className="text-center">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Google Sheets Sync is disconnected</p>
                    <p className="text-[10px] text-zinc-400 mt-1">Sign in with your Google Account to authorize direct synchronization</p>
                  </div>
                  <button
                    type="button"
                    onClick={onGoogleSignIn}
                    className="mt-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                  >
                    {/* Google SVG Icon */}
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    Connect Google Sheets
                  </button>
                </div>

                {/* Vercel Domain Authorization Troubleshooting Helper */}
                <div className="border border-zinc-200/60 dark:border-zinc-800 rounded-2xl bg-zinc-50/30 dark:bg-zinc-900/20 p-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowDomainTroubleshoot(!showDomainTroubleshoot)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                      ล็อกอินไม่ได้ (Error: auth/unauthorized-domain)? คลิกดูวิธีแก้ไข
                    </span>
                    <span className="text-xs">{showDomainTroubleshoot ? '▲ ซ่อน' : '▼ แสดง'}</span>
                  </button>

                  {showDomainTroubleshoot && (
                    <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-150 dark:border-zinc-800/80 pt-3 animate-in fade-in duration-200">
                      <p>
                        หากคุณพบ Error แจ้งเตือนเกี่ยวกับ <code className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-1 py-0.5 rounded font-mono">auth/unauthorized-domain</code> เมื่อกดปุ่ม Connect บนโดเมน Vercel ของคุณ (<code className="font-mono text-zinc-800 dark:text-zinc-200">linkkeeper-theta.vercel.app</code>) นั่นแปลว่า Firebase ของแอปยังไม่ได้รับอนุญาตโดเมนนี้ครับ
                      </p>
                      
                      <div className="space-y-2 bg-white dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-150 dark:border-zinc-800/60">
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                          🛠️ วิธีแก้ไขง่ายๆ ใน 3 ขั้นตอน:
                        </p>
                        <ol className="list-decimal list-inside space-y-1.5 pl-1">
                          <li>
                            เปิดหน้าจัดการตั้งค่า Firebase ของคุณโดยตรงที่นี่:<br />
                            <a 
                              href="https://console.firebase.google.com/project/project-72a1fdb5-e3ac-46e1-a5d/authentication/settings" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 font-bold underline break-all"
                            >
                              Firebase Console Settings <ExternalLink className="w-3 h-3 inline" />
                            </a>
                          </li>
                          <li>
                            เลื่อนลงมาที่หัวข้อ <strong>"Authorized domains" (โดเมนที่ได้รับอนุญาต)</strong> แล้วคลิกปุ่ม <strong>"Add domain"</strong>
                          </li>
                          <li>
                            ระบุชื่อโดเมน Vercel ของคุณ: <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-emerald-600 dark:text-emerald-400 select-all">linkkeeper-theta.vercel.app</code> จากนั้นกด <strong>Add</strong>
                          </li>
                        </ol>
                      </div>

                      <p className="text-[11px] text-zinc-500 italic">
                        * เมื่อตั้งค่าเสร็จแล้ว ให้ลองรีเฟรชหน้าเว็บนี้อีกครั้งและกดปุ่มด้านบนเพื่อล็อกอินและเริ่มการซิงค์ข้อมูลลง Spreadsheet ส่วนตัวของคุณได้ทันที!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600/10 dark:bg-emerald-600/20 flex items-center justify-center text-emerald-600 font-bold text-xs uppercase">
                      {googleUser.email ? googleUser.email[0] : 'G'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{googleUser.email}</p>
                      <p className="text-[10px] text-zinc-400 font-medium">Signed in with Google Auth</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onGoogleLogout}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>

                <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    {settings.googleSyncEnabled && settings.googleSpreadsheetId ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/30">
                          <Check className="w-3.5 h-3.5" /> Direct Cloud Sync Active
                        </span>
                        <div className="text-[10px] text-zinc-400 font-mono select-all">
                          Spreadsheet: {settings.googleSpreadsheetId.substring(0, 16)}...
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                        Spreadsheet not configured yet
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {settings.googleSyncEnabled && settings.googleSpreadsheetId && (
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${settings.googleSpreadsheetId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View Sheet
                      </a>
                    )}
                    
                    <button
                      type="button"
                      onClick={async () => {
                        if (googleToken && settings.googleSpreadsheetId) {
                          await onGoogleSheetsSync?.(googleToken, settings.googleSpreadsheetId, settings);
                        } else {
                          await onSetupGoogleSheet?.(googleToken || undefined);
                        }
                      }}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> {settings.googleSyncEnabled && settings.googleSpreadsheetId ? 'Sync Now' : 'Initialize & Link Sheet'}
                    </button>
                  </div>
                </div>

                {/* Embedded Diagnostic Panel Section */}
                <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-3.5 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      <Activity className="w-3.5 h-3.5 text-emerald-600" />
                      Sync Diagnostics & Logs
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDiagnosticsModal(true)}
                      className="text-[11px] font-bold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      <Terminal className="w-3.5 h-3.5" /> Open Diagnostic Console
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-50/50 dark:bg-zinc-900/30 p-3 rounded-xl border border-zinc-100 dark:border-zinc-850/80">
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Last Successful Sync</p>
                      <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-1">
                        {lastGoogleSyncTime ? lastGoogleSyncTime : <span className="text-zinc-400 italic font-normal">Never synced successfully</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Connection Status</p>
                      <div className="mt-1">
                        {googleSyncError ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Error Detected
                          </span>
                        ) : lastGoogleSyncTime ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <Check className="w-3.5 h-3.5 shrink-0" /> Healthy
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400 italic">No sync attempted</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {googleSyncError && (
                    <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider block">Google Sheets API Error Details</span>
                      <p className="text-[11px] font-mono text-red-800 dark:text-red-300 break-all select-text leading-relaxed whitespace-pre-wrap">
                        {googleSyncError}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Legacy Apps Script connection card */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200/70 dark:border-zinc-800 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-600" />
                Google Sheets Sync Configuration
              </h3>
              
              <button
                type="button"
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                className="text-xs text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" /> {showSetupGuide ? 'Hide Setup Guide' : 'How to Setup?'}
              </button>
            </div>

            {/* Quick connection status banner */}
            <div className={`p-4 rounded-2xl border text-xs leading-normal flex items-start gap-2.5 ${
              settings.webAppUrl 
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-400' 
                : 'bg-zinc-500/5 border-zinc-500/15 text-zinc-600 dark:text-zinc-400'
            }`}>
              <HelpCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
              <div>
                <strong>Database State:</strong> {settings.webAppUrl ? (
                  <>Connected to Google Sheets REST API. Data is actively synced and securely backed up to your spreadsheet.</>
                ) : (
                  <>Running in offline LocalStorage mode. Your saved bookmarks, notes, and encrypted passwords are stored safely in your browser container. Connect your custom spreadsheet below to enable cloud backup!</>
                )}
              </div>
            </div>

            {/* Config Form */}
            <form onSubmit={handleSaveSyncSettings} className="space-y-4 text-left">
              
              {/* Web App URL */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Google Apps Script Web App URL
                </label>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={webAppUrl}
                  onChange={e => setWebAppUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
                />
              </div>

              {/* API Token (Optional) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  API Token / Secret Key <span className="text-[10px] text-zinc-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="password"
                  placeholder="e.g. matching your REQUIRE_API_TOKEN in Apps Script"
                  value={apiToken}
                  onChange={e => setApiToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
                />
              </div>

              {/* Toggle load sync */}
              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncOnLoad}
                    onChange={e => setSyncOnLoad(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-zinc-300 rounded-sm focus:ring-emerald-500 dark:bg-zinc-800/40 dark:border-zinc-700 cursor-pointer"
                  />
                  Automatically sync and fetch on page load
                </label>
              </div>

              <button
                type="submit"
                disabled={isTestingSync}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              >
                {isTestingSync ? 'Saving & Syncing...' : 'Save & Test Connection'}
              </button>

            </form>
          </div>

          {/* Setup Guide instructions card (Toggleable) */}
          {(showSetupGuide || !settings.webAppUrl) && (
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200/70 dark:border-zinc-800 shadow-xs space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
              <h4 className="font-semibold text-sm text-zinc-800 dark:text-white flex items-center gap-1.5">
                <HelpCircle className="w-4.5 h-4.5 text-emerald-600" />
                Step-by-Step Google Sheets Setup Guide
              </h4>
              
              <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-3 leading-relaxed">
                <ol className="list-decimal list-inside space-y-2.5">
                  <li>
                    Create a new Google Sheet on your Google Drive. Name it <strong>"Personal Link & Note Keeper"</strong>.
                  </li>
                  <li>
                    In the spreadsheet menu, click <strong>Extensions &gt; Apps Script</strong>.
                  </li>
                  <li>
                    In the left navigation bar, you can replicate the scripts found in your local project workspace under the <strong>`/backend`</strong> directory:
                    <ul className="list-disc list-inside pl-5 mt-1 text-zinc-500 space-y-1 font-mono">
                      <li>Code.gs</li>
                      <li>LinkService.gs</li>
                      <li>VaultService.gs</li>
                      <li>Utils.gs</li>
                      <li>Security.gs</li>
                      <li>API.gs</li>
                    </ul>
                  </li>
                  <li>
                    Click the <strong>"Save"</strong> floppy disk icon in Apps Script.
                  </li>
                  <li>
                    Click the <strong>Deploy</strong> blue button at the top right, then select <strong>New Deployment</strong>.
                  </li>
                  <li>
                    Click the Gear icon next to "Select type", then select <strong>Web App</strong>.
                    <ul className="list-disc list-inside pl-5 mt-1 text-zinc-500">
                      <li>Set Description: "Keeper API v1"</li>
                      <li>Set Execute as: <strong>"Me"</strong> (your email)</li>
                      <li>Set Who has access: <strong>"Anyone"</strong></li>
                    </ul>
                  </li>
                  <li>
                    Click <strong>Deploy</strong>. Authorize the requested permissions on your Google Account (click Advanced &gt; Go to Untitled Script if Google asks).
                  </li>
                  <li>
                    Copy the generated <strong>Web App URL</strong> (which ends in `/exec`), paste it in the form above, and click <strong>"Save & Test Connection"</strong>!
                  </li>
                </ol>
              </div>

              {/* Code preview block */}
              <div className="space-y-1 pt-2">
                <span className="block text-[11px] font-semibold text-zinc-500">Spreadsheet Backend Scripts:</span>
                <div className="relative">
                  <pre className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-150 dark:border-zinc-800 p-3.5 rounded-xl text-[10px] font-mono text-zinc-500 dark:text-zinc-400 overflow-x-auto max-h-40">
                    {appsScriptCodeExample}
                  </pre>
                  <button
                    onClick={() => handleCopyText(appsScriptCodeExample)}
                    className="absolute right-3 top-3 p-1.5 bg-white dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                    title="Copy Snippet"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* Custom Clear Cache Confirmation Modal */}
      {showClearCacheConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/40 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-zinc-900 dark:text-white text-base">
                  Clear Local Cache?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Are you sure you want to clear your local state cache? This deletes the browser-saved cache of Links & Vault credentials. Your real Google Sheets data is safe.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearCacheConfirm(false)}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeClearCache}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl cursor-pointer transition-colors shadow-xs"
                >
                  Clear Cache
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Passwords CSV Import Modal */}
      {showCsvImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <form onSubmit={handleCsvImportSubmit} className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white text-base">
                    Passwords CSV Import
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Detected {csvImportRows.length} credentials from CSV file.
                  </p>
                </div>
              </div>

              {settings.masterPasswordHash ? (
                // Scenario A: Existing Master Password
                <div className="space-y-3">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Please enter your existing <strong>Vault Master Password</strong>. It will be used to securely encrypt the imported passwords client-side (zero-knowledge) before they are stored.
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Master Password
                    </label>
                    <input
                      type="password"
                      placeholder="Enter Master Password"
                      value={importMasterPassword}
                      onChange={(e) => setImportMasterPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                      disabled={isProcessingImport}
                      required
                    />
                  </div>
                </div>
              ) : (
                // Scenario B: No Master Password (Initialize Vault)
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 rounded-xl flex gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-normal">
                      You haven't set a Master Password yet. Create one now to initialize your Secure Vault and encrypt your imported credentials.
                    </p>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Set a master password of at least 6 characters. <strong>Do not lose this password</strong> as there is no way to recover your vault without it.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        <Lock className="w-3 h-3" /> New Master Password
                      </label>
                      <input
                        type="password"
                        placeholder="Choose a strong password"
                        value={importNewMasterPassword}
                        onChange={(e) => setImportNewMasterPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                        disabled={isProcessingImport}
                        required
                        minLength={6}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                        <Unlock className="w-3 h-3" /> Confirm Master Password
                      </label>
                      <input
                        type="password"
                        placeholder="Re-enter password"
                        value={importConfirmMasterPassword}
                        onChange={(e) => setImportConfirmMasterPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                        disabled={isProcessingImport}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCsvImportModal(false);
                    setCsvImportRows([]);
                  }}
                  className="flex-1 px-4 py-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors"
                  disabled={isProcessingImport}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl cursor-pointer transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  disabled={isProcessingImport}
                >
                  {isProcessingImport ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                      Importing...
                    </>
                  ) : (
                    'Encrypt & Import'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Passwords CSV Export Modal */}
      {showCsvExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <form onSubmit={handleCsvExportSubmit} className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 dark:text-white text-base">
                    Passwords CSV Export
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Export {vaultItems.length} credentials in Google / Bitwarden format.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Please enter your <strong>Vault Master Password</strong> to decrypt your secure credentials for export.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Master Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter Master Password"
                    value={exportMasterPassword}
                    onChange={(e) => setExportMasterPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                    disabled={isProcessingExport}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCsvExportModal(false);
                    setExportMasterPassword('');
                  }}
                  className="flex-1 px-4 py-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors"
                  disabled={isProcessingExport}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl cursor-pointer transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  disabled={isProcessingExport}
                >
                  {isProcessingExport ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    'Decrypt & Export'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Sheets Sync Diagnostic Console Overlay */}
      {showDiagnosticsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Terminal className="w-4.5 h-4.5" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-sm text-zinc-800 dark:text-white">Google Sheets Sync Diagnostics</h3>
                  <p className="text-[10px] text-zinc-400">Inspect real-time API logs and troubleshoot cloud synchronization errors</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-350 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-1.5">
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Sync Connection State</p>
                  <div>
                    {googleToken ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30">
                        <Check className="w-3 h-3" /> Authorized & Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
                        Offline / Session Expired
                      </span>
                    )}
                  </div>
                  <div className="pt-1.5 text-[10px] text-zinc-400">
                    Spreadsheet ID: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[9px] select-all font-mono break-all">{settings.googleSpreadsheetId || 'None'}</code>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-900/30 space-y-1.5">
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Last Sync Attempt</p>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {lastGoogleSyncTime ? lastGoogleSyncTime : <span className="text-zinc-400 italic font-normal">Never synced successfully</span>}
                  </p>
                  <div className="pt-1 text-[10px] text-zinc-450 flex items-center gap-1.5">
                    Health Check: {googleSyncError ? (
                      <span className="text-red-500 font-bold flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Failed</span>
                    ) : lastGoogleSyncTime ? (
                      <span className="text-emerald-500 font-bold flex items-center gap-0.5"><Check className="w-3 h-3" /> Succeeded</span>
                    ) : (
                      <span className="text-zinc-400 italic">None</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Callout */}
              {googleSyncError && (
                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl space-y-2.5 text-left">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Specific Google Sheets API Exception</h4>
                  </div>
                  <div className="bg-red-500/10 dark:bg-red-950/20 p-3.5 rounded-xl border border-red-500/15 max-h-36 overflow-y-auto">
                    <p className="text-xs font-mono text-red-800 dark:text-red-300 select-text break-all whitespace-pre-wrap leading-relaxed">
                      {googleSyncError}
                    </p>
                  </div>
                  <div className="text-[10.5px] text-zinc-500 leading-normal space-y-1">
                    <p>💡 <strong>Troubleshooting Tips:</strong></p>
                    <ul className="list-disc list-inside space-y-1 pl-1">
                      <li>If error is <span className="font-mono text-red-600 dark:text-red-400 font-bold">Unauthorized</span>: Google credentials expired. Please Click Log Out (Sign Out) and Sign In again to request a fresh token.</li>
                      <li>If error is <span className="font-mono text-red-600 dark:text-red-400 font-bold">403 (Forbidden)</span>: The permission scopes are missing. Refresh the connection.</li>
                      <li>If error is <span className="font-mono text-red-600 dark:text-red-400 font-bold">404 (Not Found)</span>: The spreadsheet on your drive was removed or renamed. Initialize a new spreadsheet tab.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Granular Execution Logs */}
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 uppercase tracking-wider">
                    <Terminal className="w-3.5 h-3.5" /> Granular Execution Logs
                  </h4>
                  {googleSyncLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearSyncLogs}
                      className="text-[10px] text-zinc-400 hover:text-red-500 cursor-pointer font-semibold transition-all"
                    >
                      Clear Log trace
                    </button>
                  )}
                </div>
                <div className="h-56 rounded-2xl bg-zinc-950 dark:bg-black border border-zinc-800 p-4 font-mono text-[10.5px] leading-relaxed text-zinc-300 overflow-y-auto select-text space-y-1.5">
                  {googleSyncLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-1 text-center py-10">
                      <Terminal className="w-7 h-7 text-zinc-800 animate-pulse" />
                      <p className="font-semibold text-zinc-400">No logs generated yet</p>
                      <p className="text-[10px] text-zinc-500 max-w-xs leading-normal">Press the re-run test sync button below to collect detailed API transactions logs.</p>
                    </div>
                  ) : (
                    googleSyncLogs.map((log, idx) => {
                      let textColor = 'text-zinc-300';
                      if (log.includes('CRITICAL SYNC ERROR')) textColor = 'text-red-400 font-semibold';
                      else if (log.includes('successfully') || log.includes('successful') || log.includes('completed') || log.includes('synchronized')) textColor = 'text-emerald-400';
                      else if (log.includes('Step')) textColor = 'text-amber-400 font-bold mt-2 block border-b border-zinc-800/50 pb-0.5';
                      return (
                        <div key={idx} className={`${textColor} break-all`}>
                          {log}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 font-mono">
                Diag Engine: active
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDiagnosticsModal(false)}
                  className="px-4 py-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl cursor-pointer transition-all"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isRetryingSync || !googleToken || !settings.googleSpreadsheetId}
                  onClick={async () => {
                    if (googleToken && settings.googleSpreadsheetId) {
                      setIsRetryingSync(true);
                      onShowToast('Retrying synchronization with diagnostic trace...', 'info');
                      try {
                        await onGoogleSheetsSync?.(googleToken, settings.googleSpreadsheetId, settings);
                      } catch (err) {
                        // handled by handlesync error tracker
                      } finally {
                        setIsRetryingSync(false);
                      }
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-emerald-600/10"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRetryingSync ? 'animate-spin' : ''}`} />
                  {isRetryingSync ? 'Testing Sync...' : 'Re-run Sync Test'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
