// Publie la version courante sur GitHub Releases, dans une release de tag fixe
// « molecular-latest », distincte de celles de LaTeX Home Edition :
//   1. construit l'installateur Windows et le fichier de canal molecular.yml ;
//   2. crée la release molecular-latest si elle n'existe pas ;
//   3. y téléverse les fichiers en écrasant les précédents.
// Les applications déjà installées y trouvent la mise à jour au prochain lancement.
// Prérequis : GitHub CLI connecté (gh auth login). Usage : npm run release
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { version, productName } = require('../package.json');
const TAG = 'molecular-latest';
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
const out = cmd => execSync(cmd, { cwd: root }).toString().trim();

console.log('Construction de l’installateur…');
run('npx electron-builder --win --publish never');

const dist = path.join(root, 'dist');
const fichiers = fs.readdirSync(dist)
  .filter(f => /^MolecularChemistry-Edition-Setup-.*\.exe$/.test(f) || f === 'molecular.yml' || /\.blockmap$/.test(f))
  .map(f => path.join(dist, f));
if (!fichiers.some(f => f.endsWith('.exe'))) {
  console.error('Aucun installateur produit dans dist/. Arrêt.');
  process.exit(1);
}
if (!fichiers.some(f => f.endsWith('molecular.yml'))) {
  console.warn('⚠ molecular.yml absent : les mises à jour automatiques ne fonctionneront pas.');
}

const existe = (() => { try { out(`gh release view ${TAG} --json tagName`); return true; } catch (e) { return false; } })();
const notes = path.join(root, 'RELEASE_NOTES.md');
if (!existe) {
  const arg = fs.existsSync(notes) ? `--notes-file "${notes}"` : '--generate-notes';
  run(`gh release create ${TAG} --title "${productName} ${version}" ${arg}`);
} else {
  run(`gh release edit ${TAG} --title "${productName} ${version}"`
    + (fs.existsSync(notes) ? ` --notes-file "${notes}"` : ''));
}
run(`gh release upload ${TAG} ${fichiers.map(f => `"${f}"`).join(' ')} --clobber`);
console.log(`\nVersion ${version} publiée : ${out(`gh release view ${TAG} --json url --jq .url`)}`);
