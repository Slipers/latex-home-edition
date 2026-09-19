/* Rechercher / remplacer (Ctrl+F, Ctrl+H) dans tout le texte du document */
L.FindBar = (function () {
  let bar, qIn, rIn, info, caseChk, pos = { f: -1, o: -1 };
  const SKIP = '.imath, .xref, .cite, .fn, .timg, .hfill, .katex, .pg-float, .num, .li-mark, .env-head-inline, .cap-lab';

  function textNodes(field) {
    const out = [];
    const tw = document.createTreeWalker(field, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    while (tw.nextNode()) out.push(tw.currentNode);
    return out;
  }
  const norm = s => caseChk.checked ? s : s.toLowerCase();
  const fields = () => L.$$('#paper [data-f]');

  /* Occurrences dans un champ : [{ node, offset }] (dans un même nœud texte) */
  function hits(field, q) {
    const res = [];
    textNodes(field).forEach(n => {
      const t = norm(n.nodeValue);
      let i = t.indexOf(q);
      while (i >= 0) { res.push({ node: n, offset: i }); i = t.indexOf(q, i + q.length); }
    });
    return res;
  }

  function count() {
    const q = norm(qIn.value);
    if (!q) { info.textContent = ''; return 0; }
    const n = fields().reduce((a, f) => a + hits(f, q).length, 0);
    info.textContent = n ? n + ' résultat' + (n > 1 ? 's' : '') : 'Aucun résultat';
    return n;
  }

  function next(back) {
    const q = norm(qIn.value);
    if (!q) return;
    const F = fields();
    const all = [];
    F.forEach((f, fi) => hits(f, q).forEach((h, k) => all.push({ fi, k, f, ...h })));
    if (!all.length) { info.textContent = 'Aucun résultat'; return; }
    let idx = all.findIndex(h => h.fi > pos.f || (h.fi === pos.f && h.k > pos.o));
    if (back) { idx = -1; for (let j = all.length - 1; j >= 0; j--) { const h = all[j]; if (h.fi < pos.f || (h.fi === pos.f && h.k < pos.o)) { idx = j; break; } } if (idx < 0) idx = all.length - 1; }
    else if (idx < 0) idx = 0;
    const h = all[idx];
    pos = { f: h.fi, o: h.k };
    const r = document.createRange();
    r.setStart(h.node, h.offset); r.setEnd(h.node, h.offset + q.length);
    h.f.focus({ preventScroll: true });
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    const rc = r.getBoundingClientRect(), d = L.$('#desk').getBoundingClientRect();
    if (rc.top < d.top + 60 || rc.bottom > d.bottom - 60) L.$('#desk').scrollBy({ top: rc.top - d.top - d.height / 3 });
    info.textContent = (idx + 1) + ' / ' + all.length;
    qIn.focus();
  }

  function replaceOne() {
    const q = qIn.value;
    const s = window.getSelection();
    if (s.rangeCount && norm(s.toString()) === norm(q) && q) {
      const r = s.getRangeAt(0);
      const field = (r.startContainer.parentElement || r.startContainer).closest('[data-f]');
      if (field) {
        r.deleteContents();
        if (rIn.value) r.insertNode(document.createTextNode(rIn.value));
        App.syncField(field); App.commit(); App.pagesSoon();
        pos.o--;
      }
    }
    next();
  }

  function replaceAll() {
    const q = norm(qIn.value);
    if (!q) return;
    let n = 0;
    fields().forEach(f => {
      let changed = false;
      textNodes(f).forEach(node => {
        const t = node.nodeValue, lt = norm(t);
        let out = '', i = 0, j;
        while ((j = lt.indexOf(q, i)) >= 0) { out += t.slice(i, j) + rIn.value; i = j + q.length; n++; changed = true; }
        if (i) node.nodeValue = out + t.slice(i);
      });
      if (changed) App.syncField(f);
    });
    if (n) { App.commit(); App.render(); }
    info.textContent = n ? n + ' remplacement' + (n > 1 ? 's' : '') : 'Aucun résultat';
  }

  function build() {
    qIn = L.h('input', { type: 'text', placeholder: 'Rechercher…' });
    rIn = L.h('input', { type: 'text', placeholder: 'Remplacer par…' });
    info = L.h('span', { class: 'fb-info' });
    caseChk = L.h('input', { type: 'checkbox', title: 'Respecter les majuscules' });
    const b = (t, fn, title) => L.h('button', { text: t, title: title || '', onclick: fn });
    bar = L.h('div', { id: 'findBar', hidden: true },
      L.h('div', { class: 'fb-row' }, qIn, b('↑', () => next(true), 'Précédent (Maj+Entrée)'), b('↓', () => next(), 'Suivant (Entrée)'), info,
        L.h('label', { class: 'fb-case', title: 'Respecter les majuscules' }, caseChk, 'Aa'), b('×', close, 'Fermer (Échap)')),
      L.h('div', { class: 'fb-row fb-rep' }, rIn, b('Remplacer', replaceOne), b('Tout remplacer', replaceAll)));
    L.$('#desk').appendChild(bar);
    qIn.addEventListener('input', () => { pos = { f: -1, o: -1 }; count(); });
    qIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); next(e.shiftKey); } if (e.key === 'Escape') close(); });
    rIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); replaceOne(); } if (e.key === 'Escape') close(); });
    caseChk.onchange = count;
  }

  function open(withReplace) {
    if (!bar) build();
    bar.hidden = false;
    bar.classList.toggle('with-rep', !!withReplace || bar.classList.contains('with-rep'));
    const s = window.getSelection().toString();
    if (s && s.length < 80 && !s.includes('\n')) qIn.value = s;
    qIn.focus(); qIn.select();
    count();
  }
  function close() { if (bar) bar.hidden = true; }
  return { open, close };
})();
