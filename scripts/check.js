/**
 * Build check. There is nothing to compile, so this makes sure the project
 * is ready to deploy: the API loads, answers a health check, and the
 * dashboard files exist.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failed = false;
function ok(msg) { console.log('  ok   ' + msg); }
function fail(msg) { console.error('  FAIL ' + msg); failed = true; }

for (const f of ['public/index.html', 'public/code-viewer.html', 'public/vsl-tracking-snippet.js', 'api/index.js', 'vsl-tracker.gs']) {
  fs.existsSync(path.join(ROOT, f)) ? ok(f + ' exists') : fail(f + ' is missing');
}

let handler;
try {
  handler = require(path.join(ROOT, 'api', 'index.js'));
  typeof handler === 'function' ? ok('api/index.js loads') : fail('api/index.js does not export a function');
} catch (e) {
  fail('api/index.js failed to load: ' + e.message);
}

function call(query, headers) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      getHeader(k) { return this.headers[k]; },
      status(c) { this.statusCode = c; return this; },
      json(o) { resolve({ code: this.statusCode, body: o }); return this; },
      end() { resolve({ code: this.statusCode, body: null }); return this; },
    };
    handler({ method: 'GET', query, headers: headers || {}, body: {} }, res);
  });
}

(async () => {
  if (handler) {
    const ping = await call({ action: 'ping' });
    ping.body && ping.body.status === 'ok' ? ok('ping returns ok') : fail('ping did not return ok');
    const auth = await call({ action: 'auth_check' });
    auth.body && typeof auth.body.password_required === 'boolean' ? ok('auth_check responds') : fail('auth_check did not respond');
  }
  if (failed) { console.error('\nBuild check failed.'); process.exit(1); }
  console.log('\nBuild check passed.');
})();
