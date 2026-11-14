/* TikZ visuel (module complémentaire « tikzdraw ») : le modèle d'un dessin construit à la
   souris, et son code TikZ. Le bloc reste un bloc « tikz » ordinaire (aperçu, PDF, export
   LaTeX inchangés) qui garde son modèle dans b.td pour rester modifiable à la souris.
   Éditeur : js/tikzdraw-ui.js

   Modèle : td = { items: [...], opts: { tip, font } } — coordonnées en cm, y vers le haut.
   Éléments (champ t) :
     point   p, lab, lpos, shape (dot | cross | none)
     seg     p: [A, B], lab, lpos, lat (start | mid | end)   (segment, flèche, vecteur)
     line    p: [A, B, …], closed                 (ligne brisée, polygone)
     rect    p: [coin, coin opposé]
     circle  c, r          ellipse  c, r: [rx, ry]
     arc     c, r, a: [début, fin] (degrés), sector
     angle   p: [A, sommet, C], r, mk (auto | arc | droit), lab
     text    p, lab, size, frame
     grid    p: [coin, coin], step
     axes    o (origine, cm), x: [min, max], y: [min, max], u: [cm par unité x, y], s: [pas x, y],
             num, grid, names: [x, y], O, xpi
     func    ax (repère), expr (formule de l'utilisateur), d: [début, fin] (null : tout le repère)
   Style st : c (couleur), f (remplissage), w (épaisseur), d (tirets / points), a (flèches),
   sm (lissé), ro (coins arrondis). */
(function () {
  const EPS = 1e-9;
  const r2 = v => { const r = Math.round(v * 100) / 100; return String(Object.is(r, -0) ? 0 : r); };
  const r4 = v => { const r = Math.round(v * 10000) / 10000; return String(Object.is(r, -0) ? 0 : r); };
  const P = p => '(' + r2(p[0]) + ',' + r2(p[1]) + ')';
  const snap = (v, g) => { if (!g) return v; const r = Math.round(v / g) * g; return Math.abs(r) < EPS ? 0 : +r.toFixed(6); };
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const pt = (q, d) => Array.isArray(q) && q.length >= 2 ? [num(+q[0], d ? d[0] : 0), num(+q[1], d ? d[1] : 0)] : (d || [0, 0]).slice();

  /* ---------- Couleurs, traits ---------- */
  const COLORS = { noir: 'black', gris: 'gray', rouge: 'red!80!black', bleu: 'blue!75!black', vert: 'green!50!black', orange: 'orange!95!black', violet: 'violet', marron: 'brown!80!black' };
  const FILLS = { gris: 'black!10', bleu: 'blue!12', vert: 'green!15', jaune: 'yellow!35', orange: 'orange!25', rouge: 'red!15', violet: 'violet!15', noir: 'black' };
  const WIDTHS = { fin: 'thin', normal: '', epais: 'thick', tres: 'very thick' };   // trait normal : semithick (réglage du dessin)
  const DASHES = { tirets: 'dashed', points: 'dotted' };
  const TIPS = { stealth: 'stealth', latex: 'latex', simple: 'to' };
  const FONTS = { normal: '', small: 'small', footnotesize: 'footnotesize' };
  const SIZES = { small: 'small', normal: '', large: 'large', Large: 'Large' };
  const POS = ['above left', 'above', 'above right', 'left', 'center', 'right', 'below left', 'below', 'below right'];
  const DEF = { tip: 'stealth', font: 'normal' };
  const OPEN = { seg: 1, line: 1, arc: 1, func: 1 };          // chemins ouverts : flèches possibles
  const CLOSED = { rect: 1, circle: 1, ellipse: 1 };         // surfaces : remplissage possible

  /* ---------- Contenu d'un texte (formule ou texte) → TikZ ---------- */
  const balanced = s => {
    let d = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\') { i++; continue; }
      if (c === '{') d++; else if (c === '}' && --d < 0) return false;
    }
    return d === 0;
  };
  const escText = s => s.split(/(\$[^$]*\$)/).map((p, i) => i % 2 ? p : p.replace(/\\?([%&#_$])/g, '\\$1')).join('');
  function content(o) {
    if (!o) return '';
    let s = String(o.latex || '').replace(/\r/g, '').trim();
    if (!s) return '';
    if (o.mode === 't') {
      s = s.split('\n').map(l => escText(l.trim())).filter(Boolean).join(' \\\\ ');
      return balanced(s) ? s : s.replace(/\\?[{}]/g, '');
    }
    s = s.replace(/\n/g, ' ').replace(/\$/g, '').replace(/(^|[^\\])%/g, '$1\\%');
    if (!balanced(s)) s = s.replace(/\\?[{}]/g, '');
    return s ? '$' + s + '$' : '';
  }

  /* ---------- Formules des courbes ----------
     L'utilisateur écrit comme en maths : « 2x² − 3 », « 0,5x », « sin(x) » (radians),
     « e^(-x) », « √x », « 1/x ». La formule devient un arbre, calculé ici (vérifications)
     et récrit en expression TikZ sûre (le vrai LaTeX donne la même courbe). */
  const FUN = { sqrt: 1, sin: 1, cos: 1, tan: 1, exp: 1, ln: 1, log: 1, abs: 1, arcsin: 1, arccos: 1, arctan: 1 };
  const NAMES = ['arcsin', 'arccos', 'arctan', 'sqrt', 'sin', 'cos', 'tan', 'exp', 'ln', 'log', 'abs', 'pi', 'x', 'e'];
  function parseExpr(src) {
    const s = String(src || '').trim()
      .replace(/²/g, '^2').replace(/³/g, '^3').replace(/[×·∙]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-')
      .replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/(\d),(\d)/g, '$1.$2').replace(/\barc(sin|cos|tan)\b/gi, 'arc$1');
    if (!s) throw new Error('écrivez la formule de la fonction, par exemple x^2 - 1');
    const toks = [];
    let i = 0, m;
    while (i < s.length) {
      const c = s[i], rest = s.slice(i);
      if (/\s/.test(c)) { i++; continue; }
      if ((m = /^(\d+\.?\d*|\.\d+)/.exec(rest))) { toks.push({ k: 'n', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if ((m = /^[a-zA-Z]+/.exec(rest))) {
        let w = m[0].toLowerCase();
        i += m[0].length;
        while (w) {
          const name = NAMES.find(n => w.startsWith(n));
          if (!name) throw new Error('« ' + m[0] + ' » : je ne connais pas ce mot (variable : x)');
          toks.push({ k: 'id', v: name });
          w = w.slice(name.length);
        }
        continue;
      }
      if ('+-*/^()'.includes(c)) { toks.push({ k: c }); i++; continue; }
      throw new Error('caractère « ' + c + ' » inattendu');
    }
    // multiplications sous-entendues : 2x, 3(x+1), x sin(x), (x+1)(x-1)
    const t = [];
    toks.forEach(k => {
      const p = t[t.length - 1];
      const endsVal = p && (p.k === 'n' || p.k === ')' || (p.k === 'id' && !FUN[p.v]));
      const startsVal = k.k === 'n' || k.k === '(' || k.k === 'id';
      if (endsVal && startsVal) t.push({ k: '*' });
      t.push(k);
    });
    let j = 0;
    const peek = () => t[j] || {};
    const need = k => { if (peek().k !== k) throw new Error(k === ')' ? 'parenthèse « ) » manquante' : '« ' + k + ' » attendu'); j++; };
    function expr() {
      let a = term();
      while (peek().k === '+' || peek().k === '-') { const op = t[j++].k; a = { op, a, b: term() }; }
      return a;
    }
    function term() {
      let a = unary();
      while (peek().k === '*' || peek().k === '/') { const op = t[j++].k; a = { op, a, b: unary() }; }
      return a;
    }
    function unary() {
      if (peek().k === '-') { j++; return { neg: unary() }; }
      if (peek().k === '+') { j++; return unary(); }
      return power();
    }
    function power() {
      const b = call();
      if (peek().k === '^') { j++; return { op: '^', a: b, b: unary() }; }
      return b;
    }
    function call() {
      const k = peek();
      if (k.k === 'n') { j++; return { n: k.v }; }
      if (k.k === '(') { j++; const e = expr(); need(')'); return e; }
      if (k.k === 'id') {
        j++;
        if (FUN[k.v]) {
          if (peek().k !== '(' && peek().k !== 'n' && peek().k !== 'id') throw new Error(k.v + ' : il manque ce qui suit, par exemple ' + k.v + '(x)');
          return { f: k.v, a: power() };
        }
        return k.v === 'x' ? { x: 1 } : { c: k.v };
      }
      if (!t.length) throw new Error('formule vide');
      throw new Error(j >= t.length ? 'la formule s\'arrête trop tôt' : 'formule mal écrite près de « ' + (k.k === 'id' ? k.v : k.k) + ' »');
    }
    const tree = expr();
    if (j < t.length) throw new Error('formule mal écrite près de « ' + (peek().k === 'id' ? peek().v : peek().k === 'n' ? peek().v : peek().k) + ' »');
    return tree;
  }
  const JS = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, ln: Math.log, log: Math.log10, abs: Math.abs, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan };
  function evalTree(e, x) {
    if (e.n !== undefined) return e.n;
    if (e.x) return x;
    if (e.c) return e.c === 'pi' ? Math.PI : Math.E;
    if (e.neg) return -evalTree(e.neg, x);
    if (e.f) return JS[e.f](evalTree(e.a, x));
    const a = evalTree(e.a, x), b = evalTree(e.b, x);
    switch (e.op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return a / b;
      default: return Math.pow(a, b);
    }
  }
  // Expression TikZ (pgfmath) : angles en radians (« r »), \x toujours entre parenthèses
  function toPgf(e) {
    const atom = n => n.n !== undefined || n.x || n.c || n.f;
    const wrap = n => atom(n) && !(n.n !== undefined && n.n < 0) ? toPgf(n) : '(' + toPgf(n) + ')';
    if (e.n !== undefined) return r4(e.n);
    if (e.x) return '(\\x)';
    if (e.c) return e.c === 'pi' ? 'pi' : 'exp(1)';
    if (e.neg) return '(-' + wrap(e.neg) + ')';
    if (e.f) {
      const a = toPgf(e.a);
      if (e.f === 'sin' || e.f === 'cos' || e.f === 'tan') return e.f + '((' + a + ') r)';
      if (e.f === 'arcsin' || e.f === 'arccos' || e.f === 'arctan') return 'rad(a' + e.f.slice(3) + '(' + a + '))';
      if (e.f === 'log') return 'log10(' + a + ')';
      return e.f + '(' + a + ')';
    }
    if (e.op === '+' || e.op === '-') return toPgf(e.a) + e.op + (e.op === '-' && (e.b.op === '+' || e.b.op === '-') ? '(' + toPgf(e.b) + ')' : toPgf(e.b));
    if (e.op === '*' || e.op === '/') {
      const side = (n, right) => (n.op === '+' || n.op === '-' || (right && e.op === '/' && (n.op === '*' || n.op === '/'))) ? '(' + toPgf(n) + ')' : toPgf(n);
      return side(e.a) + e.op + side(e.b, true);
    }
    if (e.a.c === 'e') return 'exp(' + toPgf(e.b) + ')';
    return wrap(e.a) + '^' + wrap(e.b);
  }
  /* Formule → { ok, f (calcul), pgf (TikZ) } ou { ok: false, error } */
  const EXPRS = new Map();
  function compile(src) {
    const k = String(src || '');
    if (EXPRS.has(k)) return EXPRS.get(k);
    let r;
    try {
      const tree = parseExpr(k);
      r = { ok: true, f: x => evalTree(tree, x), pgf: toPgf(tree) };
    } catch (e) { r = { ok: false, error: e.message }; }
    if (EXPRS.size > 300) EXPRS.clear();
    EXPRS.set(k, r);
    return r;
  }

  /* ---------- Repères ---------- */
  const AXDEF = { o: [0, 0], x: [-1, 5], y: [-1, 4], u: [1, 1], s: [1, 1], num: true, grid: false, names: ['x', 'y'], O: true, xpi: false };
  const axOf = (td, id) => td.items.find(i => i.t === 'axes' && i.id === id) || null;
  // Coordonnées du repère → cm sur la feuille, et inversement
  const toCm = (ax, x, y) => [ax.o[0] + x * ax.u[0], ax.o[1] + y * ax.u[1]];
  const fromCm = (ax, X, Y) => [(X - ax.o[0]) / ax.u[0], (Y - ax.o[1]) / ax.u[1]];
  // Graduation lisible : 0,5 → « 0{,}5 » ; avec π : π/2, 3π/4…
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function tickLabel(v, pi) {
    if (pi) {
      const q = 12, p = Math.round(v * q), g = gcd(Math.abs(p), q) || 1, a = p / g, b = q / g;
      if (!a) return '0';
      const s = a < 0 ? '-' : '', n = Math.abs(a) === 1 ? '\\pi' : Math.abs(a) + '\\pi';
      return b === 1 ? s + n : s + '\\frac{' + n + '}{' + b + '}';
    }
    return r4(v).replace('.', '{,}');
  }
  function ticks(a0, a1, step) {
    const out = [];
    if (!(step > 0)) return out;
    const k0 = Math.ceil(a0 / step - 1e-9), k1 = Math.floor(a1 / step + 1e-9);
    if (k1 - k0 > 200) return out;
    for (let k = k0; k <= k1; k++) out.push(+(k * step).toFixed(9));
    return out;
  }

  /* Morceaux d'une courbe : on s'arrête aux valeurs interdites (ln(0), 1/0…) et l'on coupe
     aux asymptotes ; chaque morceau dépasse un peu du repère, qui le découpe (\clip). */
  function pieces(f, d0, d1, lo, hi) {
    const N = 240, ok = x => { const y = f(x); return isFinite(y) && y >= lo && y <= hi; };
    const xs = [], good = [];
    for (let k = 0; k <= N; k++) { const x = d0 + (d1 - d0) * k / N; xs.push(x); good.push(ok(x)); }
    const edge = (a, b) => { for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (ok(m)) b = m; else a = m; } return b; };   // a mauvais, b bon
    const out = [];
    let k = 0, bad = 0;
    while (k <= N) {
      if (!good[k]) { bad++; k++; continue; }
      let s = k;
      while (k < N && good[k + 1]) {
        // un saut énorme entre deux points voisins : asymptote verticale (tan, 1/x…)
        const y0 = f(xs[k]), y1 = f(xs[k + 1]);
        if (Math.abs(y1 - y0) > (hi - lo) * 0.45) break;
        k++;
      }
      const a = s > 0 ? edge(xs[s - 1], xs[s]) : xs[s];
      const b = k < N ? edge(xs[k + 1], xs[k]) : xs[k];
      if (b - a > (d1 - d0) * 1e-4) out.push([a, b]);
      k++;
    }
    return { parts: out, bad };
  }

  /* ---------- Code TikZ ---------- */
  function sopts(it, extra) {
    const st = it.st || {}, o = [];
    if (st.c && COLORS[st.c] && st.c !== 'noir') o.push(COLORS[st.c]);
    if (WIDTHS[st.w]) o.push(WIDTHS[st.w]);
    if (DASHES[st.d]) o.push(DASHES[st.d]);
    if (OPEN[it.t] && st.a && /^(->|<-|<->)$/.test(st.a)) o.push(st.a);
    if (st.f && FILLS[st.f] && (CLOSED[it.t] || (it.t === 'line' && it.closed) || (it.t === 'arc' && it.sector) || (it.t === 'text' && it.frame))) o.push('fill=' + FILLS[st.f]);
    if (st.ro && (it.t === 'rect' || (it.t === 'line' && !st.sm))) o.push('rounded corners=3pt');
    return o.concat(extra || []);
  }
  const opt = l => { l = l.filter(Boolean); return l.length ? '[' + l.join(', ') + ']' : ''; };
  const labelColor = it => (it.st && it.st.c && it.st.c !== 'noir' && COLORS[it.st.c] ? 'text=' + COLORS[it.st.c] : '');

  function axesCode(ax, out) {
    const [x0, x1] = ax.x, [y0, y1] = ax.y, [ux, uy] = ax.u;
    const sx = ax.s[0] * (ax.xpi ? Math.PI : 1), sy = ax.s[1];
    const X = x => r2(ax.o[0] + x * ux), Y = y => r2(ax.o[1] + y * uy);
    const col = ax.st && ax.st.c && ax.st.c !== 'noir' && COLORS[ax.st.c] ? COLORS[ax.st.c] : '';
    if (ax.grid) {
      out.push('  \\begin{scope}[shift={' + P(ax.o) + '}]');
      out.push('    \\draw[step={(' + r4(sx * ux) + ',' + r4(sy * uy) + ')}, gray!35, very thin] (' + r2(x0 * ux) + ',' + r2(y0 * uy) + ') grid (' + r2(x1 * ux) + ',' + r2(y1 * uy) + ');');
      out.push('  \\end{scope}');
    }
    const n = ax.names || [];
    const name = (s, mode) => content({ latex: s, mode: mode || 'm' });
    out.push('  \\draw' + opt(['->', col]) + ' (' + X(x0) + ',' + Y(0 > y0 && 0 < y1 ? 0 : y0) + ') -- (' + X(x1) + ',' + Y(0 > y0 && 0 < y1 ? 0 : y0) + ')' + (n[0] ? ' node[right] {' + name(n[0]) + '}' : '') + ';');
    out.push('  \\draw' + opt(['->', col]) + ' (' + X(0 > x0 && 0 < x1 ? 0 : x0) + ',' + Y(y0) + ') -- (' + X(0 > x0 && 0 < x1 ? 0 : x0) + ',' + Y(y1) + ')' + (n[1] ? ' node[above] {' + name(n[1]) + '}' : '') + ';');
    const ay = 0 > y0 && 0 < y1 ? 0 : y0, axx = 0 > x0 && 0 < x1 ? 0 : x0;
    const tx = ticks(x0, x1, sx).filter(v => Math.abs(v - axx) > 1e-9 && v < x1 - sx * 0.3);
    const ty = ticks(y0, y1, sy).filter(v => Math.abs(v - ay) > 1e-9 && v < y1 - sy * 0.3);
    // graduations : \pos = position sur la feuille (cm), \lab = nombre écrit
    // (pas \t ni \l : ce sont déjà des commandes de LaTeX)
    const lab = v => ax.num ? '/{' + v + '}' : '';
    const nodeOpt = (side, big) => ax.num ? ' node[' + side + (big ? '' : ', font=\\footnotesize') + ', inner sep=2pt] {$\\lab$}' : '';
    const yA = +Y(ay), xA = +X(axx);
    if (tx.length) {
      out.push('  \\foreach \\pos' + (ax.num ? '/\\lab' : '') + ' in {' + tx.map(v => X(v) + lab(tickLabel(ax.xpi ? v / Math.PI : v, ax.xpi))).join(', ') + '}');
      out.push('    \\draw' + opt([col]) + ' (\\pos,' + r2(yA + 0.07) + ') -- (\\pos,' + r2(yA - 0.07) + ')' + nodeOpt('below', ax.xpi) + ';');
    }
    if (ty.length) {
      out.push('  \\foreach \\pos' + (ax.num ? '/\\lab' : '') + ' in {' + ty.map(v => Y(v) + lab(tickLabel(v))).join(', ') + '}');
      out.push('    \\draw' + opt([col]) + ' (' + r2(xA + 0.07) + ',\\pos) -- (' + r2(xA - 0.07) + ',\\pos)' + nodeOpt('left') + ';');
    }
    if (ax.O && axx === 0 && ay === 0) out.push('  \\node[below left, inner sep=2pt] at ' + P(ax.o) + ' {$O$};');
  }
  /* Une courbe : morceaux continus, découpés au repère */
  function funcCode(td, it, out) {
    const ax = axOf(td, it.ax) || Object.assign({}, AXDEF, { o: [0, 0], x: [-5, 5], y: [-5, 5] });
    const c = compile(it.expr);
    if (!c.ok) return;
    const d0 = it.d ? it.d[0] : ax.x[0], d1 = it.d ? it.d[1] : ax.x[1];
    if (!(d1 > d0)) return;
    const h = ax.y[1] - ax.y[0], ps = pieces(c.f, d0, d1, ax.y[0] - h, ax.y[1] + h).parts;
    if (!ps.length) return;
    const xs = ax.u[0] === 1 && !ax.o[0] ? '\\x' : r2(ax.o[0]) + '+' + r4(ax.u[0]) + '*\\x';
    const ys = (ax.u[1] === 1 ? '' : r4(ax.u[1]) + '*') + '(' + c.pgf + ')';
    const yfull = ax.o[1] ? r2(ax.o[1]) + '+' + ys : ys;
    const [cx0, cy0] = toCm(ax, ax.x[0], ax.y[0]), [cx1, cy1] = toCm(ax, ax.x[1], ax.y[1]);
    out.push('  \\begin{scope}');
    out.push('    \\clip (' + r2(cx0) + ',' + r2(cy0) + ') rectangle (' + r2(cx1) + ',' + r2(cy1) + ');');
    ps.forEach(([a, b]) => {
      const n = Math.max(25, Math.min(160, Math.round(160 * (b - a) / (d1 - d0))));
      out.push('    \\draw' + opt(sopts(it, ['domain=' + r4(a) + ':' + r4(b), 'samples=' + n, 'smooth', 'variable=\\x'])) + ' plot ({' + xs + '}, {' + yfull + '});');
    });
    out.push('  \\end{scope}');
    if (it.lab && content(it.lab)) {
      // nom de la courbe (𝒞f…) près de son extrémité droite visible
      const last = ps[ps.length - 1];
      let x = last[1];
      for (let k = 0; k < 60; k++) { const y = c.f(x); if (isFinite(y) && y >= ax.y[0] && y <= ax.y[1] && x <= ax.x[1]) break; x -= (last[1] - last[0]) / 60; }
      const y = c.f(x);
      if (isFinite(y)) out.push('  \\node' + opt([it.lpos || 'above left', labelColor(it)]) + ' at ' + P(toCm(ax, x, y)) + ' {' + content(it.lab) + '};');
    }
  }
  function angleGeom(it) {
    const [A, B, C] = it.p;
    const t1 = Math.atan2(A[1] - B[1], A[0] - B[0]) * 180 / Math.PI, t2 = Math.atan2(C[1] - B[1], C[0] - B[0]) * 180 / Math.PI;
    let a = t1, d = ((t2 - t1) % 360 + 360) % 360;
    if (d > 180) { a = t2; d = 360 - d; }
    const right = it.mk === 'droit' || (it.mk !== 'arc' && Math.abs(d - 90) < 0.6);
    return { a, d, right };
  }
  function itemCode(td, it, out) {
    const st = it.st || {};
    switch (it.t) {
      case 'point': {
        const col = st.c && st.c !== 'noir' && COLORS[st.c] ? COLORS[st.c] : '';
        if (it.shape === 'cross') out.push('  \\draw' + opt([col, 'thick']) + ' ' + P([it.p[0] - 0.08, it.p[1] - 0.08]) + ' -- ' + P([it.p[0] + 0.08, it.p[1] + 0.08]) + ' ' + P([it.p[0] - 0.08, it.p[1] + 0.08]) + ' -- ' + P([it.p[0] + 0.08, it.p[1] - 0.08]) + ';');
        else if (it.shape !== 'none') out.push('  \\fill' + opt([col]) + ' ' + P(it.p) + ' circle (1.6pt);');
        const t = content(it.lab);
        if (t) out.push('  \\node' + opt([it.lpos || 'above right', labelColor(it)]) + ' at ' + P(it.p) + ' {' + t + '};');
        break;
      }
      case 'seg': {
        const t = content(it.lab);
        out.push('  \\draw' + opt(sopts(it)) + ' ' + P(it.p[0]) + ' -- ' + P(it.p[1]) + (t ? ' node' + opt([it.lat === 'end' ? 'pos=1' : it.lat === 'start' ? 'pos=0' : 'midway', it.lpos || 'above', labelColor(it)]) + ' {' + t + '}' : '') + ';');
        break;
      }
      case 'line': {
        if (it.p.length < 2) break;
        if (st.sm && !it.closed && it.p.length > 2) out.push('  \\draw' + opt(sopts(it, ['smooth'])) + ' plot coordinates {' + it.p.map(P).join(' ') + '};');
        else out.push('  \\draw' + opt(sopts(it)) + ' ' + it.p.map(P).join(' -- ') + (it.closed ? ' -- cycle' : '') + ';');
        break;
      }
      case 'rect': out.push('  \\draw' + opt(sopts(it)) + ' ' + P(it.p[0]) + ' rectangle ' + P(it.p[1]) + ';'); break;
      case 'circle': out.push('  \\draw' + opt(sopts(it)) + ' ' + P(it.c) + ' circle (' + r2(it.r) + ');'); break;
      case 'ellipse': out.push('  \\draw' + opt(sopts(it)) + ' ' + P(it.c) + ' ellipse (' + r2(it.r[0]) + ' and ' + r2(it.r[1]) + ');'); break;
      case 'arc': {
        const [a0, a1] = it.a, s = [it.c[0] + it.r * Math.cos(a0 * Math.PI / 180), it.c[1] + it.r * Math.sin(a0 * Math.PI / 180)];
        out.push('  \\draw' + opt(sopts(it)) + ' ' + (it.sector ? P(it.c) + ' -- ' : '') + P(s) + ' arc (' + r2(a0) + ':' + r2(a1) + ':' + r2(it.r) + ')' + (it.sector ? ' -- cycle' : '') + ';');
        break;
      }
      case 'angle': {
        const g = angleGeom(it), B = it.p[1], r = it.r || 0.5, rad = Math.PI / 180;
        const u = [Math.cos(g.a * rad), Math.sin(g.a * rad)], v = [Math.cos((g.a + g.d) * rad), Math.sin((g.a + g.d) * rad)];
        const fill = st.f && FILLS[st.f] ? FILLS[st.f] : '';
        const lineOpts = sopts(Object.assign({}, it, { st: Object.assign({}, st, { f: '' }) }));
        if (g.right) {
          const q = Math.min(r, 0.35), p1 = [B[0] + u[0] * q, B[1] + u[1] * q], p3 = [B[0] + v[0] * q, B[1] + v[1] * q], p2 = [p1[0] + v[0] * q, p1[1] + v[1] * q];
          if (fill) out.push('  \\fill[' + fill + '] ' + P(B) + ' -- ' + P(p1) + ' -- ' + P(p2) + ' -- ' + P(p3) + ' -- cycle;');
          out.push('  \\draw' + opt(lineOpts) + ' ' + P(p1) + ' -- ' + P(p2) + ' -- ' + P(p3) + ';');
        } else {
          const s = [B[0] + u[0] * r, B[1] + u[1] * r];
          if (fill) out.push('  \\fill[' + fill + '] ' + P(B) + ' -- ' + P(s) + ' arc (' + r2(g.a) + ':' + r2(g.a + g.d) + ':' + r2(r) + ') -- cycle;');
          out.push('  \\draw' + opt(lineOpts) + ' ' + P(s) + ' arc (' + r2(g.a) + ':' + r2(g.a + g.d) + ':' + r2(r) + ');');
          if (it.dbl) { const r1 = r + 0.08, s1 = [B[0] + u[0] * r1, B[1] + u[1] * r1]; out.push('  \\draw' + opt(lineOpts) + ' ' + P(s1) + ' arc (' + r2(g.a) + ':' + r2(g.a + g.d) + ':' + r2(r1) + ');'); }
        }
        const t = content(it.lab);
        if (t) {
          const m = (g.a + g.d / 2) * rad, R = (g.right ? Math.min(r, 0.35) * 1.4 : r) + 0.3;
          out.push('  \\node' + opt([labelColor(it)]) + ' at ' + P([B[0] + Math.cos(m) * R, B[1] + Math.sin(m) * R]) + ' {' + t + '};');
        }
        break;
      }
      case 'text': {
        const t = content(it.lab);
        if (!t) break;
        const o = [labelColor(it), SIZES[it.size] ? 'font=\\' + SIZES[it.size] : '', it.lab.mode === 't' && /\n/.test(it.lab.latex || '') ? 'align=center' : ''];
        if (it.frame) o.push('draw', 'rounded corners=2pt', 'inner sep=4pt', st.f && FILLS[st.f] ? 'fill=' + FILLS[st.f] : '', st.c && st.c !== 'noir' && COLORS[st.c] ? 'draw=' + COLORS[st.c] : '', WIDTHS[st.w] || '', DASHES[st.d] || '');
        out.push('  \\node' + opt(o) + ' at ' + P(it.p) + ' {' + t + '};');
        break;
      }
      case 'grid': {
        const o = [st.c && COLORS[st.c] ? COLORS[st.c] + (st.c === 'noir' ? '' : '!60') : 'gray!60', WIDTHS[st.w] || 'very thin', DASHES[st.d] || '', 'step=' + r2(it.step || 0.5)];
        out.push('  \\draw' + opt(o) + ' ' + P(it.p[0]) + ' grid ' + P(it.p[1]) + ';');
        break;
      }
      case 'axes': axesCode(it, out); break;
      case 'func': funcCode(td, it, out); break;
      default: break;
    }
  }
  function toTikz(td) {
    const o = Object.assign({}, DEF, td.opts || {});
    const po = ['>=' + (TIPS[o.tip] || 'stealth'), 'semithick', 'line cap=round', 'line join=round'];
    if (FONTS[o.font]) po.push('every node/.style={font=\\' + FONTS[o.font] + '}');
    const out = ['\\begin{tikzpicture}[' + po.join(', ') + ']'];
    td.items.forEach(it => { try { itemCode(td, it, out); } catch (e) { /* élément illisible : ignoré */ } });
    out.push('\\end{tikzpicture}');
    return out.join('\n');
  }

  /* ---------- Modèle : identifiants, réparation d'un modèle reçu ---------- */
  const PREFIX = { point: 'P', seg: 'S', line: 'L', rect: 'R', circle: 'C', ellipse: 'E', arc: 'A', angle: 'N', text: 'T', grid: 'G', axes: 'X', func: 'F' };
  function newId(td, t) {
    const p = PREFIX[t] || 'I', used = new Set(td.items.map(i => i.id));
    let k = 1;
    while (used.has(p + k)) k++;
    return p + k;
  }
  // Prochaine lettre libre pour nommer un point : A, B, C… puis A₁…
  function nextLetter(td) {
    const used = new Set(td.items.filter(i => i.t === 'point' && i.lab).map(i => String(i.lab.latex || '').trim()));
    for (let k = 0; k < 26 * 4; k++) {
      const l = String.fromCharCode(65 + (k % 26)) + (k >= 26 ? '_' + Math.floor(k / 26) : '');
      if (l === 'O' && k < 26) continue;
      if (!used.has(l)) return l;
    }
    return '';
  }
  const lab = (o, mode) => (o && typeof o === 'object' ? { latex: String(o.latex || '').slice(0, 2000), mode: o.mode === 't' ? 't' : 'm' } : { latex: '', mode: mode || 'm' });
  function repair(td) {
    td = td && typeof td === 'object' ? td : {};
    const out = { items: [], opts: {} };
    const o = td.opts && typeof td.opts === 'object' ? td.opts : {};
    if (TIPS[o.tip]) out.opts.tip = o.tip;
    if (FONTS[o.font] !== undefined) out.opts.font = o.font;
    if (typeof o.snap === 'number' && o.snap >= 0 && o.snap <= 2) out.opts.snap = o.snap;
    if (o.magnet === false) out.opts.magnet = false;
    if (o.autoname === false) out.opts.autoname = false;
    const seen = new Set();
    (Array.isArray(td.items) ? td.items : []).slice(0, 2000).forEach(x => {
      if (!x || typeof x !== 'object' || !PREFIX[x.t]) return;
      const it = { id: typeof x.id === 'string' && /^[A-Za-z0-9_]{1,12}$/.test(x.id) && !seen.has(x.id) ? x.id : null, t: x.t };
      const s = x.st && typeof x.st === 'object' ? x.st : {};
      it.st = {};
      if (COLORS[s.c]) it.st.c = s.c;
      if (FILLS[s.f]) it.st.f = s.f;
      if (WIDTHS[s.w] !== undefined) it.st.w = s.w;
      if (DASHES[s.d]) it.st.d = s.d;
      if (/^(->|<-|<->)$/.test(s.a || '')) it.st.a = s.a;
      if (s.sm) it.st.sm = true;
      if (s.ro) it.st.ro = true;
      switch (x.t) {
        case 'point': it.p = pt(x.p); it.lab = lab(x.lab); it.lpos = POS.includes(x.lpos) ? x.lpos : 'above right'; it.shape = ['dot', 'cross', 'none'].includes(x.shape) ? x.shape : 'dot'; break;
        case 'seg': it.p = [pt(x.p && x.p[0]), pt(x.p && x.p[1], [1, 0])]; it.lab = lab(x.lab); it.lpos = POS.includes(x.lpos) ? x.lpos : 'above'; it.lat = ['start', 'end'].includes(x.lat) ? x.lat : 'mid'; break;
        case 'line': it.p = (Array.isArray(x.p) ? x.p : []).slice(0, 500).map(q => pt(q)); it.closed = !!x.closed; if (it.p.length < 2) return; break;
        case 'rect': case 'grid': it.p = [pt(x.p && x.p[0]), pt(x.p && x.p[1], [1, 1])]; if (x.t === 'grid') it.step = Math.max(0.1, Math.min(5, num(+x.step, 0.5))); break;
        case 'circle': it.c = pt(x.c); it.r = Math.max(0.02, Math.min(100, num(+x.r, 1))); break;
        case 'ellipse': it.c = pt(x.c); it.r = [Math.max(0.02, num(+(x.r && x.r[0]), 1.5)), Math.max(0.02, num(+(x.r && x.r[1]), 1))]; break;
        case 'arc': it.c = pt(x.c); it.r = Math.max(0.02, Math.min(100, num(+x.r, 1))); it.a = [num(+(x.a && x.a[0]), 0), num(+(x.a && x.a[1]), 90)]; it.sector = !!x.sector; break;
        case 'angle': it.p = [pt(x.p && x.p[0], [1, 0]), pt(x.p && x.p[1]), pt(x.p && x.p[2], [0, 1])]; it.r = Math.max(0.1, Math.min(5, num(+x.r, 0.5))); it.mk = ['auto', 'arc', 'droit'].includes(x.mk) ? x.mk : 'auto'; it.dbl = !!x.dbl; it.lab = lab(x.lab); break;
        case 'text': it.p = pt(x.p); it.lab = lab(x.lab, 't'); it.size = SIZES[x.size] !== undefined ? x.size : 'normal'; it.frame = !!x.frame; break;
        case 'axes': {
          const d = AXDEF;
          it.o = pt(x.o, d.o);
          it.x = [num(+(x.x && x.x[0]), d.x[0]), num(+(x.x && x.x[1]), d.x[1])];
          it.y = [num(+(x.y && x.y[0]), d.y[0]), num(+(x.y && x.y[1]), d.y[1])];
          if (!(it.x[1] > it.x[0])) it.x = d.x.slice();
          if (!(it.y[1] > it.y[0])) it.y = d.y.slice();
          it.u = [Math.max(0.01, Math.min(20, num(+(x.u && x.u[0]), 1))), Math.max(0.01, Math.min(20, num(+(x.u && x.u[1]), 1)))];
          it.s = [Math.max(0.01, num(+(x.s && x.s[0]), 1)), Math.max(0.01, num(+(x.s && x.s[1]), 1))];
          it.num = x.num !== false; it.grid = !!x.grid; it.O = x.O !== false; it.xpi = !!x.xpi;
          it.names = [String((x.names && x.names[0]) ?? 'x').slice(0, 60), String((x.names && x.names[1]) ?? 'y').slice(0, 60)];
          break;
        }
        case 'func':
          it.ax = typeof x.ax === 'string' ? x.ax : null;
          it.expr = String(x.expr || '').slice(0, 300);
          it.d = Array.isArray(x.d) && isFinite(+x.d[0]) && isFinite(+x.d[1]) && +x.d[1] > +x.d[0] ? [+x.d[0], +x.d[1]] : null;
          it.lab = lab(x.lab); it.lpos = POS.includes(x.lpos) ? x.lpos : 'above left';
          break;
        default: return;
      }
      if (!it.id) it.id = newId(out, x.t);
      seen.add(it.id);
      out.items.push(it);
    });
    // une courbe sans repère n'a plus de sens
    out.items = out.items.filter(i => i.t !== 'func' || axOf(out, i.ax));
    return out;
  }

  /* Points remarquables (aimant de la souris, poignées) */
  function keyPoints(it) {
    switch (it.t) {
      case 'point': case 'text': return [it.p];
      case 'seg': case 'line': case 'rect': case 'grid': return it.p.concat(it.t === 'rect' || it.t === 'grid' ? [[it.p[0][0], it.p[1][1]], [it.p[1][0], it.p[0][1]]] : []).concat(it.t === 'seg' ? [[(it.p[0][0] + it.p[1][0]) / 2, (it.p[0][1] + it.p[1][1]) / 2]] : []);
      case 'circle': case 'ellipse': return [it.c];
      case 'arc': { const q = a => [it.c[0] + it.r * Math.cos(a * Math.PI / 180), it.c[1] + it.r * Math.sin(a * Math.PI / 180)]; return [it.c, q(it.a[0]), q(it.a[1])]; }
      case 'angle': return [];
      case 'axes': return [it.o];
      default: return [];
    }
  }
  /* Déplacer un élément (les courbes suivent leur repère) */
  function shift(it, dx, dy) {
    const m = q => { q[0] += dx; q[1] += dy; };
    if (it.p) { if (Array.isArray(it.p[0])) it.p.forEach(m); else m(it.p); }
    if (it.c) m(it.c);
    if (it.o) m(it.o);
  }

  /* ---------- Modèles prêts ---------- */
  const T = (latex, mode) => ({ latex, mode: mode || 'm' });
  const ptI = (id, x, y, l, lpos, st) => ({ id, t: 'point', p: [x, y], lab: T(l), lpos: lpos || 'above right', shape: 'dot', st: st || {} });
  const TEMPLATES = [
    { key: 'vide', name: 'Dessin vide', desc: 'Partir de zéro', make: () => ({ items: [], opts: {} }) },
    { key: 'parabole', name: 'Repère et parabole', desc: 'Courbe de x², repère gradué', make: () => ({ items: [
      Object.assign({ id: 'X1', t: 'axes', st: {} }, AXDEF, { o: [0, 0], x: [-3, 3], y: [-1, 5], grid: true }),
      { id: 'F1', t: 'func', ax: 'X1', expr: 'x^2/2', d: null, lab: T('\\mathcal{C}_f'), lpos: 'right', st: { c: 'bleu', w: 'epais' } }], opts: {} }) },
    { key: 'trigo', name: 'Fonctions sinus et cosinus', desc: 'Graduations en π', make: () => ({ items: [
      Object.assign({ id: 'X1', t: 'axes', st: {} }, AXDEF, { o: [0, 0], x: [-3.6, 7], y: [-1.5, 1.6], u: [1, 1.5], s: [0.5, 0.5], xpi: true, grid: true }),
      { id: 'F1', t: 'func', ax: 'X1', expr: 'sin(x)', d: null, lab: T('\\sin'), lpos: 'above', st: { c: 'bleu', w: 'epais' } },
      { id: 'F2', t: 'func', ax: 'X1', expr: 'cos(x)', d: null, lab: T('\\cos'), lpos: 'below', st: { c: 'rouge', w: 'epais', d: 'tirets' } }], opts: {} }) },
    { key: 'triangle', name: 'Triangle ABC', desc: 'Points nommés, angle marqué', make: () => ({ items: [
      { id: 'L1', t: 'line', p: [[0, 0], [5, 0], [1.5, 3]], closed: true, st: { f: 'bleu' } },
      ptI('P1', 0, 0, 'A', 'below left'), ptI('P2', 5, 0, 'B', 'below right'), ptI('P3', 1.5, 3, 'C', 'above'),
      { id: 'N1', t: 'angle', p: [[5, 0], [0, 0], [1.5, 3]], r: 0.7, mk: 'auto', lab: T('\\alpha'), st: { c: 'rouge' } }], opts: {} }) },
    { key: 'rectangle', name: 'Triangle rectangle', desc: 'Angle droit et longueurs', make: () => ({ items: [
      { id: 'L1', t: 'line', p: [[0, 0], [4, 0], [0, 3]], closed: true, st: {} },
      ptI('P1', 0, 0, 'A', 'below left'), ptI('P2', 4, 0, 'B', 'below right'), ptI('P3', 0, 3, 'C', 'above left'),
      { id: 'N1', t: 'angle', p: [[4, 0], [0, 0], [0, 3]], r: 0.4, mk: 'auto', lab: T(''), st: {} },
      { id: 'T1', t: 'text', p: [2, -0.45], lab: T('4\\text{ cm}'), size: 'normal', frame: false, st: {} },
      { id: 'T2', t: 'text', p: [2.45, 1.75], lab: T('5\\text{ cm}'), size: 'normal', frame: false, st: {} }], opts: {} }) },
    { key: 'cercle', name: 'Cercle trigonométrique', desc: 'Point M, angle θ, projections', make: () => {
      const a = 50 * Math.PI / 180, R = 2.5, M = [R * Math.cos(a), R * Math.sin(a)];
      return { items: [
        Object.assign({ id: 'X1', t: 'axes', st: {} }, AXDEF, { o: [0, 0], x: [-1.3, 1.4], y: [-1.3, 1.4], u: [R, R], s: [1, 1], num: true, O: true }),
        { id: 'C1', t: 'circle', c: [0, 0], r: R, st: { c: 'bleu', w: 'epais' } },
        { id: 'S1', t: 'seg', p: [[0, 0], M], lab: T(''), lpos: 'above', st: {} },
        { id: 'S2', t: 'seg', p: [M, [M[0], 0]], lab: T(''), lpos: 'right', st: { d: 'tirets', c: 'gris' } },
        { id: 'S3', t: 'seg', p: [M, [0, M[1]]], lab: T(''), lpos: 'above', st: { d: 'tirets', c: 'gris' } },
        { id: 'N1', t: 'angle', p: [[R, 0], [0, 0], M], r: 0.8, mk: 'arc', lab: T('\\theta'), st: { c: 'rouge' } },
        ptI('P1', M[0], M[1], 'M', 'above right'),
        { id: 'T1', t: 'text', p: [M[0], -0.5], lab: T('\\cos\\theta'), size: 'small', frame: false, st: { c: 'rouge' } },
        { id: 'T2', t: 'text', p: [-0.6, M[1]], lab: T('\\sin\\theta'), size: 'small', frame: false, st: { c: 'rouge' } }], opts: {} };
    } },
    { key: 'forces', name: 'Forces sur un objet', desc: 'Vecteurs nommés (physique)', make: () => ({ items: [
      { id: 'R1', t: 'rect', p: [[-1, -0.6], [1, 0.6]], st: { f: 'gris' } },
      { id: 'S1', t: 'seg', p: [[0, 0], [0, -2.2]], lab: T('\\vec{P}'), lpos: 'right', st: { a: '->', c: 'rouge', w: 'epais' } },
      { id: 'S2', t: 'seg', p: [[0, 0.6], [0, 2.4]], lab: T('\\vec{R}'), lpos: 'right', st: { a: '->', c: 'bleu', w: 'epais' } },
      { id: 'S3', t: 'seg', p: [[1, 0], [3, 0]], lab: T('\\vec{F}'), lpos: 'above', st: { a: '->', c: 'vert', w: 'epais' } },
      ptI('P1', 0, 0, 'G', 'above left'),
      { id: 'S4', t: 'seg', p: [[-3, -0.6], [4, -0.6]], lab: T(''), lpos: 'above', st: { w: 'epais' } }], opts: {} }) },
    { key: 'plan', name: 'Plan incliné', desc: 'Solide sur une pente, angle α', make: () => {
      const a = 25 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), along = (d, h) => [d * c - h * s, d * s + h * c];
      const b0 = along(2.6, 0), b1 = along(4.2, 0), b2 = along(4.2, 1), b3 = along(2.6, 1), g = along(3.4, 0.5);
      return { items: [
        { id: 'L1', t: 'line', p: [[0, 0], [7, 0], along(7 / c, 0)], closed: true, st: { f: 'gris' } },
        { id: 'L2', t: 'line', p: [b0, b1, b2, b3], closed: true, st: { f: 'bleu' } },
        { id: 'N1', t: 'angle', p: [[7, 0], [0, 0], along(7 / c, 0)], r: 1.3, mk: 'arc', lab: T('\\alpha'), st: {} },
        { id: 'S1', t: 'seg', p: [g, [g[0], g[1] - 2]], lab: T('\\vec{P}'), lpos: 'right', st: { a: '->', c: 'rouge', w: 'epais' } },
        ptI('P1', g[0], g[1], 'G', 'above left')], opts: {} };
    } },
    { key: 'lentille', name: 'Lentille convergente', desc: 'Axe optique, foyers, objet', make: () => ({ items: [
      { id: 'S1', t: 'seg', p: [[-6, 0], [6, 0]], lab: T('\\Delta'), lpos: 'above left', lat: 'end', st: { a: '->' } },
      { id: 'S2', t: 'seg', p: [[0, -2], [0, 2]], lab: T('(L)'), lpos: 'above', lat: 'end', st: { a: '<->', w: 'epais', c: 'bleu' } },
      ptI('P1', 0, 0, 'O', 'below right'), ptI('P2', -2, 0, 'F', 'below'), ptI('P3', 2, 0, "F'", 'below'),
      { id: 'S3', t: 'seg', p: [[-4, 0], [-4, 1.4]], lab: T('B'), lpos: 'above', lat: 'end', st: { a: '->', w: 'epais', c: 'rouge' } },
      ptI('P4', -4, 0, 'A', 'below', {})], opts: {} }) },
  ];

  /* ---------- Lien avec le document ---------- */
  function sync(block) {
    if (!block || !block.td) return block;
    block.code = toTikz(block.td);
    return block;
  }
  L.newTikzDraw = function (key) {
    const t = TEMPLATES.find(x => x.key === key) || TEMPLATES[0];
    return sync(L.newBlock('tikz', { td: repair(t.make()), code: '', scale: 1, caption: '', capMode: 'none' }));
  };

  L.TD = { COLORS, FILLS, WIDTHS, DASHES, TIPS, FONTS, SIZES, POS, DEF, OPEN, CLOSED, AXDEF, TEMPLATES,
    snap, r2, content, compile, pieces, toCm, fromCm, axOf, angleGeom, toTikz, repair, newId, nextLetter, keyPoints, shift, sync };
})();
