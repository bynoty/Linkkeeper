import React, { useState } from 'react';
import JSZip from 'jszip';
import { X, Bookmark, Download, Copy, Check, Sparkles, ExternalLink, ShieldCheck, Chrome, FolderArchive } from 'lucide-react';

interface BookmarkletModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl: string;
}

export const BookmarkletModal: React.FC<BookmarkletModalProps> = ({
  isOpen,
  onClose,
  appUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [activeTab, setActiveTab] = useState<'bookmarklet' | 'extension'>('bookmarklet');

  if (!isOpen) return null;

  const currentOrigin = appUrl || window.location.origin;

  // JavaScript Bookmarklet Code
  const bookmarkletCode = `javascript:(function(){var url=encodeURIComponent(window.location.href);var title=encodeURIComponent(document.title);window.open('${currentOrigin}/?add_url='+url+'&add_title='+title,'_blank');})();`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateExtensionIconBlob = (): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#059669';
        ctx.beginPath();
        ctx.roundRect(0, 0, 128, 128, 28);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '64px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔖', 64, 64);
      }
      canvas.toBlob((blob) => {
        resolve(blob || new Blob([]));
      }, 'image/png');
    });
  };

  const handleDownloadZip = async () => {
    setIsGeneratingZip(true);
    try {
      const zip = new JSZip();

      const manifest = {
        manifest_version: 3,
        name: "LinkKeeper - Quick Link Saver",
        version: "1.0.0",
        description: "Save any web page directly to your LinkKeeper Knowledge Base in 1-click.",
        permissions: ["activeTab"],
        action: {
          default_title: "Save to LinkKeeper",
          default_popup: "popup.html",
          default_icon: "icon128.png"
        },
        icons: {
          "128": "icon128.png"
        }
      };

      const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; width: 320px; padding: 16px; margin: 0; background: #09090b; color: #f4f4f5; box-sizing: border-box; }
    .header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .icon { width: 36px; height: 36px; background: rgba(16, 185, 129, 0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1px solid rgba(16, 185, 129, 0.3); }
    h3 { font-size: 15px; margin: 0; color: #10b981; font-weight: 700; }
    p { font-size: 12px; color: #a1a1aa; margin: 0 0 14px; line-height: 1.4; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px; font-size: 11px; }
    .title { font-weight: 600; color: #e4e4e7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
    .url { color: #10b981; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.9; font-family: monospace; font-size: 10px; }
    button { width: 100%; padding: 11px; background: #059669; color: white; border: none; border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.2s; }
    button:hover { background: #10b981; }
    button:active { transform: scale(0.98); }
  </style>
</head>
<body>
  <div class="header">
    <div class="icon">🔖</div>
    <div>
      <h3>LinkKeeper Saver</h3>
      <div style="font-size:10px; color:#71717a;">Web Extension</div>
    </div>
  </div>
  <p>Save active browser page to your LinkKeeper Knowledge Base.</p>
  <div class="card">
    <div class="title" id="pageTitle">Detecting tab title...</div>
    <div class="url" id="pageUrl">...</div>
  </div>
  <button id="saveBtn">
    <span>➕ Save Webpage to LinkKeeper</span>
  </button>
  <script src="popup.js"></script>
</body>
</html>`;

      const popupJs = `document.addEventListener('DOMContentLoaded', () => {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        const activeTab = tabs[0];
        const pageTitle = activeTab.title || 'Untitled Page';
        const pageUrl = activeTab.url || '';

        const titleEl = document.getElementById('pageTitle');
        const urlEl = document.getElementById('pageUrl');
        const saveBtn = document.getElementById('saveBtn');

        if (titleEl) titleEl.textContent = pageTitle;
        if (urlEl) urlEl.textContent = pageUrl;

        if (saveBtn) {
          saveBtn.addEventListener('click', () => {
            const u = encodeURIComponent(pageUrl);
            const t = encodeURIComponent(pageTitle);
            const targetUrl = '${currentOrigin}/?add_url=' + u + '&add_title=' + t;
            if (chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url: targetUrl });
            } else {
              window.open(targetUrl, '_blank');
            }
          });
        }
      }
    });
  } else {
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        window.open('${currentOrigin}', '_blank');
      });
    }
  }
});`;

      const iconBlob = await generateExtensionIconBlob();

      zip.file("manifest.json", JSON.stringify(manifest, null, 2));
      zip.file("popup.html", popupHtml);
      zip.file("popup.js", popupJs);
      zip.file("icon128.png", iconBlob);

      const zipContent = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipContent);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = 'LinkKeeperExtension.zip';
      a.click();
      URL.revokeObjectURL(zipUrl);
    } catch (err) {
      console.error('Failed to generate extension ZIP:', err);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                1-Click Quick Saver Tools
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Save web pages instantly from any browser without opening LinkKeeper manually.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl my-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('bookmarklet')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'bookmarklet'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Drag-and-Drop Bookmarklet
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('extension')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'extension'
                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Chrome className="w-3.5 h-3.5" /> Chrome / Edge Extension
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 py-2">
          {activeTab === 'bookmarklet' ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center space-y-3">
                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  Drag the button below directly into your Browser's <strong>Bookmarks Bar (แถบบุ๊กมาร์ก)</strong>:
                </p>
                <div className="pt-1 pb-2">
                  <a
                    href={bookmarkletCode}
                    onClick={(e) => e.preventDefault()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-md cursor-grab active:cursor-grabbing transition-transform active:scale-95"
                    title="Drag to your browser bookmark bar"
                  >
                    <Bookmark className="w-4 h-4" /> ➕ Save to LinkKeeper
                  </a>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  💡 When browsing any website, just click this bookmark in your bookmark bar to automatically save the link!
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Or copy the Javascript snippet manually:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={bookmarkletCode}
                    className="flex-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-mono text-zinc-600 dark:text-zinc-400 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2.5">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Custom Chrome/Edge Web Extension Setup
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-600 dark:text-zinc-300 text-[11px] leading-relaxed">
                  <li>Click <strong>Download LinkKeeperExtension.zip</strong> below.</li>
                  <li>Extract (แตกไฟล์) the ZIP into a folder named <code>LinkKeeperExtension</code>.</li>
                  <li>Open <code>chrome://extensions</code> in Chrome or <code>edge://extensions</code> in Edge.</li>
                  <li>Turn ON <strong>Developer mode (โหมดนักพัฒนา)</strong> in the top right corner.</li>
                  <li>Click <strong>Load unpacked (โหลดส่วนขยายที่แยกไว้)</strong> and select the <code>LinkKeeperExtension</code> folder!</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={isGeneratingZip}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <FolderArchive className="w-4 h-4" />
                {isGeneratingZip ? 'Generating Zip Package...' : 'Download LinkKeeperExtension.zip'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

