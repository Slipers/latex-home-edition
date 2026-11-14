// Petit serveur local sans dépendance : node server.js puis http://localhost:8765
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, port = process.env.PORT || 8765;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.wav': 'audio/wav' };

/* Module « Exécution Python » dans la version navigateur locale (comme l'application de
   bureau). Réservé à cette page : adresse locale exacte (Host), même origine, en-tête
   X-LHE et JSON (une page d'un autre site ne peut ni l'appeler ni lire la réponse). */
const py = require('./electron/python.js');
const local = h => h === 'localhost:' + port || h === '127.0.0.1:' + port;
function pyApi(req, res, what) {
  const deny = c => { res.writeHead(c); res.end(); };
  if (req.method !== 'POST' || !local(req.headers.host) || req.headers['x-lhe'] !== '1' || !/^application\/json/.test(req.headers['content-type'] || '')) return deny(403);
  if (req.headers.origin && !local(String(req.headers.origin).replace(/^http:\/\//, ''))) return deny(403);
  let body = '';
  req.setEncoding('utf8');
  req.on('data', c => { body += c; if (body.length > 3e6) req.destroy(); });
  req.on('end', async () => {
    let o = {};
    try { o = body ? JSON.parse(body) : {}; } catch (_) { return deny(400); }
    let r;
    try {
      if (what === 'check') r = await py.check(!!o.force);
      else if (what === 'run') r = await py.run({ id: o.id, code: o.code, stdin: o.stdin, timeout: o.timeout });
      else if (what === 'stop') r = py.stop(o.id);
      else if (what === 'install') r = await py.install();
      else return deny(404);
    } catch (e) { r = { ok: false, error: 'server', message: String(e && e.message || e) }; }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(r));
  });
}

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  const api = /^\/__lhe\/py\/([a-z]+)$/.exec(p);
  if (api) return pyApi(req, res, api[1]);
  if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(root, p));
  if (!f.startsWith(root) || f.includes('node_modules')) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log('LaTeX Home Edition : http://localhost:' + port));
