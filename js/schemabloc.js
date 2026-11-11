/* Schémas-blocs (sciences de l'ingénieur) : asservissements et chaînes fonctionnelles.
   Le schéma est décrit par un petit modèle (éléments + liaisons) traduit en TikZ :
   dans le document, c'est un bloc « tikz » ordinaire (dessin, aperçu, PDF et export
   LaTeX inchangés) qui garde son modèle dans b.sb pour rester modifiable à la souris
   (éditeur : js/schemabloc-ui.js).

   Modèle (coordonnées en cm, axe y vers le haut, comme TikZ) :
     nodes : { id, t, x, y, … }
       t = bloc   rectangle (fonction de transfert ou texte)   latex, mode, w, h, fill, round
           comp   comparateur / sommateur                       signs { w, e, n, s } = '+', '-' ou ''
           pt     point de prélèvement
           ext    extrémité libre d'une flèche (entrée, sortie, perturbation)
           txt    texte libre                                   latex, mode
           cadre  cadre autour d'un groupe                      w, h, latex (titre), style, fill
     wires : { id, a: { n, p }, b: { n, p }, latex, mode, lseg, lside, tip, dash, pts, h0 }
       p = côté de l'élément : e, w, n ou s ; pts = tracé déplacé à la main (sinon automatique)
     mode : 'm' formule, 't' texte */
(function () {
  const GRID = 0.25, EPS = 1e-6;
  const DIRS = { e: [1, 0], w: [-1, 0], n: [0, 1], s: [0, -1] };
  const ANCHOR = { e: 'east', w: 'west', n: 'north', s: 'south' };
  const DEF = { comp: 'ext', tip: 'latex', lw: 'normal', font: 'normal' };
  const LW = { fin: 0.4, normal: 0.6, epais: 0.9 };
  const TIPS = { latex: 'latex', stealth: 'stealth', simple: 'to' };
  const FONT = { normal: [1, '', 'footnotesize'], small: [0.9, 'small', 'scriptsize'], footnotesize: [0.8, 'footnotesize', 'scriptsize'] };
  const FILLS = { gris: 'black!8', bleu: 'blue!10', vert: 'green!14', jaune: 'yellow!30', orange: 'orange!22', rose: 'red!10' };
  const PREFIX = { bloc: 'b', comp: 'c', pt: 'p', ext: 'e', txt: 't', cadre: 'k' };
  const SEP = 4 / 28.4527559;   // marge intérieure des blocs (4 pt), en cm

  const snap = (v, g) => { const r = Math.round(v / (g || GRID)) * (g || GRID); return Math.abs(r) < EPS ? 0 : r; };
  const r2 = v => { const r = Math.round(v * 100) / 100; return String(Object.is(r, -0) ? 0 : r); };
  const free = n => n.t === 'pt' || n.t === 'ext';
  const wired = n => n.t === 'bloc' || n.t === 'comp' || n.t === 'pt' || n.t === 'ext';

  function newId(sb, t) {
    const p = PREFIX[t] || 'w', used = new Set(sb.nodes.map(n => n.id).concat(sb.wires.map(w => w.id)));
    let k = 1;
    while (used.has(p + k)) k++;
    return p + k;
  }

  /* ---------- Contenu d'un élément → texte TikZ ---------- */
  const balanced = s => {
    let d = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\') { i++; continue; }
      if (c === '{') d++; else if (c === '}' && --d < 0) return false;
    }
    return d === 0;
  };
  // Texte : les caractères spéciaux de LaTeX sont protégés, sauf dans les formules $…$
  const escText = s => s.split(/(\$[^$]*\$)/).map((p, i) => i % 2 ? p : p.replace(/\\?([%&#_$])/g, '\\$1')).join('');
  function content(o, big) {
    let s = String(o.latex || '').replace(/\r/g, '').trim();
    if (!s) return '';
    if (o.mode === 't') {
      s = s.split('\n').map(l => escText(l.trim())).filter(Boolean).join(' \\\\ ');
      return balanced(s) ? s : s.replace(/\\?[{}]/g, '');
    }
    s = s.replace(/\n/g, ' ').replace(/\$/g, '').replace(/(^|[^\\])%/g, '$1\\%');
    if (big) s = s.replace(/\\frac(?![a-zA-Z])/g, '\\dfrac');   // fractions en grand dans les blocs
    if (!balanced(s)) s = s.replace(/\\?[{}]/g, '');
    return s ? '$' + s + '$' : '';
  }

  /* ---------- Dimensions ---------- */
  const SIZES = new Map();
  function textSize(text, fontPt, scale) {
    if (!text || !L.TikZ) return { w: 0, h: 0 };
    const k = fontPt + '|' + scale + '|' + text;
    let v = SIZES.get(k);
    if (!v) {
      v = L.TikZ.textSize(text, fontPt, scale);
      if (SIZES.size > 800) SIZES.clear();
      if (v.w > 0) SIZES.set(k, v);
    }
    return v;
  }
  const up = (v, g) => Math.ceil(v / g - 1e-9) * g;
  function boxOf(n, o, fontPt) {
    const fs = (FONT[o.font] || FONT.normal)[0];
    let w = 0, h = 0;
    if (n.t === 'bloc') {
      const t = textSize(content(n, true), fontPt, fs);
      w = Math.max(+n.w || 1.5, up(t.w + 2 * SEP + 0.2, 0.1));
      h = Math.max(+n.h || 1, up(t.h + 2 * SEP + 0.1, 0.1));
    } else if (n.t === 'comp') w = h = o.comp === 'croix' ? 0.8 : 0.6;
    else if (n.t === 'txt') { const t = textSize(content(n), fontPt, fs); w = Math.max(0.6, t.w + 2 * SEP); h = Math.max(0.5, t.h + 2 * SEP); }
    else if (n.t === 'cadre') { w = Math.max(0.5, +n.w || 4); h = Math.max(0.5, +n.h || 2); }
    return { x: n.x, y: n.y, w, h, x0: n.x - w / 2, x1: n.x + w / 2, y0: n.y - h / 2, y1: n.y + h / 2 };
  }
  const port = (b, p) => { const d = DIRS[p] || DIRS.e; return [b.x + d[0] * b.w / 2, b.y + d[1] * b.h / 2]; };

  /* ---------- Tracé automatique des liaisons (à angles droits) ---------- */
  const samePt = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
  // Retire les points doubles et les points alignés ; strict : refuse les obliques et les demi-tours
  function tidy(path, strict) {
    const p = [];
    path.forEach(q => { if (!p.length || !samePt(p[p.length - 1], q)) p.push([q[0], q[1]]); });
    if (strict) for (let i = 0; i < p.length - 1; i++) if (Math.abs(p[i][0] - p[i + 1][0]) > EPS && Math.abs(p[i][1] - p[i + 1][1]) > EPS) return null;
    for (let i = 1; i < p.length - 1;) {
      const a = p[i - 1], b = p[i], c = p[i + 1];
      const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
      if (Math.abs(ux * vy - uy * vx) < EPS) {
        if (strict && ux * vx + uy * vy < 0) return null;
        p.splice(i, 1);
        if (samePt(p[i - 1], p[i] || [NaN, NaN])) { p.splice(i, 1); if (i > 1) i--; }
      } else i++;
    }
    return p;
  }
  function segHits(a, b, bx, pad) {
    const x0 = bx.x0 - pad, x1 = bx.x1 + pad, y0 = bx.y0 - pad, y1 = bx.y1 + pad, e = 0.02;
    if (Math.abs(a[1] - b[1]) < EPS) return a[1] > y0 + e && a[1] < y1 - e && Math.max(a[0], b[0]) > x0 + e && Math.min(a[0], b[0]) < x1 - e;
    return a[0] > x0 + e && a[0] < x1 - e && Math.max(a[1], b[1]) > y0 + e && Math.min(a[1], b[1]) < y1 - e;
  }
  /* De S (sortie dans la direction dS) à T (arrivée par le côté dT) ; dS, dT nuls = direction libre.
     On essaie quelques formes simples (droite, Z, L, contournement par-dessous, par-dessus ou par
     le côté) et on garde la moins coûteuse : courte, peu de coudes, sans traverser d'élément. */
  function route(S, dS, T, dT, obst) {
    let best = null, bc = Infinity;
    const xa = Math.min(S[0], T[0]), xb = Math.max(S[0], T[0]), ya = Math.min(S[1], T[1]), yb = Math.max(S[1], T[1]);
    let lo = ya, hi = yb, le = xa, ri = xb;
    obst.forEach(b => {
      if (b.x1 > xa - 0.3 && b.x0 < xb + 0.3) { lo = Math.min(lo, b.y0); hi = Math.max(hi, b.y1); }
      if (b.y1 > ya - 0.3 && b.y0 < yb + 0.3) { le = Math.min(le, b.x0); ri = Math.max(ri, b.x1); }
    });
    for (const M of [0.5, 0.25, 0.1]) {
      const S1 = dS ? [S[0] + dS[0] * M, S[1] + dS[1] * M] : S, T1 = dT ? [T[0] + dT[0] * M, T[1] + dT[1] * M] : T;
      const mx = snap((S1[0] + T1[0]) / 2), my = snap((S1[1] + T1[1]) / 2);
      const mids = [[], [[mx, S1[1]], [mx, T1[1]]], [[S1[0], my], [T1[0], my]], [[T1[0], S1[1]]], [[S1[0], T1[1]]],
        ...[snap(lo - 1), snap(hi + 1)].map(y => [[S1[0], y], [T1[0], y]]),
        ...[snap(le - 1), snap(ri + 1)].map(x => [[x, S1[1]], [x, T1[1]]])];
      mids.forEach(mid => {
        const p = tidy([S, S1, ...mid, T1, T], true);
        if (!p || p.length < 2) return;
        let c = 0.7 * (p.length - 2);
        for (let i = 0; i < p.length - 1; i++) {
          c += Math.abs(p[i][0] - p[i + 1][0]) + Math.abs(p[i][1] - p[i + 1][1]);
          obst.forEach(b => { if (segHits(p[i], p[i + 1], b, 0)) c += 100; else if (segHits(p[i], p[i + 1], b, 0.35)) c += 2; });
        }
        if (c < bc - 1e-9) { bc = c; best = p; }
      });
    }
    return best || [S, T];
  }
  function wirePath(w, lay, obst) {
    const A = lay.boxes[w.a.n], B = lay.boxes[w.b.n];
    if (!A || !B) return null;
    const na = lay.nodes[w.a.n], nb = lay.nodes[w.b.n];
    const S = free(na) ? [A.x, A.y] : port(A, w.a.p), T = free(nb) ? [B.x, B.y] : port(B, w.b.p);
    if (Array.isArray(w.pts) && w.pts.length) {
      // Tracé déplacé à la main : les deux bouts restent accrochés aux éléments, à angle droit
      const p = w.pts.map(q => [+q[0] || 0, +q[1] || 0]), n = p.length, h0 = !!w.h0;
      if (h0) p[0][1] = S[1]; else p[0][0] = S[0];
      if ((n % 2 === 0) === h0) p[n - 1][1] = T[1]; else p[n - 1][0] = T[0];
      const c = tidy([S, ...p, T], false);
      return c.length >= 2 ? c : [S, T];
    }
    // un point posé sur (ou dans) un bloc ne doit pas faire contourner ce bloc
    const inside = (b, q) => q[0] > b.x0 - 0.05 && q[0] < b.x1 + 0.05 && q[1] > b.y0 - 0.05 && q[1] < b.y1 + 0.05;
    const ob = obst.filter(b => !(free(na) && inside(b, S)) && !(free(nb) && inside(b, T)));
    return route(S, free(na) ? null : DIRS[w.a.p], T, free(nb) ? null : DIRS[w.b.p], ob);
  }

  function layout(sb, fontPt) {
    const lay = { o: Object.assign({}, DEF, sb.opts), boxes: {}, nodes: {}, paths: {} };
    sb.nodes.forEach(n => { lay.nodes[n.id] = n; lay.boxes[n.id] = boxOf(n, lay.o, fontPt); });
    const obst = sb.nodes.filter(n => n.t === 'bloc' || n.t === 'comp').map(n => lay.boxes[n.id]);
    sb.wires.forEach(w => { const p = wirePath(w, lay, obst); if (p) lay.paths[w.id] = p; });
    return lay;
  }

  // Segment qui porte le nom du signal : le premier, le dernier, ou le plus long segment horizontal
  function labelSeg(w, p) {
    const n = p.length - 1;
    if (w.lseg === 'first') return 0;
    if (w.lseg === 'last') return n - 1;
    let k = 0, best = -1;
    for (let i = 0; i < n; i++) {
      const hz = Math.abs(p[i][1] - p[i + 1][1]) < EPS, len = Math.abs(p[i][0] - p[i + 1][0]) + Math.abs(p[i][1] - p[i + 1][1]);
      const sc = len + (hz && len >= 1 ? 100 : 0);
      if (sc > best + 1e-9) { best = sc; k = i; }
    }
    return k;
  }

  /* ---------- Code TikZ ---------- */
  function toTikz(sb, fontPt, lay) {
    lay = lay || layout(sb, fontPt);
    const o = lay.o, B = lay.boxes, out = [];
    const P = p => '(' + r2(p[0]) + ',' + r2(p[1]) + ')';
    const opt = l => { l = l.filter(Boolean); return l.length ? '[' + l.join(', ') + ']' : ''; };
    const has = t => sb.nodes.some(n => n.t === t);
    const fs = FONT[o.font] || FONT.normal, croix = o.comp === 'croix';
    const po = ['>=' + (TIPS[o.tip] || 'latex'), 'line width=' + (LW[o.lw] || 0.6) + 'pt'];
    if (fs[1]) po.push('every node/.style={font=\\' + fs[1] + '}');
    if (has('bloc')) po.push('sbloc/.style={draw, rectangle, inner sep=4pt, align=center}');
    if (has('comp')) po.push('scomp/.style={draw, circle, inner sep=0pt, minimum size=' + (croix ? 0.8 : 0.6) + 'cm}');
    if (has('pt')) po.push('spt/.style={circle, fill, inner sep=0pt, minimum size=3.5pt}');
    out.push('\\begin{tikzpicture}[' + po.join(',\n  ') + ']');
    const of = t => sb.nodes.filter(n => n.t === t);
    of('cadre').forEach(n => {
      const b = B[n.id];
      const st = { tirets: 'dashed', plein: '', points: 'dotted' }[n.style || 'tirets'] || '';
      out.push('  \\draw' + opt([st, FILLS[n.fill] ? 'fill=' + FILLS[n.fill] : '']) + ' ' + P([b.x0, b.y0]) + ' rectangle ' + P([b.x1, b.y1]) + ';');
      const t = content({ latex: n.latex, mode: n.mode || 't' });
      if (t) out.push('  \\node[anchor=south west, inner sep=2pt, font=\\' + fs[2] + '] at ' + P([b.x0, b.y1]) + ' {' + t + '};');
    });
    of('bloc').forEach(n => {
      const b = B[n.id];
      out.push('  \\node' + opt(['sbloc', 'minimum width=' + r2(b.w) + 'cm', 'minimum height=' + r2(b.h) + 'cm', FILLS[n.fill] ? 'fill=' + FILLS[n.fill] : '', n.round ? 'rounded corners=3pt' : ''])
        + ' (' + n.id + ') at ' + P([n.x, n.y]) + ' {' + content(n, true) + '};');
    });
    of('comp').forEach(n => {
      out.push('  \\node[scomp] (' + n.id + ') at ' + P([n.x, n.y]) + ' {};');
      if (croix) out.push('  \\draw (' + n.id + '.north east) -- (' + n.id + '.south west) (' + n.id + '.north west) -- (' + n.id + '.south east);');
      const sg = n.signs || {};
      Object.keys(DIRS).forEach(p => {
        const s = sg[p] === '+' ? '+' : sg[p] === '-' ? '-' : '';
        if (!s) return;
        const d = DIRS[p];
        if (croix) out.push('  \\node[font=\\scriptsize, inner sep=0pt] at ' + P([n.x + d[0] * 0.25, n.y + d[1] * 0.25]) + ' {$' + s + '$};');
        else {
          // le signe se place contre le cercle, au-dessus (ou à gauche) de la flèche qui arrive
          const at = d[0] ? [n.x + d[0] * 0.34, n.y + 0.04] : [n.x - 0.04, n.y + d[1] * 0.34];
          const an = p === 'w' ? 'south east' : p === 'e' ? 'south west' : p === 'n' ? 'south east' : 'north east';
          out.push('  \\node[font=\\' + fs[2] + ', inner sep=1pt, anchor=' + an + '] at ' + P(at) + ' {$' + s + '$};');
        }
      });
    });
    of('pt').forEach(n => out.push('  \\node[spt] (' + n.id + ') at ' + P([n.x, n.y]) + ' {};'));
    of('ext').forEach(n => out.push('  \\coordinate (' + n.id + ') at ' + P([n.x, n.y]) + ';'));
    of('txt').forEach(n => { const t = content(n); if (t) out.push('  \\node[align=center, inner sep=4pt] (' + n.id + ') at ' + P([n.x, n.y]) + ' {' + t + '};'); });
    const ref = (n, p) => n.t === 'ext' ? '(' + n.id + ')' : n.t === 'pt' ? '(' + n.id + '.center)' : '(' + n.id + '.' + (ANCHOR[p] || 'east') + ')';
    sb.wires.forEach(w => {
      const p = lay.paths[w.id];
      if (!p) return;
      const na = lay.nodes[w.a.n], nb = lay.nodes[w.b.n];
      const lab = content(w), k = lab ? labelSeg(w, p) : -1;
      let s = '  \\draw' + opt([w.tip !== false && nb.t !== 'pt' ? '->' : '', w.dash ? 'dashed' : '']) + ' ' + ref(na, w.a.p);
      for (let i = 1; i < p.length; i++) {
        s += ' --';
        if (i - 1 === k) {
          const hz = Math.abs(p[i][1] - p[i - 1][1]) < EPS, bside = w.lside === 'b';
          s += ' node[' + (hz ? (bside ? 'below' : 'above') : (bside ? 'right' : 'left')) + '] {' + lab + '}';
        }
        s += ' ' + (i === p.length - 1 ? ref(nb, w.b.p) : P(p[i]));
      }
      out.push(s + ';');
    });
    out.push('\\end{tikzpicture}');
    return out.join('\n');
  }

  /* Rectangle englobant (cm) : [x0, y0, x1, y1], ou null si le schéma est vide */
  function bounds(sb, lay) {
    let bb = null;
    const grow = (x, y) => { bb = bb ? [Math.min(bb[0], x), Math.min(bb[1], y), Math.max(bb[2], x), Math.max(bb[3], y)] : [x, y, x, y]; };
    sb.nodes.forEach(n => { const b = lay.boxes[n.id]; grow(b.x0, b.y0); grow(b.x1, b.y1); });
    Object.values(lay.paths).forEach(p => p.forEach(q => grow(q[0], q[1])));
    return bb;
  }
  function shift(sb, dx, dy) {
    sb.nodes.forEach(n => { n.x = snap(n.x + dx); n.y = snap(n.y + dy); });
    sb.wires.forEach(w => { if (Array.isArray(w.pts)) w.pts = w.pts.map(q => [q[0] + dx, q[1] + dy]); });
  }
  // Ramène le schéma près de l'origine (coordonnées lisibles dans le code exporté)
  function normalize(sb, fontPt) {
    const bb = bounds(sb, layout(sb, fontPt));
    if (bb) shift(sb, -snap(bb[0]), -snap(bb[3]));
    return sb;
  }
  // Retire ce qui ne peut pas être dessiné (document abîmé ou fabriqué à la main)
  function repair(sb) {
    sb = sb && typeof sb === 'object' ? sb : {};
    const num = v => (typeof v === 'number' && isFinite(v)) ? Math.max(-500, Math.min(500, v)) : 0;
    const ids = new Set();
    sb.nodes = (Array.isArray(sb.nodes) ? sb.nodes : []).filter(n => n && typeof n === 'object' && /^[a-z]\w{0,11}$/i.test(n.id || '') && PREFIX[n.t] && !ids.has(n.id) && ids.add(n.id));
    sb.nodes.forEach(n => {
      n.x = num(n.x); n.y = num(n.y);
      ['w', 'h'].forEach(k => { if (n[k] !== undefined) n[k] = Math.max(0, Math.min(60, num(n[k]))); });
      if (n.latex !== undefined) n.latex = String(n.latex).slice(0, 600);
    });
    const byId = {};
    sb.nodes.forEach(n => { byId[n.id] = n; });
    const end = e => e && typeof e === 'object' && byId[e.n] && wired(byId[e.n]);
    sb.wires = (Array.isArray(sb.wires) ? sb.wires : []).filter(w => w && typeof w === 'object' && /^[a-z]\w{0,11}$/i.test(w.id || '') && !ids.has(w.id) && ids.add(w.id) && end(w.a) && end(w.b) && w.a.n !== w.b.n);
    sb.wires.forEach(w => {
      if (!DIRS[w.a.p]) w.a.p = 'e';
      if (!DIRS[w.b.p]) w.b.p = 'w';
      if (w.latex !== undefined) w.latex = String(w.latex).slice(0, 600);
      if (w.pts && !(Array.isArray(w.pts) && w.pts.length < 40 && w.pts.every(q => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1])))) delete w.pts;
    });
    sb.opts = sb.opts && typeof sb.opts === 'object' ? sb.opts : {};
    sb.v = 1;
    return sb;
  }

  /* ---------- Modèles ---------- */
  // nodes : [clé, type, x, y, propriétés] ; wires : ['clé.côté', 'clé.côté', nom du signal, propriétés]
  function build(nodes, wires, opts) {
    const sb = { v: 1, nodes: [], wires: [], opts: Object.assign({}, opts) }, ids = {};
    nodes.forEach(([k, t, x, y, extra]) => {
      const n = Object.assign({ id: newId(sb, t), t, x, y }, (t === 'bloc' || t === 'txt') ? { latex: '', mode: 'm' } : {}, extra);
      ids[k] = n.id;
      sb.nodes.push(n);
    });
    wires.forEach(([a, b, latex, extra]) => {
      const [an, ap] = a.split('.'), [bn, bp] = b.split('.');
      sb.wires.push(Object.assign({ id: newId(sb, 'wire'), a: { n: ids[an], p: ap || 'e' }, b: { n: ids[bn], p: bp || 'w' }, latex: latex || '', mode: 'm' }, extra));
    });
    return sb;
  }
  const PM = { w: '+', s: '-' };
  const TEMPLATES = [
    { key: 'vide', name: 'Schéma vide', desc: 'Partir de zéro', make: () => build([], []) },
    { key: 'unitaire', name: 'Boucle fermée', desc: 'Retour unitaire', make: () => build([
      ['e', 'ext', -0.25, 0], ['c', 'comp', 1.75, 0, { signs: PM }], ['b1', 'bloc', 4, 0, { latex: 'C(p)' }], ['b2', 'bloc', 6.75, 0, { latex: 'H(p)' }],
      ['p', 'pt', 8.5, 0], ['s', 'ext', 10, 0]],
    [['e', 'c.w', 'E(p)'], ['c.e', 'b1.w', '\\varepsilon(p)'], ['b1.e', 'b2.w', 'U(p)'], ['b2.e', 'p'], ['p', 's', 'S(p)'], ['p', 'c.s']]) },
    { key: 'capteur', name: 'Boucle avec capteur', desc: 'Bloc dans la chaîne de retour', make: () => build([
      ['e', 'ext', -0.25, 0], ['c', 'comp', 1.75, 0, { signs: PM }], ['b1', 'bloc', 4, 0, { latex: 'C(p)' }], ['b2', 'bloc', 6.75, 0, { latex: 'H(p)' }],
      ['p', 'pt', 8.5, 0], ['s', 'ext', 10, 0], ['b3', 'bloc', 5.25, -1.75, { latex: 'K(p)' }]],
    [['e', 'c.w', 'E(p)'], ['c.e', 'b1.w', '\\varepsilon(p)'], ['b1.e', 'b2.w', 'U(p)'], ['b2.e', 'p'], ['p', 's', 'S(p)'], ['p', 'b3.e'], ['b3.w', 'c.s', 'M(p)']]) },
    { key: 'perturbation', name: 'Avec perturbation', desc: 'Deuxième sommateur dans la chaîne directe', make: () => build([
      ['e', 'ext', -0.25, 0], ['c', 'comp', 1.75, 0, { signs: PM }], ['b1', 'bloc', 4, 0, { latex: 'C(p)' }], ['c2', 'comp', 6, 0, { signs: { w: '+', n: '-' } }],
      ['b2', 'bloc', 8, 0, { latex: 'H(p)' }], ['p', 'pt', 9.75, 0], ['s', 'ext', 11.25, 0], ['d', 'ext', 6, 1.5]],
    [['e', 'c.w', 'E(p)'], ['c.e', 'b1.w', '\\varepsilon(p)'], ['b1.e', 'c2.w'], ['c2.e', 'b2.w'], ['b2.e', 'p'], ['p', 's', 'S(p)'], ['p', 'c.s'], ['d', 'c2.n', 'P(p)', { lside: 'b' }]]) },
    { key: 'serie', name: 'Blocs en série', desc: 'Chaîne directe sans retour', make: () => build([
      ['e', 'ext', 0, 0], ['b1', 'bloc', 2.25, 0, { latex: 'H_1(p)' }], ['b2', 'bloc', 5, 0, { latex: 'H_2(p)' }], ['b3', 'bloc', 7.75, 0, { latex: 'H_3(p)' }], ['s', 'ext', 10, 0]],
    [['e', 'b1.w', 'E(p)'], ['b1.e', 'b2.w'], ['b2.e', 'b3.w'], ['b3.e', 's', 'S(p)']]) },
    { key: 'imbriquees', name: 'Boucles imbriquées', desc: 'Boucle interne et boucle externe', make: () => build([
      ['e', 'ext', -0.5, 0], ['c', 'comp', 1.5, 0, { signs: PM }], ['b1', 'bloc', 3.25, 0, { latex: 'C_1(p)' }], ['c2', 'comp', 5, 0, { signs: PM }],
      ['b2', 'bloc', 6.75, 0, { latex: 'C_2(p)' }], ['p1', 'pt', 8.25, 0], ['b3', 'bloc', 9.75, 0, { latex: 'H(p)' }], ['p2', 'pt', 11.25, 0], ['s', 'ext', 12.5, 0],
      ['b4', 'bloc', 6.75, -1.75, { latex: 'K(p)' }]],
    [['e', 'c.w', 'E(p)'], ['c.e', 'b1.w'], ['b1.e', 'c2.w'], ['c2.e', 'b2.w'], ['b2.e', 'p1'], ['p1', 'b3.w'], ['b3.e', 'p2'], ['p2', 's', 'S(p)'],
      ['p1', 'b4.e'], ['b4.w', 'c2.s'], ['p2', 'c.s']]) },
    { key: 'chaines', name: 'Chaîne fonctionnelle', desc: 'Chaînes d\'information et d\'énergie', make: () => {
      const T = (k, x, y, s) => [k, 'bloc', x, y, { latex: s, mode: 't', w: 2.25 }];
      return build([
        ['k1', 'cadre', 4.5, 3, { w: 9.5, h: 1.75, latex: 'Chaîne d\'information', mode: 't' }], ['k2', 'cadre', 4.5, 0, { w: 12, h: 1.75, latex: 'Chaîne d\'énergie', mode: 't' }],
        T('a', 1.5, 3, 'Acquérir'), T('t', 4.5, 3, 'Traiter'), T('c', 7.5, 3, 'Communiquer'),
        T('al', 0, 0, 'Alimenter'), T('d', 3, 0, 'Distribuer'), T('cv', 6, 0, 'Convertir'), T('tr', 9, 0, 'Transmettre'),
        ['e', 'ext', -3.5, 0], ['s', 'ext', 12.5, 0]],
      [['a.e', 't.w'], ['t.e', 'c.w'], ['al.e', 'd.w'], ['d.e', 'cv.w'], ['cv.e', 'tr.w'], ['t.s', 'd.n', 'Ordres', { mode: 't' }],
        ['e', 'al.w', 'Énergie', { mode: 't' }], ['tr.e', 's', 'Action', { mode: 't' }]]);
    } },
  ];

  /* ---------- Lien avec le document ---------- */
  const fontPtOf = meta => (L.TikZ && L.TikZ.fontPt) ? L.TikZ.fontPt(+(meta || {}).fontSize || 11) : 10.95;
  // Récrit le code TikZ du bloc à partir de son modèle
  function sync(block, meta) {
    if (!block || !block.sb) return block;
    block.code = toTikz(block.sb, fontPtOf(meta));
    return block;
  }
  L.newSchemaBloc = function (key) {
    const t = TEMPLATES.find(x => x.key === key) || TEMPLATES[1];
    const meta = (window.App && App.doc && App.doc.meta) || {};
    return sync(L.newBlock('tikz', { sb: normalize(t.make(), fontPtOf(meta)), code: '', scale: 1, caption: '', capMode: 'none' }), meta);
  };

  L.SB = { GRID, DIRS, DEF, FILLS, TEMPLATES, snap, free, wired, newId, content, boxOf, port, tidy, route, layout, labelSeg, toTikz, bounds, shift, normalize, repair, sync, fontPtOf, clearSizes: () => SIZES.clear() };
})();
