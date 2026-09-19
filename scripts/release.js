// Publie la version courante (package.json) sur GitHub Releases :
//   1. crée un brouillon de release vX.Y.Z (notes : RELEASE_NOTES.md si présent) ;
//   2. construit l'installateur et le téléverse dans ce brouillon (avec latest.yml pour les mises à jour) ;
//   3. publie la release : les applications installées la proposent au prochain lancement.
// Prérequis : GitHub CLI connecté (gh auth login). Usage : npm run release
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { version } = require('../package.json');
const tag = 'v' + version;
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
const out = cmd => execSync(cmd, { cwd: root }).toString().trim();

const token = process.env.GH_TOKEN || out('gh auth token');
const exists = (() => { try { out(`gh release view ${tag} --json tagName`); return true; } catch (e) { return false; } })();
if (!exists) {
  const notes = path.join(root, 'RELEASE_NOTES.md');
  const notesArg = fs.existsSync(notes) ? `--notes-file "${notes}"` : '--generate-notes';
  run(`gh release create ${tag} --draft --target main --title "LaTeX Home Edition ${version}" ${notesArg}`);
}
run('npx electron-builder --win --publish always', { env: { ...process.env, GH_TOKEN: token } });
run(`gh release edit ${tag} --draft=false --latest`);
console.log(`\nRelease ${tag} publiée : ${out(`gh release view ${tag} --json url --jq .url`)}`);
