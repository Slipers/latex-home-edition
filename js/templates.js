/* Modèles de départ */
(function () {
  const B = L.newBlock;
  const P = (html, o = {}) => B('paragraph', Object.assign({ html }, o));
  const H = (level, html, o = {}) => B('heading', Object.assign({ level, html }, o));
  const E = (latex, numbered = true) => B('equation', { latex, numbered });
  const M = latex => '<span class="imath" data-latex="' + L.escHtml(latex) + '"></span>';
  const LI = (style, items) => B('list', { style, items: items.map(x => typeof x === 'string' ? { html: x, level: 0 } : { html: x[1], level: x[0] }) });
  const BOX = (kind, children, title = '') => B('box', { kind, title, children: children.map(c => typeof c === 'string' ? P(c) : c) });
  const doc = (meta, blocks, bib = []) => ({ meta: Object.assign(L.defaultMeta(), meta), blocks, bib, assets: {} });

  L.TEMPLATES = [
    {
      id: 'vierge', icon: '▭', name: 'Document vierge',
      desc: 'Une page blanche avec un titre. Idéal pour partir de zéro.',
      make: () => doc({ title: '', author: '' }, [P('')]),
    },
    {
      id: 'tp', icon: '⚗', name: 'Compte rendu de TP',
      desc: 'Page de garde, sommaire, protocole, tableau de mesures, figure, exploitation et conclusion.',
      make: () => {
        const eqOhm = E('U = R\\,I');
        const tab = B('table', {
          head: true, style: 'pro', align: ['c', 'c', 'c'], caption: 'Mesures de la tension et de l\'intensité',
          rows: [['Mesure', 'Intensité ' + M('I') + ' (mA)', 'Tension ' + M('U') + ' (V)'],
            ['1', '10,0', '1,02'], ['2', '20,0', '2,01'], ['3', '30,0', '2,99'], ['4', '40,0', '4,03']],
        });
        const fig = B('figure', { width: 70, caption: 'Caractéristique ' + M('U = f(I)') + ' du conducteur ohmique' });
        const eqR = E('R = \\frac{\\Delta U}{\\Delta I} \\approx 100\\,\\Omega');
        const d = doc({
          title: 'Vérification de la loi d\'Ohm', subtitle: 'Compte rendu de travaux pratiques',
          author: 'Prénom Nom', institution: 'Lycée / Université — Physique', titleStyle: 'pagegarde', toc: true,
        }, [
          BOX('resume', ['Ce compte rendu présente l\'étude expérimentale d\'un conducteur ohmique. Nous mesurons la tension à ses bornes en fonction de l\'intensité qui le traverse afin de vérifier la loi d\'Ohm et de déterminer sa résistance.']),
          H(1, 'Objectifs'),
          P('L\'objectif de cette séance est de vérifier expérimentalement la relation de proportionnalité entre la tension ' + M('U') + ' et l\'intensité ' + M('I') + ' pour un conducteur ohmique, puis d\'en déduire la valeur de sa résistance ' + M('R') + '.'),
          H(1, 'Principe théorique'),
          P('Pour un conducteur ohmique, la tension à ses bornes est proportionnelle à l\'intensité du courant qui le traverse :'),
          eqOhm,
          P('où ' + M('U') + ' s\'exprime en volts, ' + M('I') + ' en ampères et ' + M('R') + ' en ohms<span class="fn" data-text="Du nom du physicien allemand Georg Simon Ohm (1789-1854)."></span>. La relation <span class="xref" data-ref="' + eqOhm.id + '"></span> montre que la caractéristique ' + M('U=f(I)') + ' est une droite passant par l\'origine.'),
          H(1, 'Matériel et protocole'),
          H(2, 'Matériel utilisé'),
          LI('bullet', ['un générateur de tension continue réglable ;', 'un conducteur ohmique de résistance inconnue ;', 'deux multimètres (voltmètre et ampèremètre) ;', 'des fils de connexion.']),
          H(2, 'Protocole'),
          LI('number', ['Réaliser le montage en série du générateur, de la résistance et de l\'ampèremètre.', 'Brancher le voltmètre en dérivation aux bornes de la résistance.', 'Faire varier la tension du générateur et relever les couples ' + M('(I, U)') + '.']),
          H(1, 'Résultats'),
          P('Les mesures obtenues sont regroupées dans la table <span class="xref" data-ref="' + tab.id + '"></span>.'),
          tab,
          P('La figure <span class="xref" data-ref="' + fig.id + '"></span> représente la tension en fonction de l\'intensité. (Cliquez sur le cadre pour ajouter votre graphique.)'),
          fig,
          H(1, 'Exploitation'),
          P('Les points sont alignés sur une droite passant par l\'origine, ce qui valide la loi d\'Ohm. Le coefficient directeur donne :'),
          eqR,
          P('Cette valeur est cohérente avec l\'indication du fabricant ' + M('R_{\\text{th}} = 100\\,\\Omega \\pm 5\\,\\%') + '.'),
          H(1, 'Conclusion'),
          P('L\'expérience a permis de vérifier la loi d\'Ohm et de déterminer la résistance du dipôle étudié avec une bonne précision. Les écarts proviennent principalement de l\'incertitude des appareils de mesure.'),
          B('bibliography'),
        ], [
          { id: 'ohm1827', authors: 'G. S. Ohm', title: 'Die galvanische Kette, mathematisch bearbeitet', source: 'T. H. Riemann, Berlin', year: '1827', url: '' },
        ]);
        return d;
      },
    },
    {
      id: 'exos', icon: '✎', name: 'Feuille d\'exercices',
      desc: 'En-tête de fiche, exercices numérotés avec questions, équations et corrigés.',
      make: () => doc({
        title: 'Feuille d\'exercices n° 1', subtitle: 'Suites et fonctions', institution: 'Mathématiques — Terminale', titleStyle: 'fiche', author: '',
      }, [
        BOX('exercice', [
          P('On considère la suite ' + M('(u_n)') + ' définie par ' + M('u_0 = 1') + ' et, pour tout ' + M('n\\in\\mathbb{N}') + ',', { noindent: true }),
          E('u_{n+1} = \\frac{1}{2}u_n + 3.', false),
          LI('number', ['Calculer ' + M('u_1') + ' et ' + M('u_2') + '.', 'On pose ' + M('v_n = u_n - 6') + '. Montrer que ' + M('(v_n)') + ' est géométrique.', 'En déduire l\'expression de ' + M('u_n') + ' en fonction de ' + M('n') + '.', 'Déterminer ' + M('\\displaystyle\\lim_{n\\to+\\infty} u_n') + '.']),
        ], 'Suite arithmético-géométrique'),
        BOX('exercice', [
          P('Soit ' + M('f') + ' la fonction définie sur ' + M('\\mathbb{R}') + ' par ' + M('f(x) = (x^2 - 3x)\\,\\mathrm{e}^{x}') + '.', { noindent: true }),
          LI('number', [
            'Étudier les limites de ' + M('f') + ' en ' + M('-\\infty') + ' et en ' + M('+\\infty') + '.',
            'Calculer la dérivée ' + M('f\'') + '.',
            [1, 'Montrer que ' + M('f\'(x) = (x^2 - x - 3)\\,\\mathrm{e}^{x}') + '.'],
            [1, 'En déduire le tableau de variations de ' + M('f') + '.'],
            'Calculer l\'intégrale suivante :',
          ]),
          E('I = \\int_{0}^{1} x\\,\\mathrm{e}^{x}\\,\\mathrm{d}x', false),
        ], 'Étude de fonction'),
        BOX('solution', [
          P('Par intégration par parties avec ' + M('u = x') + ' et ' + M('v\' = \\mathrm{e}^x') + ' :'),
          E('I = \\left[x\\,\\mathrm{e}^{x}\\right]_0^1 - \\int_0^1 \\mathrm{e}^{x}\\,\\mathrm{d}x = \\mathrm{e} - (\\mathrm{e} - 1) = 1.', false),
        ]),
        BOX('exercice', [
          P('Résoudre dans ' + M('\\mathbb{R}^2') + ' le système suivant :', { noindent: true }),
          E('\\left\\{\\begin{aligned}2x + 3y &= 7\\\\ x - y &= 1\\end{aligned}\\right.', false),
        ]),
      ]),
    },
    {
      id: 'cours', icon: '∫', name: 'Cours de mathématiques',
      desc: 'Définitions, théorèmes, démonstrations, exemples et remarques numérotés automatiquement.',
      make: () => {
        const th = BOX('theoreme', [P('Soit ' + M('f') + ' une fonction continue sur un intervalle ' + M('[a,b]') + '. Alors ' + M('f') + ' admet des primitives sur ' + M('[a,b]') + ' et, pour toute primitive ' + M('F') + ' de ' + M('f') + ','),
          E('\\int_a^b f(x)\\,\\mathrm{d}x = F(b) - F(a).')], 'fondamental de l\'analyse');
        return doc({ title: 'Intégration', subtitle: 'Chapitre 5', author: 'Prénom Nom', date: L.todayFr(), toc: false }, [
          H(1, 'Primitives'),
          BOX('definition', [P('Soit ' + M('f') + ' une fonction définie sur un intervalle ' + M('I') + '. On appelle <i>primitive</i> de ' + M('f') + ' sur ' + M('I') + ' toute fonction ' + M('F') + ' dérivable sur ' + M('I') + ' telle que ' + M('F\' = f') + '.')]),
          BOX('exemple', [P('La fonction ' + M('x \\mapsto \\frac{x^3}{3}') + ' est une primitive de ' + M('x \\mapsto x^2') + ' sur ' + M('\\mathbb{R}') + '.')]),
          BOX('proposition', [P('Deux primitives d\'une même fonction sur un intervalle diffèrent d\'une constante.')]),
          H(1, 'Intégrale d\'une fonction continue'),
          th,
          BOX('preuve', [P('Posons ' + M('G(x) = \\int_a^x f(t)\\,\\mathrm{d}t') + '. On montre que ' + M('G') + ' est dérivable de dérivée ' + M('f') + ', donc ' + M('F - G') + ' est constante sur ' + M('[a,b]') + '. On conclut en évaluant en ' + M('a') + ' et en ' + M('b') + '.')]),
          BOX('remarque', [P('Le théorème <span class="xref" data-ref="' + th.id + '"></span> ramène le calcul d\'une intégrale à la recherche d\'une primitive.')]),
          H(2, 'Propriétés'),
          P('Pour toutes fonctions ' + M('f, g') + ' continues sur ' + M('[a,b]') + ' et tous réels ' + M('\\lambda, \\mu') + ' :'),
          E('\\int_a^b \\left(\\lambda f + \\mu g\\right) = \\lambda\\int_a^b f + \\mu \\int_a^b g'),
        ]);
      },
    },
    {
      id: 'article', icon: '¶', name: 'Article scientifique',
      desc: 'Résumé, sections, citations, notes de bas de page et bibliographie.',
      make: () => doc({ title: 'Titre de l\'article', author: 'Auteur 1, Auteur 2', institution: 'Laboratoire, Université', toc: false }, [
        BOX('resume', ['Résumé de l\'article en quelques phrases : contexte, méthode, principaux résultats et conclusion.']),
        H(1, 'Introduction'),
        P('Présentez le contexte et la problématique. Citez les travaux antérieurs <span class="cite" data-ref="knuth84"></span>, puis annoncez le plan de l\'article.'),
        H(1, 'Méthodes'),
        P('Décrivez votre démarche. Les équations se numérotent automatiquement :'),
        E('E = mc^2'),
        H(1, 'Résultats'),
        P('Présentez vos résultats sous forme de tableaux et de figures<span class="fn" data-text="Les données brutes sont disponibles sur demande."></span>.'),
        H(1, 'Discussion'),
        P('Interprétez les résultats et comparez-les à la littérature <span class="cite" data-ref="lamport94"></span>.'),
        H(1, 'Conclusion'),
        P('Résumez les apports et ouvrez des perspectives.'),
        B('bibliography'),
      ], [
        { id: 'knuth84', authors: 'D. E. Knuth', title: 'The TeXbook', source: 'Addison-Wesley', year: '1984', url: '' },
        { id: 'lamport94', authors: 'L. Lamport', title: 'LaTeX: A Document Preparation System', source: 'Addison-Wesley, 2e édition', year: '1994', url: '' },
      ]),
    },
    {
      id: 'controle', icon: '✓', name: 'Devoir / Contrôle',
      desc: 'En-tête avec nom et date, barème, questions numérotées avec sous-questions.',
      make: () => doc({ title: 'Devoir surveillé n° 2', subtitle: 'Durée : 1 h — Calculatrice autorisée', institution: 'Physique-Chimie — 1re', titleStyle: 'fiche' }, [
        P('<b>Nom :</b> ................................................ <b>Prénom :</b> ................................................', { noindent: true }),
        H(1, 'Mouvement d\'un projectile (8 points)', { numbered: false }),
        P('Un ballon de masse ' + M('m = 450\\,\\mathrm{g}') + ' est lancé avec une vitesse initiale ' + M('v_0 = 12\\,\\mathrm{m\\cdot s^{-1}}') + ' faisant un angle ' + M('\\alpha = 30^{\\circ}') + ' avec l\'horizontale. On néglige les frottements et on prend ' + M('g = 9{,}81\\,\\mathrm{m\\cdot s^{-2}}') + '.'),
        LI('number', ['Faire le bilan des forces s\'exerçant sur le ballon.', 'Appliquer la deuxième loi de Newton et en déduire les coordonnées du vecteur accélération.', 'Établir les équations horaires ' + M('x(t)') + ' et ' + M('y(t)') + '.', [1, 'Montrer que la trajectoire a pour équation :']]),
        E('y(x) = -\\frac{g}{2 v_0^2 \\cos^2\\alpha}\\,x^2 + x\\tan\\alpha', true),
        H(1, 'Chimie des solutions (7 points)', { numbered: false }),
        P('On dissout de l\'acide éthanoïque dans l\'eau. La réaction s\'écrit :'),
        E('\\ce{CH3COOH (aq) + H2O (l) <=> CH3COO^- (aq) + H3O+ (aq)}', false),
        LI('number', ['Identifier les deux couples acide/base mis en jeu.', 'Exprimer la constante d\'acidité ' + M('K_a') + ' du couple ' + M('\\ce{CH3COOH / CH3COO-}') + '.']),
      ]),
    },
  ];
})();
