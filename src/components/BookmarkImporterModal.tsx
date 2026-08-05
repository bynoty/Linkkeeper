import React, { useState, useRef } from 'react';
import { X, Upload, Bookmark, CheckCircle2, AlertCircle, FileCode, FolderInput, ArrowRight } from 'lucide-react';
import { LinkItem } from '../types';

interface BookmarkImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingLinks: LinkItem[];
  categories: string[];
  onImportLinks: (newLinks: Omit<LinkItem, 'ID' | 'CreatedAt' | 'UpdatedAt'>[]) => void;
}

interface ParsedBookmark {
  title: string;
  url: string;
  category: string;
  tags: string[];
  isDuplicate: boolean;
  selected: boolean;
}

export const BookmarkImporterModal: React.FC<BookmarkImporterModalProps> = ({
  isOpen,
  onClose,
  existingLinks,
  categories,
  onImportLinks,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedBookmark[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const parseHTMLBookmarks = (htmlText: string): ParsedBookmark[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const anchors = Array.from(doc.querySelectorAll('a'));
    
    const existingUrlSet = new Set(existingLinks.map(l => l.Content.toLowerCase().trim()));

    return anchors.map(a => {
      const url = a.getAttribute('href') || '';
      const title = a.textContent?.trim() || url;
      
      // Attempt to deduce folder category from parent DL/H3 element
      let category = 'Reference';
      let parent: HTMLElement | null = a.parentElement;
      while (parent && parent !== doc.body) {
        if (parent.tagName === 'DL') {
          const prevH3 = parent.previousElementSibling;
          if (prevH3 && prevH3.tagName === 'H3') {
            const h3Text = prevH3.textContent?.trim() || '';
            if (h3Text && h3Text !== 'Bookmarks Bar' && h3Text !== 'Other Bookmarks') {
              category = h3Text;
              break;
            }
          }
        }
        parent = parent.parentElement;
      }

      // Check if duplicate
      const normUrl = url.toLowerCase().trim();
      const isDuplicate = existingUrlSet.has(normUrl);

      return {
        title,
        url,
        category,
        tags: ['Imported'],
        isDuplicate,
        selected: !isDuplicate && Boolean(url && url.startsWith('http')),
      };
    }).filter(item => item.url && item.url.startsWith('http'));
  };

  const parseJSONBookmarks = (jsonText: string): ParsedBookmark[] => {
    try {
      const data = JSON.parse(jsonText);
      const items: ParsedBookmark[] = [];
      const existingUrlSet = new Set(existingLinks.map(l => l.Content.toLowerCase().trim()));

      const extract = (node: any, currentCategory: string) => {
        if (!node) return;
        if (Array.isArray(node)) {
          node.forEach(child => extract(child, currentCategory));
          return;
        }
        if (node.url || node.Content) {
          const url = node.url || node.Content || '';
          const title = node.title || node.Title || url;
          const cat = node.category || node.Category || currentCategory || 'Reference';
          const isDuplicate = existingUrlSet.has(url.toLowerCase().trim());
          if (url && url.startsWith('http')) {
            items.push({
              title,
              url,
              category: cat,
              tags: Array.isArray(node.tags) ? node.tags : ['Imported'],
              isDuplicate,
              selected: !isDuplicate,
            });
          }
        } else if (node.children) {
          const folderName = node.name || currentCategory;
          extract(node.children, folderName);
        }
      };

      extract(data, 'Reference');
      return items;
    } catch (e) {
      console.error('Failed to parse JSON bookmarks', e);
      return [];
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      let items: ParsedBookmark[] = [];
      if (file.name.endsWith('.json')) {
        items = parseJSONBookmarks(text);
      } else {
        items = parseHTMLBookmarks(text);
      }

      setParsedItems(items);
      setSelectedCount(items.filter(i => i.selected).length);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const toggleSelect = (index: number) => {
    const updated = [...parsedItems];
    updated[index].selected = !updated[index].selected;
    setParsedItems(updated);
    setSelectedCount(updated.filter(i => i.selected).length);
  };

  const toggleSelectAll = (select: boolean) => {
    const updated = parsedItems.map(item => ({ ...item, selected: select }));
    setParsedItems(updated);
    setSelectedCount(select ? updated.length : 0);
  };

  const handleConfirmImport = () => {
    const toImport = parsedItems
      .filter(i => i.selected)
      .map(i => ({
        Title: i.title,
        Content: i.url,
        Category: i.category,
        Tags: i.tags.join(', '),
        Note: `Imported from ${fileName || 'Browser Bookmarks'}`,
        Favorite: false,
        Pinned: false,
      }));

    if (toImport.length > 0) {
      onImportLinks(toImport);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FolderInput className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Import Browser Bookmarks
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Supports Netscape HTML files (.html) exported from Chrome, Safari, Firefox, Edge, or LinkKeeper JSON.
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

        {/* Content Body */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          {parsedItems.length === 0 ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
                Drag & Drop HTML / JSON Bookmarks file here
              </p>
              <p className="text-xs text-zinc-400 mb-4">or click to browse your files</p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-medium rounded-lg">
                <FileCode className="w-3.5 h-3.5" /> `.html`, `.htm`, or `.json`
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Toolbar */}
              <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  File: <strong className="text-zinc-900 dark:text-zinc-100">{fileName}</strong> ({parsedItems.length} links found)
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="text-emerald-600 hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-zinc-300 dark:text-zinc-700">|</span>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="text-zinc-500 hover:underline"
                  >
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={() => { setParsedItems([]); setFileName(null); }}
                    className="ml-2 text-xs text-red-500 hover:underline"
                  >
                    Change File
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {parsedItems.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleSelect(idx)}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                      item.selected
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-zinc-50/50 dark:bg-zinc-800/30 border-zinc-200/50 dark:border-zinc-800/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleSelect(idx)}
                        className="rounded-md border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono truncate">
                          {item.url}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] rounded-md font-medium">
                        {item.category}
                      </span>
                      {item.isDuplicate && (
                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] rounded-md font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Existing
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {parsedItems.length > 0 ? `${selectedCount} items selected for import` : 'Ready for upload'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            {parsedItems.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={selectedCount === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Import {selectedCount} Links
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
