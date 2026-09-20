/* Stéréochimie : règles séquentielles de Cahn-Ingold-Prelog (CIP), descripteurs R/S et Z/E,
   énantiomères, diastéréoisomères, composés méso. */
(function () {
  const V = M.V, U = M.util;
  const Z = sym => (M.elements.get(sym) || { Z: 0 }).Z;

  /* ---------- Arborescence hiérarchique CIP ----------
     Chaque liaison multiple crée des atomes « dupliqués » (fantômes, sans descendance) ;
     une fermeture de cycle crée également un duplicata qui arrête la branche. */
  const PROF_MAX = 9, BUDGET = 60000;

  function arbre(mol, parent, id, chemin, prof, etat) {
    const a = mol.atom(id);
    const n = { Z: a.iso ? Z(a.el) : Z(a.el), masse: a.iso || (M.elements.get(a.el) || { mass: 0 }).mass, id, dup: false, enfants: [] };
    if (prof <= 0 || etat.n++ > BUDGET) return n;
    const bParent = parent == null ? null : mol.bondBetween(id, parent);
    if (bParent && bParent.order > 1) {
      for (let k = 1; k < Math.round(bParent.order); k++) n.enfants.push(fantome(Z(mol.atom(parent).el)));
    }
    mol.neighbors(id).forEach(v => {
      if (v.atom === parent) return;
      const zz = Z(mol.atom(v.atom).el);
      for (let k = 1; k < Math.round(v.bond.order); k++) n.enfants.push(fantome(zz));
      if (chemin.has(v.atom)) { n.enfants.push(fantome(zz)); return; }   // fermeture de cycle
      const c = new Set(chemin); c.add(v.atom);
      n.enfants.push(arbre(mol, id, v.atom, c, prof - 1, etat));
    });
    // Les doublets non liants comptent comme des atomes fantômes de numéro atomique 0
    const lp = M.geo.doublets(mol, id);
    for (let k = 0; k < lp && n.enfants.length < 4; k++) n.enfants.push(fantome(0));
    return n;
  }
  const fantome = z => ({ Z: z, masse: 0, id: null, dup: true, enfants: [] });

  /* Comparaison récursive (ordonne les descendants d'un même nœud) */
  function cmpRec(A, B, prof = 0) {
    if (A.Z !== B.Z) return B.Z - A.Z;
    if (prof > PROF_MAX) return 0;
    const ca = ordonner(A), cb = ordonner(B);
    const n = Math.max(ca.length, cb.length);
    for (let i = 0; i < n; i++) {
      const x = ca[i] ? ca[i].Z : -1, y = cb[i] ? cb[i].Z : -1;
      if (x !== y) return y - x;
    }
    for (let i = 0; i < n; i++) {
      if (!ca[i] || !cb[i]) continue;
      const r = cmpRec(ca[i], cb[i], prof + 1);
      if (r) return r;
    }
    return 0;
  }
  function ordonner(n) {
    if (n._ord) return n._ord;
    return (n._ord = n.enfants.slice().sort((a, b) => cmpRec(a, b)));
  }

  /* Comparaison de deux branches sphère par sphère (exploration en largeur, ordre hiérarchique) */
  function spheres(racine, prof) {
    let niveau = [racine]; const out = [];
    for (let d = 0; d < prof && niveau.length; d++) {
      const suivant = [], zs = [];
      niveau.forEach(nd => ordonner(nd).forEach(c => { zs.push(c.Z); suivant.push(c); }));
      out.push(zs); niveau = suivant;
      if (suivant.length > 4000) break;
    }
    return out;
  }
  function cmpBranche(A, B) {
    if (A.Z !== B.Z) return B.Z - A.Z;
    const sa = spheres(A, PROF_MAX), sb = spheres(B, PROF_MAX);
    for (let d = 0; d < Math.max(sa.length, sb.length); d++) {
      const x = sa[d] || [], y = sb[d] || [];
      for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const u = x[i] == null ? -1 : x[i], v = y[i] == null ? -1 : y[i];
        if (u !== v) return v - u;
      }
    }
    // Règle 1b : à squelette identique, l'isotope le plus lourd l'emporte
    if (A.masse !== B.masse) return B.masse - A.masse;
    return 0;
  }

  /* ---------- Classement des substituants d'un atome ---------- */
  function classement(mol, centre) {
    const vs = mol.neighbors(centre);
    const branches = vs.map(v => ({
      id: v.atom, el: mol.atom(v.atom).el, ordre: v.bond.order,
      racine: arbre(mol, centre, v.atom, new Set([centre, v.atom]), PROF_MAX, { n: 0 }),
    }));
    const lp = M.geo.doublets(mol, centre);
    if (branches.length === 3 && lp >= 1) branches.push({ id: null, el: 'doublet', ordre: 0, racine: fantome(0) });
    branches.sort((a, b) => cmpBranche(a.racine, b.racine));
    // rangs : deux branches indiscernables partagent le même rang
    let rang = 1;
    branches.forEach((b, i) => {
      if (i > 0 && cmpBranche(branches[i - 1].racine, b.racine) === 0) b.rang = branches[i - 1].rang;
      else b.rang = rang;
      rang++;
    });
    branches.forEach((b, i) => { b.priorite = i + 1; });
    return branches;
  }

  /* Toutes les branches sont-elles deux à deux différentes ? */
  function quatreDifferents(branches) {
    if (branches.length !== 4) return false;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      if (cmpBranche(branches[i].racine, branches[j].racine) === 0) return false;
    }
    return true;
  }

  /* ---------- Descripteur R/S ---------- */
  function descripteurRS(mol, centre) {
    const br = classement(mol, centre);
    if (!quatreDifferents(br)) return null;
    const c = mol.atom(centre);
    const v = br.map(b => b.id == null ? doubletDirection(mol, centre) : V.norm(V.sub(mol.atom(b.id), c)));
    // Produit mixte des trois premières priorités : négatif ⇒ sens horaire vu à l'opposé de d ⇒ R
    const t = V.dot(v[0], V.cross(v[1], v[2]));
    return { config: t < 0 ? 'R' : 'S', branches: br, triple: t };
  }
  /* Direction moyenne opposée aux liaisons : position du doublet non liant */
  function doubletDirection(mol, id) {
    const a = mol.atom(id);
    let s = { x: 0, y: 0, z: 0 };
    mol.neighborIds(id).forEach(i => { s = V.add(s, V.norm(V.sub(mol.atom(i), a))); });
    return V.len(s) < 1e-6 ? { x: 0, y: 0, z: 1 } : V.mul(V.norm(s), -1);
  }

  /* ---------- Centres stéréogènes ---------- */
  function centresAsymetriques(mol) {
    const out = [];
    mol.atoms.forEach(a => {
      const d = mol.degree(a.id);
      const lp = M.geo.doublets(mol, a.id);
      const stereogene = (d === 4 && lp === 0) || (d === 3 && lp === 1 && ['N', 'P', 'S'].includes(a.el) && (a.el !== 'N' || a.charge > 0));
      if (!stereogene) return;
      if (a.el === 'H') return;
      const br = classement(mol, a.id);
      if (!quatreDifferents(br)) return;
      const r = descripteurRS(mol, a.id);
      if (r) out.push({ id: a.id, el: a.el, config: r.config, branches: r.branches });
    });
    return out;
  }

  /* ---------- Descripteur Z/E des doubles liaisons ---------- */
  function doublesLiaisons(mol) {
    const out = [];
    mol.bonds.forEach(b => {
      if (b.order !== 2) return;
      if (mol.bondInRing(b)) {
        const r = mol.rings().find(x => x.includes(b.a) && x.includes(b.b));
        if (r && r.length <= 7) return;              // pas de stéréochimie Z/E dans un petit cycle
      }
      const na = mol.neighborIds(b.a).filter(i => i !== b.b);
      const nb = mol.neighborIds(b.b).filter(i => i !== b.a);
      if (na.length < 1 || nb.length < 1) return;
      if (na.length > 2 || nb.length > 2) return;
      const ra = na.length === 2 ? rangeDeux(mol, b.a, na) : { haut: na[0], egal: false };
      const rb = nb.length === 2 ? rangeDeux(mol, b.b, nb) : { haut: nb[0], egal: false };
      if (ra.egal || rb.egal) return;                // extrémité portant deux substituants identiques
      const dih = V.dihedral(mol.atom(ra.haut), mol.atom(b.a), mol.atom(b.b), mol.atom(rb.haut));
      out.push({
        bond: b.id, a: b.a, b: b.b, hautA: ra.haut, hautB: rb.haut,
        config: Math.abs(dih) < 90 ? 'Z' : 'E', angle: dih,
      });
    });
    return out;
  }
  function rangeDeux(mol, centre, deux) {
    const t = deux.map(id => ({ id, racine: arbre(mol, centre, id, new Set([centre, id]), PROF_MAX, { n: 0 }) }));
    const c = cmpBranche(t[0].racine, t[1].racine);
    return { haut: c <= 0 ? t[0].id : t[1].id, bas: c <= 0 ? t[1].id : t[0].id, egal: c === 0 };
  }

  /* ---------- Descripteur global ---------- */
  function descripteurs(mol) {
    const c = centresAsymetriques(mol), d = doublesLiaisons(mol);
    return {
      centres: c, doubles: d,
      n: c.length,
      texte: [...c.map(x => x.config), ...d.map(x => x.config)].join(','),
      nom: c.length || d.length
        ? '(' + [...c.map((x, i) => x.config), ...d.map(x => x.config)].join(',') + ')'
        : '',
    };
  }

  /* ---------- Invariants canoniques (raffinement de type Morgan) ---------- */
  function invariants(mol, avecStereo = true) {
    const ids = mol.atoms.map(a => a.id);
    let cls = new Map();
    mol.atoms.forEach(a => {
      cls.set(a.id, [Z(a.el), mol.degree(a.id), Math.round(mol.bondOrderSum(a.id) * 2), a.charge || 0, M.geo.doublets(mol, a.id)].join('.'));
    });
    for (let it = 0; it < ids.length + 2; it++) {
      const next = new Map();
      ids.forEach(id => {
        const v = mol.neighbors(id).map(n => cls.get(n.atom) + '·' + n.bond.order).sort().join('|');
        next.set(id, cls.get(id) + '(' + v + ')');
      });
      // compression en indices pour éviter l'explosion des chaînes
      const uniq = [...new Set(next.values())].sort();
      const idx = new Map(uniq.map((s, i) => [s, String(i)]));
      const comp = new Map(); ids.forEach(id => comp.set(id, idx.get(next.get(id))));
      if ([...ids].every(id => comp.get(id) === cls.get(id))) break;
      cls = comp;
    }
    if (avecStereo) {
      const d = descripteurs(mol);
      d.centres.forEach(c => cls.set(c.id, cls.get(c.id) + '@' + c.config));
      d.doubles.forEach(x => { cls.set(x.a, cls.get(x.a) + '#' + x.config); cls.set(x.b, cls.get(x.b) + '#' + x.config); });
    }
    return cls;
  }
  /* Signature indépendante de la numérotation : permet de comparer deux molécules */
  function signature(mol, avecStereo = true) {
    const c = invariants(mol, avecStereo);
    return [...c.values()].sort().join(';');
  }
  const memeConstitution = (a, b) => signature(a, false) === signature(b, false);
  const memeStereo = (a, b) => signature(a, true) === signature(b, true);

  /* ---------- Chiralité, méso ---------- */
  function estChirale(mol) {
    const im = mol.clone();
    M.geo.miroir(im);
    return signature(mol, true) !== signature(im, true);
  }
  function estMeso(mol) {
    const c = centresAsymetriques(mol);
    return c.length >= 2 && !estChirale(mol);
  }
  /* Relation entre deux stéréoisomères */
  function relation(a, b) {
    if (!memeConstitution(a, b)) {
      return M.analyse.formuleBrute(a) === M.analyse.formuleBrute(b)
        ? { type: 'constitution', texte: 'Isomères de constitution (même formule brute, enchaînement différent)' }
        : { type: 'aucune', texte: 'Formules brutes différentes : ce ne sont pas des isomères' };
    }
    if (memeStereo(a, b)) return { type: 'identiques', texte: 'Même composé (molécules superposables)' };
    const im = b.clone(); M.geo.miroir(im);
    if (memeStereo(a, im)) return { type: 'enantiomeres', texte: 'Énantiomères : images l’une de l’autre dans un miroir, non superposables' };
    return { type: 'diastereoisomeres', texte: 'Diastéréoisomères : stéréoisomères non images l’un de l’autre dans un miroir' };
  }

  /* ---------- Transformations ---------- */
  /* Inverse la configuration d'un centre en échangeant deux substituants (rotation de 180°) */
  function inverserCentre(mol, centre, paire) {
    const nb = mol.neighborIds(centre);
    if (nb.length < 3) return false;
    let i = paire ? paire[0] : null, j = paire ? paire[1] : null;
    if (i == null) {
      // on échange les deux plus petites branches : déplacement minimal
      const tailles = nb.map(id => { const s = mol.sideOf(centre, id); return { id, n: s ? s.size : 1e6 }; })
        .sort((a, b) => a.n - b.n);
      if (tailles[1].n > 1e5) return false;          // deux branches bloquées dans un cycle
      i = tailles[0].id; j = tailles[1].id;
    }
    const c = mol.atom(centre);
    const u1 = V.norm(V.sub(mol.atom(i), c)), u2 = V.norm(V.sub(mol.atom(j), c));
    const axe = V.norm(V.add(u1, u2));
    if (!isFinite(axe.x)) return false;
    const si = mol.sideOf(centre, i), sj = mol.sideOf(centre, j);
    if (!si || !sj) return false;
    [...si, ...sj].forEach(id => {
      const p = mol.atom(id);
      const r = V.rotate(V.sub(p, c), axe, Math.PI);
      p.x = c.x + r.x; p.y = c.y + r.y; p.z = c.z + r.z;
    });
    mol.touch();
    return true;
  }
  /* Énantiomère : image dans un miroir (toutes les configurations sont inversées) */
  function enantiomere(mol) {
    const m = mol.clone();
    M.geo.miroir(m);
    m.name = (mol.name || 'molécule') + ' — énantiomère';
    return m;
  }
  /* Diastéréoisomère : inversion d'un sous-ensemble de centres */
  function diastereoisomere(mol, centres) {
    const m = mol.clone();
    centres.forEach(id => inverserCentre(m, id));
    M.geo.optimiser(m, { steps: 250 });
    m.name = (mol.name || 'molécule') + ' — diastéréoisomère';
    return m;
  }
  /* Isomérisation Z ⇄ E d'une double liaison */
  function basculerZE(mol, bondId) {
    const b = mol.bond(bondId);
    if (!b || b.order !== 2) return false;
    const cote = mol.sideOf(b.a, b.b);
    if (!cote) return false;
    const pa = mol.atom(b.a), pb = mol.atom(b.b);
    const k = V.norm(V.sub(pb, pa));
    cote.forEach(id => {
      if (id === b.b) return;
      const p = mol.atom(id);
      const r = V.rotate(V.sub(p, pb), k, Math.PI);
      p.x = pb.x + r.x; p.y = pb.y + r.y; p.z = pb.z + r.z;
    });
    mol.touch();
    return true;
  }

  /* Centres asymétriques rangés dans l'ordre de la chaîne carbonée principale */
  function centresOrdonnes(mol) {
    const chaine = M.proj ? M.proj.chainePrincipale(mol) : [];
    const centres = centresAsymetriques(mol);
    const rang = new Map(chaine.map((id, i) => [id, i]));
    return centres.slice().sort((a, b) => (rang.has(a.id) ? rang.get(a.id) : 1e6) - (rang.has(b.id) ? rang.get(b.id) : 1e6) || a.id - b.id);
  }

  /* Impose une suite de configurations (par exemple « RSRR » pour le D-glucose) aux centres
     asymétriques pris dans l'ordre de la chaîne principale. Renvoie la liste obtenue. */
  function imposer(mol, cibles) {
    const voulu = (Array.isArray(cibles) ? cibles : String(cibles).split(/[,\s]*/)).filter(x => x === 'R' || x === 'S');
    for (let passe = 0; passe < 8; passe++) {
      const centres = centresOrdonnes(mol);
      if (centres.length !== voulu.length) break;
      let change = false;
      centres.forEach((c, i) => {
        if (c.config === voulu[i]) return;
        if (inverserCentre(mol, c.id)) change = true;
      });
      if (!change) break;
      M.geo.optimiser(mol, { steps: 260 });
    }
    M.geo.optimiser(mol, { steps: 300 });
    if (M.geo.prefererConformation) M.geo.prefererConformation(mol);
    return centresOrdonnes(mol).map(c => c.config);
  }

  /* Nombre maximal de stéréoisomères : 2ⁿ (n = centres + doubles liaisons stéréogènes) */
  function nombreStereoisomeres(mol) {
    const d = descripteurs(mol);
    const n = d.centres.length + d.doubles.length;
    return { n, max: Math.pow(2, n), meso: estMeso(mol) };
  }

  /* Explication pédagogique du classement CIP autour d'un centre */
  function expliquerCIP(mol, centre) {
    const br = classement(mol, centre);
    const lignes = br.map((b, i) => {
      const nom = b.id == null ? 'doublet non liant' : etiquetteBranche(mol, centre, b.id);
      return { rang: i + 1, texte: nom, Z: b.racine.Z, premiere: premiereSphere(b.racine) };
    });
    const rs = descripteurRS(mol, centre);
    return {
      centre, lignes,
      config: rs ? rs.config : null,
      conclusion: rs
        ? 'Le substituant de rang 4 est placé vers l’arrière ; le trajet 1 → 2 → 3 est '
          + (rs.config === 'R' ? 'horaire (sens des aiguilles d’une montre) : configuration R (rectus).' : 'antihoraire : configuration S (sinister).')
        : 'Cet atome n’est pas un centre asymétrique : au moins deux substituants sont identiques.',
    };
  }
  /* Liste des atomes rencontrés à la première sphère : Z = 0 désigne un doublet non liant,
     et l'astérisque un atome dupliqué au titre d'une liaison multiple ou d'une fermeture de cycle. */
  const premiereSphere = n => ordonner(n)
    .map(c => c.Z === 0 ? 'doublet' : (M.elements.byZ(c.Z) || { sym: '?' }).sym + (c.dup ? '*' : ''))
    .join(', ') || '—';
  function etiquetteBranche(mol, centre, id) {
    const s = mol.sideOf(centre, id);
    const n = s ? s.size : 1;
    const el = mol.atom(id).el;
    if (n === 1) return el === 'H' ? 'H (hydrogène)' : el;
    return el + ' — branche de ' + n + ' atome' + (n > 1 ? 's' : '');
  }

  M.stereo = {
    classement, cmpBranche, arbre, descripteurRS, centresAsymetriques, doublesLiaisons, descripteurs,
    invariants, signature, memeConstitution, memeStereo, estChirale, estMeso, relation,
    inverserCentre, enantiomere, diastereoisomere, basculerZE, nombreStereoisomeres, expliquerCIP,
    centresOrdonnes, imposer,
    quatreDifferents,
  };
})();
