/**
 * types.ts - Shared TypeScript interfaces and types
 */

export interface LinkItem {
  ID: string;
  Title: string;
  Content: string;
  Category: string;
  Tags: string; // Comma-separated tags
  Note: string;
  Favorite: boolean;
  Pinned: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface VaultItem {
  ID: string;
  Service: string;
  Username: string;
  Password: string; // AES ciphertext encrypted client-side
  Note: string;
  Favorite: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface AppSettings {
  webAppUrl: string;
  apiToken: string;
  categories: string[];
  theme: 'light' | 'dark';
  syncOnLoad: boolean;
  masterPasswordHash?: string; // Optional client-side verification
  googleSyncEnabled?: boolean; // Whether direct Google Sheets sync via OAuth is enabled
  googleSpreadsheetId?: string; // Spreadsheet ID in Google Drive
  autoLockEnabled?: boolean; // Whether vault auto-locks on inactivity
  autoLockTimeout?: number; // Timeout in minutes (e.g. 5, 15)
}

export type ActiveTab = 'dashboard' | 'vault' | 'quick-add' | 'settings';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
}
