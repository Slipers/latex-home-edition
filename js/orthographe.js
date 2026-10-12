/* Correcteur : fautes d'orthographe soulignées en rouge, de grammaire et de conjugaison en bleu.

   - Grammaire et conjugaison (+ orthographe) : service en ligne LanguageTool, seulement si
     l'utilisateur l'a accepté (le texte du document lui est envoyé). Les fautes sont alors
     soulignées par la page : survol ou clic droit sur un mot souligné → corrections proposées.
   - Sinon (ou hors connexion) : le correcteur de Windows / macOS / du navigateur souligne
     l'orthographe ; dans l'application de bureau, le clic droit sur un mot souligné ouvre la
     même bulle de corrections (suggestions du correcteur du système).
   - Sous Linux, les dictionnaires de l'application sont interrogés directement (lheSpell).
   Les soulignements sont dessinés avec l'API « CSS Custom Highlight » : le texte de la feuille
   n'est jamais modifié pour les afficher (pas d'effet sur l'annulation ni sur l'export). */
L.Spell = (function () {
  const LT_URL = 'https://api.languagetool.org/v2/check';
  // Règles inutiles ici : espaces et apostrophes typographiques (mis automatiquement à l'export),
  // majuscule en début de paragraphe (« où U est… » après une équation), parenthèses des formules
  const DISABLED = 'WHITESPACE_RULE,FRENCH_WHITESPACE,APOS_TYP,UNPAIRED_BRACKETS,COMMA_PARENTHESIS_WHITESPACE,DOUBLE_PUNCTUATION,UPPERCASE_SENTENCE_START';
  const CHIPS = '.imath, .xref, .cite, .fn, .timg, .hfill, .rtag';
  const SKIP = '.pg-float, .pg-sp, .gutter, .num, .li-mark, .env-head-inline, .collab-layer, .cmt-layer, code, .katex';
  const HL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight === 'function';
  const local = window.lheSpell || null;          // dictionnaires de l'application de bureau
  const recs = new Map();                          // champ → { text, map, errs, lt: texte vérifié }
  const wordCache = new Map();                     // mot → faute ? (dictionnaires locaux)
  const ltCache = new Map();                       // langue + texte → fautes renvoyées par LanguageTool
  const ignored = new Set();                       // fautes ignorées pendant la session
  let localOk = null, localTries = 0;              // dictionnaires chargés ? (Linux)
  let ltOk = true;                                 // LanguageTool joignable ?
  let typingField = null, typingAt = 0;
  let queue = new Set(), ltBusy = false, ltNext = 0, ltPausedUntil = 0, ltError = '', sent = [];
  let pop = null, popErr = null, hoverT = 0, hideT = 0;

  /* ---------------- Préférences ---------------- */
  const pref = (k, d) => { const v = L.store.get(k); return v === null || v === undefined || v === '' ? d : v; };
  const enabled = () => pref('lhe-spell', 'on') !== 'off';
  const grammarState = () => pref('lhe-grammar', '');            // 'on' | 'off' | '' (pas encore demandé)
  const grammarOn = () => enabled() && grammarState() === 'on';
  let dict = null;
  const userDict = () => {
    if (!dict) { try { dict = new Set(JSON.parse(L.store.get('lhe-dico') || '[]')); } catch (e) { dict = new Set(); } }
    return dict;
  };
  const saveDict = () => L.store.set('lhe-dico', JSON.stringify([...userDict()]));
  function hasLocal() {
    if (!local) return false;
    if (localOk === null) {
      // Un mot impossible doit être signalé : sinon aucun dictionnaire n'est chargé
      try { const r = local.misspelled(['xqzwvkjrt', 'maison']); localOk = r[0] === true && r[1] === false; } catch (e) { localOk = false; }
      // nouvel essai (téléchargement en cours) ; sous Windows et macOS, jamais (correcteur du système)
      if (!localOk && ++localTries < 4) setTimeout(() => { localOk = null; }, 4000);
    }
    return localOk;
  }
  /* L'orthographe est-elle soulignée par nous (et non par le navigateur) ? */
  const ownsSpelling = () => enabled() && (hasLocal() || (grammarOn() && ltOk));
  const nativeSpell = () => enabled() && !ownsSpelling();

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
            text += c === '\u00a0' || c === '\u202f' ? ' ' : c; map.push([n, i]); buf += c === '\u00a0' || c === '\u202f' ? ' ' : c;
          }
        } else if (n.nodeType === 1) {
          if (n.matches(CHIPS)) {
            const k = n.classList;
            const say = k.contains('imath') ? 'x' : k.contains('xref') ? '(1)' : k.contains('cite') ? '[1]' : '';
            if (say) { flush(); ann.push({ markup: '¤', interpretAs: say }); text += '¤'; map.push(null); }
            continue;
          }
          if (n.matches(SKIP)) { if (n.matches('code')) { flush(); ann.push({ markup: '¤'.repeat(n.textContent.length || 1), interpretAs: 'code' }); text += '¤'.repeat(n.textContent.length || 1); for (let i = 0; i < (n.textContent.length || 1); i++) map.push(null); } continue; }
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
  const fieldsAll = () => L.$$('#paper [data-f]').filter(f => f.dataset.f !== 'code' && f.isContentEditable !== false && !f.closest('.code-edit, .tikz-src'));

  /* ---------------- Orthographe (dictionnaires locaux) ---------------- */
  const WORD = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;
  const ELISION = /^(?:l|d|j|m|t|s|n|c|qu|lorsqu|puisqu|jusqu|quoiqu|presqu)['’](.+)$/i;
  function skipWord(w) {
    if (w.length < 2) return true;
    if (/\d/.test(w)) return true;
    if (w === w.toUpperCase()) return true;                      // sigles : TP, PCSI, II…
    if (/.\p{Lu}/u.test(w.replace(/^\p{Lu}+['’]/u, ''))) return true;   // mA, kOhm, CamelCase
    return false;
  }
  function wrong(w) {
    const k = w.replace(/’/g, '\'');
    if (wordCache.has(k)) return wordCache.get(k);
    let bad = local.misspelled([k])[0];
    if (bad) {
      const el = ELISION.exec(k);
      if (el && !local.misspelled([el[1]])[0]) bad = false;
      else if (k.includes('-')) bad = local.misspelled(k.split('-').filter(Boolean)).some(Boolean);
    }
    if (wordCache.size > 20000) wordCache.clear();
    wordCache.set(k, bad);
    return bad;
  }
  function localErrors(rec, field) {
    if (!hasLocal()) return [];
    const out = [], ud = userDict();
    // Le mot en cours de frappe n'est pas signalé tout de suite
    let caret = -1;
    if (field === typingField && Date.now() - typingAt < 2500) {
      const s = window.getSelection();
      if (s.rangeCount && s.isCollapsed && field.contains(s.anchorNode)) caret = rec.map.findIndex(p => p && p[0] === s.anchorNode && p[1] >= s.anchorOffset - 1);
    }
    for (const m of rec.text.matchAll(WORD)) {
      const w = m[0], s = m.index, e = s + w.length;
      if (skipWord(w) || ud.has(w.toLowerCase()) || ignored.has('sp:' + w)) continue;
      if (caret >= s && caret <= e) continue;
      // les mots collés à une formule (« ¤ ») ne sont pas des mots du dictionnaire
      if (rec.text[s - 1] === '¤' || rec.text[e] === '¤') continue;
      if (wrong(w)) out.push({ kind: 'sp', start: s, end: e, word: w });
    }
    return out;
  }

  /* ---------------- Grammaire (LanguageTool, en ligne) ---------------- */
  // Données personnelles de la page de titre (auteurs, établissement, groupe, date) : jamais envoyées
  const ltAllowed = f => !(f.dataset.b === 'meta' && /^(author|institution|extra|date)$/.test(f.dataset.f || ''));
  const ltLang = () => ((App.doc && App.doc.meta.lang) === 'en' ? 'en-US' : 'fr');
  const ltKey = rec => ltLang() + '\u0001' + rec.text;
  function ltErrors(rec) {
    const ms = ltCache.get(ltKey(rec));
    if (!ms) return null;
    const out = [];
    ms.forEach(m => {
      const spell = m.rule.issueType === 'misspelling' || m.rule.category.id === 'TYPOS';
      if (spell && hasLocal()) return;            // l'orthographe est déjà vérifiée sur l'ordinateur
      const s = m.offset, e = m.offset + m.length, w = rec.text.slice(s, e);
      if (!w.trim() || w.includes('¤')) return;
      if (spell && (userDict().has(w.toLowerCase()) || skipWord(w))) return;
      if (ignored.has((spell ? 'sp:' : 'gr:' + m.rule.id + ':') + w)) return;
      out.push({ lt: true, kind: spell ? 'sp' : 'gr', start: s, end: e, word: w, msg: m.message, cat: m.rule.category.name, rule: m.rule.id,
        reps: (m.replacements || []).slice(0, 6).map(r => r.value) });
    });
    return out;
  }
  function queueLT(field) { if (grammarOn() && ltAllowed(field)) { queue.add(field); pumpSoon(); } }
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
      if (!rec || !rec.text.trim() || ltCache.has(ltKey(rec))) { if (rec) paintField(f); continue; }
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
    const lang = ltLang();
    try {
      const body = new URLSearchParams({ language: lang, data: JSON.stringify({ annotation: ann }), disabledRules: DISABLED });
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
          ltCache.set(lang + '\u0001' + rec.text, (j.matches || []).filter(m => m.offset >= a && m.offset + m.length <= b).map(m => Object.assign({}, m, { offset: m.offset - a })));
        });
        if (ltCache.size > 3000) { const it = ltCache.keys(); for (let k = 0; k < 500; k++) ltCache.delete(it.next().value); }
        batch.forEach(([f]) => { if (f.isConnected) check(f, true); });
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

  // LanguageTool injoignable : le correcteur du système reprend l'orthographe en attendant
  function setLt(v) { if (ltOk === v) return; ltOk = v; applyNative(); paintSoon(); }

  /* ---------------- Vérification et affichage ---------------- */
  // En attendant la nouvelle vérification d'un texte modifié, les fautes trouvées avant restent
  // affichées si elles sont avant ou après l'endroit modifié (décalées d'autant)
  function remap(prev, text) {
    const a = prev.text, n = Math.min(a.length, text.length);
    let p = 0, s = 0;
    while (p < n && a[p] === text[p]) p++;
    while (s < n - p && a[a.length - 1 - s] === text[text.length - 1 - s]) s++;
    const d = text.length - a.length;
    return prev.errs.filter(e => e.lt).map(e => e.end <= p ? Object.assign({}, e) : e.start >= a.length - s ? Object.assign({}, e, { start: e.start + d, end: e.end + d }) : null).filter(Boolean);
  }
  function check(field, noLT) {
    if (!enabled() || !field.isConnected) { recs.delete(field); return; }
    const prev = recs.get(field);
    const m = model(field);
    const rec = { field, text: m.text, map: m.map, ann: m.ann, errs: [] };
    recs.set(field, rec);
    let lt = grammarOn() && ltAllowed(field) ? ltErrors(rec) : [];
    if (lt === null) { if (!noLT) queueLT(field); lt = !prev ? [] : prev.text === rec.text ? prev.errs.filter(e => e.lt).map(e => Object.assign({}, e)) : remap(prev, rec.text); }
    const errs = localErrors(rec, field);
    (lt || []).forEach(e => { if (!errs.some(x => x.start < e.end && e.start < x.end)) errs.push(e); });
    rec.errs = errs;
    paintField(field);
  }
  function paintField(field) {
    const rec = recs.get(field);
    if (!rec) return;
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
    recs.clear();
    fieldsAll().forEach(f => check(f));
    paint();
    maybeAsk();
  }, 250);
  // Champ modifié : orthographe tout de suite (sauf le mot en cours), grammaire une fois la frappe finie
  const pendingInput = new Set();
  const inputSoon = L.debounce(() => { pendingInput.forEach(f => check(f)); pendingInput.clear(); }, 450);
  function onInput(field) {
    if (!enabled() || !field || field.dataset.f === 'code') return;
    typingField = field; typingAt = Date.now();
    pendingInput.add(field);
    inputSoon();
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
    const busy = ltBusy || (grammarOn() && queue.size > 0);
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
    all.sort((a, b) => { const r = a.range.compareBoundaryPoints(Range.START_TO_START, b.range); return r; });
    const s = window.getSelection();
    let cur = s.rangeCount ? s.getRangeAt(0) : null;
    let e = all.find(x => cur && x.range.compareBoundaryPoints(Range.START_TO_END, cur) > 0 && !(x.range.isPointInRange(cur.startContainer, cur.startOffset))) || all[0];
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
    let node, off;
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (!p) return null; node = p.offsetNode; off = p.offset; }
    else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (!r) return null; node = r.startContainer; off = r.startOffset; }
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
  let ctxWord = null;
  function wordAt(x, y) {
    let node, off;
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (!p) return null; node = p.offsetNode; off = p.offset; }
    else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (!r) return null; node = r.startContainer; off = r.startOffset; }
    if (!node || node.nodeType !== 3) return null;
    const field = node.parentElement && node.parentElement.closest('[data-f]');
    if (!field) return null;
    const v = node.nodeValue, isW = c => /[\p{L}\p{M}'’-]/u.test(c || '');
    let a = off, b = off;
    while (a > 0 && isW(v[a - 1])) a--;
    while (b < v.length && isW(v[b])) b++;
    if (a === b) return null;
    return { node, a, b, text: v.slice(a, b), field };
  }
  function hidePop() { if (pop) pop.hidden = true; popErr = null; clearTimeout(hoverT); }
  function showPop(e, at) {
    pop = pop || L.$('#spellPop');
    if (!pop || !e.range) return;
    popErr = e;
    const spell = e.kind === 'sp';
    let reps = e.reps;
    if (!reps && spell && hasLocal()) reps = local.suggest(e.word.replace(/’/g, '\'')).filter(s => s !== e.word).slice(0, 6);
    reps = (reps || []).filter(Boolean);
    const msg = spell ? (e.msg && !/orthographe|faute de frappe|spelling/i.test(e.msg) ? e.msg : 'Ce mot n\'est pas dans le dictionnaire.') : e.msg;
    const title = spell ? 'Orthographe' : (e.cat && !/^(grammaire|grammar)$/i.test(e.cat) ? e.cat : 'Grammaire');
    pop.replaceChildren(...[
      L.h('div', { class: 'spp-h' }, L.h('span', { class: 'spp-dot ' + e.kind }), L.h('b', { text: title }),
        L.h('button', { class: 'spp-x', title: 'Fermer', onclick: hidePop }, L.svg('x', 13))),
      L.h('div', { class: 'spp-msg', text: msg || '' }),
      reps.length
        ? L.h('div', { class: 'spp-reps' }, ...reps.map(v => L.h('button', { class: 'spp-rep', text: v || '(supprimer)', title: 'Remplacer par « ' + v + ' »', onmousedown: ev => ev.preventDefault(), onclick: () => apply(e, v) })))
        : L.h('div', { class: 'spp-none', text: 'Aucune suggestion.' }),
      L.h('div', { class: 'spp-acts' },
        L.h('button', { text: 'Ignorer', title: 'Ne plus signaler ' + (spell ? 'ce mot' : 'cette faute') + ' jusqu\'à la fermeture de l\'application', onclick: () => { ignored.add(spell ? 'sp:' + e.word : 'gr:' + e.rule + ':' + e.word); hidePop(); recheck(); } }),
        spell ? L.h('button', { text: 'Ajouter au dictionnaire', title: 'Ce mot ne sera plus jamais signalé', onclick: () => { userDict().add(e.word.toLowerCase()); saveDict(); hidePop(); recheck(); L.toast('« ' + e.word + ' » ajouté au dictionnaire'); } }) : null),
      !spell ? L.h('div', { class: 'spp-foot', text: 'Grammaire vérifiée par LanguageTool' }) : null].filter(Boolean));
    pop.hidden = false;
    const r = (at || e.range.getBoundingClientRect());
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function showNative(m) {
    pop = pop || L.$('#spellPop');
    if (!pop || !m || !m.word) return;
    popErr = { native: true };
    const reps = (m.suggestions || []).filter(Boolean);
    pop.replaceChildren(...[
      L.h('div', { class: 'spp-h' }, L.h('span', { class: 'spp-dot sp' }), L.h('b', { text: 'Orthographe' }),
        L.h('button', { class: 'spp-x', title: 'Fermer', onclick: hidePop }, L.svg('x', 13))),
      L.h('div', { class: 'spp-msg', text: '« ' + m.word + ' » n\'est pas dans le dictionnaire.' }),
      reps.length
        ? L.h('div', { class: 'spp-reps' }, ...reps.map(v => L.h('button', { class: 'spp-rep', text: v, title: 'Remplacer par « ' + v + ' »', onmousedown: ev => ev.preventDefault(), onclick: () => replaceNative(m, v) })))
        : L.h('div', { class: 'spp-none', text: 'Aucune suggestion.' }),
      L.h('div', { class: 'spp-acts' },
        L.h('button', { text: 'Ajouter au dictionnaire', title: 'Ce mot ne sera plus jamais signalé', onclick: () => { hidePop(); lheDesktop.spellAdd(m.word); L.toast('« ' + m.word + ' » ajouté au dictionnaire'); } }),
        grammarState() !== 'on' ? L.h('button', { text: 'Corriger aussi la grammaire…', onclick: () => { hidePop(); ask(true); } }) : null)]);
    pop.hidden = false;
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const left = Math.max(8, Math.min(m.x - 20, window.innerWidth - w - 8));
    let top = m.y + 14;
    if (top + h > window.innerHeight - 8) top = Math.max(8, m.y - h - 10);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function replaceNative(m, v) {
    hidePop();
    const w = ctxWord;
    ctxWord = null;
    const i = w && w.node.isConnected ? w.text.indexOf(m.word) : -1;
    if (i < 0 || w.node.nodeValue.slice(w.a + i, w.a + i + m.word.length) !== m.word) { lheDesktop.spellReplace(v); return; }
    const r = new Range();
    r.setStart(w.node, w.a + i); r.setEnd(w.node, w.a + i + m.word.length);
    apply({ range: r, field: w.field }, v);
  }
  function apply(e, v) {
    const field = e.field;
    if (!e.range || !field.isConnected || !field.isContentEditable) return hidePop();   // lecture seule : rien à modifier
    const r = e.range;
    const sc = r.startContainer;
    if (sc === r.endContainer && sc.nodeType === 3) {
      sc.replaceData(r.startOffset, r.endOffset - r.startOffset, v);
      const s = window.getSelection(), c = new Range();
      c.setStart(sc, Math.min(sc.length, r.startOffset + v.length)); c.collapse(true);
      field.focus({ preventScroll: true }); s.removeAllRanges(); s.addRange(c);
    } else { r.deleteContents(); r.insertNode(document.createTextNode(v)); }
    hidePop();
    App.syncField(field);
    App.commit();
    if (App.updateWordCount) App.updateWordCount();
    typingField = null;
    check(field);
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
        + 'Pour cela, le texte du document est envoyé au service en ligne <b>LanguageTool</b> (gratuit, sans compte) pour être vérifié. '
        + 'Les fautes d\'orthographe (en rouge) se corrigeront alors aussi au survol de la souris.' }),
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
      sw('Souligner les fautes d\'orthographe', 'En rouge. Clic droit sur un mot souligné pour le corriger (ou simple survol, quand la grammaire est activée).', enabled(), v => { L.store.set('lhe-spell', v ? 'on' : 'off'); refresh(); }),
      sw('Vérifier aussi la grammaire et la conjugaison', 'En bleu. Le texte du document est envoyé au service en ligne <b>LanguageTool</b> pour être vérifié (gratuit, sans compte).', grammarState() === 'on', v => { L.store.set('lhe-grammar', v ? 'on' : 'off'); refresh(); }));
    if (n) {
      const lbl = L.h('span', { class: 'fhint', text: n + (n > 1 ? ' mots ajoutés' : ' mot ajouté') + ' à votre dictionnaire.' });
      box.append(L.h('div', { class: 'row-in' }, lbl, L.h('button', { class: 'btn small', text: 'Vider le dictionnaire', onclick: e => { userDict().clear(); saveDict(); lbl.textContent = 'Dictionnaire vidé.'; e.target.remove(); recheck(); } })));
    }
    return box;
  }

  /* ---------------- Branchements ---------------- */
  function init() {
    pop = L.$('#spellPop');
    const paper = L.$('#paper');
    paper.addEventListener('input', e => onInput(e.target.closest && e.target.closest('[data-f]')));
    document.addEventListener('selectionchange', onCaretMove);
    // Survol d'un mot souligné : la bulle s'ouvre après un court instant
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
      if (er) { clearTimeout(hideT); if (er !== popErr) hoverT = setTimeout(() => showPop(er), 450); }
      else if (popErr && !pop.hidden) { clearTimeout(hideT); hideT = setTimeout(() => { if (!pop.matches(':hover')) hidePop(); }, 350); }
    };
    paper.addEventListener('mouseleave', () => { clearTimeout(hoverT); clearTimeout(hideT); hideT = setTimeout(() => { if (pop && !pop.matches(':hover')) hidePop(); }, 400); });
    if (pop) pop.addEventListener('mouseleave', () => { hideT = setTimeout(hidePop, 400); });
    if (pop) pop.addEventListener('mouseenter', () => clearTimeout(hideT));
    // Clic droit sur une faute : la bulle tout de suite (à la place du menu du navigateur)
    paper.addEventListener('contextmenu', e => {
      ctxWord = wordAt(e.clientX, e.clientY);
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
    // Application de bureau : clic droit sur un mot souligné par le correcteur du système
    if (window.lheDesktop && lheDesktop.onSpellMenu) lheDesktop.onSpellMenu(m => showNative(m));
    window.addEventListener('online', () => { ltPausedUntil = 0; ltError = ''; pump(); });
    status();
  }

  return { init, refresh, onInput, settingsSection, nativeSpell, ownsSpelling, next: nextError, _recs: recs, _ltCache: ltCache };
})();
