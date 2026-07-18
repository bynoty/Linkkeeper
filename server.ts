import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

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
