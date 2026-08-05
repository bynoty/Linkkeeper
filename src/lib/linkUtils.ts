import { LinkItem } from '../types';

/**
 * Normalizes URL for canonical comparison
 */
export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let urlStr = rawUrl.trim().toLowerCase();

  // Strip protocol
  urlStr = urlStr.replace(/^https?:\/\//, '');
  // Strip www.
  urlStr = urlStr.replace(/^www\./, '');
  // Strip trailing slash
  urlStr = urlStr.replace(/\/$/, '');
  // Strip tracking parameters like utm_source, ref
  try {
    const tempUrl = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    tempUrl.searchParams.delete('utm_source');
    tempUrl.searchParams.delete('utm_medium');
    tempUrl.searchParams.delete('utm_campaign');
    tempUrl.searchParams.delete('utm_term');
    tempUrl.searchParams.delete('utm_content');
    tempUrl.searchParams.delete('ref');
    return tempUrl.toString().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  } catch (e) {
    return urlStr;
  }
}

/**
 * Check if a URL already exists in LinkKeeper
 */
export function findDuplicateLink(url: string, existingLinks: LinkItem[]): LinkItem | null {
  const normTarget = normalizeUrl(url);
  if (!normTarget) return null;

  return existingLinks.find(link => normalizeUrl(link.Content) === normTarget) || null;
}

/**
 * Checks link status via backend proxy /api/check-link
 */
export async function checkLinkHealth(url: string): Promise<{
  ok: boolean;
  statusCode: number;
  statusText: string;
  checkedAt: string;
}> {
  try {
    const res = await fetch('/api/check-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    return {
      ok: false,
      statusCode: 0,
      statusText: err.message || 'Check failed',
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Calls AI Summarize API /api/ai-summarize
 */
export async function summarizeLinkWithAi(url: string, title?: string, note?: string): Promise<{
  summary: string;
  suggestedCategory: string;
  suggestedTags: string[];
}> {
  try {
    const res = await fetch('/api/ai-summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title, note }),
    });
    if (!res.ok) {
      throw new Error(`AI Summarize failed (${res.status})`);
    }
    return await res.json();
  } catch (err: any) {
    console.warn('AI Summarize failed, returning fallback:', err);
    return {
      summary: title ? `Bookmark for ${title}` : `Saved reference link to ${url}`,
      suggestedCategory: 'Reference',
      suggestedTags: ['Imported'],
    };
  }
}

/**
 * Calculates expiration status
 */
export function getExpirationStatus(expiresAt?: string): {
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number | null;
  label: string;
} {
  if (!expiresAt) {
    return { isExpired: false, isExpiringSoon: false, daysRemaining: null, label: 'Never' };
  }

  const expDate = new Date(expiresAt);
  expDate.setHours(23, 59, 59, 999);
  const now = new Date();

  const diffMs = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { isExpired: true, isExpiringSoon: false, daysRemaining: diffDays, label: 'Expired' };
  } else if (diffDays <= 3) {
    return { isExpired: false, isExpiringSoon: true, daysRemaining: diffDays, label: `Expires in ${diffDays}d` };
  } else {
    return { isExpired: false, isExpiringSoon: false, daysRemaining: diffDays, label: `Expires ${expiresAt}` };
  }
}
