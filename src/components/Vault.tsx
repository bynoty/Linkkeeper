/**
 * Vault.tsx - Secure Password Vault Component with AES Client-Side Encryption
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import CryptoJS from 'crypto-js';
import { VaultItem } from '../types';
import { 
  Lock, 
  Unlock, 
  Key, 
  Eye, 
  EyeOff, 
  Copy, 
  Star, 
  Trash2, 
  Edit2, 
  ShieldAlert, 
  Plus, 
  Calendar,
  Search,
  Check,
  X,
  RefreshCw
} from 'lucide-react';

interface VaultProps {
  vaultItems: VaultItem[];
  onSaveVault: (item: Partial<VaultItem>, isNew: boolean) => Promise<void>;
  onDeleteVault: (id: string) => Promise<void>;
  onShowToast: (msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  masterPasswordHash?: string;
  onSetMasterPasswordHash: (hash: string) => void;
  searchTerm: string;
}

export default function Vault({
  vaultItems,
  onSaveVault,
  onDeleteVault,
  onShowToast,
  masterPasswordHash,
  onSetMasterPasswordHash,
  searchTerm,
}: VaultProps) {
  // Master Password State
  const [typedMasterPassword, setTypedMasterPassword] = useState('');
  const [decryptionKey, setDecryptionKey] = useState<string | null>(null); // Unlocked when set
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Initial Setup State
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');

  // Individual password visibility toggle states: record ID -> boolean
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<'date-added' | 'alphabetical' | 'favorited'>('date-added');

  // Vault Item Edit Modal State
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<VaultItem>>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [plainPasswordInForm, setPlainPasswordInForm] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);

  // State for Delete Confirmation Modal
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: string; service: string } | null>(null);

  // Inactivity tracking
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes
  const [secondsToLock, setSecondsToLock] = useState(300);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset inactivity timer on user activity inside the vault
  const resetInactivityTimer = () => {
    if (!isUnlocked || !decryptionKey) return;
    
    // Clear existing timer
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setSecondsToLock(300);

    // Set new auto-lock timer
    inactivityTimerRef.current = setTimeout(() => {
      handleLock();
      onShowToast('Vault automatically locked due to inactivity.', 'info');
    }, AUTO_LOCK_MS);

    // Set countdown tick
    countdownIntervalRef.current = setInterval(() => {
      setSecondsToLock(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Lock Vault
  const handleLock = () => {
    setDecryptionKey(null);
    setIsUnlocked(false);
    setTypedMasterPassword('');
    setVisiblePasswords({});
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  // Setup Activity Listeners when unlocked
  useEffect(() => {
    if (isUnlocked && decryptionKey) {
      resetInactivityTimer();

      const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'click'];
      const handleUserActivity = () => {
        resetInactivityTimer();
      };

      events.forEach(evt => {
        window.addEventListener(evt, handleUserActivity);
      });

      return () => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        events.forEach(evt => {
          window.removeEventListener(evt, handleUserActivity);
        });
      };
    }
  }, [isUnlocked, decryptionKey]);

  // Esc keyboard shortcut to close active modals
  useEffect(() => {
    const handleVaultEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditModalOpen) {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }
        if (deleteConfirmItem) {
          setDeleteConfirmItem(null);
        }
      }
    };
    window.addEventListener('keydown', handleVaultEsc);
    return () => window.removeEventListener('keydown', handleVaultEsc);
  }, [isEditModalOpen, deleteConfirmItem]);

  // Initial registration of Master Password (zero-knowledge verification phrase creation)
  const handleRegisterMasterPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterPassword) {
      onShowToast('Please enter a Master Password', 'warning');
      return;
    }
    if (newMasterPassword.length < 6) {
      onShowToast('Master Password must be at least 6 characters', 'warning');
      return;
    }
    if (newMasterPassword !== confirmMasterPassword) {
      onShowToast('Passwords do not match', 'error');
      return;
    }

    try {
      // Zero-Knowledge Proof: Encrypt "link-keeper-verify" text with the master password.
      // To unlock, we try to decrypt this. If we get "link-keeper-verify", the password is correct!
      const verifyToken = 'link-keeper-verify';
      const ciphertext = CryptoJS.AES.encrypt(verifyToken, newMasterPassword).toString();
      onSetMasterPasswordHash(ciphertext);
      
      // Auto unlock right after setting it
      setDecryptionKey(newMasterPassword);
      setIsUnlocked(true);
      onShowToast('Master Password initialized successfully!', 'success');
    } catch (err) {
      onShowToast(`Failed to initialize: ${(err as Error).message}`, 'error');
    }
  };

  // Unlock existing vault
  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMasterPassword) {
      onShowToast('Please enter your Master Password', 'warning');
      return;
    }
    if (!masterPasswordHash) {
      onShowToast('Vault not initialized.', 'error');
      return;
    }

    try {
      // Attempt decryption of the zero-knowledge verification token
      const bytes = CryptoJS.AES.decrypt(masterPasswordHash, typedMasterPassword);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

      if (decryptedText === 'link-keeper-verify') {
        setDecryptionKey(typedMasterPassword);
        setIsUnlocked(true);
        onShowToast('Vault Unlocked', 'success');
      } else {
        onShowToast('Incorrect Master Password. Please try again.', 'error');
      }
    } catch (err) {
      onShowToast('Decryption failed. Incorrect Master Password.', 'error');
    }
  };

  // Helper to decrypt a password on-the-fly
  const decryptPassword = (encryptedText: string): string => {
    if (!decryptionKey || !encryptedText) return '••••••••';
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, decryptionKey);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      if (!originalText) return '[Decryption Error]';
      return originalText;
    } catch (err) {
      return '[Decryption Error]';
    }
  };

  // One-click clipboard copy
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    onShowToast(`Copied ${label} to clipboard!`, 'success');
  };

  // Favorite toggle
  const handleToggleFavorite = async (item: VaultItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onSaveVault({ ...item, Favorite: !item.Favorite }, false);
      onShowToast(item.Favorite ? 'Removed from favorites' : 'Added to favorites!', 'success');
    } catch (err) {
      onShowToast(`Failed to update: ${(err as Error).message}`, 'error');
    }
  };

  // Delete credential
  const handleDelete = (id: string, service: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmItem({ id, service });
  };

  const executeDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      await onDeleteVault(deleteConfirmItem.id);
      onShowToast('Credential deleted successfully', 'success');
    } catch (err) {
      onShowToast(`Failed to delete: ${(err as Error).message}`, 'error');
    } finally {
      setDeleteConfirmItem(null);
    }
  };

  // Toggle visible passwords
  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Open Edit Modal
  const handleOpenEdit = (item: VaultItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    setEditForm({ ...item });
    
    // Decrypt the password for editing in plain text inside form
    const plainPass = decryptPassword(item.Password);
    setPlainPasswordInForm(plainPass);
    setShowFormPassword(false);
    
    setIsEditModalOpen(true);
  };

  // Save changes
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.Service?.trim()) {
      onShowToast('Service name is required', 'warning');
      return;
    }
    if (!plainPasswordInForm.trim()) {
      onShowToast('Password is required', 'warning');
      return;
    }
    if (!decryptionKey) {
      onShowToast('Vault session is locked. Re-authenticate first.', 'error');
      return;
    }

    setIsSavingEdit(true);
    try {
      // Encrypt password client-side before sending to Sheets/storage!
      const encryptedPassword = CryptoJS.AES.encrypt(plainPasswordInForm, decryptionKey).toString();
      
      const payload: Partial<VaultItem> = {
        ...editForm,
        Password: encryptedPassword,
      };

      await onSaveVault(payload, false);
      setIsEditModalOpen(false);
      setEditingItem(null);
      onShowToast('Credential updated successfully!', 'success');
    } catch (err) {
      onShowToast(`Failed to save changes: ${(err as Error).message}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Filtering Logic
  const filteredVaultItems = useMemo(() => {
    return vaultItems.filter(item => {
      if (searchTerm.trim() === '') return true;
      const query = searchTerm.toLowerCase();
      
      const serviceMatch = item.Service.toLowerCase().includes(query);
      const userMatch = item.Username.toLowerCase().includes(query);
      const noteMatch = item.Note.toLowerCase().includes(query);
      
      return serviceMatch || userMatch || noteMatch;
    }).sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return a.Service.localeCompare(b.Service);
      } else if (sortBy === 'favorited') {
        if (a.Favorite && !b.Favorite) return -1;
        if (!a.Favorite && b.Favorite) return 1;
        // fallback to date-added if favorited status is the same
        return new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime();
      } else {
        // Default: date-added (newest first)
        return new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime();
      }
    });
  }, [vaultItems, searchTerm, sortBy]);

  // Format countdown clock: e.g. "04:59"
  const formatTimeRemaining = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // ==========================================
  // VIEW: Setup/Initial Master Password Set
  // ==========================================
  if (!masterPasswordHash) {
    return (
      <div className="max-w-md mx-auto bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md p-8 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-lg text-center space-y-6" id="vault-setup-view">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Initialize Vault Security</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Link Keeper utilizes client-side AES. Set a **Master Password** to encrypt your passwords. 
            We cannot recover your passwords if you forget this! Keep it safe.
          </p>
        </div>

        <form onSubmit={handleRegisterMasterPassword} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              Set Master Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newMasterPassword}
              onChange={e => setNewMasterPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
              Confirm Master Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmMasterPassword}
              onChange={e => setConfirmMasterPassword(e.target.value)}
              placeholder="Verify master password"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Key className="w-4 h-4" /> Initialize Secure Vault
          </button>
        </form>
      </div>
    );
  }

  // ==========================================
  // VIEW: Vault is Locked
  // ==========================================
  if (!isUnlocked || !decryptionKey) {
    return (
      <div className="max-w-md mx-auto bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md p-8 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-lg text-center space-y-6" id="vault-locked-view">
        <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Credentials Vault is Locked</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Enter your Master Password to decrypt and manage your accounts.
          </p>
        </div>

        <form onSubmit={handleUnlockSubmit} className="space-y-4 text-left">
          <div>
            <div className="relative">
              <input
                type="password"
                required
                value={typedMasterPassword}
                onChange={e => setTypedMasterPassword(e.target.value)}
                placeholder="Enter Master Password"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
                autoFocus
              />
              <Key className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Unlock className="w-4 h-4" /> Unlock Vault
          </button>
        </form>
      </div>
    );
  }

  // ==========================================
  // VIEW: Unlocked Vault list
  // ==========================================
  return (
    <div className="space-y-6" id="vault-unlocked-view">
      
      {/* Control Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-emerald-600 text-white px-5 py-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Unlock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Vault is Decrypted</h3>
            <p className="text-[11px] text-emerald-100">Zero-knowledge local sessions active.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Inactivity tracker clock */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 rounded-lg text-xs font-medium">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Locking in {formatTimeRemaining(secondsToLock)}</span>
          </div>

          <button
            onClick={handleLock}
            className="px-3.5 py-1.5 bg-white text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-50 transition-colors shadow-xs cursor-pointer"
          >
            Lock Vault
          </button>
        </div>
      </div>

      {/* Sorting Controls and Count */}
      {vaultItems.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/50 dark:bg-zinc-900/40 backdrop-blur-md px-4 py-3 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xs">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200">{filteredVaultItems.length}</span> {filteredVaultItems.length === 1 ? 'credential' : 'credentials'}
          </div>
          
          <div className="flex items-center gap-2">
            <label htmlFor="vault-sort" className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
              Sort by:
            </label>
            <select
              id="vault-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date-added' | 'alphabetical' | 'favorited')}
              className="text-xs font-medium bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
            >
              <option value="date-added">Date Added (Newest)</option>
              <option value="alphabetical">Alphabetical (A-Z)</option>
              <option value="favorited">Favorited First</option>
            </select>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      {filteredVaultItems.length === 0 ? (
        <div className="bg-white/60 dark:bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 text-zinc-400">
            <Key className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No passwords found</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
            {vaultItems.length === 0 
              ? "Your password vault is empty. Click 'Quick Add' to save your first account!" 
              : "No search results match your criteria."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVaultItems.map(item => {
            const isPasswordVisible = !!visiblePasswords[item.ID];
            const plainPassword = decryptPassword(item.Password);

            return (
              <div 
                key={item.ID}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
              >
                
                {/* Header info */}
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <h4 className="font-semibold text-zinc-900 dark:text-white truncate max-w-[180px]">
                        {item.Service}
                      </h4>
                      <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Added {new Date(item.CreatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={(e) => handleToggleFavorite(item, e)}
                        className={`p-1 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                          item.Favorite ? 'text-amber-500' : 'text-zinc-400'
                        }`}
                        title={item.Favorite ? 'Remove from favorites' : 'Favorite'}
                      >
                        <Star className={`w-4 h-4 ${item.Favorite ? 'fill-amber-500' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Credentials Fields */}
                  <div className="space-y-2 pt-1">
                    
                    {/* Username */}
                    <div className="flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800/30">
                      <div className="truncate text-left min-w-0">
                        <span className="block text-[10px] font-medium text-zinc-400 uppercase">Username</span>
                        <span className="text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 truncate block">
                          {item.Username || '(No username)'}
                        </span>
                      </div>
                      {item.Username && (
                        <button
                          onClick={() => handleCopy(item.Username, 'Username')}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md hover:bg-white dark:hover:bg-zinc-700 transition-all cursor-pointer"
                          title="Copy Username"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Password */}
                    <div className="flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800/30">
                      <div className="truncate text-left min-w-0">
                        <span className="block text-[10px] font-medium text-zinc-400 uppercase">Password</span>
                        <span className="text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 truncate block tracking-wide">
                          {isPasswordVisible ? plainPassword : '••••••••••••'}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => togglePasswordVisibility(item.ID)}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md hover:bg-white dark:hover:bg-zinc-700 transition-all cursor-pointer"
                          title={isPasswordVisible ? 'Hide password' : 'Show password'}
                        >
                          {isPasswordVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleCopy(plainPassword, 'Password')}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md hover:bg-white dark:hover:bg-zinc-700 transition-all cursor-pointer"
                          title="Copy Password"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Note if exists */}
                  {item.Note && (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic bg-zinc-50 dark:bg-zinc-800/20 p-2 rounded-xl">
                      {item.Note}
                    </p>
                  )}
                </div>

                {/* Operations footer */}
                <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
                  <button
                    onClick={(e) => handleOpenEdit(item, e)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                    title="Edit Credential"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(item.ID, item.Service, e)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors cursor-pointer"
                    title="Delete Account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Pop-up Edit Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                Edit Account Credentials
              </h3>
              <button 
                onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {/* Service */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Service / Platform Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.Service || ''}
                  onChange={e => setEditForm({ ...editForm, Service: e.target.value })}
                  placeholder="e.g. GitHub, Netflix, Router"
                  className="w-full px-3 py-2 rounded-xl text-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Username / Email
                </label>
                <input
                  type="text"
                  value={editForm.Username || ''}
                  onChange={e => setEditForm({ ...editForm, Username: e.target.value })}
                  placeholder="Enter login username"
                  className="w-full px-3 py-2 rounded-xl text-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    required
                    value={plainPasswordInForm}
                    onChange={e => setPlainPasswordInForm(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-xl text-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute right-3 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
                  >
                    {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Note / Remarks */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Account Notes / Recovery Codes (Optional)
                </label>
                <input
                  type="text"
                  value={editForm.Note || ''}
                  onChange={e => setEditForm({ ...editForm, Note: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                  placeholder="e.g. 2FA recovery backup keys"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl disabled:opacity-50 cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  {isSavingEdit ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-950/40 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-zinc-900 dark:text-white text-base">
                  Delete Vault Credential
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Are you sure you want to delete the credentials for <strong className="text-zinc-800 dark:text-zinc-200">"{deleteConfirmItem.service}"</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmItem(null)}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeDelete}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl cursor-pointer transition-colors shadow-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
