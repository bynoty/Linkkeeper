import { LinkItem, VaultItem } from '../types';

const SPREADSHEET_NAME = 'LinkKeeper Spreadsheet Database';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper to fetch Google API endpoints with automatic 429 rate-limit backoff retry.
 */
async function googleFetch(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let response = await fetch(url, options);

      // Handle Google API rate limit (429) or server busy (503) with exponential backoff delay
      if ((response.status === 429 || response.status === 503) && attempt < retries) {
        const waitMs = (attempt + 1) * 3000; // 3s, 6s, 9s
        console.warn(`Google API rate limit hit (Status ${response.status}). Retrying in ${waitMs}ms... (${attempt + 1}/${retries})`);
        await delay(waitMs);
        continue;
      }

      return response;
    } catch (directError) {
      if (attempt < retries) {
        const proxyUrl = `/api/google-proxy?url=${encodeURIComponent(url)}`;
        try {
          const proxyResponse = await fetch(proxyUrl, options);
          if ((proxyResponse.status === 429 || proxyResponse.status === 503) && attempt < retries) {
            await delay((attempt + 1) * 3000);
            continue;
          }
          if (proxyResponse.status !== 404) {
            return proxyResponse;
          }
        } catch (proxyError) {
          // ignore proxy error and loop retry
        }
      } else {
        throw directError;
      }
    }
  }
  return fetch(url, options);
}

/**
 * Helper to parse clean error message from response
 */
async function getCleanErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (text.includes('RESOURCE_EXHAUSTED') || text.includes('429') || text.includes('Quota exceeded')) {
      return 'Google Sheets API Rate Limit (Quota 429) - Google limits write operations to 60/min. The system will automatically retry shortly.';
    }
    if (text.startsWith('{')) {
      const parsed = JSON.parse(text);
      if (parsed.error?.message) {
        return parsed.error.message;
      }
    }
    return text.length > 200 ? text.slice(0, 200) + '...' : text;
  } catch (e) {
    return response.statusText || `HTTP ${response.status}`;
  }
}

/**
 * Find the spreadsheet in Google Drive by name.
 */
export async function findSpreadsheet(token: string): Promise<string | null> {
  const query = encodeURIComponent(`name = '${SPREADSHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

  const response = await googleFetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to search Google Drive: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

/**
 * Create a new spreadsheet in Google Drive.
 */
export async function createSpreadsheet(token: string): Promise<string> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  const body = {
    properties: {
      title: SPREADSHEET_NAME,
    },
    sheets: [
      {
        properties: {
          title: 'Links',
        },
      },
      {
        properties: {
          title: 'Vault',
        },
      },
    ],
  };

  const response = await googleFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create spreadsheet: ${errText}`);
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;

  // Set up the headers
  await initializeHeaders(token, spreadsheetId);

  return spreadsheetId;
}

/**
 * Check spreadsheet tabs and initialize headers if missing.
 */
export async function initializeSpreadsheetStructure(token: string, spreadsheetId: string): Promise<void> {
  // Get existing sheet tabs
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const response = await googleFetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet metadata: ${response.statusText}`);
  }

  const data = await response.json();
  const sheetTitles = data.sheets?.map((s: any) => s.properties.title) || [];

  const requests: any[] = [];
  if (!sheetTitles.includes('Links')) {
    requests.push({
      addSheet: {
        properties: { title: 'Links' },
      },
    });
  }
  if (!sheetTitles.includes('Vault')) {
    requests.push({
      addSheet: {
        properties: { title: 'Vault' },
      },
    });
  }

  if (requests.length > 0) {
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const updateResponse = await googleFetch(updateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    if (!updateResponse.ok) {
      throw new Error(`Failed to initialize spreadsheet tabs: ${updateResponse.statusText}`);
    }
  }

  // Write headers to ensure they are present
  await initializeHeaders(token, spreadsheetId);
}

/**
 * Write header rows to the spreadsheet.
 */
async function initializeHeaders(token: string, spreadsheetId: string): Promise<void> {
  const linksHeaders = [['ID', 'Title', 'Content', 'Category', 'Tags', 'Note', 'Favorite', 'Pinned', 'CreatedAt', 'UpdatedAt']];
  const vaultHeaders = [['ID', 'Service', 'Username', 'Password', 'Note', 'Favorite', 'CreatedAt', 'UpdatedAt']];

  await Promise.all([
    googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Links!A1:J1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: linksHeaders }),
    }),
    googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Vault!A1:H1?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: vaultHeaders }),
    })
  ]);
}

/**
 * Fetch links from Google Sheet.
 */
export async function fetchLinksFromSheet(token: string, spreadsheetId: string): Promise<LinkItem[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Links!A2:J`;
  const response = await googleFetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errText = await getCleanErrorMessage(response);
    throw new Error(`Failed to fetch links: Status ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const rows = data.values || [];

  return rows.map((row: any) => ({
    ID: row[0] || '',
    Title: row[1] || '',
    Content: row[2] || '',
    Category: row[3] || '',
    Tags: row[4] || '',
    Note: row[5] || '',
    Favorite: row[6] === 'TRUE' || row[6] === 'true' || row[6] === true,
    Pinned: row[7] === 'TRUE' || row[7] === 'true' || row[7] === true,
    CreatedAt: row[8] || new Date().toISOString(),
    UpdatedAt: row[9] || new Date().toISOString(),
  }));
}

/**
 * Fetch vault items from Google Sheet.
 */
export async function fetchVaultFromSheet(token: string, spreadsheetId: string): Promise<VaultItem[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Vault!A2:H`;
  const response = await googleFetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errText = await getCleanErrorMessage(response);
    throw new Error(`Failed to fetch vault: Status ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const rows = data.values || [];

  return rows.map((row: any) => ({
    ID: row[0] || '',
    Service: row[1] || '',
    Username: row[2] || '',
    Password: row[3] || '',
    Note: row[4] || '',
    Favorite: row[5] === 'TRUE' || row[5] === 'true' || row[5] === true,
    CreatedAt: row[6] || new Date().toISOString(),
    UpdatedAt: row[7] || new Date().toISOString(),
  }));
}

/**
 * Overwrite all links in Google Sheet.
 */
export async function saveLinksToSheet(token: string, spreadsheetId: string, links: LinkItem[]): Promise<void> {
  // Clear Link values first
  const clearResponse = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Links!A2:J:clear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!clearResponse.ok) {
    const errText = await getCleanErrorMessage(clearResponse);
    throw new Error(`Failed to clear links range: Status ${clearResponse.status} - ${errText}`);
  }

  if (links.length === 0) return;

  const values = links.map(l => [
    l.ID,
    l.Title,
    l.Content,
    l.Category,
    l.Tags,
    l.Note,
    l.Favorite ? 'TRUE' : 'FALSE',
    l.Pinned ? 'TRUE' : 'FALSE',
    l.CreatedAt,
    l.UpdatedAt,
  ]);

  await delay(200); // 200ms throttle between clear & update

  const response = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Links!A2:J${links.length + 1}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const errText = await getCleanErrorMessage(response);
    throw new Error(`Failed to save links to sheet: Status ${response.status} - ${errText}`);
  }
}

/**
 * Overwrite all vault items in Google Sheet.
 */
export async function saveVaultToSheet(token: string, spreadsheetId: string, vault: VaultItem[]): Promise<void> {
  // Clear Vault values first
  const clearResponse = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Vault!A2:H:clear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!clearResponse.ok) {
    const errText = await getCleanErrorMessage(clearResponse);
    throw new Error(`Failed to clear vault range: Status ${clearResponse.status} - ${errText}`);
  }

  if (vault.length === 0) return;

  const values = vault.map(v => [
    v.ID,
    v.Service,
    v.Username,
    v.Password,
    v.Note,
    v.Favorite ? 'TRUE' : 'FALSE',
    v.CreatedAt,
    v.UpdatedAt,
  ]);

  await delay(200); // 200ms throttle between clear & update

  const response = await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Vault!A2:H${vault.length + 1}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const errText = await getCleanErrorMessage(response);
    throw new Error(`Failed to save vault to sheet: Status ${response.status} - ${errText}`);
  }
}

/**
 * Merge local and remote datasets based on ID and UpdatedAt timestamp
 */
export function mergeArrays<T extends { ID: string; UpdatedAt: string }>(local: T[], remote: T[]): T[] {
  const mergedMap = new Map<string, T>();

  // Add all local items
  local.forEach(item => {
    mergedMap.set(item.ID, item);
  });

  // Add remote items, resolving conflicts by picking the item with the later UpdatedAt
  remote.forEach(remoteItem => {
    const localItem = mergedMap.get(remoteItem.ID);
    if (!localItem) {
      mergedMap.set(remoteItem.ID, remoteItem);
    } else {
      const localTime = new Date(localItem.UpdatedAt || 0).getTime();
      const remoteTime = new Date(remoteItem.UpdatedAt || 0).getTime();
      if (remoteTime > localTime) {
        mergedMap.set(remoteItem.ID, remoteItem);
      }
    }
  });

  return Array.from(mergedMap.values());
}

