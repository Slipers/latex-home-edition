/* Bibliothèque de molécules, organisée par thèmes du programme de PCSI.
   Chaque entrée est décrite en SMILES et construite en 3D à la demande. */
(function () {
  const B = [];
  /* `config` impose la suite des configurations R/S le long de la chaîne principale :
     la structure obtenue est alors garantie, sans dépendre de l'écriture du SMILES. */
  const add = (cat, nom, smiles, note, config) => B.push({ cat, nom, smiles, note: note || '', config: config || null });

  /* ---- Géométrie et VSEPR (Gillespie) ---- */
  const G = 'Géométrie — VSEPR';
  add(G, 'Méthane CH₄', 'C', 'AX₄ — tétraédrique, 109,5°');
  add(G, 'Ammoniac NH₃', 'N', 'AX₃E — pyramide à base triangulaire, 107°');
  add(G, 'Eau H₂O', 'O', 'AX₂E₂ — coudée, 104,5°');
  add(G, 'Dioxyde de carbone CO₂', 'O=C=O', 'AX₂ — linéaire, 180°');
  add(G, 'Dioxyde de soufre SO₂', 'O=S=O', 'AX₂E — coudée, ~119°');
  add(G, 'Trifluorure de bore BF₃', 'FB(F)F', 'AX₃ — trigonale plane, lacune électronique');
  add(G, 'Trichlorure de phosphore PCl₃', 'ClP(Cl)Cl', 'AX₃E — pyramidale');
  add(G, 'Pentachlorure de phosphore PCl₅', 'ClP(Cl)(Cl)(Cl)Cl', 'AX₅ — bipyramide à base triangulaire');
  add(G, 'Hexafluorure de soufre SF₆', 'FS(F)(F)(F)(F)F', 'AX₆ — octaédrique');
  add(G, 'Tétrafluorure de xénon XeF₄', 'F[Xe](F)(F)F', 'AX₄E₂ — plan carré');
  add(G, 'Tétrafluorure de soufre SF₄', 'FS(F)(F)F', 'AX₄E — bascule');
  add(G, 'Trifluorure de chlore ClF₃', 'F[Cl](F)F', 'AX₃E₂ — en T');
  add(G, 'Cyanure d’hydrogène HCN', 'C#N', 'AX₂ — linéaire');
  add(G, 'Méthanal H₂C=O', 'C=O', 'AX₃ — trigonale plane');
  add(G, 'Sulfure d’hydrogène H₂S', 'S', 'AX₂E₂ — coudée');
  add(G, 'Ion ammonium NH₄⁺', '[NH4+]', 'AX₄ — tétraédrique, charge +1');
  add(G, 'Ion oxonium H₃O⁺', '[OH3+]', 'AX₃E — pyramidale');
  add(G, 'Ion nitrate NO₃⁻', '[O-][N+](=O)[O-]', 'AX₃ — trigonale plane, mésomérie');
  add(G, 'Ion sulfate SO₄²⁻', '[O-]S(=O)(=O)[O-]', 'AX₄ — tétraédrique');
  add(G, 'Ion carbonate CO₃²⁻', '[O-]C(=O)[O-]', 'AX₃ — trigonale plane');
  add(G, 'Ozone O₃', '[O-][O+]=O', 'AX₂E — coudée, ~117°');
  add(G, 'Diazote N₂', 'N#N', 'Triple liaison, molécule apolaire');
  add(G, 'Peroxyde d’hydrogène H₂O₂', 'OO', 'Molécule gauche, non plane');

  /* ---- Alcanes et cycloalcanes ---- */
  const A = 'Alcanes et cycloalcanes';
  ['Méthane|C', 'Éthane|CC', 'Propane|CCC', 'Butane|CCCC', 'Pentane|CCCCC', 'Hexane|CCCCCC',
    'Heptane|CCCCCCC', 'Octane|CCCCCCCC'].forEach(s => { const [n, t] = s.split('|'); add(A, n, t); });
  add(A, 'Isobutane (2-méthylpropane)', 'CC(C)C');
  add(A, 'Néopentane (2,2-diméthylpropane)', 'CC(C)(C)C');
  add(A, '2,3-diméthylbutane', 'CC(C)C(C)C');
  add(A, 'Cyclopropane', 'C1CC1', 'Cycle très tendu : angles de 60°');
  add(A, 'Cyclobutane', 'C1CCC1', 'Conformation papillon');
  add(A, 'Cyclopentane', 'C1CCCC1', 'Conformation enveloppe');
  add(A, 'Cyclohexane', 'C1CCCCC1', 'Conformation chaise : inversion de cycle');
  add(A, 'Méthylcyclohexane', 'CC1CCCCC1', 'Méthyle préféré en position équatoriale');
  add(A, 'cis-1,2-diméthylcyclohexane', 'C[C@H]1CCCC[C@H]1C', 'Méso : un méthyle axial, l\u2019autre équatorial');
  add(A, 'trans-1,2-diméthylcyclohexane', 'C[C@H]1CCCC[C@@H]1C', 'Chiral : les deux méthyles peuvent être équatoriaux');
  add(A, 'tert-butylcyclohexane', 'CC(C)(C)C1CCCCC1', 'Groupe volumineux bloqué en équatorial');
  add(A, 'Décaline (trans)', 'C1CC[C@H]2CCCC[C@H]2C1');

  /* ---- Alcènes, alcynes, diènes ---- */
  const I = 'Insaturés';
  add(I, 'Éthène (éthylène)', 'C=C', 'sp², plane');
  add(I, 'Propène', 'CC=C');
  add(I, 'But-1-ène', 'CCC=C');
  add(I, '(Z)-but-2-ène', 'C/C=C\\C', 'Diastéréoisomère Z');
  add(I, '(E)-but-2-ène', 'C/C=C/C', 'Diastéréoisomère E');
  add(I, '2-méthylbut-2-ène', 'CC=C(C)C');
  add(I, 'Buta-1,3-diène', 'C=CC=C', 'Diène conjugué, s-trans');
  add(I, 'Isoprène (2-méthylbuta-1,3-diène)', 'CC(=C)C=C');
  add(I, 'Cyclohexène', 'C1CCC=CC1', 'Conformation demi-chaise');
  add(I, 'Éthyne (acétylène)', 'C#C', 'sp, linéaire');
  add(I, 'Propyne', 'CC#C');
  add(I, 'But-2-yne', 'CC#CC');
  add(I, '(Z)-1,2-dichloroéthène', 'Cl/C=C\\Cl', 'Polaire (μ ≠ 0)');
  add(I, '(E)-1,2-dichloroéthène', 'Cl/C=C/Cl', 'Apolaire par symétrie');

  /* ---- Composés aromatiques ---- */
  const AR = 'Aromatiques';
  add(AR, 'Benzène', 'c1ccccc1', 'Cycle plan, liaisons de 1,39 Å');
  add(AR, 'Toluène (méthylbenzène)', 'Cc1ccccc1');
  add(AR, 'Phénol', 'Oc1ccccc1', 'Acide faible, pKa ≈ 10');
  add(AR, 'Aniline', 'Nc1ccccc1', 'Doublet de l’azote conjugué au cycle');
  add(AR, 'Acide benzoïque', 'OC(=O)c1ccccc1');
  add(AR, 'Benzaldéhyde', 'O=Cc1ccccc1');
  add(AR, 'Nitrobenzène', '[O-][N+](=O)c1ccccc1');
  add(AR, 'Styrène', 'C=Cc1ccccc1');
  add(AR, 'ortho-xylène', 'Cc1ccccc1C');
  add(AR, 'para-xylène', 'Cc1ccc(C)cc1');
  add(AR, 'Naphtalène', 'c1ccc2ccccc2c1', 'Deux cycles accolés');
  add(AR, 'Pyridine', 'c1ccncc1', 'Hétérocycle aromatique basique');
  add(AR, 'Phénylalanine (L)', 'N[C@@H](Cc1ccccc1)C(=O)O');

  /* ---- Alcools, éthers, dérivés halogénés ---- */
  const AL = 'Alcools et dérivés';
  add(AL, 'Méthanol', 'CO');
  add(AL, 'Éthanol', 'CCO');
  add(AL, 'Propan-1-ol', 'CCCO', 'Alcool primaire');
  add(AL, 'Propan-2-ol', 'CC(C)O', 'Alcool secondaire');
  add(AL, '2-méthylpropan-2-ol', 'CC(C)(C)O', 'Alcool tertiaire');
  add(AL, '(R)-butan-2-ol', 'CC[C@@H](C)O', 'Un seul centre asymétrique');
  add(AL, '(S)-butan-2-ol', 'CC[C@H](C)O');
  add(AL, 'Éthane-1,2-diol (glycol)', 'OCCO');
  add(AL, 'Propane-1,2,3-triol (glycérol)', 'OCC(O)CO');
  add(AL, 'Cyclohexanol', 'OC1CCCCC1');
  add(AL, 'Éthoxyéthane (éther)', 'CCOCC');
  add(AL, 'Oxyde d’éthylène (époxyde)', 'C1CO1', 'Cycle tendu très réactif');
  add(AL, 'Chlorométhane', 'CCl');
  add(AL, 'Bromoéthane', 'CCBr');
  add(AL, '(R)-2-bromobutane', 'CC[C@@H](C)Br');
  add(AL, '2-chloro-2-méthylpropane', 'CC(C)(C)Cl', 'Substrat de choix pour SN1');
  add(AL, 'Éthanethiol', 'CCS');

  /* ---- Composés carbonylés et acides ---- */
  const CO = 'Carbonylés et acides';
  add(CO, 'Méthanal (formaldéhyde)', 'C=O');
  add(CO, 'Éthanal (acétaldéhyde)', 'CC=O');
  add(CO, 'Propanone (acétone)', 'CC(C)=O');
  add(CO, 'Butanone', 'CCC(C)=O');
  add(CO, 'Cyclohexanone', 'O=C1CCCCC1');
  add(CO, 'Acide méthanoïque', 'OC=O');
  add(CO, 'Acide éthanoïque (acétique)', 'CC(=O)O', 'pKa = 4,8');
  add(CO, 'Acide propanoïque', 'CCC(=O)O');
  add(CO, 'Acide oxalique', 'OC(=O)C(=O)O', 'Diacide');
  add(CO, 'Acide (S)-lactique', 'C[C@H](O)C(=O)O');
  add(CO, 'Acide (R)-lactique', 'C[C@@H](O)C(=O)O');
  add(CO, 'Éthanoate d’éthyle', 'CCOC(C)=O', 'Ester, odeur de solvant');
  add(CO, 'Éthanoate de méthyle', 'COC(C)=O');
  add(CO, 'Anhydride éthanoïque', 'CC(=O)OC(C)=O');
  add(CO, 'Chlorure d’éthanoyle', 'CC(=O)Cl');
  add(CO, 'Éthanamide', 'CC(N)=O');
  add(CO, 'Urée', 'NC(N)=O');
  add(CO, 'Éthanenitrile', 'CC#N');

  /* ---- Amines ---- */
  const AM = 'Amines';
  add(AM, 'Méthylamine', 'CN', 'Amine primaire');
  add(AM, 'Diméthylamine', 'CNC', 'Amine secondaire');
  add(AM, 'Triméthylamine', 'CN(C)C', 'Amine tertiaire');
  add(AM, 'Éthylamine', 'CCN');
  add(AM, 'Ion tétraméthylammonium', 'C[N+](C)(C)C');

  /* ---- Stéréochimie ---- */
  const S = 'Stéréochimie';
  add(S, '(R)-bromochlorofluorométhane', '[C@@H](F)(Cl)Br', 'Le cas d’école du carbone asymétrique');
  add(S, '(S)-bromochlorofluorométhane', '[C@H](F)(Cl)Br');
  add(S, '(R)-glycéraldéhyde', 'OC[C@@H](O)C=O', 'Référence de la série D', 'R');
  add(S, '(S)-glycéraldéhyde', 'OC[C@H](O)C=O', '', 'S');
  add(S, 'L-alanine (S)', 'C[C@@H](C(=O)O)N', 'Acide aminé naturel');
  add(S, 'D-alanine (R)', 'C[C@H](C(=O)O)N');
  add(S, 'Acide (2R,3R)-tartrique', '[C@@H]([C@H](C(=O)O)O)(C(=O)O)O', 'Énantiomère pur, actif optiquement');
  add(S, 'Acide (2S,3S)-tartrique', '[C@H]([C@@H](C(=O)O)O)(C(=O)O)O');
  add(S, 'Acide méso-tartrique', '[C@@H]([C@@H](C(=O)O)O)(C(=O)O)O', 'Deux centres, molécule achirale');
  add(S, 'Butane-2,3-diol (2R,3R)', 'C[C@@H](O)[C@@H](O)C', 'Chiral', 'RR');
  add(S, 'Butane-2,3-diol méso', 'C[C@@H](O)[C@H](O)C', 'Achiral malgré deux centres', 'RS');
  add(S, '(R)-limonène', 'CC(=C)[C@@H]1CCC(C)=CC1', 'Odeur d’orange (son énantiomère sent le citron)');
  add(S, '(S)-limonène', 'CC(=C)[C@H]1CCC(C)=CC1');
  add(S, '(1R,2S)-2-méthylcyclohexan-1-ol', 'C[C@@H]1CCCC[C@@H]1O', 'Diastéréoisomère cis');

  /* ---- Acides aminés et sucres ---- */
  const BIO = 'Biomolécules';
  add(BIO, 'Glycine', 'NCC(=O)O', 'Seul acide α-aminé achiral');
  add(BIO, 'L-sérine', 'N[C@@H](CO)C(=O)O');
  add(BIO, 'L-cystéine', 'N[C@@H](CS)C(=O)O', 'Configuration R malgré la série L');
  add(BIO, 'L-valine', 'N[C@@H](C(C)C)C(=O)O');
  add(BIO, 'L-leucine', 'N[C@@H](CC(C)C)C(=O)O');
  add(BIO, 'L-proline', 'O=C(O)[C@@H]1CCCN1');
  add(BIO, 'Zwitterion de la glycine', '[NH3+]CC(=O)[O-]', 'Forme prédominante à pH 7');
  add(BIO, 'D-glucose (chaîne ouverte)', 'OCC(O)C(O)C(O)C(O)C=O', '4 centres : (2R,3S,4R,5R)', 'RSRR');
  add(BIO, 'α-D-glucopyranose', 'OC[C@H]1O[C@H](O)[C@H](O)[C@@H](O)[C@@H]1O', 'Forme cyclique du glucose, OH anomérique axial');
  add(BIO, 'β-D-glucopyranose', 'OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@@H]1O', 'Forme cyclique du glucose, tous les OH en équatorial');
  add(BIO, 'D-ribose', 'OCC(O)C(O)C(O)C=O', 'Sucre de l\u2019ARN : (2R,3R,4R)', 'RRR');
  add(BIO, 'D-fructose (chaîne)', 'OCC(O)C(O)C(O)C(=O)CO', 'Cétose en C6 : (3S,4R,5R)', 'SRR');
  add(BIO, 'Acide ascorbique (vitamine C)', 'OC[C@H](O)[C@H]1OC(=O)C(O)=C1O');
  add(BIO, 'Caféine', 'Cn1cnc2c1c(=O)n(C)c(=O)n2C');
  add(BIO, 'Aspirine', 'CC(=O)Oc1ccccc1C(=O)O');
  add(BIO, 'Paracétamol', 'CC(=O)Nc1ccc(O)cc1');
  add(BIO, 'Ibuprofène (S)', 'C[C@@H](C(=O)O)c1ccc(CC(C)C)cc1', 'Seul l\u2019énantiomère S est actif', 'S');
  add(BIO, 'Cholestérol', 'CC(C)CCC[C@@H](C)[C@H]1CC[C@H]2[C@@H]3CC=C4C[C@@H](O)CC[C@]4(C)[C@H]3CC[C@]12C');
  add(BIO, 'Menthol', 'CC(C)[C@@H]1CC[C@@H](C)C[C@H]1O', 'Tous les substituants en position équatoriale');

  /* ---- Cache et chargement ---- */
  const cache = new Map();
  function charger(entree) {
    const e = typeof entree === 'string' ? B.find(x => x.nom === entree) : entree;
    if (!e) throw new Error('Molécule inconnue : ' + entree);
    if (cache.has(e.nom)) return M.Molecule.fromJSON(cache.get(e.nom));
    const mol = M.smiles.lire(e.smiles, { nom: e.nom });
    if (e.config) M.stereo.imposer(mol, e.config);
    mol.name = e.nom;
    mol.meta.note = e.note;
    mol.meta.categorie = e.cat;
    cache.set(e.nom, mol.toJSON());
    return mol;
  }
  const categories = () => [...new Set(B.map(x => x.cat))];
  const parCategorie = c => B.filter(x => x.cat === c);
  function chercher(q) {
    const t = String(q || '').trim().toLowerCase();
    if (!t) return B.slice(0, 40);
    const sansAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const k = sansAccent(t);
    return B.filter(x => sansAccent(x.nom).includes(k) || sansAccent(x.cat).includes(k)
      || sansAccent(x.note).includes(k) || x.smiles.toLowerCase() === t);
  }

  M.biblio = { liste: B, charger, categories, parCategorie, chercher };
})();
