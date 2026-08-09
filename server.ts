import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON bodies for POST/PUT requests
  app.use(express.json({ limit: '10mb' }));

  // API Proxy Route for Google APIs to bypass client-side iframe sandbox and CORS limitations
  app.all('/api/google-proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing target URL' });
    }

    // Validate the target URL hostname is a safe Google APIs domain
    try {
      const parsedUrl = new URL(targetUrl);
      if (!parsedUrl.hostname.endsWith('googleapis.com')) {
        return res.status(400).json({ error: 'Invalid proxy target host. Host must be googleapis.com' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Malformed target URL' });
    }

    const authHeader = req.headers.authorization;
    const contentType = req.headers['content-type'];

    try {
      const headers: Record<string, string> = {};
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
      if (contentType) {
        headers['Content-Type'] = contentType;
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (!['GET', 'HEAD'].includes(req.method)) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(targetUrl, fetchOptions);

      res.status(response.status);

      const responseContentType = response.headers.get('content-type');
      if (responseContentType) {
        res.setHeader('Content-Type', responseContentType);
      }

      const responseText = await response.text();
      res.send(responseText);
    } catch (error) {
      console.error('Google API Proxy error:', error);
      res.status(500).json({ error: 'Google API proxy request failed', details: String(error) });
    }
  });

  // Broken Link Checker API
  app.post('/api/check-link', async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      let targetUrl = url.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = `https://${targetUrl}`;
      }
      const target = new URL(targetUrl);

      const browserHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      };

      const fetchWithTimeout = async (method: 'GET' | 'HEAD', timeoutMs = 8000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetch(target.toString(), {
            method,
            signal: controller.signal,
            headers: browserHeaders,
            redirect: 'follow',
          });
          clearTimeout(timeoutId);
          return response;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };

      let response: Response | null = null;
      try {
        response = await fetchWithTimeout('GET', 8000);
      } catch (getErr: any) {
        try {
          response = await fetchWithTimeout('HEAD', 5000);
        } catch (headErr: any) {
          return res.json({
            ok: false,
            statusCode: 0,
            statusText: getErr.name === 'AbortError' || headErr.name === 'AbortError' ? 'Timeout (8s)' : 'Network Unreachable / Domain Offline',
            checkedAt: new Date().toISOString(),
          });
        }
      }

      const statusCode = response ? response.status : 0;
      // 2xx, 3xx, as well as 400/401/403/405/429/999 (which indicate active web server responding to bots) are reachable
      const isOk = (statusCode >= 200 && statusCode < 404) || [400, 401, 403, 405, 429, 999].includes(statusCode);

      let statusText = response ? (response.statusText || (isOk ? 'OK' : `HTTP ${statusCode}`)) : 'Error';
      if (statusCode === 403) statusText = 'Access Restricted / Bot Protection (403)';
      if (statusCode === 400) statusText = 'Active (Server Responded 400)';
      if (statusCode === 401) statusText = 'Authentication Required (401)';
      if (statusCode === 404) statusText = 'Page Not Found (404)';

      return res.json({
        ok: isOk,
        statusCode: statusCode,
        statusText: statusText,
        checkedAt: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(400).json({
        ok: false,
        statusCode: 400,
        statusText: 'Invalid URL format',
        checkedAt: new Date().toISOString(),
      });
    }
  });

  // AI Link Summarizer & Auto-Tagging API
  app.post('/api/ai-summarize', async (req, res) => {
    const { url, title, note } = req.body;
    if (!url && !title) {
      return res.status(400).json({ error: 'URL or Title is required' });
    }

    // Heuristic Fallback Function
    const generateFallback = () => {
      let hostname = '';
      try {
        if (url) hostname = new URL(url).hostname.replace('www.', '');
      } catch (e) {}

      let cat = 'Reference';
      const text = `${url} ${title} ${note}`.toLowerCase();
      if (text.includes('github') || text.includes('code') || text.includes('dev') || text.includes('api')) cat = 'Tool';
      else if (text.includes('youtube') || text.includes('video') || text.includes('movie')) cat = 'Entertainment';
      else if (text.includes('paper') || text.includes('edu') || text.includes('learn') || text.includes('docs')) cat = 'Education';
      else if (text.includes('ai') || text.includes('gpt') || text.includes('llm') || text.includes('gemini')) cat = 'AI';
      else if (text.includes('bank') || text.includes('finance') || text.includes('stock') || text.includes('crypto')) cat = 'Finance';

      const tags = [];
      if (hostname) tags.push(hostname.split('.')[0]);
      if (cat !== 'Reference') tags.push(cat);
      if (text.includes('guide') || text.includes('tutorial')) tags.push('Tutorial');
      if (text.includes('tool') || text.includes('app')) tags.push('Tool');

      const summaryText = title
        ? `Bookmark for ${title}${hostname ? ` on ${hostname}` : ''}. ${note ? `Note: ${note}` : ''}`
        : `Saved reference link to ${hostname || url}.`;

      return {
        summary: summaryText.trim(),
        suggestedCategory: cat,
        suggestedTags: tags.slice(0, 4),
      };
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json(generateFallback());
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Analyze this web link bookmark and return a JSON object with a concise 1-2 sentence Thai/English summary, a recommended category (choose one from: Work, Personal, Education, Reference, Finance, Social, Entertainment, Tool, AI), and 2-4 recommended short tags.

Link URL: ${url || 'N/A'}
Title: ${title || 'N/A'}
User Note: ${note || 'N/A'}

Respond strictly with valid JSON only in this format:
{
  "summary": "Brief 1-2 sentence overview of what this link/site is about",
  "suggestedCategory": "Category Name",
  "suggestedTags": ["tag1", "tag2", "tag3"]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const responseText = response.text?.trim() || '';
      const cleanJsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonStr);

      return res.json({
        summary: parsed.summary || generateFallback().summary,
        suggestedCategory: parsed.suggestedCategory || 'Reference',
        suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : [],
      });
    } catch (err) {
      console.warn('Gemini API summarization failed, returning heuristic fallback:', err);
      return res.json(generateFallback());
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
