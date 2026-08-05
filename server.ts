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
      const target = new URL(url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      let response: Response;
      try {
        response = await fetch(target.toString(), {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LinkKeeper/1.0',
          },
        });
        if (response.status === 405 || response.status === 403) {
          // Retry with GET if HEAD is forbidden or not allowed
          response = await fetch(target.toString(), {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LinkKeeper/1.0',
            },
          });
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        return res.json({
          ok: false,
          statusCode: 0,
          statusText: err.name === 'AbortError' ? 'Timeout (6s)' : 'Network Error / DNS Unreachable',
          checkedAt: new Date().toISOString(),
        });
      }

      clearTimeout(timeoutId);
      const isOk = response.status >= 200 && response.status < 400;
      return res.json({
        ok: isOk,
        statusCode: response.status,
        statusText: response.statusText || (isOk ? 'OK' : 'Error'),
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
