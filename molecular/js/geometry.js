/* Géométrie chimique : règle de l'octet, VSEPR (Gillespie), hybridation,
   construction des coordonnées 3D et optimisation par contraintes de distance. */
(function () {
  const V = M.V, U = M.util;

  /* ---------- Longueurs de liaison de référence (Å) ---------- */
  const LEN = {
    'C-C': 1.54, 'C=C': 1.34, 'C#C': 1.20, 'C~C': 1.39,
    'C-H': 1.09, 'N-H': 1.01, 'O-H': 0.96, 'S-H': 1.34, 'B-H': 1.19, 'Si-H': 1.48,
    'C-O': 1.43, 'C=O': 1.22, 'C-N': 1.47, 'C=N': 1.28, 'C#N': 1.16,
    'C-S': 1.82, 'C=S': 1.61, 'C-F': 1.35, 'C-Cl': 1.77, 'C-Br': 1.94, 'C-I': 2.14,
    'N-N': 1.45, 'N=N': 1.25, 'N#N': 1.10, 'N-O': 1.40, 'N=O': 1.21,
    'O-O': 1.48, 'S-O': 1.44, 'S=O': 1.44, 'P-O': 1.61, 'P=O': 1.50, 'P-H': 1.42,
  };
  const ORD = { 1: '-', 2: '=', 3: '#', 1.5: '~' };

  function bondLength(ea, eb, order = 1) {
    const A = M.elements.get(ea), B = M.elements.get(eb);
    if (!A || !B) return 1.5;
    const s = ORD[order] || '-';
    const k1 = A.sym + s + B.sym, k2 = B.sym + s + A.sym;
    if (LEN[k1]) return LEN[k1];
    if (LEN[k2]) return LEN[k2];
    const shrink = order === 2 ? 0.88 : order === 3 ? 0.78 : order === 1.5 ? 0.93 : 1;
    return (A.rcov + B.rcov) * shrink;
  }

  /* ---------- Règle de l'octet : nombre de liaisons et de doublets attendus ---------- */
  /* Électrons de valence disponibles, corrigés de la charge formelle */
  const dispo = (e, charge) => e.ve - (charge || 0);

  function liaisonsAttendues(sym, charge = 0) {
    const e = M.elements.get(sym);
    if (!e) return 1;
    if (e.Z === 1) return 1;                       // duet
    if (e.Z === 2) return 0;
    const d = dispo(e, charge);
    if (e.period >= 3 && e.group >= 13 && d >= 4) return 8 - d;   // octet par défaut, hypervalence tolérée
    if (['B', 'Be', 'Al', 'Li', 'Na', 'K', 'Mg', 'Ca'].includes(e.sym) && charge === 0) return e.valence;
    return d >= 4 ? 8 - d : d;                     // cations déficients : d liaisons ; sinon octet
  }

  /* Doublets non liants réellement présents (déduits des liaisons formées) */
  function doublets(mol, id) {
    const a = mol.atom(id);
    if (!a) return 0;
    if (a.lp != null) return a.lp;                 // valeur imposée par l'utilisateur
    const e = M.elements.get(a.el);
    if (!e || e.Z === 1) return 0;
    const n = (dispo(e, a.charge) - mol.bondOrderSum(id) - (a.radical || 0)) / 2;
    return Math.max(0, Math.floor(n + 1e-9));
  }

  /* Charge formelle = électrons de valence − doublets non liants (×2) − liaisons */
  function chargeFormelle(mol, id) {
    const a = mol.atom(id), e = M.elements.get(a.el);
    if (!e) return 0;
    return e.ve - 2 * doublets(mol, id) - (a.radical || 0) - mol.bondOrderSum(id);
  }

  /* ---------- VSEPR ---------- */
  const FORMES = {
    '2,0': { nom: 'linéaire', hyb: 'sp', angle: 180 },
    '3,0': { nom: 'trigonale plane', hyb: 'sp²', angle: 120 },
    '2,1': { nom: 'coudée', hyb: 'sp²', angle: 118 },
    '4,0': { nom: 'tétraédrique', hyb: 'sp³', angle: 109.5 },
    '3,1': { nom: 'pyramidale à base triangulaire', hyb: 'sp³', angle: 107 },
    '2,2': { nom: 'coudée', hyb: 'sp³', angle: 104.5 },
    '5,0': { nom: 'bipyramide à base triangulaire', hyb: 'sp³d', angle: 120 },
    '4,1': { nom: 'bascule (papillon)', hyb: 'sp³d', angle: 117 },
    '3,2': { nom: 'en T', hyb: 'sp³d', angle: 90 },
    '2,3': { nom: 'linéaire', hyb: 'sp³d', angle: 180 },
    '6,0': { nom: 'octaédrique', hyb: 'sp³d²', angle: 90 },
    '5,1': { nom: 'pyramide à base carrée', hyb: 'sp³d²', angle: 90 },
    '4,2': { nom: 'plan carré', hyb: 'sp³d²', angle: 90 },
  };

  function vsepr(mol, id) {
    const a = mol.atom(id);
    const sigma = mol.degree(id);                  // liaisons σ = nombre de voisins
    const lp = doublets(mol, id);
    const n = sigma + lp;                          // nombre stérique (AXₘEₙ)
    const f = FORMES[sigma + ',' + lp] || { nom: n <= 1 ? 'terminale' : 'indéterminée', hyb: '—', angle: 109.5 };
    return {
      atome: a, sigma, lp, n,
      code: 'AX' + sigma + (lp ? 'E' + lp : ''),
      forme: f.nom, hyb: f.hyb, angle: f.angle,
      formeElectronique: (FORMES[n + ',0'] || { nom: '—' }).nom,
    };
  }

  /* Angle de liaison idéal en tenant compte des cycles (un cycle impose son angle interne) */
  function angleIdeal(mol, i, j, k) {
    const v = vsepr(mol, j);
    let ang = v.angle;
    if (v.n === 5) ang = 120;                      // valeur moyenne, affinée par les contraintes 1-3
    const rs = mol.rings().filter(r => r.includes(i) && r.includes(j) && r.includes(k) && voisinsDansCycle(r, i, j, k));
    if (rs.length) {
      const t = Math.min(...rs.map(r => r.length));
      const interne = { 3: 60, 4: 88, 5: 105, 6: 111, 7: 115, 8: 117 }[t] || ang;
      ang = Math.min(ang === 180 ? interne : ang, interne);
      if (t <= 4) ang = interne;                   // cycles tendus : l'angle du cycle l'emporte
      /* Cycle insaturé plan : l'angle interne est celui du polygone régulier
         (108° pour un cycle à 5, 120° pour un cycle à 6), plafonné à 120°. */
      if (v.hyb === 'sp²' && t >= 5) ang = Math.min(120, (t - 2) * 180 / t);
    }
    return ang;
  }
  function voisinsDansCycle(r, i, j, k) {
    const p = r.indexOf(j), n = r.length;
    const a = r[(p + 1) % n], b = r[(p - 1 + n) % n];
    return (a === i && b === k) || (a === k && b === i);
  }

  /* ---------- Directions idéales des doublets autour d'un atome ---------- */
  const TET = [
    { x: 1, y: 1, z: 1 }, { x: 1, y: -1, z: -1 }, { x: -1, y: 1, z: -1 }, { x: -1, y: -1, z: 1 },
  ].map(V.norm);
  function directions(n) {
    switch (n) {
      case 0: return [];
      case 1: return [{ x: 1, y: 0, z: 0 }];
      case 2: return [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }];
      case 3: return [0, 1, 2].map(i => ({ x: Math.cos(i * 2 * Math.PI / 3), y: Math.sin(i * 2 * Math.PI / 3), z: 0 }));
      case 4: return TET.slice();
      /* Bipyramide : axiales d'abord, puis équatoriales — les doublets libres,
         placés en dernier, occupent ainsi naturellement les positions équatoriales. */
      case 5: return [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 },
        ...[0, 1, 2].map(i => ({ x: Math.cos(i * 2 * Math.PI / 3), y: Math.sin(i * 2 * Math.PI / 3), z: 0 }))];
      case 6: return [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }];
      default: {
        const out = [];                            // répartition de Fibonacci pour les cas exotiques
        for (let i = 0; i < n; i++) {
          const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), t = i * 2.399963;
          out.push({ x: Math.cos(t) * r, y, z: Math.sin(t) * r });
        }
        return out;
      }
    }
  }

  /* Oriente l'ensemble idéal pour que ses premières directions coïncident avec celles déjà fixées */
  function orienter(ideal, fixes) {
    let set = ideal.map(V.copy);
    if (!fixes.length) {
      const k = V.norm({ x: 0.31, y: 0.83, z: 0.46 });
      return set.map(d => V.rotate(d, k, 0.7));
    }
    // 1) amener set[0] sur fixes[0]
    set = aligner(set, set[0], fixes[0]);
    if (fixes.length >= 2) {
      // 2) tourner autour de fixes[0] pour rapprocher set[1] de fixes[1]
      const ax = V.norm(fixes[0]);
      const proj = v => { const p = V.sub(v, V.mul(ax, V.dot(v, ax))); return V.len(p) < 1e-6 ? null : V.norm(p); };
      const p1 = proj(set[1]), p2 = proj(fixes[1]);
      if (p1 && p2) {
        let ang = Math.acos(U.clamp(V.dot(p1, p2), -1, 1));
        if (V.dot(V.cross(p1, p2), ax) < 0) ang = -ang;
        set = set.map(d => V.rotate(d, ax, ang));
      }
    }
    if (fixes.length >= 3) {
      // 3) lever l'ambiguïté de réflexion restante autour de l'axe fixes[0]
      const ax = V.norm(fixes[0]);
      const err = s => fixes.reduce((e, f, i) => e + V.dist(s[i], V.norm(f)), 0);
      const nrm = V.norm(V.cross(ax, fixes[1] ? V.norm(fixes[1]) : V.perp(ax)));
      if (isFinite(nrm.x)) {
        const miroirPlan = set.map(d => V.sub(d, V.mul(nrm, 2 * V.dot(d, nrm))));
        if (err(miroirPlan) < err(set) - 1e-6) set = miroirPlan;
      }
    }
    return set;
  }
  function aligner(set, from, to) {
    const a = V.norm(from), b = V.norm(to);
    const d = U.clamp(V.dot(a, b), -1, 1);
    if (d > 0.999999) return set;
    const k = d < -0.999999 ? V.perp(a) : V.norm(V.cross(a, b));
    const ang = Math.acos(d);
    return set.map(v => V.rotate(v, k, ang));
  }

  /* ---------- Hydrogènes implicites ---------- */
  function hydrogenesManquants(mol, id) {
    const a = mol.atom(id);
    if (!a || a.el === 'H') return 0;
    if (a.label) return 0;                         // groupe générique (R, Ar…) : on ne complète pas
    const cible = liaisonsAttendues(a.el, a.charge);
    return Math.max(0, cible - mol.bondOrderSum(id));
  }

  function ajouterHydrogenes(mol, ids = null) {
    const cibles = ids || mol.atoms.filter(a => a.el !== 'H').map(a => a.id);
    const nouveaux = [];
    cibles.forEach(id => {
      const n = hydrogenesManquants(mol, id);
      if (n <= 0) return;
      const a = mol.atom(id);
      const dirs = placerNouvellesDirections(mol, id, n);
      for (let i = 0; i < n; i++) {
        const d = dirs[i] || V.norm({ x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 });
        const l = bondLength(a.el, 'H', 1);
        const h = mol.addAtom('H', V.add(a, V.mul(d, l)));
        mol.addBond(id, h.id, 1);
        nouveaux.push(h.id);
      }
    });
    return nouveaux;
  }

  /* Directions libres autour d'un atome, compte tenu des voisins déjà placés et des doublets */
  function placerNouvellesDirections(mol, id, n) {
    const a = mol.atom(id);
    const voisins = mol.neighbors(id);
    const lp = doublets(mol, id);
    const total = voisins.length + n + lp;
    const ideal = directions(Math.min(6, Math.max(total, 1)));
    const fixes = voisins.map(v => V.norm(V.sub(mol.atom(v.atom), a))).filter(d => isFinite(d.x));
    const set = orienter(ideal, fixes);
    return set.slice(fixes.length);
  }

  function retirerHydrogenes(mol) {
    mol.atoms.filter(a => a.el === 'H' && mol.degree(a.id) === 1).forEach(a => mol.removeAtom(a.id));
    return mol;
  }

  /* ---------- Construction des coordonnées 3D à partir de la connectivité ---------- */
  function construire3D(mol, opt = {}) {
    const placed = new Set();
    const file = [];

    /* Développe la file : chaque atome placé positionne ses voisins encore libres */
    function croitre() {
      while (file.length) {
        const cur = file.shift();
        const a = mol.atom(cur);
        const libres = mol.neighbors(cur).filter(v => !placed.has(v.atom));
        if (!libres.length) continue;
        const fixes = mol.neighbors(cur).filter(v => placed.has(v.atom))
          .map(v => V.sub(mol.atom(v.atom), a))
          .filter(d => V.len(d) > 1e-6).map(V.norm);
        const total = mol.degree(cur) + doublets(mol, cur);
        const set = orienter(directions(Math.min(6, Math.max(total, 1))), fixes).slice(fixes.length);
        libres.forEach((v, i) => {
          const d = set[i] || V.norm({ x: Math.random() - .5, y: Math.random() - .5, z: Math.random() - .5 });
          const l = bondLength(a.el, mol.atom(v.atom).el, v.bond.order);
          mol.setPos(v.atom, V.add(a, V.mul(d, l)));
          placed.add(v.atom);
          file.push(v.atom);
        });
      }
    }

    /* 1) Les cycles sont posés d'abord, sous forme de polygones réguliers légèrement plissés.
          Un cycle accolé à un cycle déjà posé s'appuie sur l'arête commune. */
    const rings = mol.rings().slice().sort((a, b) => b.length - a.length);
    let decal = 0;
    let restants = rings.slice();
    for (let passe = 0; passe < rings.length + 1 && restants.length; passe++) {
      const suite = [];
      restants.forEach(r => {
        if (r.every(id => placed.has(id))) return;
        const poses = r.filter(id => placed.has(id)).length;
        if (poses === 0) { posePolygone(r); return; }
        if (!poseAncree(r)) suite.push(r);
      });
      if (suite.length === restants.length) { suite.forEach(posePolygone); break; }
      restants = suite;
    }

    /* Polygone régulier ancré sur une arête dont les deux sommets sont déjà placés */
    function poseAncree(r) {
      const nmem = r.length;
      let i = -1;
      for (let k = 0; k < nmem; k++) if (placed.has(r[k]) && placed.has(r[(k + 1) % nmem])) { i = k; break; }
      if (i < 0) return false;
      const PA = mol.atom(r[i]), PB = mol.atom(r[(i + 1) % nmem]);
      const arete = V.sub(PB, PA), len = V.len(arete);
      if (len < 1e-6) return false;
      /* plan défini par un voisin déjà placé extérieur au cycle */
      let PC = null;
      for (const id of [r[i], r[(i + 1) % nmem]]) {
        const v = mol.neighborIds(id).find(x => placed.has(x) && !r.includes(x));
        if (v != null) { PC = mol.atom(v); break; }
      }
      const nrm = PC ? V.norm(V.cross(arete, V.sub(PC, PA))) : V.perp(arete);
      if (!isFinite(nrm.x)) return false;
      let dir = V.norm(V.cross(nrm, arete));
      const mil = V.mul(V.add(PA, PB), 0.5);
      if (PC && V.dot(dir, V.sub(PC, mil)) > 0) dir = V.mul(dir, -1);   // le nouveau cycle part à l'opposé
      const R = len / (2 * Math.sin(Math.PI / nmem));
      const apo = len / (2 * Math.tan(Math.PI / nmem));
      const centre = V.add(mil, V.mul(dir, apo));
      const u = V.norm(V.sub(PA, centre));
      const w = V.norm(V.cross(nrm, u));
      const signe = V.dot(V.sub(PB, centre), w) > 0 ? 1 : -1;
      for (let k = 1; k < nmem; k++) {
        const id = r[(i + k) % nmem];
        if (placed.has(id)) continue;
        const t = signe * k * 2 * Math.PI / nmem;
        mol.setPos(id, V.add(centre, V.add(V.mul(u, R * Math.cos(t)), V.mul(w, R * Math.sin(t)))));
        placed.add(id); file.push(id);
      }
      return true;
    }

    function posePolygone(r) {
      const nmem = r.length;
      const len = moyenne(M.ringBonds(mol, r).map(b => bondLength(mol.atom(b.a).el, mol.atom(b.b).el, b.order))) || 1.5;
      const R = len / (2 * Math.sin(Math.PI / nmem));
      /* un cycle saturé de 6 atomes est amorcé en conformation chaise ; un cycle
         insaturé (liaisons 1,5 ou 2) reste plan pour converger vers la planéité */
      const sature = M.ringBonds(mol, r).every(b => b.order === 1);
      const pli = sature && nmem >= 6 ? 0.25 : 0;
      r.forEach((id, i) => {
        if (placed.has(id)) return;
        const t = i * 2 * Math.PI / nmem;
        mol.setPos(id, { x: decal + R * Math.cos(t), y: R * Math.sin(t), z: i % 2 ? pli : -pli });
        placed.add(id);
        file.push(id);
      });
      decal += 2 * R + 4;
    }
    croitre();     // les substituants poussent une fois tous les cycles en place

    /* 2) Fragments restants : croissance en largeur depuis l'atome le plus connecté */
    const seeds = mol.atoms.slice().sort((a, b) => mol.degree(b.id) - mol.degree(a.id));
    for (const s of seeds) {
      if (placed.has(s.id)) continue;
      mol.setPos(s.id, { x: decal, y: 0, z: 0 });
      decal += 6;
      placed.add(s.id);
      file.push(s.id);
      croitre();
    }

    optimiser(mol, { steps: opt.steps || Math.min(1400, 400 + mol.atoms.length * 12), chiralite: false });
    if (opt.stagger !== false) decaler(mol);
    optimiser(mol, { steps: Math.min(600, 150 + mol.atoms.length * 6) });
    if (opt.conformation !== false) prefererConformation(mol);
    mol.recenter();
    return mol;
  }
  const moyenne = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

  /* ---------- Optimisation : relaxation itérative de contraintes de distance ----------
     Chaque contrainte 1-2 (liaison), 1-3 (angle) ou 1-4 (torsion rigide) fixe une distance
     cible ; les paires éloignées reçoivent une simple borne inférieure (encombrement).
     Le volume signé autour des centres asymétriques est conservé : la configuration
     absolue (R/S) ne peut pas s'inverser pendant l'optimisation. */
  function contraintes(mol) {
    const eq = [], lo = [], ch = [];
    const A = mol.atoms, n = A.length;
    const rv = {}; A.forEach(a => { rv[a.id] = (M.elements.get(a.el) || { rvdw: 1.7 }).rvdw; });

    // 1-2
    mol.bonds.forEach(b => {
      const d = bondLength(mol.atom(b.a).el, mol.atom(b.b).el, b.order);
      eq.push([b.a, b.b, d, 1.0]);
    });
    // 1-3
    const vus13 = new Set();
    A.forEach(a => {
      const nb = mol.neighborIds(a.id);
      /* Au-delà du tétraèdre (bipyramide, octaèdre), un angle unique ne suffit pas :
         chaque voisin est rattaché à la direction idéale la plus proche, et l'angle
         de référence est celui qui sépare les deux directions retenues. */
      const attrib = nb.length >= 5 || (vsepr(mol, a.id).n >= 5) ? attribuerDirections(mol, a.id) : null;
      for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) {
        const key = Math.min(nb[i], nb[j]) + ':' + Math.max(nb[i], nb[j]) + ':' + a.id;
        if (vus13.has(key)) continue; vus13.add(key);
        let th;
        if (attrib && attrib.get(nb[i]) && attrib.get(nb[j])) {
          th = Math.acos(U.clamp(V.dot(attrib.get(nb[i]), attrib.get(nb[j])), -1, 1));
        } else th = U.rad(angleIdeal(mol, nb[i], a.id, nb[j]));
        const d1 = bondLength(mol.atom(nb[i]).el, a.el, mol.bondBetween(nb[i], a.id).order);
        const d2 = bondLength(mol.atom(nb[j]).el, a.el, mol.bondBetween(nb[j], a.id).order);
        eq.push([nb[i], nb[j], Math.sqrt(d1 * d1 + d2 * d2 - 2 * d1 * d2 * Math.cos(th)), 0.55]);
      }
    });
    // 1-4 à travers une liaison rigide (double, triple, ou liaison de cycle) : Z/E conservé
    mol.bonds.forEach(b => {
      const rigide = b.order >= 2 || b.order === 1.5;
      if (!rigide) return;
      const na = mol.neighborIds(b.a).filter(i => i !== b.b);
      const nb2 = mol.neighborIds(b.b).filter(i => i !== b.a);
      na.forEach(i => nb2.forEach(j => {
        const d = V.dist(mol.atom(i), mol.atom(j));
        if (!isFinite(d) || d === 0) return;
        const di = V.dist(mol.atom(i), mol.atom(b.a)), dj = V.dist(mol.atom(j), mol.atom(b.b));
        const db = V.dist(mol.atom(b.a), mol.atom(b.b));
        // cible reconstruite pour un dièdre de 0° (Z) ou 180° (E), selon la géométrie actuelle
        const dih = V.dihedral(mol.atom(i), mol.atom(b.a), mol.atom(b.b), mol.atom(j));
        const cible = Math.abs(dih) < 90 ? 0 : Math.PI;
        eq.push([i, j, distance14(di, db, dj, U.rad(angleIdeal(mol, i, b.a, b.b)), U.rad(angleIdeal(mol, b.a, b.b, j)), cible), 0.35]);
      }));
    });
    // Paires non liées : bornes inférieures (répulsion stérique)
    const sep = separations(mol, 3);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = A[i].id, b = A[j].id;
      const s = sep.get(a + ':' + b);
      if (s != null && s <= 3) continue;
      const bothH = A[i].el === 'H' && A[j].el === 'H';
      lo.push([a, b, (rv[a] + rv[b]) * (bothH ? 0.80 : 0.83), 0.25]);
    }
    // Conservation de la configuration des centres tétraédriques
    A.forEach(a => {
      const nb = mol.neighborIds(a.id);
      if (nb.length !== 4) return;
      const v = volume(mol, nb);
      if (Math.abs(v) < 0.15) return;
      ch.push([nb[0], nb[1], nb[2], nb[3], Math.sign(v), Math.abs(v)]);
    });
    return { eq, lo, ch };
  }

  /* Rattache chaque voisin à la direction idéale VSEPR la plus proche (attribution gloutonne) */
  function attribuerDirections(mol, id) {
    const a = mol.atom(id);
    const v = vsepr(mol, id);
    const nb = mol.neighborIds(id);
    const dirs = directions(Math.min(6, Math.max(v.n, nb.length)));
    const u = nb.map(n => V.norm(V.sub(mol.atom(n), a)));
    const libres = dirs.map((d, i) => i);
    const out = new Map();
    /* on traite d'abord les voisins les mieux alignés avec une direction idéale */
    const paires = [];
    nb.forEach((n, i) => dirs.forEach((d, j) => paires.push({ i, j, s: V.dot(u[i], d) })));
    paires.sort((x, y) => y.s - x.s);
    const prisN = new Set(), prisD = new Set();
    paires.forEach(pr => {
      if (prisN.has(pr.i) || prisD.has(pr.j)) return;
      prisN.add(pr.i); prisD.add(pr.j);
      out.set(nb[pr.i], dirs[pr.j]);
    });
    void libres;
    return out;
  }

  /* Distance 1-4 imposée par deux angles et un dièdre (placement explicite des 4 points) */
  function distance14(d12, d23, d34, a123, a234, dih) {
    const p2 = { x: 0, y: 0, z: 0 }, p3 = { x: d23, y: 0, z: 0 };
    const p1 = { x: -d12 * Math.cos(Math.PI - a123), y: d12 * Math.sin(Math.PI - a123), z: 0 };
    const p4 = {
      x: d23 + d34 * Math.cos(Math.PI - a234),
      y: d34 * Math.sin(Math.PI - a234) * Math.cos(dih),
      z: d34 * Math.sin(Math.PI - a234) * Math.sin(dih),
    };
    void p2; void p3;
    return V.dist(p1, p4);
  }

  /* Nombre de liaisons séparant les paires proches (jusqu'à `max`) */
  function separations(mol, max) {
    const out = new Map();
    mol.atoms.forEach(a => {
      let front = [a.id]; const dist = new Map([[a.id, 0]]);
      for (let d = 1; d <= max; d++) {
        const next = [];
        front.forEach(c => mol.neighborIds(c).forEach(n => {
          if (dist.has(n)) return;
          dist.set(n, d); next.push(n);
        }));
        front = next;
      }
      dist.forEach((d, id) => {
        if (id === a.id) return;
        const k = Math.min(a.id, id) + ':' + Math.max(a.id, id);
        if (!out.has(k) || out.get(k) > d) out.set(k, d);
      });
    });
    return out;
  }

  function volume(mol, ids) {
    const [p1, p2, p3, p4] = ids.map(i => mol.atom(i));
    return V.dot(V.sub(p1, p4), V.cross(V.sub(p2, p4), V.sub(p3, p4)));
  }

  function optimiser(mol, opt = {}) {
    const steps = opt.steps || 300;
    const C = contraintes(mol);
    const pos = new Map(); mol.atoms.forEach(a => pos.set(a.id, a));
    const libre = id => { const a = pos.get(id); return a && !a.locked; };
    const fige = opt.figer ? new Set(opt.figer) : null;
    const mobile = id => libre(id) && (!fige || !fige.has(id));
    let rate = 0.9;

    for (let s = 0; s < steps; s++) {
      let err = 0;
      const tirer = (i, j, d0, w, borneInf) => {
        const a = pos.get(i), b = pos.get(j);
        if (!a || !b) return;
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        let d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 1e-6) { b.x += 0.01; return; }
        if (borneInf && d >= d0) return;
        const diff = (d - d0) / d * w * rate;
        err += Math.abs(d - d0);
        const ma = mobile(i), mb = mobile(j);
        if (!ma && !mb) return;
        const ka = ma ? (mb ? 0.5 : 1) : 0, kb = mb ? (ma ? 0.5 : 1) : 0;
        a.x += dx * diff * ka; a.y += dy * diff * ka; a.z += dz * diff * ka;
        b.x -= dx * diff * kb; b.y -= dy * diff * kb; b.z -= dz * diff * kb;
      };
      C.eq.forEach(c => tirer(c[0], c[1], c[2], c[3], false));
      C.lo.forEach(c => tirer(c[0], c[1], c[2], c[3], true));
      if (opt.chiralite !== false) C.ch.forEach(c => {
        const ids = [c[0], c[1], c[2], c[3]];
        const v = volume(mol, ids);
        if (Math.sign(v) === c[4] && Math.abs(v) > c[5] * 0.35) return;
        // réinjection : on écarte le premier substituant du plan des trois autres
        const [p1, p2, p3, p4] = ids.map(i => pos.get(i));
        const nvec = V.norm(V.cross(V.sub(p2, p4), V.sub(p3, p4)));
        const push = V.mul(nvec, c[4] * 0.05);
        if (mobile(ids[0])) { p1.x += push.x; p1.y += push.y; p1.z += push.z; }
        const back = V.mul(push, -1 / 3);
        [p2, p3, p4].forEach((p, k) => { if (mobile(ids[k + 1])) { p.x += back.x; p.y += back.y; p.z += back.z; } });
      });
      rate = 0.9 - 0.5 * (s / steps);
      if (err < 1e-4 * (C.eq.length + 1)) break;
    }
    mol.touch();
    return mol;
  }

  /* ---------- Conformations décalées : balayage des liaisons simples libres ---------- */
  function decaler(mol) {
    const sep = separations(mol, 4);   // calculée une seule fois : la connectivité ne change pas
    mol.bonds.forEach(b => {
      if (b.order !== 1) return;
      if (mol.bondInRing(b)) return;
      const na = mol.neighborIds(b.a).filter(i => i !== b.b);
      const nb = mol.neighborIds(b.b).filter(i => i !== b.a);
      if (!na.length || !nb.length) return;
      const cote = mol.sideOf(b.a, b.b);
      if (!cote) return;
      let best = null, bestScore = Infinity;
      for (let ang = 0; ang < 360; ang += 15) {
        tournerAutour(mol, b.a, b.b, cote, U.rad(15), ang === 0 ? 0 : 1);
        const sc = encombrement(mol, sep);
        if (sc < bestScore) { bestScore = sc; best = ang; }
      }
      // 23 rotations de 15° ont été appliquées (345°) : +15° ramène à 0°, +best à l'optimum
      tournerAutour(mol, b.a, b.b, cote, U.rad(best + 15), 1);
    });
    return mol;
  }
  function tournerAutour(mol, a, b, cote, ang, doIt = 1) {
    if (!doIt) return;
    const pa = mol.atom(a), pb = mol.atom(b);
    const k = V.norm(V.sub(pb, pa));
    cote.forEach(id => {
      if (id === b) return;
      const p = mol.atom(id);
      const r = V.rotate(V.sub(p, pb), k, ang);
      p.x = pb.x + r.x; p.y = pb.y + r.y; p.z = pb.z + r.z;
    });
  }
  /* Gêne stérique cumulée. `seuilSep` fixe la portée prise en compte :
       3 → inclut les interactions 1-4, c'est la tension de torsion (conformations décalées) ;
       4 → les exclut, ne restent que les gênes à longue portée comme l'interaction
           1,3-diaxiale qui décide de la chaise la plus stable. */
  function encombrement(mol, sep, seuilSep = 3) {
    const A = mol.atoms; let s = 0;
    sep = sep || separations(mol, 4);
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const k = Math.min(A[i].id, A[j].id) + ':' + Math.max(A[i].id, A[j].id);
      if ((sep.get(k) || 9) < seuilSep) continue;
      const d = V.dist(A[i], A[j]);
      const r = ((M.elements.get(A[i].el) || { rvdw: 1.7 }).rvdw + (M.elements.get(A[j].el) || { rvdw: 1.7 }).rvdw) * 0.95;
      if (d < r) s += (r - d) * (r - d);
    }
    return s;
  }

  /* ---------- Inversion de cycle et choix de la conformation la plus stable ---------- */
  /* Renverse le plissement d'un cycle : chaque atome du cycle passe de l'autre côté du plan
     moyen et ses substituants sont transportés par le déplacement de son repère local.
     Les positions axiales deviennent équatoriales, et réciproquement, sans qu'aucune
     configuration absolue ne soit modifiée (le transport est une rotation, pas une symétrie). */
  function inverserCycle(mol, ring) {
    const n = ring.length;
    if (!ring || n < 5) return false;
    const c = ring.reduce((s2, i) => V.add(s2, V.mul(mol.atom(i), 1 / n)), V.zero());
    let nrm = V.zero();
    for (let i = 0; i < n; i++) nrm = V.add(nrm, V.cross(V.sub(mol.atom(ring[i]), c), V.sub(mol.atom(ring[(i + 1) % n]), c)));
    nrm = V.norm(nrm);
    if (!isFinite(nrm.x)) return false;

    const bloc = new Set(ring);
    const avant = new Map(mol.atoms.map(a => [a.id, V.copy(a)]));
    const branches = ring.map(id => [...mol.reachable(id, bloc)].filter(x => x !== id));
    const reflechi = p => V.sub(p, V.mul(nrm, 2 * V.dot(V.sub(p, c), nrm)));
    const apres = new Map(ring.map(id => [id, reflechi(avant.get(id))]));

    /* Repère local orthonormé d'un atome du cycle, défini par ses deux voisins de cycle */
    const repereLocal = (lire, id, p, q) => {
      const o = lire(id);
      const e1 = V.norm(V.sub(lire(p), o));
      let t = V.sub(lire(q), o);
      t = V.sub(t, V.mul(e1, V.dot(t, e1)));
      const e2 = V.norm(t);
      return { o, e1, e2, e3: V.cross(e1, e2) };
    };
    ring.forEach((id, i) => {
      const p = ring[(i - 1 + n) % n], q = ring[(i + 1) % n];
      const F0 = repereLocal(x => avant.get(x), id, p, q);
      const F1 = repereLocal(x => apres.get(x) || avant.get(x), id, p, q);
      if (!isFinite(F0.e2.x) || !isFinite(F1.e2.x)) return;
      branches[i].forEach(x => {
        const d = V.sub(avant.get(x), F0.o);
        const u = V.dot(d, F0.e1), v = V.dot(d, F0.e2), w = V.dot(d, F0.e3);
        mol.setPos(x, V.add(F1.o, V.add(V.mul(F1.e1, u), V.add(V.mul(F1.e2, v), V.mul(F1.e3, w)))));
      });
    });
    ring.forEach(id => mol.setPos(id, apres.get(id)));
    mol.touch();
    return true;
  }

  /* Pour chaque cycle saturé à 6 atomes non accolé, conserve la chaise la moins encombrée :
     c'est ce qui place un méthyle, un groupe volumineux ou les hydroxyles d'un ose en
     position équatoriale. Les deux chaises sont relaxées de la même façon avant d'être
     comparées, sans quoi la comparaison dépendrait de l'état de départ. */
  function prefererConformation(mol) {
    const cycles = mol.rings();
    const candidats = cycles.filter(r => r.length === 6 && M.ringBonds(mol, r).every(b => b.order === 1)
      && !cycles.some(o => o !== r && o.some(x => r.includes(x))));
    candidats.forEach(r => {
      const substitue = r.some(id => mol.neighborIds(id).some(x => !r.includes(x) && mol.atom(x).el !== 'H'));
      if (!substitue) return;
      const releve = () => mol.atoms.map(a => ({ id: a.id, x: a.x, y: a.y, z: a.z }));
      const pose = e => { e.forEach(p => { const a = mol.atom(p.id); if (a) { a.x = p.x; a.y = p.y; a.z = p.z; } }); mol.touch(); };
      const relaxer = () => { optimiser(mol, { steps: 220 }); decaler(mol); optimiser(mol, { steps: 160 }); };

      relaxer();
      const etatA = { pos: releve(), e: encombrement(mol, null, 4) };
      if (!inverserCycle(mol, r)) { pose(etatA.pos); return; }
      relaxer();
      const etatB = { pos: releve(), e: encombrement(mol, null, 4) };
      pose(etatB.e < etatA.e - 1e-3 ? etatB.pos : etatA.pos);
    });
    return mol;
  }

  /* ---------- Modifications géométriques interactives ---------- */
  function setDistance(mol, a, b, d) {
    const cote = mol.sideOf(a, b);
    const pa = mol.atom(a), pb = mol.atom(b);
    const dir = V.norm(V.sub(pb, pa));
    const delta = V.mul(dir, d - V.dist(pa, pb));
    const cibles = cote || [b];
    cibles.forEach(id => { const p = mol.atom(id); p.x += delta.x; p.y += delta.y; p.z += delta.z; });
    mol.touch();
  }
  function setAngle(mol, a, b, c, deg) {
    const cote = mol.sideOf(b, c);
    if (!cote) return false;
    const pa = mol.atom(a), pb = mol.atom(b), pc = mol.atom(c);
    const cur = V.angle(pa, pb, pc);
    const ax = V.norm(V.cross(V.sub(pa, pb), V.sub(pc, pb)));
    if (!isFinite(ax.x)) return false;
    const d = U.rad(deg - cur);
    cote.forEach(id => {
      const p = mol.atom(id);
      const r = V.rotate(V.sub(p, pb), ax, d);
      p.x = pb.x + r.x; p.y = pb.y + r.y; p.z = pb.z + r.z;
    });
    mol.touch();
    return true;
  }
  function setDihedral(mol, a, b, c, d, deg) {
    const cote = mol.sideOf(b, c);
    if (!cote) return false;
    const cur = V.dihedral(mol.atom(a), mol.atom(b), mol.atom(c), mol.atom(d));
    tournerAutour(mol, b, c, cote, U.rad(deg - cur), 1);
    mol.touch();
    return true;
  }
  /* Rotation libre d'un groupe autour de la liaison b–c (projections de Newman) */
  function rotateAround(mol, b, c, deg) {
    const cote = mol.sideOf(b, c);
    if (!cote) return false;
    tournerAutour(mol, b, c, cote, U.rad(deg), 1);
    mol.touch();
    return true;
  }
  /* Image dans un miroir : inverse toutes les configurations (énantiomère) */
  function miroir(mol, axe = 'z') {
    mol.atoms.forEach(a => { a[axe] = -a[axe]; });
    mol.bonds.forEach(b => { if (b.type === 'w') b.type = 'h'; else if (b.type === 'h') b.type = 'w'; });
    mol.touch();
    return mol;
  }

  M.geo = {
    LEN, bondLength, liaisonsAttendues, doublets, chargeFormelle, vsepr, FORMES,
    angleIdeal, directions, orienter, hydrogenesManquants, ajouterHydrogenes, retirerHydrogenes,
    construire3D, optimiser, decaler, encombrement, separations, volume,
    setDistance, setAngle, setDihedral, rotateAround, miroir, placerNouvellesDirections,
    inverserCycle, prefererConformation,
  };
})();
