/* Version web de LaTeX Home Edition, hébergée sur GitHub Pages :
   https://slipers.github.io/latex-home-edition/

   Assemble le dossier _site/ : l'éditeur (index.html, css/, js/, vendor/) à la racine du
   site, à côté des pages web de docs/ (liens de partage p/, invitations d/, compte/).
   Publié à chaque envoi sur main par .github/workflows/site.yml.

     node scripts/build-web.mjs

   Seuls les fichiers suivis par git sont copiés (comme sur GitHub). Les adresses des
   scripts et feuilles de style de index.html reçoivent ?v=<version> : après une
   publication, les navigateurs chargent tous les nouveaux fichiers ensemble.
   Sur le site, le module « Exécution Python » est désactivé (L.WEB, js/util.js). */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');
const EDITOR = ['index.html', 'css', 'js', 'vendor'];
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

// Liste des fichiers suivis par git (chemins relatifs au projet, séparateur /)
const tracked = dirs => git('ls-files', '-z', '--', ...dirs).split('\0').filter(Boolean);

// Dossier de sortie recréé : uniquement _site/, à la racine du projet
if (path.basename(out) !== '_site' || path.dirname(out) !== root) throw new Error('Dossier de sortie inattendu : ' + out);
fs.rmSync(out, { recursive: true, force: true });

let n = 0, bytes = 0;
const copy = (from, to) => {
  const dst = path.join(out, to);
  if (fs.existsSync(dst)) throw new Error('Deux fichiers pour la même adresse du site : ' + to);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(root, from), dst);
  n++; bytes += fs.statSync(dst).size;
};
// Pages de docs/ à la racine du site (docs/p/index.html → p/index.html)
for (const f of tracked(['docs'])) if (path.posix.basename(f) !== '.nojekyll') copy(f, f.slice('docs/'.length));
// L'éditeur
for (const f of tracked(EDITOR)) copy(f, f);

// Version des fichiers dans index.html
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let sha = (process.env.GITHUB_SHA || '').slice(0, 7);
if (!sha) try { sha = git('rev-parse', '--short=7', 'HEAD').trim(); } catch (e) { sha = 'local'; }
const tag = pkg.version + '-' + sha;
const indexFile = path.join(out, 'index.html');
let html = fs.readFileSync(indexFile, 'utf8');
let tagged = 0;
html = html.replace(/((?:src|href)=")((?:css|js|vendor)\/[^"?#]+)"/g, (m, a, url) => { tagged++; return a + url + '?v=' + tag + '"'; });
// Description pour les moteurs de recherche et les aperçus de liens
if (!/<meta name="description"/.test(html)) {
  html = html.replace('<title>', '<meta name="description" content="' + pkg.description + ', dans le navigateur. Gratuit, sans installation.">\n<title>');
}
fs.writeFileSync(indexFile, html);

console.log('Site web prêt dans _site/ : ' + n + ' fichiers, ' + (bytes / 1048576).toFixed(1) + ' Mo, version ' + tag
  + ' (' + tagged + ' adresses versionnées dans index.html).');
