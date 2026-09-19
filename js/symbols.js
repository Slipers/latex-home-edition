/* Catalogue de symboles consultable (touche Tab) : [latex, nom, mots-clés, affichage facultatif] */
(function () {
  const C = {};
  const add = (cat, list) => { C[cat] = list; };

  add('Courant', [
    ['\\frac{#0}{#?}', 'Fraction', 'division quotient sur'], ['#@^{#?}', 'Puissance', 'exposant carre cube', 'x^{\\square}'], ['#@_{#?}', 'Indice', 'bas'],
    ['#@^{2}', 'Au carré', 'carre puissance deux', 'x^{2}'], ['#@^{3}', 'Au cube', 'cube puissance trois', 'x^{3}'],
    ['\\sqrt{#0}', 'Racine carrée', 'radical sqrt'], ['\\sqrt[#?]{#0}', 'Racine n-ième', 'radical cubique'],
    ['\\left(#0\\right)', 'Parenthèses', 'grandes parentheses'], ['\\left[#0\\right]', 'Crochets', 'grands crochets'],
    ['\\left\\{#0\\right\\}', 'Accolades', 'ensemble'], ['\\left|#0\\right|', 'Valeur absolue', 'module barres'],
    ['\\times', 'Multiplié par', 'fois produit croix'], ['\\cdot', 'Point multiplicatif', 'produit fois'], ['\\div', 'Divisé par', 'division obelus'],
    ['\\pm', 'Plus ou moins', 'incertitude'], ['\\mp', 'Moins ou plus', ''], ['\\%', 'Pourcentage', 'pourcent'],
    ['\\infty', 'Infini', 'infinity inf'], ['+\\infty', 'Plus l\'infini', 'infini positif'], ['-\\infty', 'Moins l\'infini', 'infini negatif'],
    ['\\pi', 'Pi', 'nombre pi cercle'], ['\\mathrm{e}', 'Nombre e', 'euler exponentielle'], ['\\mathrm{i}', 'Nombre i', 'imaginaire complexe'],
    ['\\text{#?}', 'Texte dans une formule', 'mot phrase'], ['\\ldots', 'Points de suspension', 'etc trois points'], ['\\cdots', 'Points centrés', 'suspension'],
  ]);
  add('Analyse', [
    ['\\lim_{#?\\to#?}', 'Limite', 'tend limite lim', '\\lim_{x\\to a}'], ['\\lim_{x\\to+\\infty}', 'Limite en +∞', 'limite infini'],
    ['\\sum_{#?=#?}^{#?}', 'Somme', 'sigma serie sum', '\\sum_{k=0}^{n}'], ['\\prod_{#?=#?}^{#?}', 'Produit', 'pi produit', '\\prod_{k=1}^{n}'],
    ['\\int_{#?}^{#?}#?\\,\\mathrm{d}#?', 'Intégrale', 'integrale int aire', '\\int_a^b f\\,\\mathrm{d}x'], ['\\int #?\\,\\mathrm{d}#?', 'Primitive', 'integrale indefinie'],
    ['\\iint', 'Intégrale double', 'integrale surface'], ['\\iiint', 'Intégrale triple', 'integrale volume'], ['\\oint', 'Intégrale curviligne', 'circulation contour ferme'],
    ['\\frac{\\mathrm{d}#?}{\\mathrm{d}#?}', 'Dérivée', 'derivee differentielle', '\\frac{\\mathrm{d}y}{\\mathrm{d}x}'],
    ['\\frac{\\mathrm{d}^2#?}{\\mathrm{d}#?^2}', 'Dérivée seconde', 'derivee seconde acceleration', '\\frac{\\mathrm{d}^2y}{\\mathrm{d}x^2}'],
    ['\\frac{\\partial #?}{\\partial #?}', 'Dérivée partielle', 'partielle derivee rond', '\\frac{\\partial f}{\\partial x}'],
    ['#@\'', 'Prime', 'derivee f prime', "f'"], ['#@\'\'', 'Seconde', 'derivee seconde', "f''"], ['\\left[#?\\right]_{#?}^{#?}', 'Crochet d\'intégration', 'primitive borne', '\\left[F\\right]_a^b'],
    ['\\partial', 'd rond', 'partielle'], ['\\nabla', 'Nabla', 'gradient divergence rotationnel'], ['\\Delta', 'Delta (variation / laplacien)', 'variation laplacien'],
    ['\\to', 'Tend vers', 'fleche limite'], ['\\mapsto', 'Associe à', 'fonction fleche'], ['\\underset{#?\\to #?}{\\sim}', 'Équivalent en', 'equivalent', '\\underset{x\\to0}{\\sim}'],
    ['o\\left(#?\\right)', 'Petit o', 'negligeable landau'], ['O\\left(#?\\right)', 'Grand O', 'domine landau'],
    ['\\sin', 'Sinus', 'trigonometrie sin'], ['\\cos', 'Cosinus', 'trigonometrie cos'], ['\\tan', 'Tangente', 'trigonometrie tan'],
    ['\\arcsin', 'Arcsinus', 'reciproque'], ['\\arccos', 'Arccosinus', 'reciproque'], ['\\arctan', 'Arctangente', 'reciproque'],
    ['\\sinh', 'Sinus hyperbolique', 'sh'], ['\\cosh', 'Cosinus hyperbolique', 'ch'], ['\\ln', 'Logarithme népérien', 'log neperien ln'],
    ['\\log', 'Logarithme', 'log decimal'], ['\\exp', 'Exponentielle', 'exp'], ['\\mathrm{e}^{#?}', 'e puissance', 'exponentielle'],
    ['\\max', 'Maximum', 'max'], ['\\min', 'Minimum', 'min'], ['\\sup', 'Borne supérieure', 'sup'], ['\\inf', 'Borne inférieure', 'inf'],
  ]);
  add('Ensembles & logique', [
    ['\\mathbb{N}', 'Entiers naturels', 'ensemble n'], ['\\mathbb{Z}', 'Entiers relatifs', 'ensemble z'], ['\\mathbb{D}', 'Décimaux', 'ensemble d'],
    ['\\mathbb{Q}', 'Rationnels', 'ensemble q'], ['\\mathbb{R}', 'Réels', 'ensemble r'], ['\\mathbb{C}', 'Complexes', 'ensemble c'], ['\\mathbb{K}', 'Corps K', 'ensemble k'],
    ['\\mathbb{R}^{*}_{+}', 'Réels strictement positifs', 'ensemble'], ['\\in', 'Appartient à', 'element'], ['\\notin', 'N\'appartient pas à', 'element'],
    ['\\ni', 'Contient l\'élément', ''], ['\\subset', 'Inclus dans', 'sous-ensemble inclusion'], ['\\subseteq', 'Inclus ou égal', 'inclusion'],
    ['\\not\\subset', 'Non inclus', 'inclusion'], ['\\supset', 'Contient', 'inclusion'], ['\\cup', 'Union', 'reunion ou'], ['\\cap', 'Intersection', 'inter et'],
    ['\\bigcup_{#?}', 'Grande union', 'reunion'], ['\\bigcap_{#?}', 'Grande intersection', ''], ['\\setminus', 'Privé de', 'difference moins'],
    ['\\emptyset', 'Ensemble vide', 'vide'], ['\\overline{#0}', 'Complémentaire / conjugué', 'barre complementaire'],
    ['\\left[#?,#?\\right]', 'Intervalle fermé', 'intervalle crochets', '[a,b]'], ['\\left]#?,#?\\right[', 'Intervalle ouvert', 'intervalle', ']a,b['],
    ['\\left\\{#?\\mid #?\\right\\}', 'Ensemble défini par', 'tel que', '\\{x\\mid P\\}'], ['\\forall', 'Pour tout', 'quantificateur quel que soit'],
    ['\\exists', 'Il existe', 'quantificateur'], ['\\exists!', 'Il existe un unique', 'quantificateur unique'], ['\\nexists', 'Il n\'existe pas', ''],
    ['\\neg', 'Non', 'negation logique'], ['\\land', 'Et logique', 'conjonction'], ['\\lor', 'Ou logique', 'disjonction'],
    ['\\Rightarrow', 'Implique', 'implication donc'], ['\\Leftarrow', 'Est impliqué par', 'reciproque'], ['\\Leftrightarrow', 'Équivalent à', 'equivalence ssi si et seulement si'],
    ['\\binom{#?}{#?}', 'Coefficient binomial', 'combinaison parmi', '\\binom{n}{k}'], ['#@!', 'Factorielle', 'factorielle', 'n!'],
    ['\\mathrm{card}\\left(#?\\right)', 'Cardinal', 'nombre elements'], ['\\mathcal{P}\\left(#?\\right)', 'Parties de', 'ensemble des parties'],
    ['\\mathbb{P}\\left(#?\\right)', 'Probabilité', 'proba'], ['P_{#?}\\left(#?\\right)', 'Probabilité conditionnelle', 'proba sachant'],
    ['\\mathbb{E}\\left(#?\\right)', 'Espérance', 'moyenne'], ['\\mathbb{V}\\left(#?\\right)', 'Variance', ''], ['\\sigma', 'Écart-type', 'sigma'],
  ]);
  add('Relations', [
    ['=', 'Égal', 'egalite'], ['\\neq', 'Différent', 'pas egal'], ['<', 'Inférieur', 'plus petit'], ['>', 'Supérieur', 'plus grand'],
    ['\\leq', 'Inférieur ou égal', 'plus petit ou egal'], ['\\geq', 'Supérieur ou égal', 'plus grand ou egal'], ['\\ll', 'Très inférieur', 'negligeable'],
    ['\\gg', 'Très supérieur', ''], ['\\approx', 'Environ égal', 'approximativement'], ['\\simeq', 'Presque égal', 'environ'], ['\\sim', 'Équivalent', 'tilde'],
    ['\\equiv', 'Congru / identique', 'congruence modulo'], ['\\equiv #? \\pmod{#?}', 'Modulo', 'congruence', 'a\\equiv b\\pmod n'], ['\\propto', 'Proportionnel à', 'proportionnalite'],
    ['\\coloneqq', 'Défini par', 'definition egal'], ['\\perp', 'Perpendiculaire', 'orthogonal'], ['\\parallel', 'Parallèle', ''], ['\\mid', 'Divise', 'divisibilite barre'],
  ]);
  add('Flèches', [
    ['\\rightarrow', 'Flèche droite', 'fleche'], ['\\leftarrow', 'Flèche gauche', 'fleche'], ['\\leftrightarrow', 'Double flèche', 'fleche'],
    ['\\longrightarrow', 'Longue flèche', 'fleche'], ['\\Rightarrow', 'Implique', 'fleche double'], ['\\Leftrightarrow', 'Équivalent', 'fleche double'],
    ['\\uparrow', 'Flèche haut', 'croissant'], ['\\downarrow', 'Flèche bas', 'decroissant'], ['\\nearrow', 'Croissante', 'fleche monte'],
    ['\\searrow', 'Décroissante', 'fleche descend'], ['\\rightleftharpoons', 'Équilibre', 'fleche chimie'], ['\\xrightarrow{#?}', 'Flèche avec texte', 'fleche annotee'],
  ]);
  add('Grec', 'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi rho sigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Phi Psi Omega'
    .split(' ').map(g => ['\\' + g, g[0].toUpperCase() === g[0] ? g + ' (majuscule)' : g, 'grec lettre ' + g]));
  add('Géométrie & vecteurs', [
    ['\\vec{#0}', 'Vecteur', 'fleche vecteur'], ['\\overrightarrow{#0}', 'Vecteur AB', 'vecteur fleche', '\\overrightarrow{AB}'], ['\\left\\|#0\\right\\|', 'Norme', 'longueur vecteur'],
    ['\\vec{#?}\\cdot\\vec{#?}', 'Produit scalaire', 'scalaire', '\\vec u\\cdot\\vec v'], ['\\vec{#?}\\wedge\\vec{#?}', 'Produit vectoriel', 'vectoriel', '\\vec u\\wedge\\vec v'],
    ['\\left(\\vec{#?},\\vec{#?}\\right)', 'Angle orienté', 'angle vecteurs'], ['\\widehat{#0}', 'Angle', 'chapeau angle', '\\widehat{ABC}'], ['#@^{\\circ}', 'Degré', 'angle degre', '30^{\\circ}'],
    ['\\left(O;\\vec{\\imath},\\vec{\\jmath}\\right)', 'Repère', 'repere orthonorme'], ['\\triangle', 'Triangle', 'triangle'], ['\\angle', 'Angle (symbole)', ''],
    ['\\overline{#0}', 'Mesure algébrique', 'barre segment'], ['\\left[#?#?\\right]', 'Segment', 'segment'], ['\\hat{#0}', 'Chapeau', 'accent'],
    ['\\begin{pmatrix}#?\\\\#?\\end{pmatrix}', 'Coordonnées (2)', 'vecteur colonne', '\\begin{pmatrix}x\\\\y\\end{pmatrix}'],
    ['\\begin{pmatrix}#?\\\\#?\\\\#?\\end{pmatrix}', 'Coordonnées (3)', 'vecteur colonne', '\\begin{pmatrix}x\\\\y\\\\z\\end{pmatrix}'],
  ]);
  add('Matrices & systèmes', [
    ['\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}', 'Matrice 2×2', 'matrice', '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}'],
    ['\\begin{pmatrix}#?&#?&#?\\\\#?&#?&#?\\\\#?&#?&#?\\end{pmatrix}', 'Matrice 3×3', 'matrice', '\\begin{pmatrix}\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\end{pmatrix}'],
    ['\\begin{vmatrix}#?&#?\\\\#?&#?\\end{vmatrix}', 'Déterminant', 'det', '\\begin{vmatrix}a&b\\\\c&d\\end{vmatrix}'],
    ['\\begin{cases}#?&\\text{si }#?\\\\#?&\\text{sinon}\\end{cases}', 'Fonction par morceaux', 'cas accolade', '\\begin{cases}a&\\text{si}\\\\b&\\text{sinon}\\end{cases}'],
    ['\\left\\{\\begin{aligned}#?&=#?\\\\#?&=#?\\end{aligned}\\right.', 'Système', 'systeme equations', '\\left\\{\\begin{aligned}x&=1\\\\y&=2\\end{aligned}\\right.'],
    ['\\begin{aligned}#?&=#?\\\\&=#?\\end{aligned}', 'Calcul sur plusieurs lignes', 'aligne lignes', '\\begin{aligned}a&=b\\\\&=c\\end{aligned}'],
    ['#@^{\\mathsf{T}}', 'Transposée', 'transpose', 'A^{\\mathsf{T}}'], ['#@^{-1}', 'Inverse', 'inverse', 'A^{-1}'], ['I_{#?}', 'Matrice identité', 'identite', 'I_n'],
    ['\\det', 'Déterminant (fonction)', 'det'], ['\\operatorname{tr}', 'Trace', 'trace'], ['\\ker', 'Noyau', 'ker'], ['\\operatorname{Im}', 'Image', 'im'],
  ]);
  add('Physique & unités', [
    ['#@\\times 10^{#?}', 'Notation scientifique', 'puissance de dix', 'a\\times10^{n}'], ['\\,\\mathrm{#?}', 'Unité (texte droit)', 'unite', '\\mathrm{u}'],
    ['\\,\\mathrm{m}', 'Mètre', 'longueur m'], ['\\,\\mathrm{cm}', 'Centimètre', 'longueur'], ['\\,\\mathrm{mm}', 'Millimètre', 'longueur'], ['\\,\\mathrm{km}', 'Kilomètre', 'longueur'],
    ['\\,\\mathrm{nm}', 'Nanomètre', 'longueur onde'], ['\\,\\mu\\mathrm{m}', 'Micromètre', 'longueur'], ['\\,\\mathrm{s}', 'Seconde', 'temps'], ['\\,\\mathrm{ms}', 'Milliseconde', 'temps'],
    ['\\,\\mathrm{min}', 'Minute', 'temps'], ['\\,\\mathrm{h}', 'Heure', 'temps'], ['\\,\\mathrm{kg}', 'Kilogramme', 'masse'], ['\\,\\mathrm{g}', 'Gramme', 'masse'],
    ['\\,\\mathrm{m\\cdot s^{-1}}', 'Mètre par seconde', 'vitesse m/s'], ['\\,\\mathrm{km\\cdot h^{-1}}', 'Kilomètre par heure', 'vitesse km/h'], ['\\,\\mathrm{m\\cdot s^{-2}}', 'Mètre par seconde carrée', 'acceleration'],
    ['\\,\\mathrm{N}', 'Newton', 'force'], ['\\,\\mathrm{J}', 'Joule', 'energie'], ['\\,\\mathrm{kJ}', 'Kilojoule', 'energie'], ['\\,\\mathrm{eV}', 'Électronvolt', 'energie'],
    ['\\,\\mathrm{W}', 'Watt', 'puissance'], ['\\,\\mathrm{Pa}', 'Pascal', 'pression'], ['\\,\\mathrm{hPa}', 'Hectopascal', 'pression'], ['\\,\\mathrm{bar}', 'Bar', 'pression'],
    ['\\,\\mathrm{V}', 'Volt', 'tension electricite'], ['\\,\\mathrm{A}', 'Ampère', 'intensite courant'], ['\\,\\mathrm{mA}', 'Milliampère', 'intensite'], ['\\,\\Omega', 'Ohm', 'resistance'],
    ['\\,\\mathrm{k}\\Omega', 'Kiloohm', 'resistance'], ['\\,\\mathrm{F}', 'Farad', 'capacite condensateur'], ['\\,\\mathrm{\\mu F}', 'Microfarad', 'capacite'], ['\\,\\mathrm{H}', 'Henry', 'inductance bobine'],
    ['\\,\\mathrm{C}', 'Coulomb', 'charge'], ['\\,\\mathrm{T}', 'Tesla', 'champ magnetique'], ['\\,\\mathrm{Hz}', 'Hertz', 'frequence'], ['\\,\\mathrm{kHz}', 'Kilohertz', 'frequence'],
    ['\\,\\mathrm{dB}', 'Décibel', 'son intensite sonore'], ['\\,\\mathrm{K}', 'Kelvin', 'temperature'], ['\\,^{\\circ}\\mathrm{C}', 'Degré Celsius', 'temperature'],
    ['\\,\\mathrm{mol}', 'Mole', 'quantite matiere'], ['\\,\\mathrm{mmol}', 'Millimole', 'quantite matiere'], ['\\,\\mathrm{mol\\cdot L^{-1}}', 'Mole par litre', 'concentration molaire'],
    ['\\,\\mathrm{g\\cdot L^{-1}}', 'Gramme par litre', 'concentration massique'], ['\\,\\mathrm{g\\cdot mol^{-1}}', 'Gramme par mole', 'masse molaire'],
    ['\\,\\mathrm{L}', 'Litre', 'volume'], ['\\,\\mathrm{mL}', 'Millilitre', 'volume'], ['\\,\\mathrm{m^{3}}', 'Mètre cube', 'volume'], ['\\,\\mathrm{m^{2}}', 'Mètre carré', 'surface aire'],
    ['\\,\\mathrm{rad}', 'Radian', 'angle'], ['\\,\\mathrm{rad\\cdot s^{-1}}', 'Radian par seconde', 'vitesse angulaire'], ['\\,\\mathrm{S\\cdot m^{-1}}', 'Siemens par mètre', 'conductivite'],
    ['\\vec{F}', 'Force', 'vecteur force'], ['\\vec{v}', 'Vitesse', 'vecteur vitesse'], ['\\vec{a}', 'Accélération', 'vecteur'], ['\\vec{p}', 'Quantité de mouvement', 'vecteur'],
    ['\\vec{g}', 'Pesanteur', 'gravite'], ['\\vec{E}', 'Champ électrique', 'champ'], ['\\vec{B}', 'Champ magnétique', 'champ'], ['\\sum\\vec{F}=m\\vec{a}', 'Deuxième loi de Newton', 'pfd newton'],
    ['E_{c}=\\frac{1}{2}mv^{2}', 'Énergie cinétique', 'energie'], ['E_{pp}=mgz', 'Énergie potentielle', 'energie'], ['\\lambda=\\frac{c}{f}', 'Longueur d\'onde', 'onde'],
    ['c', 'Célérité de la lumière', 'vitesse lumiere'], ['\\hbar', 'h barre', 'planck'], ['\\ell', 'l cursif', 'longueur'], ['\\Delta t', 'Durée', 'variation temps'],
    ['\\dot{#0}', 'Dérivée temporelle', 'point'], ['\\ddot{#0}', 'Dérivée seconde temporelle', 'deux points'], ['\\langle #? \\rangle', 'Moyenne', 'valeur moyenne'],
    ['u\\left(#?\\right)', 'Incertitude-type', 'incertitude u'], ['\\frac{u\\left(#?\\right)}{#?}', 'Incertitude relative', 'incertitude'],
  ]);
  add('Chimie', [
    ['\\ce{->}', 'Flèche de réaction', 'reaction fleche transformation', null, ' -> '], ['\\ce{<=>}', 'Équilibre', 'equilibre double fleche', null, ' <=> '],
    ['\\ce{^{2+}}', 'Charge 2+', 'ion cation', null, '^2+'], ['\\ce{^{+}}', 'Charge +', 'ion cation', null, '^+'], ['\\ce{^{-}}', 'Charge −', 'ion anion', null, '^-'],
    ['\\ce{^{2-}}', 'Charge 2−', 'ion anion', null, '^2-'], ['\\ce{(aq)}', 'Aqueux', 'etat solution', null, '(aq)'], ['\\ce{(s)}', 'Solide', 'etat', null, '(s)'],
    ['\\ce{(l)}', 'Liquide', 'etat', null, '(l)'], ['\\ce{(g)}', 'Gaz', 'etat gazeux', null, '(g)'], ['\\ce{v}', 'Précipité', 'solide forme', null, ' v'],
    ['\\ce{^}', 'Dégagement gazeux', 'gaz', null, ' ^'], ['\\ce{H2O}', 'Eau', 'molecule', null, 'H2O'], ['\\ce{H3O+}', 'Ion oxonium', 'acide', null, 'H3O+'],
    ['\\ce{HO-}', 'Ion hydroxyde', 'base', null, 'HO-'], ['\\ce{CO2}', 'Dioxyde de carbone', 'gaz', null, 'CO2'], ['\\ce{O2}', 'Dioxygène', 'gaz', null, 'O2'],
    ['\\ce{H2}', 'Dihydrogène', 'gaz', null, 'H2'], ['\\ce{e-}', 'Électron', 'oxydoreduction', null, 'e-'], ['\\ce{Na+}', 'Ion sodium', 'cation', null, 'Na+'],
    ['\\ce{Cl-}', 'Ion chlorure', 'anion', null, 'Cl-'], ['\\ce{Cu^{2+}}', 'Ion cuivre II', 'cation', null, 'Cu^2+'], ['\\ce{Fe^{3+}}', 'Ion fer III', 'cation', null, 'Fe^3+'],
    ['\\ce{SO4^{2-}}', 'Ion sulfate', 'anion', null, 'SO4^2-'], ['\\ce{CH3COOH}', 'Acide éthanoïque', 'acide acetique', null, 'CH3COOH'],
    ['\\mathrm{pH}', 'pH', 'acidite'], ['\\mathrm{p}K_{a}', 'pKa', 'acide constante'], ['K_{a}', 'Constante d\'acidité', 'ka'], ['K_{e}', 'Produit ionique de l\'eau', 'ke'],
    ['\\left[#?\\right]', 'Concentration', 'concentration crochets', '[\\ce{A}]'], ['x_{\\max}', 'Avancement maximal', 'avancement xmax'], ['x_{f}', 'Avancement final', 'avancement'],
    ['n_{0}', 'Quantité initiale', 'quantite matiere'], ['M', 'Masse molaire', 'masse molaire'], ['\\tau', 'Taux d\'avancement', 'taux'], ['Q_{r}', 'Quotient de réaction', 'quotient'],
  ]);
  add('Accents & styles', [
    ['\\hat{#0}', 'Chapeau', 'accent'], ['\\bar{#0}', 'Barre', 'moyenne accent'], ['\\tilde{#0}', 'Tilde', 'accent'], ['\\dot{#0}', 'Point', 'accent'],
    ['\\underline{#0}', 'Souligné', 'sous'], ['\\overbrace{#0}^{#?}', 'Accolade au-dessus', 'accolade'], ['\\underbrace{#0}_{#?}', 'Accolade en dessous', 'accolade'],
    ['\\mathbf{#0}', 'Gras', 'gras bold'], ['\\mathrm{#0}', 'Droit', 'romain'], ['\\mathcal{#0}', 'Calligraphié', 'cursif ronde'], ['\\mathbb{#0}', 'Ajouré', 'double barre'],
    ['\\boxed{#0}', 'Encadré', 'resultat cadre'], ['\\cancel{#0}', 'Barré', 'simplifier'],
  ]);
  add('Espaces', [
    ['\\,', 'Espace fine', 'espace petite fine unite', 'a\\,b'], ['\\:', 'Espace moyenne', 'espace moyenne', 'a\\:b'], ['\\;', 'Espace', 'espace grande', 'a\\;b'],
    ['\\quad', 'Grand espace (quad)', 'espace quad large', 'a\\quad b'], ['\\qquad', 'Très grand espace (qquad)', 'espace qquad double', 'a\\qquad b'],
    ['\\!', 'Espace négative (rapprocher)', 'espace negative rapprocher', 'a\\!b'], ['\\text{ et }', 'Mot « et » dans la formule', 'texte et espace', 'a\\text{ et }b'],
    ['\\text{ soit }', 'Mot « soit » dans la formule', 'texte soit espace', 'a\\text{ soit }b'], ['\\text{ donc }', 'Mot « donc » dans la formule', 'texte donc', 'a\\text{ donc }b'],
  ]);
  add('Divers', [
    ['\\checkmark', 'Coche', 'valide'], ['\\star', 'Étoile', ''], ['\\dagger', 'Croix', 'dague'], ['\\square', 'Carré', 'fin'], ['\\circ', 'Rond / composition', 'rond'],
    ['\\bullet', 'Puce', 'point'], ['\\aleph', 'Aleph', 'hebreu'], ['\\Re', 'Partie réelle', 're'], ['\\Im', 'Partie imaginaire', 'im'],
    ['\\hbar', 'Constante de Planck réduite', 'h'], ['\\wp', 'Weierstrass', 'p'], ['\\S', 'Paragraphe', 'section'],
  ]);

  L.SYMBOLS = [];
  for (const [cat, list] of Object.entries(C)) {
    list.forEach(([latex, name, kw, disp, chem]) => L.SYMBOLS.push({ cat, latex, name, kw: kw || '', disp, chem }));
  }
  L.SYMBOL_CATS = Object.keys(C);
})();

/* ---------- Menu de recherche de symboles ---------- */
L.SymbolPicker = (function () {
  let box, input, grid, info, cats, list = [], idx = 0, cat = null, ctx = null, onPick = null, onClose = null;
  const COLS = 8;
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const disp = e => e.disp || e.latex.replace(/#\?|#0/g, '\\square').replace(/#@/g, 'x');
  const cache = {};
  const html = e => cache[e.latex + e.disp] || (cache[e.latex + e.disp] = L.katex(disp(e)));

  function build() {
    box = L.h('div', { id: 'symPicker', class: 'sympick', hidden: true });
    input = L.h('input', { type: 'text', placeholder: 'Rechercher un symbole : intégrale, alpha, appartient, ohm, flèche…', spellcheck: 'false' });
    cats = L.h('div', { class: 'sp-cats' });
    grid = L.h('div', { class: 'sp-grid' });
    info = L.h('div', { class: 'sp-info' });
    box.append(L.h('div', { class: 'sp-head' }, L.h('span', { class: 'sp-ic', text: '⌕' }), input, L.h('button', { class: 'sp-x', text: '×', title: 'Fermer (Échap)', onclick: () => close() })), cats, grid, info);
    document.body.appendChild(box);
    input.addEventListener('input', () => { idx = 0; filter(); });
    input.addEventListener('keydown', key);
    box.addEventListener('mousedown', e => { if (e.target !== input) e.preventDefault(); });
    document.addEventListener('mousedown', e => { if (!box.hidden && !box.contains(e.target)) close(); }, true);
  }

  function allowed(e) {
    if (ctx === 'math') return e.cat !== 'Chimie' || !/\\ce\{/.test(e.latex);
    if (ctx === 'chem') return e.cat === 'Chimie' && !!e.chem;
    return true;
  }

  function filter() {
    const q = norm(input.value.trim());
    const words = q.split(/\s+/).filter(Boolean);
    const score = e => {
      if (!words.length) return 1;
      const hay = norm(e.name + ' ' + e.kw + ' ' + e.cat + ' ' + e.latex.replace(/\\/g, ' '));
      const toks = hay.split(/[^a-z0-9+\-]+/);
      let s = 0;
      for (const w of words) {
        if (norm(e.name).startsWith(w)) s += 3;
        else if (toks.some(t => t.startsWith(w))) s += 2;
        else if (hay.includes(w)) s += 1;
        else return 0;
      }
      return s;
    };
    list = L.SYMBOLS.filter(e => allowed(e) && (!cat || e.cat === cat) && score(e) > 0);
    if (words.length) list.sort((a, b) => score(b) - score(a));
    draw(!words.length && !cat);
  }

  function draw(grouped) {
    grid.innerHTML = '';
    if (!list.length) { grid.appendChild(L.h('div', { class: 'sp-none', text: 'Aucun symbole trouvé. Essayez un autre mot (ex. « racine », « somme », « vecteur »).' })); info.textContent = ''; return; }
    let g = null, row = null;
    list.forEach((e, i) => {
      if (grouped && e.cat !== g) { g = e.cat; grid.appendChild(L.h('div', { class: 'sp-gh', text: g })); row = null; }
      if (!row) { row = L.h('div', { class: 'sp-row' }); grid.appendChild(row); }
      const b = L.h('button', { class: 'sp-cell' + (i === idx ? ' act' : ''), title: e.name, 'data-i': i, html: html(e) });
      b.onclick = () => pick(i);
      b.onmouseenter = () => { idx = i; mark(); };
      row.appendChild(b);
    });
    mark();
  }

  function mark() {
    grid.querySelectorAll('.sp-cell.act').forEach(x => x.classList.remove('act'));
    const b = grid.querySelector('.sp-cell[data-i="' + idx + '"]');
    if (b) { b.classList.add('act'); b.scrollIntoView({ block: 'nearest' }); }
    const e = list[idx];
    info.innerHTML = e ? '<b>' + L.escHtml(e.name) + '</b> <span>' + L.escHtml(e.cat) + '</span><em>Entrée : insérer · flèches : parcourir · Tab : catégorie suivante</em>' : '';
  }

  function drawCats() {
    cats.innerHTML = '';
    const mk = (c, label) => L.h('button', { class: c === cat ? 'on' : '', text: label, onclick: () => { cat = c; idx = 0; drawCats(); filter(); input.focus(); } });
    cats.appendChild(mk(null, 'Tout'));
    L.SYMBOL_CATS.filter(c => L.SYMBOLS.some(e => e.cat === c && allowed(e))).forEach(c => cats.appendChild(mk(c, c)));
  }

  function key(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Enter') { e.preventDefault(); pick(idx); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const cs = [null, ...L.SYMBOL_CATS.filter(c => L.SYMBOLS.some(x => x.cat === c && allowed(x)))];
      const j = cs.indexOf(cat);
      cat = cs[(j + (e.shiftKey ? cs.length - 1 : 1)) % cs.length];
      idx = 0; drawCats(); filter();
      return;
    }
    // Navigation dans la grille (en tenant compte des lignes affichées)
    const cells = Array.from(grid.querySelectorAll('.sp-cell'));
    const cur = cells.find(c => +c.dataset.i === idx);
    if (!cur) return;
    let target = null;
    if (e.key === 'ArrowRight') target = cells[cells.indexOf(cur) + 1];
    else if (e.key === 'ArrowLeft') target = cells[cells.indexOf(cur) - 1];
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const r = cur.getBoundingClientRect();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const rows = cells.filter(c => dir > 0 ? c.getBoundingClientRect().top > r.top + 4 : c.getBoundingClientRect().top < r.top - 4);
      if (rows.length) {
        const rowTop = dir > 0 ? Math.min(...rows.map(c => c.getBoundingClientRect().top)) : Math.max(...rows.map(c => c.getBoundingClientRect().top));
        const inRow = rows.filter(c => Math.abs(c.getBoundingClientRect().top - rowTop) < 4);
        target = inRow.reduce((a, c) => Math.abs(c.getBoundingClientRect().left - r.left) < Math.abs(a.getBoundingClientRect().left - r.left) ? c : a, inRow[0]);
      }
    } else return;
    e.preventDefault();
    if (target) { idx = +target.dataset.i; mark(); }
  }

  function pick(i) {
    const e = list[i];
    if (!e) return;
    const cb = onPick;
    close(true);
    if (cb) cb(e);
  }

  function open(opts) {
    if (!box) build();
    ctx = opts.context || 'text';
    onPick = opts.onPick; onClose = opts.onClose;
    cat = null; idx = 0; input.value = '';
    drawCats(); filter();
    box.hidden = false;
    const w = 470, h = 440;
    let x = opts.x ?? (window.innerWidth - w) / 2, y = opts.y ?? 120;
    x = Math.max(10, Math.min(x, window.innerWidth - w - 10));
    if (y + h > window.innerHeight - 10) y = Math.max(10, (opts.above ?? y) - h - 8);
    box.style.left = x + 'px'; box.style.top = y + 'px';
    setTimeout(() => input.focus(), 0);
  }

  function close(picked) {
    if (!box || box.hidden) return;
    box.hidden = true;
    const cb = onClose; onClose = null;
    if (cb) cb(!!picked);
  }

  return { open, close, isOpen: () => box && !box.hidden };
})();
