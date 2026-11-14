/* TikZ visuel : fenêtre de dessin à la souris (module complémentaire « tikzdraw »).
   On choisit un outil, on clique sur la feuille ; tout se règle ensuite dans le panneau
   de droite (couleurs, noms, formules des courbes…). Aucun code à écrire : le dessin
   affiché est celui du document (même moteur TikZ), une couche transparente reçoit la souris.
   Modèle et code TikZ : js/tikzdraw.js — styles : css/tikzdraw.css (+ css/schemabloc.css) */
(function () {
  const TD = L.TD, CM = 37.7952756, NS = 'http://www.w3.org/2000/svg';
  const WORLD = [4400, 3200], ORG = [2200, 1600];   // plan de travail (px) et position de l'origine
  const S = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    return e;
  };
  const ICONS = {
    sel: '<path d="M6 3l12 9.5-5.6.9 3.3 6.4-2.6 1.3-3.3-6.5L6 18.5z"/>',
    point: '<circle cx="9" cy="15" r="2.8" fill="currentColor"/><path d="M14 5h6M17 5v7"/>',
    seg: '<path d="M5 18L19 6"/><circle cx="5" cy="18" r="1.9" fill="currentColor"/><circle cx="19" cy="6" r="1.9" fill="currentColor"/>',
    vec: '<path d="M4 19L19 5M11.5 5H19v7.5"/>',
    line: '<path d="M3 18l5-10 6 7 7-11"/>',
    poly: '<path d="M5 19l2-13 11-2 3 12z"/>',
    rect: '<rect x="3.5" y="6" width="17" height="12" rx=".5"/>',
    circle: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="9.5" ry="5.8"/>',
    arc: '<path d="M4 17.5a8.5 8.5 0 0 1 15.5-4.8"/><circle cx="12" cy="17.5" r="1.1" fill="currentColor"/>',
    angle: '<path d="M3 19h18M3 19L15 5"/><path d="M10 19a7 7 0 0 0-2.4-5.3"/>',
    text: '<path d="M6 6h12M12 6v13M9.5 19h5"/>',
    grid: '<path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>',
    axes: '<path d="M3 16h18M18 13l3 3-3 3M7 21V3M4 6l3-3 3 3"/>',
    func: '<path d="M3 20c3-11 6-13 9-6s6 4 9-10"/>',
  };
  const ico = (k, size) => {
    const s = S('svg', { viewBox: '0 0 24 24', width: size || 20, height: size || 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    s.innerHTML = ICONS[k] || '';
    return s;
  };
  const fr = v => { const r = Math.round(v * 100) / 100; return String(Object.is(r, -0) ? 0 : r).replace('.', ','); };
  const rnd = v => Math.round(v * 100) / 100;
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const angOf = (c, q) => Math.round(Math.atan2(q[1] - c[1], q[0] - c[0]) * 360 / Math.PI) / 2;   // degrés, au demi-degré
  const mod360 = a => ((a % 360) + 360) % 360;
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  const NAMES = { point: 'Point', seg: 'Segment', line: 'Ligne brisée', rect: 'Rectangle', circle: 'Cercle', ellipse: 'Ellipse', arc: 'Arc de cercle', angle: 'Angle', text: 'Texte', grid: 'Quadrillage', axes: 'Repère', func: 'Courbe' };
  const nameOf = it => it.t === 'seg' && it.st && it.st.a ? 'Flèche' : it.t === 'line' && it.closed ? 'Polygone' : it.t === 'arc' && it.sector ? 'Part de disque' : NAMES[it.t];
  const icoOf = it => it.t === 'seg' ? (it.st && it.st.a ? 'vec' : 'seg') : it.t === 'line' ? (it.closed ? 'poly' : 'line') : it.t;
  const TOOLS = [
    ['sel', 'Choisir', 'Choisir, déplacer, modifier (V ou Échap)', 'v'],
    ['point', 'Point', 'Placer des points, nommés A, B, C… (P)', 'p'],
    ['seg', 'Segment', 'Segment : cliquez ses deux bouts (S)', 's'],
    ['vec', 'Flèche', 'Flèche, vecteur, force : origine puis extrémité (F)', 'f'],
    ['line', 'Ligne', 'Ligne brisée : un clic par sommet, double-clic pour finir (L)', 'l'],
    ['poly', 'Polygone', 'Triangle, quadrilatère… : un clic par sommet (G)', 'g'],
    ['rect', 'Rectangle', 'Rectangle : deux coins opposés (R)', 'r'],
    ['circle', 'Cercle', 'Cercle : centre puis un point du cercle (C)', 'c'],
    ['ellipse', 'Ellipse', 'Ellipse : centre puis un coin (E)', 'e'],
    ['arc', 'Arc', 'Arc de cercle : centre, début, fin (A)', 'a'],
    ['angle', 'Angle', 'Marquer un angle : un point, le sommet, un point (N)', 'n'],
    ['text', 'Texte', 'Texte ou formule (T)', 't'],
    ['grid', 'Quadrillage', 'Quadrillage : deux coins opposés (Q)', 'q'],
  ];
  const NEED = { seg: 2, vec: 2, rect: 2, grid: 2, circle: 2, ellipse: 2, arc: 3, angle: 3, line: Infinity, poly: Infinity };
  const HINTS = {
    point: 'Cliquez pour placer un point (nommé automatiquement). Les points existants attirent la souris.',
    seg: 'Cliquez le premier bout puis le second (ou glissez de l\'un à l\'autre).',
    vec: 'Cliquez l\'origine de la flèche puis son extrémité (ou glissez).',
    line: 'Cliquez chaque sommet. Double-clic ou Entrée pour terminer.',
    poly: 'Cliquez chaque sommet. Cliquez le premier sommet (ou Entrée) pour fermer.',
    rect: 'Cliquez un coin puis le coin opposé (ou glissez).',
    circle: 'Cliquez le centre puis un point du cercle (ou glissez).',
    ellipse: 'Cliquez le centre puis un coin du rectangle qui entoure l\'ellipse.',
    arc: 'Cliquez le centre, puis le début de l\'arc, puis sa fin (sens inverse des aiguilles d\'une montre).',
    angle: 'Cliquez un point du premier côté, puis le sommet, puis un point du second côté.',
    text: 'Cliquez où placer le texte.',
    grid: 'Cliquez un coin puis le coin opposé du quadrillage.',
  };
  const QUICK = [['a/b', '\\frac{#@}{#?}', 'Fraction'], ['x²', '#@^{#?}', 'Exposant'], ['x₁', '#@_{#?}', 'Indice'], ['√', '\\sqrt{#?}', 'Racine'],
    ['→', '\\vec{#?}', 'Vecteur'], ['α', '\\alpha'], ['β', '\\beta'], ['θ', '\\theta'], ['π', '\\pi'], ['Δ', '\\Delta'], ['°', '^{\\circ}', 'Degré']];
  const POSGRID = [['above left', '↖'], ['above', '↑'], ['above right', '↗'], ['left', '←'], ['center', '•'], ['right', '→'], ['below left', '↙'], ['below', '↓'], ['below right', '↘']];
  const LPOS_DIR = { 'above left': [-1, 1], above: [0, 1], 'above right': [1, 1], left: [-1, 0], center: [0, 0], right: [1, 0], 'below left': [-1, -1], below: [0, -1], 'below right': [1, -1] };
  const SIZESCALE = { small: 0.9, normal: 1, large: 1.2, Large: 1.44 };
  const FUNC_COLORS = ['bleu', 'rouge', 'vert', 'violet', 'orange', 'marron'];
  const EXPR_EX = ['x² − 1', '2x + 1', 'sin(x)', 'e^(−x)', '1/x', '√x', 'ln(x)', 'x³ − 3x'];
  const EXPR_KEYS = [['x²', '^2'], ['xⁿ', '^'], ['√', '√('], ['π', 'π'], ['sin', 'sin('], ['cos', 'cos('], ['eˣ', 'e^('], ['ln', 'ln('], ['|x|', 'abs(']];

  /* block : bloc « tikz » à modifier, ou null pour un nouveau dessin (onDone reçoit alors le bloc créé) */
  L.dlgTikzDraw = function (block, onDone) {
    const meta = App.doc.meta, fontPt = L.TikZ.fontPt(meta.fontSize);
    let td = TD.repair(JSON.parse(JSON.stringify((block && block.td) || { items: [], opts: {} })));
    let sel = new Set(), tool = 'sel', zoom = 1, drag = null, draft = null, mag = null, vb = null, clip = null;
    let editKey = null, dirty = false, saved = false, raf = 0, dlg = null, focusField = null, lastClick = null, gDyn = null, pan = null;
    const undo = [], redo = [];

    const X = x => ORG[0] + x * CM, Y = y => ORG[1] - y * CM;
    const item = id => td.items.find(i => i.id === id);
    const opts = () => Object.assign({ snap: 0.25, magnet: true, autoname: true }, TD.DEF, td.opts);

    /* ---------- Structure de la fenêtre ---------- */
    const stage = L.h('div', { class: 'sbe-stage tde-stage', tabindex: '-1' });
    const sizer = L.h('div', { class: 'sbe-sizer' });
    const world = L.h('div', { class: 'tde-world', style: { width: WORLD[0] + 'px', height: WORLD[1] + 'px' } });
    world.style.backgroundSize = CM + 'px ' + CM + 'px, ' + CM + 'px ' + CM + 'px, ' + (CM / 2) + 'px ' + (CM / 2) + 'px, ' + (CM / 2) + 'px ' + (CM / 2) + 'px';
    world.style.backgroundPosition = (ORG[0] % CM) + 'px ' + (ORG[1] % CM) + 'px';
    const drawL = L.h('div', { class: 'sbe-draw paper ' + L.pageClasses(meta) });
    const over = S('svg', { class: 'sbe-over tde-over', width: WORLD[0], height: WORLD[1] });
    world.append(drawL, over);
    sizer.appendChild(world);
    const tplBox = L.h('div', { class: 'sbe-tpl', hidden: true });
    const stageWrap = L.h('div', { class: 'sbe-stagewrap' }, stage, tplBox);
    stage.appendChild(sizer);
    const side = L.h('div', { class: 'sbe-side' });
    const pal = L.h('div', { class: 'tde-pal' });
    const bar = L.h('div', { class: 'sbe-bar' });
    const hint = L.h('span', { class: 'sbe-hint' }), coords = L.h('span', { class: 'tde-coords' }), info = L.h('span', { class: 'sbe-info' });
    const root = L.h('div', { class: 'sbe tde' }, bar, L.h('div', { class: 'sbe-main' }, pal, stageWrap, side), L.h('div', { class: 'sbe-status' }, hint, coords, info));

    /* ---------- Historique ---------- */
    const push = () => { undo.push(JSON.stringify(td)); if (undo.length > 150) undo.shift(); redo.length = 0; dirty = true; };
    const restore = json => {
      td = JSON.parse(json);
      sel = new Set([...sel].filter(item));
      editKey = null; dirty = true; draft = null;
      refresh(); renderSide();
    };
    const doUndo = () => { if (undo.length) { redo.push(JSON.stringify(td)); restore(undo.pop()); } };
    const doRedo = () => { if (redo.length) { undo.push(JSON.stringify(td)); restore(redo.pop()); } };
    const act = fn => { push(); editKey = null; fn(); refresh(); renderSide(); };
    const typing = key => { if (editKey !== key) { push(); editKey = key; } dirty = true; };
    const soon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; refresh(); }); };

    /* ---------- Géométrie de la couche souris (px) ---------- */
    const ptsD = (ps, closed) => ps.map((q, k) => (k ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join('') + (closed ? 'Z' : '');
    const ellD = (c, rx, ry) => {
      const x = X(c[0]), y = Y(c[1]), a = rx * CM, b = ry * CM;
      return 'M' + (x - a) + ' ' + y + 'A' + a + ' ' + b + ' 0 1 0 ' + (x + a) + ' ' + y + 'A' + a + ' ' + b + ' 0 1 0 ' + (x - a) + ' ' + y + 'Z';
    };
    const arcD = (c, r, a0, a1, sector) => {
      const d = a1 - a0;
      if (Math.abs(d) >= 359.99) return ellD(c, r, r);
      const p = a => [c[0] + r * Math.cos(a * Math.PI / 180), c[1] + r * Math.sin(a * Math.PI / 180)];
      const s = p(a0), e = p(a1), R = r * CM;
      return (sector ? 'M' + X(c[0]) + ' ' + Y(c[1]) + 'L' : 'M') + X(s[0]) + ' ' + Y(s[1]) + 'A' + R + ' ' + R + ' 0 ' + (Math.abs(d) > 180 ? 1 : 0) + ' ' + (d > 0 ? 0 : 1) + ' ' + X(e[0]) + ' ' + Y(e[1]) + (sector ? 'Z' : '');
    };
    const rectEl = (b, cls) => S('rect', { x: X(b[0]), y: Y(b[1] + b[3]), width: b[2] * CM, height: b[3] * CM, class: cls });
    const textSize = (lab, k) => { const t = TD.content(lab); return t ? L.TikZ.textSize(t, fontPt, k || 1) : null; };
    const textBox = it => {
      const sz = textSize(it.lab, SIZESCALE[it.size]) || { w: 1.3, h: 0.55 };
      const pad = it.frame ? 0.16 : 0.06, w = sz.w + 2 * pad, h = sz.h + 2 * pad;
      return [it.p[0] - w / 2, it.p[1] - h / 2, w, h];
    };
    const labelBox = (p, lab, lpos) => {
      const sz = textSize(lab);
      if (!sz) return null;
      const d = LPOS_DIR[lpos] || [0, 0];
      const cx = p[0] + d[0] * (sz.w / 2 + 0.12), cy = p[1] + d[1] * (sz.h / 2 + 0.08);
      return [cx - sz.w / 2, cy - sz.h / 2, sz.w, sz.h];
    };
    const axesGeom = ax => {
      const ay = ax.y[0] < 0 && ax.y[1] > 0 ? 0 : ax.y[0], axx = ax.x[0] < 0 && ax.x[1] > 0 ? 0 : ax.x[0], P = (x, y) => TD.toCm(ax, x, y);
      return { xa: [P(ax.x[0], ay), P(ax.x[1], ay)], ya: [P(axx, ax.y[0]), P(axx, ax.y[1])], box: [P(ax.x[0], ax.y[0]), P(ax.x[1], ax.y[1])] };
    };
    function funcPts(it) {
      const ax = TD.axOf(td, it.ax), c = ax && TD.compile(it.expr);
      if (!c || !c.ok) return [];
      const d0 = it.d ? Math.max(it.d[0], ax.x[0]) : ax.x[0], d1 = it.d ? Math.min(it.d[1], ax.x[1]) : ax.x[1];
      if (!(d1 > d0)) return [];
      return TD.pieces(c.f, d0, d1, ax.y[0], ax.y[1]).parts.map(([a, b]) => {
        const ps = [];
        for (let k = 0; k <= 90; k++) { const x = a + (b - a) * k / 90, y = c.f(x); if (isFinite(y)) ps.push(TD.toCm(ax, x, Math.max(ax.y[0], Math.min(ax.y[1], y)))); }
        return ps;
      });
    }
    // Zone cliquable d'un élément : trait épais invisible, ou surface s'il est rempli
    function hitShapes(it) {
      const st = it.st || {}, path = (d, fill) => S('path', { d, class: 'tde-hit' + (fill ? ' fill' : '') });
      switch (it.t) {
        case 'point': {
          const out = [S('circle', { cx: X(it.p[0]), cy: Y(it.p[1]), r: 8, class: 'tde-hit fill' })], lb = labelBox(it.p, it.lab, it.lpos);
          if (lb) out.push(rectEl(lb, 'tde-hit fill'));
          return out;
        }
        case 'seg': return [path(ptsD(it.p))];
        case 'line': return [path(ptsD(it.p, it.closed), it.closed && st.f)];
        case 'rect': case 'grid': { const [a, b] = it.p; return [path(ptsD([a, [b[0], a[1]], b, [a[0], b[1]]], true), it.t === 'rect' && !!st.f)]; }
        case 'circle': return [path(ellD(it.c, it.r, it.r), !!st.f)];
        case 'ellipse': return [path(ellD(it.c, it.r[0], it.r[1]), !!st.f)];
        case 'arc': return [path(arcD(it.c, it.r, it.a[0], it.a[1], it.sector), it.sector && !!st.f)];
        case 'angle': { const g = TD.angleGeom(it); return [path(arcD(it.p[1], Math.max(it.r, 0.35), g.a, g.a + g.d, true), true)]; }
        case 'text': return [rectEl(textBox(it), 'tde-hit fill')];
        case 'axes': { const g = axesGeom(it); return [path(ptsD(g.xa) + ptsD(g.ya))]; }
        case 'func': return funcPts(it).map(ps => path(ptsD(ps)));
        default: return [];
      }
    }
    function selShapes(it) {
      if (it.t === 'point') return [S('circle', { cx: X(it.p[0]), cy: Y(it.p[1]), r: 7, class: 'tde-selbox' })];
      if (it.t === 'text') return [rectEl(textBox(it), 'tde-selbox')];
      return hitShapes(it).map(e => { e.setAttribute('class', 'tde-selpath'); return e; });
    }
    function handlesOf(it) {
      const H = (k, p) => ({ k, p });
      switch (it.t) {
        case 'seg': case 'line': case 'angle': return it.p.map((q, k) => H(k, q));
        case 'rect': case 'grid': { const [a, b] = it.p; return [H(0, a), H(1, b), H(2, [a[0], b[1]]), H(3, [b[0], a[1]])]; }
        case 'circle': return [H('r', [it.c[0] + it.r, it.c[1]])];
        case 'ellipse': return [H('rx', [it.c[0] + it.r[0], it.c[1]]), H('ry', [it.c[0], it.c[1] + it.r[1]])];
        case 'arc': { const q = a => [it.c[0] + it.r * Math.cos(a * Math.PI / 180), it.c[1] + it.r * Math.sin(a * Math.PI / 180)]; return [H('a0', q(it.a[0])), H('a1', q(it.a[1]))]; }
        case 'axes': { const g = axesGeom(it); return [H('x0', g.xa[0]), H('x1', g.xa[1]), H('y0', g.ya[0]), H('y1', g.ya[1])]; }
        default: return [];
      }
    }
    function setHandle(it, k, q) {
      switch (it.t) {
        case 'seg': case 'line': case 'angle': it.p[k] = q; break;
        case 'rect': case 'grid': {
          const [a, b] = it.p;
          if (k === 0) it.p[0] = q; else if (k === 1) it.p[1] = q;
          else if (k === 2) { a[0] = q[0]; b[1] = q[1]; } else { b[0] = q[0]; a[1] = q[1]; }
          break;
        }
        case 'circle': it.r = Math.max(0.05, rnd(dist(it.c, q))); break;
        case 'ellipse': if (k === 'rx') it.r[0] = Math.max(0.05, rnd(Math.abs(q[0] - it.c[0]))); else it.r[1] = Math.max(0.05, rnd(Math.abs(q[1] - it.c[1]))); break;
        case 'arc': {
          const a = angOf(it.c, q);
          if (k === 'a0') { const end = it.a[1]; it.r = Math.max(0.05, rnd(dist(it.c, q))); it.a = [a, a + (mod360(end - a) || 360)]; }
          else it.a = [it.a[0], it.a[0] + (mod360(a - it.a[0]) || 360)];
          break;
        }
        case 'axes': {
          // les bouts des axes : on allonge ou raccourcit l'axe (en unités du repère)
          const u = TD.fromCm(it, q[0], q[1]), g = it.xpi ? Math.PI / 12 : 0.5, r = v => Math.round(v / g) * g;
          if (k === 'x0') it.x[0] = Math.min(r(u[0]), it.x[1] - g);
          else if (k === 'x1') it.x[1] = Math.max(r(u[0]), it.x[0] + g);
          else if (k === 'y0') it.y[0] = Math.min(r(u[1]), it.y[1] - 0.5);
          else it.y[1] = Math.max(r(u[1]), it.y[0] + 0.5);
          break;
        }
        default: break;
      }
    }
    // Rectangle englobant (cm) : sélection au lasso, cadrage
    function bboxOf(it) {
      let ps;
      switch (it.t) {
        case 'circle': case 'arc': ps = [[it.c[0] - it.r, it.c[1] - it.r], [it.c[0] + it.r, it.c[1] + it.r]]; break;
        case 'ellipse': ps = [[it.c[0] - it.r[0], it.c[1] - it.r[1]], [it.c[0] + it.r[0], it.c[1] + it.r[1]]]; break;
        case 'text': { const b = textBox(it); ps = [[b[0], b[1]], [b[0] + b[2], b[1] + b[3]]]; break; }
        case 'axes': ps = axesGeom(it).box; break;
        case 'func': { const ax = TD.axOf(td, it.ax); ps = ax ? axesGeom(ax).box : []; break; }
        case 'point': ps = [it.p]; break;
        default: ps = it.p || [];
      }
      if (!ps.length) return null;
      return [Math.min(...ps.map(q => q[0])), Math.min(...ps.map(q => q[1])), Math.max(...ps.map(q => q[0])), Math.max(...ps.map(q => q[1]))];
    }
    const refPoint = it => it.t === 'angle' ? it.p[1] : it.t === 'func' ? ((TD.axOf(td, it.ax) || {}).o || [0, 0]) : TD.keyPoints(it)[0] || [0, 0];

    /* ---------- Dessin ---------- */
    let err = null;
    function refresh() {
      const r = L.TikZ.render(TD.toTikz(td), { fontSize: meta.fontSize });
      drawL.replaceChildren();
      vb = null;
      if (r.svg && !r.empty) {
        vb = (r.svg.getAttribute('viewBox') || '0 0 0 0').split(/\s+/).map(Number);
        r.svg.style.cssText = 'position:absolute;max-width:none;overflow:visible;left:' + (ORG[0] + vb[0]) + 'px;top:' + (ORG[1] + vb[1]) + 'px;';
        drawL.appendChild(r.svg);
      }
      err = r.error || null;
      drawOver();
      status();
      buttons();
    }
    const buttons = () => L.$$('button[data-need]', bar).forEach(b => { b.disabled = b.dataset.need === 'undo' ? !undo.length : b.dataset.need === 'redo' ? !redo.length : !sel.size; });
    function drawOver() {
      over.replaceChildren();
      const gH = S('g', {}), gS = S('g', {});
      over.append(gH, gS);
      td.items.forEach(it => {
        if (it.t === 'text' && !TD.content(it.lab)) {
          const b = textBox(it);
          gH.appendChild(rectEl(b, 'sbe-ghost'));
          const t = S('text', { x: X(it.p[0]), y: Y(it.p[1]) + 4, class: 'sbe-ghost-t', 'text-anchor': 'middle' });
          t.textContent = 'Texte';
          gH.appendChild(t);
        }
        hitShapes(it).forEach(el => { el.dataset.i = it.id; gH.appendChild(el); });
        if (sel.has(it.id)) selShapes(it).forEach(el => gS.appendChild(el));
      });
      if (tool === 'sel' && sel.size === 1) {
        const it = item([...sel][0]);
        if (it) handlesOf(it).forEach(h => gS.appendChild(S('rect', { x: X(h.p[0]) - 5, y: Y(h.p[1]) - 5, width: 10, height: 10, rx: 2, class: 'tde-handle', 'data-i': it.id, 'data-h': h.k })));
      }
      gDyn = S('g', {});
      over.appendChild(gDyn);
      over.classList.toggle('creating', tool !== 'sel');
      drawDyn();
    }
    // Ce qui suit la souris : tracé en cours, aimant, lasso
    function drawDyn() {
      if (!gDyn) return;
      gDyn.replaceChildren();
      const add = (tag, a) => gDyn.appendChild(S(tag, a));
      if (draft) {
        const P = draft.pts, c = draft.cur, t = draft.tool;
        const A = P[0];
        if (t === 'seg' || t === 'vec') add('path', { d: ptsD([A, c]), class: 'tde-draft' + (t === 'vec' ? ' vec' : '') });
        else if (t === 'line' || t === 'poly') add('path', { d: ptsD(P.concat([c]), t === 'poly' && P.length > 1), class: 'tde-draft' });
        else if (t === 'rect' || t === 'grid') add('path', { d: ptsD([A, [c[0], A[1]], c, [A[0], c[1]]], true), class: 'tde-draft' });
        else if (t === 'circle') { add('path', { d: ellD(A, dist(A, c), dist(A, c)), class: 'tde-draft' }); add('path', { d: ptsD([A, c]), class: 'tde-draft thin' }); }
        else if (t === 'ellipse') add('path', { d: ellD(A, Math.abs(c[0] - A[0]) || 0.01, Math.abs(c[1] - A[1]) || 0.01), class: 'tde-draft' });
        else if (t === 'arc') {
          if (P.length === 1) { add('path', { d: ellD(A, dist(A, c), dist(A, c)), class: 'tde-draft thin' }); add('path', { d: ptsD([A, c]), class: 'tde-draft thin' }); }
          else { const r = dist(A, P[1]), a0 = angOf(A, P[1]); add('path', { d: arcD(A, r, a0, a0 + (mod360(angOf(A, c) - a0) || 360)), class: 'tde-draft' }); }
        } else if (t === 'angle') add('path', { d: ptsD(P.concat([c])), class: 'tde-draft' });
        P.forEach((q, k) => add('circle', { cx: X(q[0]), cy: Y(q[1]), r: k === 0 && t === 'poly' && P.length > 2 ? 6 : 3.5, class: 'tde-dot' + (k === 0 && t === 'poly' && P.length > 2 ? ' close' : '') }));
      }
      if (mag) add('circle', { cx: X(mag[0]), cy: Y(mag[1]), r: 7, class: 'tde-mag' });
      if (drag && drag.k === 'band' && drag.moved) {
        const a = drag.m0, b = drag.m;
        add('rect', { x: Math.min(a.px, b.px), y: Math.min(a.py, b.py), width: Math.abs(a.px - b.px), height: Math.abs(a.py - b.py), class: 'sbe-band' });
      }
    }
    function status() {
      const tw = L.TEXTWIDTH_CM ? L.TEXTWIDTH_CM(meta) : 16;
      if (err) { info.textContent = '⚠ ' + err; info.className = 'sbe-info warn'; }
      else if (!vb) { info.textContent = ''; info.className = 'sbe-info'; }
      else {
        const w = vb[2] / CM, big = w > tw + 0.05;
        info.textContent = (big ? '⚠ ' : '') + 'Largeur ' + fr(w) + ' cm' + (big ? ' : plus large que le texte de la page (' + fr(tw) + ' cm)' : ' · page : ' + fr(tw) + ' cm');
        info.className = 'sbe-info' + (big ? ' warn' : '');
      }
      const one = sel.size === 1 ? item([...sel][0]) : null;
      hint.textContent = tool !== 'sel' ? HINTS[tool] + '  ·  Alt : sans aimant  ·  Échap : terminer'
        : !td.items.length ? 'Choisissez un outil à gauche (point, segment, cercle…) ou un modèle, puis cliquez sur la feuille.'
          : one && handlesOf(one).length ? 'Glissez pour déplacer · tirez les petits carrés pour modifier · Suppr : supprimer'
            : sel.size ? 'Glissez pour déplacer · flèches du clavier : déplacer finement · Suppr : supprimer'
              : 'Cliquez un élément pour le régler · glissez dans le vide pour en choisir plusieurs';
    }
    const showCoords = m => { coords.textContent = m ? 'x = ' + fr(m[0]) + '  y = ' + fr(m[1]) + ' cm' : ''; };

    /* ---------- Vue ---------- */
    function setZoom(z, cx, cy) {
      const old = zoom;
      zoom = Math.max(0.3, Math.min(3, z));
      cx = cx === undefined ? stage.clientWidth / 2 : cx; cy = cy === undefined ? stage.clientHeight / 2 : cy;
      const ux = (stage.scrollLeft + cx) / old, uy = (stage.scrollTop + cy) / old;
      world.style.transform = 'scale(' + zoom + ')';
      sizer.style.width = WORLD[0] * zoom + 'px'; sizer.style.height = WORLD[1] * zoom + 'px';
      stage.scrollLeft = ux * zoom - cx; stage.scrollTop = uy * zoom - cy;
      zoomLab.textContent = Math.round(zoom * 100) + ' %';
    }
    function fit() {
      const W = stage.clientWidth || 800, H = stage.clientHeight || 500;
      if (!vb) { setZoom(1); stage.scrollLeft = ORG[0] - W * 0.35; stage.scrollTop = ORG[1] - H * 0.6; return; }
      const w = vb[2] + 160, h = vb[3] + 160;
      setZoom(Math.min(1.6, W / w, H / h));
      stage.scrollLeft = (ORG[0] + vb[0] + vb[2] / 2) * zoom - W / 2;
      stage.scrollTop = (ORG[1] + vb[1] + vb[3] / 2) * zoom - H / 2;
    }
    const viewCenter = () => [TD.snap(((stage.scrollLeft + stage.clientWidth / 2) / zoom - ORG[0]) / CM, 0.5), TD.snap((ORG[1] - (stage.scrollTop + stage.clientHeight / 2) / zoom) / CM, 0.5)];

    /* ---------- Aimants ---------- */
    // Point visé : un point existant tout proche (aimant), sinon la grille ; Alt : position libre
    function snapPt(m, e, exclude, extra) {
      const o = opts();
      mag = null;
      if (e && e.altKey) return [rnd(m.x), rnd(m.y)];
      if (o.magnet !== false) {
        let best = null, bd = 11 / zoom / CM;
        const tryP = q => { const d = Math.hypot(q[0] - m.x, q[1] - m.y); if (d < bd) { bd = d; best = q; } };
        td.items.forEach(it => { if (!exclude || !exclude.has(it.id)) TD.keyPoints(it).forEach(tryP); });
        (extra || []).forEach(tryP);
        if (best) { mag = best.slice(); return best.slice(); }
      }
      return [TD.snap(m.x, o.snap), TD.snap(m.y, o.snap)];
    }

    /* ---------- Actions ---------- */
    const selChanged = () => {
      editKey = null;
      // un texte resté vide disparaît quand on le quitte
      const before = td.items.length;
      td.items = td.items.filter(i => i.t !== 'text' || sel.has(i.id) || TD.content(i.lab));
      if (td.items.length !== before) refresh(); else drawOver();
      status(); renderSide(); buttons();
    };
    const select = ids => { sel = new Set(ids); selChanged(); };
    const lab0 = mode => ({ latex: '', mode: mode || 'm' });
    const add = it => { it.id = TD.newId(td, it.t); it.st = it.st || {}; td.items.push(it); return it; };
    function setTool(k) {
      if (draft) finishDraft(true);
      tool = k;
      mag = null;
      L.$$('.tde-tool', pal).forEach(b => b.classList.toggle('on', b.dataset.tool === k));
      drawOver(); status();
    }
    function finishDraft(quiet) {
      const d = draft;
      draft = null; mag = null;
      if (!d) return;
      const P = d.pts, t = d.tool;
      let it = null;
      if (t === 'seg' || t === 'vec') { if (P.length > 1 && dist(P[0], P[1]) > 0.04) it = { t: 'seg', p: [P[0], P[1]], lab: lab0(), lpos: 'above', lat: 'mid', st: t === 'vec' ? { a: '->' } : {} }; }
      else if (t === 'line' || t === 'poly') { if (P.length >= 2) it = { t: 'line', p: P, closed: t === 'poly' && P.length >= 3 }; }
      else if (t === 'rect' || t === 'grid') {
        if (P.length > 1) {
          const a = [Math.min(P[0][0], P[1][0]), Math.min(P[0][1], P[1][1])], b = [Math.max(P[0][0], P[1][0]), Math.max(P[0][1], P[1][1])];
          if (b[0] - a[0] > 0.04 && b[1] - a[1] > 0.04) it = t === 'rect' ? { t, p: [a, b] } : { t, p: [a, b], step: 0.5 };
        }
      } else if (t === 'circle') { const r = P.length > 1 ? rnd(dist(P[0], P[1])) : 0; if (r > 0.04) it = { t, c: P[0], r }; }
      else if (t === 'ellipse') {
        if (P.length > 1) {
          let rx = rnd(Math.abs(P[1][0] - P[0][0])), ry = rnd(Math.abs(P[1][1] - P[0][1]));
          if (rx < 0.05) rx = ry; if (ry < 0.05) ry = rx;
          if (rx > 0.04) it = { t, c: P[0], r: [rx, ry] };
        }
      } else if (t === 'arc') {
        if (P.length > 2 && dist(P[0], P[1]) > 0.04) { const a0 = angOf(P[0], P[1]); it = { t, c: P[0], r: rnd(dist(P[0], P[1])), a: [a0, a0 + (mod360(angOf(P[0], P[2]) - a0) || 360)], sector: false }; }
      } else if (t === 'angle') {
        if (P.length > 2 && dist(P[0], P[1]) > 0.04 && dist(P[2], P[1]) > 0.04) it = { t, p: P, r: 0.5, mk: 'auto', dbl: false, lab: lab0() };
      }
      if (!it) { if (!quiet) drawDyn(); return; }
      act(() => { const x = add(it); sel = new Set([x.id]); });
    }
    function createAt(e, m) {
      const q = snapPt(m, e, null, draft ? draft.pts : null);
      if (tool === 'point') {
        act(() => { const it = add({ t: 'point', p: q, lab: lab0(), lpos: 'above right', shape: 'dot' }); if (opts().autoname) it.lab.latex = TD.nextLetter(td); sel = new Set([it.id]); });
        return;
      }
      if (tool === 'text') {
        act(() => { const it = add({ t: 'text', p: q, lab: lab0('t'), size: 'normal', frame: false }); sel = new Set([it.id]); });
        setTool('sel');
        if (focusField) focusField();
        return;
      }
      const c0 = [e.clientX, e.clientY];
      if (!draft) { draft = { tool, pts: [q], cur: q, down: true, drag: false, c0 }; drawDyn(); return; }
      const P = draft.pts, last = P[P.length - 1];
      if (NEED[tool] === Infinity) {
        if (tool === 'poly' && P.length >= 3 && same(q, P[0])) { finishDraft(); return; }   // retour au premier sommet : polygone fermé
        if (same(q, last)) { if (P.length >= 2) finishDraft(); return; }                  // double-clic : fin de la ligne
        P.push(q);
      } else {
        if (same(q, last)) return;
        P.push(q);
        if (P.length >= NEED[tool]) { finishDraft(); return; }
      }
      Object.assign(draft, { cur: q, down: true, drag: false, c0 });
      drawDyn();
    }
    function removeSel() {
      if (!sel.size) return;
      act(() => {
        const dead = new Set(sel);
        // un repère emporte ses courbes
        td.items.forEach(i => { if (i.t === 'func' && dead.has(i.ax)) dead.add(i.id); });
        td.items = td.items.filter(i => !dead.has(i.id));
        sel = new Set();
      });
    }
    function grab() {
      const ids = new Set(sel);
      return JSON.parse(JSON.stringify(td.items.filter(i => ids.has(i.id))));
    }
    function paste(items, dx, dy) {
      if (!items || !items.length) return;
      act(() => {
        const map = {}, ids = [];
        items.forEach(x => { const c = JSON.parse(JSON.stringify(x)); const old = c.id; add(c); map[old] = c.id; if (c.t !== 'func') TD.shift(c, dx, dy); ids.push(c.id); });
        // une courbe copiée avec son repère suit la copie du repère
        ids.forEach(id => { const c = item(id); if (c.t === 'func' && map[c.ax]) c.ax = map[c.ax]; });
        sel = new Set(ids);
      });
    }
    const duplicate = () => paste(grab(), 0.5, -0.5);
    function reorder(front) {
      if (!sel.size) return;
      act(() => {
        const a = td.items.filter(i => sel.has(i.id)), b = td.items.filter(i => !sel.has(i.id));
        td.items = front ? b.concat(a) : a.concat(b);
      });
    }
    function newAxes() {
      tplBox.hidden = true;
      act(() => {
        const c = viewCenter(), ax = Object.assign({ t: 'axes', st: {} }, JSON.parse(JSON.stringify(TD.AXDEF)));
        ax.o = [TD.snap(c[0] - 2, 0.5), TD.snap(c[1] - 1.5, 0.5)];
        sel = new Set([add(ax).id]);
      });
      setTool('sel');
    }
    function newFunc() {
      tplBox.hidden = true;
      const one = sel.size === 1 ? item([...sel][0]) : null;
      let ax = one && one.t === 'axes' ? one : one && one.t === 'func' ? TD.axOf(td, one.ax) : null;
      if (!ax) ax = td.items.filter(i => i.t === 'axes').pop() || null;
      act(() => {
        if (!ax) ax = add(Object.assign({ t: 'axes', st: {} }, JSON.parse(JSON.stringify(TD.AXDEF)), { o: viewCenter(), x: [-4, 4], y: [-3, 3], grid: true }));
        const n = td.items.filter(i => i.t === 'func' && i.ax === ax.id).length;
        const f = add({ t: 'func', ax: ax.id, expr: n ? 'x' : 'x^2', d: null, lab: lab0(), lpos: 'above left', st: { c: FUNC_COLORS[n % FUNC_COLORS.length], w: 'epais' } });
        sel = new Set([f.id]);
      });
      setTool('sel');
      if (focusField) focusField();
    }
    function loadTemplate(t) {
      push();
      td = TD.repair(t.make());
      sel = new Set(); editKey = null; tplBox.hidden = true;
      setTool('sel');
      refresh(); renderSide(); fit();
      stage.focus({ preventScroll: true });
    }
    function showTemplates() {
      tplBox.replaceChildren(
        L.h('div', { class: 'sbe-tpl-h' }, L.h('b', { text: 'Partir d\'un modèle' }), L.h('span', { text: 'Tout reste modifiable ensuite : points, noms, couleurs, formules.' }),
          L.h('button', { class: 'x', title: 'Fermer', text: '×', onclick: () => { tplBox.hidden = true; } })),
        L.h('div', { class: 'sbe-tpl-grid' }, TD.TEMPLATES.map(t => {
          const pv = L.h('div', { class: 'sbe-tpl-pv paper' });
          try {
            const m = TD.repair(t.make());
            if (m.items.length) { const r = L.TikZ.render(TD.toTikz(m), { fontSize: 11 }); if (r.svg) pv.appendChild(r.svg); } else pv.appendChild(L.h('span', { class: 'sbe-tpl-empty', text: '+' }));
          } catch (e) { /* aperçu facultatif */ }
          return L.h('button', { class: 'sbe-tpl-card', onclick: () => {
            if (td.items.length && !confirm('Remplacer le dessin actuel par ce modèle ? (Ctrl+Z pour revenir en arrière)')) return;
            loadTemplate(t);
          } }, pv, L.h('b', { text: t.name }), L.h('small', { text: t.desc }));
        })));
      tplBox.hidden = false;
    }

    /* ---------- Souris ---------- */
    function mouse(e) {
      const r = world.getBoundingClientRect();
      const px = (e.clientX - r.left) / zoom, py = (e.clientY - r.top) / zoom;
      return { px, py, x: (px - ORG[0]) / CM, y: (ORG[1] - py) / CM };
    }
    const leaveField = () => { const a = document.activeElement; if (a && a !== document.body && root.contains(a) && a !== stage) a.blur(); stage.focus({ preventScroll: true }); };
    const capture = e => { try { over.setPointerCapture(e.pointerId); } catch (x) { /* souris déjà relâchée */ } };
    over.addEventListener('pointerdown', e => {
      if (e.button === 1) { e.preventDefault(); pan = { c: [e.clientX, e.clientY], s: [stage.scrollLeft, stage.scrollTop] }; capture(e); return; }
      if (e.button !== 0) return;
      e.preventDefault();
      leaveField();
      const d = e.target.dataset || {}, m = mouse(e);
      if (tool !== 'sel') { capture(e); createAt(e, m); return; }
      drag = null;
      if (d.h !== undefined && d.i) drag = { k: 'handle', id: d.i, h: /^\d+$/.test(d.h) ? +d.h : d.h, m0: m };
      else if (d.i) {
        let off = false;
        if (e.shiftKey) { if (sel.has(d.i)) { sel.delete(d.i); off = true; } else sel.add(d.i); selChanged(); }
        else if (!sel.has(d.i)) select([d.i]);
        if (!off) drag = { k: 'move', id: d.i, m0: m, shift: e.shiftKey };
      } else {
        if (!e.shiftKey && sel.size) select([]);
        drag = { k: 'band', m0: m, m, base: new Set(sel) };
      }
      if (drag) { drag.c0 = [e.clientX, e.clientY]; drag.moved = false; capture(e); }
    });
    over.addEventListener('pointermove', e => {
      const m = mouse(e);
      if (pan) { stage.scrollLeft = pan.s[0] - (e.clientX - pan.c[0]); stage.scrollTop = pan.s[1] - (e.clientY - pan.c[1]); return; }
      if (draft) {
        draft.cur = snapPt(m, e, null, draft.pts);
        if (draft.down && !draft.drag && Math.hypot(e.clientX - draft.c0[0], e.clientY - draft.c0[1]) > 5) draft.drag = true;
        showCoords(draft.cur); drawDyn();
        return;
      }
      if (!drag) {
        if (tool !== 'sel') { const q = snapPt(m, e); showCoords(q); drawDyn(); } else showCoords([m.x, m.y]);
        return;
      }
      if (!drag.moved && Math.hypot(e.clientX - drag.c0[0], e.clientY - drag.c0[1]) < 4) return;
      const first = !drag.moved;
      drag.moved = true; drag.m = m;
      if (drag.k === 'move') {
        if (first) {
          push();
          const ids = new Set([...sel].filter(item));
          td.items.forEach(i => { if (i.t === 'func' && ids.has(i.id) && i.ax) ids.add(i.ax); });   // une courbe se déplace avec son repère
          drag.ids = ids;
          drag.orig = {};
          ids.forEach(id => { drag.orig[id] = JSON.stringify(item(id)); });
          drag.ref = refPoint(item(drag.id)).slice();
        }
        const q = snapPt({ x: drag.ref[0] + m.x - drag.m0.x, y: drag.ref[1] + m.y - drag.m0.y }, e, drag.ids);
        const dx = q[0] - drag.ref[0], dy = q[1] - drag.ref[1];
        td.items = td.items.map(i => {
          if (!drag.orig[i.id]) return i;
          const c = JSON.parse(drag.orig[i.id]);
          TD.shift(c, dx, dy);
          return c;
        });
        showCoords(q);
        soon();
      } else if (drag.k === 'handle') {
        if (first) push();
        const it = item(drag.id);
        if (!it) return;
        const q = snapPt(m, e, new Set([drag.id]));
        setHandle(it, drag.h, q);
        showCoords(q);
        soon();
      } else if (drag.k === 'band') drawDyn();
    });
    function endDrag(e, cancel) {
      if (pan) { pan = null; return; }
      try { over.releasePointerCapture(e.pointerId); } catch (x) { /* déjà relâchée */ }
      if (draft) {
        if (cancel) { draft = null; drawDyn(); return; }
        if (draft.down) {
          draft.down = false;
          if (draft.drag && !same(draft.cur, draft.pts[draft.pts.length - 1])) {
            draft.pts.push(draft.cur);
            if (NEED[draft.tool] !== Infinity && draft.pts.length >= NEED[draft.tool]) { finishDraft(); return; }
          }
        }
        drawDyn();
        return;
      }
      const d = drag;
      if (!d) return;
      drag = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      mag = null;
      if (!d.moved || cancel) {
        if (cancel && d.moved && (d.k === 'move' || d.k === 'handle')) { doUndo(); redo.pop(); return; }
        if (d.k === 'move' && !d.shift && sel.size > 1) select([d.id]);
        const now = Date.now(), c = [e.clientX, e.clientY];
        const dbl = !cancel && lastClick && now - lastClick.t < 380 && Math.hypot(c[0] - lastClick.c[0], c[1] - lastClick.c[1]) < 6;
        lastClick = dbl ? null : { t: now, c };
        if (dbl && d.k === 'move' && focusField) focusField();
        drawDyn();
        return;
      }
      if (d.k === 'band') {
        const x0 = Math.min(d.m0.x, d.m.x), x1 = Math.max(d.m0.x, d.m.x), y0 = Math.min(d.m0.y, d.m.y), y1 = Math.max(d.m0.y, d.m.y);
        const ids = new Set(d.base);
        td.items.forEach(i => { const b = bboxOf(i); if (b && b[0] >= x0 && b[2] <= x1 && b[1] >= y0 && b[3] <= y1) ids.add(i.id); });
        select(ids);
        return;
      }
      if (d.k === 'handle') {
        const it = item(d.id);
        // un rectangle garde ses coins dans l'ordre (bas gauche, haut droit)
        if (it && (it.t === 'rect' || it.t === 'grid')) { const [a, b] = it.p; it.p = [[Math.min(a[0], b[0]), Math.min(a[1], b[1])], [Math.max(a[0], b[0]), Math.max(a[1], b[1])]]; }
      }
      refresh(); renderSide();
    }
    over.addEventListener('pointerup', e => endDrag(e, false));
    over.addEventListener('pointercancel', e => endDrag(e, true));
    over.addEventListener('pointerleave', () => { if (!drag && !draft && mag) { mag = null; drawDyn(); } showCoords(null); });
    over.addEventListener('contextmenu', e => { if (draft) { e.preventDefault(); finishDraft(); } });
    stage.addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    /* ---------- Clavier ---------- */
    const onKey = e => {
      if (!root.isConnected || L.$('#modal').hidden) return;
      if (L.SymbolPicker && L.SymbolPicker.isOpen()) return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, math-field')) return;
      const k = e.key, low = k.toLowerCase(), mod = e.ctrlKey || e.metaKey;
      const done = () => { e.preventDefault(); e.stopPropagation(); };
      if (mod && !e.shiftKey && low === 'z') { done(); doUndo(); }
      else if (mod && (low === 'y' || (e.shiftKey && low === 'z'))) { done(); doRedo(); }
      else if (mod && low === 'd') { done(); duplicate(); }
      else if (mod && low === 'a') { done(); setTool('sel'); select(td.items.map(i => i.id)); }
      else if (mod && low === 'c') { if (sel.size) { done(); clip = { items: grab(), k: 0 }; } }
      else if (mod && low === 'x') { if (sel.size) { done(); clip = { items: grab(), k: 0 }; removeSel(); } }
      else if (mod && low === 'v') { if (clip) { done(); clip.k++; paste(clip.items, 0.5 * clip.k, -0.5 * clip.k); } }
      else if (k === 'Delete' || k === 'Backspace') { done(); if (draft) { if (draft.pts.length > 1) { draft.pts.pop(); drawDyn(); } else { draft = null; drawDyn(); } } else removeSel(); }
      else if (k === 'Enter') { done(); if (draft) finishDraft(); else if (focusField) focusField(); }
      else if (k === 'F2') { if (focusField) { done(); focusField(); } }
      else if (/^Arrow/.test(k) && sel.size && !mod) {
        done();
        const s = e.shiftKey ? 1 : opts().snap || 0.1, dx = k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0, dy = k === 'ArrowUp' ? s : k === 'ArrowDown' ? -s : 0;
        typing('nudge:' + [...sel].join());
        const ids = new Set(sel);
        td.items.forEach(i => { if (i.t === 'func' && ids.has(i.id) && i.ax) ids.add(i.ax); });
        td.items.forEach(i => { if (ids.has(i.id)) TD.shift(i, dx, dy); });
        refresh();
      } else if (!mod && !e.altKey && k.length === 1) {
        const tl = TOOLS.find(x => x[3] === low);
        if (tl) { done(); setTool(tl[0]); }
      }
    };
    document.addEventListener('keydown', onKey, true);

    /* ---------- Panneau de droite ---------- */
    const sec = (title, ...kids) => L.h('div', { class: 'sbe-sec' }, title ? L.h('div', { class: 'sbe-h', text: title }) : null, ...kids);
    const seg = (list, val, on, cls) => {
      const s = L.h('div', { class: 'seg ' + (cls || '') });
      list.forEach(([v, t, title]) => s.appendChild(L.h('button', { class: v === val ? 'on' : '', text: t, title: title || null, onclick: () => { if (v !== val) on(v); } })));
      return s;
    };
    const btn = (text, on, cls, title) => L.h('button', { class: 'btn ' + (cls || ''), text, title: title || null, onclick: on });
    const chk = (label, val, on, title) => { const c = L.h('input', { type: 'checkbox' }); c.checked = !!val; c.onchange = () => on(c.checked); return L.h('label', { class: 'chk', title: title || null }, c, label); };
    const tip = html => L.h('div', { class: 'pp-help', html });
    const range = (label, key, val, min, max, step, on, fmt) => {
      const r = L.h('input', { type: 'range', min, max, step, value: val });
      const lab = L.h('span', { class: 'rng-v', text: fmt(val) });
      r.oninput = () => { typing('rng:' + key); on(+r.value); lab.textContent = fmt(+r.value); soon(); };
      return L.h('div', { class: 'sbe-row' }, L.h('span', { class: 'sbe-lab', text: label }), L.h('div', { class: 'rng' }, r, lab));
    };
    // Nombre (virgule ou point) : appliqué pendant la frappe s'il est valable
    const numIn = (key, val, on, o) => {
      o = o || {};
      const i = L.h('input', { class: 'tde-num', type: 'text', inputmode: 'decimal', spellcheck: 'false', value: fr(val), title: o.title || null });
      i.oninput = () => {
        const v = parseFloat(i.value.replace(/\s/g, '').replace(',', '.').replace(/[−–]/g, '-'));
        const ok = isFinite(v) && (o.min === undefined || v >= o.min) && (o.max === undefined || v <= o.max) && (!o.ok || o.ok(v));
        i.classList.toggle('bad', !ok);
        if (!ok) return;
        typing('num:' + key); on(v); soon();
      };
      i.onblur = () => { editKey = null; if (i.classList.contains('bad')) renderSide(); };
      i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); leaveField(); renderSide(); } };
      return i;
    };
    const row = (label, ...kids) => L.h('div', { class: 'tde-row' }, L.h('span', { class: 'tde-row-l', text: label }), ...kids);
    const unit = t => L.h('span', { class: 'tde-unit', text: t });
    const xy = (key, label, q) => row(label, unit('x'), numIn(key + 'x', q[0], v => { q[0] = v; }), unit('y'), numIn(key + 'y', q[1], v => { q[1] = v; }));
    const posGrid = (val, on) => L.h('div', { class: 'tde-pos' }, POSGRID.map(([v, t]) => L.h('button', { class: v === val ? 'on' : '', text: t, title: v === 'center' ? 'Sur le point' : v, onclick: () => { if (v !== val) on(v); } })));
    /* Champ « Formule / Texte » d'un nom (point, flèche, angle, texte…) */
    function contentField(o, key, ph) {
      const wrap = L.h('div', { class: 'sbe-field' }), mode = o.mode === 't' ? 't' : 'm';
      wrap.appendChild(seg([['m', '∑ Formule', 'Écriture mathématique : indices, vecteurs, lettres grecques…'], ['t', 'Texte', 'Texte ordinaire (Entrée : nouvelle ligne)']], mode, v => act(() => {
        const s = String(o.latex || '').trim();
        if (v === 't') o.latex = s ? '$' + s + '$' : '';
        else o.latex = /^\$[^$]*\$$/.test(s) ? s.slice(1, -1) : s ? '\\text{' + s.replace(/\s*\n\s*/g, ' ').replace(/[\\{}$]/g, '') + '}' : '';
        o.mode = v;
        setTimeout(() => focusField && focusField(), 0);
      })));
      if (mode === 'm' && window.MathfieldElement) {
        const mf = document.createElement('math-field');
        mf.className = 'sbe-mf';
        mf.setAttribute('math-virtual-keyboard-policy', 'manual');
        try { mf.smartFence = true; mf.smartSuperscript = true; mf.menuItems = []; mf.mathModeSpace = '\\:'; } catch (e) { /* options facultatives */ }
        mf.value = o.latex || '';
        const sync = () => { typing(key); o.latex = L.cleanLatex(mf.value); soon(); };
        mf.addEventListener('input', sync);
        mf.addEventListener('blur', () => { editKey = null; drawOver(); });
        const symbols = () => {
          if (!L.SymbolPicker) return;
          const r = mf.getBoundingClientRect();
          L.SymbolPicker.open({
            context: 'math', x: r.left - 480, y: r.top,
            onPick: sym => { mf.focus(); mf.insert(sym.latex, { selectionMode: 'placeholder', focus: true, format: 'latex' }); sync(); },
            onClose: picked => { if (!picked) mf.focus(); },
          });
        };
        mf.addEventListener('keydown', e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); leaveField(); }
          else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); symbols(); }
        }, { capture: true });
        const quick = L.h('div', { class: 'sbe-quick' }, QUICK.map(([lab, tex, title]) => {
          const b = L.h('button', { text: lab, title: title || lab, tabindex: '-1' });
          b.onmousedown = e => e.preventDefault();
          b.onclick = () => { mf.focus(); mf.insert(tex, { selectionMode: 'placeholder', focus: true, format: 'latex' }); sync(); };
          return b;
        }));
        const more = L.h('button', { text: 'Ω…', title: 'Tous les symboles (touche Tab)', tabindex: '-1', onclick: symbols });
        more.onmousedown = e => e.preventDefault();
        quick.appendChild(more);
        wrap.append(mf, quick, L.h('div', { class: 'sbe-fieldtip', html: '<kbd>_</kbd> indice, <kbd>^</kbd> exposant, « alpha », « theta »… <kbd>Entrée</kbd> pour finir.' }));
        wrap._focus = () => { try { mf.focus(); mf.executeCommand('selectAll'); } catch (e) { /* champ pas encore prêt */ } };
      } else {
        const ta = L.h('textarea', { class: 'sbe-ta', rows: mode === 'm' ? '2' : '3', spellcheck: 'false', placeholder: ph || '' });
        ta.value = o.latex || '';
        ta.oninput = () => { typing(key); o.latex = ta.value; soon(); };
        ta.onblur = () => { editKey = null; drawOver(); };
        ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); leaveField(); } });
        wrap.append(ta, L.h('div', { class: 'sbe-fieldtip', html: mode === 'm' ? 'Écriture LaTeX de la formule.' : '<kbd>Entrée</kbd> : nouvelle ligne. Une formule dans le texte s\'écrit entre deux <b>$</b> : <code>$x^2$</code>.' }));
        wrap._focus = () => { ta.focus(); ta.select(); };
      }
      focusField = () => wrap._focus();
      return wrap;
    }
    const rgb = c => { const v = L.TikZ.parseColor(c); return v ? 'rgb(' + v.map(Math.round).join(',') + ')' : '#eee'; };
    const colorSw = (val, on) => L.h('div', { class: 'sbe-sw' }, Object.keys(TD.COLORS).map(k =>
      L.h('button', { class: (val || 'noir') === k ? 'on' : '', title: cap(k), style: { background: rgb(TD.COLORS[k]) }, onclick: () => on(k) })));
    const fillSw = (val, on) => L.h('div', { class: 'sbe-sw' }, [['', '#fff'], ...Object.keys(TD.FILLS).map(k => [k, rgb(TD.FILLS[k])])].map(([k, c]) =>
      L.h('button', { class: (val || '') === k ? 'on' : '', title: k ? cap(k) : 'Sans remplissage', style: { background: c }, onclick: () => on(k) }, k ? null : L.h('span', { text: '∅' }))));
    const canFill = it => TD.CLOSED[it.t] || (it.t === 'line' && it.closed) || (it.t === 'arc' && it.sector) || it.t === 'angle' || (it.t === 'text' && it.frame);
    const lined = it => !['point', 'text', 'axes'].includes(it.t) || (it.t === 'text' && it.frame);
    const arrowed = it => it.t === 'seg' || (it.t === 'line' && !it.closed) || (it.t === 'arc' && !it.sector);
    // Apparence, pour un ou plusieurs éléments
    function styleSecs(its) {
      const st = its[0].st || {};
      const setSt = (k, v) => act(() => its.forEach(it => { it.st = it.st || {}; if (!v) delete it.st[k]; else it.st[k] = v; }));
      const out = [sec('Couleur', colorSw(st.c, v => setSt('c', v === 'noir' ? '' : v)))];
      if (its.some(canFill)) out.push(sec('Remplissage', fillSw(st.f, v => setSt('f', v))));
      if (its.some(lined)) {
        out.push(sec('Épaisseur', seg([['fin', 'Fin'], ['', 'Normale'], ['epais', 'Épaisse'], ['tres', 'Très épaisse']], st.w || '', v => setSt('w', v))));
        out.push(sec('Trait', seg([['', 'Plein'], ['tirets', 'Tirets'], ['points', 'Pointillés']], st.d || '', v => setSt('d', v))));
      }
      if (its.some(arrowed)) out.push(sec('Pointes de flèche', seg([['', '—', 'Sans pointe'], ['->', '→', 'Au bout'], ['<-', '←', 'Au début'], ['<->', '↔', 'Aux deux bouts']], st.a || '', v => setSt('a', v), 'tde-arrows')));
      return out;
    }
    const common = () => sec(null,
      L.h('div', { class: 'btn-row' }, btn('⤒ Devant', () => reorder(true), '', 'Passer devant les autres éléments'), btn('⤓ Derrière', () => reorder(false), '', 'Passer derrière les autres éléments')),
      L.h('div', { class: 'btn-row' }, btn('Dupliquer', duplicate, '', 'Ctrl+D'), btn('Supprimer', removeSel, 'danger', 'Touche Suppr')));

    function exprBox(it) {
      const inp = L.h('input', { class: 'tde-expr', type: 'text', spellcheck: 'false', value: it.expr, placeholder: 'ex. x^2 - 1' });
      const msg = L.h('div', { class: 'tde-expr-msg' });
      const check = () => {
        const c = TD.compile(it.expr);
        msg.className = 'tde-expr-msg ' + (c.ok ? 'ok' : 'bad');
        msg.textContent = c.ok ? (funcPts(it).length ? '✓ Courbe tracée' : 'ℹ La courbe ne passe pas dans le repère : élargissez-le') : '⚠ ' + c.error;
      };
      inp.oninput = () => { typing('expr:' + it.id); it.expr = inp.value; check(); soon(); };
      inp.onblur = () => { editKey = null; };
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); leaveField(); } };
      // touche « sin » : écrit sin(…) autour de la sélection, curseur à l'intérieur
      const put = s => {
        const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a, inner = inp.value.slice(a, b), open = s.endsWith('(');
        inp.value = inp.value.slice(0, a) + s + inner + (open ? ')' : '') + inp.value.slice(b);
        const at = a + s.length + inner.length + (open && inner ? 1 : 0);
        inp.focus(); inp.setSelectionRange(at, at);
        inp.oninput();
      };
      const keys = L.h('div', { class: 'tde-keys' }, EXPR_KEYS.map(([t, s]) => { const b = L.h('button', { text: t, tabindex: '-1', onclick: () => put(s) }); b.onmousedown = e => e.preventDefault(); return b; }));
      const ex = L.h('div', { class: 'tde-ex' }, L.h('span', { text: 'Exemples :' }), EXPR_EX.map(s => L.h('button', { text: s, onclick: () => { inp.value = s; inp.focus(); inp.oninput(); } })));
      check();
      focusField = () => { inp.focus(); inp.select(); };
      return L.h('div', { class: 'tde-exprbox' }, L.h('div', { class: 'tde-fx' }, L.h('span', { html: '<i>f</i>(<i>x</i>) =' }), inp), msg, keys, ex);
    }

    function renderSide() {
      focusField = null;
      side.replaceChildren();
      const its = [...sel].map(item).filter(Boolean);
      if (!its.length) {
        const o = opts(), set = (k, v) => act(() => { td.opts[k] = v; });
        side.append(
          L.h('div', { class: 'sbe-title' }, L.h('b', { text: 'Réglages du dessin' })),
          sec('Aimanter à la grille', seg([[0, 'Libre'], [0.1, '1 mm'], [0.25, '2,5 mm'], [0.5, '5 mm'], [1, '1 cm']], o.snap, v => set('snap', v), 'tde-snap'),
            chk('Attirer vers les points déjà placés', o.magnet !== false, v => set('magnet', v)),
            tip('Maintenez <kbd>Alt</kbd> pour placer librement.')),
          sec('Points', chk('Nommer les nouveaux points A, B, C…', o.autoname !== false, v => set('autoname', v))),
          sec('Pointe des flèches', seg([['stealth', '➤ Effilée'], ['latex', '▶ Pleine'], ['simple', '→ Simple']], o.tip, v => set('tip', v))),
          sec('Taille des textes', seg([['normal', 'Normale'], ['small', 'Petite'], ['footnotesize', 'Très petite']], o.font, v => set('font', v))),
          sec('Comment faire',
            tip('<ul><li><b>Dessiner</b> : choisissez un outil à gauche, puis cliquez sur la feuille. L\'outil reste actif : <kbd>Échap</kbd> pour revenir au choix.</li>'
              + '<li><b>Courbe de fonction</b> : bouton <b>Courbe</b>, puis écrivez la formule comme en maths (<i>2x² − 3</i>, <i>sin(x)</i>…).</li>'
              + '<li><b>Modifier</b> : cliquez un élément, réglez-le à droite ; tirez ses petits carrés pour le déformer.</li>'
              + '<li><b>Nommer</b> : double-clic sur un élément pour écrire son nom.</li>'
              + '<li><kbd>Suppr</kbd> supprime, <kbd>Ctrl</kbd>+<kbd>Z</kbd> annule, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplique, <kbd>Ctrl</kbd> + molette : zoom.</li></ul>')));
        return;
      }
      if (its.length > 1) {
        side.append(L.h('div', { class: 'sbe-title' }, L.h('b', { text: its.length + ' éléments sélectionnés' })), ...styleSecs(its), common());
        return;
      }
      const it = its[0], id = it.id, st = it.st || {};
      side.append(L.h('div', { class: 'sbe-title' }, L.h('span', { class: 'sbe-ic' }, ico(icoOf(it), 16)), L.h('b', { text: nameOf(it) })));
      const upd = fn => () => act(fn);
      switch (it.t) {
        case 'point':
          side.append(
            sec('Nom du point', contentField(it.lab, 'lab:' + id, 'ex. A')),
            sec('Place du nom', posGrid(it.lpos, v => act(() => { it.lpos = v; }))),
            sec('Marque', seg([['dot', '● Point'], ['cross', '× Croix'], ['none', 'Aucune']], it.shape, v => act(() => { it.shape = v; }))),
            sec('Position', xy('p:' + id, 'cm', it.p)));
          break;
        case 'seg':
          side.append(
            sec(st.a ? 'Nom de la flèche' : 'Nom du segment', contentField(it.lab, 'lab:' + id, 'ex. \\vec{F}')),
            sec('Place du nom', seg([['start', 'Au début'], ['mid', 'Au milieu'], ['end', 'Au bout']], it.lat || 'mid', v => act(() => { it.lat = v; })), posGrid(it.lpos, v => act(() => { it.lpos = v; }))),
            sec('Extrémités (cm)', xy('a:' + id, 'Début', it.p[0]), xy('b:' + id, 'Fin', it.p[1]), tip('Longueur : ' + fr(dist(it.p[0], it.p[1])) + ' cm')));
          break;
        case 'line':
          side.append(sec('Forme',
            chk('Fermée (polygone)', it.closed, v => act(() => { it.closed = v; if (v) delete it.st.a; })),
            !it.closed ? chk('Lissée (courbe passant par les sommets)', st.sm, v => act(() => { if (v) it.st.sm = true; else delete it.st.sm; })) : null,
            !st.sm || it.closed ? chk('Coins arrondis', st.ro, v => act(() => { if (v) it.st.ro = true; else delete it.st.ro; })) : null,
            tip(it.p.length + ' sommets : tirez les petits carrés pour les déplacer.'),
            it.p.length > 2 ? btn('Retirer le dernier sommet', upd(() => { it.p.pop(); if (it.p.length < 3) it.closed = false; }), 'wide') : null));
          break;
        case 'rect': {
          const [a, b] = it.p;
          side.append(sec('Dimensions (cm)',
            row('Largeur', numIn('w:' + id, b[0] - a[0], v => { b[0] = a[0] + v; }, { min: 0.05 })),
            row('Hauteur', numIn('h:' + id, b[1] - a[1], v => { b[1] = a[1] + v; }, { min: 0.05 })),
            xy('a:' + id, 'Coin', a),
            chk('Coins arrondis', st.ro, v => act(() => { if (v) it.st.ro = true; else delete it.st.ro; }))));
          break;
        }
        case 'circle':
          side.append(sec('Cercle (cm)', xy('c:' + id, 'Centre', it.c), row('Rayon', numIn('r:' + id, it.r, v => { it.r = v; }, { min: 0.02 }))));
          break;
        case 'ellipse':
          side.append(sec('Ellipse (cm)', xy('c:' + id, 'Centre', it.c),
            row('Rayons', unit('↔'), numIn('rx:' + id, it.r[0], v => { it.r[0] = v; }, { min: 0.02 }), unit('↕'), numIn('ry:' + id, it.r[1], v => { it.r[1] = v; }, { min: 0.02 }))));
          break;
        case 'arc':
          side.append(sec('Arc', xy('c:' + id, 'Centre', it.c), row('Rayon', numIn('r:' + id, it.r, v => { it.r = v; }, { min: 0.02 }), unit('cm')),
            row('Angles', numIn('a0:' + id, it.a[0], v => { it.a[0] = v; }), unit('° à'), numIn('a1:' + id, it.a[1], v => { it.a[1] = v; }), unit('°')),
            chk('Part de disque (relier au centre)', it.sector, v => act(() => { it.sector = v; if (v) delete it.st.a; })),
            tip('Angles comptés depuis l\'horizontale, dans le sens inverse des aiguilles d\'une montre.')));
          break;
        case 'angle': {
          const g = TD.angleGeom(it);
          side.append(
            sec('Marque', seg([['auto', 'Auto'], ['arc', 'Arc'], ['droit', 'Angle droit']], it.mk, v => act(() => { it.mk = v; })),
              !g.right ? chk('Double arc', it.dbl, v => act(() => { it.dbl = v; })) : null,
              range('Taille', 'r:' + id, it.r, 0.2, 2, 0.05, v => { it.r = v; }, v => fr(v) + ' cm'),
              tip('Mesure : ' + fr(g.d) + '°' + (it.mk === 'auto' ? ' · « Auto » dessine un petit carré pour un angle droit.' : ''))),
            sec('Nom de l\'angle', contentField(it.lab, 'lab:' + id, 'ex. \\alpha')));
          break;
        }
        case 'text':
          side.append(
            sec('Texte', contentField(it.lab, 'lab:' + id, 'Votre texte')),
            sec('Taille', seg([['small', 'Petite'], ['normal', 'Normale'], ['large', 'Grande'], ['Large', 'Très grande']], it.size, v => act(() => { it.size = v; }))),
            sec(null, chk('Encadré', it.frame, v => act(() => { it.frame = v; }))));
          break;
        case 'grid':
          side.append(sec('Écart des lignes', seg([[0.25, '2,5 mm'], [0.5, '5 mm'], [1, '1 cm'], [2, '2 cm']], it.step, v => act(() => { it.step = v; }))));
          break;
        case 'axes': {
          const funcs = td.items.filter(i => i.t === 'func' && i.ax === id).length;
          side.append(
            sec(null, btn('＋  Tracer une courbe dans ce repère', newFunc, 'primary wide')),
            sec('Axe des abscisses',
              row('De', numIn('x0:' + id, it.x[0], v => { it.x[0] = v; }, { ok: v => v < it.x[1] }), unit('à'), numIn('x1:' + id, it.x[1], v => { it.x[1] = v; }, { ok: v => v > it.x[0] })),
              row('Pas', numIn('sx:' + id, it.s[0], v => { it.s[0] = v; }, { min: 0.01 }), unit(it.xpi ? '× π' : ''), unit('Unité'), numIn('ux:' + id, it.u[0], v => { it.u[0] = v; }, { min: 0.05, max: 20 }), unit('cm')),
              chk('Graduer en multiples de π (π/2, π, 3π/2…)', it.xpi, v => act(() => { it.xpi = v; it.s[0] = v ? 0.5 : 1; }))),
            sec('Axe des ordonnées',
              row('De', numIn('y0:' + id, it.y[0], v => { it.y[0] = v; }, { ok: v => v < it.y[1] }), unit('à'), numIn('y1:' + id, it.y[1], v => { it.y[1] = v; }, { ok: v => v > it.y[0] })),
              row('Pas', numIn('sy:' + id, it.s[1], v => { it.s[1] = v; }, { min: 0.01 }), unit(''), unit('Unité'), numIn('uy:' + id, it.u[1], v => { it.u[1] = v; }, { min: 0.05, max: 20 }), unit('cm'))),
            sec('Affichage',
              chk('Nombres sur les axes', it.num, v => act(() => { it.num = v; })),
              chk('Quadrillage', it.grid, v => act(() => { it.grid = v; })),
              chk('Origine « O »', it.O, v => act(() => { it.O = v; })),
              row('Noms', L.h('input', { class: 'tde-name', value: it.names[0], placeholder: 'x', oninput: e => { typing('nx:' + id); it.names[0] = e.target.value; soon(); } }),
                L.h('input', { class: 'tde-name', value: it.names[1], placeholder: 'y', oninput: e => { typing('ny:' + id); it.names[1] = e.target.value; soon(); } }))),
            tip(funcs ? funcs + ' courbe' + (funcs > 1 ? 's' : '') + ' dans ce repère : elles bougent avec lui.' : 'Tirez les bouts des axes pour les allonger.'));
          break;
        }
        case 'func': {
          const axes = td.items.filter(i => i.t === 'axes');
          side.append(sec('Formule', exprBox(it), tip('Écrivez comme en maths : <i>2x² − 3</i>, <i>0,5x</i>, <i>√x</i>, <i>e^(−x)</i>, <i>1/x</i>. Angles en radians.')));
          side.append(sec('Intervalle',
            chk('Sur toute la largeur du repère', !it.d, v => act(() => { const ax = TD.axOf(td, it.ax); it.d = v ? null : [ax ? ax.x[0] : -1, ax ? ax.x[1] : 1]; })),
            it.d ? row('De', numIn('d0:' + id, it.d[0], v => { it.d[0] = v; }, { ok: v => v < it.d[1] }), unit('à'), numIn('d1:' + id, it.d[1], v => { it.d[1] = v; }, { ok: v => v > it.d[0] })) : null));
          side.append(sec('Nom de la courbe', contentField(it.lab, 'lab:' + id, 'ex. \\mathcal{C}_f'), posGrid(it.lpos, v => act(() => { it.lpos = v; }))));
          if (axes.length > 1) side.append(sec('Repère', seg(axes.map((a, k) => [a.id, 'Repère ' + (k + 1)]), it.ax, v => act(() => { it.ax = v; }))));
          break;
        }
        default: break;
      }
      side.append(...styleSecs([it]), common());
    }

    /* ---------- Barre et palette ---------- */
    pal.append(L.h('div', { class: 'sbe-pal-h', text: 'Outils' }),
      L.h('div', { class: 'tde-tools' }, TOOLS.map(([k, label, title]) => {
        const b = L.h('button', { class: 'tde-tool' + (k === tool ? ' on' : ''), title, 'data-tool': k, onclick: () => { tplBox.hidden = true; setTool(k); stage.focus({ preventScroll: true }); } }, ico(k, 20), L.h('span', { text: label }));
        return b;
      })),
      L.h('div', { class: 'sbe-pal-h', text: 'Fonctions' }),
      L.h('div', { class: 'tde-tools' },
        L.h('button', { class: 'tde-tool', title: 'Repère gradué (axes, graduations, quadrillage)', onclick: newAxes }, ico('axes', 20), L.h('span', { text: 'Repère' })),
        L.h('button', { class: 'tde-tool', title: 'Courbe d\'une fonction : écrivez sa formule', onclick: newFunc }, ico('func', 20), L.h('span', { text: 'Courbe' }))));
    const zoomLab = L.h('span', { class: 'sbe-zoom-v', text: '100 %' });
    const tb = (text, title, on, need) => L.h('button', { class: 'sbe-tb', title, 'data-need': need || null, onclick: on, text });
    bar.append(
      L.h('button', { class: 'sbe-tb accent', title: 'Repère et courbe, triangle, cercle trigonométrique, forces…', text: '▦ Modèles', onclick: () => { if (tplBox.hidden) showTemplates(); else tplBox.hidden = true; } }),
      L.h('span', { class: 'sbe-sep' }),
      tb('↶', 'Annuler (Ctrl+Z)', doUndo, 'undo'), tb('↷', 'Rétablir (Ctrl+Y)', doRedo, 'redo'),
      L.h('span', { class: 'sbe-sep' }),
      tb('Dupliquer', 'Dupliquer la sélection (Ctrl+D)', duplicate, 'sel'), tb('Supprimer', 'Supprimer la sélection (Suppr)', removeSel, 'sel'),
      L.h('span', { class: 'sbe-flex' }),
      tb('−', 'Réduire (Ctrl + molette)', () => setZoom(zoom / 1.2)), zoomLab, tb('+', 'Agrandir (Ctrl + molette)', () => setZoom(zoom * 1.2)),
      tb('⤢ Ajuster', 'Voir tout le dessin', fit));

    /* ---------- Ouverture ---------- */
    const valider = c => {
      leaveField();
      if (draft) finishDraft(true);
      td.items = td.items.filter(i => i.t !== 'text' || TD.content(i.lab));
      const clean = TD.repair(JSON.parse(JSON.stringify(td)));
      saved = true;
      const f = block && L.find(App.doc, block.id);
      if (f) {
        f.block.td = clean;
        TD.sync(f.block);
        c(); App.commit(); App.render();
      } else {
        const nb = TD.sync(L.newBlock('tikz', { td: clean, code: '', scale: 1, caption: '', capMode: 'none' }));
        c();
        if (onDone) onDone(nb);
      }
      if ((dirty || !block) && L.Modules && L.Modules.used) L.Modules.used('tikzdraw');
    };
    dlg = L.modal({
      title: block ? 'Modifier le dessin' : 'Nouveau dessin', body: root, wide: true, cls: 'sbe-modal tde-modal',
      foot: [{ text: 'Annuler', onClick: c => c() }, { text: block ? 'Valider' : 'Insérer le dessin', cls: 'primary', onClick: valider }],
      onClose: () => { document.removeEventListener('keydown', onKey, true); if (raf) cancelAnimationFrame(raf); },
      // Échap : sort du champ, termine le tracé en cours, revient à l'outil « Choisir », désélectionne ; ensuite seulement ferme
      onEscape: () => {
        const a = document.activeElement;
        if (!tplBox.hidden && td.items.length) { tplBox.hidden = true; return true; }
        if (a && a !== stage && root.contains(a) && a.closest('input, textarea, select, math-field')) { leaveField(); return true; }
        if (draft) { finishDraft(); return true; }
        if (drag) { const d = drag; drag = null; if (d.moved && (d.k === 'move' || d.k === 'handle')) { doUndo(); redo.pop(); } else drawDyn(); return true; }
        if (tool !== 'sel') { setTool('sel'); return true; }
        if (sel.size) { select([]); return true; }
        return false;
      },
      guard: () => saved || !dirty || confirm('Fermer sans garder les modifications du dessin ?'),
    });
    refresh(); renderSide();
    requestAnimationFrame(() => { fit(); if (!block && !td.items.length) showTemplates(); stage.focus({ preventScroll: true }); });
    return dlg;
  };
})();
