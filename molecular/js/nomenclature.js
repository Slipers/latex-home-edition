/* Nomenclature systématique (UICPA, usage français) pour les composés usuels du programme :
   chaînes acycliques, cycloalcanes et dérivés du benzène. */
(function () {
  const RACINES = ['', 'méth', 'éth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'déc',
    'undéc', 'dodéc', 'tridéc', 'tétradéc', 'pentadéc', 'hexadéc', 'heptadéc', 'octadéc', 'nonadéc', 'icos'];
  const MULT = ['', '', 'di', 'tri', 'tétra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'déca'];
  const HALO = { F: 'fluoro', Cl: 'chloro', Br: 'bromo', I: 'iodo' };

  /* Fonctions classées par priorité décroissante ; `suffixe` s'emploie en fonction principale,
     `prefixe` lorsqu'une fonction plus prioritaire est présente. */
  const FONCTIONS = [
    { cle: 'acide', nom: 'acide carboxylique', suffixe: 'oïque', prefixe: 'carboxy', prefixeNom: 'acide ' },
    { cle: 'ester', nom: 'ester', suffixe: 'oate', prefixe: 'alcoxycarbonyl' },
    { cle: 'amide', nom: 'amide', suffixe: 'amide', prefixe: 'carbamoyl' },
    { cle: 'nitrile', nom: 'nitrile', suffixe: 'nitrile', prefixe: 'cyano' },
    { cle: 'aldehyde', nom: 'aldéhyde', suffixe: 'al', prefixe: 'oxo' },
    { cle: 'cetone', nom: 'cétone', suffixe: 'one', prefixe: 'oxo' },
    { cle: 'alcool', nom: 'alcool', suffixe: 'ol', prefixe: 'hydroxy' },
    { cle: 'amine', nom: 'amine', suffixe: 'amine', prefixe: 'amino' },
  ];

  /* ---------- Repérage des fonctions portées par chaque carbone ---------- */
  function fonctionsPortees(mol) {
    const map = new Map();       // id de carbone → liste de { cle, ids }
    const push = (id, cle, ids) => { if (!map.has(id)) map.set(id, []); map.get(id).push({ cle, ids }); };
    M.analyse.groupes(mol).forEach(g => {
      const c = g.ids[0];
      switch (g.nom) {
        case 'Acide carboxylique': push(c, 'acide', g.ids); break;
        case 'Ester': push(c, 'ester', g.ids); break;
        case 'Amide': push(c, 'amide', g.ids); break;
        case 'Nitrile': push(c, 'nitrile', g.ids); break;
        case 'Aldéhyde': push(c, 'aldehyde', g.ids); break;
        case 'Cétone': push(c, 'cetone', g.ids); break;
        case 'Alcool': case 'Phénol': push(c, 'alcool', g.ids); break;
        case 'Amine': push(g.ids[0], 'amine', g.ids); break;
        default: break;
      }
    });
    /* les amines sont repérées par l'azote : on les rattache au carbone porteur */
    const m2 = new Map();
    map.forEach((v, id) => {
      v.forEach(f => {
        let cible = id;
        if (f.cle === 'amine') {
          const c = mol.neighborIds(id).find(x => mol.atom(x).el === 'C');
          if (c == null) return; cible = c;
        }
        if (!m2.has(cible)) m2.set(cible, []);
        m2.get(cible).push(f);
      });
    });
    return m2;
  }

  function fonctionPrincipale(fmap) {
    let best = null;
    fmap.forEach(l => l.forEach(f => {
      const i = FONCTIONS.findIndex(x => x.cle === f.cle);
      if (best == null || i < best.i) best = { i, cle: f.cle };
    }));
    return best ? FONCTIONS[best.i] : null;
  }

  /* ---------- Chaînes carbonées ---------- */
  function toutesLesChaines(mol, cs) {
    const set = new Set(cs);
    const chaines = [];
    const bouts = cs.filter(id => mol.neighborIds(id).filter(x => set.has(x)).length <= 1);
    const depart = bouts.length ? bouts : cs;
    depart.forEach(d => {
      const pile = [[d, [d]]];
      while (pile.length) {
        const [cur, ch] = pile.pop();
        let prolonge = false;
        mol.neighborIds(cur).filter(x => set.has(x) && !ch.includes(x)).forEach(n => {
          prolonge = true; pile.push([n, ch.concat(n)]);
        });
        if (!prolonge && ch.length > 1) chaines.push(ch);
        if (chaines.length > 4000) return;
      }
    });
    if (!chaines.length && cs.length === 1) chaines.push([cs[0]]);
    return chaines;
  }

  /* ---------- Nom d'un substituant ---------- */
  function nomSubstituant(mol, id, depuis) {
    const a = mol.atom(id);
    if (HALO[a.el]) return HALO[a.el];
    if (a.el === 'O') {
      const autre = mol.neighborIds(id).find(x => x !== depuis && mol.atom(x).el === 'C');
      if (autre == null) return 'hydroxy';
      const n = tailleChaine(mol, autre, id);
      return (RACINES[n] || ('C' + n)) + 'oxy';
    }
    if (a.el === 'N') {
      const o = mol.neighbors(id).filter(v => mol.atom(v.atom).el === 'O');
      if (o.length >= 2) return 'nitro';
      return 'amino';
    }
    if (a.el === 'S') return 'sulfanyl';
    if (a.el !== 'C') return a.el.toLowerCase();
    /* cycle benzénique */
    const cyc = mol.rings().find(r => r.includes(id));
    if (cyc && cyc.length === 6 && M.analyse.aromatique(mol, cyc)) return 'phényl';
    if (cyc) return 'cyclo' + (RACINES[cyc.length] || cyc.length) + 'yl';
    const branche = [...mol.reachable(id, new Set([depuis]))].filter(x => mol.atom(x).el === 'C');
    const n = branche.length;
    const ram = branche.filter(x => mol.neighborIds(x).filter(y => mol.atom(y).el === 'C' && (y !== depuis || x !== id)).length >= 3).length;
    if (n === 3 && ram) return 'propan-2-yl';               // isopropyle
    if (n === 4 && mol.neighborIds(id).filter(y => mol.atom(y).el === 'C' && y !== depuis).length === 3) return 'tert-butyl';
    if (n === 4 && ram) return '2-méthylpropyl';            // isobutyle
    if (n <= 20 && !ram) return (RACINES[n] || ('C' + n)) + 'yl';
    return (RACINES[n] || ('C' + n)) + 'yl';
  }
  function tailleChaine(mol, id, depuis) {
    return [...mol.reachable(id, new Set([depuis]))].filter(x => mol.atom(x).el === 'C').length;
  }

  /* ---------- Nom systématique ---------- */
  function nommer(mol) {
    try { return construire(mol); } catch (e) { return { nom: null, motif: e.message }; }
  }

  function construire(mol) {
    const cs = mol.atoms.filter(a => a.el === 'C').map(a => a.id);
    if (!cs.length) return { nom: nomInorganique(mol), motif: 'composé sans carbone' };
    const cycles = mol.rings();
    const fmap = fonctionsPortees(mol);
    const princ = fonctionPrincipale(fmap);
    const st = M.stereo.descripteurs(mol);

    /* Dérivés simples du benzène */
    const benz = cycles.find(r => r.length === 6 && M.analyse.aromatique(mol, r));
    if (benz && cs.length >= 6) {
      const n = nomBenzenique(mol, benz, fmap, princ);
      if (n) return { nom: prefixeStereo(st, n), motif: 'dérivé du benzène' };
    }

    /* Cycloalcanes */
    const cyc = cycles.find(r => r.every(i => mol.atom(i).el === 'C'));
    if (cyc && cs.length >= cyc.length && cycles.length === 1) {
      const n = nomCyclique(mol, cyc, fmap, princ);
      if (n) return { nom: prefixeStereo(st, n), motif: 'composé cyclique' };
    }
    if (cycles.length) return { nom: null, motif: cycles.length > 1 ? 'structure polycyclique' : 'hétérocycle' };

    /* Chaîne principale : la plus longue portant la fonction principale */
    const porteurs = new Set();
    if (princ) fmap.forEach((l, id) => { if (l.some(f => f.cle === princ.cle)) porteurs.add(id); });
    let chaines = toutesLesChaines(mol, cs);
    if (porteurs.size) {
      const avec = chaines.filter(ch => ch.some(i => porteurs.has(i)));
      if (avec.length) chaines = avec;
    }
    const nbInsat = ch => compterInsaturations(mol, ch).total;
    const maxLen = Math.max(...chaines.map(c => c.length));
    chaines = chaines.filter(c => c.length === maxLen);
    const maxIns = Math.max(...chaines.map(nbInsat));
    chaines = chaines.filter(c => nbInsat(c) === maxIns);

    /* Numérotation : indices les plus faibles pour la fonction principale, puis les insaturations, puis les substituants */
    let meilleur = null;
    chaines.forEach(ch => {
      [ch, ch.slice().reverse()].forEach(c => {
        const d = decrire(mol, c, fmap, princ);
        const cle = [d.locFonction, d.locInsat, d.locSubs, d.nomSubs].map(x => JSON.stringify(x)).join('|');
        if (!meilleur || compareCle(d, meilleur.d) < 0) meilleur = { c, d, cle };
      });
    });
    if (!meilleur) return { nom: null, motif: 'aucune chaîne exploitable' };
    return { nom: prefixeStereo(st, assembler(mol, meilleur.c, meilleur.d, princ)), motif: 'chaîne acyclique' };
  }

  const cmpListe = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] == null ? 1e9 : a[i], y = b[i] == null ? 1e9 : b[i];
      if (x !== y) return x - y;
    }
    return 0;
  };
  function compareCle(a, b) {
    return cmpListe(a.locFonction, b.locFonction) || cmpListe(a.locInsat, b.locInsat)
      || cmpListe(a.locSubs, b.locSubs) || (a.nomSubs.join() < b.nomSubs.join() ? -1 : a.nomSubs.join() > b.nomSubs.join() ? 1 : 0);
  }

  function compterInsaturations(mol, ch) {
    const d = [], t = [];
    for (let i = 0; i < ch.length - 1; i++) {
      const b = mol.bondBetween(ch[i], ch[i + 1]);
      if (!b) continue;
      if (b.order === 2) d.push(i + 1);
      if (b.order === 3) t.push(i + 1);
    }
    return { doubles: d, triples: t, total: d.length + t.length };
  }

  function decrire(mol, ch, fmap, princ) {
    const pos = new Map(ch.map((id, i) => [id, i + 1]));
    const ins = compterInsaturations(mol, ch);
    const locFonction = [];
    if (princ) ch.forEach((id, i) => {
      const l = fmap.get(id);
      if (l && l.some(f => f.cle === princ.cle)) locFonction.push(i + 1);
    });
    const subs = [];
    ch.forEach((id, i) => {
      /* substituants : voisins hors chaîne, hydrogènes exclus */
      mol.neighborIds(id).forEach(n => {
        if (pos.has(n) || mol.atom(n).el === 'H') return;
        const l = fmap.get(id) || [];
        const estPrinc = princ && l.some(f => f.cle === princ.cle && f.ids.includes(n));
        if (estPrinc) return;
        const f = l.find(x => x.ids.includes(n));
        if (f) {
          const def = FONCTIONS.find(x => x.cle === f.cle);
          subs.push({ loc: i + 1, nom: def ? def.prefixe : nomSubstituant(mol, n, id) });
        } else subs.push({ loc: i + 1, nom: nomSubstituant(mol, n, id) });
      });
      /* cétone ou aldéhyde en position interne : préfixe « oxo » si ce n'est pas la fonction principale */
      const l = fmap.get(id) || [];
      l.forEach(f => {
        if (princ && f.cle === princ.cle) return;
        const def = FONCTIONS.find(x => x.cle === f.cle);
        if (def && (f.cle === 'cetone' || f.cle === 'aldehyde')) subs.push({ loc: i + 1, nom: 'oxo' });
      });
    });
    subs.sort((a, b) => a.loc - b.loc || (a.nom < b.nom ? -1 : 1));
    return {
      locFonction: locFonction.sort((a, b) => a - b),
      locInsat: ins.doubles.concat(ins.triples).sort((a, b) => a - b),
      locSubs: subs.map(s => s.loc),
      nomSubs: subs.map(s => s.nom),
      ins, subs, pos,
    };
  }

  /* Assemblage : préfixes + racine + insaturations + suffixe.
     Règle d'élision : le « e » de l'alcane tombe devant une voyelle (propan-2-ol)
     et se maintient devant une consonne (propane-1,2,3-triol). */
  const multiplicatif = n => (n < MULT.length ? MULT[n] : n + '-');

  function assembler(mol, ch, d, princ) {
    const n = ch.length;
    const racine = RACINES[n] || ('C' + n);
    /* Regroupement des substituants identiques : 2,3-diméthyl… */
    const groupes = {};
    d.subs.forEach(s2 => { (groupes[s2.nom] = groupes[s2.nom] || []).push(s2.loc); });
    const cles = Object.keys(groupes).sort((a, b) => alpha(a) < alpha(b) ? -1 : 1);
    const prefixes = cles.map(k => {
      const l = groupes[k].sort((a, b) => a - b);
      if (n <= 2 && l.length === 1) return k;      // position unique : indice inutile
      return l.join(',') + '-' + multiplicatif(l.length) + k;
    }).join('');

    /* Insaturations : « buta-1,3-diène » mais « but-1-ène » */
    const dbl = d.ins.doubles, tpl = d.ins.triples;
    let corps = racine;
    if (!dbl.length && !tpl.length) corps += 'an';
    else {
      if (dbl.length) corps += (dbl.length > 1 ? 'a' : '') + '-' + dbl.join(',') + '-' + multiplicatif(dbl.length) + 'èn';
      if (tpl.length) corps += (dbl.length ? '' : (tpl.length > 1 ? 'a' : '')) + '-' + tpl.join(',') + '-' + multiplicatif(tpl.length) + 'yn';
    }

    if (!princ) return prefixes + corps + 'e';

    const loc = d.locFonction, mult = multiplicatif(loc.length);
    /* Sur une chaîne de un ou deux carbones la position est unique : l'indice est omis */
    const indice = n <= 2 && loc.length === 1 ? '' : '-' + loc.join(',') + '-';
    /* « e » conservé quand le suffixe commence par une consonne (di-, tri-…) */
    const base = corps + (mult ? 'e' : '');
    switch (princ.cle) {
      case 'acide':
        return 'acide ' + prefixes + corps + (loc.length > 1 ? 'e' + mult + 'oïque' : 'oïque');
      case 'aldehyde':
        return prefixes + corps + (loc.length > 1 ? 'e' + mult + 'al' : 'al');
      case 'nitrile':
        return prefixes + corps + 'e' + (loc.length > 1 ? mult : '') + 'nitrile';
      case 'amide':
        return prefixes + corps + (loc.length > 1 ? 'e' + mult : '') + 'amide';
      case 'ester':
        return prefixes + corps + 'oate d\u2019alkyle';
      case 'cetone':
        return prefixes + base + indice + mult + 'one';
      case 'alcool':
        return prefixes + base + indice + mult + 'ol';
      case 'amine':
        return prefixes + base + indice + mult + 'amine';
      default:
        return prefixes + corps + 'e';
    }
  }

  /* Pour l'ordre alphabétique on ignore les préfixes multiplicatifs et « iso/tert » */
  const alpha = s => s.replace(/^(di|tri|tétra|penta|hexa|tert-|sec-)/, '');

  function prefixeStereo(st, nom) {
    if (!nom) return nom;
    const d = [...st.centres.map(c => c.config), ...st.doubles.map(c => c.config)];
    return d.length ? '(' + d.join(',') + ')-' + nom : nom;
  }

  /* ---------- Cycles ---------- */
  function nomCyclique(mol, cyc, fmap, princ) {
    const base = 'cyclo' + (RACINES[cyc.length] || cyc.length) + 'an';
    const subs = [];
    cyc.forEach((id, i) => {
      mol.neighborIds(id).forEach(n => {
        if (cyc.includes(n) || mol.atom(n).el === 'H') return;
        const l = fmap.get(id) || [];
        const f = l.find(x => x.ids.includes(n));
        if (princ && f && f.cle === princ.cle) return;
        subs.push({ loc: i + 1, nom: f ? (FONCTIONS.find(x => x.cle === f.cle) || {}).prefixe || nomSubstituant(mol, n, id) : nomSubstituant(mol, n, id) });
      });
    });
    const groupes = {};
    subs.forEach(s => { (groupes[s.nom] = groupes[s.nom] || []).push(s.loc); });
    const pre = Object.keys(groupes).sort((a, b) => alpha(a) < alpha(b) ? -1 : 1)
      .map(k => groupes[k].sort((a, b) => a - b).join(',') + '-' + multiplicatif(groupes[k].length) + k).join('');
    const prefixe = subs.length === 1 && Object.keys(groupes).length === 1 && groupes[Object.keys(groupes)[0]].length === 1
      ? Object.keys(groupes)[0] : pre;
    if (!princ) return prefixe + base + 'e';
    if (princ.cle === 'alcool') return prefixe + base + '-1-ol';
    if (princ.cle === 'cetone') return prefixe + base + '-1-one';
    if (princ.cle === 'acide') return 'acide ' + prefixe + base + 'ecarboxylique';
    if (princ.cle === 'amine') return prefixe + base + '-1-amine';
    return prefixe + base + 'e';
  }

  const BENZ = { alcool: 'phénol', amine: 'aniline', aldehyde: 'benzaldéhyde', acide: 'acide benzoïque', cetone: null };
  function nomBenzenique(mol, ring, fmap, princ) {
    /* substituants repérés par leur position dans l'ordre du cycle */
    const brut = [];
    ring.forEach((id, i) => mol.neighborIds(id).forEach(n => {
      if (ring.includes(n) || mol.atom(n).el === 'H') return;
      const l = fmap.get(id) || [];
      const f = l.find(x => x.ids.includes(n));
      if (princ && f && f.cle === princ.cle) { brut.push({ i, principal: true }); return; }
      brut.push({ i, nom: f ? (FONCTIONS.find(x => x.cle === f.cle) || {}).prefixe : nomSubstituant(mol, n, id) });
    }));
    const autres = brut.filter(s2 => !s2.principal);
    const principaux = brut.filter(s2 => s2.principal);
    if (princ && BENZ[princ.cle] && !autres.length) return BENZ[princ.cle];
    if (princ && !BENZ[princ.cle]) return null;

    /* numérotation donnant les indices les plus faibles (6 rotations × 2 sens) */
    let meilleur = null;
    for (let dep = 0; dep < 6; dep++) for (const sens of [1, -1]) {
      const num = i => ((sens * (i - dep) % 6) + 6) % 6 + 1;
      if (principaux.length && num(principaux[0].i) !== 1) continue;
      const l = autres.map(s2 => ({ nom: s2.nom, loc: num(s2.i) })).sort((a, b) => a.loc - b.loc || (a.nom < b.nom ? -1 : 1));
      const cle = l.map(x => x.loc);
      if (!meilleur || cmpListe(cle, meilleur.cle) < 0) meilleur = { cle, l };
    }
    const l = meilleur ? meilleur.l : [];
    const groupes = {};
    l.forEach(s2 => { (groupes[s2.nom] = groupes[s2.nom] || []).push(s2.loc); });
    const cles = Object.keys(groupes).sort((a, b) => alpha(a) < alpha(b) ? -1 : 1);
    const suffixe = princ ? BENZ[princ.cle] : 'benzène';
    if (!l.length) return suffixe;
    if (l.length === 1 && !princ) return l[0].nom + 'benzène';
    const pre = cles.map(k => groupes[k].sort((a, b) => a - b).join(',') + '-' + multiplicatif(groupes[k].length) + k).join('');
    return princ ? pre + suffixe : pre + 'benzène';
  }

  function nomInorganique(mol) {
    const f = M.analyse.formuleBrute(mol);
    const usuels = { 'H₂O': 'eau', 'NH₃': 'ammoniac', 'CO₂': 'dioxyde de carbone', 'CO': 'monoxyde de carbone',
      'SO₂': 'dioxyde de soufre', 'SO₃': 'trioxyde de soufre', 'H₂S': 'sulfure d’hydrogène', 'N₂': 'diazote',
      'O₂': 'dioxygène', 'O₃': 'ozone', 'H₂': 'dihydrogène', 'Cl₂': 'dichlore', 'HCl': 'chlorure d’hydrogène',
      'H₂O₂': 'peroxyde d’hydrogène', 'PCl₃': 'trichlorure de phosphore', 'PCl₅': 'pentachlorure de phosphore',
      'SF₆': 'hexafluorure de soufre', 'BF₃': 'trifluorure de bore', 'XeF₄': 'tétrafluorure de xénon' };
    return usuels[f] || null;
  }

  M.nomenclature = { nommer, nomSubstituant, RACINES, MULT, FONCTIONS, fonctionsPortees, chainePrincipale: toutesLesChaines };
})();
