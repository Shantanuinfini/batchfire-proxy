const express = require('express');
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb', type: '*/*' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Health check
app.get('/', (req, res) => res.json({ status: 'BatchFire proxy v3.1' }));

// Universal proxy — ALL routes starting with /proxy
app.use('/proxy', async (req, res) => {
  const targetUrl = req.headers['x-target-url'];

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing X-Target-URL header' });
  }

  console.log(`[PROXY] ${req.method} → ${targetUrl}`);

  try {
    const skip = new Set(['host', 'connection', 'x-target-url', 'content-length', 'transfer-encoding', 'accept-encoding']);
    const headers = {};
    Object.entries(req.headers).forEach(([k, v]) => {
      if (!skip.has(k.toLowerCase())) headers[k] = v;
    });

    const opts = { method: req.method, headers };
    if (!['GET', 'HEAD'].includes(req.method) && req.body) {
      opts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, opts);
    const text = await response.text();
    console.log(`[PROXY] ${response.status}`);

    res.status(response.status);
    const ct = response.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(text);

  } catch (err) {
    console.error(`[PROXY] Error:`, err.message);
    res.status(500).json({ proxy_error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy on port ${PORT}`));
