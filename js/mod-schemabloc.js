/* Module complémentaire « Schémas-blocs » (sciences de l'ingénieur) : schémas
   d'asservissement et chaînes fonctionnelles construits à la souris. Une fois installé,
   le menu Insérer propose « Schéma-bloc ». Les schémas déjà présents dans un document
   restent affichés et exportés sans le module ; il faut le module pour les modifier.
   Modèle : js/schemabloc.js — éditeur : js/schemabloc-ui.js */
(function () {
  const ID = 'schemabloc';
  const ic = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

  function preview() {
    const fig = L.h('div', { class: 'mk-prev-fig' });
    try {
      const r = L.TikZ.render(L.newSchemaBloc('capteur').code, { fontSize: 11 });
      if (r.svg) fig.appendChild(r.svg);
    } catch (e) { /* aperçu facultatif */ }
    return L.h('div', { class: 'mk-prev', 'aria-hidden': 'true' },
      L.h('div', { class: 'mk-prev-page' },
        L.h('div', { class: 'mk-prev-h', text: 'II. Modélisation de l\'asservissement' }),
        L.h('div', { class: 'mk-prev-p' }), L.h('div', { class: 'mk-prev-p s' }),
        L.h('div', { class: 'mk-prev-code mk-prev-draw' }, L.h('span', { class: 'mk-prev-run alt', html: ic('<path d="M4 20l4-1 11-11-3-3L5 16z"/>') + 'Modifier à la souris' }), fig)));
  }

  L.Modules.register({
    id: ID,
    name: 'Schémas-blocs',
    version: '1.0.0',
    author: 'LaTeX Home Edition',
    official: true,
    category: 'Sciences de l\'ingénieur',
    tags: ['SII', 'Asservissement', 'Automatique'],
    colors: ['#d0703c', '#8a4fb0'],
    icon: '<rect x="2.5" y="8.5" width="6.5" height="7" rx="1"/><circle cx="15.5" cy="12" r="3"/><path d="M9 12h3.5M18.5 12h3M15.5 15v3.5H5.7v-3"/>',
    tagline: 'Schémas d\'asservissement et chaînes fonctionnelles construits à la souris : blocs, comparateurs, flèches et fonctions de transfert.',
    description: '<p>Posez des blocs et des comparateurs, tirez les flèches d\'un élément à l\'autre : elles se tracent toutes seules, à angle droit, en contournant les blocs. Les fonctions de transfert s\'écrivent comme des formules (fractions, indices, lettres grecques).</p>'
      + '<p>Boucle fermée, retour avec capteur, perturbation, boucles imbriquées, chaînes d\'information et d\'énergie : partez d\'un modèle et adaptez-le. Le schéma s\'exporte en LaTeX (TikZ) et en PDF comme le reste du document.</p>',
    features: [
      [ic('<rect x="3" y="7" width="18" height="10" rx="1"/><path d="M8 12h8"/>'), 'Blocs et comparateurs', 'Fonctions de transfert en formules, signes + et − réglables d\'un clic.'],
      [ic('<path d="M3 12h6v-6h12M17.5 2.5L21 6l-3.5 3.5"/>'), 'Flèches automatiques', 'Tirées à la souris, tracées à angle droit, déplaçables segment par segment.'],
      [ic('<path d="M2 11h20M12 11v10"/><circle cx="12" cy="11" r="2.4" fill="currentColor"/>'), 'Boucles de retour', 'Double-clic sur une flèche pour un point de prélèvement, puis tirez la boucle.'],
      [ic('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'), 'Modèles prêts', 'Boucle fermée, capteur, perturbation, boucles imbriquées, chaîne fonctionnelle.'],
      [ic('<rect x="3" y="5" width="18" height="14" rx="1" stroke-dasharray="3 2.6"/>'), 'Cadres et textes', 'Regroupez une partie commande ou opérative dans un cadre en pointillés.'],
      ['insert', 'Export TikZ', 'Code LaTeX propre, identique dans le PDF.'],
    ],
    steps: [
      'Menu <b>Insérer</b> → <b>Schéma-bloc</b> (ou tapez « / schéma » sur une ligne vide).',
      'Choisissez un modèle ou partez de zéro ; ajoutez blocs et comparateurs avec la colonne de gauche.',
      'Survolez un élément et tirez depuis ses points bleus pour le relier ; double-clic pour écrire une formule.',
      'Cliquez sur <b>Insérer le schéma</b>. Un clic sur le schéma, dans le document, le rouvre.',
    ],
    compat: 'Application de bureau et version web',
    size: 'Inclus dans l\'application',
    updated: '14 novembre 2026',
    privacy: 'Les schémas restent dans vos documents, sur votre ordinateur. Rien n\'est envoyé sur Internet.',
    installedText: 'Le menu <b>Insérer</b> propose maintenant <b>Schéma-bloc</b>, et les schémas de vos documents se modifient de nouveau à la souris.',
    sample: () => L.newSchemaBloc('capteur'),
    afterSample: b => { const f = L.find(App.doc, b.id); if (f) App.editDrawing(f.block); },
    usesLabel: n => n > 1 ? n + ' schémas à créer ou modifier' : n + ' schéma à créer ou modifier',
    preview,
  });
})();
