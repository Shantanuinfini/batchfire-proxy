const express = require('express');
const app = express();

app.use(express.json());
app.use(express.text());

// CORS — allow everything
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Square-Version,X-Square-Env');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Proxy all /proxy/* requests to Square
app.all('/proxy/*', async (req, res) => {
  const env = req.headers['x-square-env'] || 'sandbox';
  const base = env === 'prod'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

  const path = req.path.replace(/^\/proxy/, '') || '/';
  const target = base + path + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Authorization': req.headers['authorization'] || '',
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
        'Accept': 'application/json',
      },
    };

    if (!['GET', 'HEAD'].includes(req.method) && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(target, fetchOptions);
    const text = await response.text();
    res.status(response.status).json(JSON.parse(text));
  } catch (err) {
    res.status(500).json({ proxy_error: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'BatchFire proxy running' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
