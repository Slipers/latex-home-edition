/* Mise en pages A4 : découpe le document comme LaTeX (paragraphes coupés
   entre deux lignes, titres gardés avec la suite, notes en bas de page). */

L.pageClasses = function (m) {
  return 'fs-' + (m.fontSize || 11) + ' margins-' + (m.margins || 'normales') + (m.spacing === 1.5 ? ' spacing-15' : '');
};

L.loadFonts = function () {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const f = ['400 12pt "CMU Serif"', 'italic 400 12pt "CMU Serif"', '700 12pt "CMU Serif"', 'italic 700 12pt "CMU Serif"',
    '400 12pt "CMU Typewriter"', '400 12pt KaTeX_Main', 'italic 400 12pt KaTeX_Math', '400 12pt KaTeX_Size1', '400 12pt KaTeX_Size2', '400 12pt KaTeX_AMS'];
  return Promise.all(f.map(x => document.fonts.load(x).catch(() => null))).then(() => document.fonts.ready);
};

L.paginate = async function (doc, host) {
  await L.loadFonts();
  host.innerHTML = '';
  const m = doc.meta;
  const flow = L.renderDoc(doc, 'view');
  const ctx = flow._ctx;
  const items = Array.from(flow.children);
  const pages = [];
  let page, content, foot, avail, lh;

  const newPage = (cls = '') => {
    page = L.h('div', { class: 'page ' + L.pageClasses(m) + (cls ? ' ' + cls : '') });
    const body = L.h('div', { class: 'page-body' });
    content = L.h('div', { class: 'page-content' });
    foot = L.h('div', { class: 'page-foot' });
    body.append(content, foot);
    page.append(body);
    host.appendChild(page);
    pages.push(page);
    avail = body.clientHeight;
    lh = parseFloat(getComputedStyle(content).lineHeight) || 18;
  };

  const fnStyle = m.fnStyle || 'sup';
  const addNotes = el => {
    const added = [];
    const list = el.matches && el.matches('.pnote-src') ? [el] : Array.from(el.querySelectorAll('.fn, .pnote-src'));
    list.forEach(f => {
      if (!foot.firstChild) { const r = L.h('div', { class: 'fn-rule' }); foot.appendChild(r); added.push(r); }
      const pn = f.classList.contains('pnote-src');
      const mark = pn ? null : fnStyle === 'crochets' ? L.h('span', { class: 'fn-lab', text: f.dataset.mark || '[' + f.dataset.n + ']' }) : L.h('sup', { text: f.dataset.mark || f.dataset.n });
      const p = L.h('p', { class: 'fn' + (pn ? ' pn' : ''), 'data-fn': pn ? null : f.dataset.n, 'data-pnote': pn ? (f.dataset.id || '') : null }, mark, (mark ? ' ' : '') + (f.dataset.text || ''));
      foot.appendChild(p); added.push(p);
    });
    return added;
  };
  const used = () => content.offsetHeight + (foot.childNodes.length ? foot.offsetHeight : 0);
  const fits = (el, extra = 0) => {
    content.appendChild(el);
    const notes = addNotes(el);
    const ok = used() + extra <= avail + 0.5;
    el.remove(); notes.forEach(n => n.remove());
    return ok;
  };
  const place = el => { content.appendChild(el); addNotes(el); };
  const empty = () => !content.childNodes.length;

  /* --- Découpe d'un paragraphe à une frontière de ligne --- */
  const splitPara = (p, test) => {
    content.appendChild(p);
    const starts = [];
    const pr = p.getBoundingClientRect();
    let prevTop = null;
    const see = (top, pos) => {
      if (prevTop === null) { prevTop = top; return; }
      if (top > prevTop + 3) starts.push(pos);
      prevTop = Math.max(prevTop, top);
    };
    const atomic = n => n.nodeType === 1 && n.matches('.katex, .imath, .fn, .xref, .cite, .env-head-inline, .qed, sub, sup');
    const visit = node => {
      for (const n of Array.from(node.childNodes)) {
        if (n.nodeType === 1 && atomic(n)) {
          const r = n.getBoundingClientRect();
          if (r.height) see(r.top + r.height / 2 - lh / 2, { before: n });
          continue;
        }
        if (n.nodeType === 1) { visit(n); continue; }
        if (n.nodeType !== 3) continue;
        const s = n.nodeValue;
        for (let i = 0; i < s.length; i++) {
          if (i > 0 && !/\s/.test(s[i - 1])) continue;
          if (/\s/.test(s[i])) continue;
          const rg = document.createRange();
          rg.setStart(n, i); rg.setEnd(n, i + 1);
          const rc = rg.getClientRects()[0];
          if (!rc) continue;
          see(rc.top + rc.height / 2 - lh / 2, { node: n, offset: i });
        }
      }
    };
    visit(p);
    p.remove();
    if (!starts.length) return null;
    const part = (from, to) => {
      const r = document.createRange();
      if (from) { from.before ? r.setStartBefore(from.before) : r.setStart(from.node, from.offset); } else r.setStart(p, 0);
      if (to) { to.before ? r.setEndBefore(to.before) : r.setEnd(to.node, to.offset); } else r.setEnd(p, p.childNodes.length);
      const q = p.cloneNode(false);
      q.appendChild(r.cloneContents());
      return q;
    };
    const minFirst = starts.length >= 3 ? 1 : 0;   // au moins 2 lignes en bas de page si possible
    let lo = minFirst, hi = starts.length - 1, best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (test(part(null, starts[mid]))) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (best < 0) return null;
    const a = part(null, starts[best]), b = part(starts[best], null);
    a.classList.add('split-before');
    b.classList.add('split-cont');
    b.querySelectorAll('.env-head-inline').forEach(x => x.remove());
    return [a, b];
  };

  /* --- Découpe d'un conteneur (liste, encadré, sommaire…) entre ses enfants --- */
  const splitKids = (el, hostSel, test, dropInB) => {
    const hostOf = root => hostSel ? root.querySelector(hostSel) : root;
    const kids = Array.from(hostOf(el).children);
    if (kids.length < 1) return null;
    const build = (n, partial) => {
      const a = el.cloneNode(true), ha = hostOf(a);
      Array.from(ha.children).slice(n).forEach(k => k.remove());
      if (partial) ha.appendChild(partial);
      return a;
    };
    let n = 0;
    while (n < kids.length && test(build(n + 1))) n++;
    if (n >= kids.length) return null;
    let partA = null, partB = null;
    const sub = L._split(kids[n], x => test(build(n, x)));
    if (sub) { [partA, partB] = sub; }
    if (n === 0 && !partA) return null;
    const a = build(n, partA);
    const b = el.cloneNode(true), hb = hostOf(b);
    Array.from(hb.children).slice(0, n + 1).forEach(k => k.remove());
    if (partB) hb.insertBefore(partB, hb.firstChild);
    else hb.insertBefore(kids[n].cloneNode(true), hb.firstChild);
    if (dropInB) b.querySelectorAll(dropInB).forEach(x => x.remove());
    b.classList.add('split-cont');
    a.classList.add('split-first');
    return [a, b];
  };

  const splitCode = (el, test) => {
    const pre = el.querySelector('pre');
    if (pre.classList.contains('code-lines')) return splitKids(el, 'pre', test);
    const lines = pre.textContent.split('\n');
    const mk = (s, e) => { const c = el.cloneNode(true); c.querySelector('pre').textContent = lines.slice(s, e).join('\n'); return c; };
    let n = 0;
    while (n < lines.length - 1 && test(mk(0, n + 1))) n++;
    if (n === 0) return null;
    return [mk(0, n), mk(n, lines.length)];
  };

  L._split = (el, test) => {
    if (el.matches('p.para')) return splitPara(el, test);
    if (el.matches('.lst')) return splitKids(el, null, test);
    if (el.matches('.env')) return splitKids(el, '.env-body', test, '.abs-head');
    if (el.matches('.doc-toc, .biblio')) return splitKids(el, null, test);
    if (el.matches('.code')) return splitCode(el, test);
    return null;
  };

  newPage();
  const queue = items.slice();
  while (queue.length) {
    let el = queue.shift();
    const role = el.dataset.role;
    if (role === 'titlepage') {
      if (!empty()) newPage();
      page.classList.add('titlepage');
      content.style.height = '100%';
      place(el);
      newPage();
      continue;
    }
    if (role === 'pagebreak') { if (!empty()) newPage(); continue; }
    const isHead = el.matches('.sec');
    if (fits(el, isHead ? 2.2 * lh : 0)) { place(el); continue; }
    if (!isHead) {
      const sp = L._split(el, x => fits(x));
      if (sp) { place(sp[0]); sp[1]._splitOffset = sp[0].offsetHeight; newPage(); queue.unshift(sp[1]); continue; }
    }
    if (empty()) { place(el); newPage(); continue; }   // élément plus grand qu'une page
    newPage();
    queue.unshift(el);
  }
  if (empty() && pages.length > 1) { page.remove(); pages.pop(); }

  // Débuts de page (pour afficher les changements de page pendant l'édition)
  const breaks = [];
  pages.forEach((pg, i) => {
    if (!i) return;
    const first = pg.querySelector('.page-content > *');
    if (first) breaks.push({ page: i + 1, id: first.dataset.id || null, offset: first._splitOffset || 0 });
  });
  // Notes de chaque page (affichées en bas des feuilles dans l'éditeur)
  const notes = pages.map(pg => Array.from(pg.querySelectorAll('.page-foot .fn')).map(p => ({ html: p.innerHTML, fn: p.dataset.fn || null, pnote: p.dataset.pnote || null })));
  L.lastPagination = { count: pages.length, breaks, notes };

  // Numéros de page, en-têtes et pieds (la page de garde n'en a pas, comme titlepage)
  L.fixMeta(m);
  const start = L.pageStart(m);
  const numbered = pages.filter(pg => !pg.classList.contains('titlepage')).length;
  const total = start + numbered - 1;
  let num = start - 1, first = true;
  const pageOf = {};
  pages.forEach(pg => {
    if (pg.classList.contains('titlepage')) return;
    num++;
    const skip = first && m.hfFirst === false && m.titleStyle !== 'pagegarde';
    first = false;
    if (!skip) L.renderHF(m, num, total).forEach(x => pg.appendChild(x));
    pg.querySelectorAll('[data-id]').forEach(x => { if (pageOf[x.dataset.id] === undefined) pageOf[x.dataset.id] = num; });
  });
  let k = start - 1;
  L.lastPagination.pageNums = pages.map(pg => pg.classList.contains('titlepage') ? null : ++k);
  L.lastPagination.total = total;
  host.querySelectorAll('.toc-row').forEach(r => {
    const s = r.querySelector('.toc-page');
    if (s) s.textContent = pageOf[r.dataset.target] ?? '';
  });
  return pages.length;
};

/* En-tête et pied de page d'une page (texte gauche / centre / droite + numéro) */
L.renderHF = function (m, n, total) {
  const fmt = m.numFormat || 'arabic';
  const pos = m.numPos || 'foot-c';
  const tok = s => String(s || '').replace(/{titre}/g, L.plain(m.title)).replace(/{auteur}/g, L.plain(m.author)).replace(/{date}/g, L.plain(m.date));
  const out = [];
  for (const where of ['head', 'foot']) {
    const obj = where === 'head' ? m.header : m.footer;
    const cells = ['l', 'c', 'r'].map(k => {
      let t = tok(obj && obj[k]);
      if (fmt !== 'none' && pos === where + '-' + k) return { t, num: L.pageNumText(fmt, n, total, m.lang) };
      return { t };
    });
    if (!cells.some(c => c.t || c.num) && !(where === 'head' ? m.headRule : m.footRule)) continue;
    const box = L.h('div', { class: (where === 'head' ? 'page-head' : 'page-hfoot') + ((where === 'head' ? m.headRule : m.footRule) ? ' ruled' : '') },
      ...cells.map((c, i) => L.h('span', { class: 'hf-' + 'lcr'[i] }, c.t || '', c.t && c.num ? ' – ' : '',
        c.num ? L.h('span', { class: 'pn pn-' + (m.numStyle || 'normal'), text: c.num }) : null)));
    L.typo(box, m.lang);
    out.push(box);
  }
  return out;
};
