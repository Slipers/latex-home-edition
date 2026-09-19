/* Modèle de document : blocs, types d'encadrés, numérotation, texte enrichi */

L.NAMES = {
  fr: {
    toc: 'Table des matières', refs: 'Références', abstract: 'Résumé', figure: 'Figure', table: 'Table',
    theoreme: 'Théorème', proposition: 'Proposition', lemme: 'Lemme', corollaire: 'Corollaire',
    definition: 'Définition', exemple: 'Exemple', exercice: 'Exercice', methode: 'Méthode',
    remarque: 'Remarque', preuve: 'Démonstration', solution: 'Solution', resume: 'Résumé',
    propriete: 'Propriété', notation: 'Notation', question: 'Question',
  },
  en: {
    toc: 'Contents', refs: 'References', abstract: 'Abstract', figure: 'Figure', table: 'Table',
    theoreme: 'Theorem', proposition: 'Proposition', lemme: 'Lemma', corollaire: 'Corollary',
    definition: 'Definition', exemple: 'Example', exercice: 'Exercise', methode: 'Method',
    remarque: 'Remark', preuve: 'Proof', solution: 'Solution', resume: 'Abstract',
    propriete: 'Property', notation: 'Notation', question: 'Question',
  },
};

/* style : plain (corps italique), definition (corps droit), remark, proof, abstract */
L.KINDS = {
  theoreme:    { style: 'plain', numbered: true },
  proposition: { style: 'plain', numbered: true },
  propriete:   { style: 'plain', numbered: true },
  lemme:       { style: 'plain', numbered: true },
  corollaire:  { style: 'plain', numbered: true },
  definition:  { style: 'definition', numbered: true },
  exemple:     { style: 'definition', numbered: true },
  exercice:    { style: 'definition', numbered: true },
  question:    { style: 'definition', numbered: true },
  methode:     { style: 'definition', numbered: true },
  notation:    { style: 'definition', numbered: false },
  remarque:    { style: 'remark', numbered: false },
  preuve:      { style: 'proof', numbered: false, fixed: true },
  solution:    { style: 'proof', numbered: false, fixed: true },
  resume:      { style: 'abstract', numbered: false, fixed: true },
};

L.kindName = (kind, lang) => (L.NAMES[lang] || L.NAMES.fr)[kind] || kind;

L.defaultMeta = () => ({
  title: '', subtitle: '', author: '', institution: '', extra: '', date: L.todayFr(),
  titleStyle: 'article',     // article | fiche | pagegarde | aucun
  fontSize: 11, margins: 'normales', spacing: 1, lang: 'fr',
  toc: false, thmBySection: false, boxedThm: false, pageNumbers: true,
  tableName: '', figureName: '',            // vide = nom par défaut (« Table », « Figure »)
  numFormat: 'arabic', numPos: 'foot-c', pageStart: 1,   // numérotation des pages
  header: { l: '', c: '', r: '' }, footer: { l: '', c: '', r: '' },
  headRule: false, footRule: false, hfFirst: true,
});

/* Couleurs de texte et de fond (mêmes valeurs dans l'aperçu et dans le LaTeX exporté) */
L.TEXT_COLORS = { rouge: 'E00000', bleu: '1F4FBF', vert: '1E8E3E', orange: 'E07000', violet: '7B2FBE', gris: '6B6B6B' };
L.HEAD_COLORS = { gris: 'E8E8E8', bleu: 'E3E4F8', vert: 'E2F2E5', jaune: 'FFF3C4', rose: 'FBE3E8' };

/* Formats de numérotation des pages */
L.NUM_FORMATS = [
  ['arabic', '1, 2, 3'], ['n/N', '1/3, 2/3'], ['page', 'Page 1'], ['page-sur', 'Page 1 sur 3'], ['tirets', '– 1 –'], ['none', 'Aucune'],
];
L.pageNumText = function (fmt, n, total, lang) {
  const P = lang === 'en' ? 'Page' : 'Page', S = lang === 'en' ? 'of' : 'sur';
  return { arabic: String(n), 'n/N': n + '/' + total, page: P + ' ' + n, 'page-sur': P + ' ' + n + ' ' + S + ' ' + total, tirets: '– ' + n + ' –' }[fmt] || '';
};
L.fixMeta = function (m) {
  if (m.pageNumbers === false && !m._hfMigrated) m.numFormat = 'none';
  m._hfMigrated = true;
  m.header = Object.assign({ l: '', c: '', r: '' }, m.header || {});
  m.footer = Object.assign({ l: '', c: '', r: '' }, m.footer || {});
  return m;
};

L.newBlock = function (type, opts = {}) {
  const id = L.uid();
  const B = {
    paragraph: () => ({ html: '', align: 'justify', noindent: false }),
    heading: () => ({ level: 1, html: '', numbered: true }),
    equation: () => ({ latex: '', numbered: true }),
    list: () => ({ style: 'bullet', items: [{ html: '', level: 0 }] }),
    box: () => ({ kind: 'theoreme', title: '', numbered: true, children: [L.newBlock('paragraph')] }),
    table: () => ({
      head: true, style: 'pro', align: ['c', 'c', 'c'], caption: '',
      rows: [['Colonne 1', 'Colonne 2', 'Colonne 3'], ['', '', ''], ['', '', '']],
    }),
    figure: () => ({ src: '', width: 60, caption: '' }),
    code: () => ({ lang: 'python', code: '', numbers: false }),
    tabvar: () => ({ xlabel: 'x', xs: ['-inf', '+inf'], rows: [] }),
    cols: () => ({ ratio: 50, children: [L.newBlock('col'), L.newBlock('col')] }),
    col: () => ({ children: [L.newBlock('paragraph')] }),
    pagebreak: () => ({}),
    bibliography: () => ({}),
  }[type];
  const b = Object.assign({ id, type }, B ? B() : {}, opts);
  if (type === 'box' && L.KINDS[b.kind]) {
    if (opts.numbered === undefined) b.numbered = L.KINDS[b.kind].numbered;
  }
  return b;
};

/* Parcours récursif de tous les blocs (y compris le contenu des encadrés) */
L.walk = function (blocks, fn, parent = null) {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (fn(b, blocks, i, parent) === false) return false;
    if (b.children && L.walk(b.children, fn, b) === false) return false;
  }
};

L.find = function (doc, id) {
  let res = null;
  L.walk(doc.blocks, (b, list, index, parent) => {
    if (b.id === id) { res = { block: b, list, index, parent }; return false; }
  });
  return res;
};

L.cloneBlock = function (b) {
  const c = JSON.parse(JSON.stringify(b));
  L.walk([c], x => { x.id = L.uid(); });
  return c;
};

/* ---------- Numérotation automatique (comme les compteurs LaTeX) ---------- */
L.computeNumbers = function (doc) {
  const m = doc.meta, lang = m.lang;
  const nums = {};          // id -> { num, ref, label }
  const sec = [0, 0, 0];
  const kindCount = {};
  let eq = 0, fig = 0, tab = 0;
  const toc = [];
  const bib = {};
  (doc.bib || []).forEach((e, i) => { bib[e.id] = i + 1; });
  const forced = b => (b.forceNum !== undefined && b.forceNum !== null && b.forceNum !== '' && !isNaN(+b.forceNum)) ? +b.forceNum : null;
  L.walk(doc.blocks, (b) => {
    const fn = forced(b);
    if (b.type === 'heading') {
      const lv = Math.min(b.level, 4);
      if (lv <= 3 && b.numbered) {
        sec[lv - 1] = fn !== null ? fn : sec[lv - 1] + 1;
        for (let k = lv; k < 3; k++) sec[k] = 0;
        if (lv === 1) Object.keys(kindCount).forEach(k => { if (m.thmBySection) kindCount[k] = 0; });
        const n = sec.slice(0, lv).join('.');
        nums[b.id] = { num: n, ref: n };
      }
      if (lv <= 3) toc.push({ id: b.id, level: lv, num: nums[b.id] ? nums[b.id].num : '', html: b.html });
    } else if (b.type === 'equation' && b.numbered) {
      eq = fn !== null ? fn : eq + 1; nums[b.id] = { num: '(' + eq + ')', ref: '(' + eq + ')' };
    } else if (b.type === 'figure' && (b.capMode || 'num') === 'num') {
      fig = fn !== null ? fn : fig + 1; nums[b.id] = { num: String(fig), ref: String(fig) };
    } else if (b.type === 'table' && (b.capMode || 'num') === 'num') {
      tab = fn !== null ? fn : tab + 1; nums[b.id] = { num: String(tab), ref: String(tab) };
    } else if (b.type === 'box' && b.numbered && !(L.KINDS[b.kind] || {}).fixed) {
      kindCount[b.kind] = fn !== null ? fn : (kindCount[b.kind] || 0) + 1;
      const n = (m.thmBySection ? sec[0] + '.' : '') + kindCount[b.kind];
      nums[b.id] = { num: n, ref: n };
    }
  });
  return { nums, toc, bib, lang };
};

/* Liste des cibles pouvant être référencées (pour la boîte « Référence ») */
L.refTargets = function (doc) {
  const { nums } = L.computeNumbers(doc);
  const out = [];
  L.walk(doc.blocks, b => {
    if (!nums[b.id]) return;
    let label = '', text = '';
    if (b.type === 'heading') { label = ['Section', 'Sous-section', 'Sous-sous-section'][b.level - 1] || 'Section'; text = L.plain(b.html); }
    else if (b.type === 'equation') { label = 'Équation'; text = b.latex; }
    else if (b.type === 'figure') { label = 'Figure'; text = L.plain(b.caption); }
    else if (b.type === 'table') { label = 'Tableau'; text = L.plain(b.caption); }
    else if (b.type === 'box') { label = L.kindName(b.kind, doc.meta.lang); text = b.title || L.plain((b.children[0] || {}).html || ''); }
    out.push({ id: b.id, type: b.type, label, num: nums[b.id].ref, text: (text || '').slice(0, 80) });
  });
  return out;
};

/* ---------- Texte enrichi : nettoyage / sérialisation ---------- */
const INLINE_OK = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', SUB: 'sub', SUP: 'sup', CODE: 'code' };
const CHIPS = ['imath', 'xref', 'cite', 'fn', 'timg'];

L.sanitizeNode = function (node) {
  let out = '';
  node.childNodes.forEach(n => {
    if (n.nodeType === 3) { out += L.escHtml(n.nodeValue.replace(/\u200b/g, '')); return; }
    if (n.nodeType !== 1) return;
    const cls = n.classList;
    const chip = CHIPS.find(c => cls && cls.contains(c));
    if (chip) {
      if (chip === 'imath') out += '<span class="imath" data-latex="' + L.escHtml(n.dataset.latex || '') + '"></span>';
      else if (chip === 'xref') out += '<span class="xref" data-ref="' + L.escHtml(n.dataset.ref || '') + '"></span>';
      else if (chip === 'cite') out += '<span class="cite" data-ref="' + L.escHtml(n.dataset.ref || '') + '"></span>';
      else if (chip === 'fn') out += '<span class="fn" data-text="' + L.escHtml(n.dataset.text || '') + '"></span>';
      else if (chip === 'timg') out += '<span class="timg" data-src="' + L.escHtml(n.dataset.src || '') + '" data-w="' + L.escHtml(n.dataset.w || '3') + '"></span>';
      return;
    }
    if (cls && (cls.contains('li-mark') || cls.contains('env-head-inline') || cls.contains('num') || cls.contains('pg-float'))) return;
    const col = cls && Array.from(cls).find(c => c.startsWith('c-') && L.TEXT_COLORS[c.slice(2)]);
    if (col && n.tagName === 'SPAN') { const inner = L.sanitizeNode(n); if (inner) out += '<span class="' + col + '">' + inner + '</span>'; return; }
    if (n.tagName === 'BR') { out += '<br>'; return; }
    const inner = L.sanitizeNode(n);
    const t = INLINE_OK[n.tagName];
    if (t) { if (inner) out += '<' + t + '>' + inner + '</' + t + '>'; return; }
    if (n.tagName === 'SPAN' && n.style) {
      // Chrome produit parfois des <span style="font-weight:bold">
      let s = inner;
      if (/bold|[6-9]00/.test(n.style.fontWeight)) s = '<b>' + s + '</b>';
      if (n.style.fontStyle === 'italic') s = '<i>' + s + '</i>';
      if (/underline/.test(n.style.textDecoration || n.style.textDecorationLine)) s = '<u>' + s + '</u>';
      out += s; return;
    }
    if (n.tagName === 'DIV' || n.tagName === 'P') { out += (out && !out.endsWith('<br>') ? '<br>' : '') + inner; return; }
    out += inner;
  });
  return out;
};

L.serializeRich = function (el) {
  let s = L.sanitizeNode(el);
  s = s.replace(/(<br>)+$/, '');
  return s;
};

L.plain = function (html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  d.querySelectorAll('.imath').forEach(x => { x.textContent = '[' + (x.dataset.latex || '') + ']'; });
  return d.textContent.replace(/\s+/g, ' ').trim();
};

L.isEmptyHtml = html => !html || !String(html).replace(/<br>/g, '').replace(/&nbsp;|\s/g, '').length;

/* Décale les cases fusionnées quand on insère (+1) ou supprime (-1) une ligne à partir de « from » */
L.shiftSpans = function (b, from, delta) {
  if (!b.spans) return;
  const out = {};
  for (const [k, v] of Object.entries(b.spans)) {
    const [r, c] = k.split(':').map(Number);
    if (delta < 0 && r === from) continue;
    out[(r >= from ? r + delta : r) + ':' + c] = v;
  }
  b.spans = out;
};

/* Nom affiché devant le numéro des légendes : « Table 1 – », « Tableau 1 – »… */
L.capName = function (meta, kind) {
  const custom = (kind === 'table' ? meta.tableName : meta.figureName) || '';
  return { text: custom.trim() || (L.NAMES[meta.lang] || L.NAMES.fr)[kind], custom: !!custom.trim() };
};

/* Premier numéro de page (peut être 0) */
L.pageStart = m => (m.pageStart === '' || m.pageStart === null || m.pageStart === undefined || isNaN(+m.pageStart)) ? 1 : Math.trunc(+m.pageStart);
