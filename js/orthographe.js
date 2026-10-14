/* Correcteur : fautes d'orthographe soulignées en rouge, de grammaire et de conjugaison en bleu.
   Survol ou clic droit sur un mot souligné → corrections proposées.

   - Orthographe : Hunspell + dictionnaires français (Dicollecte, ceux de LibreOffice / Firefox)
     et anglais, dans un worker (vendor/hunspell/) : tout se passe sur l'ordinateur, sans connexion.
   - Grammaire et conjugaison : service en ligne LanguageTool, seulement si l'utilisateur l'a
     accepté (le texte du document lui est alors envoyé, jamais les informations de la page de
     titre). Seules les vraies fautes sont gardées (pas le style ni la typographie).
   - Option « Corriger automatiquement » : un mot faux est corrigé dès que l'on passe au suivant,
     si la correction est sûre. Retaper le mot d'origine le garde tel quel (il n'est plus corrigé).
   - Si le dictionnaire ne peut pas être chargé : correcteur du système (Windows, navigateur),
     avec ses suggestions au clic droit (menu de l'application de bureau, ou du navigateur).
   Les soulignements sont dessinés avec l'API « CSS Custom Highlight » : le texte de la feuille
   n'est jamais modifié pour les afficher (pas d'effet sur l'annulation ni sur l'export). */
L.Spell = (function () {
  const LT_URL = 'https://api.languagetool.org/v2/check';
  // Règles inutiles ici : espaces et apostrophes typographiques (mis automatiquement à l'export),
  // majuscule en début de paragraphe (« où U est… » après une équation), parenthèses des formules
  const DISABLED = 'WHITESPACE_RULE,FRENCH_WHITESPACE,APOS_TYP,UNPAIRED_BRACKETS,COMMA_PARENTHESIS_WHITESPACE,DOUBLE_PUNCTUATION,UPPERCASE_SENTENCE_START';
  // Catégories de LanguageTool gardées : de vraies fautes (le style, la typographie, la ponctuation
  // et les répétitions donnaient surtout des faux positifs sur des textes scientifiques)
  const LT_CATS = new Set(['CAT_GRAMMAIRE', 'AGREEMENT', 'CAT_HOMONYMES_PARONYMES', 'CONFUSED_WORDS', 'GRAMMAR', 'CAT_ELISION', 'CAT_CONJUGAISON', 'VERB']);
  const CHIPS = '.imath, .xref, .cite, .fn, .timg, .hfill, .rtag';
  const SKIP = '.pg-float, .pg-sp, .gutter, .num, .li-mark, .env-head-inline, .collab-layer, .cmt-layer, code, .katex';
  const HL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';
  const recs = new Map();                          // champ → { text, map, ann, errs }
  const ltCache = new Map();                       // langue + texte → fautes renvoyées par LanguageTool
  const ignored = new Set();                       // fautes ignorées pendant la session (minuscules)
  const fixed = new Map();                         // fautes déjà corrigées automatiquement une fois
  const edited = new Set();                        // champs modifiés au clavier (bloc|chemin)
  let ltOk = true;                                 // LanguageTool joignable ?
  let typingField = null, typingAt = 0, lastDoc = null;
  let queue = new Set(), ltBusy = false, ltNext = 0, ltPausedUntil = 0, ltError = '', sent = [];
  let pop = null, popErr = null, hoverT = 0, hideT = 0;

  /* ---------------- Préférences ---------------- */
  const pref = (k, d) => { const v = L.store.get(k); return v === null || v === undefined || v === '' ? d : v; };
  const enabled = () => pref('lhe-spell', 'on') !== 'off';
  const grammarState = () => pref('lhe-grammar', '');            // 'on' | 'off' | '' (pas encore demandé)
  const grammarOn = () => enabled() && grammarState() === 'on';
  const autoOn = () => enabled() && pref('lhe-autofix', 'off') === 'on';
  let dict = null;
  const userDict = () => {
    if (!dict) { try { dict = new Set(JSON.parse(L.store.get('lhe-dico') || '[]')); } catch (e) { dict = new Set(); } }
    return dict;
  };
  const saveDict = () => L.store.set('lhe-dico', JSON.stringify([...userDict()]));
  const lang = () => ((App.doc && App.doc.meta.lang) === 'en' ? 'en' : 'fr');
  const nrm = s => String(s || '').replace(/[’']/g, '\'').replace(/[\u00a0\u202f]/g, ' ');
  const fkey = f => (f.dataset.b || '') + '|' + (f.dataset.f || '');

  /* ---------------- Dictionnaire local (worker Hunspell) ---------------- */
  const Dict = (function () {
    let w = null, state = 'off', seq = 0, askT = 0;   // state : off | loading | ready | failed
    const pend = new Map(), bad = new Map(), sugg = new Map(), ask = new Set(), waiters = new Set();
    function start() {
      if (state !== 'off') return;
      state = 'loading';
      try {
        w = new Worker('vendor/hunspell/hunspell-worker.js');
        w.onmessage = e => { const p = pend.get(e.data && e.data.id); if (p) { pend.delete(e.data.id); p(e.data); } };
        w.onerror = () => fail();
        call({ op: 'init' }, 30000).then(r => { if (r && r.ok && r.langs && r.langs.length) { state = 'ready'; applyNative(); refresh(); } else fail(); });
      } catch (e) { fail(); }
    }
    function fail() {
      if (state === 'failed') return;
      state = 'failed';
      try { if (w) w.terminate(); } catch (e) {}
      pend.forEach(p => p(null)); pend.clear();
      applyNative(); refresh();
    }
    function call(m, ms = 8000) {
      return new Promise(res => {
        if (!w || state === 'failed') return res(null);
        m.id = ++seq; pend.set(m.id, res);
        try { w.postMessage(m); } catch (e) { pend.delete(m.id); return res(null); }
        setTimeout(() => { if (pend.has(m.id)) { pend.delete(m.id); res(null); } }, ms);
      });
    }
    // true : faute ; false : correct ; undefined : pas encore vérifié (demandé, le champ sera revu)
    function isBad(word, field) {
      const k = lang() + '|' + word;
      if (bad.has(k)) return bad.get(k);
      ask.add(word);
      if (field) waiters.add(field);
      if (!askT) askT = setTimeout(flush, 10);
      return undefined;
    }
    async function flush() {
      askT = 0;
      if (state !== 'ready' || !ask.size) return;   // sinon : revu quand le dictionnaire sera prêt
      const words = [...ask], fields = [...waiters], lg = lang();
      ask.clear(); waiters.clear();
      const r = await call({ op: 'check', words, lang: lg });
      if (!r || !r.bad) return;
      if (bad.size > 60000) bad.clear();
      words.forEach((x, i) => bad.set(lg + '|' + x, !!r.bad[i]));
      fields.forEach(f => { if (f.isConnected) check(f, true); });
    }
    async function checkNow(word) {
      const k = lang() + '|' + word;
      if (bad.has(k)) return bad.get(k);
      const r = await call({ op: 'check', words: [word], lang: lang() });
      if (!r || !r.bad) return false;
      bad.set(k, !!r.bad[0]);
      return !!r.bad[0];
    }
    async function suggest(word) {
      const k = lang() + '|' + word;
      if (sugg.has(k)) return sugg.get(k);
      const r = await call({ op: 'suggest', word, lang: lang() }, 6000);
      if (!r || !r.list) return [];
      const list = r.list.filter(s => s !== word);
      if (sugg.size > 3000) sugg.clear();
      sugg.set(k, list);
      return list;
    }
    return { start, isBad, checkNow, suggest, ready: () => state === 'ready', failed: () => state === 'failed' };
  })();

  /* L'orthographe est-elle soulignée par nous (et non par le correcteur du système) ? */
  const ownsSpelling = () => enabled() && (!Dict.failed() || (grammarOn() && ltOk));
  const nativeSpell = () => enabled() && !ownsSpelling();
  // Informations personnelles de la page de titre (auteurs, établissement, groupe, date) :
  // jamais envoyées en ligne, et pas vérifiées (des noms propres)
  const personal = f => f.dataset.b === 'meta' && /^(author|institution|extra|date)$/.test(f.dataset.f || '');

  /* ---------------- Texte d'un champ ---------------- */
  // Le texte vérifié, et pour chaque caractère sa place dans la page (nœud texte + position).
  // Les formules et renvois deviennent un caractère « ¤ » (lu « x », « (1) »… par LanguageTool).
  function model(field) {
    let text = '';
    const map = [];
    const ann = [];
    let buf = '';
    const flush = () => { if (buf) { ann.push({ text: buf }); buf = ''; } };
    const walk = node => {
      for (let n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) {
          const v = n.nodeValue;
          for (let i = 0; i < v.length; i++) {
            const c = v[i];
            if (c === '\u200b' || c === '\ue000') continue;
            const t = c === '\u00a0' || c === '\u202f' ? ' ' : c;
            text += t; map.push([n, i]); buf += t;
          }
        } else if (n.nodeType === 1) {
          if (n.matches(CHIPS)) {
            const k = n.classList;
            const say = k.contains('imath') ? 'x' : k.contains('xref') ? '(1)' : k.contains('cite') ? '[1]' : '';
            if (say) { flush(); ann.push({ markup: '¤', interpretAs: say }); text += '¤'; map.push(null); }
            continue;
          }
          if (n.matches(SKIP)) {
            if (n.matches('code')) {
              const len = n.textContent.length || 1;
              flush(); ann.push({ markup: '¤'.repeat(len), interpretAs: 'code' });
              text += '¤'.repeat(len); for (let i = 0; i < len; i++) map.push(null);
            }
            continue;
          }
          if (n.tagName === 'BR') { text += '\n'; map.push(null); buf += '\n'; continue; }
          walk(n);
        }
      }
    };
    walk(field);
    flush();
    return { text, map, ann };
  }
  function rangeOf(rec, start, end) {
    const a = rec.map[start], b = rec.map[end - 1];
    if (!a || !b || !a[0].isConnected || !b[0].isConnected) return null;
    const r = new Range();
    try { r.setStart(a[0], a[1]); r.setEnd(b[0], b[1] + 1); } catch (e) { return null; }
    return r;
  }
  const fieldsAll = () => L.$$('#paper [data-f]').filter(f => f.dataset.f !== 'code' && f.isContentEditable !== false && !f.closest('.code-edit, .tikz-src') && !personal(f));
  // Position du curseur dans le texte du champ (-1 si ailleurs)
  function caretIndex(rec, field) {
    const s = window.getSelection();
    if (!s.rangeCount || !s.isCollapsed || !field.contains(s.anchorNode)) return -1;
    const n = s.anchorNode, o = s.anchorOffset;
    if (n.nodeType !== 3) return -1;
    let i = rec.map.findIndex(p => p && p[0] === n && p[1] >= o);
    if (i < 0) { i = rec.map.findIndex(p => p && p[0] === n && p[1] === o - 1); return i < 0 ? -1 : i + 1; }
    return i;
  }

  /* ---------------- Orthographe ---------------- */
  const WORD = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;
  const ELISION = /^(?:[ldjmtsnc]|qu|lorsqu|puisqu|jusqu|quoiqu|presqu)['’](?=\p{L})/iu;
  // Abréviations et unités courantes en sciences (pas dans les dictionnaires, ou pas toujours)
  const ABBR = new Set('ième ème nde cm mm km nm µm dm kg mg µg ms µs ns min mol mmol rad sr lm lx kj kwh wh mah ppm dpi ln log lg exp lim sup inf max arccos arcsin arctan cotan ch sh th argch argsh argth cf etc ie eg vs resp ssi càd cad nb ex id tr mn ml cl dl hl kpa hpa mpa mbar bar cal kcal ev kev mev gev hz khz mhz ghz db mv kv µv ma µa ka mw kw mj gj'.split(' '));
  // Vocabulaire scientifique absent du dictionnaire (relevé sur toute la banque de sujets)
  const SCIENCE = new Set('trigonaliser trigonalisable trigonalisables trigonalisé trigonalisée trigonalisés trigonalisées orthonormaliser orthonormalisé orthonormalisée orthonormalisés orthonormalisées orthodiagonalisable orthodiagonalisables orthodiagonaliser diagonalisabilité diagonalisabilitée diagonalisabilités diagonalisabilitées trigonalisabilité trigonalisabilitée trigonalisabilités trigonalisabilitées aquaponique aquaponiques autocollimation autocollimations autocollimateur autocollimateurs coplanarité coplanaritée coplanarités coplanaritées équicontinuité équicontinuitée équicontinuités équicontinuitées primitivable primitivables selfique selfiques diastéréoisomère diastéréoisomères diastéréo-isomère diastéréo-isomères'.split(' '));
  const ROMAN = /^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
  function skipWord(w) {
    if (w.length < 2) return true;
    if (/\d/.test(w)) return true;
    if (w === w.toUpperCase()) return true;                                // sigles : TP, PCSI, ARQS…
    if (/.\p{Lu}/u.test(w.replace(/^\p{Lu}+['’]/u, ''))) return true;     // mA, kOhm, NaCl, CamelCase
    const k = w.toLowerCase();
    return ABBR.has(k) || SCIENCE.has(k) || ROMAN.test(k) || /^\p{L}-\p{L}/u.test(w);   // n-ième, k-uplet
  }
  // Début de phrase ? (sinon, un mot en majuscule est un nom propre : Ohm, Joffre…)
  function sentenceStart(text, s) {
    let i = s - 1;
    while (i >= 0 && /[\s«"“(—–\-']/.test(text[i])) i--;
    return i < 0 || /[.!?:…\n]/.test(text[i]);
  }
  // Le mot fait-il partie d'une adresse, d'un nom de fichier, d'un chemin… ?
  function inLink(text, s, e) {
    let a = s, b = e;
    while (a > 0 && !/\s/.test(text[a - 1])) a--;
    while (b < text.length && !/\s/.test(text[b])) b++;
    const chunk = text.slice(a, b);
    return /(:\/\/|www\.|@|\/|\\|\w\.\w{2,}\b)/.test(chunk);
  }
  function skipAt(text, w, s, e) {
    if (skipWord(w)) return true;
    if (/¤[-'’]?$/.test(text.slice(Math.max(0, s - 2), s)) || /^[-'’]?¤/.test(text.slice(e, e + 2))) return true;   // collé à une formule (m², n-ième…)
    if (/^\p{Lu}/u.test(w) && !sentenceStart(text, s)) return true;       // nom propre
    if (inLink(text, s, e)) return true;
    return false;
  }
  function spellErrors(rec, field) {
    if (Dict.failed()) return [];
    const out = [], ud = userDict(), text = rec.text;
    // Le mot en cours de frappe n'est pas signalé tout de suite
    const caret = field === typingField && Date.now() - typingAt < 2500 ? caretIndex(rec, field) : -1;
    for (const m of text.matchAll(WORD)) {
      const el = ELISION.exec(m[0]), cut = el ? el[0].length : 0;
      const w = m[0].slice(cut), s = m.index + cut, e = s + w.length;
      if (!w || skipAt(text, w, s, e)) continue;
      const k = w.toLowerCase();
      if (ud.has(k) || ignored.has('sp:' + k)) continue;
      if (caret >= s && caret <= e) continue;
      if (Dict.isBad(w, field)) out.push({ kind: 'sp', start: s, end: e, word: w });
    }
    return out;
  }

  /* ---------------- Grammaire (LanguageTool, en ligne) ---------------- */
  const ltLang = () => (lang() === 'en' ? 'en-US' : 'fr');
  const ltKey = rec => ltLang() + '\u0001' + rec.text;
  // Une formule juste avant (même proposition, ≤ 4 mots) : LanguageTool la lit « x », un masculin,
  // et signale à tort « f est croissante », « la suite est décroissante »…
  function nearFormula(text, s) {
    const before = text.slice(Math.max(0, s - 60), s);
    const seg = before.split(/[.!?;:,]\s|\n/).pop();
    const i = seg.lastIndexOf('¤');
    return i >= 0 && seg.slice(i + 1).trim().split(/\s+/).filter(Boolean).length <= 4;
  }
  function ltErrors(rec) {
    const ms = ltCache.get(ltKey(rec));
    if (!ms) return null;
    const out = [], text = rec.text;
    ms.forEach(m => {
      const cat = m.rule.category.id;
      const spell = m.rule.issueType === 'misspelling' || cat === 'TYPOS';
      if (spell && !Dict.failed()) return;                    // l'orthographe : dictionnaire local
      if (!spell && !LT_CATS.has(cat)) return;                // style, typographie… : pas des fautes
      const s = m.offset, e = m.offset + m.length, w = text.slice(s, e);
      if (!w.trim() || w.includes('¤')) return;
      if (/[\/¤]/.test(text[s - 1] || '') || /[\/¤]/.test(text[e] || '')) return;   // acide/base, formules collées
      if (spell && (skipAt(text, w, s, e) || userDict().has(w.toLowerCase()))) return;
      if (!spell && nearFormula(text, s)) return;
      const key = spell ? 'sp:' + w.toLowerCase() : 'gr:' + m.rule.id + ':' + w.toLowerCase();
      if (ignored.has(key)) return;
      out.push({ lt: true, fresh: true, key, kind: spell ? 'sp' : 'gr', start: s, end: e, word: w, msg: m.message, cat: m.rule.category.name, catId: cat, rule: m.rule.id,
        reps: (m.replacements || []).slice(0, 6).map(r => r.value).filter(v => !v.includes('¤')) });
    });
    return out;
  }
  // Titres (document, sections) : pas de verbe, la grammaire s'y trompe (« Devoir surveillé » lu comme le verbe devoir)
  const grammarField = f => !personal(f) && !(f.dataset.b === 'meta') && !f.closest('.blk[data-type="heading"]');
  function queueLT(field) { if (grammarOn() && grammarField(field)) { queue.add(field); pumpSoon(); } }
  const pumpSoon = L.debounce(() => pump(), 900);
  async function pump() {
    if (ltBusy || !grammarOn()) return;
    const now = Date.now();
    if (now < ltPausedUntil || now < ltNext) { setTimeout(pump, Math.max(ltPausedUntil, ltNext) - now + 50); return; }
    // On regroupe plusieurs champs dans une requête (≈ 6 000 caractères au plus)
    const batch = [];
    let size = 0;
    for (const f of queue) {
      queue.delete(f);
      if (!f.isConnected) continue;
      const rec = recs.get(f);
      if (!rec || !rec.text.trim() || ltCache.has(ltKey(rec))) { if (rec) check(f, true); continue; }
      if (batch.length && size + rec.text.length > 6000) { queue.add(f); break; }
      batch.push([f, rec]); size += rec.text.length;
      if (size > 6000) break;
    }
    if (!batch.length) { status(); return; }
    // Service gratuit : au plus ≈ 60 000 caractères envoyés par minute
    const t0 = Date.now();
    sent = sent.filter(([t]) => t0 - t < 60000);
    const used = sent.reduce((n, [, k]) => n + k, 0);
    if (sent.length && used + size > 60000) {
      batch.forEach(([f]) => queue.add(f));
      setTimeout(pump, sent[0][0] + 60000 - t0 + 100);
      return;
    }
    sent.push([t0, size]);
    ltBusy = true; status();
    const ann = [], bases = [];
    let pos = 0;
    batch.forEach(([f, rec], i) => {
      if (i) { ann.push({ markup: '\n\n', interpretAs: '\n\n' }); pos += 2; }
      bases.push(pos);
      ann.push(...rec.ann); pos += rec.text.length;
    });
    const lg = ltLang();
    try {
      const body = new URLSearchParams({ language: lg, data: JSON.stringify({ annotation: ann }), disabledRules: DISABLED });
      const r = await fetch(LT_URL, { method: 'POST', body, headers: { Accept: 'application/json' } });
      ltNext = Date.now() + 3200;                  // ≈ 18 requêtes par minute au plus
      if (r.status === 429) { ltPausedUntil = Date.now() + 60000; batch.forEach(([f]) => queue.add(f)); ltError = 'Trop de vérifications : nouvel essai dans une minute.'; }
      else if (!r.ok) throw new Error('HTTP ' + r.status);
      else {
        const j = await r.json();
        ltError = '';
        setLt(true);
        batch.forEach(([f, rec], i) => {
          const a = bases[i], b = a + rec.text.length;
          ltCache.set(lg + '\u0001' + rec.text, (j.matches || []).filter(m => m.offset >= a && m.offset + m.length <= b).map(m => Object.assign({}, m, { offset: m.offset - a })));
        });
        if (ltCache.size > 3000) { const it = ltCache.keys(); for (let k = 0; k < 500; k++) ltCache.delete(it.next().value); }
        batch.forEach(([f]) => { if (f.isConnected) { check(f, true); autoFixGrammar(f); } });
      }
    } catch (e) {
      ltError = navigator.onLine === false ? 'Hors connexion : la grammaire sera vérifiée au retour de la connexion.' : 'Vérification de la grammaire indisponible pour le moment.';
      ltPausedUntil = Date.now() + 30000;
      batch.forEach(([f]) => queue.add(f));
      setLt(false);
    }
    ltBusy = false;
    status();
    if (queue.size) pump();
  }
  // LanguageTool injoignable : si le dictionnaire local manque aussi, le correcteur du système reprend
  function setLt(v) { if (ltOk === v) return; ltOk = v; applyNative(); paintSoon(); }

  /* ---------------- Vérification et affichage ---------------- */
  // En attendant la nouvelle vérification d'un texte modifié, les fautes de grammaire trouvées avant
  // restent affichées si elles sont avant ou après l'endroit modifié (décalées d'autant)
  function remap(prev, text) {
    const a = prev.text, n = Math.min(a.length, text.length);
    let p = 0, s = 0;
    while (p < n && a[p] === text[p]) p++;
    while (s < n - p && a[a.length - 1 - s] === text[text.length - 1 - s]) s++;
    const d = text.length - a.length;
    return prev.errs.filter(e => e.lt).map(e => e.end <= p ? Object.assign({}, e, { fresh: false })
      : e.start >= a.length - s ? Object.assign({}, e, { start: e.start + d, end: e.end + d, fresh: false }) : null).filter(Boolean);
  }
  function check(field, noLT) {
    if (!enabled() || !field.isConnected || personal(field)) { recs.delete(field); return; }
    const prev = recs.get(field);
    const m = model(field);
    const rec = { field, text: m.text, map: m.map, ann: m.ann, errs: [] };
    recs.set(field, rec);
    let lt = grammarOn() && grammarField(field) ? ltErrors(rec) : [];
    if (lt === null) {
      if (!noLT) queueLT(field);
      lt = !prev ? [] : prev.text === rec.text ? prev.errs.filter(e => e.lt).map(e => Object.assign({}, e)) : remap(prev, rec.text);
    }
    const errs = spellErrors(rec, field);
    // la faute de grammaire du mot en cours de frappe attend que la frappe s'arrête
    const caret = field === typingField && Date.now() - typingAt < 2500 ? caretIndex(rec, field) : -1;
    lt.forEach(e => { if (!(caret >= e.start && caret <= e.end) && !errs.some(x => x.start < e.end && e.start < x.end)) errs.push(e); });
    rec.errs = errs;
    rec.errs.forEach(e => { e.range = rangeOf(rec, e.start, e.end); e.field = field; });
    paintSoon();
  }
  const paintSoon = L.debounce(() => paint(), 30);
  function paint() {
    if (!HL) return;
    const sp = [], gr = [];
    for (const [f, rec] of recs) {
      if (!f.isConnected) { recs.delete(f); continue; }
      rec.errs.forEach(e => { if (e.range && !e.range.collapsed && shown(e)) (e.kind === 'sp' ? sp : gr).push(e.range); });
    }
    CSS.highlights.set('lhe-sp', new Highlight(...sp));
    CSS.highlights.set('lhe-gr', new Highlight(...gr));
    status();
  }
  // Orthographe de LanguageTool masquée quand c'est le correcteur du système qui la souligne
  const shown = e => !(e.kind === 'sp' && e.lt && !ownsSpelling());
  function clearAll() {
    recs.clear();
    if (HL) { CSS.highlights.delete('lhe-sp'); CSS.highlights.delete('lhe-gr'); }
    hidePop();
    status();
  }
  /* Tout revérifier (après un nouveau rendu de la feuille) */
  const refresh = L.debounce(() => {
    applyNative();
    if (!enabled() || !App.doc) { clearAll(); return; }
    Dict.start();
    if (App.doc !== lastDoc) { lastDoc = App.doc; edited.clear(); }
    recs.clear();
    fieldsAll().forEach(f => check(f));
    paint();
    maybeAsk();
  }, 250);
  // Champ modifié : orthographe aussitôt (sauf le mot en cours), grammaire une fois la frappe finie
  const pendingInput = new Set();
  const inputSoon = L.debounce(() => { pendingInput.forEach(f => check(f)); pendingInput.clear(); }, 350);
  function onInput(field, ev) {
    if (!enabled() || !field || field.dataset.f === 'code' || personal(field)) return;
    typingField = field; typingAt = Date.now();
    edited.add(fkey(field));
    pendingInput.add(field);
    inputSoon();
    // Correction automatique : le mot qui vient d'être fini (espace, ponctuation)
    if (autoOn() && ev && ev.inputType === 'insertText' && ev.data && /^[\s\u00a0.,;:!?…)\]»"]$/.test(ev.data)) autoFixWord(field);
  }
  // Le curseur quitte le mot tapé : il peut maintenant être signalé
  const onCaretMove = L.debounce(() => {
    if (!typingField || !typingField.isConnected) return;
    const s = window.getSelection();
    const away = !s.rangeCount || !typingField.contains(s.anchorNode);
    if (away || Date.now() - typingAt > 2500) { const f = typingField; typingField = null; check(f); }
    else check(typingField, true);
  }, 500);
  function applyNative() {
    const nat = nativeSpell() ? 'true' : 'false';
    L.$$('#paper [data-f]').forEach(f => { if (f.dataset.f !== 'code' && f.getAttribute('spellcheck') !== nat) f.setAttribute('spellcheck', nat); });
  }

  /* ---------------- Correction automatique ---------------- */
  // Distance d'édition (avec inversion de deux lettres voisines)
  function dist(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  const bare = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/(.)\1+/g, '$1');
  const sameCase = (w, s) => (/^\p{Lu}/u.test(w) ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  // La correction est-elle sûre ? (accent, lettre doublée, ou une seule proposition très proche)
  function safeFix(w, list) {
    const c = list.filter(s => !/\s/.test(s) && s.includes('-') === w.includes('-'));
    if (!c.length) return null;
    const best = c[0];
    if (bare(best) === bare(w)) return sameCase(w, best);
    const lw = w.toLowerCase(), d = dist(lw, best.toLowerCase());
    if (d > (w.length >= 8 ? 2 : 1)) return null;
    if (c.slice(1, 5).some(s => dist(lw, s.toLowerCase()) <= d)) return null;   // plusieurs candidats : on ne choisit pas
    return sameCase(w, best);
  }
  const replaceIn = (node, a, b, v) => node.replaceData(a, b - a, v);
  async function autoFixWord(field) {
    const s = window.getSelection();
    if (!s.rangeCount || !s.isCollapsed) return;
    const node = s.anchorNode, off = s.anchorOffset;
    if (!node || node.nodeType !== 3 || !field.contains(node) || off < 2) return;
    const v = node.nodeValue;
    let b = off - 1, a = b;                                     // v[b] : le séparateur tapé
    while (a > 0 && /[\p{L}\p{M}'’\-]/u.test(v[a - 1])) a--;
    while (a < b && /['’\-]/.test(v[a])) a++;
    while (b > a && /['’\-]/.test(v[b - 1])) b--;
    const el = ELISION.exec(v.slice(a, b));
    if (el) a += el[0].length;
    const w = v.slice(a, b);
    if (!w || (a === 0 && node.previousSibling && !/\s$/.test(node.previousSibling.textContent || ''))) return;   // le mot commence ailleurs
    // le mot dans le texte complet du champ (formule voisine, début de phrase…)
    const rec = model(field), at = rec.map.findIndex(p => p && p[0] === node && p[1] === a), k = w.toLowerCase();
    if (at < 0 || skipAt(rec.text, w, at, at + w.length) || userDict().has(k) || ignored.has('sp:' + k)) return;
    // Mot retapé après une correction automatique : l'utilisateur le veut ainsi
    if (fixed.has('sp:' + k)) { ignored.add('sp:' + k); check(field, true); return; }
    if (!Dict.ready() || !(await Dict.checkNow(w))) return;
    const best = safeFix(w, await Dict.suggest(w));
    if (!best || best === w || !node.isConnected || node.nodeValue.slice(a, b) !== w) return;
    App.commit();                                               // Ctrl+Z revient au mot tapé
    replaceIn(node, a, b, best);
    fixed.set('sp:' + k, best);
    App.syncField(field);
    App.commit();
    notice([[w, best]], ['sp:' + k]);
    check(field, true);
  }
  // Grammaire : seulement dans les champs tapés pendant la session, hors de la phrase en cours,
  // et quand LanguageTool ne propose qu'une seule correction
  function autoFixGrammar(field) {
    if (!autoOn() || !grammarOn() || !edited.has(fkey(field)) || !field.isContentEditable) return;
    const rec = recs.get(field);
    if (!rec) return;
    let limit = Infinity;
    const c = caretIndex(rec, field);
    if (c >= 0) { const m = rec.text.slice(0, c).match(/^[\s\S]*[.!?…](\s|$)/); limit = m ? m[0].length : 0; }
    const todo = [], kept = [];
    rec.errs.forEach(e => {
      if (e.kind !== 'gr' || !e.fresh || !e.reps || e.reps.length !== 1 || e.end > limit) return;
      if (fixed.has(e.key)) { ignored.add(e.key); kept.push(e); return; }   // remise telle quelle après correction
      if (e.range && nrm(e.range.toString()) === nrm(e.word)) todo.push(e);
    });
    if (kept.length && !todo.length) { check(field, true); return; }
    if (!todo.length) return;
    App.commit();
    const done = [], keys = [];
    todo.sort((x, y) => y.start - x.start).forEach(e => {
      replaceRange(e.range, e.reps[0]);
      fixed.set(e.key, e.reps[0]);
      done.push([e.word, e.reps[0]]); keys.push(e.key);
    });
    App.syncField(field);
    App.commit();
    notice(done.reverse(), keys);
    check(field, true);
  }
  // Rappel discret dans la barre d'état, avec « Annuler » (qui garde aussi le mot d'origine)
  let noteT = 0;
  function notice(list, keys) {
    const el = L.$('#autofixNote');
    if (!el) return;
    const txt = list.length === 1 ? '« ' + list[0][0] + ' » → « ' + list[0][1] + ' »' : list.length + ' fautes corrigées';
    el.replaceChildren(L.h('span', { class: 'sb-ok' }, L.svg('check', 13)), L.h('span', { text: 'Corrigé : ' + txt }),
      L.h('button', { class: 'sb-undo', text: 'Annuler', onclick: () => { keys.forEach(k => ignored.add(k)); el.hidden = true; App.undo(); } }));
    el.title = list.map(([a, b]) => a + ' → ' + b).join('\n') + '\nPour garder votre orthographe, retapez simplement le mot.';
    el.hidden = false;
    clearTimeout(noteT);
    noteT = setTimeout(() => { el.hidden = true; }, 7000);
  }

  /* ---------------- Barre d'état ---------------- */
  function counts() {
    let sp = 0, gr = 0;
    for (const rec of recs.values()) rec.errs.forEach(e => { if (e.range && !e.range.collapsed && shown(e)) { if (e.kind === 'sp') sp++; else gr++; } });
    return { sp, gr };
  }
  function status() {
    const b = L.$('#spellStatus');
    if (!b) return;
    if (!enabled()) { b.hidden = true; return; }
    if (!ownsSpelling()) {
      // l'orthographe est soulignée par le correcteur du système : pas de décompte possible
      b.classList.remove('has');
      if (grammarOn() && !ltOk) { b.hidden = false; b.replaceChildren(L.h('span', { class: 'sb-dot wait' }), 'Grammaire hors connexion'); b.title = ltError || 'LanguageTool est injoignable pour le moment.'; }
      else if (!grammarState()) { b.hidden = false; b.replaceChildren(L.h('span', { class: 'sb-dot gr' }), 'Activer la grammaire'); b.title = 'Souligner aussi les fautes de grammaire et de conjugaison (en bleu)'; }
      else b.hidden = true;
      return;
    }
    const { sp, gr } = counts();
    const busy = !Dict.ready() && !Dict.failed() || ltBusy || (grammarOn() && queue.size > 0);
    b.hidden = false;
    const parts = [];
    if (sp) parts.push(L.h('span', { class: 'sb-dot sp' }), gr ? sp + ' orthographe' : sp + (sp > 1 ? ' fautes d\'orthographe' : ' faute d\'orthographe'));
    if (gr) parts.push(L.h('span', { class: 'sb-dot gr' + (sp ? ' sep' : '') }), sp ? gr + ' grammaire' : gr + (gr > 1 ? ' fautes de grammaire' : ' faute de grammaire'));
    if (!sp && !gr) parts.push(busy ? L.h('span', { class: 'sb-dot wait' }) : L.h('span', { class: 'sb-ok' }, L.svg('check', 13)), busy ? 'Vérification…' : 'Aucune faute');
    b.replaceChildren(...parts);
    b.classList.toggle('has', !!(sp || gr));
    b.title = (sp || gr ? 'Aller à la faute suivante (survolez un mot souligné pour le corriger)' : 'Orthographe' + (grammarOn() ? ' et grammaire' : '') + ' vérifiées')
      + (ltError ? '\n' + ltError : '') + (grammarState() !== 'on' ? '\nGrammaire : désactivée (cliquez pour l\'activer)' : '');
  }
  function nextError() {
    const all = [];
    for (const rec of recs.values()) rec.errs.forEach(e => { if (e.range && !e.range.collapsed && shown(e)) all.push(e); });
    if (!all.length) { if (grammarState() !== 'on' && enabled()) ask(true); return; }
    all.sort((a, b) => a.range.compareBoundaryPoints(Range.START_TO_START, b.range));
    const s = window.getSelection();
    const cur = s.rangeCount ? s.getRangeAt(0) : null;
    const e = all.find(x => cur && x.range.compareBoundaryPoints(Range.START_TO_END, cur) > 0 && !(x.range.isPointInRange(cur.startContainer, cur.startOffset))) || all[0];
    const r = e.range.getBoundingClientRect(), d = L.$('#desk').getBoundingClientRect();
    if (r.top < d.top + 60 || r.bottom > d.bottom - 140) L.$('#desk').scrollBy({ top: r.top - d.top - d.height / 3 });
    e.field.focus({ preventScroll: true });
    const sel = new Range(); sel.setStart(e.range.endContainer, e.range.endOffset); sel.collapse(true);
    s.removeAllRanges(); s.addRange(sel);
    setTimeout(() => showPop(e), 60);
  }

  /* ---------------- Bulle de correction ---------------- */
  function errAt(x, y) {
    if (!recs.size) return null;
    let node;
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (!p) return null; node = p.offsetNode; }
    else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (!r) return null; node = r.startContainer; }
    if (!node) return null;
    const field = (node.nodeType === 1 ? node : node.parentElement)?.closest('[data-f]');
    const rec = field && recs.get(field);
    if (!rec) return null;
    for (const e of rec.errs) {
      if (!e.range || e.range.collapsed || !shown(e)) continue;
      // le pointeur doit être vraiment sur le mot (pas seulement au plus près)
      for (const rc of e.range.getClientRects()) if (x >= rc.left - 1 && x <= rc.right + 1 && y >= rc.top - 2 && y <= rc.bottom + 3) return e;
    }
    return null;
  }
  function hidePop() { if (pop) { pop.hidden = true; pop.replaceChildren(); } popErr = null; clearTimeout(hoverT); }
  function placePop(r) {
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function repsBox(list, onPick) {
    return list.length
      ? L.h('div', { class: 'spp-reps' }, ...list.map(v => L.h('button', { class: 'spp-rep', text: v || '(supprimer)', title: 'Remplacer par « ' + v + ' »', onmousedown: ev => ev.preventDefault(), onclick: () => onPick(v) })))
      : L.h('div', { class: 'spp-none', text: 'Aucune suggestion.' });
  }
  function showPop(e) {
    pop = pop || L.$('#spellPop');
    if (!pop || !e.range) return;
    popErr = e;
    const spell = e.kind === 'sp';
    const msg = spell ? (e.msg && !/orthographe|faute de frappe|spelling/i.test(e.msg) ? e.msg : 'Ce mot n\'est pas dans le dictionnaire.') : e.msg;
    const title = spell ? 'Orthographe' : (e.cat && !/^(grammaire|grammar)$/i.test(e.cat) ? e.cat : 'Grammaire');
    const key = e.key || (spell ? 'sp:' + e.word.toLowerCase() : 'gr:' + e.rule + ':' + e.word.toLowerCase());
    const reps = e.reps ? repsBox(e.reps, v => apply(e, v)) : L.h('div', { class: 'spp-none', text: 'Recherche de suggestions…' });
    pop.replaceChildren(...[
      L.h('div', { class: 'spp-h' }, L.h('span', { class: 'spp-dot ' + e.kind }), L.h('b', { text: title }),
        L.h('button', { class: 'spp-x', title: 'Fermer', onclick: hidePop }, L.svg('x', 13))),
      L.h('div', { class: 'spp-msg', text: msg || '' }),
      reps,
      L.h('div', { class: 'spp-acts' },
        L.h('button', { text: 'Ignorer', title: 'Ne plus signaler ' + (spell ? 'ce mot' : 'cette faute') + ' jusqu\'à la fermeture de l\'application', onclick: () => { ignored.add(key); hidePop(); recheck(); } }),
        spell ? L.h('button', { text: 'Ajouter au dictionnaire', title: 'Ce mot ne sera plus jamais signalé', onclick: () => { userDict().add(e.word.toLowerCase()); saveDict(); hidePop(); recheck(); L.toast('« ' + e.word + ' » ajouté au dictionnaire'); } }) : null),
      !spell ? L.h('div', { class: 'spp-foot', text: 'Grammaire vérifiée par LanguageTool' }) : null].filter(Boolean));
    pop.hidden = false;
    placePop(e.range.getBoundingClientRect());
    // Suggestions du dictionnaire (calculées en arrière-plan)
    if (!e.reps) Dict.suggest(e.word).then(list => {
      e.reps = list.slice(0, 6);
      if (popErr === e && !pop.hidden) { reps.replaceWith(repsBox(e.reps, v => apply(e, v))); placePop(e.range.getBoundingClientRect()); }
    });
  }
  // La faute est-elle toujours à sa place ? Sinon on la retrouve dans le texte actuel du champ
  function locate(e) {
    if (e.range && !e.range.collapsed && nrm(e.range.toString()) === nrm(e.word)) return e.range;
    if (!e.field || !e.field.isConnected) return null;
    const rec = model(e.field), target = nrm(e.word), t = nrm(rec.text);
    let best = -1, bd = Infinity;
    for (let i = t.indexOf(target); i >= 0; i = t.indexOf(target, i + 1)) { const d = Math.abs(i - (e.start || 0)); if (d < bd) { bd = d; best = i; } }
    return best >= 0 ? rangeOf(rec, best, best + target.length) : null;
  }
  function replaceRange(r, v) {
    const sc = r.startContainer, o = r.startOffset;
    if (sc.nodeType === 3) {
      if (sc === r.endContainer) { sc.replaceData(o, r.endOffset - o, v); return [sc, o + v.length]; }
      const rest = new Range();
      rest.setStart(sc, sc.length); rest.setEnd(r.endContainer, r.endOffset);
      rest.deleteContents();
      sc.replaceData(o, sc.length - o, v);
      return [sc, o + v.length];
    }
    r.deleteContents();
    const t = document.createTextNode(v);
    r.insertNode(t);
    return [t, v.length];
  }
  function applyRange(field, r, v) {
    if (!field.isConnected || !field.isContentEditable) return;   // lecture seule : rien à modifier
    const [n, o] = replaceRange(r, v);
    const s = window.getSelection(), c = new Range();
    c.setStart(n, Math.min(n.length, o)); c.collapse(true);
    field.focus({ preventScroll: true }); s.removeAllRanges(); s.addRange(c);
    App.syncField(field);
    App.commit();
    if (App.updateWordCount) App.updateWordCount();
    typingField = null;
    check(field);
  }
  function apply(e, v) {
    hidePop();
    const field = e.field;
    if (!field || !field.isConnected || !field.isContentEditable) return;
    const r = locate(e);
    if (!r) { L.toast('Le texte a changé : survolez de nouveau le mot pour le corriger.'); check(field); return; }
    applyRange(field, r, v);
  }
  function recheck() { for (const f of [...recs.keys()]) check(f); }

  /* ---------------- Proposer la grammaire (une seule fois) ---------------- */
  let asked = false;
  function maybeAsk() {
    if (asked || grammarState() || !enabled() || !App.doc) return;
    // seulement quand il y a du texte à vérifier, et pas sur l'écran d'accueil
    let n = 0;
    for (const rec of recs.values()) n += rec.text.length;
    if (n < 200) return;
    setTimeout(() => { if (!grammarState() && L.$('#modal').hidden && !(L.Home && L.Home.visible && L.Home.visible())) ask(); }, 2500);
  }
  function ask(force) {
    if (asked && !force) return;
    asked = true;
    const card = L.$('#spellCard') || document.body.appendChild(L.h('div', { id: 'spellCard', class: 'spell-card', role: 'dialog' }));
    const close = () => { card.hidden = true; };
    card.replaceChildren(
      L.h('div', { class: 'sc-h' }, L.h('span', { class: 'spp-dot gr' }), L.h('b', { text: 'Corriger aussi la grammaire ?' })),
      L.h('p', { html: 'Les fautes de <b>grammaire et de conjugaison</b> peuvent être soulignées en bleu, avec la correction proposée au survol. '
        + 'Pour cela, le texte du document est envoyé au service en ligne <b>LanguageTool</b> (gratuit, sans compte) pour être vérifié — jamais les informations de la page de titre. '
        + 'L\'orthographe (en rouge), elle, reste vérifiée sur votre ordinateur.' }),
      L.h('div', { class: 'sc-acts' },
        L.h('button', { class: 'btn primary', text: 'Activer', onclick: () => { L.store.set('lhe-grammar', 'on'); close(); refresh(); L.toast('Grammaire activée : les fautes apparaissent en bleu.'); } }),
        L.h('button', { class: 'btn', text: 'Non merci', onclick: () => { L.store.set('lhe-grammar', 'off'); close(); status(); } })),
      L.h('div', { class: 'sc-foot', text: 'Modifiable à tout moment : menu du compte → Préférences.' }));
    card.hidden = false;
  }

  /* ---------------- Préférences (fenêtre « Préférences ») ---------------- */
  function settingsSection() {
    const sw = (label, hint, val, on) => {
      const i = L.h('input', { type: 'checkbox' }); i.checked = val; i.onchange = () => on(i.checked);
      return L.h('label', { class: 'chk pref' }, i, L.h('span', null, L.h('b', { text: label }), L.h('div', { class: 'fhint', html: hint })));
    };
    const n = userDict().size;
    const box = L.h('div', { class: 'auth' },
      L.h('div', { class: 'set-h', text: 'Correcteur' }),
      sw('Souligner les fautes d\'orthographe', 'En rouge, vérifiées sur votre ordinateur. Survolez un mot souligné (ou clic droit) pour le corriger.', enabled(), v => { L.store.set('lhe-spell', v ? 'on' : 'off'); refresh(); }),
      sw('Vérifier aussi la grammaire et la conjugaison', 'En bleu. Le texte du document est envoyé au service en ligne <b>LanguageTool</b> pour être vérifié (gratuit, sans compte), jamais les informations de la page de titre.', grammarState() === 'on', v => { L.store.set('lhe-grammar', v ? 'on' : 'off'); refresh(); }),
      sw('Corriger toutes les fautes automatiquement', 'Un mot mal orthographié est corrigé dès que vous passez au suivant (et les fautes de grammaire de la phrase précédente, si la grammaire est activée), seulement quand la correction est sûre. <b>Pour garder votre orthographe, retapez simplement le mot</b> : il ne sera plus corrigé. <kbd>Ctrl</kbd>+<kbd>Z</kbd> annule une correction.', autoOn(), v => { L.store.set('lhe-autofix', v ? 'on' : 'off'); }));
    if (n) {
      const lbl = L.h('span', { class: 'fhint', text: n + (n > 1 ? ' mots ajoutés' : ' mot ajouté') + ' à votre dictionnaire.' });
      box.append(L.h('div', { class: 'row-in' }, lbl, L.h('button', { class: 'btn small', text: 'Vider le dictionnaire', onclick: e => { userDict().clear(); saveDict(); lbl.textContent = 'Dictionnaire vidé.'; e.target.remove(); recheck(); } })));
    }
    return box;
  }

  /* ---------------- Branchements ---------------- */
  function init() {
    pop = L.$('#spellPop');
    if (enabled()) Dict.start();
    const paper = L.$('#paper');
    paper.addEventListener('input', e => onInput(e.target.closest && e.target.closest('[data-f]'), e));
    document.addEventListener('selectionchange', onCaretMove);
    // Survol d'un mot souligné : la bulle s'ouvre après un court instant (suggestions préparées dès l'arrivée)
    let mm = null;
    paper.addEventListener('mousemove', ev => {
      if (!recs.size) return;
      if (mm) { mm = ev; return; }
      mm = ev;
      requestAnimationFrame(() => { const e = mm; mm = null; hover(e); });
    });
    const hover = e => {
      const er = errAt(e.clientX, e.clientY);
      clearTimeout(hoverT);
      if (er) {
        clearTimeout(hideT);
        if (er !== popErr) {
          if (er.kind === 'sp' && !er.reps) Dict.suggest(er.word);
          hoverT = setTimeout(() => showPop(er), 450);
        }
      } else if (popErr && !pop.hidden) { clearTimeout(hideT); hideT = setTimeout(() => { if (!pop.matches(':hover')) hidePop(); }, 350); }
    };
    paper.addEventListener('mouseleave', () => { clearTimeout(hoverT); clearTimeout(hideT); hideT = setTimeout(() => { if (pop && !pop.matches(':hover')) hidePop(); }, 400); });
    if (pop) pop.addEventListener('mouseleave', () => { hideT = setTimeout(hidePop, 400); });
    if (pop) pop.addEventListener('mouseenter', () => clearTimeout(hideT));
    // Clic droit sur une faute : la bulle tout de suite (à la place du menu)
    paper.addEventListener('contextmenu', e => {
      const er = errAt(e.clientX, e.clientY);
      if (!er) return;
      e.preventDefault();
      showPop(er);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop && !pop.hidden) { hidePop(); } }, true);
    document.addEventListener('mousedown', e => { if (pop && !pop.hidden && !pop.contains(e.target)) hidePop(); });
    L.$('#desk').addEventListener('scroll', () => { if (pop && !pop.hidden) hidePop(); }, { passive: true });
    const sb = L.$('#spellStatus');
    if (sb) sb.onclick = () => (grammarState() !== 'on' && !counts().sp ? ask(true) : nextError());
    window.addEventListener('online', () => { ltPausedUntil = 0; ltError = ''; pump(); });
    status();
  }

  return { init, refresh, settingsSection, nativeSpell, ownsSpelling, next: nextError, _recs: recs, _ltCache: ltCache, _dict: Dict, _safeFix: safeFix };
})();
