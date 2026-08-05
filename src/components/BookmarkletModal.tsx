import React, { useState } from 'react';
import { X, Bookmark, Download, Copy, Check, Sparkles, ExternalLink, ShieldCheck, Chrome } from 'lucide-react';

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

  const handleDownloadExtensionFiles = () => {
    const manifest = {
      manifest_version: 3,
      name: "LinkKeeper - Quick Link Saver",
      version: "1.0.0",
      description: "Save any web page directly to your LinkKeeper Knowledge Base in 1-click.",
      permissions: ["activeTab", "contextMenus"],
      action: {
        default_title: "Save to LinkKeeper",
        default_popup: "popup.html"
      },
      icons: {
        "128": "https://img.icons8.com/fluency/192/safe-key.png"
      }
    };

    const popupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; width: 320px; padding: 16px; margin: 0; background: #09090b; color: #f4f4f5; }
    h3 { font-size: 14px; margin: 0 0 8px; color: #10b981; display: flex; align-items: center; gap: 6px; }
    button { width: 100%; padding: 10px; background: #059669; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
    button:hover { background: #10b981; }
  </style>
</head>
<body>
  <h3>🔑 LinkKeeper Quick Save</h3>
  <p style="font-size: 12px; color: #a1a1aa; margin-bottom: 12px;">Save the current active tab to your LinkKeeper dashboard.</p>
  <button id="saveBtn">Save Current Webpage</button>
  <script>
    document.getElementById('saveBtn').addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          const u = encodeURIComponent(tabs[0].url);
          const t = encodeURIComponent(tabs[0].title);
          window.open('${currentOrigin}/?add_url=' + u + '&add_title=' + t, '_blank');
        }
      });
    });
  </script>
</body>
</html>`;

    // Trigger download of Manifest JSON
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manifest.json';
    a.click();
    URL.revokeObjectURL(url);

    // Trigger download of Popup HTML
    const blobHtml = new Blob([popupHtml], { type: 'text/html' });
    const urlHtml = URL.createObjectURL(blobHtml);
    const aHtml = document.createElement('a');
    aHtml.href = urlHtml;
    aHtml.download = 'popup.html';
    aHtml.click();
    URL.revokeObjectURL(urlHtml);
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
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl my-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('bookmarklet')}
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
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
            className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
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
                  Drag the button below directly into your Browser's <strong>Bookmarks Bar</strong>:
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
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Custom Chrome/Edge Web Extension
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-zinc-600 dark:text-zinc-300 text-[11px]">
                  <li>Click <strong>Download Extension Files</strong> below to get `manifest.json` & `popup.html`.</li>
                  <li>Put both files into a new folder named `LinkKeeperExtension`.</li>
                  <li>Open <code>chrome://extensions</code> in your Chrome or Edge browser.</li>
                  <li>Enable <strong>Developer mode</strong> in the top right corner.</li>
                  <li>Click <strong>Load unpacked</strong> and select your `LinkKeeperExtension` folder!</li>
                </ol>
              </div>

              <button
                type="button"
                onClick={handleDownloadExtensionFiles}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Download Chrome Extension Files
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
