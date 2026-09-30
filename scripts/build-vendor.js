/* Construit les bibliothèques du mode « Live Modification » dans vendor/ :
   - vendor/yjs/yjs.js       : Yjs (fusion des modifications simultanées), global « Y »
   - vendor/supabase/supabase.js : client Supabase (comptes, base, temps réel), global « supabase »
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
for (const f of ['vendor/yjs/yjs.js', 'vendor/supabase/supabase.js']) console.log(f, Math.round(fs.statSync(path.join(root, f)).size / 1024) + ' Ko');
