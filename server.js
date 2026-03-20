const express = require('express');
const app = express();

app.use(express.json({limit:'10mb'}));
app.use(express.text({limit:'10mb', type:'*/*'}));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Universal proxy
app.all('/proxy/*', async (req, res) => {
  // Target URL comes from X-Target-URL header (full URL encoded there)
  let targetUrl = req.headers['x-target-url'];

  if (!targetUrl) {
    // Fallback: decode from path
    const raw = req.params[0];
    try { targetUrl = decodeURIComponent(raw); } catch(e) { targetUrl = raw; }
  }

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({ error: 'No valid target URL. Set X-Target-URL header.' });
  }

  console.log(`[PROXY] ${req.method} → ${targetUrl}`);

  try {
    // Build headers - forward everything except hop-by-hop headers
    const skipHeaders = new Set(['host','connection','x-target-url','content-length','transfer-encoding','accept-encoding']);
    const headers = {};
    Object.entries(req.headers).forEach(([k, v]) => {
      if (!skipHeaders.has(k.toLowerCase())) headers[k] = v;
    });

    const opts = { method: req.method, headers };

    // Add body for non-GET requests
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (req.body) {
        opts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }
    }

    const response = await fetch(targetUrl, opts);
    const text = await response.text();

    console.log(`[PROXY] Response: ${response.status}`);

    // Forward status and content-type
    res.status(response.status);
    const ct = response.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(text);

  } catch(err) {
    console.error(`[PROXY] Error: ${err.message}`);
    res.status(500).json({ proxy_error: err.message, target: targetUrl });
  }
});

app.get('/', (req, res) => res.json({ status: 'BatchFire proxy running', version: '3.0' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BatchFire proxy running on port ${PORT}`));
