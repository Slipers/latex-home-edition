/* Rendu du document : mode « edit » (éditable) et « view » (aperçu / PDF) */

const LIST_LABELS = {
  bullet: { fr: ['–', '–', '–'], en: ['•', '–', '∗'] },
  number: ['1.', '(a)', 'i.'],
  alpha: ['a)', 'i.', 'A.'],
  roman: ['i)', 'a.', 'A.'],
};

L.listMark = function (style, level, n, lang) {
  if (style === 'bullet') return (LIST_LABELS.bullet[lang] || LIST_LABELS.bullet.fr)[level];
  const fmt = (LIST_LABELS[style] || LIST_LABELS.number)[level];
  return fmt.replace(/1|a|i|A/, c => c === '1' ? n : c === 'a' ? L.alpha(n) : c === 'A' ? L.alpha(n).toUpperCase() : L.roman(n));
};

L.hydrate = function (root, ctx) {
  root.querySelectorAll('.imath, .xref, .cite, .fn').forEach(el => {
    if (ctx.mode === 'edit') el.setAttribute('contenteditable', 'false');
    if (el.classList.contains('imath')) {
      el.innerHTML = el.dataset.latex ? L.katex(el.dataset.latex) : '<span class="chip-empty">formule</span>';
    } else if (el.classList.contains('xref')) {
      const t = ctx.nums[el.dataset.ref];
      el.textContent = t ? t.ref : '??';
      el.classList.toggle('broken', !t);
    } else if (el.classList.contains('cite')) {
      const n = ctx.bib[el.dataset.ref];
      el.textContent = '[' + (n || '?') + ']';
    } else if (el.classList.contains('fn')) {
      ctx.fn = (ctx.fn || 0) + 1;
      el.dataset.n = ctx.fn;
      el.innerHTML = '<span class="fn-mark">' + ctx.fn + '</span>';
    }
  });
  return root;
};

/* Typographie française appliquée au rendu final (comme babel-french) */
L.typo = function (root, lang) {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement && n.parentElement.closest('.katex, code') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (tw.nextNode()) nodes.push(tw.currentNode);
  nodes.forEach(n => {
    let s = n.nodeValue.replace(/'/g, '\u2019');
    if (lang !== 'en') s = s.replace(/[ \u00a0]+([;!?])/g, '\u202f$1').replace(/[ \u00a0]+:/g, '\u00a0:')
      .replace(/«[ \u00a0]*/g, '«\u00a0').replace(/[ \u00a0]*»/g, '\u00a0»');
    if (s !== n.nodeValue) n.nodeValue = s;
  });
};

L.rich = function (ctx, tag, cls, html, b, f, ph) {
  const el = L.h(tag, { class: cls + ' rt' });
  el.innerHTML = html || '';
  if (ctx.mode !== 'edit') L.typo(el, ctx.lang);
  if (ctx.mode === 'edit') {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    el.dataset.b = b; el.dataset.f = f;
    if (ph) el.dataset.ph = ph;
    if (L.isEmptyHtml(html)) el.classList.add('is-empty');
  }
  return L.hydrate(el, ctx);
};

L.renderDoc = function (doc, mode) {
  const info = L.computeNumbers(doc);
  const ctx = { doc, mode, nums: info.nums, toc: info.toc, bib: info.bib, lang: doc.meta.lang || 'fr', fn: 0, meta: doc.meta };
  const flow = L.h('div', { class: 'flow' });
  const t = L.renderTitle(ctx);
  if (t) flow.appendChild(t);
  if (doc.meta.toc) flow.appendChild(L.renderToc(ctx));
  doc.blocks.forEach(b => flow.appendChild(L.renderBlock(b, ctx)));
  flow._ctx = ctx;
  return flow;
};

L.renderTitle = function (ctx) {
  const m = ctx.meta, edit = ctx.mode === 'edit';
  if (m.titleStyle === 'aucun') {
    if (!edit) return null;
    return L.h('div', { class: 'blk meta-blk notitle', 'data-id': '__title' },
      L.h('div', { class: 'hint-line', text: 'Pas de titre affiché — modifiable dans « Document »' }));
  }
  const f = (key, cls, ph) => {
    if (!edit && L.isEmptyHtml(m[key])) return null;
    return L.rich(ctx, 'div', cls, m[key], 'meta', key, ph);
  };
  let box;
  if (m.titleStyle === 'fiche') {
    box = L.h('div', { class: 'doc-title-fiche' },
      L.h('div', { class: 'f-top' }, f('institution', 't-inst', 'Établissement / matière') || L.h('span'), f('date', 't-date', 'Date') || L.h('span')),
      L.h('div', { class: 'f-rule' }),
      f('title', 't-title', 'Titre de la feuille'),
      f('subtitle', 't-subtitle', 'Sous-titre (facultatif)'),
      edit ? f('author', 't-author-fiche', 'Auteur (facultatif)') : null);
  } else if (m.titleStyle === 'pagegarde') {
    box = L.h('div', { class: 'doc-titlepage' },
      f('institution', 'tp-inst', 'Établissement'),
      L.h('div', { class: 'tp-mid' },
        L.h('div', { class: 'tp-rule' }),
        f('title', 't-title', 'Titre du document'),
        f('subtitle', 't-subtitle', 'Sous-titre (facultatif)'),
        L.h('div', { class: 'tp-rule' }),
        f('author', 't-author', 'Auteur(s)')),
      f('date', 't-date', 'Date'));
  } else {
    box = L.h('div', { class: 'doc-title-block' },
      f('title', 't-title', 'Titre du document'),
      f('subtitle', 't-subtitle', 'Sous-titre (facultatif)'),
      f('author', 't-author', 'Auteur(s)'),
      f('institution', 't-inst', 'Établissement (facultatif)'),
      f('date', 't-date', 'Date'));
  }
  if (!edit) { box.dataset.role = m.titleStyle === 'pagegarde' ? 'titlepage' : 'title'; return box; }
  return L.h('div', { class: 'blk meta-blk', 'data-id': '__title' }, box);
};

L.renderToc = function (ctx, pages) {
  const box = L.h('div', { class: 'doc-toc', 'data-role': 'toc' },
    L.h('div', { class: 'toc-h', text: L.NAMES[ctx.lang].toc }));
  if (!ctx.toc.length) box.appendChild(L.h('div', { class: 'toc-empty', text: 'Ajoutez des sections : elles apparaîtront ici automatiquement.' }));
  ctx.toc.forEach(e => {
    const row = L.h('div', { class: 'toc-row l' + e.level, 'data-target': e.id },
      e.num ? L.h('span', { class: 'toc-num', text: e.num }) : null,
      L.hydrate(L.h('span', { class: 'toc-text', html: e.html || '<i>(sans titre)</i>' }), { ...ctx, mode: 'view', fn: 0 }),
      L.h('span', { class: 'toc-dots' }),
      L.h('span', { class: 'toc-page', text: pages && pages[e.id] ? pages[e.id] : '' }));
    row.querySelectorAll('.fn').forEach(x => x.remove());
    box.appendChild(row);
  });
  if (ctx.mode === 'edit') return L.h('div', { class: 'blk meta-blk', 'data-id': '__toc' }, box);
  return box;
};

L.renderBlock = function (b, ctx) {
  const fn = L.R[b.type] || L.R.unknown;
  const el = fn(b, ctx);
  if (ctx.mode !== 'edit') { el.dataset.id = b.id; return el; }
  const w = L.h('div', { class: 'blk', 'data-id': b.id, 'data-type': b.type });
  w.appendChild(L.h('div', { class: 'gutter', contenteditable: 'false' },
    L.h('button', { class: 'g-add', title: 'Insérer un élément en dessous', tabindex: '-1', text: '+' }),
    L.h('span', { class: 'g-drag', title: 'Glisser pour déplacer', draggable: 'true', text: '⠿' })));
  w.appendChild(el);
  return w;
};

L.R = {
  unknown: (b) => L.h('div', { text: 'Bloc inconnu : ' + b.type }),

  paragraph(b, ctx) {
    const cls = 'para' + (b.noindent ? ' noindent' : '') + (b.align && b.align !== 'justify' ? ' ' + b.align : '');
    return L.rich(ctx, 'p', cls, b.html, b.id, 'html', 'Écrivez ici…  (tapez « / » pour insérer un élément)');
  },

  heading(b, ctx) {
    const lv = Math.min(Math.max(b.level, 1), 4);
    const el = L.h('h' + (lv + 1), { class: 'sec l' + lv });
    const n = ctx.nums[b.id];
    if (n) el.appendChild(L.h('span', { class: 'num', contenteditable: ctx.mode === 'edit' ? 'false' : null, text: n.num }));
    const ph = ['Titre de la section', 'Titre de la sous-section', 'Titre de la sous-sous-section', 'Titre du paragraphe'][lv - 1];
    el.appendChild(L.rich(ctx, 'span', 'sec-text', b.html, b.id, 'html', ph));
    return el;
  },

  equation(b, ctx) {
    const n = ctx.nums[b.id];
    const body = L.h('div', { class: 'eq-body' });
    if (b.latex) body.innerHTML = L.katex(L.displayLatex(b.latex), true);
    else body.innerHTML = ctx.mode === 'edit' ? '<span class="eq-empty">Cliquez pour saisir une équation</span>' : '';
    return L.h('div', { class: 'eq' + (ctx.mode === 'edit' ? ' clickable' : '') },
      L.h('div', { class: 'eq-spacer' }), body,
      n ? L.h('div', { class: 'eq-num', text: n.num }) : null);
  },

  list(b, ctx) {
    const el = L.h('div', { class: 'lst lst-' + b.style });
    const counters = [0, 0, 0];
    b.items.forEach((it, i) => {
      const lv = Math.min(it.level || 0, 2);
      counters[lv]++;
      for (let k = lv + 1; k < 3; k++) counters[k] = 0;
      const mark = L.listMark(b.style, lv, counters[lv], ctx.lang);
      el.appendChild(L.h('div', { class: 'li lv' + lv, 'data-i': i },
        L.h('span', { class: 'li-mark', contenteditable: ctx.mode === 'edit' ? 'false' : null, text: mark }),
        L.rich(ctx, 'div', 'li-text', it.html, b.id, 'items.' + i + '.html', 'Élément de liste')));
    });
    return el;
  },

  box(b, ctx) {
    const k = L.KINDS[b.kind] || L.KINDS.theoreme;
    const lang = ctx.lang;
    const el = L.h('div', { class: 'env st-' + k.style + (ctx.meta.boxedThm && k.style !== 'abstract' && k.style !== 'proof' ? ' boxed' : ''), 'data-kind': b.kind });
    const body = L.h('div', { class: 'env-body' });
    if (k.style === 'abstract') {
      el.appendChild(L.h('div', { class: 'abs-head', text: L.NAMES[lang].abstract }));
    }
    let head = null;
    if (k.style !== 'abstract') {
      const n = ctx.nums[b.id];
      head = L.h('span', { class: 'env-head-inline' },
        L.h('span', { class: 'env-head', text: L.kindName(b.kind, lang) + (n ? ' ' + n.num : '') }),
        b.title ? L.h('span', { class: 'env-note', text: ' (' + b.title + ')' }) : null,
        L.h('span', { class: 'env-head' }, '.'), ' ');
      if (ctx.mode !== 'edit') L.typo(head, lang);
    }
    const kids = b.children.map(c => L.renderBlock(c, ctx));
    if (ctx.mode === 'edit') {
      if (head) {
        head.setAttribute('contenteditable', 'false');
        if (!b.children[0] || b.children[0].type !== 'paragraph') head.classList.add('solo');
        body.appendChild(head);
      }
      kids.forEach(x => body.appendChild(x));
      if (k.style === 'proof') body.appendChild(L.h('div', { class: 'qed-line', text: '□' }));
    } else {
      kids.forEach(x => body.appendChild(x));
      const first = kids[0];
      if (head) {
        if (first && first.classList.contains('para')) first.insertBefore(head, first.firstChild);
        else body.insertBefore(L.h('p', { class: 'para noindent env-headline' }, head), body.firstChild);
      }
      if (k.style === 'proof') {
        const last = kids[kids.length - 1];
        const q = L.h('span', { class: 'qed', text: '□' });
        if (last && last.classList.contains('para')) last.appendChild(q);
        else body.appendChild(L.h('p', { class: 'para noindent', style: { textAlign: 'right' } }, '□'));
      }
    }
    el.appendChild(body);
    return el;
  },

  table(b, ctx) {
    const n = ctx.nums[b.id];
    const el = L.h('div', { class: 'tbl ' + (b.style || 'pro') + (b.head ? ' has-head' : '') });
    el.appendChild(L.h('div', { class: 'caption' },
      L.h('span', { class: 'cap-lab', contenteditable: ctx.mode === 'edit' ? 'false' : null, text: L.NAMES[ctx.lang].table + ' ' + (n ? n.num : '') + ' – ' }),
      L.rich(ctx, 'span', 'cap-text', b.caption, b.id, 'caption', 'Légende du tableau')));
    const table = L.h('table');
    const cols = Math.max(...b.rows.map(r => r.length));
    b.rows.forEach((r, ri) => {
      const tr = L.h('tr');
      for (let ci = 0; ci < cols; ci++) {
        const td = L.rich(ctx, 'td', 'al-' + (b.align[ci] || 'c'), r[ci] || '', b.id, 'rows.' + ri + '.' + ci, '');
        td.dataset.r = ri; td.dataset.c = ci;
        tr.appendChild(td);
      }
      table.appendChild(tr);
    });
    el.appendChild(table);
    return el;
  },

  figure(b, ctx) {
    const n = ctx.nums[b.id];
    const el = L.h('div', { class: 'fig' });
    const src = b.src && ctx.doc.assets ? ctx.doc.assets[b.src] : null;
    if (src) el.appendChild(L.h('img', { src, style: { width: (b.width || 60) + '%' }, alt: L.plain(b.caption) }));
    else if (ctx.mode === 'edit') el.appendChild(L.h('div', { class: 'fig-drop', contenteditable: 'false' },
      L.h('div', { class: 'fig-drop-ic', text: '🖼' }),
      L.h('div', { text: 'Cliquez ou déposez une image ici' }),
      L.h('div', { class: 'fig-drop-sub', text: 'PNG, JPEG, SVG — graphiques, schémas, photos de montage…' })));
    el.appendChild(L.h('div', { class: 'caption' },
      L.h('span', { class: 'cap-lab', contenteditable: ctx.mode === 'edit' ? 'false' : null, text: L.NAMES[ctx.lang].figure + ' ' + (n ? n.num : '') + ' – ' }),
      L.rich(ctx, 'span', 'cap-text', b.caption, b.id, 'caption', 'Légende de la figure')));
    return el;
  },

  code(b, ctx) {
    const el = L.h('div', { class: 'code' + (b.numbers ? ' numbered' : '') });
    if (ctx.mode === 'edit') {
      const pre = L.h('pre', { class: 'code-edit', contenteditable: 'plaintext-only', spellcheck: 'false', 'data-b': b.id, 'data-f': 'code', 'data-ph': 'Collez ou tapez votre code ici' });
      pre.textContent = b.code;
      if (!b.code) pre.classList.add('is-empty');
      el.appendChild(pre);
    } else {
      const pre = L.h('pre', { class: b.numbers ? 'code-lines' : '' });
      if (b.numbers) (b.code || '').split('\n').forEach(line => pre.appendChild(L.h('span', { class: 'ln', text: line || ' ' })));
      else pre.textContent = b.code;
      el.appendChild(pre);
    }
    return el;
  },

  pagebreak(b, ctx) {
    if (ctx.mode === 'edit') return L.h('div', { class: 'pbreak', contenteditable: 'false' }, L.h('span', { text: 'Saut de page' }));
    return L.h('div', { class: 'pbreak-view', 'data-role': 'pagebreak' });
  },

  bibliography(b, ctx) {
    const el = L.h('div', { class: 'biblio' }, L.h('div', { class: 'bib-h', text: L.NAMES[ctx.lang].refs }));
    const bib = ctx.doc.bib || [];
    if (!bib.length) el.appendChild(L.h('div', { class: 'bib-empty', text: 'Aucune référence. Utilisez « Citation » ou le bouton « Gérer les références » à droite.' }));
    bib.forEach((e, i) => el.appendChild(L.h('div', { class: 'bib-item' },
      L.h('span', { class: 'bib-lab', text: '[' + (i + 1) + ']' }),
      L.h('span', { class: 'bib-txt', html: L.bibHtml(e) }))));
    return el;
  },
};

L.bibHtml = function (e) {
  const parts = [];
  if (e.authors) parts.push(L.escHtml(e.authors) + '.');
  if (e.title) parts.push('<i>' + L.escHtml(e.title) + '</i>.');
  const src = [e.source, e.year].filter(Boolean).map(L.escHtml).join(', ');
  if (src) parts.push(src + '.');
  if (e.url) parts.push('<span class="bib-url">' + L.escHtml(e.url) + '</span>');
  return parts.join(' ');
};
