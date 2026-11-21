/* Schémas de Lewis (module complémentaire « lewis ») : le modèle d'un schéma construit à la
   souris, et son code TikZ. Le bloc reste un bloc « tikz » ordinaire (aperçu, PDF, export
   LaTeX inchangés) qui garde son modèle dans b.lw pour rester modifiable à la souris.
   Éditeur : js/lewis-ui.js

   Modèle : lw = { items: [...], opts: { lp, charge, lac, blen } } — coordonnées en cm, y vers le haut.
   Éléments (champ t) :
     atom   p, el (symbole « O », « Cl »… ou groupe « CH3 »), q (charge formelle),
            auto (doublets, électrons célibataires et lacunes calculés), lp, rad, vac (leur
            nombre quand auto est faux), ang (angles imposés de ces groupes d'électrons, ou
            null), qa (angle imposé de la charge, ou null), c (couleur)
     bond   a, b (identifiants des deux atomes), o (1, 2 ou 3), c (couleur)
     arrow  p: [A, B], k ('->' réaction, '<->' mésomérie), c
     curve  p: [A, B], bend (courbure : fraction de la longueur, signe = côté), c
     text   p, lab ({ latex, mode : 'm' formule | 't' texte }), c
   Options : lp ('trait' | 'points' : dessin des doublets non liants), charge ('cercle' ⊕ |
   'simple' +), lac (lacunes ajoutées automatiquement), blen (longueur des nouvelles liaisons). */
(function () {
  const r2 = v => { const r = Math.round(v * 100) / 100; return String(Object.is(r, -0) ? 0 : r); };
  const P = p => '(' + r2(p[0]) + ',' + r2(p[1]) + ')';
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const pt = (q, d) => Array.isArray(q) && q.length >= 2 ? [num(+q[0], d ? d[0] : 0), num(+q[1], d ? d[1] : 0)] : (d || [0, 0]).slice();
  const rad = a => a * Math.PI / 180;
  const deg = (x, y) => ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  const mod360 = a => ((a % 360) + 360) % 360;
  const adist = (a, b) => { const d = Math.abs(mod360(a) - mod360(b)) % 360; return d > 180 ? 360 - d : d; };

  /* ---------- Éléments ---------- */
  // Électrons de valence (éléments des blocs s et p)
  const VAL = {
    H: 1, He: 2, Li: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7, Ne: 8,
    Na: 1, Mg: 2, Al: 3, Si: 4, P: 5, S: 6, Cl: 7, Ar: 8,
    K: 1, Ca: 2, Ga: 3, Ge: 4, As: 5, Se: 6, Br: 7, Kr: 8,
    Rb: 1, Sr: 2, In: 3, Sn: 4, Sb: 5, Te: 6, I: 7, Xe: 8,
    Cs: 1, Ba: 2, Tl: 3, Pb: 4, Bi: 5, Po: 6, At: 7, Rn: 8,
  };
  const NAMES = {
    H: 'hydrogène', He: 'hélium', Li: 'lithium', Be: 'béryllium', B: 'bore', C: 'carbone', N: 'azote', O: 'oxygène', F: 'fluor', Ne: 'néon',
    Na: 'sodium', Mg: 'magnésium', Al: 'aluminium', Si: 'silicium', P: 'phosphore', S: 'soufre', Cl: 'chlore', Ar: 'argon',
    K: 'potassium', Ca: 'calcium', Ga: 'gallium', Ge: 'germanium', As: 'arsenic', Se: 'sélénium', Br: 'brome', Kr: 'krypton',
    Rb: 'rubidium', Sr: 'strontium', In: 'indium', Sn: 'étain', Sb: 'antimoine', Te: 'tellure', I: 'iode', Xe: 'xénon',
    Cs: 'césium', Ba: 'baryum', Tl: 'thallium', Pb: 'plomb', Bi: 'bismuth', Po: 'polonium', At: 'astate', Rn: 'radon',
  };
  const PERIOD1 = { H: 1, He: 1 }, PERIOD2 = { Li: 1, Be: 1, B: 1, C: 1, N: 1, O: 1, F: 1, Ne: 1 };
  const period = el => PERIOD1[el] ? 1 : PERIOD2[el] ? 2 : 3;     // 3 : troisième période ou au-delà
  const known = el => VAL[el] !== undefined;
  // Symbole saisi : « cl » → « Cl », « ch3 » → « CH3 » ; groupes : lettres, chiffres, parenthèses
  function cleanEl(s) {
    s = String(s || '').replace(/[^A-Za-z0-9()']/g, '').slice(0, 8);
    if (!s) return '';
    const cap = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    if (known(cap)) return cap;
    if (known(s)) return s;
    return /^[a-z]/.test(s) ? s.toUpperCase() : s;
  }

  /* ---------- Couleurs ---------- */
  const COLORS = { noir: 'black', rouge: 'red!80!black', bleu: 'blue!75!black', vert: 'green!50!black', orange: 'orange!95!black', violet: 'violet', gris: 'gray', marron: 'brown!80!black' };
  const col = c => (c && c !== 'noir' && COLORS[c]) ? COLORS[c] : '';
  const DEF = { lp: 'trait', charge: 'cercle', lac: true, blen: 1 };
  const opts = lw => Object.assign({}, DEF, (lw && lw.opts) || {});

  /* ---------- Géométrie d'un symbole (cm, police de 11 pt) ----------
     Le symbole est vu comme une ellipse : les liaisons partent de son bord, les doublets et
     les charges se placent juste autour. Largeurs de la police Computer Modern (em). */
  const EM = 0.3866;
  function textW(el) {
    let w = 0;
    for (const ch of String(el || '')) {
      if (/[0-9]/.test(ch)) w += 0.36;
      else if (/[IJ]/.test(ch)) w += 0.42;
      else if (/[MW]/.test(ch)) w += 0.95;
      else if (/[A-Z]/.test(ch)) w += 0.74;
      else if (/[il']/.test(ch)) w += 0.28;
      else if (/[m]/.test(ch)) w += 0.83;
      else if (/[()]/.test(ch)) w += 0.39;
      else w += 0.48;
    }
    return Math.max(w, 0.5) * EM;
  }
  const RY = 0.205;
  // Distance du centre du symbole à son bord dans la direction a (degrés)
  function clear(el, a) {
    const rx = textW(el) / 2 + 0.06, c = Math.cos(rad(a)), s = Math.sin(rad(a));
    return 1 / Math.sqrt(c * c / (rx * rx) + s * s / (RY * RY));
  }

  /* ---------- Électrons d'un atome ---------- */
  const atoms = lw => lw.items.filter(i => i.t === 'atom');
  const bondsOf = (lw, id) => lw.items.filter(i => i.t === 'bond' && (i.a === id || i.b === id));
  const byId = (lw, id) => lw.items.find(i => i.id === id);
  const other = (b, id) => (b.a === id ? b.b : b.a);
  const bondSum = (lw, id) => bondsOf(lw, id).reduce((s, b) => s + (b.o || 1), 0);
  /* Doublets non liants, électrons célibataires, lacunes. Automatique : électrons non liants
     = électrons de valence − charge formelle − liaisons ; lacunes pour compléter l'octet d'un
     atome lié (bore, carbocation…). */
  function electrons(lw, a) {
    const bs = bondSum(lw, a.id), o = opts(lw);
    if (a.auto === false || !known(a.el)) {
      if (a.auto !== false) return { lp: 0, rad: 0, vac: 0, bs, over: false };
      return { lp: Math.max(0, a.lp | 0), rad: Math.max(0, a.rad | 0), vac: Math.max(0, a.vac | 0), bs, over: false };
    }
    let e = VAL[a.el] - (a.q || 0) - bs;
    const over = e < 0;
    if (e < 0) e = 0;
    let lp = Math.floor(e / 2), r = e % 2;
    // atome seul (ni liaison) : électrons célibataires d'abord, comme dans le schéma de Lewis
    // des atomes (C : 4 électrons célibataires ; O : 2 doublets et 2 électrons célibataires)
    if (!bs) {
      const cap = period(a.el) === 1 ? 2 : 8;
      r = e <= cap ? Math.min(e, cap - e) : e % 2;
      lp = (e - r) / 2;
    }
    let vac = 0;
    if (o.lac !== false && bs > 0 && VAL[a.el] >= 2 && period(a.el) > 1) {
      const around = 2 * bs + e;
      if (around < 8) vac = Math.floor((8 - around) / 2);
    }
    return { lp, rad: r, vac, bs, over };
  }
  // Bilan d'un atome : électrons autour, charge formelle attendue, remarques
  function check(lw, a) {
    const ex = electrons(lw, a), out = { ...ex, notes: [], warn: false };
    if (!known(a.el)) { out.notes.push('Groupe « ' + a.el + ' » : électrons non vérifiés.'); return out; }
    const around = 2 * ex.bs + 2 * ex.lp + ex.rad, fc = VAL[a.el] - (2 * ex.lp + ex.rad) - ex.bs;
    out.around = around; out.fc = fc;
    const nm = a.el;
    const pl = (n, w) => n + ' ' + w + (n > 1 ? 's' : '');
    if (ex.over) { out.notes.push(nm + ' : trop de liaisons pour sa charge (' + pl(ex.bs, 'liaison') + ', ' + pl(VAL[a.el], 'électron') + ' de valence).'); out.warn = true; }
    else if (fc !== (a.q || 0)) { out.notes.push(nm + ' : la charge formelle devrait être ' + qText(fc) + ' (dessinée : ' + qText(a.q || 0) + ').'); out.warn = true; }
    if (period(a.el) === 1) {
      if (around > 2) { out.notes.push(nm + ' : ' + around + ' électrons, plus que le duet (2) : impossible.'); out.warn = true; }
    } else if (period(a.el) === 2) {
      if (around > 8) { out.notes.push(nm + ' : ' + around + ' électrons : l\'octet ne peut pas être dépassé dans la 2e période.'); out.warn = true; }
      else if (around < 8 && ex.bs > 0 && VAL[a.el] >= 4 && !ex.rad) out.notes.push(nm + ' : ' + around + ' électrons, octet non atteint' + (ex.vac ? ' (lacune).' : '.'));
    } else if (around > 8) out.notes.push(nm + ' : ' + around + ' électrons, hypervalence (possible à partir de la 3e période).');
    return out;
  }
  const qText = q => !q ? '0' : (Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '−');
  // Bilan du schéma : électrons de valence attendus et dessinés
  function summary(lw) {
    const at = atoms(lw);
    let val = 0, drawn = 0, charge = 0, unknown = 0, warn = 0;
    const notes = [];
    at.forEach(a => {
      const c = check(lw, a);
      if (!known(a.el)) { unknown++; return; }
      val += VAL[a.el]; charge += a.q || 0;
      drawn += 2 * c.lp + c.rad;
      c.notes.forEach(n => notes.push({ n, warn: c.warn }));
      if (c.warn) warn++;
    });
    lw.items.forEach(b => { if (b.t === 'bond' && byId(lw, b.a) && byId(lw, b.b) && known(byId(lw, b.a).el) && known(byId(lw, b.b).el)) drawn += 2 * (b.o || 1); });
    return { atoms: at.length, val: val - charge, drawn, charge, unknown, notes, warn };
  }

  /* ---------- Place des doublets, électrons célibataires, lacunes et charge ----------
     Les groupes d'électrons vont dans les plus grands espaces libres entre les liaisons
     (ou en croix autour d'un atome seul) ; la charge se met dans l'espace qui reste, en
     haut à droite de préférence. */
  const ALONE = { 1: [90], 2: [90, 270], 3: [90, 180, 0], 4: [90, 270, 180, 0], 5: [90, 270, 180, 0, 45], 6: [90, 270, 180, 0, 45, 225] };
  function bondDirs(lw, a) {
    return bondsOf(lw, a.id).map(b => { const o = byId(lw, other(b, a.id)); return o ? deg(o.p[0] - a.p[0], o.p[1] - a.p[1]) : null; }).filter(v => v !== null);
  }
  function groupAngles(lw, a, n) {
    if (!n) return [];
    if (Array.isArray(a.ang) && a.ang.length === n) return a.ang.map(v => mod360(+v || 0));
    const dirs = bondDirs(lw, a).sort((x, y) => x - y);
    if (!dirs.length) return (ALONE[n] || ALONE[6].concat(Array.from({ length: n - 6 }, (_, k) => 135 + 90 * k))).slice(0, n);
    const gaps = dirs.map((d, i) => { const nx = i + 1 < dirs.length ? dirs[i + 1] : dirs[0] + 360; return { a: d, s: nx - d || 360, k: 0 }; });
    for (let i = 0; i < n; i++) {
      let best = null, bs = -1;
      gaps.forEach(g => {
        const sc = g.s / (g.k + 1), mid = g.a + g.s / 2;
        if (sc > bs + 1e-6 || (Math.abs(sc - bs) <= 1e-6 && adist(mid, 90) < adist(best.a + best.s / 2, 90))) { bs = sc; best = g; }
      });
      best.k++;
    }
    const out = [];
    gaps.forEach(g => { for (let j = 0; j < g.k; j++) out.push(mod360(g.a + g.s * (j + 1) / (g.k + 1))); });
    // ordre stable : du haut, dans le sens des aiguilles d'une montre
    return out.sort((x, y) => mod360(90 - x) - mod360(90 - y));
  }
  function chargeAngle(lw, a, used) {
    if (typeof a.qa === 'number' && isFinite(a.qa)) return mod360(a.qa);
    const busy = bondDirs(lw, a).concat(used);
    if (!busy.length) return 45;
    let best = 45, bs = -1;
    for (let c = 0; c < 360; c += 15) {
      const m = Math.min(...busy.map(b => adist(b, c)));
      const sc = Math.min(m, 70) - adist(c, 45) * 0.08;
      if (sc > bs) { bs = sc; best = c; }
    }
    return best;
  }
  /* Tout ce qui entoure un atome : liste des groupes { k: 'lp' | 'rad' | 'vac', a } et charge */
  function layout(lw, a) {
    const ex = electrons(lw, a);
    const kinds = [].concat(Array(ex.lp).fill('lp'), Array(ex.rad).fill('rad'), Array(ex.vac).fill('vac'));
    const angs = groupAngles(lw, a, kinds.length);
    const groups = kinds.map((k, i) => ({ k, a: angs[i] }));
    const qa = a.q ? chargeAngle(lw, a, angs) : null;
    return { groups, qa, ex };
  }
  // Positions (cm) utiles à l'éditeur : centre d'un groupe d'électrons, de la charge
  const LP_OFF = 0.075, RAD_OFF = 0.065, VAC_OFF = 0.105, Q_OFF = 0.17;
  const at = (a, ang, d) => [a.p[0] + d * Math.cos(rad(ang)), a.p[1] + d * Math.sin(rad(ang))];
  const groupPos = (a, g) => at(a, g.a, clear(a.el, g.a) + (g.k === 'vac' ? VAC_OFF : g.k === 'rad' ? RAD_OFF : LP_OFF));
  const chargePos = (a, qa) => at(a, qa, clear(a.el, qa) + Q_OFF);

  /* ---------- Code TikZ ---------- */
  const opt = list => { const l = list.filter(Boolean); return l.length ? '[' + l.join(', ') + ']' : ''; };
  // Symbole → texte TikZ : chiffres en indice (CH3 → CH$_{3}$)
  const label = el => String(el || '').replace(/[^A-Za-z0-9()']/g, '').replace(/(\d+)/g, '$$_{$1}$$');
  function chargeLabel(q, style) {
    const n = Math.abs(q) > 1 ? String(Math.abs(q)) : '';
    if (style === 'simple') return '$' + n + (q > 0 ? '+' : '-') + '$';
    return '$' + n + (q > 0 ? '\\oplus' : '\\ominus') + '$';
  }
  function bondCode(lw, b, out) {
    const A = byId(lw, b.a), B = byId(lw, b.b);
    if (!A || !B || A === B) return;
    const dx = B.p[0] - A.p[0], dy = B.p[1] - A.p[1], len = Math.hypot(dx, dy);
    if (len < 0.05) return;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, ang = deg(dx, dy);
    const s = clear(A.el, ang) + 0.025, e = clear(B.el, ang + 180) + 0.025;
    if (s + e >= len - 0.04) return;
    const o = Math.max(1, Math.min(3, b.o | 0 || 1)), offs = o === 1 ? [0] : o === 2 ? [-0.05, 0.05] : [-0.085, 0, 0.085];
    const c = col(b.c);
    offs.forEach(k => {
      // les traits d'une liaison multiple raccourcissent un peu, comme dans les manuels
      const sh = k ? 0.02 : 0;
      const p0 = [A.p[0] + ux * (s + sh) + nx * k, A.p[1] + uy * (s + sh) + ny * k], p1 = [B.p[0] - ux * (e + sh) + nx * k, B.p[1] - uy * (e + sh) + ny * k];
      out.push('  \\draw' + opt([c]) + ' ' + P(p0) + ' -- ' + P(p1) + ';');
    });
  }
  function atomCode(lw, a, out) {
    const o = opts(lw), c = col(a.c), L0 = layout(lw, a);
    out.push('  \\node' + opt(['inner sep=1pt', c ? 'text=' + c : '']) + ' at ' + P(a.p) + ' {' + (label(a.el) || '?') + '};');
    L0.groups.forEach(g => {
      const u = [Math.cos(rad(g.a)), Math.sin(rad(g.a))], v = [-u[1], u[0]], m = groupPos(a, g);
      if (g.k === 'lp') {
        if (o.lp === 'points') [-1, 1].forEach(sg => out.push('  \\fill' + opt([c]) + ' ' + P([m[0] + v[0] * 0.065 * sg - u[0] * 0.01, m[1] + v[1] * 0.065 * sg - u[1] * 0.01]) + ' circle (0.032);'));
        else out.push('  \\draw' + opt([c]) + ' ' + P([m[0] - v[0] * 0.13, m[1] - v[1] * 0.13]) + ' -- ' + P([m[0] + v[0] * 0.13, m[1] + v[1] * 0.13]) + ';');
      } else if (g.k === 'rad') out.push('  \\fill' + opt([c]) + ' ' + P(m) + ' circle (0.037);');
      else {
        const hw = 0.12, hh = 0.05, q = (sv, su) => [m[0] + v[0] * hw * sv + u[0] * hh * su, m[1] + v[1] * hw * sv + u[1] * hh * su];
        out.push('  \\draw' + opt([c, 'thin']) + ' ' + P(q(-1, -1)) + ' -- ' + P(q(1, -1)) + ' -- ' + P(q(1, 1)) + ' -- ' + P(q(-1, 1)) + ' -- cycle;');
      }
    });
    if (a.q) out.push('  \\node' + opt(['inner sep=0pt', 'font=\\footnotesize', c ? 'text=' + c : '']) + ' at ' + P(chargePos(a, L0.qa)) + ' {' + chargeLabel(a.q, o.charge) + '};');
  }
  // Flèche courbe : courbe de Bézier de A à B, bombée sur le côté (bend)
  function curveCtrl(it) {
    const [A, B] = it.p, dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1, k = num(it.bend, 0.4);
    const m = [(A[0] + B[0]) / 2 - dy / len * k * len, (A[1] + B[1]) / 2 + dx / len * k * len];
    return { m, c1: [A[0] + (m[0] - A[0]) * 2 / 3, A[1] + (m[1] - A[1]) * 2 / 3], c2: [B[0] + (m[0] - B[0]) * 2 / 3, B[1] + (m[1] - B[1]) * 2 / 3] };
  }
  // Sommet de la courbe (t = 1/2), poignée de l'éditeur
  const curveTop = it => { const { c1, c2 } = curveCtrl(it), [A, B] = it.p; return [(A[0] + 3 * c1[0] + 3 * c2[0] + B[0]) / 8, (A[1] + 3 * c1[1] + 3 * c2[1] + B[1]) / 8]; };
  function itemCode(lw, it, out) {
    switch (it.t) {
      case 'arrow': out.push('  \\draw' + opt([it.k === '<->' ? '<->' : '->', col(it.c)]) + ' ' + P(it.p[0]) + ' -- ' + P(it.p[1]) + ';'); break;
      case 'curve': { const { c1, c2 } = curveCtrl(it); out.push('  \\draw' + opt(['->', col(it.c)]) + ' ' + P(it.p[0]) + ' .. controls ' + P(c1) + ' and ' + P(c2) + ' .. ' + P(it.p[1]) + ';'); break; }
      case 'text': {
        const t = L.TD ? L.TD.content(it.lab) : '';
        if (t) out.push('  \\node' + opt(['align=center', col(it.c) ? 'text=' + col(it.c) : '']) + ' at ' + P(it.p) + ' {' + t + '};');
        break;
      }
      default: break;
    }
  }
  function toTikz(lw) {
    const out = ['\\begin{tikzpicture}[semithick, line cap=round, line join=round, >=stealth]'];
    const safe = fn => { try { fn(); } catch (e) { /* élément illisible : ignoré */ } };
    lw.items.forEach(it => { if (it.t === 'bond') safe(() => bondCode(lw, it, out)); });
    lw.items.forEach(it => { if (it.t === 'atom') safe(() => atomCode(lw, it, out)); });
    lw.items.forEach(it => { if (it.t !== 'atom' && it.t !== 'bond') safe(() => itemCode(lw, it, out)); });
    out.push('\\end{tikzpicture}');
    return out.join('\n');
  }

  /* ---------- Modèle : identifiants, réparation d'un modèle reçu ---------- */
  const PREFIX = { atom: 'a', bond: 'b', arrow: 'f', curve: 'k', text: 't' };
  function newId(lw, t) {
    const pre = PREFIX[t] || 'x';
    let n = 0;
    lw.items.forEach(i => { if (typeof i.id === 'string' && i.id.startsWith(pre)) { const k = parseInt(i.id.slice(pre.length), 10); if (k > n) n = k; } });
    return pre + (n + 1);
  }
  function repair(lw) {
    lw = lw && typeof lw === 'object' ? lw : {};
    const items = Array.isArray(lw.items) ? lw.items : [];
    const o = Object.assign({}, DEF, lw.opts && typeof lw.opts === 'object' ? lw.opts : {});
    o.lp = o.lp === 'points' ? 'points' : 'trait';
    o.charge = o.charge === 'simple' ? 'simple' : 'cercle';
    o.lac = o.lac !== false;
    o.blen = Math.max(0.5, Math.min(2, num(+o.blen, 1)));
    const out = { items: [], opts: o }, seen = new Set();
    const keep = it => {
      if (!it.id || typeof it.id !== 'string' || seen.has(it.id)) it.id = newId(out, it.t);
      seen.add(it.id);
      if (it.c && !COLORS[it.c]) delete it.c;
      out.items.push(it);
    };
    items.forEach(x => {
      if (!x || typeof x !== 'object') return;
      const it = JSON.parse(JSON.stringify(x));
      switch (it.t) {
        case 'atom':
          it.p = pt(it.p); it.el = cleanEl(it.el) || 'C';
          it.q = Math.max(-4, Math.min(4, Math.round(num(+it.q, 0))));
          it.auto = it.auto !== false;
          ['lp', 'rad', 'vac'].forEach(k => { it[k] = Math.max(0, Math.min(8, Math.round(num(+it[k], 0)))); });
          it.ang = Array.isArray(it.ang) ? it.ang.map(v => mod360(num(+v, 0))) : null;
          it.qa = typeof it.qa === 'number' && isFinite(it.qa) ? mod360(it.qa) : null;
          keep(it); break;
        case 'bond': it.o = Math.max(1, Math.min(3, Math.round(num(+it.o, 1)))); keep(it); break;
        case 'arrow': it.p = [pt(it.p && it.p[0]), pt(it.p && it.p[1], [1, 0])]; it.k = it.k === '<->' ? '<->' : '->'; keep(it); break;
        case 'curve': it.p = [pt(it.p && it.p[0]), pt(it.p && it.p[1], [1, 0])]; it.bend = Math.max(-1.5, Math.min(1.5, num(+it.bend, 0.4))); keep(it); break;
        case 'text': it.p = pt(it.p); it.lab = it.lab && typeof it.lab === 'object' ? { latex: String(it.lab.latex || ''), mode: it.lab.mode === 't' ? 't' : 'm' } : { latex: '', mode: 't' }; keep(it); break;
        default: break;
      }
    });
    // liaisons : deux atomes existants et différents, une seule liaison par paire
    const ids = new Set(out.items.filter(i => i.t === 'atom').map(i => i.id)), pairs = new Set();
    out.items = out.items.filter(i => {
      if (i.t !== 'bond') return true;
      if (!ids.has(i.a) || !ids.has(i.b) || i.a === i.b) return false;
      const k = [i.a, i.b].sort().join('|');
      if (pairs.has(k)) return false;
      pairs.add(k);
      return true;
    });
    return out;
  }
  // Points d'accroche de l'éditeur (cm) : atomes, milieux des liaisons, doublets
  function anchors(lw) {
    const pts = [];
    lw.items.forEach(it => {
      if (it.t === 'atom') {
        pts.push(it.p.slice());
        const L0 = layout(lw, it);
        L0.groups.forEach(g => pts.push(groupPos(it, g)));
      } else if (it.t === 'bond') {
        const A = byId(lw, it.a), B = byId(lw, it.b);
        if (A && B) pts.push([(A.p[0] + B.p[0]) / 2, (A.p[1] + B.p[1]) / 2]);
      }
    });
    return pts;
  }
  function shift(it, dx, dy) {
    if (it.t === 'atom' || it.t === 'text') it.p = [it.p[0] + dx, it.p[1] + dy];
    else if (it.p && Array.isArray(it.p[0])) it.p = it.p.map(q => [q[0] + dx, q[1] + dy]);
  }

  /* ---------- Modèles prêts ---------- */
  // atomes : [symbole, x, y, charge] ; liaisons : [i, j, ordre]
  function mol(atomsL, bondsL, extra) {
    const lw = { items: [], opts: {} };
    atomsL.forEach(([el, x, y, q], i) => lw.items.push({ id: 'a' + (i + 1), t: 'atom', el, p: [x, y], q: q || 0, auto: true }));
    bondsL.forEach(([i, j, o], k) => lw.items.push({ id: 'b' + (k + 1), t: 'bond', a: 'a' + (i + 1), b: 'a' + (j + 1), o: o || 1 }));
    (extra || []).forEach(x => lw.items.push(x));
    return lw;
  }
  const s3 = Math.sqrt(3) / 2;
  const TEMPLATES = [
    { key: 'vide', name: 'Schéma vide', desc: 'Partir de zéro', make: () => ({ items: [], opts: {} }) },
    { key: 'eau', name: 'Eau', f: 'H₂O', make: () => mol([['O', 0, 0], ['H', -0.8, -0.6], ['H', 0.8, -0.6]], [[0, 1], [0, 2]]) },
    { key: 'ammoniac', name: 'Ammoniac', f: 'NH₃', make: () => mol([['N', 0, 0], ['H', -1, 0], ['H', 1, 0], ['H', 0, -1]], [[0, 1], [0, 2], [0, 3]]) },
    { key: 'methane', name: 'Méthane', f: 'CH₄', make: () => mol([['C', 0, 0], ['H', -1, 0], ['H', 1, 0], ['H', 0, 1], ['H', 0, -1]], [[0, 1], [0, 2], [0, 3], [0, 4]]) },
    { key: 'co2', name: 'Dioxyde de carbone', f: 'CO₂', make: () => mol([['O', -1.1, 0], ['C', 0, 0], ['O', 1.1, 0]], [[0, 1, 2], [1, 2, 2]]) },
    { key: 'diazote', name: 'Diazote', f: 'N₂', make: () => mol([['N', -0.55, 0], ['N', 0.55, 0]], [[0, 1, 3]]) },
    { key: 'dioxygene', name: 'Dioxygène', f: 'O₂', make: () => mol([['O', -0.55, 0], ['O', 0.55, 0]], [[0, 1, 2]]) },
    { key: 'hcl', name: 'Chlorure d\'hydrogène', f: 'HCl', make: () => mol([['H', -0.5, 0], ['Cl', 0.55, 0]], [[0, 1]]) },
    { key: 'hcn', name: 'Acide cyanhydrique', f: 'HCN', make: () => mol([['H', -1.05, 0], ['C', 0, 0], ['N', 1.1, 0]], [[0, 1], [1, 2, 3]]) },
    { key: 'methanal', name: 'Méthanal', f: 'H₂CO', make: () => mol([['C', 0, 0], ['O', 1.1, 0], ['H', -0.75, 0.75], ['H', -0.75, -0.75]], [[0, 1, 2], [0, 2], [0, 3]]) },
    { key: 'ethene', name: 'Éthène', f: 'C₂H₄', make: () => mol([['C', -0.55, 0], ['C', 0.55, 0], ['H', -1.25, 0.75], ['H', -1.25, -0.75], ['H', 1.25, 0.75], ['H', 1.25, -0.75]], [[0, 1, 2], [0, 2], [0, 3], [1, 4], [1, 5]]) },
    { key: 'oxonium', name: 'Ion oxonium', f: 'H₃O⁺', make: () => mol([['O', 0, 0, 1], ['H', -1, 0], ['H', 1, 0], ['H', 0, -1]], [[0, 1], [0, 2], [0, 3]]) },
    { key: 'ammonium', name: 'Ion ammonium', f: 'NH₄⁺', make: () => mol([['N', 0, 0, 1], ['H', -1, 0], ['H', 1, 0], ['H', 0, 1], ['H', 0, -1]], [[0, 1], [0, 2], [0, 3], [0, 4]]) },
    { key: 'hydroxyde', name: 'Ion hydroxyde', f: 'HO⁻', make: () => mol([['H', -0.5, 0], ['O', 0.5, 0, -1]], [[0, 1]]) },
    { key: 'bf3', name: 'Trifluorure de bore', f: 'BF₃ (lacune)', make: () => mol([['B', 0, 0], ['F', 0, 1], ['F', -s3, -0.5], ['F', s3, -0.5]], [[0, 1], [0, 2], [0, 3]]) },
    { key: 'co', name: 'Monoxyde de carbone', f: 'CO', make: () => mol([['C', -0.55, 0, -1], ['O', 0.55, 0, 1]], [[0, 1, 3]]) },
    { key: 'no', name: 'Monoxyde d\'azote', f: 'NO (radical)', make: () => mol([['N', -0.55, 0], ['O', 0.55, 0]], [[0, 1, 2]]) },
    { key: 'nitrate', name: 'Ion nitrate', f: 'NO₃⁻', make: () => mol([['N', 0, 0, 1], ['O', 0, 1.05], ['O', -1.05 * s3, -0.525, -1], ['O', 1.05 * s3, -0.525, -1]], [[0, 1, 2], [0, 2], [0, 3]]) },
    { key: 'sulfate', name: 'Ion sulfate', f: 'SO₄²⁻ (hypervalence)', make: () => mol([['S', 0, 0], ['O', 0, 1.05], ['O', 0, -1.05], ['O', -1.05, 0, -1], ['O', 1.05, 0, -1]], [[0, 1, 2], [0, 2, 2], [0, 3], [0, 4]]) },
    { key: 'ozone', name: 'Ozone : mésomérie', f: 'O₃, deux formes', make: () => mol(
      [['O', -2.5, 0.2, 1], ['O', -3.45, -0.35], ['O', -1.55, -0.35, -1], ['O', 2.5, 0.2, 1], ['O', 1.55, -0.35, -1], ['O', 3.45, -0.35]],
      [[0, 1, 2], [0, 2], [3, 4], [3, 5, 2]],
      [{ id: 'f1', t: 'arrow', p: [[-0.55, -0.1], [0.55, -0.1]], k: '<->' },
        { id: 'k1', t: 'curve', p: [[-1.4, -0.06], [-1.98, 0.02]], bend: -0.75 },
        { id: 'k2', t: 'curve', p: [[-2.96, 0.03], [-3.5, -0.1]], bend: -0.75 }]) },
  ];

  /* ---------- Lien avec le document ---------- */
  function sync(block) {
    if (!block || !block.lw) return block;
    block.code = toTikz(block.lw);
    return block;
  }
  L.newLewis = function (key) {
    const t = TEMPLATES.find(x => x.key === key) || TEMPLATES[1];
    return sync(L.newBlock('tikz', { lw: repair(t.make()), code: '', scale: 1, caption: '', capMode: 'none' }));
  };

  L.LW = { VAL, NAMES, COLORS, DEF, TEMPLATES, opts, known, period, cleanEl, textW, clear, electrons, check, summary, qText,
    layout, groupPos, chargePos, curveCtrl, curveTop, toTikz, repair, newId, anchors, shift, sync, byId, bondsOf, other, r2 };
})();
