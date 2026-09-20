/* Lecture et écriture du format SMILES (y compris la stéréochimie @/@@ et /\ ).
   Sert à la bibliothèque interne, à l'import-export et aux énoncés d'exercices. */
(function () {
  const V = M.V;
  const ORGANIQUE = ['Cl', 'Br', 'B', 'C', 'N', 'O', 'P', 'S', 'F', 'I'];
  const AROMATIQUE = { b: 'B', c: 'C', n: 'N', o: 'O', p: 'P', s: 'S' };

  /* ---------- Lecture ---------- */
  function lire(txt, opt = {}) {
    const s = String(txt || '').trim();
    if (!s) throw new Error('Chaîne SMILES vide');
    const mol = new M.Molecule(opt.nom || '');
    let i = 0;
    const pile = [];                 // branches ouvertes
    const cycles = new Map();        // numéro de cycle → { id, ordre, dir }
    const aromA = new Set();         // atomes écrits en minuscules
    const dirs = [];                 // liaisons directionnelles / et \
    const chir = new Map();          // atome → { sens, voisins: [] }
    let prec = null, ordreEnAttente = null, dirEnAttente = null;

    const erreur = m => { throw new Error('SMILES, caractère ' + (i + 1) + ' : ' + m); };

    function poser(sym, o = {}) {
      const a = mol.addAtom(sym, { x: 0, y: 0, z: 0 }, o);
      if (prec != null) {
        const ordre = ordreEnAttente != null ? ordreEnAttente
          : (aromA.has(prec) && o.aro) ? 1.5 : 1;
        const b = mol.addBond(prec, a.id, ordre);
        if (dirEnAttente) dirs.push({ de: prec, vers: a.id, dir: dirEnAttente, bond: b });
        if (chir.has(prec)) chir.get(prec).voisins.push(a.id);
        if (chir.has(a.id)) chir.get(a.id).voisins.push(prec);
      }
      if (o.aro) aromA.add(a.id);
      ordreEnAttente = null; dirEnAttente = null;
      prec = a.id;
      return a;
    }

    while (i < s.length) {
      const c = s[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '(') { pile.push(prec); i++; continue; }
      if (c === ')') { prec = pile.pop(); if (prec === undefined) erreur('parenthèse fermante non appariée'); i++; continue; }
      if (c === '.') { prec = null; i++; continue; }
      if ('-=#$:'.includes(c)) { ordreEnAttente = { '-': 1, '=': 2, '#': 3, '$': 4, ':': 1.5 }[c]; i++; continue; }
      if (c === '/' || c === '\\') { dirEnAttente = c; i++; continue; }
      if (c === '%') {
        const n = s.slice(i + 1, i + 3);
        if (!/^\d\d$/.test(n)) erreur('numéro de cycle %nn attendu');
        fermerCycle(+n); i += 3; continue;
      }
      if (/\d/.test(c)) { fermerCycle(+c); i++; continue; }
      if (c === '[') {
        const j = s.indexOf(']', i);
        if (j < 0) erreur('crochet « ] » manquant');
        lireCrochet(s.slice(i + 1, j));
        i = j + 1; continue;
      }
      const deux = s.slice(i, i + 2);
      if (ORGANIQUE.includes(deux)) { poser(deux, {}); i += 2; continue; }
      if (ORGANIQUE.includes(c)) { poser(c, {}); i += 1; continue; }
      if (AROMATIQUE[c]) { poser(AROMATIQUE[c], { aro: true }); i += 1; continue; }
      if (c === '*') { poser('C', { label: 'R' }); i += 1; continue; }
      erreur('symbole « ' + c + ' » non reconnu');
    }
    if (pile.length) throw new Error('SMILES : parenthèse ouvrante non fermée');
    if (cycles.size) throw new Error('SMILES : cycle ' + [...cycles.keys()].join(', ') + ' non refermé');

    function fermerCycle(n) {
      if (cycles.has(n)) {
        const o = cycles.get(n); cycles.delete(n);
        const ordre = ordreEnAttente != null ? ordreEnAttente : o.ordre != null ? o.ordre
          : (aromA.has(o.id) && aromA.has(prec)) ? 1.5 : 1;
        const b = mol.addBond(o.id, prec, ordre);
        if (o.dir) dirs.push({ de: o.id, vers: prec, dir: o.dir, bond: b });
        if (dirEnAttente) dirs.push({ de: prec, vers: o.id, dir: dirEnAttente, bond: b });
        if (chir.has(o.id)) {
          const arr = chir.get(o.id).voisins, k = arr.indexOf(-n);
          if (k >= 0) arr[k] = prec; else arr.push(prec);
        }
        if (chir.has(prec)) chir.get(prec).voisins.push(o.id);
        ordreEnAttente = null; dirEnAttente = null;
      } else {
        cycles.set(n, { id: prec, ordre: ordreEnAttente, dir: dirEnAttente });
        if (chir.has(prec)) chir.get(prec).voisins.push(-n);   // repère provisoire
        ordreEnAttente = null; dirEnAttente = null;
      }
    }

    function lireCrochet(t) {
      const m = /^(\d+)?([A-Za-z*][a-z]?)(@{1,2})?(H\d*)?((?:[+-]\d*)*)?(?::\d+)?$/.exec(t);
      if (!m) erreur('contenu de crochet « [' + t + '] » non reconnu');
      const iso = m[1] ? +m[1] : 0;
      let sym = m[2], aro = false;
      if (AROMATIQUE[sym]) { aro = true; sym = AROMATIQUE[sym]; }
      if (sym === '*') sym = 'C';
      let q = 0;
      (m[5] || '').replace(/([+-])(\d*)/g, (_, sg, n) => { q += (sg === '+' ? 1 : -1) * (n ? +n : 1); return ''; });
      const nH = m[4] ? (m[4].length > 1 ? +m[4].slice(1) : 1) : 0;
      const precAvant = prec;
      const a = poser(sym, { charge: q, iso, aro });
      if (m[3]) chir.set(a.id, { sens: m[3], voisins: precAvant != null ? [precAvant] : [] });
      for (let k = 0; k < nH; k++) {
        const h = mol.addAtom('H', { x: 0, y: 0, z: 0 });
        mol.addBond(a.id, h.id, 1);
        if (chir.has(a.id)) chir.get(a.id).voisins.push(h.id);
      }
      // hydrogènes explicites : on empêche la complétion automatique
      if (m[4]) a.hFixe = true;
      prec = a.id;
    }

    /* Hydrogènes implicites puis coordonnées 3D */
    const sansH = mol.atoms.filter(a => a.el !== 'H' && !a.hFixe).map(a => a.id);
    M.geo.ajouterHydrogenes(mol, sansH);
    mol.atoms.forEach(a => { delete a.hFixe; });
    /* La conformation n'est arbitrée qu'après la stéréochimie : inverser un centre
       déplace des substituants et change les positions axiales et équatoriales. */
    M.geo.construire3D(mol, { steps: 500, conformation: false });

    /* Application de la stéréochimie déclarée */
    appliquerChiralite(mol, chir);
    appliquerDirections(mol, dirs);
    M.geo.optimiser(mol, { steps: 200 });
    M.geo.prefererConformation(mol);
    mol.recenter();
    if (!mol.name) mol.name = 'SMILES';
    mol.meta.smiles = s;
    return mol;
  }

  /* Oriente chaque centre @/@@ : vu depuis le premier voisin, les trois suivants
     tournent dans le sens antihoraire pour « @ », horaire pour « @@ ». */
  function appliquerChiralite(mol, chir) {
    chir.forEach((info, id) => {
      let vs = info.voisins.filter(x => x >= 0);
      const reels = mol.neighborIds(id);
      reels.forEach(r => { if (!vs.includes(r)) vs.push(r); });
      vs = vs.filter(x => reels.includes(x));
      if (vs.length < 4) return;
      const c = mol.atom(id);
      const u = vs.slice(0, 4).map(x => V.norm(V.sub(mol.atom(x), c)));
      const t = V.dot(u[1], V.cross(u[2], u[3]));
      const voulu = info.sens === '@' ? -1 : 1;
      if (Math.sign(t) !== voulu) M.stereo.inverserCentre(mol, id);
    });
  }

  /* Applique les liaisons directionnelles / et \ autour des doubles liaisons */
  function appliquerDirections(mol, dirs) {
    if (!dirs.length) return;
    const cote = (d, atomeDouble) => {
      // « X/Y » : X est en bas à gauche, Y en haut à droite
      if (d.de === atomeDouble) return d.dir === '/' ? +1 : -1;   // substituant = d.vers
      return d.dir === '/' ? -1 : +1;                              // substituant = d.de
    };
    mol.bonds.forEach(b => {
      if (b.order !== 2) return;
      const da = dirs.find(d => (d.de === b.a || d.vers === b.a) && d.bond.id !== b.id);
      const db = dirs.find(d => (d.de === b.b || d.vers === b.b) && d.bond.id !== b.id);
      if (!da || !db) return;
      const sa = da.de === b.a ? da.vers : da.de;
      const sb = db.de === b.b ? db.vers : db.de;
      const voulu = cote(da, b.a) === cote(db, b.b) ? 0 : 180;     // même côté ⇒ cis
      const actuel = Math.abs(V.dihedral(mol.atom(sa), mol.atom(b.a), mol.atom(b.b), mol.atom(sb)));
      const estCis = actuel < 90;
      if ((voulu === 0) !== estCis) M.stereo.basculerZE(mol, b.id);
    });
  }

  /* ---------- Écriture ---------- */
  function ecrire(mol, opt = {}) {
    if (!mol.atoms.length) return '';
    /* Les hydrogènes liés à un atome lourd restent implicites */
    const garde = new Set(mol.atoms.filter(a => a.el !== 'H' || mol.degree(a.id) !== 1
      || mol.neighborIds(a.id).every(i => mol.atom(i).el === 'H')).map(a => a.id));
    if (!garde.size) return 'H';
    const voisinsGardes = id => mol.neighborIds(id).filter(x => garde.has(x));
    const nbH = id => mol.neighborIds(id).filter(i => !garde.has(i)).length;

    const arom = new Set();
    mol.rings().forEach(r => { if (M.analyse.aromatique(mol, r)) r.forEach(x => arom.add(x)); });
    const centres = new Map(M.stereo.centresAsymetriques(mol).map(c => [c.id, c]));

    /* 1) Parcours en profondeur : liaisons d'arbre et liaisons de fermeture de cycle */
    const fermetures = new Set();   // « a:b » avec a < b
    const cle = (a, b) => Math.min(a, b) + ':' + Math.max(a, b);
    const vu = new Set(), enCours = new Set();
    function explorer(id, pere) {
      vu.add(id); enCours.add(id);
      for (const n of voisinsGardes(id)) {
        if (n === pere) continue;
        if (enCours.has(n)) { fermetures.add(cle(id, n)); continue; }
        if (!vu.has(n)) explorer(n, id);
      }
      enCours.delete(id);
    }
    const racines = [];
    mol.fragments().forEach(f => {
      const c = f.filter(x => garde.has(x));
      if (!c.length) return;
      const r = c.slice().sort((a, b) => voisinsGardes(a).length - voisinsGardes(b).length)[0];
      racines.push(r);
      if (!vu.has(r)) explorer(r, null);
    });

    /* 2) Écriture */
    const numero = new Map();       // clé de fermeture → numéro de cycle
    let prochain = 1;
    const ecrit = new Set();
    const ordreVoisins = new Map();

    const lienSym = o => o === 2 ? '=' : o === 3 ? '#' : '';

    /* Marques directionnelles / et \\ des doubles liaisons stéréogènes.
       On fixe arbitrairement le côté du premier substituant, l'autre s'en déduit. */
    const cotes = new Map();        // id d'atome substituant → +1 / −1 (par double liaison)
    M.stereo.doublesLiaisons(mol).forEach(d => {
      const sa = voisinsGardes(d.a).filter(x => x !== d.b)[0];
      const sb = voisinsGardes(d.b).filter(x => x !== d.a)[0];
      if (sa == null || sb == null) return;
      const cis = Math.abs(V.dihedral(mol.atom(sa), mol.atom(d.a), mol.atom(d.b), mol.atom(sb))) < 90;
      cotes.set(sa + ':' + d.a, 1);
      cotes.set(sb + ':' + d.b, cis ? 1 : -1);
    });
    /* Caractère à écrire pour une liaison simple orientée de `de` vers `vers` */
    function marqueDir(de, vers) {
      if (cotes.has(vers + ':' + de)) return cotes.get(vers + ':' + de) === 1 ? '/' : '\\';
      if (cotes.has(de + ':' + vers)) return cotes.get(de + ':' + vers) === 1 ? '\\' : '/';
      return '';
    }

    function symbole(id) {
      const a = mol.atom(id);
      const q = a.charge || 0, h = nbH(id), aro = arom.has(id);
      const base = aro ? a.el.toLowerCase() : a.el;
      const chi = opt.stereo === false ? '' : marque(id);
      const attendus = Math.max(0, M.geo.liaisonsAttendues(a.el, q) - (mol.bondOrderSum(id) - h));
      if (ORGANIQUE.includes(a.el) && !q && !a.iso && !chi && !a.radical && h === attendus) return base;
      return '[' + (a.iso || '') + base + chi + (h ? 'H' + (h > 1 ? h : '') : '')
        + (q ? (q > 0 ? '+' : '-') + (Math.abs(q) > 1 ? Math.abs(q) : '') : '') + ']';
    }
    /* @ : vu depuis le premier voisin écrit, les trois suivants tournent dans le sens antihoraire */
    function marque(id) {
      if (!centres.has(id)) return '';
      const vs = ordreVoisins.get(id);
      if (!vs || vs.length < 4) return '';
      const c = mol.atom(id);
      const u = vs.slice(0, 4).map(x => V.norm(V.sub(mol.atom(x), c)));
      return V.dot(u[1], V.cross(u[2], u[3])) < 0 ? '@' : '@@';
    }

    function branche(id, pere) {
      ecrit.add(id);
      const vsn = voisinsGardes(id).filter(x => x !== pere);
      const ferm = vsn.filter(n => fermetures.has(cle(id, n)));
      const suite = vsn.filter(n => !ferm.includes(n) && !ecrit.has(n));
      /* ordre des voisins tel qu'il apparaît dans la chaîne : père, H implicites, cycles, branches */
      const ordre = [];
      if (pere != null) ordre.push(pere);
      mol.neighborIds(id).filter(x => !garde.has(x)).forEach(h => ordre.push(h));
      ferm.concat(suite).forEach(x => ordre.push(x));
      ordreVoisins.set(id, ordre);

      let t = symbole(id);
      ferm.forEach(n => {
        const k = cle(id, n);
        let num = numero.get(k);
        if (!num) { num = prochain++; numero.set(k, num); }
        const b = mol.bondBetween(id, n);
        t += (ecrit.has(n) ? lienSym(b.order) : '') + (num > 9 ? '%' + num : num);
      });
      suite.forEach((n, k) => {
        if (ecrit.has(n)) return;
        const b = mol.bondBetween(id, n);
        const lien = b.order === 1 ? (opt.stereo === false ? '' : marqueDir(id, n)) : lienSym(b.order);
        const seg = lien + branche(n, id);
        t += (k < suite.length - 1) ? '(' + seg + ')' : seg;
      });
      return t;
    }

    return racines.map(r => branche(r, null)).join('.');
  }

  M.smiles = { lire, ecrire };
})();
