/**
 * QuickAdd.tsx - Dynamic entry form for Links, Notes, and Credentials
 */

import React, { useState, useRef, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import jsQR from 'jsqr';
import { LinkItem, VaultItem } from '../types';
import { suggestCategoryFromUrl, checkForDuplicateLink } from '../lib/api';
import { 
  Link as LinkIcon, 
  FileText, 
  Key, 
  PlusCircle, 
  RotateCcw, 
  Check, 
  ShieldAlert,
  Eye,
  EyeOff,
  Sparkles,
  QrCode,
  Camera,
  CameraOff
} from 'lucide-react';

interface QuickAddProps {
  links: LinkItem[];
  categories: string[];
  onSaveLink: (item: Partial<LinkItem>, isNew: boolean) => Promise<void>;
  onSaveVault: (item: Partial<VaultItem>, isNew: boolean) => Promise<void>;
  onShowToast: (msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  masterPasswordHash?: string;
  onNavigateToTab: (tab: 'dashboard' | 'vault' | 'quick-add' | 'settings') => void;
}

type QuickType = 'link' | 'note' | 'credential';

export default function QuickAdd({
  links,
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
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [hasManualCategoryChange, setHasManualCategoryChange] = useState(false);
  const [tags, setTags] = useState('');
  const [note, setNote] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<LinkItem | null>(null);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);

  // Form States - Credential
  const [service, setService] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [credentialNote, setCredentialNote] = useState('');
  const [credentialFavorite, setCredentialFavorite] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Inline Master Password if Vault is currently locked
  const [vaultMasterPassword, setVaultMasterPassword] = useState('');

  // QR Code Scanner States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startScanner = async () => {
    setIsCameraLoading(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().catch(err => {
          console.error("Video play failed:", err);
        });
      }
      
      setIsScannerOpen(true);
    } catch (err) {
      console.error('Camera access failed:', err);
      setCameraError('Could not access camera. Please allow camera permissions in your browser settings.');
      onShowToast('Camera access denied.', 'error');
    } finally {
      setIsCameraLoading(false);
    }
  };

  const stopScanner = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScannerOpen(false);
  };

  const tick = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isScannerOpen) {
      if (isScannerOpen) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
      return;
    }

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });
        
        if (code && code.data) {
          const scannedUrl = code.data;
          setContent(scannedUrl);
          
          if (scannedUrl.startsWith('http://') || scannedUrl.startsWith('https://')) {
            try {
              const parsed = new URL(scannedUrl);
              let host = parsed.hostname.replace('www.', '');
              const parts = host.split('.');
              if (parts.length > 0) {
                const name = parts[0];
                setTitle(name.charAt(0).toUpperCase() + name.slice(1));
              }
            } catch {
              setTitle('Scanned Link');
            }
            
            const suggestion = suggestCategoryFromUrl(scannedUrl, categories);
            setSuggestedCategory(suggestion);
            if (suggestion && !hasManualCategoryChange) {
              setCategory(suggestion);
            }
          } else {
            setTitle('Scanned Code');
          }
          
          onShowToast('QR Code scanned successfully!', 'success');
          stopScanner();
          return;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (isScannerOpen) {
      animationFrameRef.current = requestAnimationFrame(tick);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isScannerOpen]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Reset form helper
  const handleReset = () => {
    setTitle('');
    setContent('');
    setCategory('General');
    setSuggestedCategory(null);
    setHasManualCategoryChange(false);
    setTags('');
    setNote('');
    setFavorite(false);
    setPinned(false);
    setDuplicateMatch(null);
    setShowDuplicateConfirm(false);

    setService('');
    setUsername('');
    setPassword('');
    setCredentialNote('');
    setCredentialFavorite(false);
    setShowPassword(false);
    setVaultMasterPassword('');
    stopScanner();
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

        // Check for duplicate link
        if (activeType === 'link' && duplicateMatch && !showDuplicateConfirm) {
          setShowDuplicateConfirm(true);
          onShowToast('Warning: This link already exists in your storage. Check the warning panel.', 'warning');
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
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {activeType === 'link' ? 'URL / Content Link *' : 'Note Content *'}
                  </label>
                  {activeType === 'link' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isScannerOpen) {
                          stopScanner();
                        } else {
                          startScanner();
                        }
                      }}
                      className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md transition-all cursor-pointer ${
                        isScannerOpen 
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400' 
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isScannerOpen ? (
                        <>
                          <CameraOff className="w-3 h-3" /> Stop QR Scanner
                        </>
                      ) : (
                        <>
                          <QrCode className="w-3 h-3" /> Scan QR Code
                        </>
                      )}
                    </button>
                  )}
                </div>

                {activeType === 'link' && isScannerOpen && (
                  <div className="mt-2 space-y-3 p-4 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl relative overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-400 tracking-wider uppercase font-mono">Live Camera QR Scanner</span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    </div>

                    <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-zinc-200 dark:border-zinc-800 shadow-inner flex items-center justify-center">
                      <video 
                        ref={videoRef} 
                        className="w-full h-full object-cover transform scale-x-[-1]"
                        playsInline
                        muted
                      />
                      
                      {/* Scanning overlay guidelines */}
                      <div className="absolute inset-0 border-[30px] border-black/40 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 border-2 border-dashed border-emerald-500/80 rounded-xl relative flex items-center justify-center">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-500"></div>
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-500"></div>
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-500"></div>
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-500"></div>
                          
                          {/* Laser scanning line */}
                          <div className="w-full h-0.5 bg-emerald-500 absolute top-1/2 -translate-y-1/2 animate-bounce shadow-md shadow-emerald-500/50"></div>
                        </div>
                      </div>
                    </div>

                    {/* Hidden canvas for decoding */}
                    <canvas ref={canvasRef} className="hidden" />

                    <p className="text-[10px] text-center text-zinc-500 dark:text-zinc-400 font-medium">
                      Point your mobile or laptop camera at a QR code containing a URL to scan and add it instantly.
                    </p>
                  </div>
                )}

                {activeType === 'link' && cameraError && (
                  <div className="mt-2 p-3 bg-red-500/5 dark:bg-red-950/20 border border-red-500/20 rounded-xl text-xs space-y-1 animate-in fade-in duration-150">
                    <div className="font-semibold text-red-600 dark:text-red-400">Camera Access Issue</div>
                    <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-[11px]">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => startScanner()}
                      className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 px-2 py-1 rounded-md font-bold cursor-pointer transition-colors mt-1"
                    >
                      Retry Camera Request
                    </button>
                  </div>
                )}

                <textarea
                  required
                  rows={activeType === 'link' ? 2 : 5}
                  placeholder={activeType === 'link' ? 'https://developers.google.com' : 'Write notes here. Supports plaintext or multi-line configurations.'}
                  value={content}
                  onChange={e => {
                    const val = e.target.value;
                    setContent(val);
                    if (activeType === 'link') {
                      const suggestion = suggestCategoryFromUrl(val, categories);
                      setSuggestedCategory(suggestion);
                      if (suggestion && !hasManualCategoryChange) {
                        setCategory(suggestion);
                      }
                      
                      // Check for duplicates
                      const match = checkForDuplicateLink(val, links);
                      setDuplicateMatch(match);
                      setShowDuplicateConfirm(false);
                    } else {
                      setSuggestedCategory(null);
                      setDuplicateMatch(null);
                      setShowDuplicateConfirm(false);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden font-mono dark:text-white"
                />

                {activeType === 'link' && duplicateMatch && (
                  <div className="mt-2 p-3 bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>Duplicate Bookmark Detected</span>
                    </div>
                    <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      This URL is already saved in your bookmarks as <strong className="font-semibold text-zinc-800 dark:text-zinc-200">"{duplicateMatch.Title}"</strong> (Category: <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{duplicateMatch.Category}</strong>).
                    </p>
                    {!showDuplicateConfirm ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowDuplicateConfirm(true);
                          onShowToast('Warning bypassed. You can now click "Save" anyway.', 'info');
                        }}
                        className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-md font-bold cursor-pointer transition-colors w-fit"
                      >
                        Ignore & Allow Duplicate
                      </button>
                    ) : (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/5 dark:bg-emerald-950/20 px-2.5 py-1 rounded-md border border-emerald-500/10 w-fit">
                        <Check className="w-3 h-3 stroke-[3]" /> Warning bypassed. Click Save below to proceed.
                      </div>
                    )}
                  </div>
                )}
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
                    onChange={e => {
                      setCategory(e.target.value);
                      setHasManualCategoryChange(true);
                    }}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden dark:text-white"
                  >
                    <option value="General">General</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    {suggestedCategory && !categories.includes(suggestedCategory) && suggestedCategory !== 'General' && (
                      <option value={suggestedCategory}>{suggestedCategory} (Suggested)</option>
                    )}
                  </select>
                  
                  {suggestedCategory && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/5 dark:bg-amber-950/20 px-2.5 py-1.5 rounded-xl border border-amber-500/20">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
                      <span className="truncate">Suggested: <strong className="font-semibold">{suggestedCategory}</strong></span>
                      {category !== suggestedCategory ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCategory(suggestedCategory);
                            onShowToast(`Category updated to ${suggestedCategory}`, 'success');
                          }}
                          className="ml-auto text-[10px] font-bold underline hover:text-amber-700 dark:hover:text-amber-300 cursor-pointer transition-colors"
                        >
                          Apply
                        </button>
                      ) : (
                        <span className="ml-auto text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <Check className="w-3 h-3 stroke-[3]" /> Applied
                        </span>
                      )}
                    </div>
                  )}
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
