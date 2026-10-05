/* Dessins TikZ : un interpréteur des commandes de base de TikZ (« Basic Drawing »)
   qui dessine en SVG, dans l'éditeur, l'aperçu et le PDF — sans LaTeX, hors ligne.
   L'export LaTeX reprend le code TikZ tel quel (\begin{tikzpicture}…) : le vrai
   LaTeX donne alors le même dessin.

   Pris en charge :
   - \draw, \fill, \filldraw, \path, \shade, \shadedraw, \clip, \node, \coordinate,
     \foreach (listes, « 0,1,...,5 », variables multiples \x/\y), \begin{scope}[…],
     \definecolor, \colorlet, \tikzset{nom/.style={…}}, \def\nom{…}
   - chemins : (x,y), (angle:rayon), (nom), (nom.north)…, +(…), ++(…), --, -|, |-,
     .. controls … .., to[out=…,in=…], rectangle, circle, ellipse, arc, grid,
     cycle, node, coordinate, plot (fonctions et coordinates), edge
   - options : couleurs xcolor (red!30!blue…), épaisseurs (thin… ultra thick,
     line width), pointillés, flèches (->, <->, stealth, latex, |-|…), rounded
     corners, opacités, transformations (scale, shift, rotate, xshift…), nœuds
     (above, below=2pt, anchor, draw, fill, circle, minimum size, font, align,
     midway, pos, sloped, above=of …), styles nommés, every node/.style.
   Les calculs (sin, cos en degrés, sqrt, ^, pi…) sont acceptés dans les
   coordonnées, comme dans TikZ. */
(function () {
  const CM = 37.7952756;            // px par cm
  const PT = CM / 28.4527559;       // px par point TeX
  const UNITS = { cm: 1, mm: 0.1, pt: 1 / 28.4527559, bp: 1 / 28.3464567, in: 2.54, ex: 0.1505, em: 0.3851, sp: 1 / 1864680 };

  /* ================= Couleurs (xcolor) ================= */
  const BASE = {
    red: [255, 0, 0], green: [0, 255, 0], blue: [0, 0, 255], cyan: [0, 255, 255], magenta: [255, 0, 255], yellow: [255, 255, 0],
    black: [0, 0, 0], white: [255, 255, 255], gray: [128, 128, 128], darkgray: [64, 64, 64], lightgray: [191, 191, 191],
    brown: [191, 128, 64], lime: [191, 255, 0], olive: [128, 128, 0], orange: [255, 128, 0], pink: [255, 191, 191],
    purple: [191, 0, 64], teal: [0, 128, 128], violet: [128, 0, 128],
  };
  function parseColor(s, env) {
    s = String(s || '').trim();
    if (!s) return null;
    const named = n => {
      n = n.trim();
      if (env.colors[n]) return env.colors[n];
      if (BASE[n]) return BASE[n];
      return null;
    };
    const parts = s.split('!');
    let c = named(parts[0].replace(/^-/, ''));
    if (!c) return null;
    if (parts[0].startsWith('-')) c = c.map(v => 255 - v);
    for (let i = 1; i < parts.length; i += 2) {
      const pct = parseFloat(parts[i]);
      if (isNaN(pct)) return null;
      const other = i + 1 < parts.length ? named(parts[i + 1]) : BASE.white;
      if (!other) return null;
      const k = Math.max(0, Math.min(100, pct)) / 100;
      c = c.map((v, j) => v * k + other[j] * (1 - k));
    }
    return c;
  }
  const isColor = (s, env) => !!parseColor(s, env);
  const css = c => c ? 'rgb(' + c.map(v => Math.round(v)).join(',') + ')' : 'none';

  /* ================= Calculs (pgfmath, simplifié) ================= */
  const FN = {
    sin: d => Math.sin(d * Math.PI / 180), cos: d => Math.cos(d * Math.PI / 180), tan: d => Math.tan(d * Math.PI / 180),
    asin: x => Math.asin(x) * 180 / Math.PI, acos: x => Math.acos(x) * 180 / Math.PI, atan: x => Math.atan(x) * 180 / Math.PI,
    atan2: (y, x) => Math.atan2(y, x) * 180 / Math.PI, sqrt: Math.sqrt, exp: Math.exp, ln: Math.log, log10: Math.log10, log2: Math.log2,
    abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round, int: Math.trunc, min: Math.min, max: Math.max,
    pow: Math.pow, mod: (a, b) => a % b, deg: r => r * 180 / Math.PI, rad: d => d * Math.PI / 180, veclen: (x, y) => Math.hypot(x, y),
    sign: Math.sign, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, frac: x => x - Math.trunc(x), real: x => x,
  };
  const CONST = { pi: Math.PI, e: Math.E };
  /* Renvoie { v: nombre, unit: true si une unité est apparue (valeur en cm) } */
  function evalExpr(src) {
    const s = String(src).replace(/\\pi\b/g, 'pi').replace(/[{}]/g, ' ');
    let i = 0, unit = false;
    const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    const fail = () => { throw new Error('calcul illisible : « ' + String(src).trim() + ' »'); };
    function primary() {
      ws();
      if (s[i] === '(') { i++; const v = add(); ws(); if (s[i] !== ')') fail(); i++; return post(v); }
      if (s[i] === '-') { i++; return -power(); }
      if (s[i] === '+') { i++; return power(); }
      const n = /^(\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(s.slice(i));
      if (n) {
        i += n[0].length;
        let v = parseFloat(n[0]);
        const u = /^\s*(cm|mm|pt|bp|in|ex|em|sp)\b/.exec(s.slice(i));
        if (u) { i += u[0].length; v *= UNITS[u[1]]; unit = true; }
        return post(v);
      }
      const id = /^[a-zA-Z_]\w*/.exec(s.slice(i));
      if (id) {
        i += id[0].length;
        const name = id[0];
        if (CONST[name] !== undefined) return post(CONST[name]);
        if (FN[name]) {
          ws();
          const args = [];
          if (s[i] === '(') { i++; args.push(add()); ws(); while (s[i] === ',') { i++; args.push(add()); ws(); } if (s[i] !== ')') fail(); i++; }
          else args.push(power());
          return post(FN[name](...args));
        }
        fail();
      }
      fail();
    }
    // « 30r » : angle en radians (TikZ travaille en degrés)
    function post(v) { ws(); if (s[i] === 'r' && !/\w/.test(s[i + 1] || '')) { i++; v = v * 180 / Math.PI; } return v; }
    function power() { const b = primary(); ws(); if (s[i] === '^') { i++; return Math.pow(b, power()); } return b; }
    function mul() {
      let v = power();
      for (;;) {
        ws();
        if (s[i] === '*') { i++; v *= power(); }
        else if (s[i] === '/') { i++; v /= power(); }
        else return v;
      }
    }
    function add() {
      let v = mul();
      for (;;) {
        ws();
        if (s[i] === '+') { i++; v += mul(); }
        else if (s[i] === '-') { i++; v -= mul(); }
        else return v;
      }
    }
    const v = add(); ws();
    if (i < s.length) fail();
    if (!isFinite(v)) throw new Error('calcul impossible : « ' + String(src).trim() + ' »');
    return { v, unit };
  }
  const num = s => evalExpr(s).v;
  // Longueur : sans unité = cm (coordonnées), sauf si « def » est donné (ex. pt pour les épaisseurs)
  function len(s, defUnit) {
    const r = evalExpr(s);
    if (r.unit) return r.v;
    return r.v * (defUnit ? UNITS[defUnit] : 1);
  }

  /* ================= Lecture du texte source ================= */
  // Lit un groupe équilibré à partir de s[i] ∈ « {[( » ; renvoie [contenu, index après]
  function group(s, i) {
    const open = s[i], close = { '{': '}', '[': ']', '(': ')' }[open];
    let d = 0;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (c === '\\') { j++; continue; }
      if (c === '{' && open !== '{') { const [, k] = group(s, j); j = k - 1; continue; }
      if (c === open) d++;
      else if (c === close) { d--; if (!d) return [s.slice(i + 1, j), j + 1]; }
    }
    throw new Error('« ' + open + ' » sans « ' + close + ' » correspondant');
  }
  // Découpe « a, b={c,d}, e » au niveau 0
  function splitTop(s, sep) {
    const out = [];
    let d = 0, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\') { cur += c + (s[i + 1] || ''); i++; continue; }
      if ('{[('.includes(c)) d++;
      else if ('}])'.includes(c)) d--;
      if (c === sep && d === 0) { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out.map(x => x.trim()).filter(x => x !== '');
  }
  const strip = s => { s = String(s).trim(); return s.startsWith('{') && s.endsWith('}') ? s.slice(1, -1).trim() : s; };

  /* ================= Options ================= */
  const WIDTHS = { 'ultra thin': 0.1, 'very thin': 0.2, thin: 0.4, semithick: 0.6, thick: 0.8, 'very thick': 1.2, 'ultra thick': 1.6 };
  const DASHES = {
    solid: null, dashed: [3, 3], 'densely dashed': [3, 2], 'loosely dashed': [3, 6], dotted: [0.4, 2], 'densely dotted': [0.4, 1], 'loosely dotted': [0.4, 4],
    'dash dot': [3, 2, 0.4, 2], 'densely dash dot': [3, 1, 0.4, 1], 'loosely dash dot': [3, 4, 0.4, 4], 'dash dot dot': [3, 2, 0.4, 2, 0.4, 2],
  };
  const FONTS = { '\\tiny': 0.5, '\\scriptsize': 0.7, '\\footnotesize': 0.8, '\\small': 0.9, '\\normalsize': 1, '\\large': 1.2, '\\Large': 1.44, '\\LARGE': 1.728, '\\huge': 2.074, '\\Huge': 2.488 };
  const DIRS = ['above', 'below', 'left', 'right', 'above left', 'above right', 'below left', 'below right'];
  const DIR_ANCHOR = { above: 'south', below: 'north', left: 'east', right: 'west', 'above left': 'south east', 'above right': 'south west', 'below left': 'north east', 'below right': 'north west' };

  // État graphique (hérité, modifié par les options)
  const baseStyle = () => ({
    draw: null, fill: null, color: [0, 0, 0], text: null, lw: 0.4, dash: null, arrows: null, rounded: 0, opacity: 1, fillOpacity: 1, drawOpacity: 1,
    lineCap: null, lineJoin: null, evenOdd: false, step: 1, font: 1, bold: false, italic: false, smooth: false, domain: null, samples: 25, variable: '\\x',
    shade: null, defaultTip: 'to', node: {}, everyNode: [], innerSep: null, help: false,
  });

  function applyOptions(optStr, st, env, ctm, extra) {
    const opts = splitTop(optStr || '', ',');
    for (let raw of opts) {
      let [k, ...rest] = splitTop(raw, '=');
      k = (k || '').trim().replace(/\s+/g, ' ');
      let v = rest.length ? raw.slice(raw.indexOf('=') + 1).trim() : null;
      // Styles nommés
      if (/\/\.style$/.test(k) || /\/\.append style$/.test(k)) {
        const name = k.replace(/\/\.(append )?style$/, '').trim();
        if (name === 'every node') st.everyNode = st.everyNode.concat([strip(v)]);
        else env.styles[name] = (k.endsWith('append style') && env.styles[name] ? env.styles[name] + ',' : '') + strip(v);
        continue;
      }
      if (env.styles[k] !== undefined && v === null) { applyOptions(env.styles[k], st, env, ctm, extra); continue; }
      if (k === 'every node') continue;
      if (v === null) {
        if (WIDTHS[k] !== undefined) { st.lw = WIDTHS[k]; continue; }
        if (k in DASHES) { st.dash = DASHES[k]; continue; }
        if (k === 'help lines') { st.draw = [128, 128, 128]; st.lw = 0.2; continue; }
        if (k === 'draw') { st.draw = st.draw || 'current'; continue; }
        if (k === 'fill') { st.fill = st.fill || 'current'; continue; }
        if (k === 'rounded corners') { st.rounded = 4 / 28.45; continue; }
        if (k === 'sharp corners') { st.rounded = 0; continue; }
        if (k === 'smooth') { st.smooth = true; continue; }
        if (k === 'only marks') { st.onlyMarks = true; continue; }
        if (k === 'sharp plot') { st.smooth = false; continue; }
        if (k === 'even odd rule') { st.evenOdd = true; continue; }
        if (k === 'transform shape' || k === 'nonzero rule') continue;
        if (/^(\||<|>|-|\(|\)|\[|\]|stealth|latex|Stealth|Latex|to|o|\*|\{)/i.test(k) && /-/.test(k) && parseArrows(k, st)) continue;
        if (isColor(k, env)) { st.color = parseColor(k, env); continue; }
        if (extra && extra(k, null)) continue;
        env.warn('option ignorée : « ' + k + ' »');
        continue;
      }
      v = v.trim();
      switch (k) {
        case 'color': { const c = parseColor(v, env); if (c) st.color = c; break; }
        case 'draw': st.draw = v === 'none' ? 'none' : (parseColor(v, env) || st.draw || 'current'); break;
        case 'fill': st.fill = v === 'none' ? 'none' : (parseColor(v, env) || 'current'); break;
        case 'text': { const c = parseColor(v, env); if (c) st.text = c; break; }
        case 'line width': st.lw = len(v, 'pt') * 28.4527559; break;
        case 'dash pattern': {
          const seq = [], re = /(on|off)\s+([^\s]+(?:\s*(?:pt|mm|cm))?)/g; let m;
          while ((m = re.exec(v))) seq.push(len(m[2], 'pt') * 28.4527559);
          st.dash = seq.length ? seq : null; break;
        }
        case 'rounded corners': st.rounded = len(v, 'pt'); break;
        case 'opacity': st.opacity = num(v); st.fillOpacity = st.drawOpacity = 1; break;
        case 'fill opacity': st.fillOpacity = num(v); break;
        case 'draw opacity': st.drawOpacity = num(v); break;
        case 'line cap': st.lineCap = v === 'rect' ? 'square' : v; break;
        case 'line join': st.lineJoin = v; break;
        case 'step': { const p = /^\(([^)]*)\)$/.exec(v); if (p) { const [a, b] = splitTop(p[1], ','); st.step = [len(a), len(b)]; } else st.step = len(v); break; }
        case 'domain': { const [a, b] = v.split(':'); st.domain = [num(a), num(b)]; break; }
        case 'mark': st.mark = v.trim(); break;
        case 'mark size': st.markSize = len(v, 'pt'); break;
        case 'mark options': break;
        case 'samples': st.samples = Math.max(2, Math.min(1000, Math.round(num(v)))); break;
        case 'variable': st.variable = v.trim(); break;
        case '>': st.defaultTip = tipName(v); break;
        case 'arrows': parseArrows(v, st); break;
        case 'font': fontOpt(v, st); break;
        case 'left color': case 'right color': case 'top color': case 'bottom color': case 'inner color': case 'outer color': case 'ball color': {
          st.shade = st.shade || {}; st.shade[k] = parseColor(v, env); break;
        }
        case 'shading': break;
        case 'inner sep': st.innerSep = len(v, 'pt'); break;
        // Transformations
        case 'scale': ctm && ctm.scale(num(v), num(v)); break;
        case 'xscale': ctm && ctm.scale(num(v), 1); break;
        case 'yscale': ctm && ctm.scale(1, num(v)); break;
        case 'xshift': ctm && ctm.translateCanvas(len(v), 0); break;
        case 'yshift': ctm && ctm.translateCanvas(0, len(v)); break;
        case 'shift': {
          if (ctm) {
            const sp = strip(v).replace(/^\((.*)\)$/, '$1');
            const parts = splitTop(sp, ',');
            if (parts.length === 2) ctm.translate(len(strip(parts[0])), len(strip(parts[1])));
            else { const p = env.point(sp, ctm); ctm.translateCanvas(p[0] - ctm.e, p[1] - ctm.f); }
          }
          break;
        }
        case 'rotate': ctm && ctm.rotate(num(v)); break;
        case 'rotate around': {
          if (ctm) {
            const m = /^\{?\s*([^:]+):\s*\((.*)\)\s*\}?$/.exec(v);
            if (m) { const [x, y] = splitTop(m[2], ',').map(t => len(t)); ctm.translate(x, y); ctm.rotate(num(m[1])); ctm.translate(-x, -y); }
          }
          break;
        }
        case 'x': ctm && ctm.scale(len(v), 1); break;
        case 'y': ctm && ctm.scale(1, len(v)); break;
        default:
          if (extra && extra(k, v)) break;
          env.warn('option ignorée : « ' + k + '=' + v + ' »');
      }
    }
    return st;
  }
  function fontOpt(v, st) {
    const s = v.replace(/[{}]/g, ' ');
    Object.keys(FONTS).forEach(f => { if (new RegExp('\\' + f + '(?![a-zA-Z])').test(s)) st.font = FONTS[f]; });
    if (/\\bfseries|\\textbf/.test(s)) st.bold = true;
    if (/\\itshape|\\textit|\\em\b/.test(s)) st.italic = true;
  }
  function tipName(t) {
    t = String(t || '').trim().replace(/[{}]/g, '');
    if (!t) return null;
    if (/^stealth/i.test(t)) return 'stealth';
    if (/^latex/i.test(t)) return 'latex';
    if (t === '>' || t === 'to' || t === 'To') return 'to';
    if (t === '>>') return 'to2';
    if (t === '|' || /^Bar/i.test(t)) return 'bar';
    if (t === '*' || t === 'Circle') return 'dot';
    if (t === 'o') return 'circle';
    if (t === '<') return 'back';
    if (t === ')' || t === '(') return 'round';
    return 'to';
  }
  // « <-> », « ->», « -stealth », « |-| », « -{Latex} »… (résolu au dessin : « >=stealth »
  // peut venir après « -> » dans les options)
  function parseArrows(spec, st) {
    const s = spec.trim();
    const i = s.search(/-(?![^{]*\})/);
    if (i < 0) return false;
    const a = s.slice(0, i).trim(), b = s.slice(i + 1).trim();
    st.arrows = a || b ? { start: a, end: b } : null;
    return true;
  }
  function resolveTip(t, start, def) {
    if (!t) return null;
    if (t === '>' || t === '<') return (start ? t === '<' : t === '>') ? def || 'to' : 'back';
    if (t === '>>' || t === '<<') return 'to2';
    return tipName(t);
  }

  /* ================= Transformations (cm, axe y vers le haut) ================= */
  class Mat {
    constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) { Object.assign(this, { a, b, c, d, e, f }); }
    clone() { return new Mat(this.a, this.b, this.c, this.d, this.e, this.f); }
    apply(x, y) { return [this.a * x + this.c * y + this.e, this.b * x + this.d * y + this.f]; }
    applyVec(x, y) { return [this.a * x + this.c * y, this.b * x + this.d * y]; }
    mul(m) { const { a, b, c, d, e, f } = this; return Object.assign(this, { a: a * m.a + c * m.b, b: b * m.a + d * m.b, c: a * m.c + c * m.d, d: b * m.c + d * m.d, e: a * m.e + c * m.f + e, f: b * m.e + d * m.f + f }); }
    translate(x, y) { return this.mul(new Mat(1, 0, 0, 1, x, y)); }
    translateCanvas(x, y) { this.e += x; this.f += y; return this; }
    scale(x, y) { return this.mul(new Mat(x, 0, 0, y, 0, 0)); }
    rotate(deg) { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return this.mul(new Mat(c, s, -s, c, 0, 0)); }
    invert() { const det = this.a * this.d - this.b * this.c || 1; return new Mat(this.d / det, -this.b / det, -this.c / det, this.a / det, (this.c * this.f - this.d * this.e) / det, (this.b * this.e - this.a * this.f) / det); }
  }

  /* ================= Interprétation ================= */
  function interpret(src, opts) {
    opts = opts || {};
    const warnings = [];
    const env = {
      colors: {}, styles: {}, names: {}, macros: {}, items: [], bbox: null, fontPt: opts.fontPt || 10.95,
      warn: m => { if (warnings.length < 8 && !warnings.includes(m)) warnings.push(m); },
    };
    // Points : renvoie [x,y] en cm (repère du dessin, après transformation)
    env.point = function (spec, ctm, absolute) {
      spec = spec.trim();
      // Point nommé (et ancre)
      const nm = /^([A-Za-z_][\w ]*?)(?:\.(north east|north west|south east|south west|north|south|east|west|center|base|mid|\d+(?:\.\d+)?))?$/.exec(spec);
      if (nm && env.names[nm[1].trim()]) return anchorOf(env.names[nm[1].trim()], nm[2] || 'center');
      // Intersection « (A |- B) » / « (A -| B) » : abscisse de l'un, ordonnée de l'autre
      const perp = /^(.+?)\s*(\|-|-\|)\s*(.+)$/.exec(spec);
      if (perp && !/[{}]/.test(spec)) {
        const p = env.point(perp[1], ctm), q = env.point(perp[3], ctm);
        return perp[2] === '|-' ? [p[0], q[1]] : [q[0], p[1]];
      }
      // (angle:rayon) polaire
      const parts = splitTop(spec, ',');
      if (parts.length === 1 && /:/.test(spec)) {
        const k = spec.indexOf(':');
        const ang = num(strip(spec.slice(0, k)));
        const rs = strip(spec.slice(k + 1));
        let rx, ry;
        if (/ and /.test(rs)) { const [a, b] = rs.split(/ and /); rx = len(strip(a)); ry = len(strip(b)); } else rx = ry = len(rs);
        const x = rx * Math.cos(ang * Math.PI / 180), y = ry * Math.sin(ang * Math.PI / 180);
        return ctm.apply(x, y);
      }
      if (parts.length === 2) {
        const x = evalExpr(strip(parts[0])), y = evalExpr(strip(parts[1]));
        return ctm.apply(x.v, y.v);
      }
      throw new Error('point inconnu : (' + spec + ')');
    };

    // Texte source : commentaires, tikzpicture, macros simples
    let s = String(src || '').replace(/\r/g, '').replace(/(^|[^\\])%.*$/gm, '$1');
    let pictureOpts = '';
    const env1 = /\\begin\{tikzpicture\}\s*(\[)?/.exec(s);
    if (env1) {
      let i = env1.index + env1[0].length;
      if (env1[1]) { const [o, j] = group(s, i - 1); pictureOpts = o; i = j; }
      const end = s.indexOf('\\end{tikzpicture}', i);
      s = s.slice(i, end < 0 ? s.length : end);
    } else {
      const t = /^\s*\\tikz(?![A-Za-z])\s*(\[)?/.exec(s);
      if (t) { let i = t[0].length; if (t[1]) { const [o, j] = group(s, i - 1); pictureOpts = o; i = j; } s = s.slice(i); }
    }
    s = s.replace(/\\(?:def|newcommand)\s*\{?\\([A-Za-z]+)\}?\s*\{([^{}]*)\}/g, (m, n, v) => { env.macros[n] = v; return ''; });
    const expandMacros = t => { for (let k = 0; k < 5; k++) t = t.replace(/\\([A-Za-z]+)(?![A-Za-z])/g, (m, n) => env.macros[n] !== undefined ? env.macros[n] : m); return t; };
    s = expandMacros(s);

    const root = baseStyle();
    const ctm0 = new Mat();
    applyOptions(pictureOpts, root, env, ctm0);
    if (opts.scale && opts.scale !== 1) ctm0.scale(opts.scale, opts.scale);
    runBlock(s, root, ctm0, env, 0);
    return { items: env.items, warnings, error: env.error || null };
  }

  // Exécute une suite d'instructions
  function runBlock(s, st, ctm, env, depth) {
    if (depth > 12) throw new Error('trop d\'imbrications');
    let i = 0;
    // Un \clip ne vaut que jusqu'à la fin du bloc (scope, \foreach…) où il est écrit
    const clips0 = env.items.filter(it => it.type === 'clip').length - env.items.filter(it => it.type === 'clipEnd').length;
    while (i < s.length) {
      while (i < s.length && /[\s;]/.test(s[i])) i++;
      if (i >= s.length) break;
      if (s[i] === '{') { const [inner, j] = group(s, i); runBlock(inner, cloneSt(st), ctm.clone(), env, depth + 1); i = j; continue; }
      const cmd = /^\\([A-Za-z]+)/.exec(s.slice(i));
      if (!cmd) { const end = stmtEnd(s, i); env.warn('texte ignoré : « ' + s.slice(i, Math.min(end, i + 30)).trim() + ' »'); i = end + 1; continue; }
      const name = cmd[1];
      i += cmd[0].length;
      if (name === 'begin') {
        const [envName, j] = group(s, skip(s, i));
        let k = skip(s, j), o = '';
        if (s[k] === '[') { const [oo, kk] = group(s, k); o = oo; k = kk; }
        const close = findEnd(s, k, envName);
        if (envName === 'scope') {
          const st2 = cloneSt(st), c2 = ctm.clone();
          applyOptions(o, st2, env, c2);
          runBlock(s.slice(k, close), st2, c2, env, depth + 1);
        } else env.warn('environnement ignoré : ' + envName);
        i = close + ('\\end{' + envName + '}').length;
        continue;
      }
      if (name === 'end') { const [, j] = group(s, skip(s, i)); i = j; continue; }
      if (name === 'foreach') { i = runForeach(s, i, st, ctm, env, depth); continue; }
      if (name === 'definecolor') {
        const [cn, j1] = group(s, skip(s, i)); const [model, j2] = group(s, skip(s, j1)); const [spec, j3] = group(s, skip(s, j2));
        const v = spec.split(',').map(x => parseFloat(x));
        const md = model.trim().toLowerCase();
        if (md === 'rgb') env.colors[cn.trim()] = v.map(x => x * 255);
        else if (md === 'html') { const h = spec.trim(); env.colors[cn.trim()] = [0, 2, 4].map(k => parseInt(h.slice(k, k + 2), 16)); }
        else if (md === 'gray') env.colors[cn.trim()] = [v[0] * 255, v[0] * 255, v[0] * 255];
        else env.colors[cn.trim()] = v;
        i = j3; continue;
      }
      if (name === 'colorlet') {
        const [cn, j1] = group(s, skip(s, i)); const [spec, j2] = group(s, skip(s, j1));
        const c = parseColor(spec, env); if (c) env.colors[cn.trim()] = c;
        i = j2; continue;
      }
      if (name === 'tikzset' || name === 'tikzstyle') {
        if (name === 'tikzset') { const [o, j] = group(s, skip(s, i)); applyOptions(o, st, env, null); i = j; }
        else { const end = stmtEnd(s, i); const m = /^\s*(\w[\w ]*)\s*=\s*\[(.*)\]\s*$/.exec(s.slice(i, end)); if (m) env.styles[m[1].trim()] = m[2]; i = end + 1; }
        continue;
      }
      if (name === 'usetikzlibrary' || name === 'pgfmathsetmacro' || name === 'centering' || name === 'small' || name === 'large') {
        if (name === 'pgfmathsetmacro') {
          // \pgfmathsetmacro{\r}{2*3} : la valeur remplace \r dans la suite du bloc
          let j1 = skip(s, i), mn;
          if (s[j1] === '{') { const g = group(s, j1); mn = g[0]; j1 = g[1]; } else { const mm = /^\\[A-Za-z]+/.exec(s.slice(j1)); mn = mm ? mm[0] : ''; j1 += mn.length; }
          const [ex, j2] = group(s, skip(s, j1));
          const key = mn.replace(/^\\/, '').trim();
          const v = num(ex);
          s = s.slice(0, j2) + s.slice(j2).replace(new RegExp('\\\\' + key + '(?![A-Za-z])', 'g'), String(Math.round(v * 1e9) / 1e9));
          i = j2; continue;
        }
        if (s[skip(s, i)] === '{') { const [, j] = group(s, skip(s, i)); i = j; }
        continue;
      }
      const end = stmtEnd(s, i);
      const body = s.slice(i, end);
      i = end + 1;
      const kinds = { draw: 'draw', fill: 'fill', filldraw: 'filldraw', path: 'path', shade: 'shade', shadedraw: 'shadedraw', clip: 'clip', node: 'node', coordinate: 'coordinate', pattern: 'fill' };
      if (!kinds[name]) { env.warn('commande non prise en charge : \\' + name); continue; }
      // Une instruction fautive est signalée, les autres sont quand même dessinées
      try { pathCommand(kinds[name], body, st, ctm, env); } catch (e) { if (!env.error) env.error = '\\' + name + ' : ' + e.message; }
    }
    const clips1 = env.items.filter(it => it.type === 'clip').length - env.items.filter(it => it.type === 'clipEnd').length;
    for (let k = clips0; k < clips1; k++) env.items.push({ type: 'clipEnd' });
  }
  const skip = (s, i) => { while (i < s.length && /\s/.test(s[i])) i++; return i; };
  // Fin d'instruction : « ; » hors groupes
  function stmtEnd(s, i) {
    let d = 0;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (c === '\\') { j++; continue; }
      if ('{[('.includes(c)) d++;
      else if ('}])'.includes(c)) d = Math.max(0, d - 1);
      else if (c === ';' && d === 0) return j;
    }
    throw new Error('il manque un « ; » à la fin de : ' + s.slice(i, i + 40).trim() + '…');
  }
  function findEnd(s, i, name) {
    let d = 1;
    const re = new RegExp('\\\\(begin|end)\\{' + name + '\\}', 'g');
    re.lastIndex = i;
    let m;
    while ((m = re.exec(s))) { d += m[1] === 'begin' ? 1 : -1; if (!d) return m.index; }
    throw new Error('\\begin{' + name + '} sans \\end{' + name + '}');
  }
  const cloneSt = st => Object.assign({}, st, { node: Object.assign({}, st.node), everyNode: st.everyNode.slice() });

  /* \foreach \x in {1,2,...,5} { … }  (ou une seule instruction) */
  function runForeach(s, i, st, ctm, env, depth) {
    i = skip(s, i);
    const vm = /^((?:\\[A-Za-z]+\s*\/?\s*)+)/.exec(s.slice(i));
    if (!vm) throw new Error('\\foreach : variable attendue (ex. \\foreach \\x in {1,2,3})');
    const vars = vm[1].split('/').map(v => v.trim());
    i += vm[0].length;
    i = skip(s, i);
    if (s[i] === '[') { const [, j] = group(s, i); i = skip(s, j); }
    if (s.slice(i, i + 2) !== 'in') throw new Error('\\foreach : « in » attendu');
    i = skip(s, i + 2);
    let listStr;
    if (s[i] === '{') { const [l, j] = group(s, i); listStr = l; i = j; } else { const m = /^\S+/.exec(s.slice(i)); listStr = m[0]; i += m[0].length; }
    i = skip(s, i);
    let body, after;
    if (s[i] === '{') { const [b, j] = group(s, i); body = b; after = j; }
    else { const e = stmtEnd(s, i); body = s.slice(i, e + 1); after = e + 1; }
    const values = expandList(listStr);
    if (values.length > 2000) throw new Error('\\foreach : trop de valeurs');
    values.forEach(val => {
      const vs = vars.length > 1 ? splitTop(val, '/') : [val];
      let b = body;
      vars.forEach((v, k) => {
        const name = v.replace(/^\\/, '');
        b = b.replace(new RegExp('\\\\' + name + '(?![A-Za-z])', 'g'), (vs[k] !== undefined ? vs[k] : vs[vs.length - 1]).trim());
      });
      runBlock(b, cloneSt(st), ctm.clone(), env, depth + 1);
    });
    return after;
  }
  function expandList(l) {
    const items = splitTop(l, ',');
    const out = [];
    for (let k = 0; k < items.length; k++) {
      if (items[k] === '...' || items[k] === '…') {
        const a = parseFloat(out[out.length - 1]), prev = out.length > 1 ? parseFloat(out[out.length - 2]) : null;
        const b = parseFloat(items[k + 1]);
        if (isNaN(a) || isNaN(b)) continue;
        const step = prev !== null && !isNaN(prev) ? a - prev : (b >= a ? 1 : -1);
        if (!step) continue;
        for (let x = a + step, guard = 0; (step > 0 ? x < b - 1e-9 : x > b + 1e-9) && guard < 2000; x += step, guard++) out.push(String(Math.round(x * 1e9) / 1e9));
        continue;
      }
      out.push(items[k]);
    }
    return out;
  }

  /* ================= Chemins ================= */
  function pathCommand(kind, body, st0, ctm0, env) {
    const st = cloneSt(st0);
    const ctm = ctm0.clone();
    let i = skip(body, 0);
    if (kind === 'filldraw' || kind === 'shadedraw') { st.draw = st.draw || 'current'; }
    if (kind === 'filldraw' || kind === 'fill') { st.fill = st.fill || 'current'; }
    if (kind === 'draw' || kind === 'shadedraw') { st.draw = st.draw || 'current'; }
    if (kind === 'shade' || kind === 'shadedraw') st.shade = st.shade || {};
    // options de la commande (pour \node : ce sont celles du nœud, lues plus bas)
    if (kind === 'node' || kind === 'coordinate') { body = kind + ' ' + body; i = 0; }
    else while (body[i] === '[') { const [o, j] = group(body, i); applyOptions(o, st, env, ctm); i = skip(body, j); }
    const segs = [];          // segments du chemin : {t:'M'|'L'|'C'|'Z', p:[..]}
    const marks = [];         // marques des tracés (plot … mark=*)
    const nodes = [];
    const edges = [];
    let cur = null, start = null, lastNodeRef = null;
    const plotPts = [];
    const pts = () => segs;
    const moveTo = p => { segs.push({ t: 'M', p: [p] }); cur = p; start = p; };
    const lineTo = p => { if (!cur) return moveTo(p); segs.push({ t: 'L', p: [p] }); cur = p; };
    const curveTo = (c1, c2, p) => { if (!cur) moveTo(c1); segs.push({ t: 'C', p: [c1, c2, p] }); cur = p; };
    const readCoord = () => {
      i = skip(body, i);
      let rel = 0;
      if (body.startsWith('++', i)) { rel = 2; i += 2; } else if (body[i] === '+') { rel = 1; i += 1; }
      i = skip(body, i);
      if (body[i] !== '(') return null;
      const [spec, j] = group(body, i);
      i = j;
      const sp = spec.trim();
      let p, ref = null;
      if (rel) {
        const c0 = cur || ctm.apply(0, 0);
        const parts = splitTop(sp, ',');
        let v;
        if (parts.length === 2) v = ctm.applyVec(num(strip(parts[0])), num(strip(parts[1])));
        else { const q = env.point(sp, new Mat(ctm.a, ctm.b, ctm.c, ctm.d, 0, 0)); v = q; }
        p = [c0[0] + v[0], c0[1] + v[1]];
        if (rel === 1) return { p, keep: true };
      } else {
        const nm = /^([A-Za-z_][\w ]*?)(?:\.[\w ]+)?$/.exec(sp);
        if (nm && env.names[nm[1].trim()] && !/\./.test(sp)) ref = env.names[nm[1].trim()];
        p = env.point(sp, ctm);
      }
      return { p, ref };
    };
    // Nœuds rattachés au chemin : position sur le dernier segment
    const lastSegment = () => {
      for (let k = segs.length - 1; k >= 0; k--) if (segs[k].t !== 'M') return { seg: segs[k], from: k > 0 ? endOf(segs[k - 1]) : null };
      return null;
    };
    let pendingNodes = [];   // nœuds placés entre une opération et sa cible (« -- node {…} (b) »)
    const flushPending = () => {
      const ls = lastSegment();
      pendingNodes.forEach(nd => { placeOnSegment(nd, ls, 0.5); nodes.push(nd); });
      pendingNodes = [];
    };
    const placeOnSegment = (nd, ls, defPos) => {
      const pos = nd.pos !== null ? nd.pos : defPos;
      if (ls && ls.seg.rect && pos !== null) {
        const [a, b] = ls.seg.rect;
        nd.at = [a[0] + (b[0] - a[0]) * pos, a[1] + (b[1] - a[1]) * pos];
      } else if (ls && ls.from && pos !== null) {
        const q = pointOnSeg(ls.from, ls.seg, pos);
        nd.at = q.p;
        if (nd.sloped) nd.rotate = (nd.rotate || 0) + slopeAngle(q.dir);
      } else nd.at = cur;
    };

    while (i < body.length) {
      i = skip(body, i);
      if (i >= body.length) break;
      const rest = body.slice(i);
      let m;
      if (body[i] === '(' || body[i] === '+') {
        const c = readCoord();
        if (!c) throw new Error('coordonnée illisible');
        if (c.keep) { moveTo(c.p); } else { moveTo(c.p); }
        lastNodeRef = c.ref;
        segs[segs.length - 1].ref = c.ref;
        continue;
      }
      if ((m = /^(--|-\||\|-)/.exec(rest))) {
        i += m[0].length;
        const preNodes = readInlineNodes();
        const c = readCoord();
        if (!c) {
          if (/^\s*cycle/.test(body.slice(i))) { i = skip(body, i) + 5; if (m[0] === '--') { segs.push({ t: 'Z', p: [start] }); cur = start; } pendingNodes.push(...preNodes); flushPending(); continue; }
          throw new Error('point attendu après « ' + m[0] + ' »');
        }
        const from = cur;
        let to = c.p;
        if (m[0] === '--') {
          // Entre deux nœuds, le trait part du bord du premier et s'arrête au bord du second
          let a = from, b = to;
          const last = segs[segs.length - 1];
          const prevRef = last && last.ref && last.ref.kind === 'node' ? last.ref : null;
          if (prevRef) {
            a = borderPoint(prevRef, c.ref && c.ref.kind === 'node' ? [c.ref.cx, c.ref.cy] : b);
            if (last.t === 'M') last.p = [a]; else segs.push({ t: 'M', p: [a] });
          }
          if (c.ref && c.ref.kind === 'node') b = borderPoint(c.ref, prevRef ? [prevRef.cx, prevRef.cy] : a);
          lineTo(b);
          segs[segs.length - 1].ref = c.ref;
          cur = c.keep ? from : b;
        } else {
          const corner = m[0] === '-|' ? [to[0], from[1]] : [from[0], to[1]];
          lineTo(corner); lineTo(to);
          if (c.keep) cur = from;
        }
        pendingNodes.push(...preNodes);
        flushPending();
        continue;
      }
      if (/^\.\.\s*controls/.test(rest)) {
        i += rest.indexOf('controls') + 8;
        const c1 = readCoord();
        let c2 = c1;
        i = skip(body, i);
        if (body.startsWith('and', i)) { i += 3; c2 = readCoord(); }
        i = skip(body, i);
        if (!body.startsWith('..', i)) throw new Error('« .. » attendu après controls');
        i += 2;
        const c = readCoord();
        if (!c1 || !c) throw new Error('courbe de Bézier illisible');
        curveTo(c1.p, c2.p, c.p);
        continue;
      }
      if ((m = /^to\b/.exec(rest))) {
        i += 2; i = skip(body, i);
        let o = '';
        if (body[i] === '[') { const [oo, j] = group(body, i); o = oo; i = j; }
        const preNodes = readInlineNodes();
        const c = readCoord();
        if (!c) throw new Error('point attendu après « to »');
        if (c.ref && c.ref.kind === 'node' && !/out|in|bend/.test(o)) c.p = borderPoint(c.ref, cur);
        const to = toPath(o, cur, c, segs, env, st, ctm);
        cur = to;
        pendingNodes.push(...preNodes);
        flushPending();
        continue;
      }
      if ((m = /^edge\b/.exec(rest))) {
        i += 4; i = skip(body, i);
        let o = '';
        if (body[i] === '[') { const [oo, j] = group(body, i); o = oo; i = j; }
        const preNodes = readInlineNodes();
        const from = cur, fromRef = segs.length ? segs[segs.length - 1].ref : null;
        const c = readCoord();
        if (!c) throw new Error('point attendu après « edge »');
        edges.push({ o, from, fromRef, to: c, nodes: preNodes });
        // le chemin principal reste au point de départ
        segs.push({ t: 'M', p: [from] }); segs[segs.length - 1].ref = fromRef;
        cur = from;
        continue;
      }
      if ((m = /^rectangle\b/.exec(rest))) {
        i += m[0].length;
        const c = readCoord();
        if (!c || !cur) throw new Error('rectangle : deux coins attendus');
        const a = cur, b = c.p;
        const inv = ctm.invert();
        const ua = inv.apply(a[0], a[1]), ub = inv.apply(b[0], b[1]);
        const P = (x, y) => ctm.apply(x, y);
        segs.push({ t: 'M', p: [a] });
        lineTo(P(ub[0], ua[1])); lineTo(b); lineTo(P(ua[0], ub[1]));
        segs.push({ t: 'Z', p: [a] });
        segs[segs.length - 1].rect = [a, b];
        cur = b;
        flushPending();
        continue;
      }
      if ((m = /^(circle|ellipse)\b/.exec(rest))) {
        i += m[0].length; i = skip(body, i);
        let rx, ry;
        if (body[i] === '[') {
          const [o, j] = group(body, i); i = j;
          const kv = {};
          splitTop(o, ',').forEach(x => { const [k, ...v] = x.split('='); kv[k.trim()] = v.join('=').trim(); });
          if (kv.radius) rx = ry = len(kv.radius);
          if (kv['x radius']) rx = len(kv['x radius']);
          if (kv['y radius']) ry = len(kv['y radius']);
        } else if (body[i] === '(') {
          const [r, j] = group(body, i); i = j;
          if (/ and /.test(r)) { const [a, b] = r.split(/ and /); rx = len(strip(a)); ry = len(strip(b)); } else rx = ry = len(strip(r));
        } else {
          rx = ry = st.node.radius || 0.1;
        }
        if (rx === undefined || ry === undefined) throw new Error(m[1] + ' : rayon attendu');
        if (!cur) moveTo(ctm.apply(0, 0));
        const c = cur, inv = ctm.invert(), uc = inv.apply(c[0], c[1]);
        ellipseSegs(segs, ctm, uc[0], uc[1], rx, ry, 0, 360, true);
        segs.push({ t: 'M', p: [c] });
        cur = c;
        continue;
      }
      if ((m = /^arc\b/.exec(rest))) {
        i += 3; i = skip(body, i);
        let a0, a1, rx, ry, delta = null;
        if (body[i] === '(') {
          const [r, j] = group(body, i); i = j;
          const p = r.split(':');
          if (p.length < 3) throw new Error('arc : (début:fin:rayon) attendu');
          a0 = num(p[0]); a1 = num(p[1]);
          const rr = p.slice(2).join(':');
          if (/ and /.test(rr)) { const [a, b] = rr.split(/ and /); rx = len(strip(a)); ry = len(strip(b)); } else rx = ry = len(strip(rr));
        } else if (body[i] === '[') {
          const [o, j] = group(body, i); i = j;
          const kv = {};
          splitTop(o, ',').forEach(x => { const [k, ...v] = x.split('='); kv[k.trim()] = v.join('=').trim(); });
          a0 = kv['start angle'] !== undefined ? num(kv['start angle']) : 0;
          if (kv['delta angle'] !== undefined) delta = num(kv['delta angle']);
          a1 = kv['end angle'] !== undefined ? num(kv['end angle']) : a0 + (delta || 0);
          if (kv['start angle'] === undefined && kv['end angle'] !== undefined && delta !== null) a0 = a1 - delta;
          rx = ry = kv.radius ? len(kv.radius) : 1;
          if (kv['x radius']) rx = len(kv['x radius']);
          if (kv['y radius']) ry = len(kv['y radius']);
        } else throw new Error('arc : (début:fin:rayon) attendu');
        if (!cur) moveTo(ctm.apply(0, 0));
        const inv = ctm.invert(), u = inv.apply(cur[0], cur[1]);
        const cx = u[0] - rx * Math.cos(a0 * Math.PI / 180), cy = u[1] - ry * Math.sin(a0 * Math.PI / 180);
        ellipseSegs(segs, ctm, cx, cy, rx, ry, a0, a1, false);
        cur = ctm.apply(cx + rx * Math.cos(a1 * Math.PI / 180), cy + ry * Math.sin(a1 * Math.PI / 180));
        continue;
      }
      if ((m = /^grid\b/.exec(rest))) {
        i += 4; i = skip(body, i);
        const gs = cloneSt(st);
        if (body[i] === '[') { const [o, j] = group(body, i); applyOptions(o, gs, env, null); i = j; }
        const c = readCoord();
        if (!c || !cur) throw new Error('grid : deux coins attendus');
        const inv = ctm.invert(), a = inv.apply(cur[0], cur[1]), b = inv.apply(c.p[0], c.p[1]);
        const [sx, sy] = Array.isArray(gs.step) ? gs.step : [gs.step, gs.step];
        const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
        let count = 0;
        for (let x = Math.ceil(x0 / sx - 1e-9) * sx; x <= x1 + 1e-9 && count < 2000; x += sx, count++) { segs.push({ t: 'M', p: [ctm.apply(x, y0)] }); segs.push({ t: 'L', p: [ctm.apply(x, y1)] }); }
        for (let y = Math.ceil(y0 / sy - 1e-9) * sy; y <= y1 + 1e-9 && count < 4000; y += sy, count++) { segs.push({ t: 'M', p: [ctm.apply(x0, y)] }); segs.push({ t: 'L', p: [ctm.apply(x1, y)] }); }
        segs.push({ t: 'M', p: [c.p] });
        cur = c.p;
        continue;
      }
      if ((m = /^plot\b/.exec(rest))) {
        i += 4; i = skip(body, i);
        const ps = cloneSt(st);
        if (body[i] === '[') { const [o, j] = group(body, i); applyOptions(o, ps, env, null); i = j; i = skip(body, i); }
        let list = [];
        if (body.startsWith('coordinates', i)) {
          i += 11; i = skip(body, i);
          const [l, j] = group(body, i); i = j;
          const re = /\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g; let mm;
          while ((mm = re.exec(l))) list.push(env.point(mm[1], ctm));
        } else if (body[i] === '(') {
          const [fx, j] = group(body, i); i = j;
          const [ex, ey] = splitTop(fx, ',');
          const dom = ps.domain || [-5, 5];
          const varName = ps.variable.replace(/^\\/, '');
          const n = ps.samples;
          for (let k = 0; k < n; k++) {
            const t = dom[0] + (dom[1] - dom[0]) * k / (n - 1);
            const sub = e => strip(e).replace(new RegExp('\\\\' + varName + '(?![A-Za-z])', 'g'), '(' + t + ')');
            try { list.push(ctm.apply(num(sub(ex)), num(sub(ey)))); } catch (e) { if (/impossible/.test(e.message)) continue; throw e; }
          }
        } else throw new Error('plot : « coordinates {…} » ou « ({x},{f(x)}) » attendu');
        if (!list.length) continue;
        const mark = ps.mark || st.mark;
        if (mark && mark !== 'none') marks.push({ pts: list, kind: mark, size: ps.markSize || st.markSize || 2 / 28.4527559, color: ps.color });
        if (ps.onlyMarks || st.onlyMarks) { moveTo(list[list.length - 1]); continue; }
        const smooth = ps.smooth || st.smooth;
        const first = cur && segs.length && segs[segs.length - 1].t !== 'M' ? 'L' : 'M';
        if (first === 'M') moveTo(list[0]); else lineTo(list[0]);
        if (smooth && list.length > 2) catmull(list, curveTo);
        else list.slice(1).forEach(lineTo);
        continue;
      }
      if ((m = /^cycle\b/.exec(rest))) { i += 5; segs.push({ t: 'Z', p: [start] }); cur = start; continue; }
      if ((m = /^(node|coordinate)\b/.exec(rest))) {
        const nds = readInlineNodes();
        nds.forEach(nd => {
          if (nd.pos !== null) placeOnSegment(nd, lastSegment(), nd.pos);
          else nd.at = nd.at || cur || ctm.apply(0, 0);
          nodes.push(nd);
        });
        continue;
      }
      if ((m = /^(parabola|sin|cos|svg|let|decorate)\b/.exec(rest))) throw new Error('« ' + m[1] + ' » n\'est pas encore pris en charge');
      if (/^\\[A-Za-z]/.test(rest)) throw new Error('il manque probablement un « ; » avant « ' + rest.slice(0, 25).trim() + ' »');
      throw new Error('je ne comprends pas « ' + rest.slice(0, 25).trim() + ' »');
    }
    pendingNodes.forEach(nd => { nd.at = nd.at || cur; nodes.push(nd); });

    // Nœuds lus dans le chemin : « node[opts] (nom) at (x,y) {texte} » — plusieurs à la suite
    function readInlineNodes() {
      const out = [];
      for (;;) {
        i = skip(body, i);
        const mm = /^(node|coordinate)\b/.exec(body.slice(i));
        if (!mm) return out;
        i += mm[0].length;
        const nd = { kind: mm[1], opts: '', name: null, at: null, text: '', pos: null };
        for (;;) {
          i = skip(body, i);
          if (body[i] === '[') { const [o, j] = group(body, i); nd.opts += (nd.opts ? ',' : '') + o; i = j; continue; }
          if (body[i] === '(' && !nd.name) { const [n2, j] = group(body, i); nd.name = n2.trim(); i = j; continue; }
          if (body.startsWith('at', i) && /\s|\(/.test(body[i + 2] || '')) {
            i += 2; const c = readCoord(); if (!c) throw new Error('node : position attendue après « at »'); nd.at = c.p; continue;
          }
          break;
        }
        if (nd.kind === 'node') {
          i = skip(body, i);
          if (body[i] !== '{') throw new Error('node : texte entre accolades attendu, même vide : {}');
          const [t, j] = group(body, i); nd.text = t; i = j;
        }
        const ns = Object.assign(cloneSt(st), { draw: null, fill: null, shade: null, arrows: null, dash: null, rounded: 0 });
        ns.color = st.color; ns.lw = 0.4;
        const nodeOpts = {};
        const extra = (k, v) => nodeOption(k, v, nodeOpts, env);
        st.everyNode.forEach(o => applyOptions(o, ns, env, null, extra));
        applyOptions(nd.opts, ns, env, null, extra);
        if (st.draw && st.draw !== 'current' && nodeOpts.inheritDraw) ns.draw = st.draw;
        nd.st = ns; nd.o = nodeOpts;
        if (nodeOpts.pos !== undefined) nd.pos = nodeOpts.pos;
        nd.sloped = !!nodeOpts.sloped;
        nd.rotate = nodeOpts.rotate || 0;
        nd.ctm = ctm;
        out.push(nd);
      }
    }

    // Construction des objets à dessiner
    const style = st;
    const hasPath = segs.some(x => x.t !== 'M');
    const drawColor = style.draw === 'current' ? style.color : style.draw;
    const fillColor = style.fill === 'current' ? style.color : style.fill;
    if (kind === 'clip') { env.items.push({ type: 'clip', segs }); }
    else if (hasPath && (style.draw && style.draw !== 'none' || style.fill && style.fill !== 'none' || style.shade)) {
      let d = segs;
      if (style.rounded > 0) d = roundCorners(segs, style.rounded);
      env.items.push({
        type: 'path', segs: d, stroke: style.draw && style.draw !== 'none' ? drawColor : null,
        fill: style.fill && style.fill !== 'none' ? fillColor : null, shade: style.shade, lw: style.lw, dash: style.dash,
        arrows: style.draw && style.draw !== 'none' ? style.arrows : null, tipDef: style.defaultTip, opacity: style.opacity, fillOpacity: style.fillOpacity, drawOpacity: style.drawOpacity,
        cap: style.lineCap, join: style.lineJoin, evenOdd: style.evenOdd,
      });
    }
    // Marques : dessinées par-dessus la courbe, taille fixe (non agrandie par scale)
    marks.forEach(mk => {
      const r = mk.size, col = mk.color || style.color;
      mk.pts.forEach(q => {
        const sg = [];
        const k = mk.kind.replace(/[{}]/g, '').trim();
        if (k === '*' || k === 'o' || k === 'circle' || k === 'ball') ellipseSegs(sg, new Mat(1, 0, 0, 1, q[0], q[1]), 0, 0, r, r, 0, 360, true);
        else if (k === 'square' || k === 'square*') sg.push({ t: 'M', p: [[q[0] - r, q[1] - r]] }, { t: 'L', p: [[q[0] + r, q[1] - r]] }, { t: 'L', p: [[q[0] + r, q[1] + r]] }, { t: 'L', p: [[q[0] - r, q[1] + r]] }, { t: 'Z', p: [[q[0] - r, q[1] - r]] });
        else if (k === 'triangle' || k === 'triangle*') sg.push({ t: 'M', p: [[q[0], q[1] + r * 1.2]] }, { t: 'L', p: [[q[0] + r * 1.04, q[1] - r * 0.6]] }, { t: 'L', p: [[q[0] - r * 1.04, q[1] - r * 0.6]] }, { t: 'Z', p: [[q[0], q[1] + r * 1.2]] });
        else if (k === 'x') sg.push({ t: 'M', p: [[q[0] - r, q[1] - r]] }, { t: 'L', p: [[q[0] + r, q[1] + r]] }, { t: 'M', p: [[q[0] - r, q[1] + r]] }, { t: 'L', p: [[q[0] + r, q[1] - r]] });
        else sg.push({ t: 'M', p: [[q[0] - r, q[1]]] }, { t: 'L', p: [[q[0] + r, q[1]]] }, { t: 'M', p: [[q[0], q[1] - r]] }, { t: 'L', p: [[q[0], q[1] + r]] });
        const filled = /\*$/.test(k) || k === 'ball';
        env.items.push({ type: 'path', segs: sg, stroke: col, fill: filled ? col : (k === 'o' || k === 'square' || k === 'triangle' ? [255, 255, 255] : null), lw: 0.4, dash: null, arrows: null, opacity: style.opacity, drawOpacity: 1, fillOpacity: 1 });
      });
    });
    edges.forEach(ed => {
      const es = cloneSt(st);
      es.draw = es.draw || 'current';
      const ec = ctm.clone();
      applyOptions(ed.o, es, env, ec, k => /^(out|in|bend left|bend right|looseness|relative)$/.test(k));
      const a0 = ed.fromRef ? borderPoint(ed.fromRef, ed.to.p) : ed.from;
      const b0 = ed.to.ref ? borderPoint(ed.to.ref, a0) : ed.to.p;
      const eSegs = [];
      toPath(ed.o, a0, { p: b0, ref: null }, eSegs, env, es, ec);
      env.items.push({ type: 'path', segs: eSegs, stroke: es.draw === 'current' ? es.color : es.draw, fill: null, lw: es.lw, dash: es.dash, arrows: es.arrows, tipDef: es.defaultTip, opacity: es.opacity, drawOpacity: es.drawOpacity, fillOpacity: 1 });
      ed.nodes.forEach(nd => { const q = pointOnSeg(a0, eSegs[1], nd.pos !== null ? nd.pos : 0.5); nd.at = q.p; if (nd.sloped) nd.rotate += slopeAngle(q.dir); placeNode(nd, env); });
    });
    nodes.forEach(nd => placeNode(nd, env));
  }

  // Options propres aux nœuds
  function nodeOption(k, v, o, env) {
    if (v === null) {
      if (DIR_ANCHOR[k]) { o.anchor = DIR_ANCHOR[k]; o.shift = 0; o.dir = k; return true; }
      if (k === 'circle' || k === 'rectangle' || k === 'ellipse' || k === 'coordinate') { o.shape = k; return true; }
      if (k === 'midway') { o.pos = 0.5; return true; }
      if (k === 'near start') { o.pos = 0.25; return true; }
      if (k === 'near end') { o.pos = 0.75; return true; }
      if (k === 'very near start') { o.pos = 0.125; return true; }
      if (k === 'very near end') { o.pos = 0.875; return true; }
      if (k === 'at start') { o.pos = 0; return true; }
      if (k === 'at end') { o.pos = 1; return true; }
      if (k === 'sloped') { o.sloped = true; return true; }
      if (k === 'auto' || k === 'swap' || k === 'inner sep' || k === 'outer sep' || k === 'transform shape') return true;
      return false;
    }
    if (DIR_ANCHOR[k]) {
      const of = /^(.*?)\s*of\s+(.+)$/.exec(v);
      if (of) { o.dir = k; o.relOf = { dist: of[1].trim() ? len(of[1].trim()) : null, name: of[2].trim() }; return true; }
      o.anchor = DIR_ANCHOR[k]; o.dir = k; o.shift = len(v, 'pt'); return true;
    }
    switch (k) {
      case 'anchor': o.anchor = v.trim(); return true;
      case 'pos': o.pos = num(v); return true;
      case 'shape': o.shape = v.trim(); return true;
      case 'inner sep': o.innerSep = len(v, 'pt'); return true;
      case 'outer sep': return true;
      case 'minimum size': o.minW = o.minH = len(v, 'pt'); return true;
      case 'minimum width': o.minW = len(v, 'pt'); return true;
      case 'minimum height': o.minH = len(v, 'pt'); return true;
      case 'text width': o.textWidth = len(v, 'pt'); return true;
      case 'align': o.align = v.trim(); return true;
      case 'rotate': o.rotate = num(v); return true;
      case 'node distance': return true;
      case 'label': o.label = v; return true;
      case 'circle through': return true;
      default: return false;
    }
  }

  /* ---------- Géométrie ---------- */
  const endOf = sg => sg.p[sg.p.length - 1];
  function pointOnSeg(from, sg, t) {
    if (sg.t === 'C') {
      const [c1, c2, p] = sg.p, a = from, u = 1 - t;
      const q = [0, 1].map(k => u * u * u * a[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * p[k]);
      const dq = [0, 1].map(k => 3 * u * u * (c1[k] - a[k]) + 6 * u * t * (c2[k] - c1[k]) + 3 * t * t * (p[k] - c2[k]));
      return { p: q, dir: dq };
    }
    const b = endOf(sg);
    return { p: [from[0] + (b[0] - from[0]) * t, from[1] + (b[1] - from[1]) * t], dir: [b[0] - from[0], b[1] - from[1]] };
  }
  function slopeAngle(dir) {
    let a = Math.atan2(dir[1], dir[0]) * 180 / Math.PI;
    if (a > 90) a -= 180; else if (a < -90) a += 180;
    return a;
  }
  // Ellipse (ou arc) en courbes de Bézier, dans le repère utilisateur, puis transformée
  function ellipseSegs(segs, ctm, cx, cy, rx, ry, a0, a1, full) {
    const P = (a) => ctm.apply(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
    const D = (a) => ctm.applyVec(-rx * Math.sin(a), ry * Math.cos(a));
    const r0 = a0 * Math.PI / 180, r1 = a1 * Math.PI / 180;
    const n = Math.max(1, Math.ceil(Math.abs(r1 - r0) / (Math.PI / 2)));
    const h = (r1 - r0) / n, k = 4 / 3 * Math.tan(h / 4);
    if (full) segs.push({ t: 'M', p: [P(r0)] });
    else if (!segs.length || segs[segs.length - 1].t === 'Z') segs.push({ t: 'M', p: [P(r0)] });
    for (let j = 0; j < n; j++) {
      const ta = r0 + j * h, tb = ta + h;
      const pa = P(ta), pb = P(tb), da = D(ta), db = D(tb);
      segs.push({ t: 'C', p: [[pa[0] + k * da[0], pa[1] + k * da[1]], [pb[0] - k * db[0], pb[1] - k * db[1]], pb] });
    }
    if (full) segs.push({ t: 'Z', p: [P(r0)] });
  }
  // « to[out=…, in=…] »
  function toPath(o, from, c, segs, env, st, ctm) {
    const kv = {};
    splitTop(o, ',').forEach(x => { const [k, ...v] = x.split('='); kv[k.trim()] = v.length ? v.join('=').trim() : true; });
    let to = c.p;
    if (kv.out !== undefined || kv.in !== undefined || kv['bend left'] !== undefined || kv['bend right'] !== undefined) {
      const dx = to[0] - from[0], dy = to[1] - from[1], d = Math.hypot(dx, dy);
      const base = Math.atan2(dy, dx) * 180 / Math.PI;
      let outA, inA;
      if (kv['bend left'] !== undefined || kv['bend right'] !== undefined) {
        const b = kv['bend left'] !== undefined ? (kv['bend left'] === true ? 30 : num(kv['bend left'])) : -(kv['bend right'] === true ? 30 : num(kv['bend right']));
        outA = base + b; inA = base + 180 - b;
      } else {
        const rel = kv.relative !== undefined;
        outA = kv.out !== undefined ? num(kv.out) + (rel ? base : 0) : base;
        inA = kv.in !== undefined ? num(kv.in) + (rel ? base + 180 : 0) : base + 180;
      }
      const loos = kv.looseness !== undefined ? num(kv.looseness) : 1;
      const L1 = 0.3915 * d * loos;
      const c1 = [from[0] + L1 * Math.cos(outA * Math.PI / 180), from[1] + L1 * Math.sin(outA * Math.PI / 180)];
      const c2 = [to[0] + L1 * Math.cos(inA * Math.PI / 180), to[1] + L1 * Math.sin(inA * Math.PI / 180)];
      if (!segs.length) segs.push({ t: 'M', p: [from] });
      segs.push({ t: 'C', p: [c1, c2, to] });
    } else {
      if (c.ref) to = borderPoint(c.ref, from);
      if (!segs.length) segs.push({ t: 'M', p: [from] });
      segs.push({ t: 'L', p: [to] });
    }
    if (kv['->'] || kv['<-'] || kv['<->']) { /* flèches propres au « to » : non gérées séparément */ }
    return to;
  }
  // Courbe lisse passant par les points (comme « smooth » de TikZ)
  function catmull(list, curveTo) {
    const t = 0.5 / 3;
    for (let k = 0; k < list.length - 1; k++) {
      const p0 = list[k - 1] || list[k], p1 = list[k], p2 = list[k + 1], p3 = list[k + 2] || p2;
      curveTo([p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t], [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t], p2);
    }
  }
  // Coins arrondis : sur les suites de segments droits
  function roundCorners(segs, r) {
    const out = [];
    for (let k = 0; k < segs.length; k++) {
      const sg = segs[k];
      if (sg.t !== 'L' && sg.t !== 'Z') { out.push(sg); continue; }
      const prev = out.length ? endOf(out[out.length - 1]) : null;
      const nxt = segs[k + 1];
      const p = sg.t === 'Z' ? sg.p[0] : sg.p[0];
      if (!prev || !nxt || (nxt.t !== 'L' && nxt.t !== 'Z')) { out.push(sg); continue; }
      const q = nxt.t === 'Z' ? nxt.p[0] : nxt.p[0];
      const d1 = Math.hypot(p[0] - prev[0], p[1] - prev[1]), d2 = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const rr = Math.min(r, d1 / 2, d2 / 2);
      if (rr <= 0) { out.push(sg); continue; }
      const a = [p[0] - (p[0] - prev[0]) / d1 * rr, p[1] - (p[1] - prev[1]) / d1 * rr];
      const b = [p[0] + (q[0] - p[0]) / d2 * rr, p[1] + (q[1] - p[1]) / d2 * rr];
      out.push({ t: 'L', p: [a] });
      out.push({ t: 'C', p: [[a[0] + (p[0] - a[0]) * 0.55, a[1] + (p[1] - a[1]) * 0.55], [b[0] + (p[0] - b[0]) * 0.55, b[1] + (p[1] - b[1]) * 0.55], b] });
      if (sg.t === 'Z') out.push({ t: 'Z', p: sg.p });
    }
    return out;
  }

  /* ---------- Nœuds ---------- */
  let measureBox = null;
  function measure(html, st, o, fontPt) {
    if (!measureBox) {
      measureBox = document.createElement('div');
      measureBox.className = 'paper tikz-text';
      measureBox.setAttribute('aria-hidden', 'true');
      measureBox.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;white-space:nowrap;font-family:"CMU Serif","Latin Modern Roman",Georgia,serif;line-height:1.2;';
      document.body.appendChild(measureBox);
    }
    measureBox.style.fontSize = (fontPt * st.font) + 'pt';
    measureBox.style.fontWeight = st.bold ? 'bold' : 'normal';
    measureBox.style.fontStyle = st.italic ? 'italic' : 'normal';
    measureBox.style.whiteSpace = o.textWidth ? 'normal' : 'nowrap';
    measureBox.style.width = o.textWidth ? (o.textWidth * CM) + 'px' : 'auto';
    measureBox.style.textAlign = o.align === 'right' ? 'right' : o.align === 'left' ? 'left' : 'center';
    measureBox.innerHTML = html;
    const r = measureBox.getBoundingClientRect();
    return { w: r.width / CM, h: r.height / CM };   // en cm
  }
  function nodeHtml(text) {
    let t = String(text || '').trim();
    if (!t) return '';
    // retours à la ligne « \\ », puis le petit LaTeX courant (gras, italique, formules…)
    const lines = splitTop(t.replace(/\\\\(\[[^\]]*\])?/g, '\u0001'), '\u0001');
    return lines.map(line => {
      let h = L.inlineLatexToHtml ? L.inlineLatexToHtml(line) : L.escHtml(line);
      const d = document.createElement('div');
      d.innerHTML = h;
      d.querySelectorAll('.imath').forEach(sp => { try { window.katex.render(sp.dataset.latex || '', sp, { throwOnError: false }); } catch (e) { sp.textContent = sp.dataset.latex; } });
      return d.innerHTML;
    }).join('<br>');
  }
  function anchorOf(n, a) {
    const { cx, cy, w, h, shape, rot } = n;
    let dx = 0, dy = 0;
    const hw = w / 2, hh = h / 2;
    const ang = /^\d/.test(a) ? parseFloat(a) : null;
    if (ang !== null) {
      if (shape === 'circle') { dx = hw * Math.cos(ang * Math.PI / 180); dy = hw * Math.sin(ang * Math.PI / 180); }
      else { const b = boxBorder(hw, hh, Math.cos(ang * Math.PI / 180), Math.sin(ang * Math.PI / 180)); dx = b[0]; dy = b[1]; }
    } else {
      const map = { north: [0, 1], south: [0, -1], east: [1, 0], west: [-1, 0], 'north east': [1, 1], 'north west': [-1, 1], 'south east': [1, -1], 'south west': [-1, -1], center: [0, 0], base: [0, -0.5], mid: [0, 0] };
      const v = map[a] || [0, 0];
      if (shape === 'circle' && v[0] && v[1]) { dx = v[0] * hw * Math.SQRT1_2; dy = v[1] * hw * Math.SQRT1_2; }
      else { dx = v[0] * hw; dy = v[1] * hh; }
    }
    if (rot) { const r = rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); [dx, dy] = [dx * c - dy * s, dx * s + dy * c]; }
    return [cx + dx, cy + dy];
  }
  const boxBorder = (hw, hh, ux, uy) => { const t = Math.min(ux ? hw / Math.abs(ux) : Infinity, uy ? hh / Math.abs(uy) : Infinity); return [ux * t, uy * t]; };
  // Point du bord d'un nœud dans la direction d'un autre point (les traits s'arrêtent au bord)
  function borderPoint(n, toward) {
    if (!n || n.kind === 'coordinate') return n ? [n.cx, n.cy] : toward;
    const dx = toward[0] - n.cx, dy = toward[1] - n.cy, d = Math.hypot(dx, dy);
    if (!d) return [n.cx, n.cy];
    const ux = dx / d, uy = dy / d;
    if (n.shape === 'circle') return [n.cx + ux * n.w / 2, n.cy + uy * n.w / 2];
    if (n.shape === 'ellipse') { const t = 1 / Math.sqrt((ux * ux) / (n.w * n.w / 4) + (uy * uy) / (n.h * n.h / 4)); return [n.cx + ux * t, n.cy + uy * t]; }
    const b = boxBorder(n.w / 2, n.h / 2, ux, uy);
    return [n.cx + b[0], n.cy + b[1]];
  }
  function placeNode(nd, env) {
    const st = nd.st, o = nd.o;
    if (nd.kind === 'coordinate' || o.shape === 'coordinate') {
      const at = nd.at || [0, 0];
      if (nd.name) env.names[nd.name] = { kind: 'coordinate', cx: at[0], cy: at[1], w: 0, h: 0 };
      return;
    }
    const fontPt = env.fontPt || 10.95;
    const html = nodeHtml(nd.text);
    const sz = html ? measure(html, st, o, fontPt) : { w: 0, h: 0 };
    const sep = (o.innerSep !== undefined ? o.innerSep : (st.innerSep !== null ? st.innerSep : 3.333 / 28.4527559));
    let w = sz.w + 2 * sep, h = sz.h + 2 * sep;
    if (o.minW) w = Math.max(w, o.minW);
    if (o.minH) h = Math.max(h, o.minH);
    let shape = o.shape || 'rectangle';
    if (shape === 'circle') { const dd = Math.max(Math.hypot(sz.w, sz.h) + 2 * sep, o.minW || 0); w = h = dd; }
    if (shape === 'ellipse') { w = (sz.w + 2 * sep) * Math.SQRT2; h = (sz.h + 2 * sep) * Math.SQRT2; if (o.minW) w = Math.max(w, o.minW); if (o.minH) h = Math.max(h, o.minH); }
    let at = nd.at || [0, 0];
    // « above=of A » (bibliothèque positioning) : à 1 cm du bord de A
    if (o.relOf) {
      const ref = env.names[o.relOf.name];
      if (ref) {
        const dist = o.relOf.dist !== null ? o.relOf.dist : 1;
        const v = { above: [0, 1], below: [0, -1], left: [-1, 0], right: [1, 0], 'above left': [-1, 1], 'above right': [1, 1], 'below left': [-1, -1], 'below right': [1, -1] }[o.dir] || [0, 0];
        const edge = anchorOf(ref, DIR_ANCHOR[o.dir] ? { south: 'north', north: 'south', east: 'west', west: 'east', 'south east': 'north west', 'south west': 'north east', 'north east': 'south west', 'north west': 'south east' }[DIR_ANCHOR[o.dir]] : 'center');
        at = [edge[0] + v[0] * dist * (v[1] ? Math.SQRT1_2 : 1), edge[1] + v[1] * dist * (v[0] ? Math.SQRT1_2 : 1)];
        o.anchor = DIR_ANCHOR[o.dir];
        o.shift = 0;
      } else env.warn('nœud inconnu : ' + o.relOf.name);
    }
    const anchor = o.anchor || 'center';
    const tmp = { cx: 0, cy: 0, w, h, shape, rot: nd.rotate || 0 };
    const off = anchorOf(tmp, anchor);
    let cx = at[0] - off[0], cy = at[1] - off[1];
    if (o.shift && o.dir) {
      const v = { above: [0, 1], below: [0, -1], left: [-1, 0], right: [1, 0], 'above left': [-1, 1], 'above right': [1, 1], 'below left': [-1, -1], 'below right': [1, -1] }[o.dir] || [0, 0];
      cx += v[0] * o.shift; cy += v[1] * o.shift;
    }
    const n = { kind: 'node', cx, cy, w, h, shape, rot: nd.rotate || 0 };
    if (nd.name) env.names[nd.name] = n;
    const drawC = st.draw && st.draw !== 'none' ? (st.draw === 'current' ? st.color : st.draw) : null;
    const fillC = st.fill && st.fill !== 'none' ? (st.fill === 'current' ? st.color : st.fill) : null;
    env.items.push({ type: 'node', n, html, st, o, stroke: drawC, fill: fillC, textColor: st.text || st.color, fontPt, rounded: st.rounded });
    if (o.label) {
      const m = /^(?:([a-z ]+|\d+):)?(.*)$/.exec(strip(o.label));
      const dir = (m[1] || 'above').trim();
      const ang = /^\d/.test(dir) ? null : dir;
      const pos = ang ? anchorOf(n, DIR_ANCHOR[ang] ? { south: 'north', north: 'south', east: 'west', west: 'east', 'south east': 'north west', 'south west': 'north east', 'north east': 'south west', 'north west': 'south east' }[DIR_ANCHOR[ang]] : 'north') : anchorOf(n, dir);
      placeNode({ kind: 'node', text: m[2], at: pos, st: Object.assign(cloneSt(st), { draw: null, fill: null }), o: { anchor: ang ? DIR_ANCHOR[ang] : 'center' }, rotate: 0, pos: null }, env);
    }
  }

  /* ================= Dessin SVG ================= */
  const NS = 'http://www.w3.org/2000/svg';
  const f2 = v => (Math.round(v * 100) / 100).toString();
  const X = x => x * CM, Y = y => -y * CM;
  function segsToD(segs) {
    let d = '';
    segs.forEach(sg => {
      if (sg.t === 'M') d += 'M' + f2(X(sg.p[0][0])) + ' ' + f2(Y(sg.p[0][1]));
      else if (sg.t === 'L') d += 'L' + f2(X(sg.p[0][0])) + ' ' + f2(Y(sg.p[0][1]));
      else if (sg.t === 'C') d += 'C' + sg.p.map(p => f2(X(p[0])) + ' ' + f2(Y(p[1]))).join(' ');
      else if (sg.t === 'Z') d += 'Z';
    });
    return d;
  }
  // Pointes de flèches : forme, recul du trait
  function tipGeom(kind, lw) {
    const lpx = lw * PT;
    switch (kind) {
      case 'stealth': return { len: (3 + 4.5 * lw) * PT, wid: (3 + 4.5 * lw) * PT * 0.75, inset: 0.3, fill: true };
      case 'latex': return { len: (3 + 4.5 * lw) * PT, wid: (3 + 4.5 * lw) * PT * 0.75, inset: 0, fill: true };
      case 'to': case 'to2': return { len: (1.8 + 3.3 * lw) * PT, wid: (1.8 + 3.3 * lw) * PT * 1.6, open: true };
      case 'back': return { len: (1.8 + 3.3 * lw) * PT, wid: (1.8 + 3.3 * lw) * PT * 1.6, open: true, back: true };
      case 'bar': return { len: 0, wid: (2 + 3 * lw) * PT * 2, bar: true };
      case 'dot': return { len: (2 + 2 * lw) * PT, dot: true, fill: true };
      case 'circle': return { len: (2 + 2 * lw) * PT, dot: true, fill: false };
      case 'round': return { len: (1.5 + 2 * lw) * PT, round: true };
      default: return { len: 3 * lpx, wid: 3 * lpx, fill: true };
    }
  }
  function tipPath(kind, tip, p, ux, uy, lw) {
    // p : bout du trait (px, repère SVG), (ux,uy) : direction de la flèche
    const px = -uy, py = ux;
    const L0 = tip.len, W = (tip.wid || 0) / 2;
    if (tip.bar) return { d: 'M' + f2(p[0] + px * W) + ' ' + f2(p[1] + py * W) + 'L' + f2(p[0] - px * W) + ' ' + f2(p[1] - py * W), fill: false };
    if (tip.dot) { const r = L0 / 2; const c = [p[0] - ux * r, p[1] - uy * r]; return { d: 'M' + f2(c[0] + r) + ' ' + f2(c[1]) + 'A' + f2(r) + ' ' + f2(r) + ' 0 1 0 ' + f2(c[0] - r) + ' ' + f2(c[1]) + 'A' + f2(r) + ' ' + f2(r) + ' 0 1 0 ' + f2(c[0] + r) + ' ' + f2(c[1]) + 'Z', fill: tip.fill, closed: true }; }
    if (tip.round) { const a = [p[0] - ux * L0 + px * L0, p[1] - uy * L0 + py * L0], b = [p[0] - ux * L0 - px * L0, p[1] - uy * L0 - py * L0]; return { d: 'M' + f2(a[0]) + ' ' + f2(a[1]) + 'Q' + f2(p[0] + ux * L0 * 0.4) + ' ' + f2(p[1] + uy * L0 * 0.4) + ' ' + f2(b[0]) + ' ' + f2(b[1]), fill: false }; }
    if (tip.open) {
      const dir = tip.back ? -1 : 1;
      const tipPt = tip.back ? [p[0] - ux * L0, p[1] - uy * L0] : p;
      const a = [tipPt[0] - dir * ux * L0 + px * W, tipPt[1] - dir * uy * L0 + py * W];
      const b = [tipPt[0] - dir * ux * L0 - px * W, tipPt[1] - dir * uy * L0 - py * W];
      let d = 'M' + f2(a[0]) + ' ' + f2(a[1]) + 'Q' + f2(tipPt[0] - dir * ux * L0 * 0.25 + px * W * 0.1) + ' ' + f2(tipPt[1] - dir * uy * L0 * 0.25 + py * W * 0.1) + ' ' + f2(tipPt[0]) + ' ' + f2(tipPt[1])
        + 'Q' + f2(tipPt[0] - dir * ux * L0 * 0.25 - px * W * 0.1) + ' ' + f2(tipPt[1] - dir * uy * L0 * 0.25 - py * W * 0.1) + ' ' + f2(b[0]) + ' ' + f2(b[1]);
      if (kind === 'to2') { const q = [tipPt[0] - ux * L0 * 0.9, tipPt[1] - uy * L0 * 0.9]; d += tipPath('to', tip, q, ux, uy, lw).d; }
      return { d, fill: false };
    }
    const base = [p[0] - ux * L0, p[1] - uy * L0];
    const inner = [p[0] - ux * L0 * (1 - tip.inset), p[1] - uy * L0 * (1 - tip.inset)];
    return { d: 'M' + f2(p[0]) + ' ' + f2(p[1]) + 'L' + f2(base[0] + px * W) + ' ' + f2(base[1] + py * W) + 'L' + f2(inner[0]) + ' ' + f2(inner[1]) + 'L' + f2(base[0] - px * W) + ' ' + f2(base[1] - py * W) + 'Z', fill: true, closed: true };
  }
  // Bout d'un chemin et sa direction (pour les flèches), puis recul du trait
  function pathEnds(segs) {
    const real = segs.filter(s => s.t !== 'M' || true);
    let first = null, last = null;
    for (let k = 0; k < real.length; k++) if (real[k].t !== 'M' && real[k].t !== 'Z') { last = k; if (first === null) first = k; }
    if (first === null) return null;
    const prevPt = k => { for (let j = k - 1; j >= 0; j--) return endOf(real[j]); return null; };
    const startPt = prevPt(first), fs = real[first];
    const startDir = fs.t === 'C' ? [fs.p[0][0] - startPt[0], fs.p[0][1] - startPt[1]] : [endOf(fs)[0] - startPt[0], endOf(fs)[1] - startPt[1]];
    const ls = real[last], lp = prevPt(last);
    const endDir = ls.t === 'C' ? [ls.p[2][0] - ls.p[1][0], ls.p[2][1] - ls.p[1][1]] : [endOf(ls)[0] - lp[0], endOf(ls)[1] - lp[1]];
    return { first, last, startPt, startDir, endPt: endOf(ls), endDir };
  }
  function shorten(segs, which, by) {
    // recule le début (which=0) ou la fin (1) du chemin de « by » cm
    const e = pathEnds(segs);
    if (!e || by <= 0) return;
    const norm = v => { const d = Math.hypot(v[0], v[1]) || 1; return [v[0] / d, v[1] / d]; };
    if (which === 1) {
      const sg = segs[e.last], u = norm(e.endDir);
      const p = endOf(sg), np = [p[0] - u[0] * by, p[1] - u[1] * by];
      sg.p = sg.p.slice(); sg.p[sg.p.length - 1] = np;
      if (sg.t === 'C') sg.p[1] = [sg.p[1][0] - u[0] * by, sg.p[1][1] - u[1] * by];
    } else {
      const k = e.first - 1, u = norm(e.startDir);
      if (k < 0) return;
      const sg = segs[k], p = endOf(sg), np = [p[0] + u[0] * by, p[1] + u[1] * by];
      sg.p = sg.p.slice(); sg.p[sg.p.length - 1] = np;
      const fs = segs[e.first];
      if (fs.t === 'C') { fs.p = fs.p.slice(); fs.p[0] = [fs.p[0][0] + u[0] * by, fs.p[0][1] + u[1] * by]; }
    }
  }

  function toSvg(res, fontPt) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'tikz-svg');
    svg.setAttribute('xmlns', NS);
    let bb = null;
    const grow = (x, y, pad) => {
      pad = pad || 0;
      if (!bb) bb = [x - pad, y - pad, x + pad, y + pad];
      else { bb[0] = Math.min(bb[0], x - pad); bb[1] = Math.min(bb[1], y - pad); bb[2] = Math.max(bb[2], x + pad); bb[3] = Math.max(bb[3], y + pad); }
    };
    const defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    let gid = 0;
    let clipId = null;
    const group0 = document.createElementNS(NS, 'g');
    svg.appendChild(group0);
    let target = group0;
    res.items.forEach(it => {
      if (it.type === 'clipEnd') { if (target !== group0) target = target.parentNode; return; }
      if (it.type === 'clip') {
        const cp = document.createElementNS(NS, 'clipPath');
        clipId = 'tz' + Math.random().toString(36).slice(2, 8) + (gid++);
        cp.setAttribute('id', clipId);
        const p = document.createElementNS(NS, 'path'); p.setAttribute('d', segsToD(it.segs)); cp.appendChild(p);
        defs.appendChild(cp);
        const g = document.createElementNS(NS, 'g'); g.setAttribute('clip-path', 'url(#' + clipId + ')');
        target.appendChild(g); target = g;
        it.segs.forEach(sg => sg.p.forEach(p => grow(X(p[0]), Y(p[1]))));
        return;
      }
      if (it.type === 'path') {
        const segs = it.segs.map(sg => ({ t: sg.t, p: sg.p.slice() }));
        const lwpx = it.lw * PT;
        const tips = [];
        if (it.arrows && it.stroke) {
          const e = pathEnds(segs);
          if (e) {
            const add = (kind, pt, dir) => {
              if (!kind) return;
              const tip = tipGeom(kind, it.lw);
              const d = Math.hypot(dir[0], dir[1]) || 1;
              const ux = dir[0] / d, uy = -dir[1] / d;   // repère SVG (y vers le bas)
              const tp = tipPath(kind, tip, [X(pt[0]), Y(pt[1])], ux, uy, it.lw);
              tp.at = [X(pt[0]), Y(pt[1])]; tp.r = Math.max(tip.len || 0, (tip.wid || 0) / 2) + it.lw * PT;
              tips.push(tp);
              return tip.fill && !tip.dot ? tip.len * (1 - (tip.inset || 0)) * 0.9 / CM : 0;
            };
            const s1 = add(resolveTip(it.arrows.end, false, it.tipDef), e.endPt, e.endDir);
            const s0 = add(resolveTip(it.arrows.start, true, it.tipDef), e.startPt, [-e.startDir[0], -e.startDir[1]]);
            if (s1) shorten(segs, 1, s1);
            if (s0) shorten(segs, 0, s0);
          }
        }
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', segsToD(segs));
        let fill = it.fill ? css(it.fill) : 'none';
        if (it.shade) {
          const sh = it.shade;
          const g = document.createElementNS(NS, sh['inner color'] || sh['outer color'] || sh['ball color'] ? 'radialGradient' : 'linearGradient');
          const id = 'tzg' + Math.random().toString(36).slice(2, 8) + (gid++);
          g.setAttribute('id', id);
          let c1, c2;
          if (sh['ball color']) { c1 = BASE.white; c2 = sh['ball color']; g.setAttribute('cx', '35%'); g.setAttribute('cy', '35%'); }
          else if (sh['inner color'] || sh['outer color']) { c1 = sh['inner color'] || BASE.white; c2 = sh['outer color'] || BASE.gray; }
          else if (sh['left color'] || sh['right color']) { c1 = sh['left color'] || BASE.white; c2 = sh['right color'] || BASE.gray; }
          else { g.setAttribute('x1', '0'); g.setAttribute('y1', '0'); g.setAttribute('x2', '0'); g.setAttribute('y2', '1'); c1 = sh['top color'] || BASE.white; c2 = sh['bottom color'] || BASE.gray; }
          [[0, c1], [1, c2]].forEach(([o, c]) => { const st = document.createElementNS(NS, 'stop'); st.setAttribute('offset', String(o)); st.setAttribute('stop-color', css(c)); g.appendChild(st); });
          defs.appendChild(g);
          fill = 'url(#' + id + ')';
        }
        p.setAttribute('fill', fill);
        if (it.evenOdd) p.setAttribute('fill-rule', 'evenodd');
        if (it.stroke) {
          p.setAttribute('stroke', css(it.stroke));
          p.setAttribute('stroke-width', f2(lwpx));
          if (it.dash) p.setAttribute('stroke-dasharray', it.dash.map(v => f2(v * PT)).join(' '));
          p.setAttribute('stroke-linecap', it.cap || 'butt');
          p.setAttribute('stroke-linejoin', it.join || 'miter');
          p.setAttribute('stroke-miterlimit', '10');
        } else p.setAttribute('stroke', 'none');
        if (it.opacity !== 1) p.setAttribute('opacity', String(it.opacity));
        if (it.fillOpacity !== 1 && it.fill) p.setAttribute('fill-opacity', String(it.fillOpacity));
        if (it.drawOpacity !== 1 && it.stroke) p.setAttribute('stroke-opacity', String(it.drawOpacity));
        target.appendChild(p);
        tips.forEach(t => {
          const tp = document.createElementNS(NS, 'path');
          tp.setAttribute('d', t.d);
          tp.setAttribute('fill', t.fill ? css(it.stroke) : 'none');
          tp.setAttribute('stroke', css(it.stroke));
          tp.setAttribute('stroke-width', f2(lwpx * (t.fill ? 0.6 : 1)));
          tp.setAttribute('stroke-linejoin', t.fill ? 'miter' : 'round');
          tp.setAttribute('stroke-linecap', 'round');
          if (it.opacity !== 1) tp.setAttribute('opacity', String(it.opacity));
          target.appendChild(tp);
        });
        const pad = it.stroke ? lwpx / 2 : 0;
        segs.forEach(sg => sg.p.forEach(q => grow(X(q[0]), Y(q[1]), pad)));
        tips.forEach(t => grow(t.at[0], t.at[1], t.r));   // la pointe tient dans un disque autour du bout du trait
        return;
      }
      if (it.type === 'node') {
        const n = it.n;
        const g = document.createElementNS(NS, 'g');
        const cx = X(n.cx), cy = Y(n.cy), w = n.w * CM, h = n.h * CM;
        if (n.rot) g.setAttribute('transform', 'rotate(' + f2(-n.rot) + ' ' + f2(cx) + ' ' + f2(cy) + ')');
        if (it.stroke || it.fill) {
          let shp;
          if (n.shape === 'circle' || n.shape === 'ellipse') {
            shp = document.createElementNS(NS, 'ellipse');
            shp.setAttribute('cx', f2(cx)); shp.setAttribute('cy', f2(cy)); shp.setAttribute('rx', f2(w / 2)); shp.setAttribute('ry', f2(h / 2));
          } else {
            shp = document.createElementNS(NS, 'rect');
            shp.setAttribute('x', f2(cx - w / 2)); shp.setAttribute('y', f2(cy - h / 2)); shp.setAttribute('width', f2(w)); shp.setAttribute('height', f2(h));
            if (it.rounded) { shp.setAttribute('rx', f2(it.rounded * CM)); shp.setAttribute('ry', f2(it.rounded * CM)); }
          }
          shp.setAttribute('fill', it.fill ? css(it.fill) : 'none');
          if (it.stroke) { shp.setAttribute('stroke', css(it.stroke)); shp.setAttribute('stroke-width', f2(it.st.lw * PT)); if (it.st.dash) shp.setAttribute('stroke-dasharray', it.st.dash.map(v => f2(v * PT)).join(' ')); }
          if (it.st.opacity !== 1) shp.setAttribute('opacity', String(it.st.opacity));
          if (it.st.fillOpacity !== 1 && it.fill) shp.setAttribute('fill-opacity', String(it.st.fillOpacity));
          g.appendChild(shp);
        }
        if (it.html) {
          const fo = document.createElementNS(NS, 'foreignObject');
          const tw = w + 4, th = h + 4;
          fo.setAttribute('x', f2(cx - tw / 2)); fo.setAttribute('y', f2(cy - th / 2)); fo.setAttribute('width', f2(tw)); fo.setAttribute('height', f2(th));
          const div = document.createElement('div');
          div.className = 'tikz-text';
          div.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;line-height:1.2;'
            + 'font-size:' + (it.fontPt * it.st.font) + 'pt;color:' + css(it.textColor) + ';'
            + (it.st.bold ? 'font-weight:bold;' : '') + (it.st.italic ? 'font-style:italic;' : '')
            + 'text-align:' + (it.o.align === 'right' ? 'right' : it.o.align === 'left' ? 'left' : 'center') + ';'
            + (it.o.textWidth ? 'white-space:normal;' : 'white-space:nowrap;')
            + (it.st.opacity !== 1 ? 'opacity:' + it.st.opacity + ';' : '');
          const inner = document.createElement('div');
          if (it.o.textWidth) inner.style.width = (it.o.textWidth * CM) + 'px';
          inner.innerHTML = it.html;
          div.appendChild(inner);
          fo.appendChild(div);
          g.appendChild(fo);
        }
        target.appendChild(g);
        const pad = it.stroke ? it.st.lw * PT / 2 : 0;
        const r = n.rot * Math.PI / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
        const bw = (w * c + h * s) / 2, bh = (w * s + h * c) / 2;
        grow(cx - bw, cy - bh, pad); grow(cx + bw, cy + bh, pad);
      }
    });
    if (!bb) bb = [0, 0, 1, 1];
    const pad = 1;
    const vb = [bb[0] - pad, bb[1] - pad, bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad];
    svg.setAttribute('viewBox', vb.map(f2).join(' '));
    svg.setAttribute('width', f2(vb[2]));
    svg.setAttribute('height', f2(vb[3]));
    svg.style.overflow = 'visible';
    return svg;
  }

  /* ================= API ================= */
  const FONT_PT = { 8: 8, 9: 9, 10: 10, 11: 10.95, 12: 12, 14: 14.4, 17: 17.28 };
  // Dessine le code ; renvoie { svg, error, warnings }
  function render(code, opts) {
    opts = opts || {};
    const fontPt = FONT_PT[opts.fontSize] || 10.95;
    let res = null, error = null;
    try {
      res = interpret(code, Object.assign({}, opts, { fontPt }));
    } catch (e) {
      error = e.message || String(e);
    }
    if (!res) return { svg: null, error, warnings: [] };
    if (res.error) error = res.error;
    let svg = null;
    try { svg = toSvg(res, fontPt); } catch (e) { error = error || ('dessin impossible : ' + e.message); }
    return { svg, error, warnings: res.warnings, empty: !res.items.length };
  }
  const EXAMPLES = [
    ['Repère et cercle', String.raw`\begin{tikzpicture}
  \draw[help lines, step=0.5] (-1.5,-1.5) grid (2.5,1.5);
  \draw[thick, ->] (-1.5,0) -- (2.5,0) node[right] {$x$};
  \draw[thick, ->] (0,-1.5) -- (0,1.5) node[above] {$y$};
  \draw[blue, very thick] (0,0) circle (1);
  \filldraw[red] (1,0) circle (2pt) node[below right] {$A$};
\end{tikzpicture}`],
    ['Lignes et point', String.raw`\begin{tikzpicture}
  \draw[gray, thick] (-1,2) -- (2,-4);
  \draw[gray, thick] (-1,-1) -- (2,2);
  \filldraw[black] (0,0) circle (2pt) node[anchor=west] {Point d'intersection};
\end{tikzpicture}`],
    ['Formes de base', String.raw`\begin{tikzpicture}
  \filldraw[color=red!60, fill=red!5, very thick] (-1,0) circle (1.5);
  \fill[blue!50] (2.5,0) ellipse (1.5 and 0.5);
  \draw[ultra thick, ->] (6.5,0) arc (0:220:1);
  \draw[dashed, green!50!black, thick] (4.2,-1) rectangle (5.4,1);
\end{tikzpicture}`],
    ['Courbe de fonction', String.raw`\begin{tikzpicture}[scale=0.9]
  \draw[help lines] (-2.5,-0.5) grid (2.5,4.5);
  \draw[->] (-2.7,0) -- (2.9,0) node[right] {$x$};
  \draw[->] (0,-0.7) -- (0,4.7) node[above] {$y$};
  \draw[domain=-2:2, smooth, variable=\x, blue, very thick] plot ({\x}, {\x*\x}) node[right] {$y = x^2$};
  \foreach \x in {-2,-1,1,2} \draw (\x,0.08) -- (\x,-0.08) node[below] {$\x$};
\end{tikzpicture}`],
    ['Cercle trigonométrique', String.raw`\begin{tikzpicture}[scale=2]
  \draw[->] (-1.3,0) -- (1.3,0) node[right] {$x$};
  \draw[->] (0,-1.3) -- (0,1.3) node[above] {$y$};
  \draw[thick] (0,0) circle (1);
  \draw[very thick, red] (0,0) -- (30:1) node[above right] {$M$};
  \draw[blue, dashed] (30:1) -- (30:1 |- 0,0) node[below] {$\cos\theta$};
  \draw[blue, dashed] (30:1) -- (30:1 -| 0,0) node[left] {$\sin\theta$};
  \draw[green!50!black, thick, ->] (0.35,0) arc (0:30:0.35);
  \node[green!50!black] at (15:0.55) {$\theta$};
\end{tikzpicture}`],
    ['Triangle', String.raw`\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (4,0);
  \coordinate (C) at (1,2.5);
  \draw[thick, fill=blue!8] (A) -- (B) -- (C) -- cycle;
  \node[below left] at (A) {$A$};
  \node[below right] at (B) {$B$};
  \node[above] at (C) {$C$};
  \draw[red, thick] (0.6,0) arc (0:68.2:0.6);
  \draw (A) -- node[below] {$c$} (B);
\end{tikzpicture}`],
    ['Schéma avec nœuds', String.raw`\begin{tikzpicture}[
  rond/.style={circle, draw=red!60, fill=red!5, very thick, minimum size=9mm},
  boite/.style={rectangle, draw=blue!60, fill=blue!5, very thick, minimum size=9mm, rounded corners}]
  \node[rond] (e) {Entrée};
  \node[boite] (c) [right=of e] {Calcul};
  \node[rond] (s) [right=of c] {Sortie};
  \draw[->, thick] (e) -- (c);
  \draw[->, thick] (c) -- (s);
\end{tikzpicture}`],
    ['Rosace (\\foreach)', String.raw`\begin{tikzpicture}
  \foreach \a in {0,30,...,330}
    \draw[blue!60, thick] (0,0) -- (\a:2) circle (2pt);
  \draw[red, very thick] (0,0) circle (2);
\end{tikzpicture}`],
  ];
  L.TikZ = { render, evalExpr, EXAMPLES, parseColor: s => parseColor(s, { colors: {} }) };
})();
