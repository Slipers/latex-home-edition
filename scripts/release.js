// Publie la version courante (package.json) sur GitHub Releases.
//
// Les installateurs sont construits par GitHub Actions (.github/workflows/release.yml) :
// Windows (.exe) et macOS (.dmg Apple Silicon et Intel), le .dmg ne pouvant être
// fabriqué que sur macOS. Ce script pousse le tag, suit la construction et affiche
// le résultat. Prérequis : GitHub CLI connecté (gh auth login).
//
//   npm run release            tag + construction des deux plateformes par GitHub Actions
//   npm run release -- --local construction Windows sur ce poste (dépannage)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const { version } = require('../package.json');
const tag = 'v' + version;
const local = process.argv.includes('--local');
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
const out = cmd => execSync(cmd, { cwd: root }).toString().trim();
const muet = cmd => { try { return out(cmd); } catch (e) { return null; } };
const pause = ms => new Promise(r => setTimeout(r, ms));

const token = process.env.GH_TOKEN || out('gh auth token');
const releaseExiste = () => !!muet(`gh release view ${tag} --json tagName`);

function creerBrouillon() {
  if (releaseExiste()) return;
  const notes = path.join(root, 'RELEASE_NOTES.md');
  const notesArg = fs.existsSync(notes) ? `--notes-file "${notes}"` : '--generate-notes';
  run(`gh release create ${tag} --draft --target main --title "LaTeX Home Edition ${version}" ${notesArg}`);
}

async function main() {
  if (local) {
    creerBrouillon();
    run('npx electron-builder --win --publish always', { env: { ...process.env, GH_TOKEN: token } });
    run(`gh release edit ${tag} --draft=false --latest`);
    console.log(`\nRelease ${tag} publiée (Windows seulement) : ${out(`gh release view ${tag} --json url --jq .url`)}`);
    return;
  }

  // 1. le tag doit exister localement (créé par « npm version ») puis être poussé
  if (!muet(`git rev-parse ${tag}`)) {
    console.error(`Le tag ${tag} n'existe pas : lancez d'abord « npm version patch|minor ».`);
    process.exit(1);
  }
  run('git push origin main --follow-tags');

  // 2. GitHub Actions construit Windows et macOS
  console.log('\nConstruction des installateurs par GitHub Actions…');
  let id = null;
  for (let i = 0; i < 30 && !id; i++) {
    await pause(4000);
    id = muet('gh run list --workflow=release.yml --limit 1 --json databaseId,headBranch --jq ".[0].databaseId"');
  }
  if (!id) {
    console.error('Aucune exécution trouvée. Suivez-la sur : https://github.com/Slipers/latex-home-edition/actions');
    process.exit(1);
  }
  try {
    run(`gh run watch ${id} --exit-status --interval 15`);
  } catch (e) {
    console.error('\nLa construction a échoué. Détails : gh run view ' + id + ' --log-failed');
    process.exit(1);
  }

  // 3. résultat
  const url = out(`gh release view ${tag} --json url --jq .url`);
  const fichiers = muet(`gh release view ${tag} --json assets --jq ".assets[].name"`) || '';
  console.log(`\nRelease ${tag} publiée : ${url}`);
  fichiers.split('\n').filter(Boolean).forEach(f => console.log('  • ' + f));
}

main().catch(e => { console.error(e.message); process.exit(1); });
