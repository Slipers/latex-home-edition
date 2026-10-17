/* Éditeur visuel de formules (MathLive) — sans écrire une ligne de code */

/* Palette de l'éditeur de formules : [modèle, nom, affichage facultatif]. Un modèle qui
   commence par « @ » est une action (générateur de matrices, lignes et colonnes). */
L.PALETTE = [
  { name: 'Courant', items: [
    ['\\frac{#0}{#?}', 'Fraction'], ['#@^{#?}', 'Puissance / exposant', 'x^{\\square}'], ['#@_{#?}', 'Indice', 'x_{\\square}'],
    ['\\sqrt{#0}', 'Racine carrée'], ['\\sqrt[#?]{#0}', 'Racine n-ième'], ['\\left(#0\\right)', 'Parenthèses'],
    ['\\left[#0\\right]', 'Crochets'], ['\\left\\{#0\\right\\}', 'Accolades'], ['\\left|#0\\right|', 'Valeur absolue'],
    ['\\left\\lfloor #0\\right\\rfloor', 'Partie entière', '\\lfloor x\\rfloor'],
    ['\\times', 'Multiplié'], ['\\cdot', 'Point (produit)'], ['\\div', 'Divisé'], ['\\pm', 'Plus ou moins'],
    ['\\leq', 'Inférieur ou égal'], ['\\geq', 'Supérieur ou égal'], ['\\leqslant', 'Inférieur ou égal (incliné)'], ['\\geqslant', 'Supérieur ou égal (incliné)'],
    ['\\neq', 'Différent'], ['\\approx', 'Environ égal'],
    ['\\infty', 'Infini'], ['\\pi', 'Pi'], ['\\mathrm{e}^{#?}', 'Exponentielle'], ['\\ln\\left(#?\\right)', 'Logarithme népérien'],
    ['#@!', 'Factorielle', 'n!'], ['\\binom{#?}{#?}', 'Coefficient binomial'], ['\\text{#?}', 'Texte dans la formule', '\\text{abc}'],
  ]},
  { name: 'Analyse', items: [
    ['\\lim_{#?\\to#?}', 'Limite', '\\lim_{x\\to a}'], ['\\lim_{#?\\to+\\infty}', 'Limite en +∞', '\\lim_{n\\to+\\infty}'],
    ['\\sum_{#?=#?}^{#?}', 'Somme', '\\sum_{k=0}^{n}'], ['\\sum_{#?=#?}^{+\\infty}', 'Série', '\\sum_{n=0}^{+\\infty}'], ['\\prod_{#?=#?}^{#?}', 'Produit', '\\prod_{k=1}^{n}'],
    ['\\int_{#?}^{#?}#?\\,\\mathrm{d}#?', 'Intégrale', '\\int_a^b f\\,\\mathrm{d}x'], ['\\int #?\\,\\mathrm{d}#?', 'Primitive', '\\int f\\,\\mathrm{d}x'],
    ['\\int_{#?}^{+\\infty}#?\\,\\mathrm{d}#?', 'Intégrale généralisée', '\\int_a^{+\\infty}'],
    ['\\iint_{#?}#?\\,\\mathrm{d}#?\\,\\mathrm{d}#?', 'Intégrale double', '\\iint'], ['\\iiint', 'Intégrale triple'], ['\\oint_{#?}', 'Intégrale curviligne', '\\oint'],
    ['\\frac{\\mathrm{d}#?}{\\mathrm{d}#?}', 'Dérivée', '\\frac{\\mathrm{d}y}{\\mathrm{d}x}'], ['\\frac{\\mathrm{d}^{2}#?}{\\mathrm{d}#?^{2}}', 'Dérivée seconde', '\\frac{\\mathrm{d}^2y}{\\mathrm{d}x^2}'],
    ['\\frac{\\partial #?}{\\partial #?}', 'Dérivée partielle', '\\frac{\\partial f}{\\partial x}'],
    ['#@\'', 'Prime (dérivée)', "f'"], ['#@\'\'', 'Seconde', "f''"], ['#@^{(#?)}', 'Dérivée n-ième', 'f^{(n)}'],
    ['\\left[#?\\right]_{#?}^{#?}', 'Crochet d\'intégration', '\\left[F\\right]_a^b'], ['\\left.#0\\right|_{#?}', 'Évalué en', 'f\\big|_{x=a}'],
    ['\\left\\lfloor #0\\right\\rfloor', 'Partie entière', '\\lfloor x\\rfloor'], ['\\left\\lceil #0\\right\\rceil', 'Partie entière supérieure', '\\lceil x\\rceil'],
    ['#@\\circ #?', 'Composée', 'f\\circ g'], ['#@^{-1}', 'Réciproque', 'f^{-1}'], ['\\mathcal{C}^{#?}', 'Classe C^k', '\\mathcal{C}^{k}'],
    ['\\to', 'Tend vers'], ['\\mapsto', 'Associe'], ['\\xrightarrow[#?]{#?}', 'Flèche annotée', '\\xrightarrow[n\\to\\infty]{}'], ['\\nabla', 'Nabla'], ['\\partial', 'd rond'],
    ['\\sin', 'Sinus'], ['\\cos', 'Cosinus'], ['\\tan', 'Tangente'], ['\\arcsin', 'Arcsinus'], ['\\arccos', 'Arccosinus'], ['\\arctan', 'Arctangente'],
    ['\\operatorname{ch}', 'Cosinus hyperbolique'], ['\\operatorname{sh}', 'Sinus hyperbolique'], ['\\operatorname{th}', 'Tangente hyperbolique'],
    ['\\exp', 'exp'], ['\\log', 'log'], ['\\max', 'max'], ['\\min', 'min'], ['\\sup', 'sup'], ['\\inf', 'inf'], ['\\limsup', 'Limite supérieure'], ['\\liminf', 'Limite inférieure'],
    ['\\underset{#?\\to #?}{\\sim}', 'Équivalent', '\\underset{x\\to 0}{\\sim}'], ['o\\left(#?\\right)', 'Petit o', 'o(x)'], ['O\\left(#?\\right)', 'Grand O', 'O(x)'],
  ]},
  { name: 'Relations', items: [
    ['=', 'Égal'], ['\\neq', 'Différent'], ['<', 'Inférieur'], ['>', 'Supérieur'], ['\\leq', '≤'], ['\\geq', '≥'], ['\\leqslant', '⩽'], ['\\geqslant', '⩾'],
    ['\\ll', 'Très inférieur'], ['\\gg', 'Très supérieur'], ['\\approx', '≈'], ['\\simeq', '≃'], ['\\sim', '∼'], ['\\cong', 'Isomorphe / congru'],
    ['\\equiv', 'Congru / identique'], ['\\equiv #? \\pmod{#?}', 'Modulo', 'a\\equiv b \\pmod{n}'], ['\\propto', 'Proportionnel'],
    ['\\overset{\\text{déf}}{=}', 'Égal par définition'], ['\\coloneqq', 'Défini par'],
    ['\\Rightarrow', 'Implique'], ['\\Leftarrow', 'Est impliqué par'], ['\\Leftrightarrow', 'Équivalent'], ['\\Longrightarrow', 'Implique (long)'],
    ['\\Longleftrightarrow', 'Équivalent (long)'], ['\\nRightarrow', 'N\'implique pas'], ['\\rightarrow', 'Flèche'], ['\\longrightarrow', 'Longue flèche'],
    ['\\hookrightarrow', 'Injection'], ['\\twoheadrightarrow', 'Surjection'], ['\\perp', 'Perpendiculaire'], ['\\parallel', 'Parallèle'],
    ['\\mid', 'Divise'], ['\\nmid', 'Ne divise pas'],
  ]},
  { name: 'Ensembles', items: [
    ['\\mathbb{N}', 'Entiers naturels'], ['\\mathbb{N}^{*}', 'Entiers non nuls'], ['\\mathbb{Z}', 'Entiers relatifs'], ['\\mathbb{Q}', 'Rationnels'],
    ['\\mathbb{R}', 'Réels'], ['\\mathbb{R}_{+}', 'Réels positifs'], ['\\mathbb{R}^{*}_{+}', 'Réels strictement positifs'], ['\\mathbb{C}', 'Complexes'],
    ['\\mathbb{U}', 'Complexes de module 1'], ['\\mathbb{K}', 'Corps K'], ['\\mathbb{R}^{#?}', 'R puissance n', '\\mathbb{R}^{n}'],
    ['\\in', 'Appartient'], ['\\notin', 'N\'appartient pas'], ['\\subset', 'Inclus'], ['\\subseteq', 'Inclus ou égal'], ['\\not\\subset', 'Non inclus'], ['\\supset', 'Contient'],
    ['\\cup', 'Union'], ['\\cap', 'Intersection'], ['\\bigcup_{#?}', 'Grande union', '\\bigcup_{i}'], ['\\bigcap_{#?}', 'Grande intersection', '\\bigcap_{i}'],
    ['\\setminus', 'Privé de'], ['\\Delta', 'Différence symétrique'], ['#@\\times #?', 'Produit cartésien', 'A\\times B'],
    ['\\emptyset', 'Ensemble vide'], ['\\varnothing', 'Ensemble vide (variante)'], ['\\overline{#0}', 'Complémentaire', '\\overline{A}'], ['\\mathcal{P}\\left(#?\\right)', 'Parties de', '\\mathcal{P}(E)'],
    ['\\forall', 'Pour tout'], ['\\exists', 'Il existe'], ['\\exists!', 'Il existe un unique'], ['\\nexists', 'Il n\'existe pas'], ['\\neg', 'Non'], ['\\land', 'Et'], ['\\lor', 'Ou'],
    ['\\left[#?,#?\\right]', 'Intervalle fermé', '[a,b]'], ['\\left]#?,#?\\right[', 'Intervalle ouvert', ']a,b['],
    ['\\left[#?,#?\\right[', 'Intervalle semi-ouvert à droite', '[a,b['], ['\\left]#?,#?\\right]', 'Intervalle semi-ouvert à gauche', ']a,b]'],
    ['\\llbracket #?,#?\\rrbracket', 'Intervalle d\'entiers', '\\llbracket 1,n\\rrbracket'], ['\\left\\{#?\\mid #?\\right\\}', 'Ensemble défini par', '\\{x\\mid P\\}'],
    ['\\mathrm{card}\\left(#?\\right)', 'Cardinal', '\\mathrm{card}(E)'], ['\\mathbb{Z}/#?\\mathbb{Z}', 'Entiers modulo n', '\\mathbb{Z}/n\\mathbb{Z}'],
  ]},
  { name: 'Algèbre & probas', items: [
    ['\\mathcal{M}_{#?}\\left(\\mathbb{K}\\right)', 'Matrices carrées', '\\mathcal{M}_{n}(\\mathbb{K})'], ['\\mathcal{M}_{#?,#?}\\left(\\mathbb{K}\\right)', 'Matrices n×p', '\\mathcal{M}_{n,p}(\\mathbb{K})'],
    ['\\mathrm{GL}_{#?}\\left(\\mathbb{K}\\right)', 'Groupe linéaire', '\\mathrm{GL}_{n}(\\mathbb{K})'], ['\\mathcal{L}\\left(#?\\right)', 'Endomorphismes', '\\mathcal{L}(E)'],
    ['\\mathbb{K}\\left[X\\right]', 'Polynômes', '\\mathbb{K}[X]'], ['\\mathbb{K}_{#?}\\left[X\\right]', 'Polynômes de degré ≤ n', '\\mathbb{K}_{n}[X]'],
    ['\\operatorname{rg}', 'Rang'], ['\\dim', 'Dimension'], ['\\operatorname{Vect}\\left(#?\\right)', 'Sous-espace engendré', '\\operatorname{Vect}(u)'],
    ['\\ker', 'Noyau'], ['\\operatorname{Im}', 'Image'], ['\\det', 'Déterminant'], ['\\operatorname{tr}', 'Trace'], ['\\operatorname{Sp}', 'Spectre'],
    ['\\chi_{#?}', 'Polynôme caractéristique', '\\chi_{A}'], ['\\operatorname{id}', 'Identité'], ['\\deg', 'Degré'],
    ['\\oplus', 'Somme directe'], ['\\otimes', 'Produit tensoriel'], ['\\left\\langle #?,#?\\right\\rangle', 'Produit scalaire', '\\langle u,v\\rangle'], ['#@^{\\perp}', 'Orthogonal', 'F^{\\perp}'],
    ['\\operatorname{pgcd}', 'PGCD'], ['\\operatorname{ppcm}', 'PPCM'], ['#@\\wedge #?', 'PGCD (notation ∧)', 'a\\wedge b'], ['#@\\vee #?', 'PPCM (notation ∨)', 'a\\vee b'],
    ['\\mathrm{Re}', 'Partie réelle'], ['\\mathrm{Im}', 'Partie imaginaire'], ['\\arg', 'Argument'], ['\\mathrm{e}^{\\mathrm{i}#?}', 'Exponentielle complexe', '\\mathrm{e}^{\\mathrm{i}\\theta}'],
    ['\\mathbb{P}\\left(#?\\right)', 'Probabilité', '\\mathbb{P}(A)'], ['\\mathbb{P}_{#?}\\left(#?\\right)', 'Probabilité conditionnelle', '\\mathbb{P}_{B}(A)'],
    ['\\mathbb{E}\\left(#?\\right)', 'Espérance', '\\mathbb{E}(X)'], ['\\mathbb{V}\\left(#?\\right)', 'Variance', '\\mathbb{V}(X)'], ['\\operatorname{Cov}\\left(#?,#?\\right)', 'Covariance', '\\operatorname{Cov}(X,Y)'],
    ['\\sigma', 'Écart-type'], ['#@\\sim \\mathcal{B}\\left(#?,#?\\right)', 'Loi binomiale', 'X\\sim\\mathcal{B}(n,p)'], ['\\mathcal{N}\\left(#?,#?\\right)', 'Loi normale', '\\mathcal{N}(\\mu,\\sigma^2)'],
    ['\\mathcal{U}\\left(#?\\right)', 'Loi uniforme', '\\mathcal{U}(E)'], ['\\mathcal{G}\\left(#?\\right)', 'Loi géométrique', '\\mathcal{G}(p)'], ['\\mathcal{P}\\left(#?\\right)', 'Loi de Poisson', '\\mathcal{P}(\\lambda)'],
  ]},
  { name: 'Matrices & systèmes', items: [
    ['@matrix', 'Matrice de n\'importe quelle taille…', '\\begin{pmatrix}\\cdot&\\cdots&\\cdot\\\\\\vdots&&\\vdots\\\\\\cdot&\\cdots&\\cdot\\end{pmatrix}'],
    ['@row+', 'Ajouter une ligne (sous le curseur)'], ['@col+', 'Ajouter une colonne (à droite du curseur)'], ['@row-', 'Supprimer la ligne du curseur'], ['@col-', 'Supprimer la colonne du curseur'],
    ['\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}', 'Matrice 2×2', '\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}'],
    ['\\begin{pmatrix}#?&#?&#?\\\\#?&#?&#?\\\\#?&#?&#?\\end{pmatrix}', 'Matrice 3×3', '\\begin{pmatrix}\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\end{pmatrix}'],
    ['\\begin{pmatrix}a_{11}&\\cdots&a_{1p}\\\\\\vdots&\\ddots&\\vdots\\\\a_{n1}&\\cdots&a_{np}\\end{pmatrix}', 'Matrice n×p générale', '\\begin{pmatrix}a_{11}&\\cdots&a_{1p}\\\\\\vdots&\\ddots&\\vdots\\\\a_{n1}&\\cdots&a_{np}\\end{pmatrix}'],
    ['\\begin{pmatrix}#?&&0\\\\&\\ddots&\\\\0&&#?\\end{pmatrix}', 'Matrice diagonale', '\\begin{pmatrix}\\lambda_1&&0\\\\&\\ddots&\\\\0&&\\lambda_n\\end{pmatrix}'],
    ['\\begin{bmatrix}#?&#?\\\\#?&#?\\end{bmatrix}', 'Matrice entre crochets', '\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}'],
    ['\\begin{pmatrix}#?\\\\#?\\end{pmatrix}', 'Vecteur colonne 2', '\\begin{pmatrix}x\\\\y\\end{pmatrix}'],
    ['\\begin{pmatrix}#?\\\\#?\\\\#?\\end{pmatrix}', 'Vecteur colonne 3', '\\begin{pmatrix}x\\\\y\\\\z\\end{pmatrix}'],
    ['\\begin{pmatrix}#?&#?&#?\\end{pmatrix}', 'Vecteur ligne', '\\begin{pmatrix}x&y&z\\end{pmatrix}'],
    ['\\begin{vmatrix}#?&#?\\\\#?&#?\\end{vmatrix}', 'Déterminant', '\\begin{vmatrix}a&b\\\\c&d\\end{vmatrix}'],
    ['\\cdots', 'Points horizontaux'], ['\\vdots', 'Points verticaux'], ['\\ddots', 'Points diagonaux'],
    ['\\begin{cases}#?&\\text{si }#?\\\\#?&\\text{sinon}\\end{cases}', 'Fonction par morceaux', '\\begin{cases}a&\\text{si}\\\\b&\\text{sinon}\\end{cases}'],
    ['\\left\\{\\begin{aligned}#?&=#?\\\\#?&=#?\\end{aligned}\\right.', 'Système d\'équations', '\\left\\{\\begin{aligned}x&=1\\\\y&=2\\end{aligned}\\right.'],
    ['\\left\\{\\begin{aligned}#?&=#?\\\\#?&=#?\\\\#?&=#?\\end{aligned}\\right.', 'Système de 3 équations', '\\left\\{\\begin{aligned}x&=1\\\\y&=2\\\\z&=3\\end{aligned}\\right.'],
    ['\\begin{aligned}#?&=#?\\\\&=#?\\end{aligned}', 'Calcul sur plusieurs lignes', '\\begin{aligned}a&=b\\\\&=c\\end{aligned}'],
    ['\\vec{#0}', 'Vecteur'], ['\\overrightarrow{#0}', 'Vecteur AB', '\\overrightarrow{AB}'], ['\\left\\|#0\\right\\|', 'Norme'],
    ['\\hat{#0}', 'Chapeau'], ['\\tilde{#0}', 'Tilde'], ['\\dot{#0}', 'Point (dérivée temporelle)'], ['\\ddot{#0}', 'Deux points'],
    ['#@^{\\mathsf{T}}', 'Transposée', 'A^{\\mathsf{T}}'], ['#@^{-1}', 'Inverse', 'A^{-1}'], ['\\mathrm{I}_{#?}', 'Matrice identité', '\\mathrm{I}_{n}'],
  ]},
  { name: 'Grec', items: 'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi pi varpi rho varrho sigma varsigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega'
      .split(' ').map(g => ['\\' + g, g]) },
  { name: 'Physique', items: [
    ['#@\\times 10^{#?}', 'Notation scientifique', 'a\\times10^{n}'], ['\\,\\mathrm{#?}', 'Unité', '\\mathrm{m}'],
    ['\\,\\mathrm{m\\cdot s^{-1}}', 'm/s', '\\mathrm{m\\cdot s^{-1}}'], ['\\,\\mathrm{m\\cdot s^{-2}}', 'm/s²', '\\mathrm{m\\cdot s^{-2}}'],
    ['\\,\\mathrm{kg}', 'kg', '\\mathrm{kg}'], ['\\,\\mathrm{N}', 'Newton', '\\mathrm{N}'], ['\\,\\mathrm{J}', 'Joule', '\\mathrm{J}'],
    ['\\,\\mathrm{W}', 'Watt', '\\mathrm{W}'], ['\\,\\mathrm{V}', 'Volt', '\\mathrm{V}'], ['\\,\\Omega', 'Ohm', '\\Omega'],
    ['\\,\\mathrm{mol\\cdot L^{-1}}', 'mol/L', '\\mathrm{mol\\cdot L^{-1}}'], ['^{\\circ}\\mathrm{C}', 'Degré Celsius', '^{\\circ}\\mathrm{C}'],
    ['\\,\\mathrm{Hz}', 'Hertz', '\\mathrm{Hz}'], ['\\,\\mathrm{Pa}', 'Pascal', '\\mathrm{Pa}'], ['\\Delta #?', 'Variation', '\\Delta t'],
    ['\\hbar', 'h barre'], ['\\ell', 'l cursif'], ['\\vec{F}', 'Force', '\\vec{F}'], ['\\sum \\vec{F} = m\\vec{a}', 'PFD', '\\sum\\vec F=m\\vec a'],
    ['\\langle #? \\rangle', 'Moyenne', '\\langle x\\rangle'], ['\\overline{#0}', 'Barre (moyenne)', '\\bar{x}'],
  ]},
];

L.CHEM_PALETTE = [
  [' -> ', 'Réaction', '\\ce{->}'], [' <=> ', 'Équilibre', '\\ce{<=>}'], ['^2+', 'Charge 2+', '\\ce{^2+}'], ['^-', 'Charge −', '\\ce{^-}'],
  ['(aq)', 'Aqueux', '\\ce{(aq)}'], ['(s)', 'Solide', '\\ce{(s)}'], ['(l)', 'Liquide', '\\ce{(l)}'], ['(g)', 'Gaz', '\\ce{(g)}'],
  [' v', 'Précipité', '\\ce{v}'], [' ^', 'Dégagement gazeux', '\\ce{^}'], [' ->[\\Delta] ', 'Chauffage', '\\ce{->[\\Delta]}'],
  ['H2O', 'Eau', '\\ce{H2O}'], ['H3O+', 'Ion oxonium', '\\ce{H3O+}'], ['HO-', 'Ion hydroxyde', '\\ce{HO-}'], ['CO2', 'CO2', '\\ce{CO2}'],
  ['e-', 'Électron', '\\ce{e-}'],
];

L.MathDock = (function () {
  const dock = () => L.$('#mathdock');
  let mf, target = null, mode = 'math', cat = 0;

  function init() {
    mf = L.$('#mf');
    if (window.MathfieldElement) {
      MathfieldElement.fontsDirectory = 'vendor/mathlive/fonts';
      MathfieldElement.soundsDirectory = null;
      MathfieldElement.plonkSound = null;
    }
    try { mf.smartFence = true; mf.smartSuperscript = true; mf.menuItems = []; } catch (e) {}
    try { mf.mathModeSpace = '\\:'; } catch (e) {}   // la touche Espace insère une espace dans la formule
    try { mf.maxMatrixCols = MX_MAX; } catch (e) {}   // matrices de plus de 10 colonnes
    mf.addEventListener('input', () => {
      const v = mf.value;
      if (!L.$('#mdLatex').hidden) L.$('#mdLatex').value = v;
      preview(v);
    });
    mf.addEventListener('keydown', e => {
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); openSymbols('math'); return; }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); ok(); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
    }, { capture: true });
    L.$('#mdLatex').addEventListener('input', e => {
      const v = e.target.value;
      const doc = L.looksLikeLatexDoc(v);
      L.$('#mdDocHint').hidden = !doc;
      if (doc) return;              // texte + formules : converti à la validation
      mf.value = v; preview(v);
    });
    L.$('#chemIn').addEventListener('input', () => chemPreview());
    L.$('#chemIn').addEventListener('keydown', e => {
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); openSymbols('chem'); return; }
      if (e.key === 'Enter') { e.preventDefault(); ok(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    L.$('#mdSym').onmousedown = e => e.preventDefault();
    L.$('#mdSym').onclick = () => openSymbols(mode === 'chem' ? 'chem' : 'math');
    L.$('#mdOk').onclick = ok;
    L.$('#mdCancel').onclick = cancel;
    L.$('#mdDel').onclick = del;
    L.$('#mdKbd').onclick = () => {
      const kb = window.mathVirtualKeyboard;
      if (!kb) return;
      mf.focus();
      kb.visible ? kb.hide() : kb.show();
    };
    L.$('#mdSrc').onclick = () => {
      const t = L.$('#mdLatex');
      t.hidden = !t.hidden;
      L.$('#mdSrc').classList.toggle('on', !t.hidden);
      if (!t.hidden) t.value = mf.value;
    };
    L.$('#mdNum').onclick = () => {
      if (!target || target.kind !== 'block') return;
      const f = L.find(App.doc, target.blockId);
      if (!f) return;
      f.block.numbered = !f.block.numbered;
      L.$('#mdNum').classList.toggle('on', f.block.numbered);
      // Numéros mis à jour partout (équations suivantes, références), formule en cours gardée
      App.commit(); App.render();
      const el = App.blockEl(target.blockId), eq = el && el.querySelector('.eq');
      if (eq) eq.classList.add('editing');
      preview(mode === 'chem' ? current() : mf.value);
    };
    L.$$('.md-mode').forEach(b => b.onclick = () => setMode(b.dataset.mode));
    buildCats();
    buildPalette();
    const cp = L.$('#chemPalette');
    L.CHEM_PALETTE.forEach(([ins, title, disp]) => {
      const b = L.h('button', { title, html: L.katex(disp) });
      b.onclick = () => { const i = L.$('#chemIn'); insertAtInput(i, ins); chemPreview(); i.focus(); };
      cp.appendChild(b);
    });
  }

  function openSymbols(context) {
    const r = dock().getBoundingClientRect();
    L.SymbolPicker.open({
      context, x: r.left + 20, y: r.top - 450, above: r.top,
      onPick: sym => {
        if (context === 'chem') { const i = L.$('#chemIn'); i.focus(); insertAtInput(i, sym.chem); chemPreview(); return; }
        mf.focus();
        mf.insert(sym.latex, { selectionMode: 'placeholder', focus: true, format: 'latex' });
        mf.dispatchEvent(new Event('input'));
      },
      onClose: picked => { if (!picked) (context === 'chem' ? L.$('#chemIn') : mf).focus(); },
    });
  }

  function insertAtInput(i, s) {
    const a = i.selectionStart ?? i.value.length, b = i.selectionEnd ?? a;
    i.value = i.value.slice(0, a) + s + i.value.slice(b);
    i.selectionStart = i.selectionEnd = a + s.length;
  }

  function buildCats() {
    const c = L.$('#mdCats');
    c.innerHTML = '';
    L.PALETTE.forEach((p, i) => {
      const b = L.h('button', { class: i === cat ? 'on' : '', text: p.name });
      b.onmousedown = e => e.preventDefault();
      b.onclick = () => { cat = i; buildCats(); buildPalette(); };
      c.appendChild(b);
    });
  }

  function insert(tpl) {
    mf.focus();
    mf.insert(tpl, { selectionMode: 'placeholder', focus: true, format: 'latex' });
    mf.dispatchEvent(new Event('input'));
  }

  // Lignes et colonnes de la matrice où se trouve le curseur
  // (fait sur le code LaTeX : les nouvelles cases apparaissent comme des cases à remplir)
  const MX_LABELS = { 'row+': '+ Ligne', 'col+': '+ Colonne', 'row-': '− Ligne', 'col-': '− Colonne' };
  const MX_ENVS = /^(?:[pbBvV]?matrix|smallmatrix|cases|dcases|rcases|aligned|gathered)$/;
  const MX_MARKS = ['\\mho', '\\Finv', '\\Game', '\\eth'];   // repère provisoire de la position du curseur
  const PH = '\\placeholder{}';

  // Environnement le plus intérieur (matrice, système…) qui contient la position « at »
  function envAt(s, at) {
    const re = /\\(begin|end)\{([a-zA-Z*]+)\}/g, stack = [];
    let best = null, m;
    while ((m = re.exec(s))) {
      if (m[1] === 'begin') { stack.push({ name: m[2], bodyStart: m.index + m[0].length }); continue; }
      const b = stack.pop();
      if (b && b.bodyStart <= at && at <= m.index && MX_ENVS.test(b.name) && (!best || b.bodyStart > best.bodyStart)) best = { name: b.name, bodyStart: b.bodyStart, bodyEnd: m.index };
    }
    return best;
  }

  // Lignes (\\) et cases (&) du premier niveau
  function splitCells(body) {
    const rows = [[]];
    let cell = '', depth = 0, env = 0;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '\\') {
        if (body[i + 1] === '\\' && !depth && !env) { rows[rows.length - 1].push(cell); rows.push([]); cell = ''; i++; continue; }
        if (body.startsWith('\\begin{', i)) env++;
        else if (body.startsWith('\\end{', i)) env--;
        cell += ch + (body[i + 1] || ''); i++;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (ch === '&' && !depth && !env) { rows[rows.length - 1].push(cell); cell = ''; continue; }
      cell += ch;
    }
    rows[rows.length - 1].push(cell);
    return rows;
  }

  function matrixCmd(act) {
    mf.focus();
    const before = mf.value, sel0 = mf.selection;
    const mark = MX_MARKS.find(m => !before.includes(m));
    const fail = msg => { mf.value = before; try { mf.selection = sel0; } catch (e) {} L.toast(msg); };
    const r0 = sel0 && sel0.ranges && sel0.ranges[0];
    if (r0) mf.position = Math.max(r0[0], r0[1]);
    mf.insert(mark, { format: 'latex' });
    const s = mf.value, at = s.indexOf(mark);
    const env = at < 0 ? null : envAt(s, at);
    if (!env) return fail('Cliquez d\'abord dans une case de la matrice (ou du système).');
    if (act[0] === 'c' && !/matrix$/.test(env.name)) return fail('Les colonnes s\'ajoutent dans une matrice. Dans un système, ajoutez plutôt des lignes.');
    const rows = splitCells(s.slice(env.bodyStart, env.bodyEnd));
    let r = rows.findIndex(x => x.some(v => v.includes(mark)));
    let c = rows[r].findIndex(v => v.includes(mark));
    rows[r][c] = rows[r][c].replace(mark, '');
    const ncols = Math.max(...rows.map(x => x.length));
    rows.forEach(x => { while (x.length < ncols) x.push(''); });
    if (act === 'row+') {
      // une colonne qui commence toujours par « = » (système) le garde dans la nouvelle ligne
      const eq = k => rows.every(x => /^\s*=/.test(x[k]));
      rows.splice(r + 1, 0, Array.from({ length: ncols }, (_, k) => eq(k) ? '=' + PH : ''));
      r++; c = 0;
    } else if (act === 'col+') {
      rows.forEach(x => x.splice(c + 1, 0, ''));
      c++;
    } else if (act === 'row-') {
      if (rows.length < 2) return fail('Il ne reste qu\'une ligne.');
      rows.splice(r, 1);
      r = Math.min(r, rows.length - 1);
    } else {
      if (ncols < 2) return fail('Il ne reste qu\'une colonne.');
      rows.forEach(x => x.splice(c, 1));
      c = Math.min(c, ncols - 2);
    }
    const cells = rows.map(x => x.map(v => v.trim() ? v : PH));
    const head = s.slice(0, env.bodyStart);
    mf.value = head + cells.map(x => x.join('&')).join('\\\\') + s.slice(env.bodyEnd);
    // Curseur dans la case visée (la nouvelle case, ou la voisine de celle supprimée)
    const count = t => (t.match(/\\placeholder/g) || []).length;
    const target = cells[r][c];
    if (count(target)) {
      const n = count(head) + cells.slice(0, r).reduce((a, x) => a + count(x.join('')), 0) + count(cells[r].slice(0, c).join('')) + 1;
      mf.executeCommand('moveToMathfieldStart');
      for (let i = 0; i < n; i++) mf.executeCommand('moveToNextPlaceholder');
    } else mf.executeCommand('moveToMathfieldEnd');
    mf.dispatchEvent(new Event('input'));
  }

  function buildPalette() {
    const p = L.$('#mdPalette');
    p.innerHTML = '';
    L.PALETTE[cat].items.forEach(([tpl, title, disp]) => {
      const act = tpl[0] === '@' ? tpl.slice(1) : null;
      let b;
      if (act === 'matrix') b = L.h('button', { class: 'txt act', title }, L.svg('grid', 15), 'Matrice n × p…');
      else if (act) b = L.h('button', { class: 'txt act', title, text: MX_LABELS[act] });
      else b = L.h('button', { title, html: L.katex(disp || tpl.replace(/#\?|#0/g, '\\square').replace(/#@/g, 'x')) });
      b.onmousedown = e => e.preventDefault();
      b.onclick = () => act === 'matrix' ? matrixPicker(b) : act ? matrixCmd(act) : insert(tpl);
      p.appendChild(b);
    });
  }

  /* Matrice de n'importe quelle taille : quadrillage à survoler, ou nombres de lignes et de colonnes */
  const MX_MAX = 40;
  const MX_DELIMS = [['pmatrix', '( )'], ['bmatrix', '[ ]'], ['vmatrix', '| |'], ['Vmatrix', '‖ ‖'], ['Bmatrix', '{ }'], ['matrix', 'Aucun']];
  const MX_FILLS = [['vide', 'Cases vides'], ['coef', 'Coefficients aᵢⱼ'], ['zero', 'Zéros'], ['id', 'Identité']];
  const mxPref = { env: 'pmatrix', fill: 'vide' };

  function matrixLatex(n, p, env, fill) {
    const sep = n > 9 || p > 9 ? ',' : '';
    const cell = (i, j) => fill === 'coef' ? 'a_{' + i + sep + j + '}' : fill === 'zero' ? '0' : fill === 'id' ? (i === j ? '1' : '0') : '#?';
    const rows = [];
    for (let i = 1; i <= n; i++) {
      const r = [];
      for (let j = 1; j <= p; j++) r.push(cell(i, j));
      rows.push(r.join('&'));
    }
    return '\\begin{' + env + '}' + rows.join('\\\\') + '\\end{' + env + '}';
  }

  function matrixPicker(anchor) {
    const old = L.$('.mxpick');
    if (old) { old.remove(); return; }
    const G = 8;
    const clamp = v => Math.min(MX_MAX, Math.max(1, parseInt(v, 10) || 1));
    const nIn = L.h('input', { type: 'number', min: 1, max: MX_MAX, value: 3 });
    const pIn = L.h('input', { type: 'number', min: 1, max: MX_MAX, value: 3 });
    const size = L.h('div', { class: 'mx-size', text: '3 × 3' });
    const grid = L.h('div', { class: 'mx-grid' });
    const cells = [];
    const mark = (n, p) => {
      cells.forEach(c => c.classList.toggle('on', c._i <= n && c._j <= p));
      size.textContent = n + ' ligne' + (n > 1 ? 's' : '') + ' × ' + p + ' colonne' + (p > 1 ? 's' : '');
    };
    const done = () => { close(); insert(matrixLatex(clamp(nIn.value), clamp(pIn.value), mxPref.env, mxPref.fill)); };
    for (let i = 1; i <= G; i++) for (let j = 1; j <= G; j++) {
      const c = L.h('span');
      c._i = i; c._j = j;
      c.onmouseenter = () => { nIn.value = i; pIn.value = j; mark(i, j); };
      c.onclick = done;
      cells.push(c); grid.appendChild(c);
    }
    grid.onmouseleave = () => mark(clamp(nIn.value), clamp(pIn.value));
    [nIn, pIn].forEach(x => {
      x.oninput = () => mark(clamp(nIn.value), clamp(pIn.value));
      x.onkeydown = e => {
        if (e.key === 'Enter') { e.preventDefault(); done(); }
        if (e.key === 'Escape') { e.preventDefault(); close(); mf.focus(); }
      };
    });
    const seg = (list, key) => {
      const s = L.h('div', { class: 'mx-seg' });
      list.forEach(([v, label]) => {
        const b = L.h('button', { type: 'button', class: mxPref[key] === v ? 'on' : '', text: label });
        b.onclick = () => { mxPref[key] = v; [...s.children].forEach(x => x.classList.toggle('on', x === b)); };
        s.appendChild(b);
      });
      return s;
    };
    const ins = L.h('button', { type: 'button', class: 'btn primary', text: 'Insérer' });
    ins.onclick = done;
    const box = L.h('div', { class: 'mxpick', onmousedown: e => { if (!e.target.closest('input')) e.preventDefault(); } }, [
      L.h('div', { class: 'mx-title', text: 'Insérer une matrice' }),
      grid, size,
      L.h('div', { class: 'mx-nums' }, [
        L.h('label', {}, ['Lignes', nIn]), L.h('span', { text: '×' }), L.h('label', {}, ['Colonnes', pIn]), ins,
      ]),
      L.h('div', { class: 'mx-lbl', text: 'Délimiteurs' }), seg(MX_DELIMS, 'env'),
      L.h('div', { class: 'mx-lbl', text: 'Contenu' }), seg(MX_FILLS, 'fill'),
      L.h('div', { class: 'mx-tip', text: 'Ensuite, cliquez dans une case puis sur « + Ligne » ou « + Colonne » pour agrandir la matrice.' }),
    ]);
    mark(3, 3);
    document.body.appendChild(box);
    const r = anchor.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(r.left, window.innerWidth - box.offsetWidth - 8)) + 'px';
    box.style.top = Math.max(8, r.top - box.offsetHeight - 6) + 'px';
    const outside = e => { if (!box.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) close(); };
    const esc = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); mf.focus(); } };
    function close() {
      box.remove();
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('keydown', esc, true);
    }
    setTimeout(() => {
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', esc, true);
    });
  }

  function setMode(m) {
    mode = m;
    L.$$('.md-mode').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    L.$('.md-math').hidden = m !== 'math';
    L.$('.md-chem').hidden = m !== 'chem';
    L.$('#mdKbd').hidden = m !== 'math';
    L.$('#mdSrc').hidden = m !== 'math';
    if (m === 'chem') { chemPreview(); setTimeout(() => L.$('#chemIn').focus(), 30); }
    else { preview(mf.value); setTimeout(() => mf.focus(), 30); }
  }

  function chemPreview() {
    const v = L.$('#chemIn').value.trim();
    const latex = v ? '\\ce{' + v + '}' : '';
    L.$('#chemPrev').innerHTML = latex ? L.katex(latex) : '<span style="color:#aaa;font:13px var(--ui)">Aperçu</span>';
    preview(latex);
  }

  function current() {
    if (mode === 'chem') { const v = L.$('#chemIn').value.trim(); return v ? '\\ce{' + v + '}' : ''; }
    return L.cleanLatex(mf.value);
  }

  function preview(latex) {
    if (!target) return;
    latex = L.cleanLatex(latex);
    if (target.kind === 'inline') {
      target.chip.dataset.latex = latex;
      target.chip.innerHTML = latex ? L.katex(latex) : '<span class="chip-empty">formule</span>';
    } else {
      const el = App.blockEl(target.blockId);
      const body = el && el.querySelector('.eq-body');
      if (body) body.innerHTML = latex ? L.katex(L.displayLatex(latex), true) : '<span class="eq-empty">Saisissez votre équation ci-dessous</span>';
    }
  }

  /* target = { kind:'inline', chip, isNew } | { kind:'block', blockId, isNew } */
  function open(t) {
    if (target) finish(false);
    target = t;
    const latex = t.kind === 'inline' ? (t.chip.dataset.latex || '') : ((L.find(App.doc, t.blockId) || {}).block || {}).latex || '';
    t.original = latex;
    const isChem = /^\\ce\{/.test(latex);
    L.$('#chemIn').value = isChem ? latex.replace(/^\\ce\{/, '').replace(/\}$/, '') : '';
    mf.value = isChem ? '' : latex;
    L.$('#mdLatex').value = mf.value;
    L.$('#mdTitle').textContent = t.kind === 'inline' ? 'Formule dans le texte' : 'Équation centrée';
    const numBtn = L.$('#mdNum');
    numBtn.hidden = t.kind !== 'block';
    if (t.kind === 'block') numBtn.classList.toggle('on', !!L.find(App.doc, t.blockId).block.numbered);
    L.$$('.editing').forEach(x => x.classList.remove('editing'));
    if (t.kind === 'inline') t.chip.classList.add('editing');
    else { const el = App.blockEl(t.blockId); if (el) el.querySelector('.eq').classList.add('editing'); }
    dock().hidden = false;
    setMode(isChem ? 'chem' : 'math');
    if (t.template) setTimeout(() => {
      mf.value = '';
      mf.focus();
      mf.insert(t.template, { selectionMode: 'placeholder', focus: true, format: 'latex' });
      mf.dispatchEvent(new Event('input'));
    }, 60);
    const anchor = t.kind === 'inline' ? t.chip : App.blockEl(t.blockId);
    if (anchor) setTimeout(() => {
      const r = anchor.getBoundingClientRect(), dh = dock().offsetHeight;
      // (l'éditeur est posé au-dessus de la barre d'état : 38 px du bas)
      if (r.bottom > window.innerHeight - dh - 54) L.$('#desk').scrollBy({ top: r.bottom - (window.innerHeight - dh - 84), behavior: 'smooth' });
    }, 40);
  }

  function finish(commit) {
    if (!target) return;
    const t = target;
    target = null;
    if (window.mathVirtualKeyboard) try { mathVirtualKeyboard.hide(); } catch (e) {}
    dock().hidden = true;
    const mx = L.$('.mxpick'); if (mx) mx.remove();
    L.$$('.editing').forEach(x => x.classList.remove('editing'));
    if (t.kind === 'inline') {
      const latex = commit ? t.chip.dataset.latex : t.original;
      if (!latex) { const host = t.chip.closest('[data-f]'); t.chip.remove(); if (host) App.syncField(host); }
      else {
        t.chip.dataset.latex = latex;
        t.chip.innerHTML = L.katex(latex);
        const host = t.chip.closest('[data-f]');
        if (host) App.syncField(host);
        if (commit) App.placeCaretAfter(t.chip);
      }
      App.commit();
    } else {
      const f = L.find(App.doc, t.blockId);
      if (!f) return;
      if (commit) {
        f.block.latex = t.latexNow;
        App.commit();
        App.render();
      } else if (t.isNew && !t.original) {
        App.removeBlock(t.blockId);
      } else {
        App.render();
      }
    }
  }

  function ok() {
    if (!target) return;
    // Du texte LaTeX complet (phrases + formules) a été collé : on le convertit en blocs
    const raw = !L.$('#mdLatex').hidden ? L.$('#mdLatex').value : mf.value;
    if (mode === 'math' && L.looksLikeLatexDoc(raw)) {
      const t = target;
      target = null;
      dock().hidden = true;
      if (window.mathVirtualKeyboard) try { mathVirtualKeyboard.hide(); } catch (e) {}
      if (t.kind === 'block') App.insertLatex(raw, { replace: t.blockId });
      else {
        const host = t.chip.closest('[data-f]'), blk = t.chip.closest('.blk');
        t.chip.remove(); if (host) App.syncField(host);
        App.insertLatex(raw, { after: blk ? blk.dataset.id : null });
      }
      return;
    }
    const latex = current();
    preview(latex);
    target.latexNow = latex;
    if (target.kind === 'inline') target.chip.dataset.latex = latex;
    finish(true);
  }
  function cancel() { finish(false); }
  function del() {
    if (!target) return;
    const t = target;
    if (t.kind === 'inline') { preview(''); t.latexNow = ''; t.chip.dataset.latex = ''; finish(true); }
    else { target = null; dock().hidden = true; App.removeBlock(t.blockId); }
  }

  return { init, open, ok, cancel, isOpen: () => !!target, symbols: () => openSymbols(mode === 'chem' ? 'chem' : 'math') };
})();
