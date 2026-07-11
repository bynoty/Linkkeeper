/**
 * api.ts - Data Sync and Local Storage Abstraction Layer
 */

import { LinkItem, VaultItem, AppSettings } from '../types';

// Local storage keys
const STORAGE_KEYS = {
  LINKS: 'link_keeper_links',
  VAULT: 'link_keeper_vault',
  SETTINGS: 'link_keeper_settings',
};

// Initial default settings
export const DEFAULT_SETTINGS: AppSettings = {
  webAppUrl: '',
  apiToken: '',
  categories: ['Work', 'Personal', 'Education', 'Reference', 'Finance', 'Social', 'Entertainment'],
  theme: 'light',
  syncOnLoad: false,
  googleSyncEnabled: false,
  googleSpreadsheetId: '',
};

/**
 * Load settings from LocalStorage
 */
export function loadSettings(): AppSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (data) {
      const parsed = JSON.parse(data);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to LocalStorage
 */
export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

/**
 * Helper to build the Web App URL with action and optional token
 */
function buildUrl(webAppUrl: string, action: string, token?: string, extraParams: Record<string, string> = {}): string {
  let url = `${webAppUrl}?action=${encodeURIComponent(action)}`;
  if (token) {
    url += `&token=${encodeURIComponent(token)}`;
  }
  Object.entries(extraParams).forEach(([key, val]) => {
    url += `&${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
  });
  return url;
}

/**
 * Make a secure simple POST request to Google Apps Script (bypassing CORS preflight)
 */
async function postToGas(webAppUrl: string, action: string, data: any, token?: string): Promise<any> {
  const url = webAppUrl; // POST handles action inside body or URL
  const payload = {
    action,
    token, // pre-shared API secret
    data,
  };

  // We use Content-Type: "text/plain" to bypass CORS preflight OPTIONS check.
  // Google Apps Script reads the text body, parses as JSON, and returns CORS headers.
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'Operation failed on Google Sheets');
  }

  return result;
}

// ==========================================
// LINKS API
// ==========================================

/**
 * Fetch all links (From Sheets if URL exists, fallback to LocalStorage)
 */
export async function getLinks(settings: AppSettings): Promise<LinkItem[]> {
  if (settings.webAppUrl) {
    try {
      const url = buildUrl(settings.webAppUrl, 'getLinks', settings.apiToken);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        // Cache locally for offline view
        localStorage.setItem(STORAGE_KEYS.LINKS, JSON.stringify(json.data));
        return json.data;
      } else {
        throw new Error(json.error || 'Failed to fetch from Google Sheets');
      }
    } catch (err) {
      console.warn('Google Sheets sync failed, loading cached local links instead:', err);
      // Fallback to local cache on network error
    }
  }

  // Local storage fallback
  const localData = localStorage.getItem(STORAGE_KEYS.LINKS);
  return localData ? JSON.parse(localData) : [];
}

/**
 * Save a Link (Add or Update)
 */
export async function saveLink(settings: AppSettings, item: Partial<LinkItem>, isNew: boolean): Promise<LinkItem> {
  let savedItem: LinkItem;

  if (isNew) {
    savedItem = {
      ID: item.ID || Math.random().toString(36).substring(2, 11),
      Title: item.Title || 'Untitled Link',
      Content: item.Content || '',
      Category: item.Category || 'General',
      Tags: item.Tags || '',
      Note: item.Note || '',
      Favorite: !!item.Favorite,
      Pinned: !!item.Pinned,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };
  } else {
    if (!item.ID) throw new Error('Cannot update link without ID');
    savedItem = {
      ...(item as LinkItem),
      UpdatedAt: new Date().toISOString(),
    };
  }

  // 1. Sync to Google Sheets if configured
  if (settings.webAppUrl) {
    try {
      const action = isNew ? 'addLink' : 'updateLink';
      const result = await postToGas(settings.webAppUrl, action, savedItem, settings.apiToken);
      if (result.success && result.data) {
        savedItem = result.data; // Use the server's timestamps/UUID if available
      }
    } catch (err) {
      console.error('Google Sheets link save failed:', err);
      throw new Error(`Google Sheets save failed: ${(err as Error).message}. (Local state not updated)`);
    }
  }

  // 2. Update local state cache
  const localData = localStorage.getItem(STORAGE_KEYS.LINKS);
  let links: LinkItem[] = localData ? JSON.parse(localData) : [];

  if (isNew) {
    links.unshift(savedItem);
  } else {
    links = links.map(l => (l.ID === savedItem.ID ? savedItem : l));
  }

  localStorage.setItem(STORAGE_KEYS.LINKS, JSON.stringify(links));
  return savedItem;
}

/**
 * Delete a Link
 */
export async function deleteLink(settings: AppSettings, id: string): Promise<void> {
  if (settings.webAppUrl) {
    try {
      await postToGas(settings.webAppUrl, 'deleteLink', { ID: id }, settings.apiToken);
    } catch (err) {
      console.error('Google Sheets link deletion failed:', err);
      throw new Error(`Google Sheets delete failed: ${(err as Error).message}. (Local state not updated)`);
    }
  }

  // Update local state cache
  const localData = localStorage.getItem(STORAGE_KEYS.LINKS);
  if (localData) {
    const links: LinkItem[] = JSON.parse(localData);
    const filtered = links.filter(l => l.ID !== id);
    localStorage.setItem(STORAGE_KEYS.LINKS, JSON.stringify(filtered));
  }
}

// ==========================================
// VAULT API
// ==========================================

/**
 * Fetch all Vault items (From Sheets if URL exists, fallback to LocalStorage)
 * Note: Returned passwords are encrypted ciphertexts! Decryption happens client-side.
 */
export async function getVault(settings: AppSettings): Promise<VaultItem[]> {
  if (settings.webAppUrl) {
    try {
      const url = buildUrl(settings.webAppUrl, 'getVault', settings.apiToken);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        // Cache locally for offline view
        localStorage.setItem(STORAGE_KEYS.VAULT, JSON.stringify(json.data));
        return json.data;
      } else {
        throw new Error(json.error || 'Failed to fetch from Google Sheets');
      }
    } catch (err) {
      console.warn('Google Sheets sync failed, loading cached local credentials instead:', err);
    }
  }

  // Local storage fallback
  const localData = localStorage.getItem(STORAGE_KEYS.VAULT);
  return localData ? JSON.parse(localData) : [];
}

/**
 * Save a Vault credential (Add or Update)
 * Note: Password MUST already be encrypted client-side!
 */
export async function saveVault(settings: AppSettings, item: Partial<VaultItem>, isNew: boolean): Promise<VaultItem> {
  let savedItem: VaultItem;

  if (isNew) {
    savedItem = {
      ID: item.ID || Math.random().toString(36).substring(2, 11),
      Service: item.Service || 'Unknown Service',
      Username: item.Username || '',
      Password: item.Password || '', // Must be encrypted ciphertext!
      Note: item.Note || '',
      Favorite: !!item.Favorite,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    };
  } else {
    if (!item.ID) throw new Error('Cannot update credential without ID');
    savedItem = {
      ...(item as VaultItem),
      UpdatedAt: new Date().toISOString(),
    };
  }

  // 1. Sync to Google Sheets if configured
  if (settings.webAppUrl) {
    try {
      const action = isNew ? 'addVault' : 'updateVault';
      const result = await postToGas(settings.webAppUrl, action, savedItem, settings.apiToken);
      if (result.success && result.data) {
        savedItem = result.data;
      }
    } catch (err) {
      console.error('Google Sheets vault save failed:', err);
      throw new Error(`Google Sheets save failed: ${(err as Error).message}. (Local state not updated)`);
    }
  }

  // 2. Update local state cache
  const localData = localStorage.getItem(STORAGE_KEYS.VAULT);
  let credentials: VaultItem[] = localData ? JSON.parse(localData) : [];

  if (isNew) {
    credentials.unshift(savedItem);
  } else {
    credentials = credentials.map(c => (c.ID === savedItem.ID ? savedItem : c));
  }

  localStorage.setItem(STORAGE_KEYS.VAULT, JSON.stringify(credentials));
  return savedItem;
}

/**
 * Delete a Vault credential
 */
export async function deleteVault(settings: AppSettings, id: string): Promise<void> {
  if (settings.webAppUrl) {
    try {
      await postToGas(settings.webAppUrl, 'deleteVault', { ID: id }, settings.apiToken);
    } catch (err) {
      console.error('Google Sheets vault deletion failed:', err);
      throw new Error(`Google Sheets delete failed: ${(err as Error).message}. (Local state not updated)`);
    }
  }

  // Update local state cache
  const localData = localStorage.getItem(STORAGE_KEYS.VAULT);
  if (localData) {
    const credentials: VaultItem[] = JSON.parse(localData);
    const filtered = credentials.filter(c => c.ID !== id);
    localStorage.setItem(STORAGE_KEYS.VAULT, JSON.stringify(filtered));
  }
}

/**
 * Backups: Export all data (Settings, Links, Vault) as a complete JSON payload
 */
export function exportBackup(settings: AppSettings): string {
  const localLinks = localStorage.getItem(STORAGE_KEYS.LINKS);
  const localVault = localStorage.getItem(STORAGE_KEYS.VAULT);

  const backupData = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    settings: {
      ...settings,
      webAppUrl: settings.webAppUrl, // preserve config
      apiToken: settings.apiToken,
    },
    links: localLinks ? JSON.parse(localLinks) : [],
    vault: localVault ? JSON.parse(localVault) : [],
  };

  return JSON.stringify(backupData, null, 2);
}

/**
 * Backups: Import JSON payload into LocalStorage and update configuration
 */
export function importBackup(backupJsonStr: string): { settings: AppSettings; linksCount: number; vaultCount: number } {
  try {
    const backup = JSON.parse(backupJsonStr);
    
    // Validation
    if (!backup.settings || !Array.isArray(backup.links) || !Array.isArray(backup.vault)) {
      throw new Error('Invalid backup file format. Must contain settings, links, and vault arrays.');
    }

    // Save to LocalStorage
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(backup.settings));
    localStorage.setItem(STORAGE_KEYS.LINKS, JSON.stringify(backup.links));
    localStorage.setItem(STORAGE_KEYS.VAULT, JSON.stringify(backup.vault));

    return {
      settings: backup.settings,
      linksCount: backup.links.length,
      vaultCount: backup.vault.length,
    };
  } catch (err) {
    throw new Error(`Failed to parse backup: ${(err as Error).message}`);
  }
}

/**
 * Clear Local Cache
 */
export function clearLocalCache(): void {
  localStorage.removeItem(STORAGE_KEYS.LINKS);
  localStorage.removeItem(STORAGE_KEYS.VAULT);
}

/**
 * Google Password Manager Row structure
 */
export interface GooglePasswordRow {
  name: string;
  url: string;
  username: string;
  password: string;
  note: string;
}

/**
 * Parses Google Passwords CSV file content.
 * Expected header: name,url,username,password,note
 */
export function parseGooglePasswordsCsv(csvText: string): GooglePasswordRow[] {
  const result: GooglePasswordRow[] = [];
  let currentLine = '';
  const lines: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\n' || (char === '\r' && csvText[i + 1] !== '\n')) {
        lines.push(currentLine);
        currentLine = '';
      }
    } else if (char === '\r' && inQuotes) {
      currentLine += char;
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  const cleanLines = lines.map(l => l.trim()).filter(l => l.length > 0);
  if (cleanLines.length <= 1) return [];

  const headers = parseCsvRow(cleanLines[0]);
  const nameIdx = headers.indexOf('name');
  const urlIdx = headers.indexOf('url');
  const usernameIdx = headers.indexOf('username');
  const passwordIdx = headers.indexOf('password');
  const noteIdx = headers.indexOf('note');

  if (nameIdx === -1 || usernameIdx === -1 || passwordIdx === -1) {
    throw new Error('CSV is missing required headers: "name", "username", and "password".');
  }

  for (let i = 1; i < cleanLines.length; i++) {
    const row = parseCsvRow(cleanLines[i]);
    if (row.length === 0) continue;

    const name = row[nameIdx] || '';
    const url = urlIdx !== -1 ? row[urlIdx] || '' : '';
    const username = usernameIdx !== -1 ? row[usernameIdx] || '' : '';
    const password = passwordIdx !== -1 ? row[passwordIdx] || '' : '';
    const note = noteIdx !== -1 ? row[noteIdx] || '' : '';

    result.push({ name, url, username, password, note });
  }

  return result;
}

function parseCsvRow(rowText: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < rowText.length; i++) {
    const char = rowText[i];
    if (char === '"') {
      if (inQuotes && rowText[i + 1] === '"') {
        field += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

/**
 * Direct sync helper to post a vault item to Google Sheets (bypassing local cache updates to prevent race conditions)
 */
export async function addVaultToSheets(settings: AppSettings, item: VaultItem): Promise<any> {
  if (!settings.webAppUrl) return null;
  return await postToGas(settings.webAppUrl, 'addVault', item, settings.apiToken);
}

/**
 * Raw CSV item structure
 */
export interface RawCsvVaultItem {
  Service: string;
  Username: string;
  Password: string;
  Note: string;
}

/**
 * Validates the CSV header row for 'Service', 'Username', and 'Password' columns
 * and parses the CSV safely into raw items.
 */
export function validateAndParseVaultCsv(csvText: string): RawCsvVaultItem[] {
  let currentLine = '';
  const lines: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\n' || (char === '\r' && csvText[i + 1] !== '\n')) {
        lines.push(currentLine);
        currentLine = '';
      }
    } else if (char === '\r' && inQuotes) {
      currentLine += char;
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  const cleanLines = lines.map(l => l.trim()).filter(l => l.length > 0);
  if (cleanLines.length === 0) {
    throw new Error('CSV file is empty.');
  }

  // Parse headers
  const headers = parseCsvRow(cleanLines[0]).map(h => h.trim());
  const headersLower = headers.map(h => h.toLowerCase());

  // Find index for 'Service' (prioritize 'Service', fallback to 'name')
  let serviceIdx = headers.indexOf('Service');
  if (serviceIdx === -1) serviceIdx = headersLower.indexOf('service');
  if (serviceIdx === -1) serviceIdx = headers.indexOf('name');
  if (serviceIdx === -1) serviceIdx = headersLower.indexOf('name');

  // Find index for 'Username' (prioritize 'Username', fallback to 'username')
  let usernameIdx = headers.indexOf('Username');
  if (usernameIdx === -1) usernameIdx = headersLower.indexOf('username');

  // Find index for 'Password' (prioritize 'Password', fallback to 'password')
  let passwordIdx = headers.indexOf('Password');
  if (passwordIdx === -1) passwordIdx = headersLower.indexOf('password');

  // Find index for 'Note' (prioritize 'Note', fallback to 'note' or 'notes')
  let noteIdx = headers.indexOf('Note');
  if (noteIdx === -1) noteIdx = headersLower.indexOf('note');
  if (noteIdx === -1) noteIdx = headers.indexOf('notes');
  if (noteIdx === -1) noteIdx = headersLower.indexOf('notes');

  // Explicit check for exact user-specified required columns 'Service', 'Username', and 'Password'
  const missingColumns: string[] = [];
  if (serviceIdx === -1) missingColumns.push('Service');
  if (usernameIdx === -1) missingColumns.push('Username');
  if (passwordIdx === -1) missingColumns.push('Password');

  if (missingColumns.length > 0) {
    throw new Error(`CSV is missing required columns: ${missingColumns.join(', ')}.`);
  }

  const result: RawCsvVaultItem[] = [];

  for (let i = 1; i < cleanLines.length; i++) {
    const row = parseCsvRow(cleanLines[i]);
    if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

    const service = row[serviceIdx] || '';
    const username = row[usernameIdx] || '';
    const password = row[passwordIdx] || '';
    let note = noteIdx !== -1 ? row[noteIdx] || '' : '';

    // If it's a Google CSV, append URL column value to notes
    const urlIdx = headersLower.indexOf('url');
    if (urlIdx !== -1 && row[urlIdx] && row[urlIdx] !== 'http://' && row[urlIdx] !== 'https://') {
      note = `URL: ${row[urlIdx]}${note ? `\nNote: ${note}` : ''}`;
    }

    result.push({
      Service: service,
      Username: username,
      Password: password,
      Note: note,
    });
  }

  return result;
}

