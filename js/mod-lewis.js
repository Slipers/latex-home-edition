/* Module complémentaire « Schémas de Lewis » (chimie) : molécules et ions construits à la
   souris, doublets non liants, électrons célibataires, lacunes et charges formelles calculés
   automatiquement. Une fois installé, le menu Insérer propose « Schéma de Lewis ». Les schémas
   déjà présents dans un document restent affichés et exportés sans le module ; il faut le
   module pour les modifier. Modèle : js/lewis.js — éditeur : js/lewis-ui.js */
(function () {
  const ID = 'lewis';
  const ic = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

  /* Illustration de la fiche : une page avec les formes mésomères de l'ozone */
  function preview() {
    const fig = L.h('div', { class: 'mk-prev-fig' });
    try {
      const t = L.LW.TEMPLATES.find(x => x.key === 'ozone');
      const r = L.TikZ.render(L.LW.toTikz(L.LW.repair(t.make())), { fontSize: 11 });
      if (r.svg) fig.appendChild(r.svg);
    } catch (e) { /* aperçu facultatif */ }
    return L.h('div', { class: 'mk-prev', 'aria-hidden': 'true' },
      L.h('div', { class: 'mk-prev-page' },
        L.h('div', { class: 'mk-prev-h', text: 'II. Formes mésomères de l\'ozone' }),
        L.h('div', { class: 'mk-prev-p' }), L.h('div', { class: 'mk-prev-p s' }),
        L.h('div', { class: 'mk-prev-code mk-prev-draw' }, L.h('span', { class: 'mk-prev-run alt', html: ic('<path d="M4 20l4-1 11-11-3-3L5 16z"/>') + 'Modifier à la souris' }), fig)));
  }

  L.Modules.register({
    id: ID,
    name: 'Schémas de Lewis',
    version: '1.1.0',
    author: 'LaTeX Home Edition',
    official: true,
    category: 'Chimie',
    tags: ['Chimie', 'Lewis', 'Mésomérie', 'Résonance'],
    colors: ['#c2185b', '#6a4fb0'],
    icon: '<path d="M8.6 15.8l2.4-7.6 2.4 7.6M9.5 13.2h3"/><path d="M8 5.2h6M4.8 9v5.2M17.2 9v5.2"/><path d="M8 19h6"/>',
    tagline: 'Molécules et ions dessinés à la souris : liaisons, doublets non liants, lacunes et charges formelles placés tout seuls, octet vérifié.',
    description: '<p>Posez les atomes, tirez les liaisons simples, doubles ou triples : les <b>doublets non liants</b>, les <b>électrons célibataires</b> et les <b>lacunes</b> se calculent à partir des électrons de valence, des liaisons et des charges formelles, puis se placent dans les espaces libres autour de chaque atome, comme dans les manuels.</p>'
      + '<p>Le module compte les électrons de valence, vérifie le duet et l\'octet, signale une charge formelle incohérente ou une hypervalence. Flèches de mésomérie, flèches courbes de mouvement des doublets et textes complètent le schéma ; à partir des formes mésomères, le module construit l\'<b>hybride de résonance</b> (liaisons délocalisées en pointillés, charges partielles). Le schéma s\'exporte en LaTeX (TikZ) et en PDF comme le reste du document.</p>',
    features: [
      [ic('<circle cx="7" cy="12" r="3.2"/><circle cx="17" cy="12" r="3.2"/><path d="M10.2 10.8h3.6M10.2 13.2h3.6"/>'), 'Atomes et liaisons', 'Éléments courants en un clic, liaisons tirées d\'un atome à l\'autre, angles réguliers.'],
      [ic('<path d="M8 5h8"/><path d="M9 18.5l3-8 3 8M10 16h4"/>'), 'Doublets automatiques', 'Doublets non liants, électrons célibataires et lacunes calculés et bien placés.'],
      [ic('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'), 'Charges formelles', 'Entourées ⊕ ⊖ ou simples, déplaçables autour de l\'atome.'],
      [ic('<path d="M5 13l4 4L19 7"/>'), 'Vérification', 'Électrons de valence comptés, duet et octet vérifiés, hypervalence signalée.'],
      [ic('<path d="M4 17C6 7 15 5 19 12"/><path d="M19.6 7.4L19 12l-4.4-1.4"/>'), 'Mésomérie et hybride', 'Flèches ↔ et courbes ; hybride de résonance construit à partir des formes : liaisons en pointillés, charges −½ ou δ−.'],
      [ic('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'), 'Molécules prêtes', 'Eau, ammoniac, CO₂, ions oxonium, nitrate, sulfate, BF₃, ozone ; carbonate et benzène avec leur hybride…'],
    ],
    steps: [
      'Menu <b>Insérer</b> → <b>Schéma de Lewis</b> (ou tapez « / lewis » sur une ligne vide).',
      'Partez d\'une molécule toute faite, ou choisissez un élément à gauche et cliquez sur la feuille.',
      'Avec <b>Simple</b>, <b>Double</b> ou <b>Triple</b>, tirez d\'un atome vers un autre (ou dans le vide pour un nouvel atome). Ajoutez les charges avec <b>Charge +</b> et <b>Charge −</b> : les doublets suivent.',
      'Cliquez sur <b>Insérer le schéma</b>. Un clic sur le schéma, dans le document, le rouvre.',
    ],
    compat: 'Application de bureau et version web',
    size: 'Inclus dans l\'application',
    updated: '21 novembre 2026',
    privacy: 'Les schémas restent dans vos documents, sur votre ordinateur. Rien n\'est envoyé sur Internet.',
    installedText: 'Le menu <b>Insérer</b> propose maintenant <b>Schéma de Lewis</b> (ou tapez « / lewis » sur une ligne vide).',
    sample: () => L.newLewis('eau'),
    afterSample: b => { const f = L.find(App.doc, b.id); if (f) App.editDrawing(f.block); },
    usesLabel: n => n > 1 ? n + ' schémas à créer ou modifier' : n + ' schéma à créer ou modifier',
    preview,
  });
})();
