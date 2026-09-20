// Recopie la version de package.json dans js/version.js (appelé automatiquement par « npm version »)
const fs = require('fs');
const path = require('path');
const v = require('../package.json').version;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'version.js'),
`/* Généré automatiquement à partir de package.json (npm version) */
window.M = window.M || {};
window.M.VERSION_APP = '${v}';
`);
console.log('js/version.js ->', v);
