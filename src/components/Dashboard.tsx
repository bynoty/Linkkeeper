/**
 * Dashboard.tsx - Main Dashboard Component for displaying Saved Links & Notes
 */

import React, { useState, useMemo } from 'react';
import { LinkItem } from '../types';
import { 
  Pin, 
  Star, 
  Copy, 
  ExternalLink, 
  Edit2, 
  Trash2, 
  Tag, 
  FileText, 
  Calendar, 
  Check, 
  X, 
  XCircle,
  FolderOpen,
  ListChecks,
  Download,
  FolderInput,
  Sparkles,
  ShieldAlert,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronDown,
  Globe,
  Router
} from 'lucide-react';
import { suggestCategoryFromUrl, checkForDuplicateLink } from '../lib/api';
import { VirtualItem } from './VirtualItem';

interface DashboardProps {
  links: LinkItem[];
  categories: string[];
  onSaveLink: (item: Partial<LinkItem>, isNew: boolean) => Promise<void>;
  onDeleteLink: (id: string) => Promise<void>;
  onBulkDeleteLinks: (ids: string[]) => Promise<void>;
  onBulkMoveLinks: (ids: string[], newCategory: string) => Promise<void>;
  onShowToast: (msg: string, type: 'success' | 'info' | 'warning' | 'error') => void;
  searchTerm: string;
  isLoading: boolean;
}

export default function Dashboard({
  links,
  categories,
  onSaveLink,
  onDeleteLink,
  onBulkDeleteLinks,
  onBulkMoveLinks,
  onShowToast,
  searchTerm,
  isLoading,
}: DashboardProps) {
  // State for active filters
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date-added' | 'alphabetical' | 'favorited'>('date-added');
  
  // State for Edit Modal
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<LinkItem>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSuggestedCategory, setEditSuggestedCategory] = useState<string | null>(null);
  const [editDuplicateMatch, setEditDuplicateMatch] = useState<LinkItem | null>(null);
  const [showEditDuplicateConfirm, setShowEditDuplicateConfirm] = useState(false);

  // State for Delete Confirmation Modal
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: string; title: string } | null>(null);

  // State for Bulk Actions mode
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [bulkMoveCategory, setBulkMoveCategory] = useState<string>('');
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Performance Optimization: Paginate list to avoid heavy DOM on mobile
  const [visibleCount, setVisibleCount] = useState(15);

  // View Mode: Grid (original) or List (mobile-friendly compact list inspired by user request)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('dashboard_view_mode');
    return (saved === 'grid' || saved === 'list') ? saved : 'grid';
  });
  const [expandedLinkIds, setExpandedLinkIds] = useState<string[]>([]);

  const toggleExpandLink = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedLinkIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Reset pagination limit when active filters change
  React.useEffect(() => {
    setVisibleCount(15);
  }, [searchTerm, selectedCategories, selectedTag, sortBy]);

  // Helper to check if string is URL
  const isUrl = (str: string): boolean => {
    try {
      const trimmed = str.trim();
      return trimmed.startsWith('http://') || trimmed.startsWith('https://') || /^[a-zA-Z0-9-.]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed);
    } catch (_) {
      return false;
    }
  };

  const getFullUrl = (str: string): string => {
    const trimmed = str.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  // Toggle Category Filter
  const handleCategoryClick = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedCategories([]);
    setSelectedTag(null);
  };

  // One-click Copy Functionality
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    onShowToast(`Copied ${label} to clipboard!`, 'success');
  };

  // Pin / Favorite Toggles
  const handleTogglePin = async (link: LinkItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onSaveLink({ ...link, Pinned: !link.Pinned }, false);
      onShowToast(link.Pinned ? 'Unpinned link' : 'Pinned link to top!', 'success');
    } catch (err) {
      onShowToast(`Failed to update pin: ${(err as Error).message}`, 'error');
    }
  };

  const handleToggleFavorite = async (link: LinkItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await onSaveLink({ ...link, Favorite: !link.Favorite }, false);
      onShowToast(link.Favorite ? 'Removed from Favorites' : 'Added to Favorites!', 'success');
    } catch (err) {
      onShowToast(`Failed to update favorite: ${(err as Error).message}`, 'error');
    }
  };

  // Delete Action
  const handleDelete = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmItem({ id, title });
  };

  const executeDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      await onDeleteLink(deleteConfirmItem.id);
      onShowToast('Link deleted successfully', 'success');
    } catch (err) {
      onShowToast(`Failed to delete: ${(err as Error).message}`, 'error');
    } finally {
      setDeleteConfirmItem(null);
    }
  };

  // Bulk Action Handlers
  const handleCardClick = (id: string) => {
    setSelectedLinkIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredLinks.map(l => l.ID);
    const allSelected = allFilteredIds.every(id => selectedLinkIds.includes(id));
    if (allSelected) {
      setSelectedLinkIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedLinkIds(prev => {
        const next = [...prev];
        allFilteredIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const escapeCSV = (str: string): string => {
    if (!str) return '';
    const clean = str.replace(/"/g, '""');
    return `"${clean}"`;
  };

  const handleExportSelectedCsv = () => {
    const selectedItems = links.filter(l => selectedLinkIds.includes(l.ID));
    if (selectedItems.length === 0) {
      onShowToast('No links selected for export', 'warning');
      return;
    }
    
    const headers = ['Title', 'Content', 'Category', 'Tags', 'Note', 'Favorite', 'Pinned', 'CreatedAt'];
    const csvRows = [headers.map(h => `"${h}"`).join(',')];
    
    selectedItems.forEach(item => {
      const row = [
        escapeCSV(item.Title),
        escapeCSV(item.Content),
        escapeCSV(item.Category),
        escapeCSV(item.Tags || ''),
        escapeCSV(item.Note || ''),
        escapeCSV(item.Favorite ? 'TRUE' : 'FALSE'),
        escapeCSV(item.Pinned ? 'TRUE' : 'FALSE'),
        escapeCSV(item.CreatedAt)
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = "\uFEFF" + csvRows.join('\n'); // Add BOM for Excel UTF-8 support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `saved_links_bulk_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    onShowToast(`Exported ${selectedItems.length} links to CSV successfully!`, 'success');
  };

  const handleBulkMoveSubmit = async () => {
    if (!bulkMoveCategory) {
      onShowToast('Please select a destination category', 'warning');
      return;
    }
    if (selectedLinkIds.length === 0) {
      onShowToast('No links selected to move', 'warning');
      return;
    }
    try {
      await onBulkMoveLinks(selectedLinkIds, bulkMoveCategory);
      setSelectedLinkIds([]);
      setIsBulkMode(false);
      setBulkMoveCategory('');
    } catch (err) {
      onShowToast(`Failed to move links: ${(err as Error).message}`, 'error');
    }
  };

  const handleBulkDeleteSubmit = async () => {
    if (selectedLinkIds.length === 0) {
      onShowToast('No links selected to delete', 'warning');
      return;
    }
    try {
      await onBulkDeleteLinks(selectedLinkIds);
      setSelectedLinkIds([]);
      setIsBulkMode(false);
      setShowBulkDeleteConfirm(false);
    } catch (err) {
      onShowToast(`Failed to delete links: ${(err as Error).message}`, 'error');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (link: LinkItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLink(link);
    setEditForm({ ...link });
    const suggestion = suggestCategoryFromUrl(link.Content, categories);
    setEditSuggestedCategory(suggestion);
    
    // Check for duplicates
    const match = checkForDuplicateLink(link.Content, links, link.ID);
    setEditDuplicateMatch(match);
    setShowEditDuplicateConfirm(false);
    
    setIsEditModalOpen(true);
  };

  // Submit Edit Form
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.Title?.trim()) {
      onShowToast('Title is required', 'warning');
      return;
    }
    
    // Intercept with a warning if the edited content is a duplicate
    const duplicate = checkForDuplicateLink(editForm.Content || '', links, editingLink?.ID);
    if (duplicate && !showEditDuplicateConfirm) {
      setEditDuplicateMatch(duplicate);
      onShowToast('Warning: This URL matches an existing saved link. Check the warning below.', 'warning');
      return;
    }

    setIsSavingEdit(true);
    try {
      await onSaveLink(editForm, false);
      setIsEditModalOpen(false);
      setEditingLink(null);
      setEditDuplicateMatch(null);
      setShowEditDuplicateConfirm(false);
      onShowToast('Updated successfully!', 'success');
    } catch (err) {
      onShowToast(`Failed to save: ${(err as Error).message}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Close Modals on Escape key
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditModalOpen) {
          setIsEditModalOpen(false);
          setEditingLink(null);
        }
        if (deleteConfirmItem) {
          setDeleteConfirmItem(null);
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isEditModalOpen, deleteConfirmItem]);

  // Extract all unique tags present across all links for filter sidebar/header list
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    links.forEach(l => {
      if (l.Tags) {
        l.Tags.split(',').forEach(t => {
          const trimmed = t.trim();
          if (trimmed) tagsSet.add(trimmed);
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, [links]);

  // Comprehensive Filtering Logic
  const filteredLinks = useMemo(() => {
    return links.filter(link => {
      // 1. Search Term Filter
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const titleMatch = link.Title.toLowerCase().includes(query);
        const contentMatch = link.Content.toLowerCase().includes(query);
        const noteMatch = link.Note.toLowerCase().includes(query);
        const categoryMatch = link.Category.toLowerCase().includes(query);
        const tagMatch = link.Tags.toLowerCase().includes(query);
        
        if (!titleMatch && !contentMatch && !noteMatch && !categoryMatch && !tagMatch) {
          return false;
        }
      }

      // 2. Categories Filter
      if (selectedCategories.length > 0) {
        if (!selectedCategories.includes(link.Category)) {
          return false;
        }
      }

      // 3. Tag Filter
      if (selectedTag) {
        const linkTags = link.Tags.split(',').map(t => t.trim().toLowerCase());
        if (!linkTags.includes(selectedTag.toLowerCase())) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Sort: Pinned first
      if (a.Pinned && !b.Pinned) return -1;
      if (!a.Pinned && b.Pinned) return 1;
      
      if (sortBy === 'alphabetical') {
        return a.Title.localeCompare(b.Title);
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
  }, [links, searchTerm, selectedCategories, selectedTag, sortBy]);

  return (
    <div className="space-y-6" id="dashboard-tab">
      
      {/* Category Filter Bar */}
      <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" />
            Categories
          </h3>
          {(selectedCategories.length > 0 || selectedTag) && (
            <button 
              onClick={handleResetFilters}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => {
            const isSelected = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                  isSelected 
                    ? 'bg-emerald-600 text-white shadow-xs scale-102' 
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Filter Tags */}
      {selectedTag && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Filtering by Tag:</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
            <Tag className="w-3 h-3" />
            {selectedTag}
            <button onClick={() => setSelectedTag(null)} className="hover:text-amber-500 transition-colors cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
      )}

      {/* Primary Content Area (Grid + Tag Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Tag Cloud on Desktop */}
        <div className="hidden lg:block lg:col-span-1 space-y-4">
          <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-xs h-fit sticky top-24">
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
              <Tag className="w-3.5 h-3.5" />
              Tag Cloud
            </h3>
            {allTags.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No tags defined yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(tag => {
                  const isSelected = selectedTag?.toLowerCase() === tag.toLowerCase();
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(isSelected ? null : tag)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 cursor-pointer ${
                        isSelected 
                          ? 'bg-amber-500 text-white shadow-xs' 
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Cards Grid */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Sorting Controls and Count */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/50 dark:bg-zinc-900/40 backdrop-blur-md px-4 py-3 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Showing <span className="font-semibold text-zinc-800 dark:text-zinc-200">{filteredLinks.length}</span> {filteredLinks.length === 1 ? 'item' : 'items'}
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Bulk Actions Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  setSelectedLinkIds([]);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                  isBulkMode 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                {isBulkMode ? 'Exit Bulk Actions' : 'Bulk Actions'}
              </button>

              <div className="flex items-center gap-2">
                <label htmlFor="dashboard-sort" className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  Sort by:
                </label>
                <select
                  id="dashboard-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date-added' | 'alphabetical' | 'favorited')}
                  className="text-xs font-medium bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="date-added">Date Added (Newest)</option>
                  <option value="alphabetical">Alphabetical (A-Z)</option>
                  <option value="favorited">Favorited First</option>
                </select>
              </div>

              {/* Category Filter Dropdown */}
              <div className="flex items-center gap-2">
                <label htmlFor="dashboard-category-filter" className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  Category:
                </label>
                <select
                  id="dashboard-category-filter"
                  value={selectedCategories.length === 0 ? '' : selectedCategories.length === 1 ? selectedCategories[0] : 'multiple'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setSelectedCategories([]);
                    } else if (val !== 'multiple') {
                      setSelectedCategories([val]);
                    }
                  }}
                  className="text-xs font-medium bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  {selectedCategories.length > 1 && (
                    <option value="multiple" disabled>Multiple ({selectedCategories.length})</option>
                  )}
                </select>
              </div>

              {/* Tag Filter Dropdown */}
              <div className="flex items-center gap-2">
                <label htmlFor="dashboard-tag-filter" className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                  Tag:
                </label>
                <select
                  id="dashboard-tag-filter"
                  value={selectedTag || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedTag(val === '' ? null : val);
                  }}
                  className="text-xs font-medium bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="">All Tags</option>
                  {allTags.map(tag => (
                    <option key={tag} value={tag}>#{tag}</option>
                  ))}
                </select>
              </div>

              {/* View Toggle (Grid / List) */}
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('grid');
                    localStorage.setItem('dashboard_view_mode', 'grid');
                  }}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                  title="Grid View (รูปแบบตาราง)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('list');
                    localStorage.setItem('dashboard_view_mode', 'list');
                  }}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                  }`}
                  title="List View (รูปแบบรายการ)"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Action Controls Bar */}
          {isBulkMode && (
            <div className="bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                  Selected <span className="font-bold text-sm underline">{selectedLinkIds.length}</span> items
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 rounded-lg text-[11px] font-medium text-zinc-600 dark:text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {filteredLinks.length > 0 && filteredLinks.every(l => selectedLinkIds.includes(l.ID)) ? (
                    <>
                      <X className="w-3 h-3 text-red-500 inline" /> Deselect All
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3 text-emerald-600 inline" /> Select All
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Export to CSV */}
                <button
                  type="button"
                  onClick={handleExportSelectedCsv}
                  disabled={selectedLinkIds.length === 0}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Export Selected to CSV"
                >
                  <Download className="w-3.5 h-3.5" /> CSV Export
                </button>

                {/* Move Category */}
                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-1 rounded-xl">
                  <select
                    value={bulkMoveCategory}
                    onChange={(e) => setBulkMoveCategory(e.target.value)}
                    disabled={selectedLinkIds.length === 0}
                    className="text-xs font-medium bg-transparent text-zinc-700 dark:text-zinc-300 border-0 focus:ring-0 focus:outline-hidden cursor-pointer px-2 py-0.5"
                  >
                    <option value="">Move to Category...</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleBulkMoveSubmit}
                    disabled={selectedLinkIds.length === 0 || !bulkMoveCategory}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <FolderInput className="w-3 h-3" /> Move
                  </button>
                </div>

                {/* Delete Selected */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedLinkIds.length === 0) return;
                    setShowBulkDeleteConfirm(true);
                  }}
                  disabled={selectedLinkIds.length === 0}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                </button>
              </div>
            </div>
          )}

          {/* Skeletons/Loading state */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(idx => (
                <div key={idx} className="bg-white/50 dark:bg-zinc-900/30 p-5 rounded-2xl border border-zinc-200/40 dark:border-zinc-800/40 animate-pulse space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="h-4 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-sm"></div>
                    <div className="h-4 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-sm"></div>
                  </div>
                  <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded-md"></div>
                  <div className="flex gap-2">
                    <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full"></div>
                    <div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLinks.length === 0 ? (
            /* Empty State */
            <div className="bg-white/60 dark:bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-zinc-200/50 dark:border-zinc-800/50 p-12 text-center shadow-xs">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400 dark:text-zinc-500">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">No records found</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs mx-auto">
                {links.length === 0 
                  ? "You haven't saved any links or notes yet. Click 'Quick Add' to get started!" 
                  : "No items match your active filters or search terms."}
              </p>
              {(selectedCategories.length > 0 || selectedTag || searchTerm) && (
                <button
                  onClick={handleResetFilters}
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-all duration-200"
                >
                  Clear Filters & Search
                </button>
              )}
            </div>
          ) : (
            /* Grid or List layout for Link Items */
            <div className="space-y-6">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredLinks.slice(0, visibleCount).map(link => {
                    const containsLink = isUrl(link.Content);
                    const isSelected = selectedLinkIds.includes(link.ID);
                    return (
                      <VirtualItem key={link.ID} estimatedHeight={185}>
                        <div 
                          onClick={() => {
                            if (isBulkMode) {
                              handleCardClick(link.ID);
                            }
                          }}
                          className={`group relative bg-white dark:bg-zinc-900 rounded-2xl border transition-all duration-300 flex flex-col justify-between overflow-hidden ${
                            isBulkMode ? 'cursor-pointer select-none' : ''
                          } ${
                            isSelected
                              ? 'ring-2 ring-emerald-500 border-emerald-500/50 dark:border-emerald-500 bg-emerald-50/5 dark:bg-emerald-950/5'
                              : link.Pinned 
                                ? 'border-emerald-500/50 dark:border-emerald-500/40 bg-linear-to-br from-emerald-50/10 to-transparent' 
                                : 'border-zinc-200/70 dark:border-zinc-800'
                          } hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700`}
                        >
                        {/* Bulk Selection Checkbox Overlay */}
                        {isBulkMode && (
                          <div className="absolute top-4 left-4 z-10">
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs border border-emerald-600 animate-in zoom-in-50 duration-150">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 group-hover:border-emerald-500 transition-colors" />
                            )}
                          </div>
                        )}
                        
                        {/* Header */}
                        <div className={`p-5 space-y-2 ${isBulkMode ? 'pl-12' : ''}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1 max-w-[80%] text-left">
                              <h4 className="font-semibold text-zinc-900 dark:text-white leading-tight break-words group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                {link.Title}
                              </h4>
                              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-sm">
                                {link.Category}
                              </span>
                            </div>
                            
                            {/* Action pins */}
                            {!isBulkMode && (
                              <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => handleTogglePin(link, e)}
                                  className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                                    link.Pinned ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                                  }`}
                                  title={link.Pinned ? 'Unpin' : 'Pin to top'}
                                >
                                  <Pin className={`w-4 h-4 ${link.Pinned ? 'fill-emerald-600 dark:fill-emerald-400' : ''}`} />
                                </button>
                                <button
                                  onClick={(e) => handleToggleFavorite(link, e)}
                                  className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                                    link.Favorite ? 'text-amber-500' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300'
                                  }`}
                                  title={link.Favorite ? 'Unfavorite' : 'Add to favorites'}
                                >
                                  <Star className={`w-4 h-4 ${link.Favorite ? 'fill-amber-500' : ''}`} />
                                </button>
                              </div>
                            )}
                          </div>
    
                          {/* Content Section (URL or Text Note) */}
                          <div className="pt-1.5">
                            {containsLink ? (
                              <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800/30">
                                <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate flex-1 block">
                                  {link.Content}
                                </span>
                                {!isBulkMode && (
                                  <div className="flex gap-1 shrink-0">
                                    <button 
                                      onClick={() => handleCopy(link.Content, 'URL')}
                                      className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-all cursor-pointer"
                                      title="Copy Link"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <a 
                                      href={getFullUrl(link.Content)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1 text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-zinc-700 rounded-md transition-all"
                                      title="Open Link"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-600 dark:text-zinc-300 font-mono whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/30 max-h-36 overflow-y-auto">
                                {link.Content}
                              </p>
                            )}
                          </div>
    
                          {/* Note / Description if exists */}
                          {link.Note && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic bg-amber-50/20 dark:bg-zinc-900 p-2 rounded-lg border border-amber-500/10 text-left">
                              {link.Note}
                            </p>
                          )}
    
                          {/* Tags display */}
                          {link.Tags && (
                            <div className="flex flex-wrap gap-1 pt-1.5">
                              {link.Tags.split(',').map(tag => {
                                const trimmed = tag.trim();
                                if (!trimmed) return null;
                                const isFilteringByThisTag = selectedTag?.toLowerCase() === trimmed.toLowerCase();
                                return (
                                  <button
                                    key={trimmed}
                                    disabled={isBulkMode}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTag(isFilteringByThisTag ? null : trimmed);
                                    }}
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                                      isBulkMode ? 'cursor-default' : 'cursor-pointer'
                                    } ${
                                      isFilteringByThisTag
                                        ? 'bg-amber-500 text-white border border-transparent'
                                        : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 border border-zinc-200/10'
                                    }`}
                                  >
                                    #{trimmed}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
    
                        {/* Footer Row */}
                        <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(link.CreatedAt).toLocaleDateString()}</span>
                          </div>
                          
                          {!isBulkMode ? (
                            <div className="flex items-center gap-2">
                              {/* Copy Content Button */}
                              <button
                                onClick={() => handleCopy(link.Content, 'Content')}
                                className="px-2 py-1 rounded-md text-[11px] font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Copy Full Content"
                              >
                                <Copy className="w-3.5 h-3.5" /> Copy
                              </button>
    
                              {/* Edit Button */}
                              <button
                                onClick={(e) => handleOpenEdit(link, e)}
                                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all cursor-pointer"
                                title="Edit Card"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
    
                              {/* Delete Button */}
                              <button
                                onClick={(e) => handleDelete(link.ID, link.Title, e)}
                                className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-all cursor-pointer"
                                title="Delete Card"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className={`text-[10px] font-bold ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                              {isSelected ? '✓ SELECTED' : 'CLICK TO SELECT'}
                            </div>
                          )}
                        </div>
    
                      </div>
                      </VirtualItem>
                    );
                  })}
                </div>
              ) : (
                /* Compact List View inspired by Google Password Manager & User's Screenshot */
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 divide-y divide-zinc-100 dark:divide-zinc-800/80 overflow-hidden shadow-xs">
                  {filteredLinks.slice(0, visibleCount).map(link => {
                    const containsLink = isUrl(link.Content);
                    const isSelected = selectedLinkIds.includes(link.ID);
                    const isExpanded = expandedLinkIds.includes(link.ID);
                    
                    // Custom Icon Strategy (IP/Router gets Router, Web URL gets Globe, Notes gets FileText)
                    let RowIcon = Globe;
                    if (!containsLink) {
                      RowIcon = FileText;
                    } else if (link.Content.includes('192.168.') || link.Content.includes('10.') || link.Content.includes('127.0.0.1')) {
                      RowIcon = Router;
                    }

                    return (
                      <VirtualItem key={link.ID} estimatedHeight={72}>
                        <div 
                          onClick={() => {
                            if (isBulkMode) {
                              handleCardClick(link.ID);
                            } else {
                              setExpandedLinkIds(prev => 
                                prev.includes(link.ID) ? prev.filter(id => id !== link.ID) : [...prev, link.ID]
                              );
                            }
                          }}
                          className={`group flex flex-col transition-all duration-150 ${
                            isBulkMode ? 'cursor-pointer select-none' : 'cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20'
                          } ${
                            isSelected ? 'bg-emerald-50/10 dark:bg-emerald-950/5' : ''
                          }`}
                        >
                        {/* Main clickable row */}
                        <div className="flex items-center justify-between px-4 py-3.5 gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Checkbox overlay or Icon */}
                            {isBulkMode ? (
                              <div className="shrink-0">
                                {isSelected ? (
                                  <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs border border-emerald-600">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 group-hover:border-emerald-500 transition-colors" />
                                )}
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
                                <RowIcon className="w-5 h-5" />
                              </div>
                            )}

                            {/* Title & Content Preview */}
                            <div className="min-w-0 flex-1 text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-sm truncate">
                                  {link.Title}
                                </span>
                                {link.Pinned && (
                                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                    <Pin className="w-2.5 h-2.5 fill-emerald-600 dark:fill-emerald-400" /> ปักหมุด
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 truncate block mt-0.5">
                                {link.Content}
                              </span>
                            </div>
                          </div>

                          {/* Category Badge & Expand Chevron */}
                          <div className="flex items-center gap-2 shrink-0">
                            {!isBulkMode && (
                              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">
                                {link.Category}
                              </span>
                            )}
                            
                            {!isBulkMode && link.Favorite && (
                              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            )}

                            {!isBulkMode && (
                              <div className="text-zinc-400 dark:text-zinc-500 p-1 rounded-full group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 transition-transform" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 transition-transform" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Details Panel */}
                        {isExpanded && !isBulkMode && (
                          <div 
                            className="px-4 pb-4 pt-1 border-t border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/30 dark:bg-zinc-900/40 space-y-3 animate-in fade-in duration-200 text-left"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">เนื้อหาทั้งหมด / คอนเทนต์:</span>
                              <div className="flex items-center gap-2 bg-white dark:bg-zinc-800 p-2.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-2xs">
                                <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 break-all flex-1">
                                  {link.Content}
                                </span>
                                <div className="flex gap-1 shrink-0">
                                  <button 
                                    onClick={() => handleCopy(link.Content, 'Content')}
                                    className="p-1.5 text-zinc-500 hover:text-emerald-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-all cursor-pointer"
                                    title="คัดลอกทั้งหมด"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  {containsLink && (
                                    <a 
                                      href={getFullUrl(link.Content)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="p-1.5 text-zinc-500 hover:text-emerald-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-all flex items-center justify-center"
                                      title="เปิดลิงก์"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>

                            {link.Note && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">บันทึกเพิ่มเติม:</span>
                                <p className="text-xs text-zinc-600 dark:text-zinc-300 bg-amber-50/10 dark:bg-zinc-800/30 p-2.5 rounded-xl border border-amber-500/10 italic">
                                  {link.Note}
                                </p>
                              </div>
                            )}

                            {link.Tags && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">แท็ก:</span>
                                <div className="flex flex-wrap gap-1">
                                  {link.Tags.split(',').map(tag => {
                                    const trimmed = tag.trim();
                                    if (!trimmed) return null;
                                    const isFilteringByThisTag = selectedTag?.toLowerCase() === trimmed.toLowerCase();
                                    return (
                                      <button
                                        key={trimmed}
                                        onClick={() => setSelectedTag(isFilteringByThisTag ? null : trimmed)}
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                                          isFilteringByThisTag
                                            ? 'bg-amber-500 text-white border border-transparent'
                                            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 border border-zinc-200/10'
                                        }`}
                                      >
                                        #{trimmed}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-[11px] text-zinc-400">
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>สร้างเมื่อ: {new Date(link.CreatedAt).toLocaleDateString()}</span>
                                </span>
                                <span className="inline-block sm:hidden px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-sm font-semibold uppercase text-[9px]">
                                  {link.Category}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={(e) => handleTogglePin(link, e)}
                                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-center ${
                                    link.Pinned 
                                      ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                      : 'bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                                  }`}
                                  title={link.Pinned ? 'ยกเลิกการปักหมุด' : 'ปักหมุด'}
                                >
                                  <Pin className={`w-3.5 h-3.5 ${link.Pinned ? 'fill-emerald-600 dark:fill-emerald-400' : ''}`} />
                                </button>

                                <button
                                  onClick={(e) => handleToggleFavorite(link, e)}
                                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-center ${
                                    link.Favorite 
                                      ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-500 border-amber-500/20' 
                                      : 'bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-amber-500'
                                  }`}
                                  title={link.Favorite ? 'ยกเลิกรายการโปรด' : 'เพิ่มในรายการโปรด'}
                                >
                                  <Star className={`w-3.5 h-3.5 ${link.Favorite ? 'fill-amber-500' : ''}`} />
                                </button>

                                <button
                                  onClick={(e) => handleOpenEdit(link, e)}
                                  className="px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer text-xs"
                                >
                                  <Edit2 className="w-3 h-3" /> แก้ไข
                                </button>

                                <button
                                  onClick={(e) => handleDelete(link.ID, link.Title, e)}
                                  className="px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/20 border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-500 rounded-lg font-medium transition-all flex items-center gap-1 cursor-pointer text-xs"
                                >
                                  <Trash2 className="w-3 h-3" /> ลบ
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      </VirtualItem>
                    );
                  })}
                </div>
              )}

              {/* Show more button if there are more links */}
              {filteredLinks.length > visibleCount && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount(prev => prev + 15)}
                    className="px-6 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                  >
                    แสดงเพิ่มเติม ({filteredLinks.length - visibleCount} รายการ)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modern Pop-up Edit Modal */}
      {isEditModalOpen && editingLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-800 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                Edit Link / Note
              </h3>
              <button 
                onClick={() => { setIsEditModalOpen(false); setEditingLink(null); }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.Title || ''}
                  onChange={e => setEditForm({ ...editForm, Title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                />
              </div>

              {/* Content / URL */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Content / Link / Note Text *
                </label>
                <textarea
                  required
                  rows={3}
                  value={editForm.Content || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setEditForm({ ...editForm, Content: val });
                    const suggestion = suggestCategoryFromUrl(val, categories);
                    setEditSuggestedCategory(suggestion);
                    
                    // Check duplicate
                    const match = checkForDuplicateLink(val, links, editingLink?.ID);
                    setEditDuplicateMatch(match);
                    setShowEditDuplicateConfirm(false);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono dark:text-white"
                  placeholder="https://... or raw markdown notes"
                />

                {editDuplicateMatch && (
                  <div className="mt-2 p-3 bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>Duplicate Link Detected</span>
                    </div>
                    <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      This exact link/URL already exists in your list as <strong className="font-semibold text-zinc-800 dark:text-zinc-200">"{editDuplicateMatch.Title}"</strong> (Category: <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{editDuplicateMatch.Category}</strong>).
                    </p>
                    {!showEditDuplicateConfirm ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditDuplicateConfirm(true);
                          onShowToast('Warning bypassed. You can now click "Save Changes".', 'info');
                        }}
                        className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-md font-bold cursor-pointer transition-colors"
                      >
                        Ignore & Allow Duplicate
                      </button>
                    ) : (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/5 dark:bg-emerald-950/20 px-2.5 py-1 rounded-md border border-emerald-500/10 w-fit">
                        <Check className="w-3 h-3 stroke-[3]" /> Warning bypassed. Click Save Changes to proceed.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Category
                </label>
                <select
                  value={editForm.Category || 'General'}
                  onChange={e => setEditForm({ ...editForm, Category: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                >
                  <option value="General">General</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  {editSuggestedCategory && !categories.includes(editSuggestedCategory) && editSuggestedCategory !== 'General' && (
                    <option value={editSuggestedCategory}>{editSuggestedCategory} (Suggested)</option>
                  )}
                </select>

                {editSuggestedCategory && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/5 dark:bg-amber-950/20 px-2.5 py-1.5 rounded-xl border border-amber-500/20">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
                    <span className="truncate">Suggested: <strong className="font-semibold">{editSuggestedCategory}</strong></span>
                    {editForm.Category !== editSuggestedCategory ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditForm({ ...editForm, Category: editSuggestedCategory });
                          onShowToast(`Category updated to ${editSuggestedCategory}`, 'success');
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

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={editForm.Tags || ''}
                  onChange={e => setEditForm({ ...editForm, Tags: e.target.value })}
                  placeholder="AI,Python,Google"
                  className="w-full px-3 py-2 rounded-xl text-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                />
              </div>

              {/* Note / Description */}
              <div>
                <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Additional Note / Reminders (Optional)
                </label>
                <input
                  type="text"
                  value={editForm.Note || ''}
                  onChange={e => setEditForm({ ...editForm, Note: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                  placeholder="e.g. valid until end of month"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingLink(null); }}
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
                  Delete Item
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Are you sure you want to delete <strong className="text-zinc-800 dark:text-zinc-200">"{deleteConfirmItem.title}"</strong>? This action cannot be undone.
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

      {/* Custom Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-sm shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-950/40 rounded-full flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-zinc-900 dark:text-white text-base">
                  Delete Multiple Items
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Are you sure you want to delete <strong className="text-red-600 dark:text-red-400">{selectedLinkIds.length}</strong> selected items? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteSubmit}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl cursor-pointer transition-colors shadow-xs"
                >
                  Delete Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
