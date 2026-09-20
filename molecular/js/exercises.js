/* Moteur d'entraînement : générateurs de questions, correction et suivi de la progression.
   Les questions générées tirent leur énoncé et leur réponse du moteur chimique lui-même,
   ce qui permet un nombre illimité d'exercices toujours cohérents. */
(function () {
  const U = M.util;

  const THEMES = [
    { cle: 'atomistique', nom: 'Atomistique et classification', chapitre: 'Structure de la matière' },
    { cle: 'lewis', nom: 'Schémas de Lewis', chapitre: 'Liaison chimique' },
    { cle: 'vsepr', nom: 'Géométrie VSEPR', chapitre: 'Liaison chimique' },
    { cle: 'polarite', nom: 'Polarité et électronégativité', chapitre: 'Liaison chimique' },
    { cle: 'formules', nom: 'Formules et analyse', chapitre: 'Chimie organique' },
    { cle: 'fonctions', nom: 'Groupes caractéristiques', chapitre: 'Chimie organique' },
    { cle: 'nomenclature', nom: 'Nomenclature', chapitre: 'Chimie organique' },
    { cle: 'isomerie', nom: 'Isomérie de constitution', chapitre: 'Stéréochimie' },
    { cle: 'cip', nom: 'Descripteurs R/S (règles CIP)', chapitre: 'Stéréochimie' },
    { cle: 'ze', nom: 'Descripteurs Z/E', chapitre: 'Stéréochimie' },
    { cle: 'stereo', nom: 'Énantiomères et diastéréoisomères', chapitre: 'Stéréochimie' },
    { cle: 'conformation', nom: 'Conformations et projections', chapitre: 'Stéréochimie' },
  ];

  /* ---------- Normalisation des réponses libres ---------- */
  const sansAccent = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = s => sansAccent(s).toLowerCase().replace(/[\s'’‑-]+/g, '').replace(/[.,;]/g, '').trim();

  /* ---------- Générateurs ---------- */
  const GEN = {};

  /* Molécules de la bibliothèque répondant à un critère */
  function candidats(filtre, rnd) {
    const l = M.biblio.liste.filter(filtre);
    return U.shuffle(l, rnd);
  }
  const charge = e => M.biblio.charger(e);

  GEN.cip = (rnd) => {
    const pool = candidats(e => ['Stéréochimie', 'Biomolécules', 'Alcools et dérivés', 'Carbonylés et acides'].includes(e.cat), rnd);
    for (const e of pool) {
      const m = charge(e);
      const c = M.stereo.centresAsymetriques(m);
      if (c.length !== 1) continue;
      const exp = M.stereo.expliquerCIP(m, c[0].id);
      return {
        theme: 'cip', niveau: 2, type: 'qcm',
        enonce: 'Quelle est la configuration absolue du seul atome de carbone asymétrique de cette molécule ?',
        molecule: e.nom, vue: { mode: 'boules-batonnets', projection: 'cram' },
        choix: ['R', 'S', 'La molécule n’a pas de centre asymétrique'],
        reponse: c[0].config === 'R' ? 0 : 1,
        correction: 'Classement des substituants par priorité décroissante :\n'
          + exp.lignes.map(l => '  ' + l.rang + ') ' + l.texte + '  [première sphère : ' + l.premiere + ']').join('\n')
          + '\n\n' + exp.conclusion,
        aide: 'Classez les quatre substituants par numéro atomique décroissant, placez le dernier vers l’arrière, puis lisez le sens 1 → 2 → 3.',
      };
    }
    return null;
  };

  GEN.ze = (rnd) => {
    const pool = candidats(e => /\((Z|E)\)/.test(e.nom), rnd);
    for (const e of pool) {
      const m = charge(e);
      const d = M.stereo.doublesLiaisons(m);
      if (d.length !== 1) continue;
      return {
        theme: 'ze', niveau: 1, type: 'qcm',
        enonce: 'Quel est le descripteur stéréochimique de la double liaison de cette molécule ?',
        molecule: e.nom, vue: { mode: 'boules-batonnets', projection: 'cram' },
        choix: ['Z (les groupes prioritaires sont du même côté)', 'E (les groupes prioritaires sont de part et d’autre)'],
        reponse: d[0].config === 'Z' ? 0 : 1,
        correction: 'Sur chaque atome de la double liaison, on compare les deux substituants selon les règles CIP. '
          + 'L’angle dièdre mesuré entre les deux substituants prioritaires vaut ' + U.num(Math.abs(d[0].angle), 0) + '°'
          + (d[0].config === 'Z' ? ', proche de 0° : ils sont du même côté, la double liaison est Z (zusammen).'
            : ', proche de 180° : ils sont de part et d’autre, la double liaison est E (entgegen).'),
        aide: 'Z = zusammen (ensemble), E = entgegen (opposés).',
      };
    }
    return null;
  };

  GEN.vsepr = (rnd) => {
    const pool = candidats(e => e.cat === 'Géométrie — VSEPR', rnd);
    const e = pool[0];
    if (!e) return null;
    const m = charge(e);
    const centre = m.atoms.filter(a => m.degree(a.id) >= 2).sort((x, y) => m.degree(y.id) - m.degree(x.id))[0];
    if (!centre) return null;
    const v = M.geo.vsepr(m, centre.id);
    const formes = [...new Set(Object.values(M.geo.FORMES).map(f => f.nom))];
    const faux = U.shuffle(formes.filter(f => f !== v.forme), rnd).slice(0, 3);
    const choix = U.shuffle([v.forme, ...faux], rnd);
    return {
      theme: 'vsepr', niveau: 1, type: 'qcm',
      enonce: 'Quelle est la géométrie de cette molécule autour de l’atome central ' + centre.el + ' ?',
      molecule: e.nom, vue: { mode: 'boules-batonnets', doublets: true },
      choix, reponse: choix.indexOf(v.forme),
      correction: 'L’atome central ' + centre.el + ' porte ' + v.sigma + ' liaison' + (v.sigma > 1 ? 's' : '') + ' σ et '
        + v.lp + ' doublet' + (v.lp > 1 ? 's' : '') + ' non liant' + (v.lp > 1 ? 's' : '') + ', soit le type ' + v.code
        + ' (nombre stérique ' + v.n + ').\nLes ' + v.n + ' doublets se repoussent selon une géométrie '
        + v.formeElectronique + ' ; en ne considérant que les atomes, la molécule est ' + v.forme
        + ', avec des angles voisins de ' + v.angle + '°.\nHybridation de l’atome central : ' + v.hyb + '.',
      aide: 'Comptez d’abord le nombre stérique : liaisons σ + doublets non liants.',
    };
  };

  GEN.formules = (rnd) => {
    const e = candidats(x => !/^Ion |⁺|⁻|²/.test(x.nom), rnd)[0];
    if (!e) return null;
    const m = charge(e);
    const Mm = M.analyse.masseMolaire(m);
    const type = Math.floor(rnd() * 3);
    if (type === 0) {
      return {
        theme: 'formules', niveau: 1, type: 'saisie',
        enonce: 'Donnez la formule brute de cette molécule (par exemple : C2H6O).',
        molecule: e.nom, vue: { mode: 'boules-batonnets' },
        reponse: M.analyse.formuleBrute(m, { unicode: false }),
        verifier: (r, q) => norm(r) === norm(q.reponse),
        correction: 'Formule brute : ' + M.analyse.formuleBrute(m) + '\nMasse molaire : ' + U.num(Mm, 1) + ' g·mol⁻¹\n'
          + 'On écrit le carbone en premier, puis l’hydrogène, puis les autres éléments par ordre alphabétique (convention de Hill).',
        aide: 'Comptez les atomes de chaque élément, hydrogènes compris.',
      };
    }
    if (type === 1) {
      return {
        theme: 'formules', niveau: 2, type: 'numerique',
        enonce: 'Calculez la masse molaire de cette molécule, en g·mol⁻¹ (deux décimales).',
        molecule: e.nom, vue: { mode: 'boules-batonnets' },
        reponse: U.round(Mm, 2), tolerance: 0.6,
        correction: 'Formule brute ' + M.analyse.formuleBrute(m) + '.\n'
          + M.analyse.compositionCentesimale(m).map(c => '  ' + c.n + ' × M(' + c.el + ') = ' + c.n + ' × '
            + U.num(M.elements.get(c.el).mass, 3) + ' = ' + U.num(c.masse, 2) + ' g·mol⁻¹').join('\n')
          + '\n  Total : M = ' + U.num(Mm, 2) + ' g·mol⁻¹',
        aide: 'Additionnez les masses molaires atomiques, sans oublier les hydrogènes.',
      };
    }
    const d = M.analyse.insaturations(m);
    return {
      theme: 'formules', niveau: 2, type: 'numerique',
      enonce: 'Quel est le degré d’insaturation (nombre d’insaturations) de cette molécule ?',
      molecule: e.nom, vue: { mode: 'boules-batonnets' },
      reponse: d, tolerance: 0.01,
      correction: 'Pour la formule ' + M.analyse.formuleBrute(m) + ' :\n'
        + '  DoU = (2·n_C + 2 + n_N − n_H − n_X) / 2 = ' + d + '\n'
        + 'Chaque cycle et chaque liaison π compte pour une insaturation. Ici : '
        + m.rings().length + ' cycle(s) et ' + m.bonds.filter(b => b.order >= 2).reduce((s, b) => s + Math.round(b.order) - 1, 0) + ' liaison(s) π.',
      aide: 'DoU = (2C + 2 + N − H − X) / 2.',
    };
  };

  GEN.stereo = (rnd) => {
    const pool = candidats(e => e.cat === 'Stéréochimie' || e.cat === 'Biomolécules', rnd);
    for (const e of pool) {
      const m = charge(e);
      const n = M.stereo.nombreStereoisomeres(m);
      if (!n.n) continue;
      const mode = Math.floor(rnd() * 2);
      if (mode === 0) {
        return {
          theme: 'stereo', niveau: 2, type: 'numerique',
          enonce: 'Combien cette molécule possède-t-elle d’éléments stéréogènes, et donc au maximum combien de stéréoisomères de configuration ? Indiquez le nombre maximal de stéréoisomères.',
          molecule: e.nom, vue: { mode: 'boules-batonnets', projection: 'cram' },
          reponse: n.max, tolerance: 0.01,
          correction: 'La molécule comporte ' + n.n + ' élément(s) stéréogène(s) : '
            + M.stereo.centresAsymetriques(m).length + ' centre(s) asymétrique(s) et '
            + M.stereo.doublesLiaisons(m).length + ' double(s) liaison(s) stéréogène(s).\n'
            + 'Le nombre maximal de stéréoisomères est 2ⁿ = 2^' + n.n + ' = ' + n.max + '.'
            + (n.meso ? '\nAttention : cette molécule possède une forme méso, le nombre réel est donc inférieur à 2ⁿ.' : ''),
          aide: 'Règle de Le Bel et van’t Hoff : au maximum 2ⁿ stéréoisomères pour n éléments stéréogènes.',
        };
      }
      const chirale = M.stereo.estChirale(m);
      return {
        theme: 'stereo', niveau: 2, type: 'qcm',
        enonce: 'Cette molécule est-elle chirale ?',
        molecule: e.nom, vue: { mode: 'boules-batonnets', projection: 'cram' },
        choix: ['Oui, elle est chirale (non superposable à son image dans un miroir)',
          'Non, elle est achirale', 'Non : c’est un composé méso'],
        reponse: n.meso ? 2 : (chirale ? 0 : 1),
        correction: n.meso
          ? 'Cette molécule possède ' + M.stereo.centresAsymetriques(m).length + ' centres asymétriques mais reste superposable à son image dans un miroir : c’est un composé méso, achiral, grâce à un plan de symétrie interne.'
          : (chirale ? 'La molécule n’est pas superposable à son image dans un miroir : elle est chirale et possède un énantiomère.'
            : 'La molécule est superposable à son image dans un miroir : elle est achirale.'),
        aide: 'Cherchez un plan ou un centre de symétrie : s’il en existe un, la molécule est achirale.',
      };
    }
    return null;
  };

  GEN.isomerie = (rnd) => {
    const pool = candidats(e => e.cat === 'Stéréochimie', rnd);
    const a = pool[0];
    if (!a) return null;
    const ma = charge(a);
    const mode = Math.floor(rnd() * 2);
    const mb = mode === 0 ? M.stereo.enantiomere(ma) : (() => {
      const c = M.stereo.centresAsymetriques(ma);
      return c.length >= 2 ? M.stereo.diastereoisomere(ma, [c[0].id]) : M.stereo.enantiomere(ma);
    })();
    const rel = M.stereo.relation(ma, mb);
    const cles = ['identiques', 'enantiomeres', 'diastereoisomeres', 'constitution'];
    const libelles = ['La même molécule', 'Des énantiomères', 'Des diastéréoisomères', 'Des isomères de constitution'];
    return {
      theme: 'stereo', niveau: 3, type: 'qcm',
      enonce: 'Quelle relation d’isomérie lie ces deux molécules ?',
      molecule: a.nom, moleculeB: mb.toJSON(), vue: { mode: 'boules-batonnets', comparaison: true },
      choix: libelles, reponse: Math.max(0, cles.indexOf(rel.type)),
      correction: rel.texte + '\n\nDescripteurs : ' + (M.stereo.descripteurs(ma).nom || '(aucun')
        + ' pour la première, ' + (M.stereo.descripteurs(mb).nom || '(aucun)') + ' pour la seconde.',
      aide: 'Comparez d’abord les enchaînements d’atomes, puis les descripteurs R/S de chaque centre.',
    };
  };

  GEN.fonctions = (rnd) => {
    const pool = candidats(e => ['Alcools et dérivés', 'Carbonylés et acides', 'Amines', 'Aromatiques', 'Biomolécules'].includes(e.cat), rnd);
    for (const e of pool) {
      const m = charge(e);
      const g = M.analyse.groupes(m);
      if (!g.length) continue;
      const noms = [...new Set(g.map(x => x.nom))];
      const tous = ['Alcool', 'Phénol', 'Éther-oxyde', 'Aldéhyde', 'Cétone', 'Acide carboxylique', 'Ester',
        'Amide', 'Amine', 'Nitrile', 'Dérivé halogéné', 'Alcène', 'Alcyne', 'Cycle aromatique', 'Thiol'];
      const faux = U.shuffle(tous.filter(x => !noms.includes(x)), rnd).slice(0, 4);
      const choix = U.shuffle(noms.concat(faux), rnd);
      return {
        theme: 'fonctions', niveau: 1, type: 'multi',
        enonce: 'Cochez tous les groupes caractéristiques présents dans cette molécule.',
        molecule: e.nom, vue: { mode: 'boules-batonnets' },
        choix, reponse: choix.map((c, i) => noms.includes(c) ? i : -1).filter(i => i >= 0),
        correction: 'Groupes repérés : \n' + g.map(x => '  • ' + x.nom + (x.detail ? ' (' + x.detail + ')' : '')).join('\n')
          + '\nFonction principale de la molécule : ' + M.analyse.famille(m) + '.',
        aide: 'Repérez les hétéroatomes (O, N, S, halogènes) et les liaisons multiples.',
      };
    }
    return null;
  };

  GEN.nomenclature = (rnd) => {
    const pool = candidats(e => ['Alcanes et cycloalcanes', 'Insaturés', 'Alcools et dérivés', 'Carbonylés et acides'].includes(e.cat), rnd);
    for (const e of pool) {
      const m = charge(e);
      const n = M.nomenclature.nommer(m);
      if (!n.nom) continue;
      const nom = n.nom.replace(/^\([^)]*\)-/, '');
      const autres = U.shuffle(M.biblio.liste.filter(x => x.cat === e.cat && x.nom !== e.nom), rnd).slice(0, 3)
        .map(x => { const r = M.nomenclature.nommer(charge(x)); return r.nom ? r.nom.replace(/^\([^)]*\)-/, '') : x.nom.toLowerCase(); });
      const choix = U.shuffle([nom, ...new Set(autres.filter(x => x !== nom))], rnd);
      if (choix.length < 3) continue;
      return {
        theme: 'nomenclature', niveau: 2, type: 'qcm',
        enonce: 'Quel est le nom systématique (UICPA) de cette molécule ?',
        molecule: e.nom, vue: { mode: 'squelette' },
        choix, reponse: choix.indexOf(nom),
        correction: 'Nom systématique : ' + nom + '\n'
          + 'Méthode : on repère la chaîne carbonée la plus longue portant la fonction principale, '
          + 'on la numérote de façon à donner l’indice le plus faible à cette fonction, '
          + 'puis on cite les substituants par ordre alphabétique avec leur indice de position.',
        aide: 'Identifiez la fonction principale, puis la chaîne la plus longue qui la contient.',
      };
    }
    return null;
  };

  GEN.atomistique = (rnd) => {
    const el = M.elements.list.filter(e => e.Z <= 36 && e.Z >= 3);
    const e = el[Math.floor(rnd() * el.length)];
    const mode = Math.floor(rnd() * 3);
    if (mode === 0) {
      const bons = [e.config];
      const faux = U.shuffle(el.filter(x => x.Z !== e.Z), rnd).slice(0, 3).map(x => x.config);
      const choix = U.shuffle([...bons, ...faux], rnd);
      return {
        theme: 'atomistique', niveau: 1, type: 'qcm',
        enonce: 'Quelle est la configuration électronique de l’atome de ' + e.name.toLowerCase() + ' (' + e.sym + ', Z = ' + e.Z + ') dans son état fondamental ?',
        choix, reponse: choix.indexOf(e.config),
        correction: 'Z = ' + e.Z + ', donc ' + e.Z + ' électrons.\nRemplissage par la règle de Klechkowski (n + ℓ croissant, puis n croissant) :\n  '
          + e.config + '\nÉcriture abrégée : ' + e.configCourte + '\nCouche de valence : ' + e.ve + ' électrons — '
          + (e.group ? 'colonne ' + e.group : 'bloc f') + ', période ' + e.period + ', bloc ' + e.block + '.'
          + (['Cr', 'Cu', 'Mo', 'Ag', 'Au', 'Pd', 'Pt'].includes(e.sym) ? '\n⚠ Cet élément fait exception à la règle de Klechkowski (sous-couche d demi-remplie ou pleine, plus stable).' : ''),
        aide: 'Ordre de remplissage : 1s 2s 2p 3s 3p 4s 3d 4p …',
      };
    }
    if (mode === 1) {
      return {
        theme: 'atomistique', niveau: 1, type: 'numerique',
        enonce: 'Combien d’électrons de valence possède l’atome de ' + e.name.toLowerCase() + ' (' + e.sym + ', Z = ' + e.Z + ') ?',
        reponse: e.ve, tolerance: 0.01,
        correction: 'Configuration : ' + e.configCourte + '\nLes électrons de valence sont ceux de la couche de nombre quantique n le plus élevé '
          + (e.block === 'd' ? '(et de la sous-couche d en cours de remplissage pour un métal de transition)' : '')
          + ', soit ' + e.ve + ' électrons.\nCela correspond à la colonne ' + (e.group || '—') + ' de la classification.',
        aide: 'Pour les blocs s et p, le nombre d’électrons de valence se lit dans le numéro de colonne.',
      };
    }
    const cibles = U.shuffle(el.filter(x => x.period === e.period || x.group === e.group), rnd).slice(0, 3).concat(e);
    const plus = cibles.reduce((a, b) => (b.en > a.en ? b : a));
    const choix = U.shuffle(cibles.map(x => x.name + ' (' + x.sym + ')'), rnd);
    return {
      theme: 'atomistique', niveau: 2, type: 'qcm',
      enonce: 'Parmi ces éléments, lequel est le plus électronégatif ?',
      choix, reponse: choix.indexOf(plus.name + ' (' + plus.sym + ')'),
      correction: 'Électronégativités de Pauling :\n' + cibles.map(x => '  ' + x.sym + ' : ' + U.num(x.en, 2)).join('\n')
        + '\nL’électronégativité croît de la gauche vers la droite sur une période et de bas en haut dans une colonne : '
        + 'le fluor est le plus électronégatif des éléments.',
      aide: 'Elle augmente vers le coin supérieur droit de la classification périodique.',
    };
  };

  GEN.lewis = (rnd) => {
    const pool = candidats(e => e.cat === 'Géométrie — VSEPR', rnd);
    const e = pool[0];
    if (!e) return null;
    const m = charge(e);
    const centre = m.atoms.filter(a => m.degree(a.id) >= 2).sort((x, y) => m.degree(y.id) - m.degree(x.id))[0];
    if (!centre) return null;
    const lp = M.geo.doublets(m, centre.id);
    return {
      theme: 'lewis', niveau: 1, type: 'numerique',
      enonce: 'Combien de doublets non liants porte l’atome central (' + centre.el + ') dans le schéma de Lewis de cette molécule ?',
      molecule: e.nom, vue: { mode: 'boules-batonnets', doublets: true },
      reponse: lp, tolerance: 0.01,
      correction: (() => {
        const el = M.elements.get(centre.el);
        return 'L’atome de ' + el.name.toLowerCase() + ' possède ' + el.ve + ' électrons de valence'
          + (centre.charge ? ', corrigés de la charge formelle ' + (centre.charge > 0 ? '+' : '') + centre.charge : '') + '.\n'
          + 'Il engage ' + m.bondOrderSum(centre.id) + ' électron(s) dans les liaisons.\n'
          + 'Il reste donc (' + (el.ve - (centre.charge || 0)) + ' − ' + m.bondOrderSum(centre.id) + ') / 2 = ' + lp + ' doublet(s) non liant(s).\n'
          + 'Au total la molécule compte ' + M.analyse.lewis(m).electronsValence + ' électrons de valence.';
      })(),
      aide: 'Doublets non liants = (électrons de valence − charge − liaisons) / 2.',
    };
  };

  GEN.polarite = (rnd) => {
    const pool = candidats(e => ['Géométrie — VSEPR', 'Insaturés', 'Alcools et dérivés'].includes(e.cat), rnd);
    const e = pool[0];
    if (!e) return null;
    const m = charge(e);
    const d = M.analyse.momentDipolaire(m);
    return {
      theme: 'polarite', niveau: 2, type: 'qcm',
      enonce: 'Cette molécule possède-t-elle un moment dipolaire permanent ?',
      molecule: e.nom, vue: { mode: 'boules-batonnets', dipole: true, charges: true },
      choix: ['Oui, la molécule est polaire', 'Non, la molécule est apolaire'],
      reponse: d.polaire ? 0 : 1,
      correction: 'Moment dipolaire calculé : μ ≈ ' + U.num(d.debye, 2) + ' D.\n'
        + (d.polaire
          ? 'Les moments dipolaires de liaison ne se compensent pas : la molécule est polaire.'
          : 'La géométrie est suffisamment symétrique pour que les moments dipolaires de liaison se compensent : la molécule est apolaire, malgré des liaisons polarisées.'),
      aide: 'Additionnez vectoriellement les moments de liaison : la symétrie peut tout annuler.',
    };
  };

  GEN.conformation = (rnd) => {
    const mode = Math.floor(rnd() * 2);
    if (mode === 0) {
      const pool = candidats(e => /cyclohexane|cyclohexan/.test(e.nom.toLowerCase()) && /méthyl|butyl/.test(e.nom.toLowerCase()), rnd);
      const e = pool[0];
      if (e) {
        const m = charge(e);
        const ring = m.rings().find(r => r.length === 6);
        const subs = ring.map(id => m.neighborIds(id).filter(s => !ring.includes(s) && m.atom(s).el !== 'H')
          .map(s => M.proj.axialOuEquatorial(m, ring, id, s))).flat();
        const tousEq = subs.every(x => x === 'équatorial');
        return {
          theme: 'conformation', niveau: 2, type: 'qcm',
          enonce: 'Dans la conformation chaise la plus stable de cette molécule, où se trouvent les substituants autres que l’hydrogène ?',
          molecule: e.nom, vue: { mode: 'boules-batonnets', projection: 'chaise' },
          choix: ['Tous en position équatoriale', 'Tous en position axiale', 'Un axial et un équatorial'],
          reponse: tousEq ? 0 : (subs.every(x => x === 'axial') ? 1 : 2),
          correction: 'Positions calculées : ' + subs.join(', ') + '.\n'
            + 'Un substituant volumineux placé en position axiale subit des interactions 1,3-diaxiales répulsives '
            + 'avec les hydrogènes axiaux portés par les carbones 3 et 5. La conformation la plus stable est donc, '
            + 'chaque fois que la configuration le permet, celle qui place les groupes encombrants en position équatoriale.',
          aide: 'Pensez aux interactions 1,3-diaxiales.',
        };
      }
    }
    const e2 = candidats(x => ['Butane', 'Éthane', 'Propane', 'Pentane'].includes(x.nom), rnd)[0];
    if (!e2) return null;
    return {
      theme: 'conformation', niveau: 1, type: 'qcm',
      enonce: 'Quelle est la conformation la plus stable de cette molécule, observée en projection de Newman le long de la liaison C2—C3 ?',
      molecule: e2.nom, vue: { mode: 'boules-batonnets', projection: 'newman' },
      choix: ['Décalée anti (θ = 180°)', 'Éclipsée (θ = 0°)', 'Décalée gauche (θ = 60°)', 'Toutes ont la même énergie'],
      reponse: 0,
      correction: 'Les conformations décalées sont plus stables que les conformations éclipsées : dans une conformation '
        + 'éclipsée, les liaisons de l’avant et de l’arrière se superposent, ce qui maximise les répulsions.\n'
        + 'Parmi les conformations décalées, la conformation anti (θ = 180°) éloigne au maximum les deux groupes les plus '
        + 'volumineux : c’est le minimum absolu d’énergie. La conformation gauche (θ = ±60°) est un minimum secondaire, '
        + 'un peu moins stable.',
      aide: 'Comparez la gêne stérique entre les groupes portés par les deux carbones.',
    };
  };

  /* ---------- Fabrication d'une série ---------- */
  function generer(themes, nombre, graine) {
    const rnd = U.rng(graine || Math.floor(Math.random() * 1e9));
    const actifs = (themes && themes.length ? themes : THEMES.map(t => t.cle));
    const out = [];
    const statiques = U.shuffle((M.exobank || []).filter(q => actifs.includes(q.theme)), rnd);
    let iStat = 0, essais = 0;
    while (out.length < nombre && essais < nombre * 12) {
      essais++;
      const utiliserStatique = statiques.length && (iStat < statiques.length) && rnd() < 0.45;
      if (utiliserStatique) { out.push(prepare(statiques[iStat++], rnd)); continue; }
      const cle = actifs[Math.floor(rnd() * actifs.length)];
      const g = GEN[cle];
      if (!g) continue;
      try {
        const q = g(rnd);
        if (q) out.push(prepare(q, rnd));
      } catch (err) { /* un générateur qui échoue ne doit pas interrompre la série */ }
    }
    return out.slice(0, nombre);
  }
  let seqId = 0;
  function prepare(q, rnd) {
    const c = Object.assign({}, q);
    c.id = 'q' + (++seqId);
    /* mélange des propositions tout en suivant la bonne réponse */
    if (c.type === 'qcm' && Array.isArray(c.choix) && c.melanger !== false) {
      const bon = c.choix[c.reponse];
      c.choix = U.shuffle(c.choix, rnd || Math.random);
      c.reponse = c.choix.indexOf(bon);
    } else if (c.type === 'multi' && Array.isArray(c.choix) && c.melanger !== false) {
      const bons = c.reponse.map(i => c.choix[i]);
      c.choix = U.shuffle(c.choix, rnd || Math.random);
      c.reponse = bons.map(b => c.choix.indexOf(b)).sort((a, b) => a - b);
    }
    return c;
  }

  /* ---------- Correction ---------- */
  function verifier(q, reponse) {
    if (reponse == null || reponse === '') return { juste: false, message: 'Aucune réponse donnée.' };
    switch (q.type) {
      case 'qcm':
        return { juste: +reponse === q.reponse, message: 'Bonne réponse : ' + q.choix[q.reponse] };
      case 'vf':
        return { juste: !!reponse === !!q.reponse, message: 'Réponse attendue : ' + (q.reponse ? 'vrai' : 'faux') };
      case 'multi': {
        const r = [...new Set(reponse.map(Number))].sort((a, b) => a - b);
        const att = q.reponse.slice().sort((a, b) => a - b);
        const juste = r.length === att.length && r.every((x, i) => x === att[i]);
        return { juste, message: 'Réponses attendues : ' + att.map(i => q.choix[i]).join(', ') };
      }
      case 'numerique': {
        const v = parseFloat(String(reponse).replace(',', '.'));
        if (!isFinite(v)) return { juste: false, message: 'Valeur numérique attendue.' };
        const tol = q.tolerance == null ? 0.01 : q.tolerance;
        return { juste: Math.abs(v - q.reponse) <= tol, message: 'Valeur attendue : ' + U.num(q.reponse, 2) };
      }
      case 'saisie': {
        if (q.verifier) return { juste: !!q.verifier(reponse, q), message: 'Réponse attendue : ' + q.reponse };
        const att = Array.isArray(q.reponse) ? q.reponse : [q.reponse];
        return { juste: att.some(a => norm(a) === norm(reponse)), message: 'Réponse attendue : ' + att[0] };
      }
      default:
        return { juste: false, message: 'Type de question inconnu.' };
    }
  }

  /* ---------- Séance et progression ---------- */
  class Seance {
    constructor(questions, opts = {}) {
      this.questions = questions;
      this.index = 0;
      this.reponses = new Map();
      this.debut = Date.now();
      this.titre = opts.titre || 'Entraînement';
    }
    courante() { return this.questions[this.index] || null; }
    repondre(r) {
      const q = this.courante();
      if (!q) return null;
      const res = verifier(q, r);
      this.reponses.set(q.id, { reponse: r, juste: res.juste });
      enregistrer(q.theme, res.juste);
      return res;
    }
    deja(id) { return this.reponses.get(id); }
    suivant() { if (this.index < this.questions.length - 1) { this.index++; return true; } return false; }
    precedent() { if (this.index > 0) { this.index--; return true; } return false; }
    score() {
      let j = 0;
      this.reponses.forEach(v => { if (v.juste) j++; });
      return { justes: j, repondues: this.reponses.size, total: this.questions.length };
    }
    termine() { return this.reponses.size >= this.questions.length; }
  }

  function enregistrer(theme, juste) {
    const p = M.store.get('progression', {});
    const t = p[theme] || { vues: 0, justes: 0 };
    t.vues++; if (juste) t.justes++;
    p[theme] = t;
    p._maj = Date.now();
    M.store.set('progression', p);
  }
  function progression() {
    const p = M.store.get('progression', {});
    return THEMES.map(t => {
      const s = p[t.cle] || { vues: 0, justes: 0 };
      return { ...t, vues: s.vues, justes: s.justes, taux: s.vues ? Math.round(100 * s.justes / s.vues) : null };
    });
  }
  const reinitialiser = () => M.store.del('progression');

  M.exos = { THEMES, GEN, generer, verifier, Seance, progression, enregistrer, reinitialiser, norm };
})();
