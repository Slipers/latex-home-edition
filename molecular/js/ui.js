/* Interface : thèmes, panneaux, outils, projections, exercices et boîtes de dialogue. */
(function () {
  const D = M.dom, q = D.q, qa = D.qa, el = D.el, U = M.util;
  const UI = {};
  M.ui = UI;

  /* ══════════ Thème jour / nuit ══════════ */
  const THEMES = ['auto', 'jour', 'nuit'];
  const ICONES = { auto: '◐', jour: '☀', nuit: '☾' };
  const LIBELLES = { auto: 'Thème automatique (suit le système)', jour: 'Thème jour', nuit: 'Thème nuit' };

  UI.theme = M.store.get('theme', 'auto');
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  UI.appliquerTheme = function () {
    const racine = document.documentElement;
    racine.setAttribute('data-theme', UI.theme);
    const sombre = UI.theme === 'nuit' || (UI.theme === 'auto' && media && media.matches);
    racine.classList.toggle('nuit', !!sombre);
    const b = q('#btnTheme');
    if (b) { b.textContent = ICONES[UI.theme]; b.title = LIBELLES[UI.theme] + ' — cliquez pour changer'; }
    if (M.app && M.app.viewer) {
      const c = getComputedStyle(racine).getPropertyValue('--fond-3d').trim() || '#dfe5ec';
      M.app.viewer.setFond(c, !sombre);
    }
    M.bus.emit('theme:change', { sombre });
  };
  UI.basculerTheme = function () {
    UI.theme = THEMES[(THEMES.indexOf(UI.theme) + 1) % THEMES.length];
    M.store.set('theme', UI.theme);
    UI.appliquerTheme();
    UI.message('Thème : ' + LIBELLES[UI.theme].toLowerCase().replace('thème ', ''));
  };
  if (media && media.addEventListener) media.addEventListener('change', () => { if (UI.theme === 'auto') UI.appliquerTheme(); });

  /* ══════════ Barre d'état et messages ══════════ */
  let minuteurMsg = null;
  UI.message = function (txt, duree = 3200) {
    const e = q('#etatMessage');
    if (!e) return;
    e.textContent = txt || '';
    clearTimeout(minuteurMsg);
    if (txt) minuteurMsg = setTimeout(() => { e.textContent = ''; }, duree);
  };

  UI.majEtat = function () {
    const mol = M.app.doc.mol;
    q('#etatFormule').textContent = mol.atoms.length ? M.analyse.formuleBrute(mol) : '—';
    q('#etatMasse').textContent = mol.atoms.length ? 'M = ' + U.num(M.analyse.masseMolaire(mol), 2) + ' g·mol⁻¹' : '';
    const st = M.stereo.descripteurs(mol);
    q('#etatStereo').textContent = st.nom ? 'Configuration ' + st.nom : '';
    q('#docNom').textContent = mol.name || 'Sans titre';
    q('#etatVersion').textContent = 'v' + (M.VERSION_APP || M.VERSION);
  };

  /* ══════════ Boîtes de dialogue ══════════ */
  UI.dialogue = function (titre, corps, boutons) {
    q('#dlgTitre').textContent = titre;
    const c = q('#dlgCorps');
    c.innerHTML = '';
    if (typeof corps === 'string') c.innerHTML = corps; else c.append(corps);
    const pied = q('#dlgPied');
    pied.innerHTML = '';
    (boutons || [{ texte: 'Fermer', primaire: true }]).forEach(b => {
      pied.append(el('button', {
        class: b.primaire ? 'primaire' : 'secondaire',
        onclick: () => { if (!b.action || b.action() !== false) UI.fermerDialogue(); },
      }, b.texte));
    });
    q('#voile').hidden = false;
    return c;
  };
  UI.fermerDialogue = () => { q('#voile').hidden = true; };

  /* ══════════ Onglets ══════════ */
  function brancherOnglets(conteneur, attribut) {
    const c = q(conteneur);
    if (!c) return;
    c.addEventListener('click', e => {
      const b = e.target.closest('button[data-' + attribut + ']');
      if (!b) return;
      qa('button[data-' + attribut + ']', c).forEach(x => x.classList.toggle('actif', x === b));
      const parent = c.parentElement;
      qa('section[data-panneau]', parent).forEach(s => s.classList.toggle('actif', s.dataset.panneau === b.dataset[attribut]));
      M.bus.emit('onglet:' + attribut, b.dataset[attribut]);
    });
  }

  /* ══════════ Bibliothèque ══════════ */
  UI.remplirBiblio = function (filtre) {
    const zone = q('#listeBiblio');
    zone.innerHTML = '';
    const items = filtre ? M.biblio.chercher(filtre) : M.biblio.liste;
    if (!items.length) { zone.append(el('div', { class: 'vide-msg' }, 'Aucune molécule ne correspond à cette recherche.')); return; }
    let catCourante = null;
    items.forEach(e => {
      if (e.cat !== catCourante) { catCourante = e.cat; zone.append(el('div', { class: 'biblio-cat' }, e.cat)); }
      zone.append(el('button', {
        class: 'biblio-item', 'data-nom': e.nom, title: e.smiles,
        onclick: ev => { M.app.chargerBiblio(e.nom); marquerActif(ev.currentTarget); },
      }, el('b', {}, e.nom), e.note ? el('small', {}, e.note) : null));
    });
  };
  function marquerActif(btn) {
    qa('.biblio-item').forEach(b => b.classList.toggle('actif', b === btn));
  }

  /* ══════════ Tableau périodique ══════════ */
  /* Position dans la grille de 18 colonnes. Lanthanides et actinides sont reportés sur
     deux lignes séparées : La à Yb pour la ligne 9, Ac à No pour la ligne 10 ; Lu et Lr
     restent dans la colonne 3 du tableau principal. */
  function positionTP(e) {
    const f = e.group === 0 || e.Z === 57 || e.Z === 89;
    if (f) {
      const base = e.period === 6 ? 57 : 89;
      return { ligne: e.period === 6 ? 9 : 10, col: 3 + (e.Z - base) };
    }
    return { ligne: e.period, col: e.group };
  }
  UI.remplirTableauPeriodique = function () {
    const zone = q('#tableauPeriodique');
    zone.innerHTML = '';
    const cases = new Map();
    M.elements.list.forEach(e => {
      const p = positionTP(e);
      cases.set(p.ligne + ':' + p.col, e);
    });
    for (let ligne = 1; ligne <= 10; ligne++) {
      for (let col = 1; col <= 18; col++) {
        const e = cases.get(ligne + ':' + col);
        if (!e) { zone.append(el('div', { class: 'vide' })); continue; }
        zone.append(el('button', {
          class: 'f-' + e.famille, 'data-sym': e.sym,
          title: e.name + ' — Z = ' + e.Z + ' — ' + e.configCourte,
          onclick: () => UI.choisirElement(e.sym),
          onmouseenter: () => UI.ficheElement(e),
        }, e.sym));
      }
    }
    UI.ficheElement(M.elements.get(M.app.element || 'C'));
  };
  UI.ficheElement = function (e) {
    if (!e) return;
    const z = q('#ficheElement');
    z.innerHTML = '';
    z.append(
      el('b', {}, e.name + ' (' + e.sym + ')'),
      el('div', { class: 'fe-grille' },
        el('span', {}, 'Numéro atomique'), el('span', {}, 'Z = ' + e.Z),
        el('span', {}, 'Masse molaire'), el('span', {}, U.num(e.mass, 3) + ' g·mol⁻¹'),
        el('span', {}, 'Configuration'), el('span', { class: 'mono' }, e.configCourte),
        el('span', {}, 'Électrons de valence'), el('span', {}, String(e.ve)),
        el('span', {}, 'Électronégativité'), el('span', {}, e.en ? U.num(e.en, 2) + ' (Pauling)' : 'non définie'),
        el('span', {}, 'Rayon covalent'), el('span', {}, U.num(e.rcov, 2) + ' Å'),
        el('span', {}, 'Famille'), el('span', {}, M.elements.familles[e.famille] || '—'),
        el('span', {}, 'Position'), el('span', {}, (e.group ? 'colonne ' + e.group + ', ' : '') + 'période ' + e.period + ', bloc ' + e.block)));
  };
  UI.choisirElement = function (sym) {
    M.app.element = sym;
    q('#btnElement').textContent = sym;
    qa('#tableauPeriodique button').forEach(b => b.classList.toggle('actif', b.dataset.sym === sym));
    UI.ficheElement(M.elements.get(sym));
    if (M.app.outil !== 'element') M.app.setOutil('element');
    UI.message('Élément actif : ' + M.elements.get(sym).name);
  };

  /* ══════════ Fragments prêts à l'emploi ══════════ */
  const FRAGMENTS = [
    ['Méthyle', 'C'], ['Éthyle', 'CC'], ['Propyle', 'CCC'], ['Isopropyle', 'CC(C)C'],
    ['tert-Butyle', 'CC(C)(C)C'], ['Phényle', 'c1ccccc1'], ['Hydroxyle', 'O'], ['Amine', 'N'],
    ['Carbonyle', 'C=O'], ['Carboxyle', 'C(=O)O'], ['Nitrile', 'C#N'], ['Cyclohexane', 'C1CCCCC1'],
    ['Cyclopentane', 'C1CCCC1', ], ['Benzène', 'c1ccccc1'], ['Nitro', '[N+](=O)[O-]'],
  ];
  UI.remplirFragments = function () {
    const z = q('#fragments');
    z.innerHTML = '';
    FRAGMENTS.forEach(([nom, smi]) => z.append(el('button', {
      title: 'Ajouter le fragment ' + nom + ' (' + smi + ')',
      onclick: () => M.app.ajouterFragment(smi, nom),
    }, nom)));
  };

  /* ══════════ Panneau d'analyse ══════════ */
  UI.majAnalyse = function () {
    const z = q('#zoneAnalyse');
    const mol = M.app.doc.mol;
    z.innerHTML = '';
    if (!mol.atoms.length) { z.append(el('div', { class: 'vide-msg' }, 'Aucune molécule. Choisissez une entrée dans la bibliothèque ou construisez-en une.')); return; }

    const Mm = M.analyse.masseMolaire(mol);
    const dip = M.analyse.momentDipolaire(mol);
    const nom = M.nomenclature.nommer(mol);

    z.append(el('div', { class: 'fiche' },
      el('h4', {}, 'Identité'),
      el('div', { class: 'formule-brute' }, M.analyse.formuleBrute(mol)),
      nom.nom ? el('div', { class: 'aide-txt', style: { marginTop: '4px' } }, nom.nom)
        : el('div', { class: 'aide-txt', style: { marginTop: '4px' } }, 'Nom systématique non déterminé (' + nom.motif + ').'),
      el('div', { class: 'kv', style: { marginTop: '8px' } },
        el('span', {}, 'Masse molaire'), el('span', {}, U.num(Mm, 2) + ' g·mol⁻¹'),
        el('span', {}, 'Atomes'), el('span', {}, String(mol.atoms.length)),
        el('span', {}, 'Liaisons'), el('span', {}, String(mol.bonds.length)),
        el('span', {}, 'Cycles'), el('span', {}, String(mol.rings().length)),
        el('span', {}, 'Insaturations'), el('span', {}, String(M.analyse.insaturations(mol))),
        el('span', {}, 'Charge totale'), el('span', {}, String(M.analyse.charge(mol))))));

    const g = M.analyse.groupes(mol);
    z.append(el('div', { class: 'fiche' },
      el('h4', {}, 'Groupes caractéristiques'),
      g.length ? el('div', {}, ...g.map(x => el('span', {
        class: 'puce ' + couleurGroupe(x.nom), title: x.detail || '',
        onclick: () => M.app.selectionner(x.ids), style: { cursor: 'pointer' },
      }, x.nom))) : el('div', { class: 'aide-txt' }, 'Aucun groupe caractéristique : hydrocarbure ou composé inorganique.'),
      el('div', { class: 'kv', style: { marginTop: '6px' } },
        el('span', {}, 'Famille'), el('span', {}, M.analyse.famille(mol)))));

    const lw = M.analyse.lewis(mol);
    z.append(el('div', { class: 'fiche' },
      el('h4', {}, 'Structure de Lewis'),
      el('div', { class: 'kv' },
        el('span', {}, 'Électrons de valence'), el('span', {}, String(lw.electronsValence)),
        el('span', {}, 'Électrons liants'), el('span', {}, String(lw.liants)),
        el('span', {}, 'Doublets non liants'), el('span', {}, String(lw.nonLiants / 2))),
      lw.anomalies.length
        ? el('ul', { class: 'liste-simple', style: { marginTop: '6px' } },
          ...lw.anomalies.slice(0, 6).map(a => el('li', { class: 'cliquable', onclick: () => M.app.selectionner([a.id]) }, a.texte)))
        : el('div', { class: 'aide-txt', style: { marginTop: '6px' } }, 'Tous les atomes respectent la règle de l’octet (ou du duet).')));

    z.append(el('div', { class: 'fiche' },
      el('h4', {}, 'Polarité'),
      el('div', { class: 'kv' },
        el('span', {}, 'Moment dipolaire'), el('span', {}, U.num(dip.debye, 2) + ' D'),
        el('span', {}, 'Caractère'), el('span', {}, dip.polaire ? 'molécule polaire' : 'molécule apolaire')),
      el('div', { class: 'aide-txt', style: { marginTop: '6px' } },
        dip.polaire ? 'Les moments dipolaires de liaison ne se compensent pas.'
          : 'La symétrie de la molécule annule la somme des moments de liaison.'),
      el('button', { class: 'secondaire', style: { marginTop: '7px', width: '100%' }, onclick: () => M.app.basculerOption('dipole') }, 'Afficher le vecteur μ dans la vue 3D')));

    const comp = M.analyse.compositionCentesimale(mol);
    z.append(el('div', { class: 'fiche' },
      el('h4', {}, 'Composition massique'),
      el('div', { class: 'kv' }, ...comp.flatMap(c => [
        el('span', {}, c.el + ' × ' + c.n), el('span', {}, U.num(c.pct, 1) + ' %')]))));
  };
  function couleurGroupe(n) {
    if (/acide|Ester|Amide|Anhydride|acyle/.test(n)) return 'rouge';
    if (/Alcool|Phénol|Éther|Époxyde/.test(n)) return 'bleu';
    if (/Aldéhyde|Cétone|Nitrile|Imine/.test(n)) return 'orange';
    if (/Amine|ammonium|nitro/.test(n)) return 'violet';
    return '';
  }

  /* ══════════ Panneau de stéréochimie ══════════ */
  UI.majStereo = function () {
    const z = q('#zoneStereo');
    const mol = M.app.doc.mol;
    z.innerHTML = '';
    if (!mol.atoms.length) { z.append(el('div', { class: 'vide-msg' }, 'Aucune molécule chargée.')); return; }

    const d = M.stereo.descripteurs(mol);
    const n = M.stereo.nombreStereoisomeres(mol);
    const chirale = M.stereo.estChirale(mol);

    z.append(el('div', { class: 'fiche' },
      el('h4', {}, 'Vue d’ensemble'),
      el('div', { class: 'kv' },
        el('span', {}, 'Carbones asymétriques'), el('span', {}, String(d.centres.length)),
        el('span', {}, 'Doubles liaisons Z/E'), el('span', {}, String(d.doubles.length)),
        el('span', {}, 'Stéréoisomères (max.)'), el('span', {}, String(n.max)),
        el('span', {}, 'Chiralité'), el('span', {}, n.meso ? 'composé méso' : (chirale ? 'chirale' : 'achirale'))),
      d.nom ? el('div', { style: { marginTop: '7px' } }, el('span', { class: 'puce' }, 'Configuration ' + d.nom)) : null));

    if (d.centres.length) {
      z.append(el('div', { class: 'fiche' },
        el('h4', {}, 'Centres asymétriques'),
        el('ul', { class: 'liste-simple' }, ...d.centres.map(c => el('li', { class: 'cliquable', onclick: () => UI.expliquerCentre(c.id) },
          el('b', {}, mol.etiquette(c.id) + ' — configuration ' + c.config),
          el('div', { class: 'sec' }, 'Cliquez pour voir le détail du classement CIP'))))));
    }
    if (d.doubles.length) {
      z.append(el('div', { class: 'fiche' },
        el('h4', {}, 'Doubles liaisons stéréogènes'),
        el('ul', { class: 'liste-simple' }, ...d.doubles.map(x => el('li', { class: 'cliquable', onclick: () => M.app.selectionner([x.a, x.b]) },
          el('b', {}, mol.etiquette(x.a) + '=' + mol.etiquette(x.b) + ' — configuration ' + x.config),
          el('div', { class: 'sec' }, 'Angle dièdre mesuré : ' + U.num(Math.abs(x.angle), 1) + '°'))))));
    }

    z.append(el('div', { class: 'fiche' },
      el('h4', {}, 'Transformations'),
      el('div', { class: 'actions-grille' },
        el('button', { onclick: () => M.app.enantiomere() }, 'Énantiomère'),
        el('button', { onclick: () => M.app.inverserSelection(), title: 'Inverse la configuration du centre sélectionné' }, 'Inverser un centre'),
        el('button', { onclick: () => M.app.basculerZE(), title: 'Isomérise la double liaison sélectionnée' }, 'Isomériser Z ⇄ E'),
        el('button', { onclick: () => M.app.inverserChaise() }, 'Inverser le cycle'),
        el('button', { class: 'pleine', onclick: () => UI.comparer() }, 'Comparer avec une autre molécule…'))));

    if (!d.centres.length && !d.doubles.length) {
      z.append(el('div', { class: 'aide-txt' }, 'Cette molécule ne possède aucun élément stéréogène : elle n’a donc pas de stéréoisomère de configuration.'));
    }
  };

  UI.expliquerCentre = function (id) {
    const mol = M.app.doc.mol;
    const e = M.stereo.expliquerCIP(mol, id);
    M.app.selectionner([id]);
    const corps = el('div', {},
      el('p', {}, 'Classement des quatre substituants de l’atome ' + mol.etiquette(id) + ' selon les règles séquentielles de Cahn, Ingold et Prelog :'),
      el('ul', { class: 'liste-simple' }, ...e.lignes.map(l => el('li', {},
        el('b', {}, 'Priorité ' + l.rang + ' — ' + l.texte),
        el('div', { class: 'sec' }, 'Atomes rencontrés dans la première sphère : ' + l.premiere)))),
      el('div', { class: 'explication' }, e.conclusion),
      el('p', { style: { marginTop: '12px', color: 'var(--mut)' } },
        'Rappel : une liaison multiple est traitée en dupliquant l’atome distant (un groupe —CHO équivaut à un carbone lié à O, O et H). '
        + 'Un astérisque signale ces atomes dupliqués, qui ne portent eux-mêmes aucun substituant.'));
    UI.dialogue('Règles CIP — atome ' + mol.etiquette(id), corps);
  };

  UI.comparer = function () {
    const sel = el('select', {});
    M.biblio.liste.forEach(e => sel.append(el('option', { value: e.nom }, e.nom)));
    const res = el('div', { class: 'explication' }, 'Choisissez une molécule puis lancez la comparaison.');
    const corps = el('div', {},
      el('p', {}, 'Comparez la molécule courante à une molécule de la bibliothèque pour déterminer leur relation d’isomérie.'),
      sel, el('div', { style: { marginTop: '10px' } },
        el('button', {
          class: 'primaire',
          onclick: () => {
            const autre = M.biblio.charger(sel.value);
            const r = M.stereo.relation(M.app.doc.mol, autre);
            res.textContent = r.texte
              + '\n\nMolécule courante : ' + M.analyse.formuleBrute(M.app.doc.mol) + '  ' + (M.stereo.descripteurs(M.app.doc.mol).nom || '')
              + '\nMolécule comparée : ' + M.analyse.formuleBrute(autre) + '  ' + (M.stereo.descripteurs(autre).nom || '');
          },
        }, 'Comparer')),
      res);
    UI.dialogue('Comparer deux molécules', corps);
  };

  /* ══════════ Inspecteur ══════════ */
  UI.majInspecteur = function () {
    const z = q('#zoneInspecteur');
    const doc = M.app.doc, mol = doc.mol;
    z.innerHTML = '';
    const ids = [...doc.selection];
    if (!ids.length) {
      z.append(el('div', { class: 'vide-msg' },
        'Aucune sélection.\nUtilisez l’outil de sélection puis cliquez sur un atome pour en afficher les propriétés.'));
      if (mol.atoms.length) z.append(inventaire(mol));
      return;
    }
    if (ids.length === 1) {
      const a = mol.atom(ids[0]);
      if (!a) return;
      const e = M.elements.get(a.el);
      const v = M.geo.vsepr(mol, a.id);
      z.append(el('div', { class: 'fiche' },
        el('h4', {}, 'Atome sélectionné'),
        el('div', { class: 'formule-brute' }, mol.etiquette(a.id)),
        el('div', { class: 'kv', style: { marginTop: '7px' } },
          el('span', {}, 'Élément'), el('span', {}, e ? e.name : a.el),
          el('span', {}, 'Liaisons σ'), el('span', {}, String(v.sigma)),
          el('span', {}, 'Doublets non liants'), el('span', {}, String(v.lp)),
          el('span', {}, 'Nombre stérique'), el('span', {}, String(v.n)),
          el('span', {}, 'Type VSEPR'), el('span', {}, v.code),
          el('span', {}, 'Géométrie'), el('span', {}, v.forme),
          el('span', {}, 'Hybridation'), el('span', {}, v.hyb),
          el('span', {}, 'Angle théorique'), el('span', {}, v.angle + '°'),
          el('span', {}, 'Charge formelle'), el('span', {}, String(M.geo.chargeFormelle(mol, a.id))),
          a.el === 'C' ? el('span', {}, 'Classe') : null,
          a.el === 'C' ? el('span', {}, M.analyse.classeCarbone(mol, a.id) || '—') : null,
          el('span', {}, 'Dans un cycle'), el('span', {}, mol.inRing(a.id) ? 'oui' : 'non'))));

      const ligneCharge = el('div', { class: 'lg' });
      z.append(el('div', { class: 'fiche' },
        el('h4', {}, 'Modifier'),
        el('div', { class: 'actions-grille' },
          el('button', { onclick: () => M.app.changerElement(a.id) }, 'Changer l’élément'),
          el('button', { onclick: () => M.app.changerCharge(a.id, +1) }, 'Charge +1'),
          el('button', { onclick: () => M.app.changerCharge(a.id, -1) }, 'Charge −1'),
          el('button', { onclick: () => M.app.completerAtome(a.id) }, 'Compléter en H'),
          el('button', { class: 'pleine', onclick: () => M.app.supprimerSelection() }, 'Supprimer cet atome')),
        ligneCharge));

      const centre = M.stereo.centresAsymetriques(mol).find(c => c.id === a.id);
      if (centre) {
        z.append(el('div', { class: 'fiche' },
          el('h4', {}, 'Stéréochimie'),
          el('div', {}, el('span', { class: 'puce' }, 'Carbone asymétrique — configuration ' + centre.config)),
          el('div', { class: 'actions-grille' },
            el('button', { onclick: () => UI.expliquerCentre(a.id) }, 'Détail CIP'),
            el('button', { onclick: () => M.app.inverserSelection() }, 'Inverser'))));
      }
      z.append(voisinage(mol, a.id));
      return;
    }
    /* Plusieurs atomes : mesures */
    const m = M.analyse.mesures(mol, ids.slice(0, 4));
    z.append(el('div', { class: 'fiche' },
      el('h4', {}, 'Sélection multiple'),
      el('div', { class: 'kv' },
        el('span', {}, 'Atomes sélectionnés'), el('span', {}, String(ids.length)),
        ...(m ? [el('span', {}, m.type.charAt(0).toUpperCase() + m.type.slice(1)),
          el('span', {}, U.num(m.valeur, m.type === 'distance' ? 3 : 1) + ' ' + m.unite)] : [])),
      m ? el('div', { style: { marginTop: '8px' } },
        el('label', {}, 'Nouvelle valeur'),
        (() => {
          const inp = el('input', { type: 'number', step: m.type === 'distance' ? '0.01' : '1', value: U.round(m.valeur, 3) });
          return el('div', { class: 'ligne-saisie' }, inp,
            el('button', { class: 'primaire', onclick: () => M.app.imposerMesure(ids, parseFloat(inp.value)) }, 'Appliquer'));
        })()) : null,
      el('div', { class: 'actions-grille' },
        el('button', { onclick: () => M.app.lierSelection() }, 'Lier les atomes'),
        el('button', { onclick: () => M.app.supprimerSelection() }, 'Supprimer'))));
  };
  function voisinage(mol, id) {
    const l = mol.neighbors(id);
    return el('div', { class: 'fiche' },
      el('h4', {}, 'Voisins (' + l.length + ')'),
      el('ul', { class: 'liste-simple' }, ...l.map(v => {
        const a = mol.atom(v.atom);
        const d = M.V.dist(mol.atom(id), a);
        return el('li', { class: 'cliquable', onclick: () => M.app.selectionner([v.atom]) },
          mol.etiquette(v.atom) + ' — liaison ' + nomOrdre(v.bond.order),
          el('span', { class: 'sec' }, '  ·  ' + U.num(d, 3) + ' Å'));
      })));
  }
  const nomOrdre = o => o === 1 ? 'simple' : o === 2 ? 'double' : o === 3 ? 'triple' : 'aromatique';
  function inventaire(mol) {
    const c = M.analyse.compte(mol);
    return el('div', { class: 'fiche' },
      el('h4', {}, 'Inventaire'),
      el('div', { class: 'kv' }, ...Object.keys(c).sort().flatMap(s => [
        el('span', {}, M.elements.get(s) ? M.elements.get(s).name : s), el('span', {}, String(c[s]))])));
  }

  /* ══════════ Projections 2D ══════════ */
  UI.majProjection = function () {
    const zone = q('#projZone'), reg = q('#projReglages');
    const mol = M.app.doc.mol;
    const type = M.app.projection;
    zone.innerHTML = ''; reg.innerHTML = '';
    if (!mol.atoms.length) { zone.innerHTML = '<div class="vide-msg">Aucune molécule.</div>'; return; }

    const dim = { w: Math.max(360, zone.clientWidth - 16), h: Math.max(200, zone.clientHeight - 12) };
    try {
      if (type === 'cram') rendreCram(zone, reg, mol, dim);
      else if (type === 'newman') rendreNewman(zone, reg, mol, dim);
      else if (type === 'fischer') zone.innerHTML = M.proj.fischer(mol, dim);
      else if (type === 'chaise') rendreCycle(zone, reg, mol, dim, 'chaise');
      else if (type === 'haworth') rendreCycle(zone, reg, mol, dim, 'haworth');
      else if (type === 'lewis') rendreLewis(zone, reg, mol);
    } catch (err) {
      zone.innerHTML = '<div class="vide-msg">Cette représentation ne s’applique pas à la molécule courante.<br><small>' + U.esc(err.message) + '</small></div>';
    }
    M.app.dernierSvg = zone.innerHTML;
  };

  function rendreCram(zone, reg, mol, dim) {
    const tousH = M.app.cramTousH || false;
    zone.innerHTML = M.proj.cram(mol, Object.assign({ tousLesH: tousH, tousLesSymboles: M.app.cramSymboles }, dim));
    reg.append(el('div', { class: 'aide-txt' },
      'Les liaisons dirigées vers l’avant sont tracées en coin plein, celles dirigées vers l’arrière en coin hachuré, '
      + 'les autres en trait simple. L’orientation est déduite de la géométrie 3D.'));
    reg.append(caseACocher('Afficher tous les hydrogènes', tousH, v => { M.app.cramTousH = v; UI.majProjection(); }));
    reg.append(caseACocher('Afficher tous les symboles C', !!M.app.cramSymboles, v => { M.app.cramSymboles = v; UI.majProjection(); }));
    reg.append(el('button', { class: 'secondaire', style: { width: '100%', marginTop: '8px' }, onclick: () => { M.app.viewer.cadrer(); UI.majProjection(); } }, 'Recalculer l’orientation'));
  }

  function rendreNewman(zone, reg, mol, dim) {
    const liaisons = mol.bonds.filter(b => b.order === 1 && !mol.bondInRing(b)
      && mol.degree(b.a) > 1 && mol.degree(b.b) > 1);
    if (!liaisons.length) { zone.innerHTML = '<div class="vide-msg">Aucune liaison simple ne permet une projection de Newman (il faut une liaison C—C interne, hors cycle).</div>'; return; }
    if (!M.app.newmanBond || !liaisons.some(b => b.id === M.app.newmanBond)) M.app.newmanBond = liaisons[0].id;
    const b = mol.bond(M.app.newmanBond);
    zone.innerHTML = M.proj.newman(mol, b.a, b.b, { w: Math.min(dim.w, 520), h: dim.h });

    const sel = el('select', { onchange: e => { M.app.newmanBond = +e.target.value; UI.majProjection(); } });
    liaisons.forEach(x => sel.append(el('option', { value: x.id, selected: x.id === b.id ? true : null },
      mol.etiquette(x.a) + ' — ' + mol.etiquette(x.b))));
    reg.append(el('label', {}, 'Liaison observée'), sel);

    const sa = mol.neighborIds(b.a).filter(i => i !== b.b);
    const sb = mol.neighborIds(b.b).filter(i => i !== b.a);
    if (sa.length && sb.length) {
      const angle = M.V.dihedral(mol.atom(sa[0]), mol.atom(b.a), mol.atom(b.b), mol.atom(sb[0]));
      const aff = el('span', { class: 'valeur-angle' }, U.num(angle, 0) + '°');
      const curseur = el('input', {
        type: 'range', min: -180, max: 180, step: 1, value: Math.round(angle),
        oninput: e => {
          aff.textContent = e.target.value + '°';
          M.geo.setDihedral(mol, sa[0], b.a, b.b, sb[0], +e.target.value);
          M.app.rafraichir({ leger: true });
        },
        onchange: () => M.app.doc.changed('conformation'),
      });
      reg.append(el('label', { style: { marginTop: '10px' } }, 'Angle dièdre  ', aff), curseur);
      reg.append(el('div', { class: 'actions-grille' },
        el('button', { onclick: () => M.app.poserDihedre(sa[0], b.a, b.b, sb[0], 60) }, 'Décalée 60°'),
        el('button', { onclick: () => M.app.poserDihedre(sa[0], b.a, b.b, sb[0], 180) }, 'Anti 180°'),
        el('button', { onclick: () => M.app.poserDihedre(sa[0], b.a, b.b, sb[0], 0) }, 'Éclipsée 0°'),
        el('button', { onclick: () => M.app.viewer.regarderSelon(M.V.sub(mol.atom(b.b), mol.atom(b.a))) }, 'Aligner la vue 3D')));
      const profil = M.proj.profilRotation(mol, b.a, b.b, 10);
      if (profil) {
        reg.append(el('label', { style: { marginTop: '10px' } }, 'Profil énergétique de rotation'));
        const box = el('div', { style: { marginTop: '2px' } });
        box.innerHTML = M.proj.courbeProfil(profil, { w: 228, h: 130 });
        reg.append(box);
      }
    }
  }

  function rendreCycle(zone, reg, mol, dim, type) {
    const cycles = mol.rings().filter(r => type === 'chaise' ? r.length === 6 : (r.length === 5 || r.length === 6));
    if (!cycles.length) { zone.innerHTML = '<div class="vide-msg">Cette molécule ne comporte pas de cycle adapté à cette représentation.</div>'; return; }
    const i = Math.min(M.app.cycleActif || 0, cycles.length - 1);
    const ring = cycles[i];
    zone.innerHTML = type === 'chaise' ? M.proj.chaise(mol, ring, dim) : M.proj.haworth(mol, ring, dim);
    if (cycles.length > 1) {
      const sel = el('select', { onchange: e => { M.app.cycleActif = +e.target.value; UI.majProjection(); } });
      cycles.forEach((r, k) => sel.append(el('option', { value: k, selected: k === i ? true : null }, 'Cycle ' + (k + 1) + ' (' + r.length + " atomes)")));
      reg.append(el('label', {}, 'Cycle représenté'), sel);
    }
    if (type === 'chaise') {
      reg.append(el('div', { class: 'aide-txt', style: { marginTop: '8px' } },
        'Les liaisons axiales sont tracées en orange, verticalement ; les liaisons équatoriales en bleu. '
        + 'L’inversion de cycle échange les deux positions sans modifier la configuration des carbones.'));
      reg.append(el('button', { class: 'primaire', style: { width: '100%', marginTop: '6px' }, onclick: () => M.app.inverserChaise(ring) }, 'Inverser le cycle'));
      const e = M.analyse.energieSterique(mol);
      reg.append(el('div', { class: 'kv', style: { marginTop: '10px' } },
        el('span', {}, 'Gêne stérique'), el('span', {}, U.num(e, 1) + ' u.a.'),
        el('span', {}, 'Conformation'), el('span', {}, M.proj.estChaise(mol, ring) ? 'chaise' : 'non chaise')));
    } else {
      reg.append(el('div', { class: 'aide-txt', style: { marginTop: '8px' } },
        'Le cycle est représenté vu par la tranche : les arêtes tracées en gras sont les plus proches de l’observateur. '
        + 'Les substituants situés au-dessus du plan moyen sont dessinés vers le haut.'));
    }
  }

  function rendreLewis(zone, reg, mol) {
    const lw = M.analyse.lewis(mol);
    zone.innerHTML = M.proj.cram(mol, { w: Math.max(360, zone.clientWidth - 16), h: Math.max(200, zone.clientHeight - 12), tousLesH: true, tousLesSymboles: true, doublets: true, legende: false });
    reg.append(el('div', { class: 'kv' },
      el('span', {}, 'Électrons de valence'), el('span', {}, String(lw.electronsValence)),
      el('span', {}, 'Doublets liants'), el('span', {}, String(lw.liants / 2)),
      el('span', {}, 'Doublets non liants'), el('span', {}, String(lw.nonLiants / 2)),
      el('span', {}, 'Électrons célibataires'), el('span', {}, String(lw.radicaux))));
    reg.append(el('div', { class: 'aide-txt', style: { marginTop: '9px' } },
      lw.complet ? 'Tous les atomes satisfont la règle de l’octet (ou du duet pour l’hydrogène).'
        : 'Certains atomes ne satisfont pas la règle de l’octet — voir le panneau Analyse.'));
    reg.append(caseACocher('Doublets non liants en 3D', !!M.app.viewer.opts.doublets, v => M.app.basculerOption('doublets', v)));
  }

  function caseACocher(libelle, valeur, action) {
    const inp = el('input', { type: 'checkbox', checked: valeur ? true : null, onchange: e => action(e.target.checked) });
    return el('label', { style: { display: 'flex', alignItems: 'center', gap: '7px', marginTop: '7px', fontSize: '12px', cursor: 'pointer' } }, inp, libelle);
  }

  /* ══════════ Exercices ══════════ */
  UI.remplirThemesExos = function () {
    const z = q('#exoThemes');
    z.innerHTML = '';
    const choisis = new Set(M.store.get('themesExos', M.exos.THEMES.map(t => t.cle)));
    M.exos.THEMES.forEach(t => {
      z.append(el('label', {},
        el('input', {
          type: 'checkbox', value: t.cle, checked: choisis.has(t.cle) ? true : null,
          onchange: () => {
            const l = qa('#exoThemes input:checked').map(i => i.value);
            M.store.set('themesExos', l);
          },
        }),
        t.nom, el('small', {}, t.chapitre)));
    });
  };

  UI.majProgression = function () {
    const z = q('#exoProgression');
    z.innerHTML = '';
    const p = M.exos.progression().filter(t => t.vues);
    if (!p.length) { z.append(el('div', { class: 'aide-txt' }, 'Aucune question traitée pour l’instant. Lancez un entraînement pour suivre votre progression thème par thème.')); return; }
    const tot = p.reduce((s, t) => ({ v: s.v + t.vues, j: s.j + t.justes }), { v: 0, j: 0 });
    z.append(el('div', { class: 'kv', style: { marginBottom: '9px' } },
      el('span', {}, 'Questions traitées'), el('span', {}, String(tot.v)),
      el('span', {}, 'Réussite globale'), el('span', {}, Math.round(100 * tot.j / tot.v) + ' %')));
    p.sort((a, b) => (a.taux || 0) - (b.taux || 0)).forEach(t => {
      z.append(el('div', { class: 'pr-ligne' }, el('span', {}, t.nom), el('span', { class: 'pr-val' }, t.taux + ' %')),
        el('div', { class: 'pr-jauge' }, el('i', { style: { width: t.taux + '%' } })));
    });
  };

  UI.demarrerExos = function () {
    const themes = qa('#exoThemes input:checked').map(i => i.value);
    if (!themes.length) { UI.message('Choisissez au moins un thème.'); return; }
    const n = +(q('#exoNombre button.actif') || { dataset: { n: 10 } }).dataset.n;
    UI.message('Préparation des questions…');
    setTimeout(() => {
      const questions = M.exos.generer(themes, n);
      if (!questions.length) { UI.message('Aucune question n’a pu être générée pour ces thèmes.'); return; }
      M.app.seance = new M.exos.Seance(questions);
      q('#exoAccueil').hidden = true;
      q('#exoSeance').hidden = false;
      UI.afficherQuestion();
    }, 20);
  };

  UI.afficherQuestion = function () {
    const s = M.app.seance;
    const z = q('#exoSeance');
    z.innerHTML = '';
    if (!s) return;
    const qs = s.courante();
    if (!qs) return UI.afficherScore();

    const sc = s.score();
    z.append(el('div', { class: 'exo-tete' },
      el('span', { class: 'exo-compteur' }, (s.index + 1) + ' / ' + s.questions.length),
      el('div', { class: 'exo-barre' }, el('i', { style: { width: (100 * s.index / s.questions.length) + '%' } })),
      el('span', { class: 'exo-compteur' }, sc.justes + ' bonne' + (sc.justes > 1 ? 's' : '') + ' réponse' + (sc.justes > 1 ? 's' : ''))));

    const theme = M.exos.THEMES.find(t => t.cle === qs.theme);
    z.append(el('div', { class: 'exo-theme' }, (theme ? theme.nom : qs.theme) + '  ·  niveau ' + (qs.niveau || 1)));
    z.append(el('div', { class: 'exo-enonce' }, qs.enonce));

    if (qs.molecule) M.app.chargerPourExercice(qs);

    const deja = s.deja(qs.id);
    const zoneRep = el('div', {});
    z.append(zoneRep);
    construireReponse(zoneRep, qs, s, deja);

    const pied = el('div', { class: 'exo-pied' });
    if (!deja && qs.aide) pied.append(el('button', {
      class: 'secondaire',
      onclick: e => { e.target.replaceWith(el('div', { class: 'exo-aide' }, '💡 ' + qs.aide)); },
    }, 'Indice'));
    if (deja) pied.append(el('button', {
      class: 'primaire',
      onclick: () => { if (s.suivant()) UI.afficherQuestion(); else UI.afficherScore(); },
    }, s.index < s.questions.length - 1 ? 'Question suivante' : 'Voir le résultat'));
    pied.append(el('button', { class: 'secondaire', onclick: () => UI.quitterExos() }, 'Quitter'));
    z.append(pied);
  };

  function construireReponse(zone, qs, s, deja) {
    const bloque = !!deja;
    const valider = rep => {
      const res = s.repondre(rep);
      UI.afficherQuestion();
      return res;
    };
    if (qs.type === 'qcm' || qs.type === 'multi') {
      const choisis = new Set(bloque ? [].concat(deja.reponse) : []);
      const boite = el('div', { class: 'exo-choix' });
      qs.choix.forEach((c, i) => {
        const bon = qs.type === 'qcm' ? i === qs.reponse : qs.reponse.includes(i);
        const b = el('button', {
          disabled: bloque ? true : null,
          class: bloque ? (bon ? 'juste' : (choisis.has(i) || choisis.has(String(i)) ? 'faux' : '')) : '',
          onclick: () => {
            if (qs.type === 'qcm') valider(i);
            else {
              b.classList.toggle('choisi');
              majBoutonValider();
            }
          },
        }, c);
        boite.append(b);
      });
      zone.append(boite);
      let btnValider = null;
      function majBoutonValider() {
        if (btnValider) btnValider.disabled = !qa('.exo-choix button.choisi', zone).length;
      }
      if (qs.type === 'multi' && !bloque) {
        btnValider = el('button', {
          class: 'primaire large', disabled: true,
          onclick: () => valider(qa('.exo-choix button', zone).map((b, i) => b.classList.contains('choisi') ? i : -1).filter(i => i >= 0)),
        }, 'Valider');
        zone.append(btnValider);
      }
    } else if (qs.type === 'vf') {
      const boite = el('div', { class: 'exo-choix' });
      [['Vrai', true], ['Faux', false]].forEach(([t, v]) => boite.append(el('button', {
        disabled: bloque ? true : null,
        class: bloque ? (v === qs.reponse ? 'juste' : (deja.reponse === v ? 'faux' : '')) : '',
        onclick: () => valider(v),
      }, t)));
      zone.append(boite);
    } else {
      const inp = el('input', {
        type: qs.type === 'numerique' ? 'text' : 'text',
        placeholder: qs.type === 'numerique' ? 'Votre valeur' : 'Votre réponse',
        value: bloque ? String(deja.reponse) : '',
        disabled: bloque ? true : null,
        onkeydown: e => { if (e.key === 'Enter' && inp.value.trim()) valider(inp.value); },
      });
      zone.append(el('div', { class: 'ligne-saisie' }, inp,
        bloque ? null : el('button', { class: 'primaire', onclick: () => { if (inp.value.trim()) valider(inp.value); } }, 'Valider')));
      if (!bloque) setTimeout(() => inp.focus(), 40);
    }

    if (bloque) {
      const res = M.exos.verifier(qs, deja.reponse);
      zone.append(el('div', { class: 'exo-retour ' + (deja.juste ? 'juste' : 'faux') },
        el('b', {}, deja.juste ? '✓ Bonne réponse' : '✗ Réponse incorrecte — ' + res.message),
        el('div', { class: 'exo-correction' }, qs.correction || '')));
    }
  }

  UI.afficherScore = function () {
    const s = M.app.seance;
    const z = q('#exoSeance');
    const sc = s.score();
    const pct = sc.total ? Math.round(100 * sc.justes / sc.total) : 0;
    const mot = pct >= 90 ? 'Excellent !' : pct >= 75 ? 'Très bon résultat.' : pct >= 50 ? 'Résultat correct, continuez.' : 'Reprenez les points manqués.';
    z.innerHTML = '';
    z.append(el('div', { class: 'score-final' },
      el('div', { class: 'gros' }, sc.justes + ' / ' + sc.total),
      el('p', {}, pct + ' % de réussite. ' + mot)),
      el('div', { class: 'exo-pied' },
        el('button', { class: 'primaire', onclick: () => { M.app.seance = null; UI.quitterExos(); UI.demarrerExos(); } }, 'Nouvelle série'),
        el('button', { class: 'secondaire', onclick: () => UI.quitterExos() }, 'Terminer')));
    UI.majProgression();
  };

  UI.quitterExos = function () {
    M.app.seance = null;
    q('#exoSeance').hidden = true;
    q('#exoAccueil').hidden = false;
    UI.majProgression();
  };

  /* ══════════ Aide ══════════ */
  UI.aide = function () {
    UI.dialogue('Aide — LaTeX MolecularChemistry Edition', `
      <h4>Naviguer dans la vue 3D</h4>
      <table class="table-raccourcis">
        <tr><td>Clic gauche glissé</td><td>Faire tourner la molécule</td></tr>
        <tr><td>Clic droit glissé, ou <kbd>Maj</kbd> + clic</td><td>Déplacer la vue</td></tr>
        <tr><td>Molette</td><td>Zoomer</td></tr>
        <tr><td>Double-clic sur un atome</td><td>Centrer la vue sur cet atome</td></tr>
      </table>
      <h4>Outils</h4>
      <table class="table-raccourcis">
        <tr><td><kbd>V</kbd></td><td>Naviguer</td></tr>
        <tr><td><kbd>S</kbd></td><td>Sélectionner</td></tr>
        <tr><td><kbd>G</kbd></td><td>Déplacer un atome</td></tr>
        <tr><td><kbd>A</kbd></td><td>Ajouter un atome de l’élément actif</td></tr>
        <tr><td><kbd>B</kbd></td><td>Créer une liaison entre deux atomes</td></tr>
        <tr><td><kbd>D</kbd></td><td>Supprimer</td></tr>
        <tr><td><kbd>M</kbd></td><td>Mesurer (2, 3 ou 4 atomes)</td></tr>
      </table>
      <h4>Raccourcis généraux</h4>
      <table class="table-raccourcis">
        <tr><td><kbd>Ctrl</kbd>+<kbd>N</kbd></td><td>Nouvelle molécule</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>O</kbd></td><td>Ouvrir un fichier</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>S</kbd></td><td>Enregistrer</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd></td><td>Annuler / Rétablir</td></tr>
        <tr><td><kbd>F</kbd></td><td>Recadrer la vue</td></tr>
        <tr><td><kbd>H</kbd></td><td>Compléter les valences par des hydrogènes</td></tr>
        <tr><td><kbd>O</kbd></td><td>Optimiser la géométrie</td></tr>
        <tr><td><kbd>Échap</kbd></td><td>Annuler la sélection, fermer les menus</td></tr>
      </table>
      <h4>Construire une molécule</h4>
      <p>Le plus simple est de partir de la bibliothèque, ou d’entrer une formule <b>SMILES</b> dans l’onglet
      « Construire » : <span class="mono">CCO</span> pour l’éthanol, <span class="mono">CC(=O)O</span> pour l’acide éthanoïque,
      <span class="mono">c1ccccc1</span> pour le benzène. La stéréochimie s’écrit <span class="mono">[C@H]</span> / <span class="mono">[C@@H]</span>
      pour les carbones asymétriques et <span class="mono">/</span> <span class="mono">\\</span> pour les doubles liaisons.</p>
      <p>Vous pouvez aussi cliquer dans la vue avec l’outil « Ajouter », relier les atomes avec l’outil « Lier »,
      puis lancer « Compléter » et « Optimiser » : la géométrie est alors construite selon la théorie VSEPR,
      puis relaxée en conservant la configuration de chaque centre asymétrique.</p>
      <h4>À propos</h4>
      <p>LaTeX MolecularChemistry Edition — modélisation moléculaire 3D et entraînement en chimie,
      programme de PCSI. Application distincte de LaTeX Home Edition, dédiée à l’écriture scientifique.</p>
    `);
  };

  UI.brancher = function () {
    brancherOnglets('#ongletsGauche', 'vue');
    brancherOnglets('#ongletsDroite', 'vue');
  };

  UI.brancherOnglets = brancherOnglets;
})();
