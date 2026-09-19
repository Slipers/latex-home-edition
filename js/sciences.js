/* Tableaux scientifiques : tableau de variations / de signes (tkz-tab) et tableau d'avancement */

/* Conversion d'une saisie simple en LaTeX : « -inf », « pi », « sqrt(2) », « 1/2 », « 2,5 »… */
L.quickTex = function (s) {
  s = String(s ?? '').trim();
  if (!s) return '';
  if (/\\/.test(s)) return s;
  return s
    .replace(/([+-]?)\s*(inf(ini)?|∞)/gi, (m, sg) => (sg || '') + '\\infty')
    .replace(/sqrt\(([^()]*)\)/gi, '\\sqrt{$1}')
    .replace(/√\(([^()]*)\)/g, '\\sqrt{$1}').replace(/√(\w+)/g, '\\sqrt{$1}')
    .replace(/\bpi\b|π/gi, '\\pi ')
    .replace(/(-?\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/g, '\\frac{$1}{$2}')
    .replace(/(\d),(\d)/g, '$1{,}$2')
    .replace(/\*/g, '\\times ')
    .replace(/<=|≤/g, '\\leq ').replace(/>=|≥/g, '\\geq ');
};

L.TEXTWIDTH_CM = m => ({ latex: { 10: 12.1, 11: 12.7, 12: 13.7 }[m.fontSize || 11], normales: 16, etroites: 18 }[m.margins || 'normales'] || 16);

/* Géométrie commune à l'aperçu et à l'export tkz-tab (en cm) */
L.tabvarGeom = function (b, meta) {
  const n = b.xs.length;
  const longest = Math.max(L.plain(b.xlabel || 'x').length, ...b.rows.map(r => String(r.label || '').length));
  const lgt = Math.min(4.5, Math.max(1.6, 0.6 + longest * 0.22));
  const avail = L.TEXTWIDTH_CM(meta) - lgt - 1;
  const espcl = Math.max(1.2, Math.min(3, avail / Math.max(1, n - 1)));
  const heights = [1, ...b.rows.map(r => r.kind === 'var' ? 2 : 1)];
  return { n, lgt, espcl, deltacl: 0.5, heights, width: lgt + 1 + (n - 1) * espcl, height: heights.reduce((a, c) => a + c, 0) };
};

L.newTabvar = function (variant) {
  if (variant === 'signes') return L.newBlock('tabvar', {
    xlabel: 'x', xs: ['-inf', '-1', '2', '+inf'],
    rows: [
      { kind: 'sign', label: 'x+1', cells: ['', '-', 'z', '+', '', '+', ''] },
      { kind: 'sign', label: 'x-2', cells: ['', '-', '', '-', 'z', '+', ''] },
      { kind: 'sign', label: '(x+1)(x-2)', cells: ['', '+', 'z', '-', 'z', '+', ''] },
    ],
  });
  return L.newBlock('tabvar', {
    xlabel: 'x', xs: ['-inf', '1', '+inf'],
    rows: [
      { kind: 'sign', label: "f'(x)", cells: ['', '-', 'z', '+', ''] },
      { kind: 'var', label: 'f', cells: [{ p: '+', v: '+inf' }, { p: '-', v: '-2' }, { p: '+', v: '+inf' }] },
    ],
  });
};

/* ---------- Rendu (HTML + SVG, mêmes proportions que tkz-tab) ---------- */
L.renderTabvar = function (b, meta) {
  const G = L.tabvarGeom(b, meta);
  const mm = v => v * 10;
  const W = G.width, H = G.height;
  const box = L.h('div', { class: 'tv', style: { width: W + 'cm', height: H + 'cm' } });
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + mm(W) + ' ' + mm(H));
  svg.setAttribute('class', 'tv-svg');
  const line = (x1, y1, x2, y2, cls) => { const l = document.createElementNS(svgNS, 'line'); Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => l.setAttribute(k, v)); l.setAttribute('class', cls || 'tv-l'); svg.appendChild(l); };
  const mid = 'tv-arrow-' + Math.random().toString(36).slice(2, 7);
  const defs = document.createElementNS(svgNS, 'defs');
  defs.innerHTML = '<marker id="' + mid + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9" fill="none" stroke="#000" stroke-width="1.3"/></marker>';
  svg.appendChild(defs);
  const put = (x, y, latex, cls) => {
    const d = L.h('div', { class: 'tv-v ' + (cls || ''), style: { left: x + 'cm', top: y + 'cm' } });
    d.innerHTML = L.katex(latex);
    box.appendChild(d);
    return d;
  };
  const px = i => G.lgt + G.deltacl + i * G.espcl;
  line(0, 0, mm(W), 0); line(0, mm(H), mm(W), mm(H)); line(0, 0, 0, mm(H)); line(mm(W), 0, mm(W), mm(H));
  line(mm(G.lgt), 0, mm(G.lgt), mm(H));
  // Ligne des x
  put(G.lgt / 2, 0.5, L.quickTex(b.xlabel || 'x'));
  b.xs.forEach((x, i) => put(px(i), 0.5, L.quickTex(x)));
  let y = G.heights[0];
  b.rows.forEach((r, ri) => {
    const h = G.heights[ri + 1];
    line(0, mm(y), mm(W), mm(y));
    put(G.lgt / 2, y + h / 2, L.quickTex(r.label));
    if (r.kind === 'sign') {
      r.cells.forEach((c, k) => {
        if (k % 2 === 0) {
          const x = px(k / 2);
          if (c === 'z' || c === 't') line(mm(x), mm(y), mm(x), mm(y + h), 'tv-l tv-dot');
          if (c === 'd') { line(mm(x) - 0.6, mm(y), mm(x) - 0.6, mm(y + h)); line(mm(x) + 0.6, mm(y), mm(x) + 0.6, mm(y + h)); }
          if (c === 'z') put(x, y + h / 2, '0', 'tv-zero');
        } else if (c) {
          const i = (k - 1) / 2;
          put((px(i) + px(i + 1)) / 2, y + h / 2, c === '-' ? '-' : c === '+' ? '+' : L.quickTex(c));
        }
      });
    } else {
      const pts = [];
      r.cells.forEach((c, i) => {
        if (!c || c.p === 'R') return;
        const top = c.p === '+';
        const vy = top ? y + 0.35 : y + h - 0.35;
        if (c.v !== undefined && String(c.v).trim() !== '') put(px(i), vy, L.quickTex(c.v));
        if (c.d) { line(mm(px(i)) - 0.6, mm(y), mm(px(i)) - 0.6, mm(y + h)); line(mm(px(i)) + 0.6, mm(y), mm(px(i)) + 0.6, mm(y + h)); }
        pts.push({ i, top, d: c.d });
      });
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], c = pts[k + 1];
        const ya = a.top ? y + 0.75 : y + h - 0.75, yc = c.top ? y + 0.75 : y + h - 0.75;
        const l = document.createElementNS(svgNS, 'line');
        l.setAttribute('x1', mm(px(a.i) + 0.45)); l.setAttribute('y1', mm(ya));
        l.setAttribute('x2', mm(px(c.i) - 0.45)); l.setAttribute('y2', mm(yc));
        l.setAttribute('class', 'tv-l'); l.setAttribute('marker-end', 'url(#' + mid + ')');
        svg.appendChild(l);
      }
    }
    y += h;
  });
  box.insertBefore(svg, box.firstChild);
  return box;
};

L.R.tabvar = function (b, ctx) {
  const wrap = L.h('div', { class: 'tvwrap' + (ctx.mode === 'edit' ? ' clickable' : '') });
  wrap.appendChild(L.renderTabvar(b, ctx.meta));
  if (ctx.mode === 'edit') wrap.appendChild(L.h('div', { class: 'tv-hint', contenteditable: 'false', text: 'Cliquez pour modifier le tableau' }));
  return wrap;
};

/* ---------- Export tkz-tab ---------- */
L.tabvarToLatex = function (b, X) {
  X.pk.add('tkz-tab');
  const G = L.tabvarGeom(b, X.doc.meta);
  const f = v => Math.round(v * 100) / 100;
  const m = s => '$' + L.quickTex(s) + '$';
  const init = [m(b.xlabel || 'x') + ' /1', ...b.rows.map(r => m(r.label) + ' /' + (r.kind === 'var' ? 2 : 1))].join(', ');
  const out = ['\\begin{center}', '\\begin{tikzpicture}',
    '\\tkzTabInit[lgt=' + f(G.lgt) + ',espcl=' + f(G.espcl) + ',deltacl=0.5]{' + init + '}{' + b.xs.map(m).join(', ') + '}'];
  b.rows.forEach(r => {
    if (r.kind === 'sign') out.push('\\tkzTabLine{' + r.cells.map((c, k) => k % 2 ? (c === '+' || c === '-' ? c : c ? m(c) : '') : (c || '')).join(', ') + '}');
    else out.push('\\tkzTabVar{' + r.cells.map(c => {
      if (!c || c.p === 'R') return 'R/';
      const v = String(c.v || '').trim() ? m(c.v) : '';
      return (c.d ? 'D' : '') + c.p + '/ ' + v;
    }).join(', ') + '}');
  });
  out.push('\\end{tikzpicture}', '\\end{center}');
  return out.join('\n');
};

/* ---------- Éditeur du tableau de variations / signes ---------- */
L.dlgTabvar = function (block) {
  const t = JSON.parse(JSON.stringify(block));
  const body = L.h('div', { class: 'tve' });
  const prev = L.h('div', { class: 'tve-prev paper ' + L.pageClasses(App.doc.meta) });
  const refresh = () => { prev.replaceChildren(L.renderTabvar(t, App.doc.meta)); };
  const inp = (val, on, ph, cls) => { const i = L.h('input', { type: 'text', value: val ?? '', placeholder: ph || '', class: cls || '' }); i.oninput = () => { on(i.value); refresh(); }; return i; };
  const sel = (opts, val, on, title) => {
    const s = L.h('select', { title: title || '' }, ...opts.map(([v, lab]) => { const o = L.h('option', { value: v, text: lab }); if (v === val) o.selected = true; return o; }));
    s.onchange = () => { on(s.value); refresh(); };
    return s;
  };
  const draw = () => {
    body.innerHTML = '';
    const n = t.xs.length, slots = 2 * n - 1;
    const grid = L.h('div', { class: 'tve-grid', style: { gridTemplateColumns: '170px repeat(' + slots + ', minmax(58px, 1fr))' } });
    // Ligne des x
    grid.appendChild(L.h('div', { class: 'tve-lab' }, inp(t.xlabel, v => { t.xlabel = v; }, 'x')));
    t.xs.forEach((x, i) => {
      const cell = L.h('div', { class: 'tve-cell tve-x' }, inp(x, v => { t.xs[i] = v; }, 'valeur'));
      if (i > 0 && i < n - 1) cell.appendChild(L.h('button', { class: 'tve-del', title: 'Retirer cette valeur', text: '×', onclick: () => {
        t.xs.splice(i, 1);
        t.rows.forEach(r => r.kind === 'sign' ? r.cells.splice(2 * i, 2) : r.cells.splice(i, 1));
        draw(); refresh();
      } }));
      grid.appendChild(cell);
      if (i < n - 1) grid.appendChild(L.h('div', { class: 'tve-cell' }));
    });
    t.rows.forEach((r, ri) => {
      const lab = L.h('div', { class: 'tve-lab' },
        inp(r.label, v => { r.label = v; }, r.kind === 'var' ? 'f' : "f'(x)"),
        L.h('div', { class: 'tve-rowtools' },
          L.h('span', { class: 'tve-kind', text: r.kind === 'var' ? 'Variations' : 'Signes' }),
          L.h('button', { class: 'tve-del', title: 'Monter', text: '↑', onclick: () => { if (ri > 0) { t.rows.splice(ri - 1, 0, t.rows.splice(ri, 1)[0]); draw(); refresh(); } } }),
          L.h('button', { class: 'tve-del', title: 'Supprimer la ligne', text: '×', onclick: () => { t.rows.splice(ri, 1); draw(); refresh(); } })));
      grid.appendChild(lab);
      if (r.kind === 'sign') {
        r.cells.forEach((c, k) => {
          const pt = k % 2 === 0;
          grid.appendChild(L.h('div', { class: 'tve-cell' + (pt ? ' tve-pt' : '') }, pt
            ? sel([['', '—'], ['z', '0'], ['d', '‖ interdit'], ['t', '⋮ trait']], c, v => { r.cells[k] = v; }, 'Au niveau de cette valeur de x')
            : sel([['+', '+'], ['-', '−'], ['', ' ']], c, v => { r.cells[k] = v; }, 'Signe sur cet intervalle')));
        });
      } else {
        t.xs.forEach((x, i) => {
          const c = r.cells[i] || (r.cells[i] = { p: '-', v: '' });
          grid.appendChild(L.h('div', { class: 'tve-cell tve-pt tve-var' },
            sel([['+', '↑ en haut'], ['-', '↓ en bas'], ['R', '— rien']], c.p, v => { c.p = v; }, 'Position de la valeur'),
            inp(c.v, v => { c.v = v; }, 'valeur')));
          if (i < n - 1) grid.appendChild(L.h('div', { class: 'tve-cell tve-arrow', text: '→' }));
        });
      }
    });
    body.append(grid,
      L.h('div', { class: 'btn-row', style: { margin: '10px 0' } },
        L.h('button', { class: 'btn', text: '+ Valeur de x', onclick: () => {
          const n0 = t.xs.length;
          t.xs.splice(n0 - 1, 0, '');
          t.rows.forEach(r => r.kind === 'sign' ? r.cells.splice(2 * (n0 - 1), 0, '', r.cells[2 * n0 - 3] || '+') : r.cells.splice(n0 - 1, 0, { p: '-', v: '' }));
          draw(); refresh();
        } }),
        L.h('button', { class: 'btn', text: '+ Ligne de signes', onclick: () => { t.rows.push({ kind: 'sign', label: '', cells: Array.from({ length: 2 * t.xs.length - 1 }, (_, k) => k % 2 ? '+' : '') }); draw(); refresh(); } }),
        L.h('button', { class: 'btn', text: '+ Ligne de variations', onclick: () => { t.rows.push({ kind: 'var', label: 'f', cells: t.xs.map((_, i) => ({ p: i % 2 ? '+' : '-', v: '' })) }); draw(); refresh(); } })),
      L.h('div', { class: 'pp-help', html: 'Saisie simplifiée : <b>-inf</b>, <b>+inf</b>, <b>pi</b>, <b>sqrt(2)</b>, <b>1/2</b>, <b>2,5</b>, <b>e^2</b>… Pour une valeur interdite, choisissez « ‖ interdit » dans les lignes de signes.' }),
      L.h('div', { class: 'set-h', text: 'Aperçu' }), prev);
  };
  draw(); refresh();
  L.modal({
    title: block.rows.some(r => r.kind === 'var') ? 'Tableau de variations' : 'Tableau de signes', body, wide: true,
    foot: [{ text: 'Annuler', onClick: c => c() }, { text: 'Valider', cls: 'primary', onClick: c => {
      const f = L.find(App.doc, block.id);
      if (f) Object.assign(f.block, { xlabel: t.xlabel, xs: t.xs, rows: t.rows });
      c(); App.commit(); App.render();
    } }],
  });
};

/* ---------- Générateur de tableau d'avancement ---------- */
L.dlgAvancement = function (onDone) {
  const sp = [
    { role: 'r', a: '2', f: 'H2', n: '2,0' },
    { role: 'r', a: '1', f: 'O2', n: '1,5' },
    { role: 'p', a: '2', f: 'H2O', n: '0' },
  ];
  let unit = 'mol', compute = true;
  const body = L.h('div', { class: 'avc' });
  const prev = L.h('div', { class: 'avc-prev' });
  const num = s => { const v = parseFloat(String(s).replace(',', '.')); return isNaN(v) ? null : v; };
  const fr = v => String(Math.round(v * 1000) / 1000).replace('.', '{,}');
  const tex = s => L.quickTex(String(s || '').trim()).replace(/\b([a-zA-Z])(\d+)\b/g, '$1_{$2}');
  const coef = a => (!a || a === '1') ? '' : String(a).replace(',', '{,}');
  const eqLatex = () => '\\ce{' + sp.filter(s => s.role === 'r').map(s => ((s.a && s.a !== '1') ? s.a + ' ' : '') + s.f).join(' + ') + ' -> ' +
    sp.filter(s => s.role === 'p').map(s => ((s.a && s.a !== '1') ? s.a + ' ' : '') + s.f).join(' + ') + '}';
  const build = () => {
    const S = sp.filter(s => s.f.trim());
    const ns = S.length;
    const M = l => '<span class="imath" data-latex="' + L.escHtml(l) + '"></span>';
    let xmax = null;
    const reacts = S.filter(s => s.role === 'r');
    if (compute && reacts.length && reacts.every(s => num(s.n) !== null && num(s.a || '1'))) xmax = Math.min(...reacts.map(s => num(s.n) / num(s.a || '1')));
    const expr = (s, x) => {
      const a = coef(s.a), n0 = String(s.n || '').trim();
      if (s.role === 'r') return (n0 ? tex(n0) : 'n_0') + ' - ' + a + x;
      return (!n0 || num(n0) === 0) ? a + x : tex(n0) + ' + ' + a + x;
    };
    const rows = [
      ['Équation de la réaction', '', M(eqLatex()), ...Array(ns - 1).fill('')],
      ['État du système', 'Avancement (' + unit + ')', 'Quantités de matière (' + unit + ')', ...Array(ns - 1).fill('')],
      ['État initial', M('x = 0'), ...S.map(s => M(tex(s.n) || '0'))],
      ['En cours', M('x'), ...S.map(s => M(expr(s, 'x')))],
      ['État final', M(xmax !== null ? 'x_{\\max} = ' + fr(xmax) : 'x_{\\max}'),
        ...S.map(s => M(xmax !== null ? fr(Math.max(0, s.role === 'r' ? num(s.n) - num(s.a || '1') * xmax : (num(s.n) || 0) + num(s.a || '1') * xmax)) : expr(s, 'x_{\\max}')))],
    ];
    const spans = { '0:0': 2 };
    if (ns > 1) { spans['0:2'] = ns; spans['1:2'] = ns; }
    return L.newBlock('table', { head: false, style: 'grille', align: Array(ns + 2).fill('c'), spans, rows, caption: 'Tableau d\'avancement de la réaction' });
  };
  const refresh = () => {
    const b = build();
    const ctx = { doc: App.doc, mode: 'view', nums: {}, bib: {}, lang: App.doc.meta.lang, meta: App.doc.meta, fn: 0 };
    const el = L.R.table(b, ctx);
    el.querySelector('.caption').remove();
    prev.replaceChildren(L.h('div', { class: 'paper ' + L.pageClasses(App.doc.meta), style: { padding: '8px' } }, el));
  };
  const draw = () => {
    body.innerHTML = '';
    const tbl = L.h('div', { class: 'avc-list' });
    tbl.appendChild(L.h('div', { class: 'avc-row avc-h' }, L.h('span', { text: 'Espèce' }), L.h('span', { text: 'Coefficient' }), L.h('span', { text: 'Formule' }), L.h('span', { text: 'Quantité initiale' }), L.h('span')));
    sp.forEach((s, i) => {
      const inp = (k, ph) => { const x = L.h('input', { type: 'text', value: s[k], placeholder: ph }); x.oninput = () => { s[k] = x.value; refresh(); }; return x; };
      tbl.appendChild(L.h('div', { class: 'avc-row' },
        L.h('span', { class: 'avc-role ' + s.role, text: s.role === 'r' ? 'Réactif' : 'Produit' }),
        inp('a', '1'), inp('f', 'ex. CuSO4'), inp('n', s.role === 'r' ? 'ex. 2,0 ou n1' : '0'),
        L.h('button', { class: 'btn danger', text: '×', title: 'Retirer', onclick: () => { sp.splice(i, 1); draw(); refresh(); } })));
    });
    const unitSel = L.h('select', null, ...['mol', 'mmol', 'µmol'].map(u => { const o = L.h('option', { value: u, text: u }); if (u === unit) o.selected = true; return o; }));
    unitSel.onchange = () => { unit = unitSel.value; refresh(); };
    const chk = L.h('input', { type: 'checkbox' }); chk.checked = compute; chk.onchange = () => { compute = chk.checked; refresh(); };
    body.append(
      L.h('p', { class: 'pp-help', html: 'Saisissez les réactifs et les produits : le tableau (équation, états initial / en cours / final) est construit automatiquement. Formules chimiques en écriture simple : <b>H2O</b>, <b>Cu^2+</b>, <b>SO4^2-</b>.' }),
      tbl,
      L.h('div', { class: 'btn-row', style: { margin: '8px 0 12px' } },
        L.h('button', { class: 'btn', text: '+ Réactif', onclick: () => { const j = sp.filter(s => s.role === 'r').length; sp.splice(j, 0, { role: 'r', a: '1', f: '', n: '' }); draw(); refresh(); } }),
        L.h('button', { class: 'btn', text: '+ Produit', onclick: () => { sp.push({ role: 'p', a: '1', f: '', n: '0' }); draw(); refresh(); } })),
      L.h('div', { class: 'grid2' },
        L.h('div', { class: 'field' }, L.h('label', { text: 'Unité' }), unitSel),
        L.h('label', { class: 'chk', style: { marginTop: '18px' } }, chk, 'Calculer x', L.h('sub', { text: 'max' }), ' et l\'état final (quantités numériques)')),
      L.h('div', { class: 'set-h', text: 'Aperçu' }), prev);
  };
  draw(); refresh();
  L.modal({
    title: 'Tableau d\'avancement', body, wide: true,
    foot: [{ text: 'Annuler', onClick: c => c() }, { text: 'Insérer le tableau', cls: 'primary', onClick: c => { c(); onDone(build()); } }],
  });
};
