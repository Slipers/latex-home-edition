/* Construit les bibliothèques du mode « Live Modification » dans vendor/ :
   - vendor/yjs/yjs.js       : Yjs (fusion des modifications simultanées), global « Y »
   - vendor/supabase/supabase.js : client Supabase (comptes, base, temps réel), global « supabase »
   - vendor/highlight/highlight.js : coloration du code (highlight.js, langages choisis), global « hljs »
   À relancer après une mise à jour de ces paquets :  node scripts/build-vendor.js */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

require('esbuild').buildSync({
  stdin: { contents: "export * from 'yjs';", resolveDir: root, loader: 'js' },
  bundle: true, format: 'iife', globalName: 'Y', minify: true, target: 'es2019',
  outfile: path.join(root, 'vendor/yjs/yjs.js'),
  banner: { js: '/* Yjs ' + require(root + '/node_modules/yjs/package.json').version + ' — MIT — https://github.com/yjs/yjs */' },
});
fs.copyFileSync(path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), path.join(root, 'vendor/supabase/supabase.js'));

// Coloration du code : le cœur de highlight.js et seulement les langages proposés dans l'éditeur
const HL_LANGS = ['python', 'c', 'cpp', 'java', 'javascript', 'typescript', 'matlab', 'r', 'sql', 'bash', 'xml', 'css', 'json', 'ocaml', 'latex', 'php', 'csharp', 'rust', 'go'];
fs.mkdirSync(path.join(root, 'vendor/highlight'), { recursive: true });
require('esbuild').buildSync({
  stdin: {
    contents: "import hljs from 'highlight.js/lib/core';\n" + HL_LANGS.map((l, i) => "import l" + i + " from 'highlight.js/lib/languages/" + l + "';\nhljs.registerLanguage('" + l + "', l" + i + ");").join('\n') + "\nwindow.hljs = hljs;",
    resolveDir: root, loader: 'js',
  },
  bundle: true, format: 'iife', minify: true, target: 'es2019',
  outfile: path.join(root, 'vendor/highlight/highlight.js'),
  banner: { js: '/* highlight.js ' + require(root + '/node_modules/highlight.js/package.json').version + ' — BSD-3-Clause — https://highlightjs.org */' },
});
for (const f of ['vendor/yjs/yjs.js', 'vendor/supabase/supabase.js', 'vendor/highlight/highlight.js']) console.log(f, Math.round(fs.statSync(path.join(root, f)).size / 1024) + ' Ko');

// Correcteur d'orthographe local : Hunspell (WebAssembly) dans un worker + dictionnaires
// français (Dicollecte / Grammalecte, MPL-2.0) et anglais (SCOWL, MIT/BSD)
fs.mkdirSync(path.join(root, 'vendor/hunspell'), { recursive: true });
require('esbuild').buildSync({
  entryPoints: [path.join(root, 'scripts/hunspell-worker.src.js')],
  bundle: true, format: 'iife', minify: true, target: 'es2019', platform: 'browser', mainFields: ['browser', 'main'],
  outfile: path.join(root, 'vendor/hunspell/hunspell-worker.js'),
  banner: { js: '/* Hunspell ' + require(root + '/node_modules/hunspell-asm/package.json').version + ' (hunspell-asm, MIT) — correcteur local de LaTeX Home Edition */' },
});
for (const lang of ['fr', 'en']) {
  const dir = path.join(root, 'node_modules/dictionary-' + lang);
  const d = { aff: fs.readFileSync(path.join(dir, 'index.aff'), 'utf8'), dic: fs.readFileSync(path.join(dir, 'index.dic'), 'utf8') };
  fs.writeFileSync(path.join(root, 'vendor/hunspell/' + lang + '.js'),
    '/* Dictionnaire ' + lang + ' (dictionary-' + lang + ' ' + require(dir + '/package.json').version + ', licence dans LICENSE-' + lang + ') */\n'
    + 'self.LHE_DIC = self.LHE_DIC || {};\nself.LHE_DIC.' + lang + ' = ' + JSON.stringify(d) + ';\n');
  fs.copyFileSync(path.join(dir, 'license'), path.join(root, 'vendor/hunspell/LICENSE-' + lang));
}
for (const lic of ['LICENSE', 'license', 'LICENSE.md']) if (fs.existsSync(path.join(root, 'node_modules/hunspell-asm', lic))) { fs.copyFileSync(path.join(root, 'node_modules/hunspell-asm', lic), path.join(root, 'vendor/hunspell/LICENSE-hunspell-asm')); break; }
for (const f of ['vendor/hunspell/hunspell-worker.js', 'vendor/hunspell/fr.js', 'vendor/hunspell/en.js']) console.log(f, Math.round(fs.statSync(path.join(root, f)).size / 1024) + ' Ko');
