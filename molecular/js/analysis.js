/* Analyse chimique : formule brute, masse molaire, insaturations, Lewis,
   polarité, charges partielles et reconnaissance des groupes caractéristiques. */
(function () {
  const V = M.V, U = M.util, G = () => M.geo;

  /* ---------- Formule brute (ordre de Hill : C, H, puis alphabétique) ---------- */
  function compte(mol) {
    const c = {};
    mol.atoms.forEach(a => { c[a.el] = (c[a.el] || 0) + 1; });
    return c;
  }
  function formuleBrute(mol, opt = {}) {
    const c = compte(mol);
    const syms = Object.keys(c);
    const ordre = [];
    if (c.C) { ordre.push('C'); if (c.H) ordre.push('H'); }
    syms.filter(s => s !== 'C' && !(c.C && s === 'H')).sort().forEach(s => ordre.push(s));
    const q = charge(mol);
    let f = ordre.map(s => s + (c[s] > 1 ? (opt.unicode === false ? c[s] : U.sub(c[s])) : '')).join('');
    if (q) f += opt.unicode === false ? (q > 0 ? '+' : '-') + (Math.abs(q) > 1 ? Math.abs(q) : '')
      : U.sup((Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '-'));
    return f || '—';
  }
  /* Formule brute au format LaTeX (\ce{} de mhchem) */
  function formuleLatex(mol) {
    const c = compte(mol), out = [];
    const ordre = [];
    if (c.C) { ordre.push('C'); if (c.H) ordre.push('H'); }
    Object.keys(c).filter(s => s !== 'C' && !(c.C && s === 'H')).sort().forEach(s => ordre.push(s));
    ordre.forEach(s => out.push(s + (c[s] > 1 ? c[s] : '')));
    const q = charge(mol);
    return out.join('') + (q ? '^' + (Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '-') : '');
  }
  const charge = mol => mol.atoms.reduce((s, a) => s + (a.charge || 0), 0);

  function masseMolaire(mol) {
    return mol.atoms.reduce((s, a) => {
      const e = M.elements.get(a.el);
      return s + (a.iso || (e ? e.mass : 0));
    }, 0);
  }
  function compositionCentesimale(mol) {
    const c = compte(mol), Mm = masseMolaire(mol);
    return Object.keys(c).map(s => {
      const e = M.elements.get(s);
      return { el: s, n: c[s], masse: e.mass * c[s], pct: Mm ? 100 * e.mass * c[s] / Mm : 0 };
    }).sort((a, b) => b.pct - a.pct);
  }

  /* Degré d'insaturation : DoU = (2n_C + 2 + n_N − n_H − n_X)/2 */
  function insaturations(mol) {
    const c = compte(mol);
    const X = (c.F || 0) + (c.Cl || 0) + (c.Br || 0) + (c.I || 0);
    const N = (c.N || 0) + (c.P || 0);
    const C = (c.C || 0) + (c.Si || 0);
    const d = (2 * C + 2 + N - (c.H || 0) - X) / 2;
    return Math.max(0, Math.round(d * 2) / 2);
  }

  /* ---------- Structure de Lewis ---------- */
  function lewis(mol) {
    const ve = mol.atoms.reduce((s, a) => s + (M.elements.get(a.el) || { ve: 0 }).ve, 0) - charge(mol);
    const liants = mol.bonds.reduce((s, b) => s + b.order, 0) * 2;
    const nonLiants = mol.atoms.reduce((s, a) => s + G().doublets(mol, a.id) * 2, 0);
    const radicaux = mol.atoms.reduce((s, a) => s + (a.radical || 0), 0);
    const anomalies = [];
    mol.atoms.forEach(a => {
      const e = M.elements.get(a.el);
      if (!e) return;
      const env = mol.bondOrderSum(a.id) * 2 + G().doublets(mol, a.id) * 2 + (a.radical || 0);
      const cible = e.Z <= 2 ? 2 : 8;
      const q = G().chargeFormelle(mol, a.id);
      if (e.period >= 3 && env > cible) anomalies.push({ id: a.id, type: 'hypervalent', texte: a.el + ' : couche étendue (' + env + ' e⁻), possible à partir de la 3ᵉ période' });
      else if (env > cible) anomalies.push({ id: a.id, type: 'sur-octet', texte: a.el + ' dépasse l’octet (' + env + ' e⁻) — impossible en 2ᵉ période' });
      else if (env < cible && e.Z > 2 && !['B', 'Be', 'Al', 'Li', 'Na', 'Mg'].includes(e.sym)) anomalies.push({ id: a.id, type: 'lacune', texte: a.el + ' : ' + env + ' e⁻, octet incomplet (lacune électronique)' });
      if (q !== (a.charge || 0)) anomalies.push({ id: a.id, type: 'charge', texte: a.el + ' : charge formelle calculée ' + (q > 0 ? '+' : '') + q });
    });
    return { electronsValence: ve, liants, nonLiants, radicaux, anomalies, complet: !anomalies.length };
  }

  /* ---------- Polarité ---------- */
  /* Charges partielles estimées par péréquation d'électronégativité (Sanderson simplifié) */
  function chargesPartielles(mol) {
    const q = new Map();
    mol.atoms.forEach(a => q.set(a.id, a.charge || 0));
    for (let it = 0; it < 6; it++) {
      const d = new Map();
      mol.bonds.forEach(b => {
        const ea = M.elements.get(mol.atom(b.a).el), eb = M.elements.get(mol.atom(b.b).el);
        if (!ea || !eb) return;
        const t = (eb.en - ea.en) * 0.11 * b.order;   // transfert vers l'atome le plus électronégatif
        d.set(b.a, (d.get(b.a) || 0) + t);
        d.set(b.b, (d.get(b.b) || 0) - t);
      });
      d.forEach((v, id) => q.set(id, q.get(id) + v * Math.pow(0.55, it)));
    }
    return q;
  }
  /* Moment dipolaire : somme vectorielle des moments de liaison (approximation) */
  function momentDipolaire(mol) {
    const q = chargesPartielles(mol);
    let mu = { x: 0, y: 0, z: 0 };
    const c = mol.centerOfMass();
    mol.atoms.forEach(a => {
      const r = V.sub(a, c);
      mu = V.add(mu, V.mul(r, q.get(a.id)));
    });
    // contribution des doublets non liants (dirigés à l'opposé des liaisons)
    mol.atoms.forEach(a => {
      const n = G().doublets(mol, a.id);
      if (!n || mol.degree(a.id) === 0) return;
      const e = M.elements.get(a.el);
      if (!e || e.en < 2.4) return;
      let s = { x: 0, y: 0, z: 0 };
      mol.neighborIds(a.id).forEach(i => { s = V.add(s, V.norm(V.sub(mol.atom(i), a))); });
      if (V.len(s) < 1e-6) return;
      mu = V.add(mu, V.mul(V.norm(s), -0.28 * n));
    });
    const norme = V.len(mu) * 4.803;                 // e·Å → debye
    return { vecteur: mu, debye: norme, polaire: norme > 0.15 };
  }

  /* ---------- Classe des carbones ---------- */
  function classeCarbone(mol, id) {
    const a = mol.atom(id);
    if (!a || a.el !== 'C') return null;
    const nC = mol.neighborIds(id).filter(i => mol.atom(i).el === 'C').length;
    return ['nulle (méthane)', 'primaire', 'secondaire', 'tertiaire', 'quaternaire'][nC] || null;
  }

  /* ---------- Groupes caractéristiques ---------- */
  const est = (mol, id, el) => mol.atom(id) && mol.atom(id).el === el;
  const vois = (mol, id, f) => mol.neighbors(id).filter(n => f(mol.atom(n.atom), n.bond));
  const aH = (mol, id) => mol.neighborIds(id).filter(i => est(mol, i, 'H')).length;

  function aromatique(mol, ring) {
    if (ring.length !== 6 && ring.length !== 5) return false;
    const bs = M.ringBonds(mol, ring);
    if (bs.length !== ring.length) return false;
    if (bs.every(b => b.order === 1.5)) return true;
    // alternance simple/double sur un cycle plan de 6 atomes
    if (ring.length === 6 && bs.filter(b => b.order === 2).length === 3) {
      const ok = bs.every((b, i) => b.order !== bs[(i + 1) % bs.length].order);
      if (ok) return true;
    }
    return false;
  }

  function groupes(mol) {
    const out = [];
    const add = (nom, ids, detail) => out.push({ nom, ids: [].concat(ids), detail: detail || '' });
    const rings = mol.rings();
    rings.forEach(r => { if (aromatique(mol, r)) add('Cycle aromatique', r, r.length === 6 ? 'noyau benzénique' : 'hétérocycle aromatique'); });

    mol.atoms.forEach(a => {
      const id = a.id;
      if (a.el === 'C') {
        const dblO = vois(mol, id, (x, b) => x.el === 'O' && b.order === 2);
        const simpleO = vois(mol, id, (x, b) => x.el === 'O' && b.order === 1);
        const simpleN = vois(mol, id, (x, b) => x.el === 'N' && b.order === 1);
        const trplN = vois(mol, id, (x, b) => x.el === 'N' && b.order === 3);
        const halo = vois(mol, id, x => ['F', 'Cl', 'Br', 'I'].includes(x.el));
        if (trplN.length) add('Nitrile', [id, trplN[0].atom], '—C≡N');
        if (dblO.length === 1) {
          const oh = simpleO.filter(n => aH(mol, n.atom) === 1);
          const or = simpleO.filter(n => mol.neighborIds(n.atom).some(i => i !== id && est(mol, i, 'C')));
          const ox = simpleO.filter(n => mol.neighborIds(n.atom).some(i => i !== id && mol.atom(i).el === 'C' && vois(mol, i, (y, b) => y.el === 'O' && b.order === 2).length));
          const nCl = halo.filter(n => n.atom);
          if (ox.length) add('Anhydride d’acide', [id, dblO[0].atom, ox[0].atom], '—CO—O—CO—');
          else if (oh.length) add('Acide carboxylique', [id, dblO[0].atom, oh[0].atom], '—COOH');
          else if (or.length) add('Ester', [id, dblO[0].atom, or[0].atom], '—COO—');
          else if (simpleN.length) add('Amide', [id, dblO[0].atom, simpleN[0].atom], '—CONH—');
          else if (nCl.length) add('Chlorure d’acyle', [id, dblO[0].atom, nCl[0].atom], '—COCl');
          else if (aH(mol, id) >= 1) add('Aldéhyde', [id, dblO[0].atom], '—CHO');
          else add('Cétone', [id, dblO[0].atom], '—CO—');
        }
        // alcool / phénol / éther, hors fonctions carbonylées déjà classées
        simpleO.forEach(n => {
          const o = n.atom;
          if (vois(mol, id, (x, b) => x.el === 'O' && b.order === 2).length) return;
          const autres = mol.neighborIds(o).filter(i => i !== id);
          if (aH(mol, o) === 1) {
            const surAro = rings.some(r => aromatique(mol, r) && r.includes(id));
            const cl = classeCarbone(mol, id);
            add(surAro ? 'Phénol' : 'Alcool', [id, o], surAro ? 'Ar—OH' : 'alcool ' + (cl || ''));
          } else if (autres.some(i => est(mol, i, 'C'))) {
            const cyc = rings.find(r => r.includes(o) && r.length === 3);
            if (cyc) add('Époxyde', cyc, 'oxacyclopropane');
            else if (id < autres.find(i => est(mol, i, 'C'))) add('Éther-oxyde', [id, o, autres.find(i => est(mol, i, 'C'))], 'C—O—C');
          }
        });
        if (halo.length) halo.forEach(n => add('Dérivé halogéné', [id, n.atom], 'C—' + mol.atom(n.atom).el + ' (' + (classeCarbone(mol, id) || '') + ')'));
        const s = vois(mol, id, (x, b) => x.el === 'S' && b.order === 1);
        s.forEach(n => { if (aH(mol, n.atom) === 1) add('Thiol', [id, n.atom], '—SH'); else if (mol.neighborIds(n.atom).filter(i => est(mol, i, 'C')).length === 2 && id < Math.max(...mol.neighborIds(n.atom))) add('Thioéther', [id, n.atom], 'C—S—C'); });
        const dblN = vois(mol, id, (x, b) => x.el === 'N' && b.order === 2);
        if (dblN.length) add(aH(mol, dblN[0].atom) ? 'Imine' : 'Imine substituée', [id, dblN[0].atom], 'C=N');
      }
      if (a.el === 'N') {
        const dblO = vois(mol, id, (x, b) => x.el === 'O' && b.order === 2);
        const simpleO = vois(mol, id, (x, b) => x.el === 'O' && b.order === 1);
        if (dblO.length && simpleO.length) { add('Groupe nitro', [id, dblO[0].atom, simpleO[0].atom], '—NO₂'); return; }
        const amide = mol.neighborIds(id).some(i => mol.atom(i).el === 'C' && vois(mol, i, (y, b) => y.el === 'O' && b.order === 2).length);
        if (amide) return;
        const nC = mol.neighborIds(id).filter(i => est(mol, i, 'C')).length;
        if (mol.degree(id) === 4 || (a.charge || 0) > 0) add('Ion ammonium', [id], 'N⁺');
        else if (nC >= 1 && mol.bondOrderSum(id) === 3) add('Amine', [id], ['', 'primaire', 'secondaire', 'tertiaire'][nC] || '');
      }
    });

    // insaturations carbonées non aromatiques
    mol.bonds.forEach(b => {
      if (mol.atom(b.a).el !== 'C' || mol.atom(b.b).el !== 'C') return;
      const aro = rings.some(r => aromatique(mol, r) && r.includes(b.a) && r.includes(b.b));
      if (aro) return;
      if (b.order === 2) add('Alcène', [b.a, b.b], 'C=C');
      if (b.order === 3) add('Alcyne', [b.a, b.b], 'C≡C');
    });

    // acide α-aminé
    const acides = out.filter(g => g.nom === 'Acide carboxylique');
    acides.forEach(g => {
      const cCoo = g.ids[0];
      mol.neighborIds(cCoo).filter(i => est(mol, i, 'C')).forEach(ca => {
        const n = mol.neighborIds(ca).find(i => est(mol, i, 'N'));
        if (n != null) add('Acide α-aminé', [n, ca, cCoo], 'H₂N—CαH(R)—COOH');
      });
    });

    // déduplication
    const vu = new Set();
    return out.filter(g => {
      const k = g.nom + ':' + g.ids.slice().sort((x, y) => x - y).join(',');
      if (vu.has(k)) return false; vu.add(k); return true;
    });
  }

  /* Famille générale de la molécule */
  function famille(mol) {
    const g = groupes(mol).map(x => x.nom);
    const prio = ['Acide carboxylique', 'Anhydride d’acide', 'Chlorure d’acyle', 'Ester', 'Amide', 'Nitrile',
      'Aldéhyde', 'Cétone', 'Alcool', 'Phénol', 'Thiol', 'Amine', 'Éther-oxyde', 'Époxyde', 'Dérivé halogéné',
      'Cycle aromatique', 'Alcyne', 'Alcène'];
    for (const p of prio) if (g.includes(p)) return p;
    const c = compte(mol);
    if (c.C && Object.keys(c).every(s => s === 'C' || s === 'H')) return mol.rings().length ? 'Cycloalcane' : 'Alcane';
    return 'Composé inorganique ou non classé';
  }

  /* ---------- Mesures géométriques ---------- */
  function mesures(mol, ids) {
    if (ids.length === 2) return { type: 'distance', valeur: V.dist(mol.atom(ids[0]), mol.atom(ids[1])), unite: 'Å' };
    if (ids.length === 3) return { type: 'angle', valeur: V.angle(mol.atom(ids[0]), mol.atom(ids[1]), mol.atom(ids[2])), unite: '°' };
    if (ids.length === 4) return { type: 'dièdre', valeur: V.dihedral(...ids.map(i => mol.atom(i))), unite: '°' };
    return null;
  }

  /* Gêne stérique approchée, en kJ·mol⁻¹ : utile pour comparer deux conformations
     d'une même molécule, sans prétendre à une valeur absolue. */
  function energieSterique(mol) {
    return U.round(G().encombrement(mol, null, 4) * 11, 1);
  }

  M.analyse = {
    compte, formuleBrute, formuleLatex, masseMolaire, compositionCentesimale, insaturations,
    charge, lewis, chargesPartielles, momentDipolaire, classeCarbone, groupes, famille,
    aromatique, mesures, energieSterique,
  };
})();
