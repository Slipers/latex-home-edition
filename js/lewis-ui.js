/* Schémas de Lewis : fenêtre de construction à la souris (module complémentaire « lewis »).
   On pose des atomes, on tire des liaisons ; doublets non liants, électrons célibataires,
   lacunes et charges formelles se calculent et se placent tout seuls (réglables à la main).
   Le dessin affiché est celui du document (même moteur TikZ), une couche transparente reçoit
   la souris. Modèle et code TikZ : js/lewis.js — styles : css/lewis.css (+ schemabloc, tikzdraw) */
(function () {
  const LW = L.LW, CM = 37.7952756, NS = 'http://www.w3.org/2000/svg';
  const WORLD = [4400, 3200], ORG = [2200, 1600];
  const S = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    return e;
  };
  const ICONS = {
    sel: '<path d="M6 3l12 9.5-5.6.9 3.3 6.4-2.6 1.3-3.3-6.5L6 18.5z"/>',
    atom: '<circle cx="12" cy="12" r="8.5"/><path d="M9.2 15.5l2.8-7 2.8 7M10.2 13h3.6"/>',
    b1: '<path d="M4 18L20 6"/>',
    b2: '<path d="M3.2 16.2L18.4 4.8M5.6 19.2L20.8 7.8"/>',
    b3: '<path d="M2.6 15L17.8 3.6M4 18L20 6M5.4 21L21.4 9"/>',
    erase: '<path d="M8.5 20.5h11M4.6 14.8l8.6-8.6a2 2 0 0 1 2.8 0l3 3a2 2 0 0 1 0 2.8l-7.5 7.5H9.2z"/><path d="M8.6 10.8l5.8 5.8"/>',
    plus: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
    minus: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>',
    lp: '<path d="M7 6h10"/><path d="M9.2 18.5l2.8-7 2.8 7M10.2 16h3.6"/>',
    rad: '<circle cx="12" cy="6.5" r="1.8" fill="currentColor"/><path d="M9.2 19l2.8-7 2.8 7M10.2 16.5h3.6"/>',
    vac: '<rect x="7" y="4.5" width="10" height="4" rx=".5"/><path d="M9.2 19.5l2.8-7 2.8 7M10.2 17h3.6"/>',
    arrow: '<path d="M3 12h17M15 7l5 5-5 5"/>',
    meso: '<path d="M4 12h16M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5"/>',
    curve: '<path d="M4 17C6 7 15 5 19 12"/><path d="M19.6 7.4L19 12l-4.4-1.4"/>',
    text: '<path d="M6 6h12M12 6v13M9.5 19h5"/>',
  };
  const ico = (k, size) => {
    const s = S('svg', { viewBox: '0 0 24 24', width: size || 20, height: size || 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    s.innerHTML = ICONS[k] || '';
    return s;
  };
  const fr = v => { const r = Math.round(v * 100) / 100; return String(Object.is(r, -0) ? 0 : r).replace('.', ','); };
  const rnd = (v, g) => { g = g || 0.01; const r = Math.round(v / g) * g; return Math.abs(r) < 1e-9 ? 0 : +r.toFixed(4); };
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const angOf = (c, q) => ((Math.atan2(q[1] - c[1], q[0] - c[0]) * 180 / Math.PI) + 360) % 360;
  const mod360 = a => ((a % 360) + 360) % 360;
  const plur = (n, one, many) => n + ' ' + (n > 1 ? many : one);

  const TOOLS = [
    ['sel', 'Choisir', 'Choisir, déplacer, régler (V ou Échap)', 'v'],
    ['atom', 'Atome', 'Poser un atome de l\'élément choisi, ou changer l\'élément d\'un atome (A)', 'a'],
    ['erase', 'Gomme', 'Effacer un atome (et ses liaisons), une liaison, une flèche, un texte (E)', 'e'],
    ['text', 'Texte', 'Texte ou formule (T)', 't'],
  ];
  const BONDS = [['b1', 'Simple', 'Liaison simple : tirez d\'un atome vers un autre, ou dans le vide (1)', '1'], ['b2', 'Double', 'Liaison double (2)', '2'], ['b3', 'Triple', 'Liaison triple (3)', '3']];
  const ELEC = [
    ['plus', 'Charge +', 'Cliquez un atome : charge formelle + (ou une charge − en moins) (+)', '+'],
    ['minus', 'Charge −', 'Cliquez un atome : charge formelle − (ou une charge + en moins) (−)', '-'],
    ['lp', 'Doublet', 'Cliquez un atome : un doublet non liant de plus ; Maj+clic : un de moins (D)', 'd'],
    ['rad', 'Électron', 'Électron célibataire (radical) ; Maj+clic : un de moins (R)', 'r'],
    ['vac', 'Lacune', 'Lacune électronique ; Maj+clic : une de moins (O)', 'o'],
  ];
  const ARROWS = [
    ['arrow', 'Réaction', 'Flèche de réaction : origine puis extrémité (F)', 'f'],
    ['meso', 'Mésomérie', 'Flèche ↔ entre deux formes mésomères (M)', 'm'],
    ['curve', 'Courbe', 'Flèche courbe (mouvement d\'un doublet) : départ puis arrivée (C)', 'c'],
  ];
  const ALLTOOLS = TOOLS.concat(BONDS, ELEC, ARROWS);
  const ELEMS = ['H', 'C', 'N', 'O', 'F', 'Cl', 'Br', 'I', 'S', 'P', 'B', 'Si', 'Al', 'Be', 'Li', 'Na', 'K', 'Mg', 'Xe', 'He'];
  const HINTS = {
    atom: 'Cliquez dans le vide pour poser un atome, ou sur un atome pour changer son élément.',
    b1: 'Tirez d\'un atome vers un autre, ou dans le vide (nouvel atome). Clic sur un atome : liaison vers un nouvel atome. Clic sur une liaison : la rendre simple.',
    b2: 'Tirez d\'un atome vers un autre, ou dans le vide. Clic sur une liaison : la rendre double.',
    b3: 'Tirez d\'un atome vers un autre, ou dans le vide. Clic sur une liaison : la rendre triple.',
    erase: 'Cliquez ce qu\'il faut effacer.',
    plus: 'Cliquez un atome pour ajouter une charge +.',
    minus: 'Cliquez un atome pour ajouter une charge −.',
    lp: 'Cliquez un atome : un doublet non liant de plus (Maj+clic : un de moins).',
    rad: 'Cliquez un atome : un électron célibataire de plus (Maj+clic : un de moins).',
    vac: 'Cliquez un atome : une lacune de plus (Maj+clic : une de moins).',
    arrow: 'Cliquez l\'origine de la flèche puis son extrémité (ou glissez).',
    meso: 'Cliquez le début de la flèche ↔ puis sa fin (ou glissez).',
    curve: 'Cliquez le départ (un doublet, une liaison) puis l\'arrivée : la flèche s\'accroche aux doublets et aux liaisons.',
    text: 'Cliquez où placer le texte.',
  };
  const NAMES = { atom: 'Atome', bond: 'Liaison', arrow: 'Flèche', curve: 'Flèche courbe', text: 'Texte' };

  /* block : bloc « tikz » à modifier, ou null pour un nouveau schéma (onDone reçoit alors le bloc créé) */
  L.dlgLewis = function (block, onDone) {
    const meta = App.doc.meta, fontPt = L.TikZ.fontPt(meta.fontSize);
    let lw = LW.repair(JSON.parse(JSON.stringify((block && block.lw) || { items: [], opts: {} })));
    let sel = new Set(), tool = 'sel', el = 'C', zoom = 1, drag = null, draft = null, mag = null, vb = null, clip = null;
    let editKey = null, dirty = false, saved = false, raf = 0, dlg = null, lastClick = null, gDyn = null, pan = null, focusText = null;
    const undo = [], redo = [];

    const X = x => ORG[0] + x * CM, Y = y => ORG[1] - y * CM;
    const item = id => lw.items.find(i => i.id === id);
    const opts = () => LW.opts(lw);

    /* ---------- Structure de la fenêtre ---------- */
    const stage = L.h('div', { class: 'sbe-stage tde-stage', tabindex: '-1' });
    const sizer = L.h('div', { class: 'sbe-sizer' });
    const world = L.h('div', { class: 'tde-world', style: { width: WORLD[0] + 'px', height: WORLD[1] + 'px' } });
    world.style.backgroundSize = CM + 'px ' + CM + 'px, ' + CM + 'px ' + CM + 'px, ' + (CM / 4) + 'px ' + (CM / 4) + 'px, ' + (CM / 4) + 'px ' + (CM / 4) + 'px';
    world.style.backgroundPosition = (ORG[0] % CM) + 'px ' + (ORG[1] % CM) + 'px';
    const drawL = L.h('div', { class: 'sbe-draw paper ' + L.pageClasses(meta) });
    const over = S('svg', { class: 'sbe-over tde-over lwe-over', width: WORLD[0], height: WORLD[1] });
    world.append(drawL, over);
    sizer.appendChild(world);
    const tplBox = L.h('div', { class: 'sbe-tpl', hidden: true });
    const stageWrap = L.h('div', { class: 'sbe-stagewrap' }, stage, tplBox);
    stage.appendChild(sizer);
    const side = L.h('div', { class: 'sbe-side' });
    const pal = L.h('div', { class: 'tde-pal lwe-pal' });
    const bar = L.h('div', { class: 'sbe-bar' });
    const hint = L.h('span', { class: 'sbe-hint' }), info = L.h('span', { class: 'sbe-info' });
    const root = L.h('div', { class: 'sbe tde lwe' }, bar, L.h('div', { class: 'sbe-main' }, pal, stageWrap, side), L.h('div', { class: 'sbe-status' }, hint, info));

    /* ---------- Historique ---------- */
    const push = () => { undo.push(JSON.stringify(lw)); if (undo.length > 150) undo.shift(); redo.length = 0; dirty = true; };
    const restore = json => {
      lw = JSON.parse(json);
      sel = new Set([...sel].filter(item));
      editKey = null; dirty = true; draft = null;
      refresh(); renderSide();
    };
    const doUndo = () => { if (undo.length) { redo.push(JSON.stringify(lw)); restore(undo.pop()); } };
    const doRedo = () => { if (redo.length) { undo.push(JSON.stringify(lw)); restore(redo.pop()); } };
    const act = fn => { push(); editKey = null; fn(); refresh(); renderSide(); };
    const typing = key => { if (editKey !== key) { push(); editKey = key; } dirty = true; };
    const soon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; refresh(); }); };

    /* ---------- Géométrie de la couche souris (px) ---------- */
    const ptsD = ps => ps.map((q, k) => (k ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join('');
    const curveD = it => { const c = LW.curveCtrl(it), [A, B] = it.p; return 'M' + X(A[0]) + ' ' + Y(A[1]) + 'C' + X(c.c1[0]) + ' ' + Y(c.c1[1]) + ' ' + X(c.c2[0]) + ' ' + Y(c.c2[1]) + ' ' + X(B[0]) + ' ' + Y(B[1]); };
    const textBox = it => {
      const t = L.TD ? L.TD.content(it.lab) : '', sz = t ? L.TikZ.textSize(t, fontPt, 1) : { w: 1.3, h: 0.55 };
      const w = sz.w + 0.12, h = sz.h + 0.12;
      return [it.p[0] - w / 2, it.p[1] - h / 2, w, h];
    };
    const rectEl = (b, cls) => S('rect', { x: X(b[0]), y: Y(b[1] + b[3]), width: b[2] * CM, height: b[3] * CM, class: cls });
    const ends = b => { const A = item(b.a), B = item(b.b); return A && B ? [A.p, B.p] : null; };
    function hitShapes(it) {
      switch (it.t) {
        case 'atom': return [S('circle', { cx: X(it.p[0]), cy: Y(it.p[1]), r: Math.max(11, LW.textW(it.el) / 2 * CM + 4), class: 'tde-hit fill lwe-hit' })];
        case 'bond': { const e = ends(it); return e ? [S('path', { d: ptsD(e), class: 'tde-hit lwe-hit' })] : []; }
        case 'arrow': return [S('path', { d: ptsD(it.p), class: 'tde-hit lwe-hit' })];
        case 'curve': return [S('path', { d: curveD(it), class: 'tde-hit lwe-hit' })];
        case 'text': return [rectEl(textBox(it), 'tde-hit fill lwe-hit')];
        default: return [];
      }
    }
    function selShapes(it) {
      if (it.t === 'atom') return [S('circle', { cx: X(it.p[0]), cy: Y(it.p[1]), r: Math.max(12, LW.textW(it.el) / 2 * CM + 6), class: 'tde-selbox' })];
      if (it.t === 'text') return [rectEl(textBox(it), 'tde-selbox')];
      return hitShapes(it).map(e => { e.setAttribute('class', 'tde-selpath'); return e; });
    }
    function handlesOf(it) {
      if (it.t === 'arrow') return [{ k: 0, p: it.p[0] }, { k: 1, p: it.p[1] }];
      if (it.t === 'curve') return [{ k: 0, p: it.p[0] }, { k: 1, p: it.p[1] }, { k: 'm', p: LW.curveTop(it) }];
      return [];
    }
    function bboxOf(it) {
      if (it.t === 'atom' || it.t === 'text') return [it.p[0], it.p[1], it.p[0], it.p[1]];
      if (it.t === 'bond') { const e = ends(it); return e ? [Math.min(e[0][0], e[1][0]), Math.min(e[0][1], e[1][1]), Math.max(e[0][0], e[1][0]), Math.max(e[0][1], e[1][1])] : null; }
      const ps = it.t === 'curve' ? it.p.concat([LW.curveTop(it)]) : it.p;
      return [Math.min(...ps.map(q => q[0])), Math.min(...ps.map(q => q[1])), Math.max(...ps.map(q => q[0])), Math.max(...ps.map(q => q[1]))];
    }

    /* ---------- Dessin ---------- */
    let err = null;
    function refresh() {
      const r = L.TikZ.render(LW.toTikz(lw), { fontSize: meta.fontSize });
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
      const gB = S('g', {}), gH = S('g', {}), gS = S('g', {});
      over.append(gB, gH, gS);
      // les liaisons d'abord : les atomes passent dessus (un clic près d'un atome le choisit)
      lw.items.forEach(it => {
        const g = it.t === 'bond' ? gB : gH;
        if (it.t === 'text' && !(L.TD && L.TD.content(it.lab))) {
          const b = textBox(it);
          gH.appendChild(rectEl(b, 'sbe-ghost'));
          const t = S('text', { x: X(it.p[0]), y: Y(it.p[1]) + 4, class: 'sbe-ghost-t', 'text-anchor': 'middle' });
          t.textContent = 'Texte';
          gH.appendChild(t);
        }
        hitShapes(it).forEach(e => { e.dataset.i = it.id; g.appendChild(e); });
        if (sel.has(it.id)) selShapes(it).forEach(e => gS.appendChild(e));
      });
      if (tool === 'sel') {
        // poignées : doublets et charge des atomes choisis (on les fait tourner autour de l'atome)
        lw.items.forEach(it => {
          if (it.t !== 'atom' || !sel.has(it.id) || sel.size > 6) return;
          const lay = LW.layout(lw, it);
          lay.groups.forEach((g, k) => { const q = LW.groupPos(it, g); gS.appendChild(S('circle', { cx: X(q[0]), cy: Y(q[1]), r: 5, class: 'lwe-grp', 'data-i': it.id, 'data-g': k })); });
          if (it.q && lay.qa !== null) { const q = LW.chargePos(it, lay.qa); gS.appendChild(S('circle', { cx: X(q[0]), cy: Y(q[1]), r: 7, class: 'lwe-grp chg', 'data-i': it.id, 'data-q': 1 })); }
        });
        if (sel.size === 1) {
          const it = item([...sel][0]);
          if (it) handlesOf(it).forEach(h => gS.appendChild(S('rect', { x: X(h.p[0]) - 5, y: Y(h.p[1]) - 5, width: 10, height: 10, rx: 2, class: 'tde-handle', 'data-i': it.id, 'data-h': h.k })));
        }
      }
      gDyn = S('g', {});
      over.appendChild(gDyn);
      over.classList.toggle('creating', tool !== 'sel');
      over.dataset.tool = tool;
      drawDyn();
    }
    function drawDyn() {
      if (!gDyn) return;
      gDyn.replaceChildren();
      const add = (tag, a) => gDyn.appendChild(S(tag, a));
      if (draft) {
        if (draft.k === 'bond') {
          const A = item(draft.from);
          if (A && draft.cur) {
            add('path', { d: ptsD([A.p, draft.cur]), class: 'tde-draft' });
            if (!draft.to) add('circle', { cx: X(draft.cur[0]), cy: Y(draft.cur[1]), r: 9, class: 'lwe-ghost' });
          }
        } else {
          const P0 = draft.pts[0], c = draft.cur;
          if (draft.k === 'curve') add('path', { d: curveD({ p: [P0, c], bend: 0.4 }), class: 'tde-draft vec' });
          else add('path', { d: ptsD([P0, c]), class: 'tde-draft vec' });
          add('circle', { cx: X(P0[0]), cy: Y(P0[1]), r: 3.5, class: 'tde-dot' });
        }
      }
      if (mag) add('circle', { cx: X(mag[0]), cy: Y(mag[1]), r: 8, class: 'tde-mag' });
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
      hint.textContent = tool !== 'sel' ? HINTS[tool] + '  ·  Échap : terminer'
        : !lw.items.length ? 'Choisissez un modèle, ou un élément à gauche puis cliquez sur la feuille ; tirez ensuite les liaisons d\'un atome à l\'autre.'
          : sel.size ? 'Glissez pour déplacer · tirez les petits ronds pour tourner doublets et charge · Suppr : supprimer'
            : 'Cliquez un atome ou une liaison pour le régler · glissez dans le vide pour en choisir plusieurs';
    }

    /* ---------- Vue ---------- */
    const zoomLab = L.h('span', { class: 'sbe-zoom-v', text: '100 %' });
    function setZoom(z, cx, cy) {
      const old = zoom;
      zoom = Math.max(0.3, Math.min(4, z));
      cx = cx === undefined ? stage.clientWidth / 2 : cx; cy = cy === undefined ? stage.clientHeight / 2 : cy;
      const ux = (stage.scrollLeft + cx) / old, uy = (stage.scrollTop + cy) / old;
      world.style.transform = 'scale(' + zoom + ')';
      sizer.style.width = WORLD[0] * zoom + 'px'; sizer.style.height = WORLD[1] * zoom + 'px';
      stage.scrollLeft = ux * zoom - cx; stage.scrollTop = uy * zoom - cy;
      zoomLab.textContent = Math.round(zoom * 100) + ' %';
    }
    function fit() {
      const W = stage.clientWidth || 800, H = stage.clientHeight || 500;
      if (!vb) { setZoom(1.6); stage.scrollLeft = ORG[0] * zoom - W / 2; stage.scrollTop = ORG[1] * zoom - H / 2; return; }
      const w = vb[2] + 160, h = vb[3] + 160;
      setZoom(Math.min(2.4, W / w, H / h));
      stage.scrollLeft = (ORG[0] + vb[0] + vb[2] / 2) * zoom - W / 2;
      stage.scrollTop = (ORG[1] + vb[1] + vb[3] / 2) * zoom - H / 2;
    }
    const viewCenter = () => [rnd(((stage.scrollLeft + stage.clientWidth / 2) / zoom - ORG[0]) / CM, 0.25), rnd((ORG[1] - (stage.scrollTop + stage.clientHeight / 2) / zoom) / CM, 0.25)];

    /* ---------- Aimants ---------- */
    const nearAtom = (m, except) => {
      let best = null, bd = 15 / zoom / CM;
      lw.items.forEach(it => { if (it.t === 'atom' && it.id !== except) { const d = Math.hypot(it.p[0] - m.x, it.p[1] - m.y); if (d < bd) { bd = d; best = it; } } });
      return best;
    };
    // Bout d'une flèche : doublet, milieu d'une liaison ou atome tout proche, sinon position libre
    function snapEnd(m, e) {
      mag = null;
      if (e && e.altKey) return [rnd(m.x), rnd(m.y)];
      let best = null, bd = 12 / zoom / CM;
      LW.anchors(lw).forEach(q => { const d = Math.hypot(q[0] - m.x, q[1] - m.y); if (d < bd) { bd = d; best = q; } });
      if (best) { mag = best.slice(); return best.slice(); }
      return [rnd(m.x, 0.05), rnd(m.y, 0.05)];
    }
    // Nouvel atome au bout d'une liaison : longueur réglée, angle par pas de 15° (Alt : libre)
    function bondEnd(A, m, e) {
      const len = opts().blen;
      if (e && e.altKey) return [rnd(m.x, 0.05), rnd(m.y, 0.05)];
      const a = Math.round(angOf(A.p, [m.x, m.y]) / 15) * 15;
      return [rnd(A.p[0] + len * Math.cos(a * Math.PI / 180)), rnd(A.p[1] + len * Math.sin(a * Math.PI / 180))];
    }
    // Direction libre autour d'un atome (clic sur un atome avec un outil de liaison)
    function freeDir(A) {
      const dirs = LW.bondsOf(lw, A.id).map(b => { const o = item(LW.other(b, A.id)); return o ? angOf(A.p, o.p) : null; }).filter(v => v !== null);
      if (!dirs.length) return 0;
      if (dirs.length === 1) return mod360(dirs[0] + 180);
      let best = 0, bs = -1;
      for (let a = 0; a < 360; a += 15) {
        const m = Math.min(...dirs.map(d => { const x = Math.abs(mod360(a - d)); return Math.min(x, 360 - x); }));
        if (m > bs + 1e-6 || (Math.abs(m - bs) < 1e-6 && (a % 90 === 0))) { bs = m; best = a; }
      }
      return best;
    }

    /* ---------- Actions ---------- */
    const selChanged = () => {
      editKey = null;
      const before = lw.items.length;
      lw.items = lw.items.filter(i => i.t !== 'text' || sel.has(i.id) || (L.TD && L.TD.content(i.lab)));
      if (lw.items.length !== before) refresh(); else drawOver();
      status(); renderSide(); buttons();
    };
    const select = ids => { sel = new Set(ids); selChanged(); };
    const add = it => { it.id = LW.newId(lw, it.t); lw.items.push(it); return it; };
    const newAtom = (p, e) => add({ t: 'atom', el: e || el, p, q: 0, auto: true, lp: 0, rad: 0, vac: 0, ang: null, qa: null });
    const bondBetween = (a, b) => lw.items.find(i => i.t === 'bond' && ((i.a === a && i.b === b) || (i.a === b && i.b === a)));
    const toolOrder = () => (tool === 'b2' ? 2 : tool === 'b3' ? 3 : 1);
    function setTool(k) {
      draft = null; mag = null;
      tool = k;
      L.$$('.tde-tool', pal).forEach(b => b.classList.toggle('on', b.dataset.tool === k));
      L.$$('.lwe-el', pal).forEach(b => b.classList.toggle('on', b.dataset.el === el && k === 'atom'));
      drawOver(); status();
    }
    function setEl(v) {
      v = LW.cleanEl(v);
      if (!v) return;
      el = v;
      // des atomes choisis : ils prennent ce nouvel élément
      const ats = [...sel].map(item).filter(i => i && i.t === 'atom');
      if (tool === 'sel' && ats.length) act(() => ats.forEach(a => { a.el = v; a.ang = null; }));
      else if (tool !== 'b1' && tool !== 'b2' && tool !== 'b3') setTool('atom');
      L.$$('.lwe-el', pal).forEach(b => b.classList.toggle('on', b.dataset.el === el && tool === 'atom'));
      elIn.value = BUILTIN.has(el) ? '' : el;
    }
    function removeIds(ids) {
      const dead = new Set(ids);
      lw.items.forEach(i => { if (i.t === 'bond' && (dead.has(i.a) || dead.has(i.b))) dead.add(i.id); });
      lw.items = lw.items.filter(i => !dead.has(i.id));
      sel = new Set([...sel].filter(id => !dead.has(id)));
    }
    const removeSel = () => { if (sel.size) act(() => removeIds(sel)); };
    // Doublets, électrons, lacunes réglés à la main : on part des valeurs calculées
    function manual(a) {
      if (a.auto === false) return;
      const ex = LW.electrons(lw, a);
      a.auto = false; a.lp = ex.lp; a.rad = ex.rad; a.vac = ex.vac;
    }
    function clickAtom(a, e) {
      switch (tool) {
        case 'atom': if (a.el !== el) act(() => { a.el = el; a.ang = null; }); break;
        case 'erase': act(() => removeIds([a.id])); break;
        case 'plus': case 'minus': act(() => { a.q = Math.max(-4, Math.min(4, (a.q || 0) + (tool === 'plus' ? 1 : -1))); a.ang = null; }); break;
        case 'lp': case 'rad': case 'vac': act(() => { manual(a); a[tool] = Math.max(0, Math.min(8, (a[tool] || 0) + (e.shiftKey ? -1 : 1))); a.ang = null; }); break;
        default: break;
      }
    }
    function createBond(fromId, target, cur) {
      act(() => {
        const A = item(fromId);
        if (!A) return;
        let B = target ? item(target) : null;
        if (!B) B = newAtom(cur);
        const ex = bondBetween(A.id, B.id);
        if (ex) ex.o = ex.o === toolOrder() && toolOrder() < 3 ? ex.o + 1 : toolOrder();
        else add({ t: 'bond', a: A.id, b: B.id, o: toolOrder() });
        A.ang = null; B.ang = null;
      });
    }
    function finishDraft() {
      const d = draft;
      draft = null; mag = null;
      if (!d) return;
      if (d.k === 'bond') return;
      const [A] = d.pts, B = d.cur;
      if (!B || dist(A, B) < 0.15) { drawDyn(); return; }
      act(() => {
        const it = d.k === 'curve' ? add({ t: 'curve', p: [A, B], bend: 0.4 }) : add({ t: 'arrow', p: [A, B], k: d.k === 'meso' ? '<->' : '->' });
        sel = new Set([it.id]);
      });
    }
    function grab() {
      const ids = new Set(sel);
      // une liaison suit ses deux atomes
      lw.items.forEach(i => { if (i.t === 'bond' && ids.has(i.a) && ids.has(i.b)) ids.add(i.id); });
      return JSON.parse(JSON.stringify(lw.items.filter(i => ids.has(i.id) && (i.t !== 'bond' || (ids.has(i.a) && ids.has(i.b))))));
    }
    function paste(items, dx, dy) {
      if (!items || !items.length) return;
      act(() => {
        const map = {}, ids = [];
        items.filter(x => x.t !== 'bond').forEach(x => { const c = JSON.parse(JSON.stringify(x)); const old = c.id; add(c); map[old] = c.id; LW.shift(c, dx, dy); ids.push(c.id); });
        items.filter(x => x.t === 'bond').forEach(x => { if (map[x.a] && map[x.b]) { const c = JSON.parse(JSON.stringify(x)); c.a = map[x.a]; c.b = map[x.b]; add(c); ids.push(c.id); } });
        sel = new Set(ids);
      });
    }
    const duplicate = () => paste(grab(), 0.5, -0.5);
    function loadTemplate(t) {
      push();
      lw = LW.repair(Object.assign(t.make(), { opts: Object.assign({}, lw.opts) }));
      sel = new Set(); editKey = null; tplBox.hidden = true;
      setTool('sel');
      refresh(); renderSide(); fit();
      stage.focus({ preventScroll: true });
    }
    function showTemplates() {
      tplBox.replaceChildren(
        L.h('div', { class: 'sbe-tpl-h' }, L.h('b', { text: 'Partir d\'une molécule' }), L.h('span', { text: 'Tout reste modifiable : atomes, liaisons, charges, doublets.' }),
          L.h('button', { class: 'x', title: 'Fermer', text: '×', onclick: () => { tplBox.hidden = true; } })),
        L.h('div', { class: 'sbe-tpl-grid lwe-tpl-grid' }, LW.TEMPLATES.map(t => {
          const pv = L.h('div', { class: 'sbe-tpl-pv paper' });
          try {
            const m = LW.repair(Object.assign(t.make(), { opts: Object.assign({}, lw.opts) }));
            if (m.items.length) { const r = L.TikZ.render(LW.toTikz(m), { fontSize: 11 }); if (r.svg) pv.appendChild(r.svg); } else pv.appendChild(L.h('span', { class: 'sbe-tpl-empty', text: '+' }));
          } catch (e) { /* aperçu facultatif */ }
          return L.h('button', { class: 'sbe-tpl-card', onclick: () => {
            if (lw.items.length && !confirm('Remplacer le schéma actuel par ce modèle ? (Ctrl+Z pour revenir en arrière)')) return;
            loadTemplate(t);
          } }, pv, L.h('b', { text: t.name }), L.h('small', { text: t.f || t.desc || '' }));
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
    const isBondTool = () => tool === 'b1' || tool === 'b2' || tool === 'b3';
    over.addEventListener('pointerdown', e => {
      if (e.button === 1) { e.preventDefault(); pan = { c: [e.clientX, e.clientY], s: [stage.scrollLeft, stage.scrollTop] }; capture(e); return; }
      if (e.button !== 0) return;
      e.preventDefault();
      leaveField();
      const d = e.target.dataset || {}, m = mouse(e), hit = d.i ? item(d.i) : null;
      if (tool === 'sel') {
        drag = null;
        if (d.h !== undefined && hit) drag = { k: 'handle', id: d.i, h: /^\d+$/.test(d.h) ? +d.h : d.h, m0: m };
        else if (d.g !== undefined && hit) drag = { k: 'grp', id: d.i, g: +d.g, m0: m };
        else if (d.q !== undefined && hit) drag = { k: 'chg', id: d.i, m0: m };
        else if (hit) {
          let off = false;
          if (e.shiftKey) { if (sel.has(d.i)) { sel.delete(d.i); off = true; } else sel.add(d.i); selChanged(); }
          else if (!sel.has(d.i)) select([d.i]);
          if (!off) drag = { k: 'move', id: d.i, m0: m, shift: e.shiftKey };
        } else {
          if (!e.shiftKey && sel.size) select([]);
          drag = { k: 'band', m0: m, m, base: new Set(sel) };
        }
        if (drag) { drag.c0 = [e.clientX, e.clientY]; drag.moved = false; capture(e); }
        return;
      }
      capture(e);
      if (isBondTool()) {
        if (hit && hit.t === 'bond') { if (hit.o !== toolOrder()) act(() => { hit.o = toolOrder(); }); return; }
        let A = hit && hit.t === 'atom' ? hit : null;
        if (!A) {
          if (hit) return;
          push(); editKey = null;
          A = newAtom([rnd(m.x, 0.25), rnd(m.y, 0.25)]);
          refresh();
          draft = { k: 'bond', from: A.id, cur: null, to: null, made: true, c0: [e.clientX, e.clientY] };
        } else draft = { k: 'bond', from: A.id, cur: null, to: null, made: false, c0: [e.clientX, e.clientY] };
        drawDyn();
        return;
      }
      if (tool === 'arrow' || tool === 'meso' || tool === 'curve') {
        const q = snapEnd(m, e);
        if (!draft) { draft = { k: tool, pts: [q], cur: q, down: true, drag: false, c0: [e.clientX, e.clientY] }; drawDyn(); return; }
        draft.cur = q;
        finishDraft();
        return;
      }
      if (tool === 'text') {
        act(() => { const it = add({ t: 'text', p: [rnd(m.x, 0.05), rnd(m.y, 0.05)], lab: { latex: '', mode: 't' } }); sel = new Set([it.id]); });
        setTool('sel');
        if (focusText) focusText();
        return;
      }
      if (hit && hit.t === 'atom') { clickAtom(hit, e); return; }
      if (tool === 'erase') { if (hit) act(() => removeIds([hit.id])); return; }
      if (tool === 'atom' && !hit) act(() => { newAtom([rnd(m.x, 0.25), rnd(m.y, 0.25)]); });
    });
    over.addEventListener('pointermove', e => {
      const m = mouse(e);
      if (pan) { stage.scrollLeft = pan.s[0] - (e.clientX - pan.c[0]); stage.scrollTop = pan.s[1] - (e.clientY - pan.c[1]); return; }
      if (draft && draft.k === 'bond') {
        const A = item(draft.from);
        if (!A) return;
        if (!draft.moved && Math.hypot(e.clientX - draft.c0[0], e.clientY - draft.c0[1]) < 6) return;
        draft.moved = true;
        const B = nearAtom(m, A.id);
        draft.to = B ? B.id : null;
        draft.cur = B ? B.p.slice() : bondEnd(A, m, e);
        mag = B ? B.p.slice() : null;
        drawDyn();
        return;
      }
      if (draft) {
        draft.cur = snapEnd(m, e);
        if (draft.down && !draft.drag && Math.hypot(e.clientX - draft.c0[0], e.clientY - draft.c0[1]) > 5) draft.drag = true;
        drawDyn();
        return;
      }
      if (!drag) {
        if (tool === 'arrow' || tool === 'meso' || tool === 'curve') { snapEnd(m, e); drawDyn(); }
        return;
      }
      if (!drag.moved && Math.hypot(e.clientX - drag.c0[0], e.clientY - drag.c0[1]) < 4) return;
      const first = !drag.moved;
      drag.moved = true; drag.m = m;
      if (drag.k === 'move') {
        if (first) {
          push();
          drag.orig = {};
          sel.forEach(id => { const it = item(id); if (it && it.t !== 'bond') drag.orig[id] = JSON.stringify(it); });
          // une liaison choisie déplace ses deux atomes
          sel.forEach(id => { const it = item(id); if (it && it.t === 'bond') [it.a, it.b].forEach(a => { if (!drag.orig[a] && item(a)) drag.orig[a] = JSON.stringify(item(a)); }); });
        }
        const g = e.altKey ? 0.01 : 0.05, dx = rnd(m.x - drag.m0.x, g), dy = rnd(m.y - drag.m0.y, g);
        lw.items = lw.items.map(i => {
          if (!drag.orig[i.id]) return i;
          const c = JSON.parse(drag.orig[i.id]);
          LW.shift(c, dx, dy);
          return c;
        });
        soon();
      } else if (drag.k === 'grp' || drag.k === 'chg') {
        const a = item(drag.id);
        if (!a) return;
        if (first) push();
        let ang = angOf(a.p, [m.x, m.y]);
        if (!e.altKey) ang = mod360(Math.round(ang / 15) * 15);
        if (drag.k === 'chg') a.qa = ang;
        else {
          const lay = LW.layout(lw, a);
          const cur = lay.groups.map(g => g.a);
          cur[drag.g] = ang;
          a.ang = cur;
        }
        soon();
      } else if (drag.k === 'handle') {
        const it = item(drag.id);
        if (!it) return;
        if (first) push();
        if (drag.h === 'm') {
          const [A, B] = it.p, mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], len = dist(A, B) || 1;
          const nx = -(B[1] - A[1]) / len, ny = (B[0] - A[0]) / len;
          it.bend = Math.max(-1.5, Math.min(1.5, Math.round(2 * ((m.x - mid[0]) * nx + (m.y - mid[1]) * ny) / len * 20) / 20));
        } else it.p[drag.h] = snapEnd(m, e);
        soon();
      } else if (drag.k === 'band') drawDyn();
    });
    function endDrag(e, cancel) {
      if (pan) { pan = null; return; }
      try { over.releasePointerCapture(e.pointerId); } catch (x) { /* déjà relâchée */ }
      if (draft && draft.k === 'bond') {
        const d = draft;
        draft = null; mag = null;
        if (cancel) { drawDyn(); return; }
        if (d.moved && (d.to || (d.cur && item(d.from) && dist(item(d.from).p, d.cur) > 0.2))) {
          if (d.made) { undo.pop(); push(); }   // atome de départ et liaison : une seule annulation
          createBond(d.from, d.to, d.cur);
        } else if (!d.made) {
          // clic sur un atome : une liaison vers un nouvel atome, dans une direction libre
          const A = item(d.from);
          if (A) { const a = freeDir(A), len = opts().blen; createBond(A.id, null, [rnd(A.p[0] + len * Math.cos(a * Math.PI / 180)), rnd(A.p[1] + len * Math.sin(a * Math.PI / 180))]); }
        } else { renderSide(); drawOver(); }
        return;
      }
      if (draft) {
        if (cancel) { draft = null; drawDyn(); return; }
        if (draft.down) {
          draft.down = false;
          if (draft.drag && dist(draft.cur, draft.pts[0]) > 0.15) { finishDraft(); return; }
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
        if (cancel && d.moved && d.k !== 'band') { doUndo(); redo.pop(); return; }
        if (d.k === 'move' && !d.shift && sel.size > 1) select([d.id]);
        const now = Date.now(), c = [e.clientX, e.clientY];
        const dbl = !cancel && lastClick && now - lastClick.t < 380 && Math.hypot(c[0] - lastClick.c[0], c[1] - lastClick.c[1]) < 6;
        lastClick = dbl ? null : { t: now, c };
        if (dbl && d.k === 'move') {
          const it = item(d.id);
          // double-clic : liaison simple → double → triple ; texte : on l'écrit
          if (it && it.t === 'bond') act(() => { it.o = it.o >= 3 ? 1 : it.o + 1; });
          else if (it && it.t === 'text' && focusText) focusText();
          else if (it && it.t === 'atom') { const i = L.$('.lwe-elin', side); if (i) { i.focus(); i.select(); } }
        }
        drawDyn();
        return;
      }
      if (d.k === 'band') {
        const x0 = Math.min(d.m0.x, d.m.x), x1 = Math.max(d.m0.x, d.m.x), y0 = Math.min(d.m0.y, d.m.y), y1 = Math.max(d.m0.y, d.m.y);
        const ids = new Set(d.base);
        lw.items.forEach(i => { const b = bboxOf(i); if (b && b[0] >= x0 && b[2] <= x1 && b[1] >= y0 && b[3] <= y1) ids.add(i.id); });
        select(ids);
        return;
      }
      refresh(); renderSide();
    }
    over.addEventListener('pointerup', e => endDrag(e, false));
    over.addEventListener('pointercancel', e => endDrag(e, true));
    over.addEventListener('pointerleave', () => { if (!drag && !draft && mag) { mag = null; drawDyn(); } });
    over.addEventListener('contextmenu', e => { if (draft) { e.preventDefault(); draft = null; mag = null; drawDyn(); } });
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
      else if (mod && low === 'a') { done(); setTool('sel'); select(lw.items.map(i => i.id)); }
      else if (mod && low === 'c') { if (sel.size) { done(); clip = { items: grab(), k: 0 }; } }
      else if (mod && low === 'x') { if (sel.size) { done(); clip = { items: grab(), k: 0 }; removeSel(); } }
      else if (mod && low === 'v') { if (clip) { done(); clip.k++; paste(clip.items, 0.5 * clip.k, -0.5 * clip.k); } }
      else if (k === 'Delete' || k === 'Backspace') { done(); if (draft) { draft = null; mag = null; drawDyn(); } else removeSel(); }
      else if (/^Arrow/.test(k) && sel.size && !mod) {
        done();
        const s = e.shiftKey ? 0.25 : 0.05, dx = k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0, dy = k === 'ArrowUp' ? s : k === 'ArrowDown' ? -s : 0;
        typing('nudge:' + [...sel].join());
        const ids = new Set(sel);
        lw.items.forEach(i => { if (i.t === 'bond' && ids.has(i.id)) { ids.add(i.a); ids.add(i.b); } });
        lw.items.forEach(i => { if (ids.has(i.id) && i.t !== 'bond') LW.shift(i, dx, dy); });
        refresh();
      } else if (!mod && !e.altKey && /^[123]$/.test(k)) {
        done();
        const bs = [...sel].map(item).filter(i => i && i.t === 'bond');
        if (bs.length) act(() => bs.forEach(b => { b.o = +k; }));
        else setTool('b' + k);
      } else if (!mod && !e.altKey && k.length === 1) {
        const tl = ALLTOOLS.find(x => x[3] === low || (x[3] === '-' && k === '−'));
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
    const cssCol = k => { const c = L.TikZ.parseColor(LW.COLORS[k] || 'black'); return c ? 'rgb(' + c.map(v => Math.round(v)).join(',') + ')' : '#000'; };
    const swatches = (val, on) => L.h('div', { class: 'sbe-sw' }, Object.keys(LW.COLORS).map(k => {
      const b = L.h('button', { class: (val || 'noir') === k ? 'on' : '', title: k.charAt(0).toUpperCase() + k.slice(1), onclick: () => on(k === 'noir' ? null : k) });
      b.style.background = cssCol(k);
      return b;
    }));
    // − n + : nombre de doublets, d'électrons, de lacunes
    const stepper = (label, val, on, max) => L.h('div', { class: 'lwe-step' }, L.h('span', { class: 'lwe-step-l', text: label }),
      L.h('button', { class: 'btn', text: '−', disabled: val <= 0, onclick: () => on(Math.max(0, val - 1)) }),
      L.h('b', { class: 'lwe-step-v', text: String(val) }),
      L.h('button', { class: 'btn', text: '+', disabled: val >= (max || 8), onclick: () => on(Math.min(max || 8, val + 1)) }));
    const notes = list => list.length ? L.h('ul', { class: 'lwe-notes' }, list.map(n => L.h('li', { class: n.warn ? 'warn' : n.ok ? 'ok' : '', text: n.n }))) : null;

    function verifySec() {
      const s = LW.summary(lw);
      if (!s.atoms) return null;
      const lines = [];
      if (s.unknown) lines.push({ n: plur(s.unknown, 'groupe non vérifié', 'groupes non vérifiés') + ' (symbole inconnu).' });
      const pairs = s.val / 2;
      lines.push({ n: 'Électrons de valence' + (s.charge ? ' (charge ' + LW.qText(s.charge) + ')' : '') + ' : ' + s.val + (s.val % 2 ? ' : nombre impair, un électron célibataire.' : ', soit ' + pairs + ' doublets.') });
      const ok = s.drawn === s.val;
      lines.push({ n: 'Électrons dessinés : ' + s.drawn + (ok ? ' ✔' : ' ✖ (il en faut ' + s.val + ')'), ok, warn: !ok });
      s.notes.forEach(n => lines.push(n));
      if (ok && !s.warn) lines.push({ n: 'Charges formelles cohérentes, duet et octet vérifiés.', ok: true });
      return sec('Vérification', notes(lines));
    }

    function renderSide() {
      side.replaceChildren();
      const list = [...sel].map(item).filter(Boolean);
      const o = opts();
      if (!list.length) {
        side.append(
          L.h('div', { class: 'sbe-title' }, L.h('span', { class: 'sbe-ic', text: 'Ö' }), L.h('b', { text: 'Schéma de Lewis' })),
          sec('Doublets non liants', seg([['trait', '— Traits', 'Un trait par doublet (usage en France)'], ['points', '•• Points', 'Deux points par doublet']], o.lp, v => act(() => { lw.opts.lp = v; }))),
          sec('Charges formelles', seg([['cercle', '⊕ ⊖ Entourées'], ['simple', '+ − Simples']], o.charge, v => act(() => { lw.opts.charge = v; }))),
          sec('Lacunes', chk('Ajouter les lacunes automatiquement', o.lac, v => act(() => { lw.opts.lac = v; }), 'Bore, aluminium, carbocations… : une lacune par doublet manquant pour l\'octet')),
          sec('Nouvelles liaisons', L.h('div', { class: 'sbe-row' }, L.h('span', { class: 'sbe-lab', text: 'Longueur' }), (() => {
            const r = L.h('input', { type: 'range', min: 0.6, max: 1.6, step: 0.05, value: o.blen });
            const lab = L.h('span', { class: 'rng-v', text: fr(o.blen) + ' cm' });
            r.oninput = () => { lab.textContent = fr(+r.value) + ' cm'; };
            r.onchange = () => act(() => { lw.opts.blen = +r.value; });
            return L.h('div', { class: 'rng' }, r, lab);
          })())),
          verifySec() || L.h('div'),
          tip('<ul><li>Choisissez un <b>élément</b> à gauche et cliquez sur la feuille.</li><li>Avec <b>Simple</b>, <b>Double</b> ou <b>Triple</b>, tirez d\'un atome vers un autre, ou dans le vide pour créer un nouvel atome.</li><li>Doublets non liants, électrons célibataires et lacunes se calculent seuls à partir des liaisons et des <b>charges</b>.</li><li>Double-clic sur une liaison : simple → double → triple.</li></ul>'));
        return;
      }
      if (list.length > 1) {
        const ats = list.filter(i => i.t === 'atom');
        side.append(
          L.h('div', { class: 'sbe-title' }, L.h('span', { class: 'sbe-ic', text: String(list.length) }), L.h('b', { text: list.length + ' éléments choisis' })),
          ats.length ? sec('Élément des atomes', elField(null, v => act(() => ats.forEach(a => { a.el = v; a.ang = null; })))) : null,
          sec('Couleur', swatches(null, v => act(() => list.forEach(i => { if (v) i.c = v; else delete i.c; })))),
          sec(null, btn('Dupliquer', duplicate, 'wide'), btn('Supprimer', removeSel, 'wide')));
        return;
      }
      const it = list[0];
      const head = (ic, t) => L.h('div', { class: 'sbe-title' }, L.h('span', { class: 'sbe-ic', text: ic }), L.h('b', { text: t }));
      switch (it.t) {
        case 'atom': {
          const lay = LW.layout(lw, it), ex = lay.ex, ck = LW.check(lw, it), nm = LW.NAMES[it.el];
          side.append(head(it.el, nm ? 'Atome ' + (/^[aeiouyhéâ]/i.test(nm) ? 'd\'' : 'de ') + nm : 'Groupe ' + it.el));
          side.append(sec('Élément', elField(it.el, v => act(() => { it.el = v; it.ang = null; }))));
          side.append(sec('Charge formelle', seg([[-2, '2−'], [-1, '−'], [0, '0'], [1, '+'], [2, '2+']], it.q || 0, v => act(() => { it.q = v; it.ang = null; it.qa = null; }))));
          const autoBox = sec('Électrons non liants', chk('Calcul automatique', it.auto !== false, v => act(() => { if (v) { it.auto = true; } else manual(it); it.ang = null; }), 'À partir des électrons de valence, des liaisons et de la charge formelle'));
          if (it.auto !== false && LW.known(it.el)) autoBox.append(tip(plur(ex.lp, 'doublet non liant', 'doublets non liants') + (ex.rad ? ', ' + plur(ex.rad, 'électron célibataire', 'électrons célibataires') : '') + (ex.vac ? ', ' + plur(ex.vac, 'lacune', 'lacunes') : '') + '.'));
          else autoBox.append(
            stepper('Doublets', it.auto === false ? it.lp : 0, v => act(() => { manual(it); it.lp = v; it.ang = null; })),
            stepper('Électrons célibataires', it.auto === false ? it.rad : 0, v => act(() => { manual(it); it.rad = v; it.ang = null; }), 4),
            stepper('Lacunes', it.auto === false ? it.vac : 0, v => act(() => { manual(it); it.vac = v; it.ang = null; }), 4));
          side.append(autoBox);
          const placed = Array.isArray(it.ang) || it.qa !== null;
          const rot = dA => act(() => { const cur = LW.layout(lw, it); it.ang = cur.groups.map(g => mod360(g.a + dA)); if (it.q) it.qa = mod360((cur.qa || 45) + dA); });
          if (lay.groups.length || it.q) side.append(sec('Position des doublets et de la charge',
            L.h('div', { class: 'lwe-rot' }, btn('↺ 15°', () => rot(15), '', 'Tourner dans le sens inverse des aiguilles d\'une montre'), btn('↻ 15°', () => rot(-15), '', 'Tourner dans le sens des aiguilles d\'une montre'),
              btn('Automatique', () => act(() => { it.ang = null; it.qa = null; }), placed ? 'primary' : '', 'Revenir au placement automatique')),
            tip('Ou tirez les petits ronds autour de l\'atome.')));
          side.append(sec('Couleur', swatches(it.c, v => act(() => { if (v) it.c = v; else delete it.c; }))));
          const nl = ck.notes.map(n => ({ n, warn: ck.warn }));
          if (LW.known(it.el) && !nl.length) nl.push({ n: (ck.around || 0) + ' électrons autour de ' + it.el + (LW.period(it.el) === 1 ? ' : duet ✔' : ck.around === 8 ? ' : octet ✔' : '') + '.', ok: true });
          side.append(sec('Bilan', notes(nl)));
          break;
        }
        case 'bond': {
          const A = item(it.a), B = item(it.b);
          side.append(head('—', 'Liaison ' + (A ? A.el : '?') + '–' + (B ? B.el : '?')));
          side.append(sec('Type', seg([[1, 'Simple'], [2, 'Double'], [3, 'Triple']], it.o, v => act(() => { it.o = v; if (A) A.ang = null; if (B) B.ang = null; })), tip('Raccourcis : 1, 2, 3 ou double-clic sur la liaison.')));
          side.append(sec('Couleur', swatches(it.c, v => act(() => { if (v) it.c = v; else delete it.c; }))));
          break;
        }
        case 'arrow':
          side.append(head(it.k === '<->' ? '↔' : '→', it.k === '<->' ? 'Flèche de mésomérie' : 'Flèche de réaction'));
          side.append(sec('Type', seg([['->', '→ Réaction'], ['<->', '↔ Mésomérie']], it.k, v => act(() => { it.k = v; }))));
          side.append(sec('Couleur', swatches(it.c, v => act(() => { if (v) it.c = v; else delete it.c; }))));
          break;
        case 'curve':
          side.append(head('↷', 'Flèche courbe'));
          side.append(sec('Forme',
            btn('⇄ Inverser le sens', () => act(() => { it.p.reverse(); it.bend = -it.bend; }), 'wide'),
            btn('Bomber de l\'autre côté', () => act(() => { it.bend = -it.bend; }), 'wide'),
            tip('Tirez le carré du milieu pour régler la courbure, ceux des bouts pour l\'accrocher à un doublet ou une liaison.')));
          side.append(sec('Couleur', swatches(it.c, v => act(() => { if (v) it.c = v; else delete it.c; }))));
          break;
        case 'text': {
          const i = L.h('input', { class: 'lwe-text', value: it.lab.latex || '', placeholder: 'ex. forme A, $\\mathrm{pK_a}$…' });
          i.oninput = () => { typing('txt:' + it.id); it.lab = { latex: i.value, mode: 't' }; soon(); };
          i.onblur = () => { editKey = null; drawOver(); };
          i.onkeydown = e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); leaveField(); } };
          focusText = () => setTimeout(() => { i.focus(); i.select(); }, 0);
          side.append(head('T', 'Texte'), sec('Texte', i, tip('Une formule s\'écrit entre deux $, par exemple $\\mathrm{H_2O}$.')),
            sec('Couleur', swatches(it.c, v => act(() => { if (v) it.c = v; else delete it.c; }))));
          break;
        }
        default: break;
      }
      side.append(sec(null, btn('Dupliquer', duplicate, 'wide'), btn('Supprimer', removeSel, 'wide')));
    }
    // Champ « élément » : symbole tapé, puces des éléments courants
    function elField(val, on) {
      const i = L.h('input', { class: 'lwe-elin', value: val || '', placeholder: 'ex. O, Cl, CH3', spellcheck: 'false', maxlength: 8 });
      const go = () => { const v = LW.cleanEl(i.value); if (v && v !== val) on(v); else i.value = val || ''; };
      i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); leaveField(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); i.value = val || ''; leaveField(); } };
      i.onchange = go;
      return L.h('div', { class: 'lwe-elf' }, i, L.h('div', { class: 'lwe-chips' }, ['H', 'C', 'N', 'O', 'F', 'Cl', 'S', 'P', 'B'].map(s => L.h('button', { class: s === val ? 'on' : '', text: s, onclick: () => { if (s !== val) on(s); } }))),
        L.h('div', { class: 'sbe-fieldtip', text: LW.known(val) || !val ? 'Symbole d\'un élément ou d\'un groupe (CH3, OH…).' : 'Symbole inconnu : groupe dessiné tel quel, électrons non calculés.' }));
    }

    /* ---------- Barre et palette ---------- */
    const BUILTIN = new Set(ELEMS);
    const tbtn = ([k, label, title]) => L.h('button', { class: 'tde-tool' + (k === tool ? ' on' : ''), title, 'data-tool': k, onclick: () => { tplBox.hidden = true; setTool(k); stage.focus({ preventScroll: true }); } }, ico(k, 20), L.h('span', { text: label }));
    const elIn = L.h('input', { class: 'lwe-elother', placeholder: 'Autre…', title: 'Autre élément ou groupe (Entrée)', maxlength: 8, spellcheck: 'false' });
    elIn.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); setEl(elIn.value); leaveField(); } };
    pal.append(
      L.h('div', { class: 'sbe-pal-h', text: 'Outils' }), L.h('div', { class: 'tde-tools' }, TOOLS.map(tbtn)),
      L.h('div', { class: 'sbe-pal-h', text: 'Éléments' }),
      L.h('div', { class: 'lwe-els' }, ELEMS.map(s => L.h('button', { class: 'lwe-el', 'data-el': s, text: s, title: (LW.NAMES[s] ? LW.NAMES[s].charAt(0).toUpperCase() + LW.NAMES[s].slice(1) : s), onclick: () => { tplBox.hidden = true; setEl(s); stage.focus({ preventScroll: true }); } })), elIn),
      L.h('div', { class: 'sbe-pal-h', text: 'Liaisons' }), L.h('div', { class: 'tde-tools lwe-three' }, BONDS.map(tbtn)),
      L.h('div', { class: 'sbe-pal-h', text: 'Électrons' }), L.h('div', { class: 'tde-tools' }, ELEC.map(tbtn)),
      L.h('div', { class: 'sbe-pal-h', text: 'Flèches et texte' }), L.h('div', { class: 'tde-tools' }, ARROWS.map(tbtn)));
    const tb = (text, title, on, need) => L.h('button', { class: 'sbe-tb', title, 'data-need': need || null, onclick: on, text });
    bar.append(
      L.h('button', { class: 'sbe-tb accent', title: 'Eau, ammoniac, dioxyde de carbone, ions, mésomérie…', text: '⌬ Molécules', onclick: () => { if (tplBox.hidden) showTemplates(); else tplBox.hidden = true; } }),
      L.h('span', { class: 'sbe-sep' }),
      tb('↶', 'Annuler (Ctrl+Z)', doUndo, 'undo'), tb('↷', 'Rétablir (Ctrl+Y)', doRedo, 'redo'),
      L.h('span', { class: 'sbe-sep' }),
      tb('Dupliquer', 'Dupliquer la sélection (Ctrl+D)', duplicate, 'sel'), tb('Supprimer', 'Supprimer la sélection (Suppr)', removeSel, 'sel'),
      L.h('span', { class: 'sbe-flex' }),
      tb('−', 'Réduire (Ctrl + molette)', () => setZoom(zoom / 1.2)), zoomLab, tb('+', 'Agrandir (Ctrl + molette)', () => setZoom(zoom * 1.2)),
      tb('⤢ Ajuster', 'Voir tout le schéma', fit));

    /* ---------- Ouverture ---------- */
    const valider = c => {
      leaveField();
      draft = null;
      lw.items = lw.items.filter(i => i.t !== 'text' || (L.TD && L.TD.content(i.lab)));
      const clean = LW.repair(JSON.parse(JSON.stringify(lw)));
      saved = true;
      const f = block && L.find(App.doc, block.id);
      if (f) {
        f.block.lw = clean;
        LW.sync(f.block);
        c(); App.commit(); App.render();
      } else {
        const nb = LW.sync(L.newBlock('tikz', { lw: clean, code: '', scale: 1, caption: '', capMode: 'none' }));
        c();
        if (onDone) onDone(nb);
      }
      if ((dirty || !block) && L.Modules && L.Modules.used) L.Modules.used('lewis');
    };
    dlg = L.modal({
      title: block ? 'Modifier le schéma de Lewis' : 'Nouveau schéma de Lewis', body: root, wide: true, cls: 'sbe-modal tde-modal lwe-modal',
      foot: [{ text: 'Annuler', onClick: c => c() }, { text: block ? 'Valider' : 'Insérer le schéma', cls: 'primary', onClick: valider }],
      onClose: () => { document.removeEventListener('keydown', onKey, true); if (raf) cancelAnimationFrame(raf); },
      onEscape: () => {
        const a = document.activeElement;
        if (!tplBox.hidden && lw.items.length) { tplBox.hidden = true; return true; }
        if (a && a !== stage && root.contains(a) && a.closest('input, textarea, select, math-field')) { leaveField(); return true; }
        if (draft) { draft = null; mag = null; drawDyn(); return true; }
        if (drag) { const d = drag; drag = null; if (d.moved && d.k !== 'band') { doUndo(); redo.pop(); } else drawDyn(); return true; }
        if (tool !== 'sel') { setTool('sel'); return true; }
        if (sel.size) { select([]); return true; }
        return false;
      },
      guard: () => saved || !dirty || confirm('Fermer sans garder les modifications du schéma ?'),
    });
    refresh(); renderSide();
    requestAnimationFrame(() => { fit(); if (!block && !lw.items.length) showTemplates(); stage.focus({ preventScroll: true }); });
    return dlg;
  };
})();
