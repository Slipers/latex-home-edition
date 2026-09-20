// Serveur local sans dépendance : node server.js puis http://localhost:8766
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname), port = process.env.PORT || 8766;
// Chemins servis, relatifs à la racine : la page, les scripts, les styles,
// la bibliothèque three.js et l'icône. Tout le reste est refusé.
const AUTORISE = /^(index\.html|(js|css|vendor)\/[\w./-]+|build\/icon\.png)$/;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.xyz': 'text/plain', '.mol': 'text/plain',
};
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  // On résout le chemin puis on vérifie qu'il reste sous la racine : comparer avec
  // startsWith(root) seul laisserait passer un dossier frère nommé « …-autre ».
  const rel = path.posix.normalize('/' + p).slice(1);
  const f = path.resolve(root, '.' + path.posix.normalize('/' + p));
  if (f !== root && !f.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  // Seuls les fichiers de l'application sont servis : ni sources de build, ni configuration.
  if (!AUTORISE.test(rel)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log('LaTeX MolecularChemistry Edition : http://localhost:' + port));
