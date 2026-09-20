/* Banque d'exercices rédigés, programme de chimie de PCSI (première année).
   Ces questions complètent celles produites automatiquement par les générateurs. */
(function () {
  const q = [];
  const add = o => q.push(o);

  /* ================= Atomistique ================= */
  add({ theme: 'atomistique', niveau: 1, type: 'qcm',
    enonce: 'Quelle règle impose de remplir les orbitales atomiques par valeurs croissantes de (n + ℓ), puis, à (n + ℓ) égal, par valeurs croissantes de n ?',
    choix: ['La règle de Klechkowski', 'La règle de Hund', 'Le principe d’exclusion de Pauli', 'La règle de l’octet'],
    reponse: 0,
    correction: 'La règle de Klechkowski (ou règle de Madelung) donne l’ordre de remplissage : 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p, 5s, 4d…\n'
      + '• Le principe d’exclusion de Pauli interdit à deux électrons d’un même atome d’avoir leurs quatre nombres quantiques identiques.\n'
      + '• La règle de Hund impose, dans une sous-couche dégénérée, de peupler d’abord chaque orbitale par un électron de même spin.' });

  add({ theme: 'atomistique', niveau: 2, type: 'saisie',
    enonce: 'Écrivez la configuration électronique du fer (Z = 26) dans son état fondamental, en respectant l’ordre de remplissage de Klechkowski.',
    reponse: ['1s2 2s2 2p6 3s2 3p6 4s2 3d6', '1s22s22p63s23p64s23d6'],
    verifier: (r) => M.exos.norm(r) === M.exos.norm('1s22s22p63s23p64s23d6') || M.exos.norm(r) === M.exos.norm('1s22s22p63s23p63d64s2'),
    correction: 'Z = 26 : 26 électrons.\nOrdre de Klechkowski : 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶\nÉcriture abrégée : [Ar] 4s² 3d⁶\n'
      + 'On rencontre souvent l’écriture rangée par couche croissante, [Ar] 3d⁶ 4s², tout aussi acceptable : elle reflète le fait que, '
      + 'une fois la sous-couche 3d peuplée, les électrons 4s sont les plus externes et sont donc arrachés les premiers (d’où Fe²⁺ : [Ar] 3d⁶).' });

  add({ theme: 'atomistique', niveau: 2, type: 'qcm',
    enonce: 'Quelle est la configuration électronique de l’ion Fe³⁺ (Z = 26) ?',
    choix: ['[Ar] 3d⁵', '[Ar] 4s² 3d¹', '[Ar] 3d³ 4s²', '[Ar] 4s¹ 3d⁴'],
    reponse: 0,
    correction: 'Fe : [Ar] 4s² 3d⁶. Pour former un cation, on arrache d’abord les électrons de la couche externe, '
      + 'donc les deux électrons 4s, puis un électron 3d : Fe³⁺ = [Ar] 3d⁵.\n'
      + 'La sous-couche d demi-remplie (d⁵) explique en partie la stabilité particulière de l’ion Fe³⁺.' });

  add({ theme: 'atomistique', niveau: 2, type: 'qcm',
    enonce: 'Comment évolue le rayon atomique le long d’une période, de la gauche vers la droite ?',
    choix: ['Il diminue', 'Il augmente', 'Il reste constant', 'Il passe par un maximum'],
    reponse: 0,
    correction: 'Le long d’une période, le nombre de charges du noyau augmente d’une unité à chaque élément tandis que '
      + 'les électrons ajoutés occupent la même couche : l’effet d’écran varie peu et la charge nucléaire effective ressentie augmente. '
      + 'Les électrons sont donc plus fortement attirés et le rayon atomique diminue.\n'
      + 'En descendant une colonne, au contraire, on peuple une couche de nombre quantique n plus élevé : le rayon augmente.' });

  add({ theme: 'atomistique', niveau: 3, type: 'qcm',
    enonce: 'Le chrome (Z = 24) présente une configuration électronique qui déroge à la règle de Klechkowski. Laquelle est correcte ?',
    choix: ['[Ar] 3d⁵ 4s¹', '[Ar] 3d⁴ 4s²', '[Ar] 3d⁶', '[Ar] 4s² 4p⁴'],
    reponse: 0,
    correction: 'La règle de Klechkowski prévoit [Ar] 4s² 3d⁴, mais l’expérience donne [Ar] 3d⁵ 4s¹.\n'
      + 'Une sous-couche d exactement demi-remplie (d⁵) est particulièrement stable : le gain de stabilité compense le coût '
      + 'du transfert d’un électron 4s vers 3d. Le cuivre (Z = 29) présente la même exception, au profit de la sous-couche pleine : [Ar] 3d¹⁰ 4s¹.' });

  /* ================= Lewis ================= */
  add({ theme: 'lewis', niveau: 1, type: 'numerique',
    enonce: 'Combien d’électrons de valence faut-il répartir pour construire le schéma de Lewis de l’ion sulfate SO₄²⁻ ?',
    reponse: 32, tolerance: 0.01,
    correction: 'S apporte 6 électrons de valence, chaque O en apporte 6, et la charge −2 ajoute 2 électrons :\n'
      + '  N = 6 + 4 × 6 + 2 = 32 électrons, soit 16 doublets.\n'
      + 'On place ensuite ces 16 doublets de façon à respecter l’octet sur chaque oxygène.' });

  add({ theme: 'lewis', niveau: 2, type: 'qcm',
    enonce: 'Dans le monoxyde de carbone CO, quelle est la charge formelle portée par l’atome de carbone ?',
    choix: ['−1', '0', '+1', '−2'],
    reponse: 0,
    correction: 'Le schéma de Lewis de CO comporte une triple liaison et un doublet non liant sur chaque atome.\n'
      + 'Charge formelle = (électrons de valence) − (doublets non liants × 2) − (nombre de liaisons)\n'
      + '  Pour C : 4 − 2 − 3 = −1\n  Pour O : 6 − 2 − 3 = +1\n'
      + 'La molécule est globalement neutre, mais présente des charges formelles opposées : c’est ce qui explique son faible moment dipolaire, '
      + 'orienté à l’inverse de ce que laisserait attendre la seule électronégativité.' });

  add({ theme: 'lewis', niveau: 2, type: 'qcm',
    enonce: 'Qu’appelle-t-on formes mésomères (ou structures de résonance) d’une espèce chimique ?',
    choix: ['Plusieurs schémas de Lewis décrivant la même molécule, ne différant que par la répartition des électrons',
      'Plusieurs isomères de constitution ayant la même formule brute',
      'Des conformations obtenues par rotation autour d’une liaison simple',
      'Des stéréoisomères images l’un de l’autre dans un miroir'],
    reponse: 0,
    correction: 'Les formes mésomères sont plusieurs schémas de Lewis d’une même espèce : les noyaux ne bougent pas, '
      + 'seuls les électrons π et les doublets non liants sont répartis différemment.\n'
      + 'La molécule réelle n’est aucune de ces formes : c’est un hybride de résonance, intermédiaire entre elles. '
      + 'L’ion carbonate CO₃²⁻ en est l’exemple classique : ses trois liaisons C—O sont rigoureusement équivalentes, de longueur intermédiaire '
      + 'entre une simple et une double liaison.' });

  add({ theme: 'lewis', niveau: 3, type: 'qcm',
    enonce: 'Parmi ces molécules, laquelle possède un atome central ne respectant pas la règle de l’octet, par défaut d’électrons (lacune électronique) ?',
    choix: ['BF₃', 'NH₃', 'H₂O', 'CH₄'],
    reponse: 0,
    correction: 'Le bore possède 3 électrons de valence. Dans BF₃ il forme trois liaisons simples, soit 6 électrons seulement '
      + 'autour de lui : il possède une lacune électronique (orbitale p vacante).\n'
      + 'C’est ce déficit qui fait de BF₃ un acide de Lewis très réactif, capable d’accepter un doublet : BF₃ + NH₃ → F₃B←NH₃.\n'
      + 'NH₃, H₂O et CH₄ respectent tous l’octet.' });

  /* ================= VSEPR ================= */
  add({ theme: 'vsepr', niveau: 1, type: 'qcm',
    enonce: 'Pourquoi l’angle HOH dans l’eau (104,5°) est-il inférieur à l’angle tétraédrique parfait (109,5°) ?',
    choix: ['Parce que les doublets non liants sont plus répulsifs que les doublets liants',
      'Parce que l’oxygène est plus électronégatif que l’hydrogène',
      'Parce que la molécule est linéaire',
      'Parce que les liaisons O—H sont courtes'],
    reponse: 0,
    correction: 'L’oxygène de l’eau est de type AX₂E₂ : quatre doublets, donc une disposition de départ tétraédrique.\n'
      + 'Un doublet non liant n’est retenu que par un seul noyau : il occupe davantage d’espace angulaire qu’un doublet liant. '
      + 'Les deux doublets libres compriment donc l’angle entre les liaisons O—H, qui passe de 109,5° à 104,5°.\n'
      + 'Le même effet explique l’angle de 107° dans NH₃ (AX₃E), compression plus faible car il n’y a qu’un doublet libre.' });

  add({ theme: 'vsepr', niveau: 2, type: 'qcm',
    enonce: 'Dans une bipyramide à base triangulaire (nombre stérique 5), où se placent préférentiellement les doublets non liants ?',
    choix: ['En position équatoriale', 'En position axiale', 'Indifféremment', 'À l’extérieur de la molécule'],
    reponse: 0,
    correction: 'Dans une bipyramide à base triangulaire, une position axiale possède trois voisins à 90°, tandis qu’une position '
      + 'équatoriale n’en a que deux à 90° (les deux autres sont à 120°).\n'
      + 'Comme un doublet non liant est le plus répulsif, il se place là où les interactions à 90° sont les moins nombreuses, '
      + 'c’est-à-dire en position équatoriale.\n'
      + 'D’où les géométries : SF₄ (AX₄E) en bascule, ClF₃ (AX₃E₂) en T, XeF₂ (AX₂E₃) linéaire.' });

  add({ theme: 'vsepr', niveau: 2, type: 'saisie',
    enonce: 'Donnez le type VSEPR (sous la forme AXnEm) de l’atome de soufre dans le dioxyde de soufre SO₂.',
    reponse: ['AX2E', 'AX2E1'],
    correction: 'Le soufre possède 6 électrons de valence. Dans SO₂ il forme deux doubles liaisons (4 électrons engagés par double liaison, '
      + 'mais une seule liaison σ chacune) : il reste (6 − 4) / 2 = 1 doublet non liant.\n'
      + 'Nombre stérique = 2 liaisons σ + 1 doublet = 3 → type AX₂E.\n'
      + 'Disposition des doublets : trigonale plane ; géométrie de la molécule : coudée, avec un angle voisin de 119°.' });

  add({ theme: 'vsepr', niveau: 3, type: 'qcm',
    enonce: 'L’ion NO₃⁻ a-t-il une géométrie plane ou pyramidale ?',
    choix: ['Trigonale plane, car l’azote est de type AX₃ (aucun doublet non liant)',
      'Pyramidale, car l’azote porte un doublet non liant',
      'Tétraédrique', 'Linéaire'],
    reponse: 0,
    correction: 'Dans l’ion nitrate, l’azote porte une charge formelle +1 : il dispose donc de 5 − 1 = 4 électrons pour ses liaisons, '
      + 'tous engagés (une double et deux simples liaisons). Il ne lui reste aucun doublet non liant : type AX₃.\n'
      + 'La géométrie est trigonale plane, angles de 120°. Les trois liaisons N—O sont équivalentes par mésomérie, '
      + 'de longueur intermédiaire entre simple et double liaison.' });

  /* ================= Polarité ================= */
  add({ theme: 'polarite', niveau: 1, type: 'qcm',
    enonce: 'Le dioxyde de carbone CO₂ possède deux liaisons C=O fortement polarisées. Pourquoi la molécule est-elle pourtant apolaire ?',
    choix: ['Parce que la molécule est linéaire : les deux moments de liaison sont opposés et se compensent',
      'Parce que le carbone et l’oxygène ont la même électronégativité',
      'Parce que les doubles liaisons ne sont pas polarisées',
      'Parce que la molécule est coudée'],
    reponse: 0,
    correction: 'Chaque liaison C=O porte un moment dipolaire dirigé du carbone vers l’oxygène, plus électronégatif.\n'
      + 'Le carbone de CO₂ est de type AX₂ : la molécule est linéaire, les deux moments ont même norme et des sens opposés. '
      + 'Leur somme vectorielle est nulle : μ = 0, la molécule est apolaire.\n'
      + 'À comparer avec SO₂, coudée (AX₂E), dont les moments ne se compensent pas : elle est polaire (μ ≈ 1,6 D).' });

  add({ theme: 'polarite', niveau: 2, type: 'qcm',
    enonce: 'Quelle interaction intermoléculaire explique la température d’ébullition anormalement élevée de l’eau (100 °C) comparée à celle de H₂S (−60 °C) ?',
    choix: ['La liaison hydrogène', 'Les forces de dispersion de London', 'La liaison covalente', 'L’interaction ion-dipôle'],
    reponse: 0,
    correction: 'L’eau forme des liaisons hydrogène : l’hydrogène, lié à un atome très électronégatif et petit (O), '
      + 'interagit fortement avec un doublet non liant d’un oxygène voisin.\n'
      + 'Le soufre est nettement moins électronégatif et plus volumineux : H₂S ne forme pratiquement pas de liaisons hydrogène et '
      + 'ne bénéficie que des interactions de Keesom et de London, bien plus faibles. D’où l’écart de 160 °C.\n'
      + 'Les liaisons hydrogène n’existent de façon notable qu’avec F, O et N.' });

  add({ theme: 'polarite', niveau: 2, type: 'multi',
    enonce: 'Parmi ces molécules, cochez celles qui sont polaires.',
    choix: ['NH₃', 'CCl₄', 'H₂O', 'CO₂', 'CHCl₃', 'BF₃'],
    reponse: [0, 2, 4],
    correction: 'NH₃ (AX₃E, pyramidale) : les trois moments N—H ne se compensent pas, et le doublet libre ajoute sa contribution → polaire (μ ≈ 1,47 D).\n'
      + 'H₂O (AX₂E₂, coudée) → polaire (μ ≈ 1,85 D).\n'
      + 'CHCl₃ : tétraèdre dissymétrique, un H remplaçant un Cl → polaire (μ ≈ 1,01 D).\n'
      + 'CCl₄ : tétraèdre régulier, les quatre moments se compensent → apolaire.\n'
      + 'CO₂ : linéaire symétrique → apolaire. BF₃ : trigonale plane symétrique → apolaire.\n'
      + 'Retenez que des liaisons polarisées ne suffisent pas : c’est la symétrie de la géométrie qui décide.' });

  /* ================= Isomérie ================= */
  add({ theme: 'isomerie', niveau: 1, type: 'qcm',
    enonce: 'Deux molécules ont la même formule brute C₄H₁₀ mais des enchaînements d’atomes différents (butane et 2-méthylpropane). Comment les qualifie-t-on ?',
    choix: ['Isomères de constitution (de chaîne)', 'Énantiomères', 'Diastéréoisomères', 'Conformères'],
    reponse: 0,
    correction: 'Les isomères de constitution ont la même formule brute mais un enchaînement d’atomes différent. On distingue :\n'
      + '  • isomérie de chaîne : le squelette carboné diffère (butane / 2-méthylpropane) ;\n'
      + '  • isomérie de position : la fonction n’est pas placée au même endroit (propan-1-ol / propan-2-ol) ;\n'
      + '  • isomérie de fonction : les groupes caractéristiques diffèrent (éthanol / méthoxyméthane).\n'
      + 'Les stéréoisomères, eux, ont le même enchaînement d’atomes et ne diffèrent que par la disposition dans l’espace.' });

  add({ theme: 'isomerie', niveau: 2, type: 'numerique',
    enonce: 'Combien d’isomères de constitution de formule brute C₄H₁₀O comportent une fonction alcool ?',
    reponse: 4, tolerance: 0.01,
    correction: 'Les alcools en C₄H₁₀O sont au nombre de quatre :\n'
      + '  • butan-1-ol (primaire) ;\n  • butan-2-ol (secondaire) ;\n'
      + '  • 2-méthylpropan-1-ol (primaire) ;\n  • 2-méthylpropan-2-ol (tertiaire).\n'
      + 'La formule C₄H₁₀O admet aussi trois éthers-oxydes (isomères de fonction) : éthoxyéthane, 1-méthoxypropane et 2-méthoxypropane, '
      + 'soit sept isomères de constitution en tout.' });

  add({ theme: 'isomerie', niveau: 2, type: 'qcm',
    enonce: 'Le propan-1-ol et le propan-2-ol sont des isomères…',
    choix: ['de position', 'de chaîne', 'de fonction', 'de configuration'],
    reponse: 0,
    correction: 'Les deux composés ont la même chaîne (trois carbones) et la même fonction (alcool). Seule la position du groupe hydroxyle change : '
      + 'c’est de l’isomérie de position.\n'
      + 'S’il s’agissait de l’éthanol et du méthoxyméthane, la fonction elle-même changerait : isomérie de fonction.' });

  /* ================= CIP ================= */
  add({ theme: 'cip', niveau: 1, type: 'qcm',
    enonce: 'Quel est le critère fondamental (règle 1) du classement séquentiel de Cahn, Ingold et Prelog ?',
    choix: ['Le numéro atomique Z de l’atome directement lié, par ordre décroissant',
      'La masse molaire du substituant', 'La taille du substituant', 'L’électronégativité de l’atome lié'],
    reponse: 0,
    correction: 'La première règle CIP compare les numéros atomiques des atomes directement liés au centre : Z décroissant.\n'
      + 'En cas d’égalité, on passe à la sphère suivante et on compare, pour chaque branche, les listes d’atomes rangées par Z décroissant, '
      + 'jusqu’à la première différence.\n'
      + 'Une liaison multiple est traitée en dupliquant l’atome : —CHO équivaut à un carbone lié à (O, O, H).\n'
      + 'La masse n’intervient qu’ensuite, pour départager des isotopes (règle 1b).' });

  add({ theme: 'cip', niveau: 2, type: 'qcm',
    enonce: 'Classez par priorité CIP décroissante les substituants : —OH, —CH₃, —COOH, —H.',
    choix: ['—OH > —COOH > —CH₃ > —H', '—COOH > —OH > —CH₃ > —H', '—OH > —CH₃ > —COOH > —H', '—COOH > —CH₃ > —OH > —H'],
    reponse: 0,
    correction: 'Première sphère : O (Z = 8) pour —OH ; C (Z = 6) pour —COOH et —CH₃ ; H (Z = 1) pour —H.\n'
      + '  → —OH est prioritaire, —H est dernier.\n'
      + 'Pour départager —COOH et —CH₃, on passe à la sphère suivante :\n'
      + '  —COOH : le carbone est lié à (O, O, O) après duplication de la double liaison ;\n'
      + '  —CH₃ : le carbone est lié à (H, H, H).\n'
      + '  → —COOH l’emporte largement.\nD’où —OH > —COOH > —CH₃ > —H.' });

  add({ theme: 'cip', niveau: 2, type: 'qcm',
    enonce: 'Pour attribuer un descripteur R ou S, comment doit-on regarder le centre asymétrique ?',
    choix: ['En plaçant le substituant de priorité 4 à l’opposé de l’observateur, puis en lisant le sens 1 → 2 → 3',
      'En plaçant le substituant de priorité 1 vers l’observateur', 'En regardant la molécule de profil',
      'En plaçant les quatre substituants dans un plan'],
    reponse: 0,
    correction: 'On place le substituant de plus faible priorité (rang 4) dans le prolongement de l’axe de vision, à l’arrière.\n'
      + 'On lit alors le sens du parcours 1 → 2 → 3 :\n'
      + '  • sens horaire (des aiguilles d’une montre) → configuration R (rectus, droite) ;\n'
      + '  • sens antihoraire → configuration S (sinister, gauche).\n'
      + 'Astuce pratique : si le rang 4 se trouve vers l’avant, on lit le sens puis on inverse la conclusion.' });

  add({ theme: 'cip', niveau: 3, type: 'qcm',
    enonce: 'La L-cystéine est un acide α-aminé naturel de la série L. Quelle est sa configuration absolue en C2 ?',
    choix: ['R', 'S', 'Elle n’a pas de centre asymétrique', 'Elle est méso'],
    reponse: 0,
    correction: 'Tous les acides α-aminés naturels appartiennent à la série L et sont de configuration (S)… sauf la cystéine, qui est (R).\n'
      + 'La raison tient uniquement au classement CIP : la chaîne latérale de la cystéine est —CH₂—SH, et le soufre (Z = 16) '
      + 'est prioritaire sur le carbone du groupe —COOH (Z = 6).\n'
      + 'L’ordre devient donc NH₂ > CH₂SH > COOH > H, au lieu de NH₂ > COOH > R > H pour les autres acides aminés : '
      + 'les rangs 2 et 3 sont permutés, ce qui inverse le descripteur sans que la disposition spatiale ait changé.\n'
      + 'Retenez que les descripteurs D/L et R/S relèvent de deux conventions distinctes.' });

  /* ================= Z/E ================= */
  add({ theme: 'ze', niveau: 1, type: 'qcm',
    enonce: 'Pourquoi une double liaison C=C peut-elle donner lieu à une stéréoisomérie Z/E, alors qu’une liaison simple C—C n’en donne pas ?',
    choix: ['Parce que la rotation autour d’une double liaison est bloquée par le recouvrement latéral des orbitales p',
      'Parce que la double liaison est plus courte', 'Parce que la double liaison est plus polaire',
      'Parce que les carbones y sont hybridés sp³'],
    reponse: 0,
    correction: 'La double liaison est constituée d’une liaison σ et d’une liaison π. La liaison π résulte du recouvrement latéral '
      + 'de deux orbitales p parallèles : une rotation autour de l’axe de la liaison romprait ce recouvrement.\n'
      + 'La barrière de rotation est de l’ordre de 250 kJ·mol⁻¹ : à température ordinaire, la configuration est figée et les deux '
      + 'stéréoisomères Z et E sont isolables.\n'
      + 'Autour d’une liaison simple, la rotation ne coûte qu’une dizaine de kJ·mol⁻¹ : les conformères s’interconvertissent librement.' });

  add({ theme: 'ze', niveau: 2, type: 'qcm',
    enonce: 'Une double liaison C=C est-elle nécessairement stéréogène ?',
    choix: ['Non : il faut que chacun des deux carbones porte deux substituants différents',
      'Oui, toujours', 'Seulement si la molécule est chirale', 'Seulement si elle est conjuguée'],
    reponse: 0,
    correction: 'Si l’un des deux carbones porte deux substituants identiques, l’échange de ces deux substituants redonne la même molécule : '
      + 'la double liaison n’est pas stéréogène.\n'
      + 'Ainsi le propène CH₃—CH=CH₂ n’a pas de stéréoisomère Z/E, car le carbone terminal porte deux hydrogènes.\n'
      + 'En revanche le but-2-ène CH₃—CH=CH—CH₃ possède bien deux diastéréoisomères, Z et E.' });

  /* ================= Stéréochimie ================= */
  add({ theme: 'stereo', niveau: 1, type: 'qcm',
    enonce: 'Qu’est-ce qu’un carbone asymétrique ?',
    choix: ['Un carbone tétraédrique portant quatre substituants tous différents',
      'Un carbone portant une double liaison', 'Un carbone portant quatre substituants identiques',
      'Un carbone de fin de chaîne'],
    reponse: 0,
    correction: 'Un carbone asymétrique (noté C*) est un carbone tétraédrique lié à quatre groupes deux à deux différents.\n'
      + 'Il constitue un centre stéréogène : l’échange de deux de ses substituants donne un stéréoisomère.\n'
      + 'Attention : la présence d’un carbone asymétrique n’entraîne pas systématiquement la chiralité de la molécule — '
      + 'les composés méso en sont le contre-exemple.' });

  add({ theme: 'stereo', niveau: 2, type: 'qcm',
    enonce: 'Deux énantiomères diffèrent-ils par leurs propriétés physiques usuelles (température de fusion, densité, solubilité dans l’eau) ?',
    choix: ['Non, sauf vis-à-vis de la lumière polarisée et d’un environnement lui-même chiral',
      'Oui, toutes leurs propriétés diffèrent', 'Oui, mais seulement la température de fusion',
      'Non, ils sont en tout point identiques'],
    reponse: 0,
    correction: 'Deux énantiomères possèdent les mêmes propriétés physiques scalaires : masse molaire, température de fusion et d’ébullition, '
      + 'densité, solubilité dans un solvant achiral, spectres IR et RMN classiques.\n'
      + 'Ils se distinguent sur deux points :\n'
      + '  • le pouvoir rotatoire : ils dévient le plan de la lumière polarisée d’angles opposés (+α et −α) ;\n'
      + '  • leur comportement face à un réactif ou un milieu chiral (enzyme, récepteur biologique, colonne chirale).\n'
      + 'C’est ce dernier point qui explique que deux énantiomères d’un médicament puissent avoir des effets très différents.\n'
      + 'Des diastéréoisomères, eux, ont des propriétés physiques différentes et sont séparables par les méthodes usuelles.' });

  add({ theme: 'stereo', niveau: 2, type: 'qcm',
    enonce: 'Qu’est-ce qu’un mélange racémique ?',
    choix: ['Un mélange équimolaire des deux énantiomères d’un composé chiral, globalement inactif sur la lumière polarisée',
      'Un mélange de diastéréoisomères', 'Un composé méso', 'Un mélange d’isomères de constitution'],
    reponse: 0,
    correction: 'Un racémique contient les deux énantiomères en quantités égales (50 / 50). Les pouvoirs rotatoires étant opposés, '
      + 'ils se compensent exactement : le mélange est optiquement inactif, on dit inactif par compensation.\n'
      + 'On le note (±) ou (R,S). Une synthèse menée à partir de réactifs achiraux, dans un milieu achiral, conduit toujours à un racémique.\n'
      + 'À ne pas confondre avec un composé méso, qui est une espèce unique, achirale par symétrie interne.' });

  add({ theme: 'stereo', niveau: 3, type: 'qcm',
    enonce: 'L’acide tartrique possède deux carbones asymétriques. Pourquoi n’existe-t-il que trois stéréoisomères et non quatre ?',
    choix: ['Parce que les formes (2R,3S) et (2S,3R) sont identiques : c’est le composé méso, achiral',
      'Parce qu’un des carbones n’est pas réellement asymétrique',
      'Parce que la molécule est plane', 'Parce que deux des formes sont des conformères'],
    reponse: 0,
    correction: 'La règle 2ⁿ prévoit 2² = 4 stéréoisomères. Mais les deux centres portent exactement les mêmes substituants.\n'
      + 'Les formes (2R,3R) et (2S,3S) sont bien deux énantiomères distincts, optiquement actifs.\n'
      + 'La forme (2R,3S) possède un plan de symétrie interne dans une conformation convenable : elle est superposable à son image '
      + 'dans un miroir, donc achirale, et elle est identique à (2S,3R). C’est l’acide méso-tartrique.\n'
      + 'Il ne reste donc que trois stéréoisomères. Le méso est diastéréoisomère de chacun des deux énantiomères, '
      + 'et possède d’ailleurs une température de fusion différente (140 °C contre 170 °C).' });

  add({ theme: 'stereo', niveau: 3, type: 'qcm',
    enonce: 'Que signifie l’appartenance d’un sucre à la série D dans la convention de Fischer ?',
    choix: ['En projection de Fischer, le groupe hydroxyle du carbone asymétrique le plus éloigné du carbonyle est à droite',
      'Le sucre est dextrogyre', 'Tous ses carbones asymétriques sont de configuration R',
      'Le sucre possède un nombre pair de carbones'],
    reponse: 0,
    correction: 'La convention D/L de Fischer se rapporte au glycéraldéhyde. Dans une projection de Fischer, chaîne verticale et carbonyle en haut, '
      + 'on regarde le dernier carbone asymétrique (le plus éloigné du carbonyle) : hydroxyle à droite → série D, à gauche → série L.\n'
      + 'Cette convention ne dit rien du sens de déviation de la lumière polarisée : le D-fructose, par exemple, est lévogyre. '
      + 'On précise donc parfois D(−)-fructose.\n'
      + 'Elle ne dit rien non plus des autres centres : le D-glucose est (2R,3S,4R,5R), il comporte bien un centre S.' });

  /* ================= Conformations ================= */
  add({ theme: 'conformation', niveau: 1, type: 'qcm',
    enonce: 'Deux conformères d’une même molécule sont-ils séparables à température ambiante ?',
    choix: ['Non : la barrière de rotation est trop faible, ils s’interconvertissent en permanence',
      'Oui, par distillation', 'Oui, par cristallisation', 'Oui, sur colonne chirale'],
    reponse: 0,
    correction: 'Les conformères se déduisent les uns des autres par rotation autour de liaisons simples. La barrière est de l’ordre de '
      + '12 kJ·mol⁻¹ pour l’éthane, très inférieure à l’énergie d’agitation thermique disponible.\n'
      + 'L’interconversion se fait des milliards de fois par seconde : on observe une moyenne, et aucune séparation n’est possible.\n'
      + 'C’est la différence essentielle avec les stéréoisomères de configuration, dont l’interconversion exigerait la rupture de liaisons.' });

  add({ theme: 'conformation', niveau: 2, type: 'qcm',
    enonce: 'Dans le cyclohexane en conformation chaise, quelle est la relation entre positions axiales et équatoriales lors de l’inversion de cycle ?',
    choix: ['Chaque position axiale devient équatoriale et réciproquement',
      'Les positions axiales restent axiales', 'Seules les positions équatoriales changent',
      'La configuration des carbones asymétriques est inversée'],
    reponse: 0,
    correction: 'L’inversion de cycle (ring flip) fait passer le cyclohexane d’une chaise à l’autre, via des conformations '
      + 'demi-chaise et bateau croisé. La barrière est d’environ 45 kJ·mol⁻¹ : l’échange est très rapide à température ambiante.\n'
      + 'Toute liaison axiale devient équatoriale, et inversement. En revanche, aucune liaison n’est rompue : la configuration '
      + 'des carbones asymétriques est strictement conservée, et un substituant situé au-dessus du plan moyen y reste.\n'
      + 'C’est pourquoi le cis-1,2-diméthylcyclohexane reste toujours axial-équatorial, quelle que soit la chaise considérée.' });

  add({ theme: 'conformation', niveau: 2, type: 'qcm',
    enonce: 'Pourquoi le groupe tert-butyle du tert-butylcyclohexane se place-t-il presque exclusivement en position équatoriale ?',
    choix: ['Parce que les interactions 1,3-diaxiales seraient trop répulsives en position axiale',
      'Parce qu’il est plus électronégatif', 'Parce que la liaison C—C y est plus courte',
      'Parce que la conformation bateau est alors favorisée'],
    reponse: 0,
    correction: 'En position axiale, un substituant pointe parallèlement à l’axe du cycle et se trouve très proche des deux hydrogènes '
      + 'axiaux portés par les carbones 3 et 5 : ce sont les interactions 1,3-diaxiales.\n'
      + 'Pour un méthyle, elles coûtent environ 7 kJ·mol⁻¹ (95 % de forme équatoriale à l’équilibre). Pour un groupe tert-butyle, '
      + 'bien plus volumineux, le coût dépasse 20 kJ·mol⁻¹ : l’équilibre est déplacé à plus de 99,9 % vers la forme équatoriale. '
      + 'On dit que le groupe tert-butyle bloque la conformation du cycle, propriété très utilisée pour étudier la réactivité.' });

  add({ theme: 'conformation', niveau: 3, type: 'qcm',
    enonce: 'Dans le β-D-glucopyranose en conformation chaise, quelle est la particularité remarquable ?',
    choix: ['Tous les substituants (OH et CH₂OH) sont en position équatoriale',
      'Tous les substituants sont en position axiale', 'Le cycle adopte une conformation bateau',
      'Le cycle est plan'],
    reponse: 0,
    correction: 'Dans la conformation chaise la plus stable du β-D-glucopyranose, les quatre groupes hydroxyle et le groupe '
      + 'hydroxyméthyle occupent tous une position équatoriale : aucune interaction 1,3-diaxiale ne s’exerce.\n'
      + 'C’est l’hexose le plus stable, ce qui explique en partie pourquoi le glucose est le sucre le plus répandu dans le vivant.\n'
      + 'Dans l’anomère α, l’hydroxyle anomérique (porté par C1) est en revanche axial : l’anomère α est donc un peu moins stable, '
      + 'et l’équilibre en solution aqueuse s’établit à environ 36 % de α pour 64 % de β.' });

  /* ================= Fonctions et nomenclature ================= */
  add({ theme: 'fonctions', niveau: 1, type: 'qcm',
    enonce: 'Comment distingue-t-on un aldéhyde d’une cétone ?',
    choix: ['Le carbone du groupe carbonyle porte au moins un hydrogène dans un aldéhyde, deux carbones dans une cétone',
      'L’aldéhyde possède deux atomes d’oxygène', 'La cétone est toujours cyclique',
      'L’aldéhyde ne contient pas de double liaison'],
    reponse: 0,
    correction: 'Les deux fonctions reposent sur le même groupe carbonyle C=O.\n'
      + '  • Aldéhyde : R—CHO, le carbone du carbonyle est en bout de chaîne et porte un hydrogène. Suffixe -al.\n'
      + '  • Cétone : R—CO—R′, le carbone du carbonyle est encadré par deux carbones. Suffixe -one, avec indice de position.\n'
      + 'Conséquence pratique : les aldéhydes sont facilement oxydables en acides carboxyliques (test à la liqueur de Fehling, '
      + 'au réactif de Tollens), alors que les cétones ne le sont pas dans les mêmes conditions.' });

  add({ theme: 'fonctions', niveau: 2, type: 'qcm',
    enonce: 'Quelle est la classe de l’alcool dans le 2-méthylpropan-2-ol ((CH₃)₃C—OH) ?',
    choix: ['Tertiaire', 'Primaire', 'Secondaire', 'Ce n’est pas un alcool'],
    reponse: 0,
    correction: 'La classe d’un alcool est donnée par le nombre de carbones liés au carbone fonctionnel (celui qui porte —OH) :\n'
      + '  • primaire : un seul carbone voisin (ou aucun, pour le méthanol) ;\n  • secondaire : deux ;\n  • tertiaire : trois.\n'
      + 'Dans (CH₃)₃C—OH, le carbone fonctionnel est lié à trois méthyles : l’alcool est tertiaire.\n'
      + 'Cette classe gouverne la réactivité : un alcool tertiaire donne un carbocation stable et réagit selon SN1 / E1, '
      + 'alors qu’un alcool primaire suit plutôt SN2 / E2. Un alcool tertiaire ne peut pas non plus être oxydé en composé carbonylé.' });

  add({ theme: 'nomenclature', niveau: 2, type: 'saisie',
    enonce: 'Quel est le nom systématique du composé CH₃—CH(CH₃)—CH₂—CH₂—OH ?',
    reponse: ['3-méthylbutan-1-ol', '3-methylbutan-1-ol'],
    correction: 'On repère la fonction principale : l’alcool, suffixe -ol.\n'
      + 'La chaîne la plus longue qui la porte compte quatre carbones : racine « but ».\n'
      + 'On numérote de façon à donner l’indice le plus faible à la fonction : le carbone portant —OH devient C1.\n'
      + 'Le méthyle est alors porté par C3.\nD’où : 3-méthylbutan-1-ol.' });

  add({ theme: 'nomenclature', niveau: 2, type: 'qcm',
    enonce: 'Dans le nom d’un composé, quel critère fixe le sens de numérotation de la chaîne principale ?',
    choix: ['L’indice le plus faible pour la fonction principale, puis pour les insaturations, puis pour les substituants',
      'L’ordre alphabétique des substituants', 'Le sens qui donne le plus grand indice à la fonction',
      'Le sens de lecture de la formule développée'],
    reponse: 0,
    correction: 'L’ordre des priorités pour numéroter est strict :\n'
      + '  1. indice le plus faible pour le groupe caractéristique principal (celui exprimé par le suffixe) ;\n'
      + '  2. puis pour les insaturations (doubles et triples liaisons) ;\n'
      + '  3. puis pour l’ensemble des substituants, pris globalement ;\n'
      + '  4. en dernier recours, indice le plus faible au substituant cité le premier dans l’ordre alphabétique.\n'
      + 'L’ordre alphabétique ne sert qu’à ranger les préfixes dans le nom, jamais à numéroter. '
      + 'Les préfixes multiplicatifs (di-, tri-, tétra-) ne comptent pas dans ce classement alphabétique.' });

  add({ theme: 'nomenclature', niveau: 1, type: 'qcm',
    enonce: 'Quel est le suffixe employé pour nommer un acide carboxylique en nomenclature systématique française ?',
    choix: ['acide …oïque', '…ol', '…one', '…amine'],
    reponse: 0,
    correction: 'La fonction acide carboxylique est la plus prioritaire du programme. Elle s’exprime par « acide » placé devant le nom '
      + 'et le suffixe -oïque : CH₃—COOH est l’acide éthanoïque, HCOOH l’acide méthanoïque.\n'
      + 'Ordre de priorité décroissant des fonctions : acide carboxylique > ester > amide > nitrile > aldéhyde > cétone > alcool > amine.\n'
      + 'Lorsqu’une fonction n’est pas principale, elle s’exprime en préfixe : hydroxy- pour un alcool, oxo- pour un carbonyle, amino- pour une amine.' });

  /* ================= Formules ================= */
  add({ theme: 'formules', niveau: 2, type: 'numerique',
    enonce: 'Un composé de formule brute C₆H₆ possède combien d’insaturations (degré d’insaturation) ?',
    reponse: 4, tolerance: 0.01,
    correction: 'DoU = (2 × 6 + 2 − 6) / 2 = (14 − 6) / 2 = 4.\n'
      + 'Le benzène en est l’illustration : un cycle (1 insaturation) et trois liaisons π (3 insaturations), soit 4 au total.\n'
      + 'Attention, le degré d’insaturation ne dit pas comment ces insaturations sont réparties : C₆H₆ pourrait aussi correspondre '
      + 'à l’hexa-1,3-diyne-5-ène ou au prismane.' });

  add({ theme: 'formules', niveau: 3, type: 'numerique',
    enonce: 'L’analyse élémentaire d’un composé donne 40,0 % de carbone, 6,7 % d’hydrogène et 53,3 % d’oxygène en masse. Sa masse molaire vaut 180 g·mol⁻¹. Combien d’atomes de carbone comporte sa molécule ?',
    reponse: 6, tolerance: 0.01,
    correction: 'Sur 100 g de composé : n(C) = 40,0 / 12,0 = 3,33 mol ; n(H) = 6,7 / 1,0 = 6,7 mol ; n(O) = 53,3 / 16,0 = 3,33 mol.\n'
      + 'Rapport : C : H : O = 3,33 : 6,7 : 3,33 = 1 : 2 : 1 → formule empirique CH₂O, de masse 30 g·mol⁻¹.\n'
      + 'Comme 180 / 30 = 6, la formule brute est (CH₂O)₆ = C₆H₁₂O₆ : six atomes de carbone.\n'
      + 'Il s’agit de la formule du glucose, mais aussi du fructose et du galactose — l’analyse élémentaire ne permet pas de les distinguer.' });

  M.exobank = q;
})();
