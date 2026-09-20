/* Représentations conventionnelles de la chimie organique, produites en SVG :
   Cram, projection de Newman, projection de Fischer, Haworth et conformations chaise. */
(function () {
  const V = M.V, U = M.util;

  /* ---------- Petit constructeur SVG ---------- */
  function svg(w, h, contenu, titre) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" '
      + 'font-family="Segoe UI, system-ui, sans-serif" class="proj-svg">'
      + (titre ? '<title>' + U.esc(titre) + '</title>' : '') + contenu + '</svg>';
  }
  const L = (x1, y1, x2, y2, o = {}) => '<line x1="' + r(x1) + '" y1="' + r(y1) + '" x2="' + r(x2) + '" y2="' + r(y2)
    + '" stroke="' + (o.couleur || 'currentColor') + '" stroke-width="' + (o.w || 2) + '" stroke-linecap="round"'
    + (o.tirets ? ' stroke-dasharray="' + o.tirets + '"' : '') + (o.opacity ? ' opacity="' + o.opacity + '"' : '') + '/>';
  const POLY = (pts, o = {}) => '<polygon points="' + pts.map(p => r(p[0]) + ',' + r(p[1])).join(' ')
    + '" fill="' + (o.fill || 'currentColor') + '"' + (o.stroke ? ' stroke="' + o.stroke + '"' : '') + '/>';
  const C = (x, y, rr, o = {}) => '<circle cx="' + r(x) + '" cy="' + r(y) + '" r="' + r(rr) + '" fill="' + (o.fill || 'none')
    + '" stroke="' + (o.stroke || 'currentColor') + '" stroke-width="' + (o.w || 2) + '"' + (o.opacity ? ' opacity="' + o.opacity + '"' : '') + '/>';
  const TXT = (x, y, t, o = {}) => '<text x="' + r(x) + '" y="' + r(y) + '" text-anchor="' + (o.ancre || 'middle')
    + '" dominant-baseline="' + (o.base || 'central') + '" font-size="' + (o.taille || 15) + '" font-weight="' + (o.gras || 600)
    + '" fill="' + (o.couleur || 'currentColor') + '"' + (o.opacity ? ' opacity="' + o.opacity + '"' : '') + '>' + U.esc(t) + '</text>';
  const r = v => Math.round(v * 100) / 100;

  /* Couleur d'un élément, lisible sur fond clair comme sur fond sombre */
  const COULEURS = { C: 'currentColor', H: 'currentColor', O: '#d93025', N: '#1a56db', S: '#b68100', P: '#e07000', F: '#0f9d58', Cl: '#0f9d58', Br: '#a0522d', I: '#7b2fbe' };
  const coul = el => COULEURS[el] || '#7b5ea7';

  /* Étiquette d'un atome, avec ses hydrogènes implicites */
  function etiquette(mol, id, opt = {}) {
    const a = mol.atom(id);
    if (a.label) return a.label;
    const nH = mol.neighborIds(id).filter(i => mol.atom(i).el === 'H').length;
    let t = a.el;
    if (opt.avecH !== false && nH) t += 'H' + (nH > 1 ? U.sub(nH) : '');
    if (a.charge) t += U.sup((Math.abs(a.charge) > 1 ? Math.abs(a.charge) : '') + (a.charge > 0 ? '+' : '-'));
    return t;
  }

  /* ---------- Orientation : plan de projection par analyse en composantes principales ---------- */
  function repere(mol, ids) {
    const pts = (ids || mol.atoms.filter(a => a.el !== 'H').map(a => a.id)).map(i => mol.atom(i));
    if (pts.length < 2) return { u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 }, w: { x: 0, y: 0, z: 1 }, c: pts[0] || V.zero() };
    const c = pts.reduce((s, p) => ({ x: s.x + p.x / pts.length, y: s.y + p.y / pts.length, z: s.z + p.z / pts.length }), V.zero());
    // matrice de covariance
    const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    pts.forEach(p => {
      const d = [p.x - c.x, p.y - c.y, p.z - c.z];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += d[i] * d[j];
    });
    const axes = vecteursPropres(m);
    return { u: axes[0], v: axes[1], w: axes[2], c };
  }
  /* Trois directions principales par itérations de la puissance et déflation */
  function vecteursPropres(m) {
    const mul = (A, x) => ({ x: A[0][0] * x.x + A[0][1] * x.y + A[0][2] * x.z, y: A[1][0] * x.x + A[1][1] * x.y + A[1][2] * x.z, z: A[2][0] * x.x + A[2][1] * x.y + A[2][2] * x.z });
    const A = m.map(r2 => r2.slice());
    const out = [];
    for (let k = 0; k < 3; k++) {
      let x = V.norm({ x: 0.577 + k * 0.11, y: 0.577 - k * 0.07, z: 0.577 + k * 0.03 });
      for (let i = 0; i < 90; i++) {
        let y = mul(A, x);
        if (V.len(y) < 1e-12) { y = V.perp(x); }
        x = V.norm(y);
      }
      out.push(x);
      const lam = V.dot(x, mul(A, x));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) A[i][j] -= lam * [x.x, x.y, x.z][i] * [x.x, x.y, x.z][j];
    }
    // orthonormalisation et orientation directe
    out[1] = V.norm(V.sub(out[1], V.mul(out[0], V.dot(out[1], out[0]))));
    out[2] = V.norm(V.cross(out[0], out[1]));
    return out;
  }

  /* ---------- Représentation de Cram ---------- */
  function cram(mol, opt = {}) {
    const W = opt.w || 640, H = opt.h || 460, marge = 52;
    const lourds = mol.atoms.filter(a => a.el !== 'H').map(a => a.id);
    const centres = new Set(M.stereo.centresAsymetriques(mol).map(c => c.id));
    /* hydrogènes conservés : ceux portés par un centre asymétrique */
    const visibles = new Set(lourds);
    mol.atoms.forEach(a => {
      if (a.el !== 'H') return;
      const p = mol.neighborIds(a.id)[0];
      if (p != null && (centres.has(p) || opt.tousLesH)) visibles.add(a.id);
    });
    const R = opt.repere || repere(mol, lourds);
    const proj = id => {
      const p = V.sub(mol.atom(id), R.c);
      return { x: V.dot(p, R.u), y: -V.dot(p, R.v), z: V.dot(p, R.w) };
    };
    const P = new Map([...visibles].map(id => [id, proj(id)]));
    if (!P.size) return svg(W, H, TXT(W / 2, H / 2, 'Molécule vide', { couleur: '#888' }));
    const xs = [...P.values()].map(p => p.x), ys = [...P.values()].map(p => p.y);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const k = Math.min((W - 2 * marge) / Math.max(0.9, maxx - minx), (H - 2 * marge) / Math.max(0.9, maxy - miny));
    const ech = Math.min(k, P.size <= 6 ? 120 : 78);
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const sx = p => W / 2 + (p.x - cx) * ech, sy = p => H / 2 + (p.y - cy) * ech;

    let out = '';
    const rayon = 12;
    /* Liaisons : trait plein dans le plan, coin plein vers l'avant, coin hachuré vers l'arrière */
    const dz = [...P.values()].map(p => p.z);
    const ampl = Math.max(0.35, (Math.max(...dz) - Math.min(...dz)) || 1);
    mol.bonds.forEach(b => {
      if (!P.has(b.a) || !P.has(b.b)) return;
      const pa = P.get(b.a), pb = P.get(b.b);
      let x1 = sx(pa), y1 = sy(pa), x2 = sx(pb), y2 = sy(pb);
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const rA = P.has(b.a) && etiquette(mol, b.a) !== 'C' ? rayon + 4 : 2;
      const rB = P.has(b.b) && etiquette(mol, b.b) !== 'C' ? rayon + 4 : 2;
      x1 += ux * rA; y1 += uy * rA; x2 -= ux * rB; y2 -= uy * rB;
      let type = b.type;
      if (type === 'n' || !type) {
        const d = (pb.z - pa.z) / ampl;
        const seuil = opt.seuil || 0.30;
        type = d > seuil ? 'w' : d < -seuil ? 'h' : 'n';
        /* une liaison d'un centre asymétrique vers un H est toujours marquée */
        if (type === 'n' && (mol.atom(b.b).el === 'H' || mol.atom(b.a).el === 'H') && Math.abs(d) > 0.12) type = d > 0 ? 'w' : 'h';
      }
      const nx = -uy, ny = ux;
      if (b.order >= 2) {
        const e = 3.4;
        out += L(x1 + nx * e, y1 + ny * e, x2 + nx * e, y2 + ny * e);
        out += L(x1 - nx * e, y1 - ny * e, x2 - nx * e, y2 - ny * e);
        if (b.order === 3) out += L(x1, y1, x2, y2);
      } else if (type === 'w') {
        const e = 5.5;
        out += POLY([[x1, y1], [x2 + nx * e, y2 + ny * e], [x2 - nx * e, y2 - ny * e]]);
      } else if (type === 'h') {
        const n = Math.max(4, Math.round(len / 7));
        for (let i = 1; i <= n; i++) {
          const t = i / n, e = 1.2 + 4.6 * t;
          const mx = x1 + dx * t, my = y1 + dy * t;
          out += L(mx + nx * e, my + ny * e, mx - nx * e, my - ny * e, { w: 1.7 });
        }
      } else out += L(x1, y1, x2, y2);
    });
    /* Atomes */
    [...P.keys()].forEach(id => {
      const a = mol.atom(id), p = P.get(id);
      const t = etiquette(mol, id, { avecH: !opt.tousLesH && a.el !== 'C' });
      if (a.el === 'C' && !a.label && !opt.tousLesSymboles) return;      // carbones implicites
      out += '<circle cx="' + r(sx(p)) + '" cy="' + r(sy(p)) + '" r="' + (rayon + 2) + '" fill="var(--fond-proj, #ffffff)"/>';
      out += TXT(sx(p), sy(p), t, { couleur: coul(a.el), taille: 15 });
    });
    /* Doublets non liants, figurés par deux points, à l'opposé des liaisons */
    if (opt.doublets) [...P.keys()].forEach(id => {
      const n = M.geo.doublets(mol, id);
      if (!n) return;
      const a = mol.atom(id), p0 = P.get(id);
      const voisins = mol.neighborIds(id).filter(i => P.has(i));
      let s2 = { x: 0, y: 0 };
      voisins.forEach(i => {
        const q2 = P.get(i);
        const d = Math.hypot(q2.x - p0.x, q2.y - p0.y) || 1;
        s2 = { x: s2.x + (q2.x - p0.x) / d, y: s2.y + (q2.y - p0.y) / d };
      });
      const norme = Math.hypot(s2.x, s2.y);
      /* direction opposée à la résultante des liaisons ; répartition régulière si l'atome est isolé */
      for (let k = 0; k < n; k++) {
        const base = norme > 0.15 ? Math.atan2(-s2.y / norme, -s2.x / norme) : 0;
        const t = base + (k - (n - 1) / 2) * (norme > 0.15 ? 1.05 : 2 * Math.PI / n);
        const cxp = sx(p0) + Math.cos(t) * 20, cyp = sy(p0) + Math.sin(t) * 20;
        const px = -Math.sin(t) * 3.4, py = Math.cos(t) * 3.4;
        out += '<circle cx="' + r(cxp + px) + '" cy="' + r(cyp + py) + '" r="2.3" fill="currentColor"/>';
        out += '<circle cx="' + r(cxp - px) + '" cy="' + r(cyp - py) + '" r="2.3" fill="currentColor"/>';
      }
    });
    const st = M.stereo.descripteurs(mol);
    if (st.nom && opt.legende !== false) out += TXT(W / 2, H - 16, 'Représentation de Cram — ' + st.nom, { taille: 13, gras: 500, opacity: 0.72 });
    return svg(W, H, out, 'Représentation de Cram');
  }

  /* ---------- Projection de Newman ---------- */
  function newman(mol, avant, arriere, opt = {}) {
    const W = opt.w || 520, H = opt.h || 460;
    const A = mol.atom(avant), B = mol.atom(arriere);
    if (!A || !B) return svg(W, H, TXT(W / 2, H / 2, 'Choisissez deux atomes liés', { couleur: '#888' }));
    const axe = V.norm(V.sub(B, A));
    /* repère perpendiculaire à l'axe de visée */
    const sa = mol.neighborIds(avant).filter(i => i !== arriere);
    const ref = sa.length ? V.sub(mol.atom(sa[0]), A) : V.perp(axe);
    const e1 = V.norm(V.sub(ref, V.mul(axe, V.dot(ref, axe))));
    const e2 = V.cross(axe, e1);
    const angle = id => {
      const d = V.sub(mol.atom(id), mol.atom(mol.neighborIds(id).includes(avant) ? avant : arriere));
      const p = V.sub(d, V.mul(axe, V.dot(d, axe)));
      return Math.atan2(V.dot(p, e2), V.dot(p, e1));
    };
    const cx = W / 2, cy = H / 2 - 8, R = 88;

    let out = '';
    /* atome arrière : cercle, liaisons partant du bord */
    out += C(cx, cy, R, { w: 3, opacity: 0.85 });
    const sb = mol.neighborIds(arriere).filter(i => i !== avant);
    sb.forEach(id => {
      const t = angle(id);
      const x1 = cx + Math.cos(t) * R, y1 = cy - Math.sin(t) * R;
      const x2 = cx + Math.cos(t) * (R + 62), y2 = cy - Math.sin(t) * (R + 62);
      out += L(x1, y1, x2, y2, { w: 2.4, opacity: 0.95 });
      out += pastille(mol, id, x2 + Math.cos(t) * 13, y2 - Math.sin(t) * 13);
    });
    /* atome avant : trois liaisons issues du centre */
    sa.forEach(id => {
      const t = angle(id);
      const x2 = cx + Math.cos(t) * R, y2 = cy - Math.sin(t) * R;
      out += L(cx, cy, x2, y2, { w: 3.4 });
      out += pastille(mol, id, cx + Math.cos(t) * (R + 22), cy - Math.sin(t) * (R + 22));
    });
    out += C(cx, cy, 4.5, { fill: 'currentColor', stroke: 'none' });

    /* angle dièdre et nature de la conformation */
    let info = '';
    if (sa.length && sb.length) {
      const d = V.dihedral(mol.atom(sa[0]), A, B, mol.atom(sb[0]));
      const conf = conformation(d);
      const a1 = angle(sa[0]), a2 = angle(sb[0]);
      out += arcAngle(cx, cy, R * 0.52, a1, a2);
      info = 'θ = ' + U.num(d, 1) + '°  —  conformation ' + conf.nom;
      out += TXT(cx, H - 34, info, { taille: 14, gras: 600 });
      out += TXT(cx, H - 14, conf.detail, { taille: 12, gras: 400, opacity: 0.7 });
    }
    out += TXT(18, 22, 'Avant : ' + etiquette(mol, avant), { ancre: 'start', taille: 12, opacity: 0.75 });
    out += TXT(W - 18, 22, 'Arrière : ' + etiquette(mol, arriere), { ancre: 'end', taille: 12, opacity: 0.75 });
    return svg(W, H, out, 'Projection de Newman');
  }
  function pastille(mol, id, x, y) {
    const a = mol.atom(id);
    const t = etiquette(mol, id);
    const w = 11 + t.length * 5.2;
    return '<rect x="' + r(x - w / 2) + '" y="' + r(y - 11) + '" width="' + r(w) + '" height="22" rx="6" fill="var(--fond-proj, #fff)" opacity="0.92"/>'
      + TXT(x, y, t, { couleur: coul(a.el), taille: 13 });
  }
  function arcAngle(cx, cy, rr, a1, a2) {
    let d = a2 - a1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const x1 = cx + Math.cos(a1) * rr, y1 = cy - Math.sin(a1) * rr;
    const x2 = cx + Math.cos(a2) * rr, y2 = cy - Math.sin(a2) * rr;
    const grand = Math.abs(d) > Math.PI ? 1 : 0, sens = d > 0 ? 0 : 1;
    return '<path d="M ' + r(x1) + ' ' + r(y1) + ' A ' + r(rr) + ' ' + r(rr) + ' 0 ' + grand + ' ' + sens + ' ' + r(x2) + ' ' + r(y2)
      + '" fill="none" stroke="#e8973a" stroke-width="2.2" stroke-dasharray="5 4"/>';
  }
  function conformation(d) {
    const a = Math.abs(((d % 360) + 360) % 360 > 180 ? 360 - ((d % 360) + 360) % 360 : ((d % 360) + 360) % 360);
    if (a < 25) return { nom: 'éclipsée (syn)', detail: 'Substituants superposés : interactions répulsives maximales, énergie élevée.' };
    if (a < 95) return { nom: 'décalée gauche', detail: 'Décalée, substituants à ~60° : minimum d’énergie secondaire.' };
    if (a < 155) return { nom: 'éclipsée (anticlinale)', detail: 'Position éclipsée intermédiaire : maximum d’énergie local.' };
    return { nom: 'décalée anti', detail: 'Décalée à 180° : conformation la plus stable (gêne stérique minimale).' };
  }

  /* Profil énergétique de rotation autour d'une liaison simple, en kJ·mol⁻¹.
     Deux contributions :
       • un terme de torsion, d'ordre 3 entre deux carbones tétragonaux (barrière de
         l'éthane, 12 kJ·mol⁻¹), d'ordre 2 lorsqu'une conjugaison favorise la planéité ;
       • un terme stérique, qui rend compte de la gêne entre groupes volumineux et
         explique par exemple les 3,8 kJ·mol⁻¹ qui séparent les formes gauche et anti du butane. */
  const ECH_STERIQUE = 11;       // conversion de la gêne calculée en kJ·mol⁻¹

  function profilRotation(mol, a, b, pas = 10) {
    const test = mol.clone();
    if (!test.sideOf(a, b)) return null;
    const sa = test.neighborIds(a).filter(i => i !== b);
    const sb = test.neighborIds(b).filter(i => i !== a);
    if (!sa.length || !sb.length) return null;
    const tetra = test.degree(a) === 4 && test.degree(b) === 4;
    const plan = test.degree(a) === 3 || test.degree(b) === 3;
    const depart = V.dihedral(test.atom(sa[0]), test.atom(a), test.atom(b), test.atom(sb[0]));
    const torsion = th => tetra ? 12 * (1 + Math.cos(U.rad(3 * th))) / 2
      : plan ? 14 * (1 - Math.cos(U.rad(2 * th))) / 2 : 0;
    const pts = [];
    for (let th = 0; th <= 360; th += pas) {
      M.geo.setDihedral(test, sa[0], a, b, sb[0], th);
      pts.push({ angle: th, energie: torsion(th) + ECH_STERIQUE * M.geo.encombrement(test) });
    }
    const min = Math.min(...pts.map(p => p.energie));
    pts.forEach(p => { p.energie = U.round(p.energie - min, 2); });
    return { points: pts, actuel: ((depart % 360) + 360) % 360, max: Math.max(...pts.map(p => p.energie)) };
  }

  /* Courbe SVG du profil énergétique */
  function courbeProfil(profil, opt = {}) {
    if (!profil) return '';
    const W = opt.w || 520, H = opt.h || 210, mg = { g: 46, d: 14, h: 16, b: 34 };
    const px = a => mg.g + (a / 360) * (W - mg.g - mg.d);
    const maxE = Math.max(1, profil.max);
    const py = e => H - mg.b - (e / maxE) * (H - mg.h - mg.b);
    let out = L(mg.g, H - mg.b, W - mg.d, H - mg.b, { w: 1.3, opacity: 0.5 })
      + L(mg.g, mg.h, mg.g, H - mg.b, { w: 1.3, opacity: 0.5 });
    [0, 60, 120, 180, 240, 300, 360].forEach(a => {
      out += L(px(a), H - mg.b, px(a), H - mg.b + 4, { w: 1.2, opacity: 0.5 });
      out += TXT(px(a), H - mg.b + 15, a + '°', { taille: 10, gras: 400, opacity: 0.65 });
    });
    out += TXT(mg.g - 6, mg.h + 4, U.num(maxE, 0), { ancre: 'end', taille: 10, gras: 400, opacity: 0.65 });
    out += TXT(mg.g - 6, H - mg.b, '0', { ancre: 'end', taille: 10, gras: 400, opacity: 0.65 });
    out += TXT(15, H / 2, 'kJ·mol⁻¹', { taille: 9, gras: 500, opacity: 0.65 });
    const d = profil.points.map((p, i) => (i ? 'L' : 'M') + r(px(p.angle)) + ' ' + r(py(p.energie))).join(' ');
    out += '<path d="' + d + '" fill="none" stroke="#e8973a" stroke-width="2.4" stroke-linejoin="round"/>';
    const e0 = profil.points.reduce((b2, p) => Math.abs(p.angle - profil.actuel) < Math.abs(b2.angle - profil.actuel) ? p : b2, profil.points[0]);
    out += C(px(profil.actuel), py(e0.energie), 5, { fill: '#e8973a', stroke: 'var(--fond-proj,#fff)', w: 2 });
    return svg(W, H, out, 'Profil énergétique de rotation');
  }

  /* ---------- Projection de Fischer ---------- */
  /* Chaîne carbonée principale, du carbone le plus oxydé vers le moins oxydé */
  function chainePrincipale(mol) {
    const cs = mol.atoms.filter(a => a.el === 'C').map(a => a.id);
    if (!cs.length) return [];
    let best = [];
    cs.forEach(d => {
      const vus = new Map([[d, [d]]]), file = [d];
      while (file.length) {
        const c = file.shift();
        mol.neighborIds(c).filter(i => mol.atom(i).el === 'C' && !vus.has(i)).forEach(n => {
          vus.set(n, vus.get(c).concat(n)); file.push(n);
        });
      }
      vus.forEach(ch => { if (ch.length > best.length) best = ch; });
    });
    const oxyd = id => mol.neighbors(id).reduce((s, n) => s + (['O', 'N', 'S'].includes(mol.atom(n.atom).el) ? n.bond.order : 0), 0);
    if (best.length > 1) {
      /* Sens de numérotation : l'extrémité la plus oxydée d'abord ; à égalité, celui qui
         donne l'indice le plus faible au carbone le plus oxydé de la chaîne (cétoses). */
      const oxA = oxyd(best[0]), oxB = oxyd(best[best.length - 1]);
      if (oxB > oxA) best.reverse();
      else if (oxB === oxA) {
        const ox = best.map(oxyd);
        const maxOx = Math.max(...ox);
        const premier = ox.indexOf(maxOx), dernier = ox.length - 1 - ox.slice().reverse().indexOf(maxOx);
        if (ox.length - 1 - dernier < premier) best.reverse();
      }
    }
    return best;
  }

  function fischer(mol, opt = {}) {
    const chaine = opt.chaine || chainePrincipale(mol);
    const W = opt.w || 460, H = opt.h || Math.max(300, 90 + chaine.length * 78);
    if (chaine.length < 2) return svg(W, H, TXT(W / 2, H / 2, 'Chaîne carbonée trop courte', { couleur: '#888' }));
    const pasV = Math.min(78, (H - 120) / (chaine.length - 1));
    const cx = W / 2, y0 = (H - pasV * (chaine.length - 1)) / 2;
    let out = '';
    const lg = 86;
    chaine.forEach((id, i) => {
      const y = y0 + i * pasV;
      const prev = chaine[i - 1], next = chaine[i + 1];
      /* liaison verticale du squelette */
      if (next != null) out += L(cx, y + 11, cx, y0 + (i + 1) * pasV - 11, { w: 2.2 });
      const subs = mol.neighborIds(id).filter(x => x !== prev && x !== next);
      if (!subs.length) { out += TXT(cx, y, etiquette(mol, id), { couleur: coul('C') }); return; }
      let droite = [], gauche = [];
      if (prev != null && next != null && subs.length === 2) {
        const c = mol.atom(id);
        const haut = V.norm(V.sub(mol.atom(prev), c)), bas = V.norm(V.sub(mol.atom(next), c));
        const vert = V.norm(V.sub(haut, bas));
        const versObs = V.mul(V.norm(V.add(haut, bas)), -1);   // les liaisons horizontales pointent vers l'observateur
        const dr = V.cross(versObs, vert);
        const s0 = V.dot(V.sub(mol.atom(subs[0]), c), dr);
        if (s0 >= 0) { droite = [subs[0]]; gauche = [subs[1]]; } else { droite = [subs[1]]; gauche = [subs[0]]; }
      } else {
        /* extrémité de chaîne : on empile les substituants verticalement */
        const t = subs.map(s => etiquette(mol, s)).join('');
        out += TXT(cx, y + (i === 0 ? -6 : 6), etiquette(mol, id, { avecH: false }) + (t && t !== 'H' ? '' : ''), { couleur: coul('C') });
        const grp = groupeTerminal(mol, id, prev != null ? prev : next);
        out += '<rect x="' + r(cx - 46) + '" y="' + r(y - 14) + '" width="92" height="28" rx="7" fill="var(--fond-proj,#fff)"/>';
        out += TXT(cx, y, grp, { couleur: coul('C'), taille: 16 });
        return;
      }
      out += L(cx - lg / 2, y, cx + lg / 2, y, { w: 2.2 });
      out += '<rect x="' + r(cx - 13) + '" y="' + r(y - 12) + '" width="26" height="24" rx="6" fill="var(--fond-proj,#fff)"/>';
      out += TXT(cx, y, 'C', { couleur: coul('C'), taille: 15 });
      [[gauche[0], cx - lg / 2 - 4, 'end'], [droite[0], cx + lg / 2 + 4, 'start']].forEach(([s, x, an]) => {
        if (s == null) return;
        const t = groupeTerminal(mol, s, id);
        out += '<rect x="' + r(an === 'end' ? x - t.length * 9 - 6 : x - 4) + '" y="' + r(y - 12) + '" width="' + r(t.length * 9 + 12) + '" height="24" rx="6" fill="var(--fond-proj,#fff)"/>';
        out += TXT(x, y, t, { couleur: coul(mol.atom(s).el), taille: 15, ancre: an });
      });
    });
    if (opt.legende !== false) {
      out += TXT(W / 2, 20, 'Projection de Fischer', { taille: 13, gras: 600, opacity: 0.8 });
      out += TXT(W / 2, H - 16, 'Traits horizontaux : vers l’avant — traits verticaux : vers l’arrière', { taille: 11, gras: 400, opacity: 0.62 });
    }
    return svg(W, H, out, 'Projection de Fischer');
  }
  /* Formule condensée d'un substituant (CH₃, OH, COOH, CH₂OH…) */
  function groupeTerminal(mol, id, depuis) {
    const vus = new Set([depuis]);
    const pile = [id], ordre = [];
    while (pile.length) {
      const c = pile.shift();
      if (vus.has(c)) continue;
      vus.add(c); ordre.push(c);
      mol.neighborIds(c).forEach(n => { if (!vus.has(n)) pile.push(n); });
      if (ordre.length > 8) break;
    }
    if (ordre.length === 1) return etiquette(mol, id);
    const cpt = {};
    ordre.forEach(i => { const e = mol.atom(i).el; cpt[e] = (cpt[e] || 0) + 1; });
    /* écriture condensée usuelle pour les groupes fréquents */
    const cle = Object.keys(cpt).sort().map(k => k + cpt[k]).join('');
    const usuels = { C1H3: 'CH₃', C1H4: 'CH₃', C1H3O1: 'CH₂OH', C1H2O1: 'CHO', C1H1O2: 'COOH', C1O2: 'COO⁻', H1O1: 'OH', H2N1: 'NH₂', C2H5: 'C₂H₅', C1H1O1: 'CHO', C1H2O2: 'COOH' };
    if (usuels[cle]) return usuels[cle];
    const ordreAff = ['C', 'H', 'O', 'N', 'S'].filter(e => cpt[e]).concat(Object.keys(cpt).filter(e => !'CHONS'.includes(e)));
    return ordreAff.map(e => e + (cpt[e] > 1 ? U.sub(cpt[e]) : '')).join('');
  }

  /* ---------- Conformation chaise du cyclohexane ---------- */
  /* Un substituant est axial si sa liaison est parallèle à l'axe du cycle */
  function axialOuEquatorial(mol, ring, atomeCycle, sub) {
    const n = normaleCycle(mol, ring);
    const u = V.norm(V.sub(mol.atom(sub), mol.atom(atomeCycle)));
    return Math.abs(V.dot(u, n)) > 0.62 ? 'axial' : 'équatorial';
  }
  function normaleCycle(mol, ring) {
    const c = ring.reduce((s, i) => V.add(s, V.mul(mol.atom(i), 1 / ring.length)), V.zero());
    let n = V.zero();
    for (let i = 0; i < ring.length; i++) {
      const a = V.sub(mol.atom(ring[i]), c), b = V.sub(mol.atom(ring[(i + 1) % ring.length]), c);
      n = V.add(n, V.cross(a, b));
    }
    return V.norm(n);
  }
  function estChaise(mol, ring) {
    if (ring.length !== 6) return false;
    const d = [];
    for (let i = 0; i < 6; i++) d.push(V.dihedral(mol.atom(ring[i]), mol.atom(ring[(i + 1) % 6]), mol.atom(ring[(i + 2) % 6]), mol.atom(ring[(i + 3) % 6])));
    const alt = d.every((x, i) => Math.sign(x) === (i % 2 ? -1 : 1) * Math.sign(d[0]));
    return alt && d.every(x => Math.abs(x) > 35);
  }

  /* Squelette de chaise : positions canoniques du schéma classique.
     Les sommets 4 (haut) et 1 (bas) sont les deux extrémités du pli. */
  const CHAISE = [[80, 170], [175, 205], [280, 170], [330, 120], [235, 86], [130, 120]];

  /* Aligne l'ordre du cycle sur le schéma : le sommet le plus haut dans la géométrie 3D
     est placé au sommet haut du dessin, et le sens de parcours est choisi pour que
     l'alternance haut-bas du dessin reproduise celle de la molécule. */
  function alignerChaise(mol, ring) {
    const n = normaleCycle(mol, ring);
    const c = ring.reduce((s2, i) => V.add(s2, V.mul(mol.atom(i), 1 / ring.length)), V.zero());
    const h = ring.map(id => V.dot(V.sub(mol.atom(id), c), n));
    let k = 0;
    h.forEach((v, i) => { if (v > h[k]) k = i; });
    const ordre = ring.slice(k).concat(ring.slice(0, k));           // le sommet haut en tête
    const hauteurs = h.slice(k).concat(h.slice(0, k));
    /* Sur le dessin, l'indice 4 est le sommet haut : on décale de 4 positions. */
    const place = new Array(6);
    for (let i = 0; i < 6; i++) place[(4 + i) % 6] = { id: ordre[i], h: hauteurs[i] };
    return { place, normale: n };
  }

  function chaise(mol, ring, opt = {}) {
    const W = opt.w || 520, H = opt.h || 360;
    if (!ring || ring.length !== 6) return svg(W, H, TXT(W / 2, H / 2, 'Sélectionnez un cycle à 6 atomes', { couleur: '#888' }));
    const dx = (W - 410) / 2, dy = (H - 290) / 2 + 20;
    const p = CHAISE.map(([x, y]) => [x + dx, y + dy]);
    const cx = p.reduce((s2, q2) => s2 + q2[0], 0) / 6, cy = p.reduce((s2, q2) => s2 + q2[1], 0) / 6;
    const { place, normale } = alignerChaise(mol, ring);

    let out = '';
    for (let i = 0; i < 6; i++) out += L(p[i][0], p[i][1], p[(i + 1) % 6][0], p[(i + 1) % 6][1], { w: 2.6 });

    for (let i = 0; i < 6; i++) {
      const info = place[i];
      if (!info) continue;
      const id = info.id;
      const [x, y] = p[i];
      /* Direction équatoriale : parallèle à la liaison située deux sommets plus loin,
         orientée vers l'extérieur du cycle (construction classique). */
      let ex = p[(i + 2) % 6][0] - p[(i + 1) % 6][0], ey = p[(i + 2) % 6][1] - p[(i + 1) % 6][1];
      const le = Math.hypot(ex, ey) || 1; ex /= le; ey /= le;
      if (ex * (x - cx) + ey * (y - cy) < 0) { ex = -ex; ey = -ey; }
      /* Sens axial : vers le haut du dessin si le sommet est au-dessus du plan moyen */
      const versHaut = info.h >= 0 ? -1 : 1;

      mol.neighborIds(id).filter(s2 => !ring.includes(s2)).forEach(s2 => {
        const pos = axialOuEquatorial(mol, ring, id, s2);
        const t = groupeTerminal(mol, s2, id);
        const important = t !== 'H';
        let x2, y2;
        if (pos === 'axial') {
          /* au-dessus ou au-dessous, selon l'orientation réelle de la liaison */
          const u = V.norm(V.sub(mol.atom(s2), mol.atom(id)));
          const sens = V.dot(u, normale) >= 0 ? -1 : 1;
          x2 = x; y2 = y + sens * 46;
        } else {
          x2 = x + ex * 40; y2 = y + ey * 40 + versHaut * -8;
        }
        const couleur = pos === 'axial' ? '#c2610c' : '#1a56db';
        out += L(x, y, x2, y2, { w: important ? 2.4 : 1.5, opacity: important ? 1 : 0.34,
          couleur: important ? couleur : 'currentColor' });
        if (important || opt.tousLesH) {
          out += '<rect x="' + r(x2 - t.length * 5 - 6) + '" y="' + r(y2 - 11) + '" width="' + r(t.length * 10 + 12) + '" height="22" rx="6" fill="var(--fond-proj,#fff)"/>';
          out += TXT(x2, y2, t, { taille: 13, couleur });
        }
      });
      out += '<circle cx="' + r(x) + '" cy="' + r(y) + '" r="4.5" fill="currentColor"/>';
      out += TXT(x + (x < cx ? -14 : 14), y + (y > cy ? 13 : -13), String(ring.indexOf(id) + 1), { taille: 10, gras: 500, opacity: 0.5 });
    }
    out += TXT(20, 22, 'axial', { ancre: 'start', taille: 12, couleur: '#c2610c' });
    out += TXT(70, 22, '· équatorial', { ancre: 'start', taille: 12, couleur: '#1a56db' });
    if (opt.legende !== false) out += TXT(W / 2, H - 14, estChaise(mol, ring) ? 'Conformation chaise' : 'Cycle non chaise (bateau ou demi-chaise)', { taille: 12, gras: 500, opacity: 0.7 });
    return svg(W, H, out, 'Conformation chaise');
  }

  /* Inversion de cycle : les positions axiales deviennent équatoriales et inversement */
  function inverserChaise(mol, ring) {
    if (!M.geo.inverserCycle(mol, ring)) return false;
    M.geo.optimiser(mol, { steps: 350 });
    return true;
  }

  /* ---------- Projection de Haworth (cycles à 5 ou 6 atomes) ---------- */
  function haworth(mol, ring, opt = {}) {
    const W = opt.w || 520, H = opt.h || 340;
    if (!ring || (ring.length !== 5 && ring.length !== 6)) return svg(W, H, TXT(W / 2, H / 2, 'Sélectionnez un cycle à 5 ou 6 atomes', { couleur: '#888' }));
    const n = ring.length;
    const cx = W / 2, cy = H / 2 + 10, rx = 150, ry = 52;
    /* l'oxygène du cycle est placé en haut à droite, comme le veut l'usage */
    let ordre = ring.slice();
    const io = ordre.findIndex(i => mol.atom(i).el === 'O');
    if (io >= 0) ordre = ordre.slice(io).concat(ordre.slice(0, io));
    const pt = i => {
      const t = -Math.PI / 2 + (i / n) * 2 * Math.PI + (n === 6 ? Math.PI / 6 : 0);
      return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
    };
    const p = ordre.map((_, i) => pt(i));
    let out = '';
    const nrm = normaleCycle(mol, ordre);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const devant = p[i][1] > cy && p[j][1] > cy;     // arêtes du bas = arêtes « avant », trait épais
      out += L(p[i][0], p[i][1], p[j][0], p[j][1], { w: devant ? 4.2 : 2 });
    }
    ordre.forEach((id, i) => {
      const [x, y] = p[i];
      const a = mol.atom(id);
      if (a.el !== 'C') {
        out += '<circle cx="' + r(x) + '" cy="' + r(y) + '" r="11" fill="var(--fond-proj,#fff)"/>';
        out += TXT(x, y, a.el, { couleur: coul(a.el), taille: 15 });
      }
      mol.neighborIds(id).filter(s => !ordre.includes(s)).forEach(s => {
        const u = V.norm(V.sub(mol.atom(s), a));
        const haut = V.dot(u, nrm) > 0;
        const t = groupeTerminal(mol, s, id);
        if (t === 'H' && !opt.tousLesH) return;
        const y2 = y + (haut ? -44 : 44);
        out += L(x, y, x, y2, { w: 2 });
        out += '<rect x="' + r(x - t.length * 5 - 5) + '" y="' + r(y2 - 11) + '" width="' + r(t.length * 10 + 10) + '" height="22" rx="6" fill="var(--fond-proj,#fff)"/>';
        out += TXT(x, y2, t, { taille: 13, couleur: coul(mol.atom(s).el) });
      });
    });
    if (opt.legende !== false) out += TXT(W / 2, H - 12, 'Projection de Haworth — le cycle est vu par la tranche, les arêtes épaisses sont en avant', { taille: 11, gras: 400, opacity: 0.65 });
    return svg(W, H, out, 'Projection de Haworth');
  }

  M.proj = {
    svg, cram, newman, fischer, chaise, haworth, profilRotation, courbeProfil, alignerChaise,
    chainePrincipale, axialOuEquatorial, estChaise, inverserChaise, normaleCycle,
    conformation, repere, groupeTerminal, etiquette, coul, ECH_STERIQUE,
  };
})();
