/* Module complémentaire « TikZ visuel » : dessiner à la souris (géométrie, courbes de
   fonctions, schémas de physique) sans écrire de code. Une fois installé, le menu Insérer
   propose « Dessin à la souris ». Modèle : js/tikzdraw.js — éditeur : js/tikzdraw-ui.js */
(function () {
  const ID = 'tikzdraw';
  const ic = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

  /* Illustration de la fiche : une page avec un vrai dessin du module */
  function preview() {
    const fig = L.h('div', { class: 'mk-prev-fig' });
    try {
      const t = L.TD.TEMPLATES.find(x => x.key === 'trigo');
      const r = L.TikZ.render(L.TD.toTikz(L.TD.repair(t.make())), { fontSize: 11 });
      if (r.svg) fig.appendChild(r.svg);
    } catch (e) { /* aperçu facultatif */ }
    return L.h('div', { class: 'mk-prev', 'aria-hidden': 'true' },
      L.h('div', { class: 'mk-prev-page' },
        L.h('div', { class: 'mk-prev-h', text: 'Exercice 3 — Fonctions trigonométriques' }),
        L.h('div', { class: 'mk-prev-p' }), L.h('div', { class: 'mk-prev-p s' }),
        L.h('div', { class: 'mk-prev-code mk-prev-draw' }, L.h('span', { class: 'mk-prev-run alt', html: ic('<path d="M4 20l4-1 11-11-3-3L5 16z"/>') + 'Modifier à la souris' }), fig)));
  }

  L.Modules.register({
    id: ID,
    name: 'TikZ visuel',
    version: '1.0.0',
    author: 'LaTeX Home Edition',
    official: true,
    category: 'Dessin',
    tags: ['Géométrie', 'Fonctions', 'Physique'],
    colors: ['#2a9d8f', '#3f6bb0'],
    icon: '<path d="M3.5 19.5c3-9 6-12 8.5-6s5 4 8.5-8"/><circle cx="3.5" cy="19.5" r="1.3" fill="currentColor"/><path d="M14.5 4.5l5 0M17 2v5"/>',
    tagline: 'Dessinez figures de géométrie, courbes de fonctions et schémas de physique à la souris, sans écrire une ligne de code.',
    description: '<p>Les dessins TikZ sont superbes, mais il faut les écrire en code. Avec ce module, plus besoin : choisissez un outil (point, segment, flèche, cercle, angle, texte…), cliquez sur la feuille, puis réglez couleurs, noms et épaisseurs dans des menus.</p>'
      + '<p>Pour tracer une fonction, ajoutez un <b>repère</b> et écrivez la formule comme en maths (<i>2x² − 3</i>, <i>sin(x)</i>, <i>e^(−x)</i>…) : la courbe se dessine aussitôt, coupée proprement aux asymptotes. Le dessin reste un vrai dessin TikZ : il s\'exporte en LaTeX et en PDF exactement comme les autres.</p>',
    features: [
      [ic('<path d="M6 3l12 9.5-5.6.9 3.3 6.4-2.6 1.3-3.3-6.5L6 18.5z"/>'), 'Tout à la souris', 'Points, segments, flèches, polygones, cercles, arcs, angles, textes, quadrillages.'],
      [ic('<path d="M3 16h18M7 21V3"/><path d="M4 20c3-11 6-13 9-6s5 4 8-9"/>'), 'Courbes de fonctions', 'Repère gradué (même en π) et formule écrite comme en maths.'],
      [ic('<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'), 'Aimants', 'La souris s\'accroche à la grille et aux points déjà placés : figures justes du premier coup.'],
      [ic('<path d="M5 19h14M5 19L15 6"/><path d="M10 19a5 5 0 0 0-1.8-3.8"/>'), 'Noms et angles', 'Points nommés A, B, C… tout seuls, angles marqués (arc ou angle droit), vecteurs.'],
      [ic('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'), 'Modèles prêts', 'Parabole, sinus et cosinus, triangle, cercle trigonométrique, forces, plan incliné, lentille.'],
      ['insert', 'Vrai code TikZ', 'Export LaTeX et PDF identiques ; le code peut être repris à la main si besoin.'],
    ],
    steps: [
      'Menu <b>Insérer</b> → <b>Dessin à la souris</b> (ou tapez « / dessin » sur une ligne vide).',
      'Partez d\'un modèle ou d\'une feuille vide, choisissez un outil à gauche et cliquez sur la feuille.',
      'Cliquez un élément pour régler à droite sa couleur, son nom, son épaisseur… ; tirez ses petits carrés pour le modifier.',
      'Cliquez sur <b>Insérer le dessin</b>. Un clic sur le dessin, dans le document, le rouvre.',
    ],
    compat: 'Application de bureau et version web',
    size: 'Inclus dans l\'application',
    updated: '14 novembre 2026',
    privacy: 'Les dessins restent dans vos documents, sur votre ordinateur. Rien n\'est envoyé sur Internet.',
    installedText: 'Le menu <b>Insérer</b> propose maintenant <b>Dessin à la souris</b> (ou tapez « / dessin » sur une ligne vide).',
    sample: () => L.newTikzDraw('parabole'),
    afterSample: b => { const f = L.find(App.doc, b.id); if (f) App.editDrawing(f.block); },
    usesLabel: n => n > 1 ? n + ' dessins à créer ou modifier' : n + ' dessin à créer ou modifier',
    preview,
  });
})();
