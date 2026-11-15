// Local preview: no Firebase SDK or production API. Optional LAN state stays in memory.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {randomBytes} = require('node:crypto');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const policy = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' https://cdn.sheetjs.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "img-src 'self' data: blob:",
  "connect-src 'none'", "form-action 'none'", "frame-src 'none'",
  "object-src 'none'", "base-uri 'self'", "worker-src 'none'",
].join('; ');
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.json':'application/json', '.csv':'text/csv', '.woff2':'font/woff2'};
function createServer({shared = false} = {}) {
  const token = randomBytes(24).toString('hex');
  let state = {version:0, trips:[]};
  return http.createServer((req, res) => {
    res.setHeader('Content-Security-Policy', shared ? policy.replace("connect-src 'none'", "connect-src 'self'") : policy);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    let route;
    try { route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); return res.end(); }
    if (shared && route === '/local-sandbox/state') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      const reply = (code, body) => { res.writeHead(code); res.end(JSON.stringify(body)); };
      if (req.headers['x-wtrack-local-token'] !== token) return reply(403, {error:'Sesi lokal tidak valid. Muat ulang halaman.'});
      if (req.method === 'GET') {
        const version = new URL(req.url, 'http://localhost').searchParams.get('version');
        if (version !== null && Number(version) === state.version) { res.writeHead(204); return res.end(); }
        return reply(200, state);
      }
      if (req.method !== 'POST') return reply(405, {error:'Method tidak tersedia.'});
      if (req.headers.origin) {
        try { if (new URL(req.headers.origin).host !== req.headers.host) return reply(403, {error:'Origin ditolak.'}); }
        catch { return reply(403, {error:'Origin ditolak.'}); }
      }
      let body = '', size = 0;
      req.setTimeout(15000, () => req.destroy());
      req.on('data', chunk => {
        size += chunk.length;
        if (size > 16 * 1024 * 1024) { reply(413, {error:'Data uji melebihi 16 MB. Unduh backup dan kurangi batch.'}); req.destroy(); return; }
        body += chunk;
      });
      req.on('end', () => {
        if (res.writableEnded) return;
        let incoming;
        try { incoming = JSON.parse(body); } catch { return reply(400, {error:'JSON tidak valid.'}); }
        if (incoming.version !== state.version) return reply(409, {...state, error:'Data berubah dari PC lain. Periksa data terbaru lalu ulangi tindakan.'});
        if (!Array.isArray(incoming.trips) || incoming.trips.length > 10000 || incoming.trips.some(t => !t || typeof t !== 'object' || typeof t.id !== 'string' || !t.id)) return reply(400, {error:'Daftar SJ tidak valid atau melebihi 10000 SJ.'});
        if (new Set(incoming.trips.map(t => t.id)).size !== incoming.trips.length) return reply(400, {error:'ID tugas duplikat.'});
        state = {version:state.version + 1, trips:incoming.trips};
        return reply(200, state);
      });
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end('Local preview is read only.'); }
    const isDashboard = ['/', '/index.html', '/dashboard'].includes(route);
    const isCourier = ['/kurir.html', '/kurir'].includes(route);
    const isRuntime = route === '/local-sandbox-runtime.js';
    // Never expose service credentials, source configuration, API handlers or other HTML pages.
    if (!isDashboard && !isCourier && !isRuntime && !/^\/(js|css|assets)\/[\w./ -]+$/.test(route) && route !== '/test_surat_jalan.csv') {
      res.writeHead(404); return res.end('Not available in local sandbox.');
    }
    const file = isDashboard ? path.join(root, 'index.html') : isCourier ? path.join(root, 'kurir.html') : isRuntime ? path.join(__dirname, 'local-sandbox-runtime.js') : path.resolve(root, '.' + route);
    if (!file.startsWith(root + path.sep) || route.split('/').includes('..')) { res.writeHead(403); return res.end(); }
    try {
      let content = fs.readFileSync(file);
      if (isDashboard || isCourier) {
        content = content.toString().replace(/<script\b[^>]*src=["']https:\/\/(?:www\.gstatic\.com\/firebasejs|maps\.googleapis\.com)[^"']*["'][^>]*>\s*<\/script>/gi, '');
        // Local preview opens the demo dashboard directly. Paint that shell before
        // scripts finish loading instead of briefly covering it with the login UI.
        const startupStyle = isDashboard ? '<style id="local-dashboard-startup">#login-screen{display:none!important}#main-wrapper{display:flex!important}</style>\n' : '';
        content = content.replace('<head>', `<head>\n<script src="/local-sandbox-runtime.js"${shared ? ` data-shared="true" data-session-token="${token}"` : ''}></script>\n${startupStyle}`);
      }
      res.setHeader('Content-Type', (types[path.extname(file)] || 'application/octet-stream') + (['.html','.js','.css','.csv'].includes(path.extname(file)) ? '; charset=utf-8' : ''));
      res.writeHead(200);
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch { res.writeHead(404); res.end(); }
  });
}
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const shared = process.argv.includes('--lan');
  const server = createServer({shared});
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, shared ? '0.0.0.0' : '127.0.0.1', () => {
    console.log(`Mode uji ${shared ? 'LAN' : 'lokal'}: http://localhost:${port} — Firebase/API produksi diblokir.`);
    if (shared) {
      for (const entries of Object.values(os.networkInterfaces())) for (const entry of entries || []) {
        if (entry.family === 'IPv4' && !entry.internal) console.log(`Dashboard: http://${entry.address}:${port}/ | Kurir: http://${entry.address}:${port}/kurir.html`);
      }
      console.log('Data bersama hanya di memori server; hilang saat server berhenti. Unduh backup sebelum menutup server.');
    }
  });
}
module.exports = {createServer, policy};
