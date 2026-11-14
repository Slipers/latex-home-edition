/* Éditeur de schémas-blocs : on pose les éléments, on tire les flèches à la souris,
   on écrit les fonctions de transfert comme des formules. Le dessin affiché est celui
   du document (même moteur TikZ) ; une couche transparente par-dessus reçoit la souris.
   Modèle, tracé des flèches et code TikZ : js/schemabloc.js */
(function () {
  const SB = L.SB, CM = 37.7952756, NS = 'http://www.w3.org/2000/svg';
  const WORLD = [4400, 2800], ORG = [1600, 1200];   // plan de travail (px) et position de l'origine
  const S = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    return e;
  };
  const ICONS = {
    bloc: '<rect x="3" y="7" width="18" height="10" rx="1"/><path d="M8 12h8"/>',
    comp: '<circle cx="12" cy="12" r="6.5"/><path d="M9 12h6M12 9v6"/>',
    pt: '<path d="M2 11h20M12 11v10"/><circle cx="12" cy="11" r="2.7" fill="currentColor"/>',
    entree: '<path d="M2 12h11M9.5 8.5L13 12l-3.5 3.5"/><rect x="14" y="7" width="8" height="10" rx="1"/>',
    sortie: '<rect x="2" y="7" width="8" height="10" rx="1"/><path d="M10 12h11M17.5 8.5L21 12l-3.5 3.5"/>',
    txt: '<path d="M6 6h12M12 6v13M9.5 19h5"/>',
    cadre: '<rect x="3" y="5" width="18" height="14" rx="1" stroke-dasharray="3 2.6"/>',
    undo: '<path d="M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12"/>',
  };
  const ico = (k, size) => {
    const s = S('svg', { viewBox: '0 0 24 24', width: size || 20, height: size || 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    s.innerHTML = ICONS[k] || '';
    return s;
  };
  const fr = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const NAMES = { bloc: 'Bloc', comp: 'Comparateur', pt: 'Point de prélèvement', ext: 'Bout de flèche', txt: 'Texte', cadre: 'Cadre' };
  const QUICK = [['a/b', '\\frac{#@}{#?}', 'Fraction'], ['x²', '#@^{#?}', 'Exposant'], ['x₁', '#@_{#?}', 'Indice'], ['√', '\\sqrt{#?}', 'Racine'],
    ['ε', '\\varepsilon'], ['τ', '\\tau'], ['ω', '\\omega'], ['ξ', '\\xi'], ['θ', '\\theta'], ['Ω', '\\Omega'], ['Δ', '\\Delta']];

  /* block : bloc « tikz » existant à modifier, ou null pour un nouveau schéma (onDone reçoit alors le bloc créé) */
  L.dlgSchemaBloc = function (block, onDone) {
    const meta = App.doc.meta, fontPt = SB.fontPtOf(meta);
    SB.clearSizes();
    let sb = SB.repair(JSON.parse(JSON.stringify((block && block.sb) || { nodes: [], wires: [], opts: {} })));
    let sel = new Set(), lay = null, zoom = 1, drag = null, hover = null, editKey = null, clip = null;
    let dirty = false, saved = false, lastClick = null, raf = 0, dlg = null, focusField = null;
    const undo = [], redo = [];

    const wx = x => ORG[0] + x * CM, wy = y => ORG[1] - y * CM;
    const node = id => sb.nodes.find(n => n.id === id);
    const wire = id => sb.wires.find(w => w.id === id);
    const isWired = id => { const n = node(id); return !!n && SB.wired(n); };
    const hz = (a, b) => Math.abs(a[1] - b[1]) < 1e-6;

    /* ---------- Structure de la fenêtre ---------- */
    const stage = L.h('div', { class: 'sbe-stage', tabindex: '-1' });
    const sizer = L.h('div', { class: 'sbe-sizer' });
    const world = L.h('div', { class: 'sbe-world', style: { width: WORLD[0] + 'px', height: WORLD[1] + 'px' } });
    const half = CM / 2;
    world.style.backgroundSize = half + 'px ' + half + 'px';
    world.style.backgroundPosition = (ORG[0] % half - half / 2) + 'px ' + (ORG[1] % half - half / 2) + 'px';
    const drawL = L.h('div', { class: 'sbe-draw paper ' + L.pageClasses(meta) });
    const over = S('svg', { class: 'sbe-over', width: WORLD[0], height: WORLD[1] });
    world.append(drawL, over);
    sizer.appendChild(world);
    const tplBox = L.h('div', { class: 'sbe-tpl', hidden: true });
    const stageWrap = L.h('div', { class: 'sbe-stagewrap' }, stage, tplBox);
    stage.appendChild(sizer);
    const side = L.h('div', { class: 'sbe-side' });
    const pal = L.h('div', { class: 'sbe-pal' });
    const bar = L.h('div', { class: 'sbe-bar' });
    const hint = L.h('span', { class: 'sbe-hint' }), info = L.h('span', { class: 'sbe-info' });
    const root = L.h('div', { class: 'sbe' }, bar, L.h('div', { class: 'sbe-main' }, pal, stageWrap, side), L.h('div', { class: 'sbe-status' }, hint, info));

    /* ---------- Historique ---------- */
    const push = () => { undo.push(JSON.stringify(sb)); if (undo.length > 120) undo.shift(); redo.length = 0; dirty = true; };
    const restore = json => {
      sb = JSON.parse(json);
      sel = new Set([...sel].filter(id => node(id) || wire(id)));
      editKey = null; dirty = true;
      refresh(); renderSide();
    };
    const doUndo = () => { if (undo.length) { redo.push(JSON.stringify(sb)); restore(undo.pop()); } };
    const doRedo = () => { if (redo.length) { undo.push(JSON.stringify(sb)); restore(redo.pop()); } };
    // Une modification immédiate (bouton, réglage) : enregistrée dans l'historique puis redessinée
    const act = fn => { push(); editKey = null; fn(); refresh(); renderSide(); };
    // Une saisie au clavier dans un champ : un seul pas d'historique pour toute la saisie
    const typing = key => { if (editKey !== key) { push(); editKey = key; } dirty = true; };
    const soon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; refresh(); }); };

    /* ---------- Dessin ---------- */
    function refresh() {
      lay = SB.layout(sb, fontPt);
      const r = L.TikZ.render(SB.toTikz(sb, fontPt, lay), { fontSize: meta.fontSize });
      drawL.replaceChildren();
      if (r.svg && !r.empty) {
        const vb = (r.svg.getAttribute('viewBox') || '0 0 0 0').split(/\s+/).map(Number);
        r.svg.style.cssText = 'position:absolute;max-width:none;overflow:visible;left:' + (ORG[0] + vb[0]) + 'px;top:' + (ORG[1] + vb[1]) + 'px;';
        drawL.appendChild(r.svg);
      }
      drawOver();
      status();
      L.$$('button[data-need]', bar).forEach(b => { b.disabled = b.dataset.need === 'undo' ? !undo.length : b.dataset.need === 'redo' ? !redo.length : !sel.size; });
    }
    let gPorts = null, gTmp = null;
    function drawOver() {
      over.replaceChildren();
      const g = () => { const e = S('g', {}); over.appendChild(e); return e; };
      const gC = g(), gW = g(), gN = g(), gSel = g();
      sb.nodes.forEach(n => {
        const b = lay.boxes[n.id], on = sel.has(n.id), x = wx(n.x), y = wy(n.y);
        if (n.t === 'cadre') {
          gC.appendChild(S('rect', { x: wx(b.x0), y: wy(b.y1), width: b.w * CM, height: b.h * CM, class: 'sbe-hit-frame', 'data-n': n.id }));
          gC.appendChild(S('rect', { x: wx(b.x0), y: wy(b.y1) - 17, width: Math.min(b.w * CM, 190), height: 17, class: 'sbe-hit', 'data-n': n.id }));
          if (on) gSel.appendChild(S('rect', { x: wx(b.x0), y: wy(b.y1), width: b.w * CM, height: b.h * CM, class: 'sbe-selbox' }));
        } else if (SB.free(n)) {
          if (n.t === 'ext') gN.appendChild(S('rect', { x: x - 3.5, y: y - 3.5, width: 7, height: 7, class: 'sbe-ext' }));
          gN.appendChild(S('circle', { cx: x, cy: y, r: 9, class: 'sbe-hit', 'data-n': n.id }));
          if (on) gSel.appendChild(S('circle', { cx: x, cy: y, r: 8, class: 'sbe-selbox' }));
        } else if (n.t === 'comp') {
          gN.appendChild(S('circle', { cx: x, cy: y, r: b.w * CM / 2 + 2, class: 'sbe-hit', 'data-n': n.id }));
          if (on) gSel.appendChild(S('circle', { cx: x, cy: y, r: b.w * CM / 2 + 4, class: 'sbe-selbox' }));
        } else {
          if (n.t === 'txt' && !SB.content(n)) {
            gN.appendChild(S('rect', { x: wx(b.x0), y: wy(b.y1), width: b.w * CM, height: b.h * CM, class: 'sbe-ghost' }));
            const t = S('text', { x, y: y + 4, class: 'sbe-ghost-t', 'text-anchor': 'middle' }); t.textContent = 'Texte'; gN.appendChild(t);
          }
          gN.appendChild(S('rect', { x: wx(b.x0), y: wy(b.y1), width: b.w * CM, height: b.h * CM, class: 'sbe-hit', 'data-n': n.id }));
          if (on) gSel.appendChild(S('rect', { x: wx(b.x0) - 3, y: wy(b.y1) - 3, width: b.w * CM + 6, height: b.h * CM + 6, rx: 3, class: 'sbe-selbox' }));
        }
      });
      sb.wires.forEach(w => {
        const p = lay.paths[w.id];
        if (!p) return;
        for (let i = 0; i < p.length - 1; i++) {
          const mv = i >= 1 && i <= p.length - 3 ? (hz(p[i], p[i + 1]) ? ' mv-h' : ' mv-v') : '';
          gW.appendChild(S('line', { x1: wx(p[i][0]), y1: wy(p[i][1]), x2: wx(p[i + 1][0]), y2: wy(p[i + 1][1]), class: 'sbe-hit-wire' + mv, 'data-w': w.id, 'data-k': i }));
        }
        if (sel.has(w.id)) gSel.appendChild(S('polyline', { points: p.map(q => wx(q[0]) + ',' + wy(q[1])).join(' '), class: 'sbe-wire-on' }));
      });
      gPorts = g(); gTmp = g();
      drawDyn();
    }
    const portPx = (n, p) => {
      const b = lay.boxes[n.id], d = SB.DIRS[p];
      if (SB.free(n)) return [wx(n.x) + d[0] * 15, wy(n.y) - d[1] * 15];
      const q = SB.port(b, p);
      return [wx(q[0]), wy(q[1])];
    };
    // Ce qui change pendant qu'on bouge la souris : points d'accroche, poignées, tracé provisoire
    function drawDyn() {
      if (!gPorts) return;
      gPorts.replaceChildren(); gTmp.replaceChildren();
      const one = sel.size === 1 ? node([...sel][0]) : null;
      const moving = drag && drag.moved && drag.k !== 'wire';
      if (!moving) {
        const shown = new Set();
        if (one && SB.wired(one)) shown.add(one.id);
        if (hover && isWired(hover)) shown.add(hover);
        if (drag && drag.k === 'wire') shown.add(drag.from.n);
        shown.forEach(id => {
          const n = node(id);
          Object.keys(SB.DIRS).forEach(p => {
            const q = portPx(n, p);
            const on = drag && drag.k === 'wire' && drag.to && drag.to.n === id && (SB.free(n) || drag.to.p === p);
            gPorts.appendChild(S('circle', { cx: q[0], cy: q[1], r: 5.5, class: 'sbe-port' + (on ? ' on' : ''), 'data-n': id, 'data-p': p }));
          });
        });
        if (one && (one.t === 'bloc' || one.t === 'cadre') && !drag) {
          const b = lay.boxes[one.id];
          [['nw', b.x0, b.y1], ['ne', b.x1, b.y1], ['sw', b.x0, b.y0], ['se', b.x1, b.y0]].forEach(([h, x, y]) =>
            gPorts.appendChild(S('rect', { x: wx(x) - 4.5, y: wy(y) - 4.5, width: 9, height: 9, class: 'sbe-handle ' + (h === 'nw' || h === 'se' ? 'nwse' : 'nesw'), 'data-n': one.id, 'data-h': h })));
        }
      }
      if (drag && drag.k === 'wire' && drag.prev) gTmp.appendChild(S('polyline', { points: drag.prev.map(q => wx(q[0]) + ',' + wy(q[1])).join(' '), class: 'sbe-tmp' }));
      if (drag && drag.k === 'band' && drag.moved) {
        const a = drag.m0, b = drag.m;
        gTmp.appendChild(S('rect', { x: Math.min(a.px, b.px), y: Math.min(a.py, b.py), width: Math.abs(a.px - b.px), height: Math.abs(a.py - b.py), class: 'sbe-band' }));
      }
    }
    function status() {
      const bb = SB.bounds(sb, lay), tw = L.TEXTWIDTH_CM ? L.TEXTWIDTH_CM(meta) : 16;
      if (!bb) { info.textContent = ''; info.className = 'sbe-info'; }
      else {
        const w = bb[2] - bb[0], big = w > tw + 0.05;
        info.textContent = (big ? '⚠ ' : '') + 'Largeur ' + fr(w) + ' cm' + (big ? ' : plus large que le texte de la page (' + fr(tw) + ' cm)' : ' · page : ' + fr(tw) + ' cm');
        info.className = 'sbe-info' + (big ? ' warn' : '');
      }
      const one = sel.size === 1 ? [...sel][0] : null;
      hint.textContent = !sb.nodes.length ? 'Ajoutez un élément avec la colonne de gauche, ou choisissez un modèle.'
        : one && wire(one) ? 'Double-clic sur la flèche : point de prélèvement · glissez un segment du milieu pour le déplacer · Suppr : supprimer'
        : sel.size ? 'Glissez pour déplacer · tirez depuis un point bleu pour créer une flèche · Suppr : supprimer'
        : 'Cliquez un élément pour le régler · tirez depuis ses points bleus pour le relier · double-clic dans le vide : nouveau bloc';
    }

    /* ---------- Vue ---------- */
    function setZoom(z, cx, cy) {
      const old = zoom;
      zoom = Math.max(0.4, Math.min(2.5, z));
      // le point (cx, cy) de la zone visible reste sous la souris
      cx = cx === undefined ? stage.clientWidth / 2 : cx; cy = cy === undefined ? stage.clientHeight / 2 : cy;
      const ux = (stage.scrollLeft + cx) / old, uy = (stage.scrollTop + cy) / old;
      world.style.transform = 'scale(' + zoom + ')';
      sizer.style.width = WORLD[0] * zoom + 'px'; sizer.style.height = WORLD[1] * zoom + 'px';
      stage.scrollLeft = ux * zoom - cx; stage.scrollTop = uy * zoom - cy;
      zoomLab.textContent = Math.round(zoom * 100) + ' %';
    }
    function fit() {
      const bb = lay && SB.bounds(sb, lay);
      const W = stage.clientWidth || 800, H = stage.clientHeight || 500;
      if (!bb) { setZoom(1.25); stage.scrollLeft = ORG[0] * zoom - W * 0.3; stage.scrollTop = ORG[1] * zoom - H * 0.4; return; }
      const w = (bb[2] - bb[0]) * CM + 150, h = (bb[3] - bb[1]) * CM + 150;
      setZoom(Math.min(1.4, W / w, H / h));
      stage.scrollLeft = wx((bb[0] + bb[2]) / 2) * zoom - W / 2;
      stage.scrollTop = wy((bb[1] + bb[3]) / 2) * zoom - H / 2;
    }
    const viewCenter = () => [SB.snap(((stage.scrollLeft + stage.clientWidth / 2) / zoom - ORG[0]) / CM), SB.snap((ORG[1] - (stage.scrollTop + stage.clientHeight / 2) / zoom) / CM)];

    /* ---------- Actions sur le schéma ---------- */
    const selChanged = () => { editKey = null; drawOver(); status(); renderSide(); L.$$('button[data-need="sel"]', bar).forEach(b => { b.disabled = !sel.size; }); };
    const select = ids => { sel = new Set(ids); selChanged(); };
    const wiresOf = id => sb.wires.filter(w => w.a.n === id || w.b.n === id);
    const freeSpot = (x, y) => {
      for (let k = 0; k < 30; k++) {
        if (!sb.nodes.some(n => n.t !== 'cadre' && Math.abs(n.x - x) < 1.6 && Math.abs(n.y - y) < 1.1)) break;
        y -= 1.5;
      }
      return [x, y];
    };
    const mk = (t, x, y, extra) => {
      const n = Object.assign({ id: SB.newId(sb, t), t, x: SB.snap(x), y: SB.snap(y) },
        t === 'bloc' ? { latex: 'H(p)', mode: 'm' } : t === 'txt' ? { latex: '', mode: 't' } : t === 'comp' ? { signs: { w: '+', s: '-' } } : t === 'cadre' ? { w: 4, h: 2.5, latex: '', mode: 't' } : {}, extra);
      sb.nodes.push(n);
      return n;
    };
    const mkWire = (a, b, extra) => {
      const w = Object.assign({ id: SB.newId(sb, 'wire'), a, b, latex: '', mode: 'm' }, extra);
      sb.wires.push(w);
      // une flèche qui arrive sur un comparateur reçoit un signe : − par le bas (retour), + ailleurs
      const n = node(b.n);
      if (n && n.t === 'comp' && b.p !== 'e' && !(n.signs && b.p in n.signs)) n.signs = Object.assign({}, n.signs, { [b.p]: b.p === 's' ? '-' : '+' });
      return w;
    };
    // Coupe une flèche pour y placer un élément (point de prélèvement, bloc, comparateur)
    function splitWire(w, k, at, t) {
      const p = lay.paths[w.id];
      k = Math.max(0, Math.min(p.length - 2, k));
      const a = p[k], b = p[k + 1].slice(), h = hz(a, b);
      const fwd = h ? b[0] > a[0] : b[1] > a[1];
      if (t !== 'pt' && !at) {
        // pas assez de place pour un bloc : on écarte ce qui se trouve après la coupure
        const i = h ? 0 : 1, need = (t === 'bloc' ? 1.5 : 0.6) + 1.5, len = Math.abs(b[i] - a[i]);
        if (len < need) {
          const d = Math.ceil((need - len) / SB.GRID) * SB.GRID * (fwd ? 1 : -1), cut = b[i];
          const past = v => fwd ? v >= cut - 1e-6 : v <= cut + 1e-6;
          sb.nodes.forEach(n => { if (past(i ? n.y : n.x)) { if (i) n.y = SB.snap(n.y + d); else n.x = SB.snap(n.x + d); } });
          sb.wires.forEach(x => { if (x.pts) x.pts.forEach(q => { if (past(q[i])) q[i] += d; }); });
          b[i] += d;
        }
      }
      const lim =(v, u1, u2) => { const lo = Math.min(u1, u2), hi = Math.max(u1, u2); return hi - lo < 0.6 ? (lo + hi) / 2 : Math.max(lo + 0.25, Math.min(hi - 0.25, SB.snap(v))); };
      const pos = h ? [lim(at ? at.x : (a[0] + b[0]) / 2, a[0], b[0]), a[1]] : [a[0], lim(at ? at.y : (a[1] + b[1]) / 2, a[1], b[1])];
      const pin = h ? (fwd ? 'w' : 'e') : (fwd ? 's' : 'n'), pout = h ? (fwd ? 'e' : 'w') : (fwd ? 'n' : 's');
      const n = Object.assign({ id: SB.newId(sb, t), t, x: pos[0], y: pos[1] }, t === 'bloc' ? { latex: 'H(p)', mode: 'm' } : t === 'comp' ? { signs: { [pin]: '+' } } : {});
      sb.nodes.push(n);
      const w2 = { id: '', a: { n: n.id, p: pout }, b: w.b, latex: '', mode: w.mode || 'm' };
      if (w.tip === false) w2.tip = false;
      if (w.dash) w2.dash = true;
      if (t === 'pt') { w2.latex = w.latex || ''; w2.lseg = w.lseg; w2.lside = w.lside; w.latex = ''; }   // le nom du signal reste près de la sortie
      w.b = { n: n.id, p: pin };
      delete w.pts; delete w.h0;
      w2.id = SB.newId(sb, 'wire');
      sb.wires.splice(sb.wires.indexOf(w) + 1, 0, w2);
      return n;
    }
    function addEl(kind) {
      tplBox.hidden = true;
      const id1 = sel.size === 1 ? [...sel][0] : null, sn = id1 && node(id1), sw = id1 && wire(id1);
      const boxes = lay.boxes;
      let pick = null, focus = false;
      if (kind === 'entree' || kind === 'sortie') {
        const inp = kind === 'entree', side0 = inp ? 'w' : 'e';
        const busy = n => sb.wires.some(w => inp ? (w.b.n === n.id && w.b.p === 'w') : (w.a.n === n.id && (SB.free(n) || w.a.p === 'e')));
        let tg = sn && (sn.t === 'bloc' || sn.t === 'comp' || (!inp && sn.t === 'pt')) ? sn : null;
        if (!tg) {
          const c = sb.nodes.filter(n => (n.t === 'bloc' || n.t === 'comp') && !busy(n)).sort((a, b) => inp ? a.x - b.x : b.x - a.x);
          tg = c[0] || null;
        }
        if (!tg) { L.toast(sb.nodes.length ? 'Sélectionnez d\'abord le bloc à relier' : 'Ajoutez d\'abord un bloc', 'warn'); return; }
        push();
        const b = boxes[tg.id];
        const e = mk('ext', inp ? b.x0 - 1.75 : b.x1 + 1.75, tg.y);
        pick = (inp ? mkWire({ n: e.id, p: 'e' }, { n: tg.id, p: side0 }) : mkWire({ n: tg.id, p: side0 }, { n: e.id, p: 'w' })).id;
        focus = true;
      } else if (kind === 'cadre') {
        push();
        const inside = [...sel].map(node).filter(n => n && n.t !== 'cadre');
        if (inside.length) {
          let bb = null;
          inside.forEach(n => { const b = boxes[n.id]; bb = bb ? [Math.min(bb[0], b.x0), Math.min(bb[1], b.y0), Math.max(bb[2], b.x1), Math.max(bb[3], b.y1)] : [b.x0, b.y0, b.x1, b.y1]; });
          const x0 = SB.snap(bb[0] - 0.5), x1 = SB.snap(bb[2] + 0.5), y0 = SB.snap(bb[1] - 0.5), y1 = SB.snap(bb[3] + 0.5);
          pick = mk('cadre', 0, 0, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 }).id;
        } else { const c = viewCenter(); pick = mk('cadre', c[0], c[1]).id; }
        focus = true;
      } else if (kind === 'txt') {
        push();
        const c = sn ? [sn.x, boxes[sn.id].y0 - 0.75] : freeSpot(...viewCenter());
        pick = mk('txt', c[0], c[1]).id; focus = true;
      } else if (sw) {
        push();
        pick = splitWire(sw, SB.labelSeg({}, lay.paths[sw.id]), null, kind).id; focus = kind === 'bloc';
      } else {
        push();
        const halfW = kind === 'bloc' ? 0.75 : kind === 'comp' ? 0.3 : 0;
        const chain = sn && SB.wired(sn) && !(sn.t === 'ext' && sb.wires.some(w => w.b.n === sn.id))
          && !sb.wires.some(w => w.a.n === sn.id && (SB.free(sn) ? sn.t === 'ext' : w.a.p === 'e'));
        if (chain) {
          const n = mk(kind, boxes[sn.id].x1 + (SB.free(sn) ? 1.5 : 1.25) + halfW, sn.y);
          mkWire({ n: sn.id, p: 'e' }, { n: n.id, p: 'w' });
          pick = n.id;
        } else {
          const c = sb.nodes.length ? freeSpot(...viewCenter()) : viewCenter();
          pick = mk(kind, c[0], c[1]).id;
        }
        focus = kind === 'bloc';
      }
      editKey = null;
      sel = new Set([pick]);
      refresh(); renderSide();
      if (focus && focusField) focusField();
    }
    function removeSel() {
      if (!sel.size) return;
      act(() => {
        const dead = new Set(sel);
        // un point de prélèvement traversé par une seule ligne : la flèche est recollée
        sb.nodes.filter(n => n.t === 'pt' && dead.has(n.id)).forEach(n => {
          const inn = sb.wires.filter(w => w.b.n === n.id && !dead.has(w.id)), out = sb.wires.filter(w => w.a.n === n.id && !dead.has(w.id));
          if (inn.length === 1 && out.length === 1 && !dead.has(inn[0].a.n) && !dead.has(out[0].b.n)) {
            inn[0].b = out[0].b;
            if (!inn[0].latex && out[0].latex) Object.assign(inn[0], { latex: out[0].latex, mode: out[0].mode, lseg: out[0].lseg, lside: out[0].lside });
            if (out[0].tip === false) inn[0].tip = false; else delete inn[0].tip;
            delete inn[0].pts; delete inn[0].h0;
            dead.add(out[0].id);
          }
        });
        sb.wires = sb.wires.filter(w => !dead.has(w.id) && !dead.has(w.a.n) && !dead.has(w.b.n));
        sb.nodes = sb.nodes.filter(n => !dead.has(n.id) && !(n.t === 'ext' && !wiresOf(n.id).length));
        sel = new Set();
      });
    }
    // Copie d'éléments (et des flèches qui les relient entre eux), décalée
    function paste(data, dx, dy) {
      if (!data || !data.nodes.length) return;
      act(() => {
        const map = {}, ids = [];
        data.nodes.forEach(n => { const c = JSON.parse(JSON.stringify(n)); c.id = SB.newId(sb, c.t); c.x = SB.snap(c.x + dx); c.y = SB.snap(c.y + dy); map[n.id] = c.id; sb.nodes.push(c); ids.push(c.id); });
        data.wires.forEach(w => {
          const c = JSON.parse(JSON.stringify(w)); c.id = SB.newId(sb, 'wire'); c.a.n = map[w.a.n]; c.b.n = map[w.b.n];
          if (c.pts) c.pts = c.pts.map(q => [q[0] + dx, q[1] + dy]);
          sb.wires.push(c); ids.push(c.id);
        });
        sel = new Set(ids);
      });
    }
    function grab() {
      const ns = sb.nodes.filter(n => sel.has(n.id));
      // un bout de flèche seul ne se copie pas : il n'existe qu'avec sa flèche
      const ws = sb.wires.filter(w => sel.has(w.a.n) && sel.has(w.b.n));
      const used = new Set(); ws.forEach(w => { used.add(w.a.n); used.add(w.b.n); });
      return JSON.parse(JSON.stringify({ nodes: ns.filter(n => n.t !== 'ext' || used.has(n.id)), wires: ws }));
    }
    const duplicate = () => paste(grab(), 0.5, -0.5);
    function connect(a, b) {
      if (a.n === b.n) return;
      if (sb.wires.some(w => (w.a.n === a.n && w.b.n === b.n) || (w.a.n === b.n && w.b.n === a.n))) { L.toast('Ces deux éléments sont déjà reliés'); return; }
      push();
      // un point de prélèvement reçoit une seule ligne : les suivantes en repartent
      const nb = node(b.n), na = node(a.n);
      if (nb.t === 'pt' && na.t !== 'pt' && sb.wires.some(w => w.b.n === nb.id)) [a, b] = [b, a];
      select([mkWire({ n: a.n, p: a.p }, { n: b.n, p: b.p }).id]);
      refresh();
    }
    function nearestPort(id, m) {
      const n = node(id), b = lay.boxes[id];
      if (SB.free(n)) return Math.abs(m.x - n.x) > Math.abs(m.y - n.y) ? (m.x > n.x ? 'e' : 'w') : (m.y > n.y ? 'n' : 's');
      let best = 'w', bd = Infinity;
      Object.keys(SB.DIRS).forEach(p => { const q = SB.port(b, p), d = Math.hypot(q[0] - m.x, q[1] - m.y); if (d < bd) { bd = d; best = p; } });
      return best;
    }
    function loadTemplate(t) {
      push();
      sb = SB.normalize(t.make(), fontPt);
      sel = new Set(); editKey = null; tplBox.hidden = true;
      refresh(); renderSide(); fit();
      stage.focus({ preventScroll: true });
    }
    function showTemplates() {
      tplBox.replaceChildren(
        L.h('div', { class: 'sbe-tpl-h' }, L.h('b', { text: 'Partir d\'un modèle' }), L.h('span', { text: 'Tout reste modifiable ensuite : textes, blocs, flèches.' }),
          L.h('button', { class: 'x', title: 'Fermer', text: '×', onclick: () => { tplBox.hidden = true; } })),
        L.h('div', { class: 'sbe-tpl-grid' }, SB.TEMPLATES.map(t => {
          const pv = L.h('div', { class: 'sbe-tpl-pv paper' });
          try {
            const m = t.make();
            if (m.nodes.length) { const r = L.TikZ.render(SB.toTikz(m, 10.95), { fontSize: 11 }); if (r.svg) pv.appendChild(r.svg); } else pv.appendChild(L.h('span', { class: 'sbe-tpl-empty', text: '+' }));
          } catch (e) { /* aperçu facultatif */ }
          return L.h('button', { class: 'sbe-tpl-card', onclick: () => {
            if (sb.nodes.length && !confirm('Remplacer le schéma actuel par ce modèle ? (Ctrl+Z pour revenir en arrière)')) return;
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
    over.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      leaveField();
      const d = e.target.dataset || {}, m = mouse(e);
      drag = null;
      if (d.p) drag = { k: 'wire', from: { n: d.n, p: d.p }, m0: m, to: null, prev: null };
      else if (d.h) drag = { k: 'size', id: d.n, h: d.h, m0: m, box: Object.assign({}, lay.boxes[d.n]) };
      else if (d.n) {
        let off = false;
        if (e.shiftKey) { if (sel.has(d.n)) { sel.delete(d.n); off = true; } else sel.add(d.n); selChanged(); }
        else if (!sel.has(d.n)) select([d.n]);
        if (!off) drag = { k: 'move', id: d.n, m0: m, shift: e.shiftKey };
      } else if (d.w) {
        if (e.shiftKey) { if (sel.has(d.w)) sel.delete(d.w); else sel.add(d.w); selChanged(); }
        else if (!sel.has(d.w) || sel.size > 1) select([d.w]);
        drag = { k: 'seg', id: d.w, seg: +d.k, m0: m };
      } else {
        if (!e.shiftKey && sel.size) select([]);
        drag = { k: 'band', m0: m, m, base: new Set(sel) };
      }
      if (drag) { drag.c0 = [e.clientX, e.clientY]; drag.moved = false; try { over.setPointerCapture(e.pointerId); } catch (x) { /* souris déjà relâchée */ } }
    });
    over.addEventListener('pointermove', e => {
      const m = mouse(e);
      if (!drag) {
        const d = e.target.dataset || {}, h = d.n && isWired(d.n) ? d.n : null;
        if (h !== hover) { hover = h; drawDyn(); }
        return;
      }
      if (!drag.moved && Math.hypot(e.clientX - drag.c0[0], e.clientY - drag.c0[1]) < 4) return;
      const first = !drag.moved;
      drag.moved = true; drag.m = m;
      if (drag.k === 'move') {
        if (first) {
          push();
          drag.orig = {}; drag.pts = {};
          const ids = new Set([...sel].filter(node));
          // un cadre emporte les éléments placés dedans
          sb.nodes.filter(n => n.t === 'cadre' && ids.has(n.id)).forEach(c => {
            const b = lay.boxes[c.id];
            sb.nodes.forEach(n => { if (n.t !== 'cadre' && n.x > b.x0 && n.x < b.x1 && n.y > b.y0 && n.y < b.y1) ids.add(n.id); });
          });
          sb.nodes.forEach(n => { if (ids.has(n.id)) drag.orig[n.id] = [n.x, n.y]; });
          sb.wires.forEach(w => { if (w.pts && drag.orig[w.a.n] && drag.orig[w.b.n]) drag.pts[w.id] = w.pts.map(q => q.slice()); });
        }
        const dx = SB.snap(m.x - drag.m0.x), dy = SB.snap(m.y - drag.m0.y);
        Object.keys(drag.orig).forEach(id => { const n = node(id); n.x = drag.orig[id][0] + dx; n.y = drag.orig[id][1] + dy; });
        Object.keys(drag.pts).forEach(id => { wire(id).pts = drag.pts[id].map(q => [q[0] + dx, q[1] + dy]); });
        soon();
      } else if (drag.k === 'size') {
        if (first) push();
        const n = node(drag.id), b = drag.box;
        if (n.t === 'bloc') {
          n.w = Math.max(1, SB.snap(2 * Math.abs(m.x - n.x), 0.5));
          n.h = Math.max(0.5, SB.snap(2 * Math.abs(m.y - n.y), 0.5));
        } else {
          const X = SB.snap(m.x), Y = SB.snap(m.y);
          const x0 = drag.h[1] === 'w' ? Math.min(X, b.x1 - 0.5) : b.x0, x1 = drag.h[1] === 'e' ? Math.max(X, b.x0 + 0.5) : b.x1;
          const y0 = drag.h[0] === 's' ? Math.min(Y, b.y1 - 0.5) : b.y0, y1 = drag.h[0] === 'n' ? Math.max(Y, b.y0 + 0.5) : b.y1;
          Object.assign(n, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 });
        }
        soon();
      } else if (drag.k === 'seg') {
        const w = wire(drag.id);
        if (first) {
          drag.path = lay.paths[w.id].map(q => q.slice());
          drag.ok = drag.seg >= 1 && drag.seg <= drag.path.length - 3;
          if (drag.ok) push();
        }
        if (!drag.ok) return;
        const p0 = drag.path, k = drag.seg, pts = p0.slice(1, -1).map(q => q.slice());
        if (hz(p0[k], p0[k + 1])) { const y = SB.snap(p0[k][1] + m.y - drag.m0.y); pts[k - 1][1] = y; pts[k][1] = y; }
        else { const x = SB.snap(p0[k][0] + m.x - drag.m0.x); pts[k - 1][0] = x; pts[k][0] = x; }
        w.pts = pts; w.h0 = hz(p0[0], p0[1]);
        soon();
      } else if (drag.k === 'wire') {
        const el = document.elementFromPoint(e.clientX, e.clientY), d = (el && over.contains(el) && el.dataset) || {};
        drag.to = d.n && d.n !== drag.from.n && isWired(d.n) ? { n: d.n, p: d.p || nearestPort(d.n, m) } : d.w ? { w: d.w, k: +d.k } : null;
        hover = drag.to && drag.to.n ? drag.to.n : null;
        const a = node(drag.from.n), Sp = SB.free(a) ? [a.x, a.y] : SB.port(lay.boxes[a.id], drag.from.p);
        const dS = SB.free(a) ? null : SB.DIRS[drag.from.p];
        let T, dT = null;
        if (drag.to && drag.to.n) { const b = node(drag.to.n); T = SB.free(b) ? [b.x, b.y] : SB.port(lay.boxes[b.id], drag.to.p); dT = SB.free(b) ? null : SB.DIRS[drag.to.p]; }
        else {
          T = [SB.snap(m.x), SB.snap(m.y)];
          // presque aligné avec le départ : la flèche reste droite
          if (Math.abs(m.y - Sp[1]) < 0.4 && Math.abs(m.x - Sp[0]) > 0.5) T[1] = Sp[1];
          else if (Math.abs(m.x - Sp[0]) < 0.4 && Math.abs(m.y - Sp[1]) > 0.5) T[0] = Sp[0];
        }
        drag.end = T;
        const obst = sb.nodes.filter(n => n.t === 'bloc' || n.t === 'comp').map(n => lay.boxes[n.id]);
        drag.prev = SB.route(Sp, dS, T, dT, obst);
        drawDyn();
      } else if (drag.k === 'band') drawDyn();
    });
    function endDrag(e, cancel) {
      const d = drag;
      if (!d) return;
      drag = null;
      try { over.releasePointerCapture(e.pointerId); } catch (x) { /* déjà relâchée */ }
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!d.moved || cancel) {
        if (cancel && d.moved && (d.k === 'move' || d.k === 'size' || (d.k === 'seg' && d.ok))) { doUndo(); redo.pop(); return; }
        if (d.k === 'move' && !d.shift && sel.size > 1) select([d.id]);
        // double-clic (détecté à la main : la couche de souris est redessinée à chaque clic)
        const now = Date.now(), c = [e.clientX, e.clientY];
        const dbl = !cancel && lastClick && now - lastClick.t < 380 && Math.hypot(c[0] - lastClick.c[0], c[1] - lastClick.c[1]) < 6;
        lastClick = dbl ? null : { t: now, c };
        if (dbl) {
          if (d.k === 'move' && focusField) focusField();
          else if (d.k === 'seg') act(() => { sel = new Set([splitWire(wire(d.id), d.seg, d.m0, 'pt').id]); });
          else if (d.k === 'band') { act(() => { sel = new Set([mk('bloc', d.m0.x, d.m0.y).id]); }); if (focusField) focusField(); }
        }
        drawDyn();
        return;
      }
      if (d.k === 'wire') {
        const from = d.from, to = d.to;
        hover = null;
        if (to && to.n) connect(from, to);
        else if (to && to.w && wire(to.w) && !(wire(to.w).a.n === from.n || wire(to.w).b.n === from.n)) {
          act(() => {
            const p = splitWire(wire(to.w), to.k, d.m, 'pt');
            lay = SB.layout(sb, fontPt);
            sel = new Set([mkWire({ n: p.id, p: nearestPort(p.id, { x: node(from.n).x, y: node(from.n).y }) }, { n: from.n, p: from.p }).id]);
          });
        } else if (d.end && !to) {
          const a = node(from.n), Sp = SB.free(a) ? [a.x, a.y] : SB.port(lay.boxes[a.id], from.p);
          if (Math.hypot(d.end[0] - Sp[0], d.end[1] - Sp[1]) >= 0.6) {
            act(() => {
              const x = mk('ext', d.end[0], d.end[1]);
              // tirée depuis une entrée (gauche d'un bloc, côtés d'un comparateur) : la flèche arrive sur l'élément
              const into = (a.t === 'bloc' && from.p === 'w') || (a.t === 'comp' && from.p !== 'e');
              const back = { e: 'w', w: 'e', n: 's', s: 'n' }[from.p];
              sel = new Set([(into ? mkWire({ n: x.id, p: from.p }, { n: a.id, p: from.p }) : mkWire({ n: a.id, p: from.p }, { n: x.id, p: back })).id]);
            });
            if (focusField) focusField();
          }
        }
        drawDyn();
        return;
      }
      if (d.k === 'band') {
        const x0 = Math.min(d.m0.x, d.m.x), x1 = Math.max(d.m0.x, d.m.x), y0 = Math.min(d.m0.y, d.m.y), y1 = Math.max(d.m0.y, d.m.y);
        const ids = new Set(d.base);
        sb.nodes.forEach(n => { if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1) ids.add(n.id); });
        sb.wires.forEach(w => { const p = lay.paths[w.id]; if (p && p.every(q => q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1)) ids.add(w.id); });
        select(ids);
        return;
      }
      refresh();
      if (d.k === 'seg' && d.ok) {
        // le tracé gardé est celui qu'on voit (points inutiles retirés) ; redevenu droit, il repasse en automatique
        const w = wire(d.id), p = lay.paths[w.id];
        if (p && p.length > 2) { w.pts = p.slice(1, -1).map(q => q.slice()); w.h0 = hz(p[0], p[1]); } else { delete w.pts; delete w.h0; }
        refresh();
      }
      renderSide();
    }
    over.addEventListener('pointerup', e => endDrag(e, false));
    over.addEventListener('pointercancel', e => endDrag(e, true));
    over.addEventListener('pointerleave', () => { if (!drag && hover) { hover = null; drawDyn(); } });
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
      const k = e.key, mod = e.ctrlKey || e.metaKey;
      const done = () => { e.preventDefault(); e.stopPropagation(); };
      if (mod && !e.shiftKey && k.toLowerCase() === 'z') { done(); doUndo(); }
      else if (mod && (k.toLowerCase() === 'y' || (e.shiftKey && k.toLowerCase() === 'z'))) { done(); doRedo(); }
      else if (mod && k.toLowerCase() === 'd') { done(); duplicate(); }
      else if (mod && k.toLowerCase() === 'a') { done(); select(sb.nodes.map(n => n.id).concat(sb.wires.map(w => w.id))); }
      else if (mod && k.toLowerCase() === 'c') { if (sel.size) { done(); clip = grab(); clip.k = 0; } }
      else if (mod && k.toLowerCase() === 'x') { if (sel.size) { done(); clip = grab(); clip.k = 0; removeSel(); } }
      else if (mod && k.toLowerCase() === 'v') { if (clip) { done(); clip.k++; paste(clip, 0.5 * clip.k, -0.5 * clip.k); } }
      else if (k === 'Delete' || k === 'Backspace') { done(); removeSel(); }
      else if (k === 'Enter' || k === 'F2') { if (focusField) { done(); focusField(); } }
      else if (/^Arrow/.test(k) && sel.size && !mod) {
        const ns = sb.nodes.filter(n => sel.has(n.id));
        if (!ns.length) return;
        done();
        const s = e.shiftKey ? 1 : SB.GRID, dx = k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0, dy = k === 'ArrowUp' ? s : k === 'ArrowDown' ? -s : 0;
        typing('nudge:' + [...sel].join());
        ns.forEach(n => { n.x = SB.snap(n.x + dx); n.y = SB.snap(n.y + dy); });
        sb.wires.forEach(w => { if (w.pts && sel.has(w.a.n) && sel.has(w.b.n)) w.pts = w.pts.map(q => [q[0] + dx, q[1] + dy]); });
        refresh();
      }
    };
    document.addEventListener('keydown', onKey, true);

    /* ---------- Panneau de droite ---------- */
    const sec = (title, ...kids) => L.h('div', { class: 'sbe-sec' }, title ? L.h('div', { class: 'sbe-h', text: title }) : null, ...kids);
    const seg = (opts, val, on, cls) => {
      const s = L.h('div', { class: 'seg ' + (cls || '') });
      opts.forEach(([v, t, title]) => s.appendChild(L.h('button', { class: v === val ? 'on' : '', text: t, title: title || null, onclick: () => { if (v !== val) on(v); } })));
      return s;
    };
    const btn = (text, on, cls, title) => L.h('button', { class: 'btn ' + (cls || ''), text, title: title || null, onclick: on });
    const chk = (label, val, on) => { const c = L.h('input', { type: 'checkbox' }); c.checked = !!val; c.onchange = () => on(c.checked); return L.h('label', { class: 'chk' }, c, label); };
    const tip = html => L.h('div', { class: 'pp-help', html });
    const range = (label, val, min, max, step, on, fmt) => {
      const r = L.h('input', { type: 'range', min, max, step, value: val });
      const lab = L.h('span', { class: 'rng-v', text: fmt(val) });
      r.oninput = () => { typing('rng:' + label); on(+r.value); lab.textContent = fmt(+r.value); soon(); };
      return L.h('div', { class: 'sbe-row' }, L.h('span', { class: 'sbe-lab', text: label }), L.h('div', { class: 'rng' }, r, lab));
    };
    /* Champ « Formule / Texte » d'un bloc, d'une flèche ou d'un texte */
    function contentField(o, key, ph) {
      const wrap = L.h('div', { class: 'sbe-field' }), mode = o.mode === 't' ? 't' : 'm';
      wrap.appendChild(seg([['m', '∑ Formule', 'Écriture mathématique : fractions, indices, lettres grecques…'], ['t', 'Texte', 'Texte ordinaire (Entrée : nouvelle ligne)']], mode, v => act(() => {
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
        mf.addEventListener('blur', () => { editKey = null; });
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
        wrap.append(mf, quick, L.h('div', { class: 'sbe-fieldtip', html: 'Tapez <kbd>/</kbd> pour une fraction, <kbd>_</kbd> indice, <kbd>^</kbd> exposant, « tau », « omega »… <kbd>Entrée</kbd> pour finir.' }));
        wrap._focus = () => { try { mf.focus(); mf.executeCommand('selectAll'); } catch (e) { /* champ pas encore prêt */ } };
      } else {
        const ta = L.h('textarea', { class: 'sbe-ta', rows: mode === 'm' ? '2' : '3', spellcheck: 'false', placeholder: ph || '' });
        ta.value = o.latex || '';
        ta.oninput = () => { typing(key); o.latex = ta.value; soon(); };
        ta.onblur = () => { editKey = null; };
        ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); leaveField(); } });
        wrap.append(ta, L.h('div', { class: 'sbe-fieldtip', html: mode === 'm' ? 'Code LaTeX de la formule.' : '<kbd>Entrée</kbd> : nouvelle ligne. Une formule dans le texte s\'écrit entre deux <b>$</b> : <code>$K_c$</code>.' }));
        wrap._focus = () => { ta.focus(); ta.select(); };
      }
      focusField = () => wrap._focus();
      return wrap;
    }
    const swatches = (val, on) => L.h('div', { class: 'sbe-sw' }, [['', '#fff'], ...Object.keys(SB.FILLS).map(k => { const c = L.TikZ.parseColor(SB.FILLS[k]); return [k, c ? 'rgb(' + c.map(Math.round).join(',') + ')' : '#eee']; })].map(([k, c]) =>
      L.h('button', { class: (val || '') === k ? 'on' : '', title: k ? k[0].toUpperCase() + k.slice(1) : 'Sans couleur', style: { background: c }, onclick: () => on(k) }, k ? null : L.h('span', { text: '∅' }))));
    const common = () => sec(null, L.h('div', { class: 'btn-row' }, btn('Dupliquer', duplicate, '', 'Ctrl+D'), btn('Supprimer', removeSel, 'danger', 'Touche Suppr')));

    function renderSide() {
      focusField = null;
      side.replaceChildren();
      const ids = [...sel];
      if (!ids.length) {
        const o = Object.assign({}, SB.DEF, sb.opts), set = (k, v) => act(() => { sb.opts[k] = v; });
        side.append(
          L.h('div', { class: 'sbe-title' }, L.h('b', { text: 'Réglages du schéma' })),
          sec('Comparateurs', seg([['ext', 'Signes à côté'], ['croix', 'Croix ⊗']], o.comp, v => set('comp', v))),
          sec('Pointe des flèches', seg([['latex', '▶ Pleine'], ['stealth', '➤ Effilée'], ['simple', '→ Simple']], o.tip, v => set('tip', v))),
          sec('Épaisseur des traits', seg([['fin', 'Fin'], ['normal', 'Normal'], ['epais', 'Épais']], o.lw, v => set('lw', v))),
          sec('Taille des textes', seg([['normal', 'Normale'], ['small', 'Petite'], ['footnotesize', 'Très petite']], o.font, v => set('font', v))),
          sec('Comment faire',
            tip('<ul><li><b>Ajouter</b> : colonne de gauche. Avec un élément sélectionné, le nouveau se place à sa droite, déjà relié.</li>'
              + '<li><b>Relier</b> : survolez un élément, puis tirez depuis un de ses <b>points bleus</b> jusqu\'à un autre élément. Lâchée dans le vide, la flèche devient une entrée ou une sortie.</li>'
              + '<li><b>Boucle de retour</b> : double-clic sur une flèche pour y poser un point de prélèvement, puis tirez depuis ce point.</li>'
              + '<li><b>Écrire</b> : double-clic sur un bloc ou une flèche pour saisir sa formule ou son nom.</li>'
              + '<li><b>Déplacer</b> : glissez (les éléments s\'alignent sur la grille) ou flèches du clavier.</li>'
              + '<li><kbd>Suppr</kbd> supprime, <kbd>Ctrl</kbd>+<kbd>Z</kbd> annule, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplique.</li></ul>')));
        return;
      }
      if (ids.length > 1) {
        const ns = ids.map(node).filter(Boolean);
        side.append(L.h('div', { class: 'sbe-title' }, L.h('b', { text: ids.length + ' éléments sélectionnés' })));
        if (ns.length > 1) side.append(sec('Aligner',
          btn('↔  Sur une même ligne', () => act(() => { const y = SB.snap(ns.reduce((a, n) => a + n.y, 0) / ns.length); ns.forEach(n => { n.y = y; }); }), 'wide', 'Même hauteur : les flèches entre eux deviennent droites'),
          btn('↕  Sur une même colonne', () => act(() => { const x = SB.snap(ns.reduce((a, n) => a + n.x, 0) / ns.length); ns.forEach(n => { n.x = x; }); }), 'wide'),
          ns.length > 2 ? btn('⇹  Espacer régulièrement', () => act(() => {
            const s = ns.slice().sort((a, b) => a.x - b.x), x0 = s[0].x, x1 = s[s.length - 1].x;
            s.forEach((n, i) => { n.x = SB.snap(x0 + (x1 - x0) * i / (s.length - 1)); });
          }), 'wide', 'Écarts égaux de gauche à droite') : null));
        if (ns.some(n => n.t !== 'cadre')) side.append(sec('Regrouper', btn('⬚  Encadrer la sélection', () => addEl('cadre'), 'wide')));
        side.append(common());
        return;
      }
      const n = node(ids[0]), w = n ? null : wire(ids[0]);
      if (w) {
        side.append(L.h('div', { class: 'sbe-title' }, L.h('span', { class: 'sbe-ic' }, ico('sortie', 16)), L.h('b', { text: 'Flèche' })),
          sec('Nom du signal', contentField(w, 'w:' + w.id, 'ex. Consigne')),
          sec('Place du nom',
            seg([[undefined, 'Auto'], ['first', 'Au début'], ['last', 'À la fin']], w.lseg, v => act(() => { if (v) w.lseg = v; else delete w.lseg; })),
            seg([[undefined, 'Dessus / à gauche'], ['b', 'Dessous / à droite']], w.lside, v => act(() => { if (v) w.lside = v; else delete w.lside; }))),
          sec('Trait',
            chk('Pointe de flèche au bout', w.tip !== false && node(w.b.n).t !== 'pt', v => act(() => { if (v) delete w.tip; else w.tip = false; })),
            chk('En pointillés', w.dash, v => act(() => { if (v) w.dash = true; else delete w.dash; })),
            btn('⇄  Inverser le sens', () => act(() => { [w.a, w.b] = [w.b, w.a]; if (w.pts) { w.pts.reverse(); const p = lay.paths[w.id]; w.h0 = hz(p[p.length - 1], p[p.length - 2]); } }), 'wide'),
            btn('•  Point de prélèvement au milieu', () => act(() => { sel = new Set([splitWire(w, SB.labelSeg({}, lay.paths[w.id]), null, 'pt').id]); }), 'wide', 'Ou double-clic sur la flèche, à l\'endroit voulu'),
            w.pts ? btn('⟲  Tracé automatique', () => act(() => { delete w.pts; delete w.h0; }), 'wide', 'Oublier le tracé déplacé à la main') : null),
          sec(null, btn('Supprimer la flèche', removeSel, 'danger wide', 'Touche Suppr')));
        return;
      }
      if (!n) return;
      side.append(L.h('div', { class: 'sbe-title' }, L.h('span', { class: 'sbe-ic' }, ico(n.t === 'ext' ? 'sortie' : n.t, 16)), L.h('b', { text: NAMES[n.t] })));
      if (n.t === 'bloc') {
        const b = lay.boxes[n.id];
        side.append(
          sec('Contenu du bloc', contentField(n, 'n:' + n.id, 'ex. Moteur')),
          sec('Taille minimale',
            range('Largeur', n.w || 1.5, 1, 8, 0.25, v => { n.w = v; }, v => fr(v) + ' cm'),
            range('Hauteur', n.h || 1, 0.5, 5, 0.25, v => { n.h = v; }, v => fr(v) + ' cm'),
            tip('Le bloc s\'agrandit tout seul si son contenu est plus grand' + (b.w > (n.w || 1.5) + 0.01 || b.h > (n.h || 1) + 0.01 ? ' (actuellement ' + fr(b.w) + ' × ' + fr(b.h) + ' cm)' : '') + '. On peut aussi tirer ses coins.')),
          sec('Apparence', swatches(n.fill, k => act(() => { if (k) n.fill = k; else delete n.fill; })),
            chk('Coins arrondis', n.round, v => act(() => { if (v) n.round = true; else delete n.round; }))));
      } else if (n.t === 'comp') {
        const sg = n.signs || {};
        const cell = (p, title) => {
          const cur = sg[p] === '+' ? '+' : sg[p] === '-' ? '-' : '';
          return L.h('button', { class: 'sbe-sign' + (cur ? ' on' : ''), title: title + ' : cliquez pour changer (+, −, rien)', text: cur === '-' ? '−' : cur || '·',
            onclick: () => act(() => { n.signs = Object.assign({}, n.signs, { [p]: cur === '' ? '+' : cur === '+' ? '-' : '' }); }) });
        };
        side.append(
          sec('Signes des entrées', L.h('div', { class: 'sbe-cross' },
            L.h('span'), cell('n', 'Entrée du haut'), L.h('span'),
            cell('w', 'Entrée de gauche'), L.h('span', { class: 'sbe-cross-c', text: '○' }), cell('e', 'Côté droit'),
            L.h('span'), cell('s', 'Entrée du bas'), L.h('span')),
          tip('Cliquez sur une case pour faire défiler <b>+</b>, <b>−</b> ou rien. La présentation (signes à côté ou croix ⊗) se règle pour tout le schéma : cliquez dans le vide.')));
      } else if (n.t === 'txt') {
        side.append(sec('Texte', contentField(n, 'n:' + n.id, 'Votre texte')));
      } else if (n.t === 'cadre') {
        side.append(
          sec('Titre du cadre', contentField(n, 'n:' + n.id, 'ex. Partie commande')),
          sec('Bordure', seg([['tirets', 'Tirets'], ['points', 'Pointillés'], ['plein', 'Trait plein']], n.style || 'tirets', v => act(() => { n.style = v; }))),
          sec('Fond', swatches(n.fill, k => act(() => { if (k) n.fill = k; else delete n.fill; }))),
          tip('Tirez les coins pour l\'ajuster. Déplacer le cadre déplace aussi ce qu\'il contient.'));
      } else if (n.t === 'pt') {
        side.append(tip('Un point de prélèvement duplique le signal : tirez depuis ses points bleus pour faire partir une autre flèche (boucle de retour, mesure…).'));
      } else if (n.t === 'ext') {
        side.append(tip('Bout libre d\'une flèche (entrée, sortie, perturbation). Le petit carré n\'apparaît pas dans le document. Pour nommer le signal, cliquez sur la flèche.'));
      }
      side.append(n.t === 'ext' || n.t === 'pt' ? sec(null, btn('Supprimer', removeSel, 'danger wide', 'Touche Suppr')) : common());
    }

    /* ---------- Barre et palette ---------- */
    const palBtn = (k, label, title) => L.h('button', { class: 'sbe-palb', title, onclick: () => addEl(k) }, ico(k, 22), L.h('span', { text: label }));
    pal.append(
      L.h('div', { class: 'sbe-pal-h', text: 'Ajouter' }),
      palBtn('bloc', 'Bloc', 'Bloc : fonction de transfert ou nom d\'un constituant'),
      palBtn('comp', 'Comparateur', 'Comparateur / sommateur (signes + et −)'),
      palBtn('pt', 'Prélèvement', 'Point de prélèvement : sélectionnez d\'abord une flèche pour le poser dessus (ou double-clic sur la flèche)'),
      palBtn('entree', 'Entrée', 'Flèche d\'entrée vers le bloc sélectionné (ou le plus à gauche)'),
      palBtn('sortie', 'Sortie', 'Flèche de sortie du bloc sélectionné (ou le plus à droite)'),
      palBtn('txt', 'Texte', 'Texte libre'),
      palBtn('cadre', 'Cadre', 'Cadre en pointillés autour des éléments sélectionnés'));
    const zoomLab = L.h('span', { class: 'sbe-zoom-v', text: '100 %' });
    const tb = (text, title, on, need) => L.h('button', { class: 'sbe-tb', title, 'data-need': need || null, onclick: on, text });
    bar.append(
      L.h('button', { class: 'sbe-tb accent', title: 'Boucle fermée, perturbation, chaîne fonctionnelle…', text: '▦ Modèles', onclick: () => { if (tplBox.hidden) showTemplates(); else tplBox.hidden = true; } }),
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
      sb = SB.normalize(JSON.parse(JSON.stringify(sb)), fontPt);   // copie propre : sans champs indéfinis
      saved = true;
      const f = block && L.find(App.doc, block.id);
      if (f) {
        f.block.sb = sb;
        SB.sync(f.block, meta);
        c(); App.commit(); App.render();
      } else {
        const nb = SB.sync(L.newBlock('tikz', { sb, code: '', scale: 1, caption: '', capMode: 'none' }), meta);
        c();
        if (onDone) onDone(nb);
      }
      // module « Schémas-blocs » : un schéma créé ou modifié compte comme une utilisation (droit de noter)
      if ((dirty || !block) && L.Modules && L.Modules.used) L.Modules.used('schemabloc');
    };
    dlg = L.modal({
      title: block ? 'Modifier le schéma-bloc' : 'Nouveau schéma-bloc', body: root, wide: true, cls: 'sbe-modal',
      foot: [{ text: 'Annuler', onClick: c => c() }, { text: block ? 'Valider' : 'Insérer le schéma', cls: 'primary', onClick: valider }],
      onClose: () => { document.removeEventListener('keydown', onKey, true); if (raf) cancelAnimationFrame(raf); },
      // Échap : sort d'abord du champ, abandonne le geste en cours, désélectionne ; ensuite seulement ferme
      onEscape: () => {
        const a = document.activeElement;
        if (!tplBox.hidden && sb.nodes.length) { tplBox.hidden = true; return true; }
        if (a && a !== stage && root.contains(a) && a.closest('input, textarea, select, math-field')) { leaveField(); return true; }
        if (drag) { const d = drag; drag = null; hover = null; if (d.moved && (d.k === 'move' || d.k === 'size' || (d.k === 'seg' && d.ok))) { doUndo(); redo.pop(); } else drawDyn(); return true; }
        if (sel.size) { select([]); return true; }
        return false;
      },
      guard: () => saved || !dirty || confirm('Fermer sans garder les modifications du schéma ?'),
    });
    refresh(); renderSide();
    // la fenêtre doit être affichée pour connaître la taille de la zone de dessin
    requestAnimationFrame(() => { fit(); if (!block) showTemplates(); stage.focus({ preventScroll: true }); });
    return dlg;
  };
})();
