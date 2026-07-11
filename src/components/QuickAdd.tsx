/**
 * QuickAdd.tsx - Dynamic entry form for Links, Notes, and Credentials
 */

import React, { useState } from 'react';
import CryptoJS from 'crypto-js';
import { LinkItem, VaultItem } from '../types';
import { 
  Link as LinkIcon, 
  FileText, 
  Key, 
  PlusCircle, 
  RotateCcw, 
  Check, 
  ShieldAlert,
  Eye,
  EyeOff
} from 'lucide-react';

interface QuickAddProps {
  categories: string[];
  onSaveLink: (item: Partial<LinkItem>, isNew: boolean) => Promise<void>;
  onSaveVault: (item: Partial<VaultItem>, isNew: boolean) => Promise<void>;
  onShowToast: (msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  masterPasswordHash?: string;
  onNavigateToTab: (tab: 'dashboard' | 'vault' | 'quick-add' | 'settings') => void;
}

type QuickType = 'link' | 'note' | 'credential';

export default function QuickAdd({
  categories,
  onSaveLink,
  onSaveVault,
  onShowToast,
  masterPasswordHash,
  onNavigateToTab,
}: QuickAddProps) {
  const [activeType, setActiveType] = useState<QuickType>('link');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States - Link & Note
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState('');
  const [note, setNote] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [pinned, setPinned] = useState(false);

  // Form States - Credential
  const [service, setService] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [credentialNote, setCredentialNote] = useState('');
  const [credentialFavorite, setCredentialFavorite] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Inline Master Password if Vault is currently locked
  const [vaultMasterPassword, setVaultMasterPassword] = useState('');

  // Reset form helper
  const handleReset = () => {
    setTitle('');
    setContent('');
    setCategory('General');
    setTags('');
    setNote('');
    setFavorite(false);
    setPinned(false);

    setService('');
    setUsername('');
    setPassword('');
    setCredentialNote('');
    setCredentialFavorite(false);
    setShowPassword(false);
    setVaultMasterPassword('');
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Handling Link or Note save
      if (activeType === 'link' || activeType === 'note') {
        if (!title.trim()) {
          onShowToast('Title is required', 'warning');
          setIsSubmitting(false);
          return;
        }
        if (!content.trim()) {
          onShowToast('Content or description is required', 'warning');
          setIsSubmitting(false);
          return;
        }

        const newLink: Partial<LinkItem> = {
          Title: title.trim(),
          Content: content.trim(),
          Category: category,
          Tags: tags.split(',').map(t => t.trim()).filter(Boolean).join(','),
          Note: note.trim(),
          Favorite: favorite,
          Pinned: pinned,
        };

        await onSaveLink(newLink, true);
        onShowToast(`Saved ${activeType === 'link' ? 'link' : 'note'} successfully!`, 'success');
        handleReset();
        onNavigateToTab('dashboard'); // Redirect to dashboard to see results
      } 
      // 2. Handling Credential save
      else if (activeType === 'credential') {
        if (!masterPasswordHash) {
          onShowToast('Setup your Master Password first in the Vault tab!', 'warning');
          onNavigateToTab('vault');
          setIsSubmitting(false);
          return;
        }
        if (!service.trim()) {
          onShowToast('Service name is required', 'warning');
          setIsSubmitting(false);
          return;
        }
        if (!password.trim()) {
          onShowToast('Password is required', 'warning');
          setIsSubmitting(false);
          return;
        }
        if (!vaultMasterPassword.trim()) {
          onShowToast('Please enter your Master Password to encrypt this credential', 'warning');
          setIsSubmitting(false);
          return;
        }

        // Validate Master Password before encrypting
        try {
          const bytes = CryptoJS.AES.decrypt(masterPasswordHash, vaultMasterPassword);
          const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
          
          if (decryptedText !== 'link-keeper-verify') {
            onShowToast('Incorrect Master Password. Encryption aborted.', 'error');
            setIsSubmitting(false);
            return;
          }
        } catch (err) {
          onShowToast('Master Password verification failed.', 'error');
          setIsSubmitting(false);
          return;
        }

        // Encrypt plain password using confirmed master password
        const encryptedPassword = CryptoJS.AES.encrypt(password.trim(), vaultMasterPassword).toString();

        const newCredential: Partial<VaultItem> = {
          Service: service.trim(),
          Username: username.trim(),
          Password: encryptedPassword,
          Note: credentialNote.trim(),
          Favorite: credentialFavorite,
        };

        await onSaveVault(newCredential, true);
        onShowToast('Saved credential safely inside Vault!', 'success');
        handleReset();
        onNavigateToTab('vault'); // Redirect to Vault
      }
    } catch (err) {
      onShowToast(`Failed to add: ${(err as Error).message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6" id="quick-add-tab">
      
      {/* Visual Selection Tabs */}
      <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md p-1.5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 flex shadow-xs">
        
        {/* Link Tab */}
        <button
          onClick={() => { setActiveType('link'); handleReset(); }}
          className={`flex-1 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeType === 'link'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          Link / Bookmark
        </button>

        {/* Note Tab */}
        <button
          onClick={() => { setActiveType('note'); handleReset(); }}
          className={`flex-1 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeType === 'note'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          Text Note
        </button>

        {/* Credential Tab */}
        <button
          onClick={() => { setActiveType('credential'); handleReset(); }}
          className={`flex-1 py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeType === 'credential'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
          }`}
        >
          <Key className="w-4 h-4" />
          Credential (Vault)
        </button>
      </div>

      {/* Main Entry Card Form */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200/70 dark:border-zinc-800 shadow-sm">
        
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* =========================================
              FORM FIELDS: LINK & NOTE
              ========================================= */}
          {(activeType === 'link' || activeType === 'note') && (
            <>
              {/* Title */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {activeType === 'link' ? 'Link Title *' : 'Note Subject *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={activeType === 'link' ? 'e.g. Google Developers' : 'e.g. MySQL Port Configurations'}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
                />
              </div>

              {/* Content / URL */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {activeType === 'link' ? 'URL / Content Link *' : 'Note Content *'}
                </label>
                <textarea
                  required
                  rows={activeType === 'link' ? 2 : 5}
                  placeholder={activeType === 'link' ? 'https://developers.google.com' : 'Write notes here. Supports plaintext or multi-line configurations.'}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden font-mono dark:text-white"
                />
              </div>

              {/* Grid: Category & Tags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Category select */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
                  >
                    <option value="General">General</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Tags input */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AI, Docs, Google"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
                  />
                </div>
              </div>

              {/* Description Note */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Additional Note (Optional description)
                </label>
                <input
                  type="text"
                  placeholder="e.g. useful for the new applet project"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
                />
              </div>

              {/* Checkboxes: Pin & Favorite */}
              <div className="flex gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={e => setPinned(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-zinc-300 rounded-sm focus:ring-emerald-500 dark:bg-zinc-800/40 dark:border-zinc-700 cursor-pointer"
                  />
                  Pin to Top
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={favorite}
                    onChange={e => setFavorite(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-zinc-300 rounded-sm focus:ring-emerald-500 dark:bg-zinc-800/40 dark:border-zinc-700 cursor-pointer"
                  />
                  Mark as Favorite
                </label>
              </div>
            </>
          )}

          {/* =========================================
              FORM FIELDS: SECURE VAULT CREDENTIALS
              ========================================= */}
          {activeType === 'credential' && (
            <>
              {/* Service/Platform name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Service / Platform Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GitHub, Router Admin, Amazon AWS"
                  value={service}
                  onChange={e => setService(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
                />
              </div>

              {/* Grid: Username & Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Username */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Username / Email
                  </label>
                  <input
                    type="text"
                    placeholder="Enter login username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter login password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm pr-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden font-mono dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Credential Notes / Recovery Keys (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. contains custom pins"
                  value={credentialNote}
                  onChange={e => setCredentialNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
                />
              </div>

              {/* Favorite check */}
              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={credentialFavorite}
                    onChange={e => setCredentialFavorite(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-zinc-300 rounded-sm focus:ring-emerald-500 dark:bg-zinc-800/40 dark:border-zinc-700 cursor-pointer"
                  />
                  Mark as Favorite Credential
                </label>
              </div>

              {/* CRITICAL: Master Password Verification to execute client-side AES */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>
                    <strong>AES Encryption Required:</strong> Since credentials are never saved in plain text, you must enter your Master Password to locally encrypt this password before saving.
                  </p>
                </div>
                
                {masterPasswordHash ? (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                      Verify Master Password *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter Master Password to authorize save"
                      value={vaultMasterPassword}
                      onChange={e => setVaultMasterPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                    />
                  </div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-xs text-red-500 font-semibold mb-2">Vault Master Password is not set up!</p>
                    <button
                      type="button"
                      onClick={() => onNavigateToTab('vault')}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                    >
                      Initialize Master Password Now
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Action buttons bar */}
          <div className="flex gap-3 justify-end border-t border-zinc-100 dark:border-zinc-800 pt-5">
            {/* Reset Button */}
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSubmitting || (activeType === 'credential' && !masterPasswordHash)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" /> 
              {isSubmitting ? 'Saving...' : `Save ${activeType.charAt(0).toUpperCase() + activeType.slice(1)}`}
            </button>
          </div>

        </form>

      </div>

    </div>
  );
}
