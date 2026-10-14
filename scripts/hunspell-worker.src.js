/* Correcteur d'orthographe local (worker) : Hunspell compilé en WebAssembly + dictionnaires
   français (Dicollecte / Grammalecte) et anglais, chargés depuis vendor/hunspell/.
   Construit dans vendor/hunspell/hunspell-worker.js par scripts/build-vendor.js.
   Messages : { id, op: 'init' } → { id, ok, langs }
              { id, op: 'check', words: [...], lang } → { id, bad: [bool…] }  (faute dans toutes les langues)
              { id, op: 'suggest', word, lang } → { id, list: [...] } */
// Version CommonJS du paquet : sa version ESM appelle « nanoid » comme une fonction et plante une fois empaquetée
const { loadModule } = require('hunspell-asm/dist/cjs/index.js');

let ready = null;
const dicts = {};

function init() {
  if (!ready) {
    ready = (async () => {
      const factory = await loadModule();
      const enc = new TextEncoder();
      for (const lang of ['fr', 'en']) {
        importScripts(lang + '.js');                       // self.LHE_DIC[lang] = { aff, dic }
        const d = self.LHE_DIC && self.LHE_DIC[lang];
        if (!d) continue;
        const aff = factory.mountBuffer(enc.encode(d.aff), lang + '.aff');
        const dic = factory.mountBuffer(enc.encode(d.dic), lang + '.dic');
        dicts[lang] = factory.create(aff, dic);
        delete self.LHE_DIC[lang];
      }
      return Object.keys(dicts);
    })();
  }
  return ready;
}

const order = lang => (lang === 'en' ? ['en', 'fr'] : ['fr', 'en']).filter(l => dicts[l]);

const bare = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Un mot est correct s'il l'est dans une des langues ; les mots composés (trait d'union)
// inconnus sont acceptés si chacune de leurs parties l'est. Un mot de la seconde langue
// n'est pas accepté s'il est un mot de la première sans ses accents (« resistance », « reference »)
function ok(word, langs) {
  const w = word.replace(/’/g, '\'');
  if (dicts[langs[0]].spell(w)) return true;
  const other = langs.slice(1).find(l => dicts[l].spell(w));
  if (other) return !(w.length >= 5 && /^[\x00-\x7f]+$/.test(w) && dicts[langs[0]].suggest(w).some(s => s !== w && bare(s) === bare(w)));
  if (w.includes('-')) {
    // les premiers éléments en -o / -i sont des préfixes (arithmético-, physico-, chimi-…)
    const parts = w.split('-').filter(Boolean);
    return parts.length > 1 && parts.every((p, i) => langs.some(l => dicts[l].spell(p)) || (i < parts.length - 1 && p.length > 3 && /[oi]$/i.test(p)));
  }
  return false;
}

self.onmessage = async ev => {
  const m = ev.data || {};
  try {
    const langs = await init();
    if (m.op === 'init') return self.postMessage({ id: m.id, ok: true, langs });
    const ls = order(m.lang);
    if (!ls.length) throw new Error('aucun dictionnaire');
    if (m.op === 'check') return self.postMessage({ id: m.id, bad: (m.words || []).map(w => !ok(String(w), ls)) });
    if (m.op === 'suggest') {
      const w = String(m.word || '').replace(/’/g, '\'');
      // suggestions de la langue du document ; celles de l'autre langue seulement à défaut
      const seen = new Set(), list = [];
      for (const l of ls) { if (list.length) break; for (const s of dicts[l].suggest(w)) if (!seen.has(s)) { seen.add(s); list.push(s); } }
      return self.postMessage({ id: m.id, list: list.slice(0, 8) });
    }
    self.postMessage({ id: m.id, error: 'opération inconnue' });
  } catch (e) {
    self.postMessage({ id: m.id, error: String(e && e.message || e) });
  }
};
