/**
 * Local dev server. Serves the dashboard from public/ and runs api/index.js
 * the same way Vercel does, so you can test everything on your own computer.
 *
 *   npm run dev   ->  http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Load .env (simple KEY=value lines) without extra packages.
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
loadEnv(path.join(ROOT, '.env'));
loadEnv(path.join(ROOT, '.env.local'));

const handler = require(path.join(ROOT, 'api', 'index.js'));
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(ROOT, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      const type = req.headers['content-type'] || '';
      if (!data) return resolve({});
      if (type.includes('application/x-www-form-urlencoded')) {
        return resolve(Object.fromEntries(new URLSearchParams(data)));
      }
      try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
    });
  });
}

// Minimal version of the req/res helpers Vercel adds.
function wrapResponse(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (body) => { res.end(typeof body === 'string' ? body : JSON.stringify(body)); return res; };
  return res;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api' || url.pathname === '/api/' || url.pathname === '/api/index.js') {
    req.query = Object.fromEntries(url.searchParams);
    req.body = req.method === 'POST' ? await readBody(req) : {};
    try {
      await handler(req, wrapResponse(res));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  let file = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(url.pathname)));
  if (!file.startsWith(PUBLIC_DIR)) { res.statusCode = 403; return res.end('Forbidden'); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`VSL dashboard running at http://localhost:${PORT}`);
  console.log(`API health check:      http://localhost:${PORT}/api?action=ping`);
  console.log(process.env.ACCESS_PASSWORD || process.env.ADMIN_PASSWORD
    ? 'Password protection: ON (ACCESS_PASSWORD is set)'
    : 'Password protection: OFF (set ACCESS_PASSWORD to turn it on)');
});
