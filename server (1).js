const express = require('express');
const app = express();

app.use(express.json({limit:'10mb'}));
app.use(express.text({limit:'10mb', type:'*/*'}));

// CORS — allow everything
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Universal proxy — target URL passed as encoded path segment or X-Target-URL header
app.all('/proxy/*', async (req, res) => {
  // Get target URL — could be encoded in path or in header
  let targetUrl = req.headers['x-target-url'];
  if (!targetUrl) {
    // Decode from path: /proxy/https%3A%2F%2F...
    const encoded = req.params[0];
    try { targetUrl = decodeURIComponent(encoded); } catch(e) { targetUrl = encoded; }
  }

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({ error: 'No valid target URL' });
  }

  try {
    const headers = {};
    // Forward relevant headers, skip proxy-specific ones
    const skip = new Set(['host','connection','x-target-url','content-length','transfer-encoding']);
    Object.entries(req.headers).forEach(([k,v]) => { if (!skip.has(k.toLowerCase())) headers[k] = v; });

    const opts = { method: req.method, headers };
    if (!['GET','HEAD'].includes(req.method) && req.body) {
      opts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const resp = await fetch(targetUrl, opts);
    const text = await resp.text();

    res.status(resp.status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', resp.headers.get('content-type') || 'text/plain');
    res.send(text);
  } catch(err) {
    res.status(500).json({ proxy_error: err.message, target: targetUrl });
  }
});

app.get('/', (req, res) => res.json({ status: 'BatchFire proxy running', version: '2.0' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy on port ${PORT}`));
