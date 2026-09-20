/* Application : orchestration du document, de la vue 3D, des outils et des fichiers. */
(function () {
  const D = M.dom, q = D.q, qa = D.qa, U = M.util, UI = M.ui;

  const App = {
    doc: new M.Document(),
    viewer: null,
    outil: 'orbite',
    element: 'C',
    ordre: 1,
    typeLiaison: 'n',
    projection: 'cram',
    seance: null,
    lierDepuis: null,
    bureau: window.lmcDesktop || null,
    cheminFichier: null,
  };
  M.app = App;
  Object.defineProperty(App, 'dirty', { get: () => App.doc.dirty });

  /* ══════════ Démarrage ══════════ */
  App.init = function () {
    App.viewer = new M.Viewer(q('#vue3d'));
    App.viewer.setDocument(App.doc);
    UI.brancher();
    UI.appliquerTheme();
    UI.remplirBiblio();
    UI.remplirTableauPeriodique();
    UI.remplirFragments();
    UI.remplirThemesExos();
    UI.majProgression();
    remplirModes();
    brancherBarreOutils();
    brancherVue();
    brancherClavier();
    brancherFichiers();
    brancherMisesAJour();

    M.bus.on('doc:changed', () => App.rafraichir());
    window.addEventListener('resize', () => { App.viewer.redimensionner(); UI.majProjection(); });

    /* Molécule d'accueil, ou document repris de la session précédente */
    const sauvegarde = M.store.get('auto', null);
    if (sauvegarde) {
      try { App.doc.setMolecule(M.Molecule.fromJSON(sauvegarde), 'reprise'); }
      catch (e) { App.chargerBiblio('Éthanol'); }
    } else App.chargerBiblio('Éthanol');
    App.rafraichir();
    /* la mise en page définitive n'est connue qu'après le premier rendu */
    requestAnimationFrame(() => { App.viewer.redimensionner(); App.viewer.cadrer(false); });
    setTimeout(() => { App.viewer.redimensionner(); App.viewer.cadrer(false); UI.majProjection(); }, 260);
    setInterval(() => App.sauvegardeAuto(), 20000);
    UI.message('Bienvenue — choisissez une molécule dans la bibliothèque pour commencer.', 6000);
  };

  App.sauvegardeAuto = function () {
    if (!App.doc.dirty) return;
    M.store.set('auto', App.doc.mol.toJSON());
  };
  App.autosaveNow = () => { M.store.set('auto', App.doc.mol.toJSON()); };

  function remplirModes() {
    const s = q('#selMode');
    Object.keys(M.MODES).forEach(k => s.append(D.el('option', { value: k }, M.MODES[k].nom)));
    s.value = App.viewer.mode;
    s.onchange = () => { App.viewer.mode = s.value; App.viewer.reconstruire(); App.viewer.cadrer(); };
  }

  /* ══════════ Rafraîchissement ══════════ */
  let enAttente = null;
  App.rafraichir = function (opt = {}) {
    App.viewer.reconstruire();
    if (opt.leger) return;
    clearTimeout(enAttente);
    enAttente = setTimeout(() => {
      UI.majEtat();
      UI.majAnalyse();
      UI.majStereo();
      UI.majInspecteur();
      UI.majProjection();
    }, 30);
  };

  /* ══════════ Barre d'outils ══════════ */
  function brancherBarreOutils() {
    q('#topbar').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.outil) return App.setOutil(b.dataset.outil);
      if (b.dataset.act) return actions(b.dataset.act, b);
      if (b.dataset.export) { fermerMenus(); return App.exporter(b.dataset.export); }
      if (b.dataset.ordre) { App.ordre = +b.dataset.ordre; App.typeLiaison = 'n'; majOrdre(); fermerMenus(); return; }
      if (b.dataset.type) { App.typeLiaison = b.dataset.type; majOrdre(); fermerMenus(); return; }
    });
    q('#btnElement').onclick = () => {
      qa('#ongletsGauche button').forEach(x => x.classList.toggle('actif', x.dataset.vue === 'construire'));
      qa('#gauche section[data-panneau]').forEach(s => s.classList.toggle('actif', s.dataset.panneau === 'construire'));
      q('#tableauPeriodique').scrollIntoView({ block: 'nearest' });
    };
    document.addEventListener('click', e => { if (!e.target.closest('.menu-parent')) fermerMenus(); });

    /* Panneau gauche */
    q('#rechBiblio').addEventListener('input', e => UI.remplirBiblio(e.target.value));
    q('#gauche').addEventListener('click', e => {
      const b = e.target.closest('button[data-act]');
      if (b) return actions(b.dataset.act, b);
      const n = e.target.closest('#exoNombre button');
      if (n) qa('#exoNombre button').forEach(x => x.classList.toggle('actif', x === n));
    });
    q('#saisieSmiles').addEventListener('keydown', e => { if (e.key === 'Enter') actions('construire-smiles'); });

    /* Onglets de projection */
    q('#ongletsProj').addEventListener('click', e => {
      const b = e.target.closest('button[data-proj]');
      if (b) {
        qa('#ongletsProj button[data-proj]').forEach(x => x.classList.toggle('actif', x === b));
        App.projection = b.dataset.proj;
        UI.majProjection();
        return;
      }
      const a = e.target.closest('button[data-act]');
      if (a) actions(a.dataset.act, a);
    });
    q('#voile').addEventListener('click', e => {
      if (e.target.id === 'voile' || e.target.closest('[data-act="dlg-fermer"]')) UI.fermerDialogue();
    });

    /* Options d'affichage */
    q('#btnOptions').onclick = () => q('#vueOptions').classList.toggle('visible');
    q('#vueOptions').addEventListener('change', e => {
      const c = e.target.closest('[data-opt]');
      if (!c) return;
      const k = c.dataset.opt;
      const v = c.type === 'checkbox' ? c.checked : c.value;
      if (k === 'rotation') { App.viewer.rotationAuto = v; App.viewer.besoinRendu = true; return; }
      if (k === 'perspective') return App.viewer.setPerspective(v);
      App.viewer.opts[k] = v;
      App.viewer.reconstruire();
    });
    majOrdre();
  }
  function fermerMenus() { qa('.menu').forEach(m => m.classList.remove('ouvert')); }
  function majOrdre() {
    const noms = { 1: 'Simple', 2: 'Double', 3: 'Triple', 1.5: 'Aromatique' };
    const typ = { w: ' (coin plein)', h: ' (hachuré)', d: ' (pointillés)', n: '' };
    q('#ordreLabel').textContent = (noms[App.ordre] || 'Simple') + (typ[App.typeLiaison] || '');
  }

  App.setOutil = function (o) {
    App.outil = o;
    App.viewer.outil = o;
    App.lierDepuis = null;
    if (o !== 'mesurer') { App.viewer.mesure = []; App.viewer.reconstruire(); }
    qa('#outils button').forEach(b => b.classList.toggle('actif', b.dataset.outil === o));
    const aides = {
      orbite: 'Navigation : clic gauche pour tourner, clic droit pour déplacer, molette pour zoomer.',
      selection: 'Cliquez un atome pour le sélectionner ; maintenez Maj pour en ajouter.',
      deplacer: 'Faites glisser un atome pour le déplacer dans le plan de l’écran.',
      element: 'Cliquez dans le vide pour poser un atome de ' + App.element + ', ou sur un atome pour le remplacer.',
      lier: 'Cliquez successivement sur deux atomes pour créer ou modifier la liaison.',
      supprimer: 'Cliquez sur un atome ou une liaison pour le supprimer.',
      mesurer: 'Cliquez 2 atomes (distance), 3 (angle) ou 4 (angle dièdre).',
    };
    UI.message(aides[o] || '', 5200);
  };

  /* ══════════ Actions ══════════ */
  function actions(a) {
    switch (a) {
      case 'nouveau': return App.nouveau();
      case 'ouvrir': return App.ouvrir();
      case 'enregistrer': return App.enregistrer();
      case 'menu-export': return basculerMenu('#menuExport');
      case 'menu-liaison': return basculerMenu('#menuLiaison');
      case 'annuler': return App.doc.undo() ? UI.message('Action annulée.') : UI.message('Rien à annuler.');
      case 'retablir': return App.doc.redo() ? UI.message('Action rétablie.') : UI.message('Rien à rétablir.');
      case 'hydrogenes': return App.completerHydrogenes();
      case 'optimiser': return App.optimiser();
      case 'cadrer': return App.viewer.cadrer();
      case 'theme': return UI.basculerTheme();
      case 'aide': return UI.aide();
      case 'construire-smiles': return App.construireSmiles();
      case 'exo-demarrer': return UI.demarrerExos();
      case 'exo-reinit': return (M.exos.reinitialiser(), UI.majProgression(), UI.message('Progression réinitialisée.'));
      case 'proj-svg': return App.exporter('svg');
      case 'plier-bas': {
        const p = q('#bas');
        p.classList.toggle('plie');
        q('[data-act="plier-bas"]').textContent = p.classList.contains('plie') ? '▴' : '▾';
        setTimeout(() => { App.viewer.redimensionner(); UI.majProjection(); }, 60);
        return;
      }
      default: return;
    }
  }
  function basculerMenu(sel) {
    const m = q(sel), etait = m.classList.contains('ouvert');
    fermerMenus();
    m.classList.toggle('ouvert', !etait);
  }

  /* ══════════ Documents ══════════ */
  App.nouveau = function () {
    App.doc.setMolecule(new M.Molecule('Sans titre'), 'nouveau');
    App.cheminFichier = null;
    M.store.del('auto');
    App.rafraichir();
    UI.message('Nouvelle molécule vide. Construisez-la ou choisissez une entrée dans la bibliothèque.');
  };

  App.chargerBiblio = function (nom) {
    try {
      const mol = M.biblio.charger(nom);
      App.doc.setMolecule(mol, 'bibliothèque');
      App.cheminFichier = null;
      App.viewer.setDocument(App.doc);
      App.rafraichir();
      requestAnimationFrame(() => App.viewer.cadrer(false));
      const e = M.biblio.liste.find(x => x.nom === nom);
      UI.message(nom + (e && e.note ? ' — ' + e.note : ''), 5200);
    } catch (err) {
      UI.message('Impossible de charger cette molécule : ' + err.message, 6000);
    }
  };

  App.construireSmiles = function () {
    const champ = q('#saisieSmiles'), err = q('#erreurSmiles');
    const t = champ.value.trim();
    err.hidden = true;
    if (!t) return;
    const parBiblio = M.biblio.liste.find(x => x.nom.toLowerCase() === t.toLowerCase());
    try {
      const mol = parBiblio ? M.biblio.charger(parBiblio.nom) : M.smiles.lire(t);
      App.doc.setMolecule(mol, 'smiles');
      App.viewer.setDocument(App.doc);
      App.rafraichir();
      UI.message('Molécule construite : ' + M.analyse.formuleBrute(mol));
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
    }
  };

  App.ajouterFragment = function (smi, nom) {
    try {
      const frag = M.smiles.lire(smi);
      App.doc.snapshot('Ajout du fragment ' + nom);
      const mol = App.doc.mol;
      const cible = [...App.doc.selection][0];
      if (cible != null && mol.atom(cible)) {
        /* greffe sur l'atome sélectionné, dans une direction libre */
        const dirs = M.geo.placerNouvellesDirections(mol, cible, 1);
        const d = dirs[0] || { x: 1, y: 0, z: 0 };
        const base = mol.atom(cible);
        const dep = M.V.add(base, M.V.mul(d, 1.5));
        frag.recenter();
        const map = mol.merge(frag, dep);
        const premier = map.get(frag.atoms.filter(a => a.el !== 'H')[0].id);
        /* on libère une place sur chaque partenaire en retirant un hydrogène */
        const hA = mol.neighborIds(cible).find(i => mol.atom(i).el === 'H');
        if (hA != null) mol.removeAtom(hA);
        const hB = mol.neighborIds(premier).find(i => mol.atom(i).el === 'H');
        if (hB != null) mol.removeAtom(hB);
        mol.addBond(cible, premier, 1);
        M.geo.optimiser(mol, { steps: 400 });
      } else {
        mol.merge(frag, { x: 0, y: 0, z: 0 });
        M.geo.construire3D(mol);
      }
      App.doc.changed('fragment');
      UI.message('Fragment ' + nom + ' ajouté.');
    } catch (e) {
      UI.message('Impossible d’ajouter ce fragment : ' + e.message, 5000);
    }
  };

  /* ══════════ Opérations chimiques ══════════ */
  App.completerHydrogenes = function () {
    App.doc.snapshot('Ajout des hydrogènes');
    const n = M.geo.ajouterHydrogenes(App.doc.mol).length;
    if (n) M.geo.optimiser(App.doc.mol, { steps: 300 });
    App.doc.changed('hydrogenes');
    UI.message(n ? n + ' hydrogène(s) ajouté(s).' : 'Toutes les valences sont déjà satisfaites.');
  };
  App.optimiser = function () {
    App.doc.snapshot('Optimisation de la géométrie');
    const mol = App.doc.mol;
    M.geo.optimiser(mol, { steps: 700 });
    M.geo.decaler(mol);
    M.geo.optimiser(mol, { steps: 300 });
    M.geo.prefererConformation(mol);
    mol.recenter();
    App.doc.changed('optimisation');
    App.viewer.cadrer();
    UI.message('Géométrie optimisée — la configuration de chaque centre asymétrique est conservée.');
  };
  App.enantiomere = function () {
    if (!App.doc.mol.atoms.length) return;
    App.doc.snapshot('Énantiomère');
    const e = M.stereo.enantiomere(App.doc.mol);
    App.doc.mol.atoms = e.atoms; App.doc.mol.bonds = e.bonds;
    App.doc.mol.name = e.name;
    App.doc.changed('enantiomere');
    UI.message('Énantiomère formé : toutes les configurations sont inversées.');
  };
  App.inverserSelection = function () {
    const id = [...App.doc.selection][0];
    const mol = App.doc.mol;
    const centres = M.stereo.centresAsymetriques(mol);
    const cible = id != null && centres.some(c => c.id === id) ? id : (centres[0] && centres[0].id);
    if (cible == null) return UI.message('Aucun centre asymétrique à inverser.');
    App.doc.snapshot('Inversion d’un centre');
    if (M.stereo.inverserCentre(mol, cible)) {
      M.geo.optimiser(mol, { steps: 400 });
      App.doc.changed('inversion');
      const c = M.stereo.centresAsymetriques(mol).find(x => x.id === cible);
      UI.message('Centre ' + App.doc.mol.etiquette(cible) + ' inversé' + (c ? ' — nouvelle configuration : ' + c.config : '') + '.');
    } else UI.message('Ce centre ne peut pas être inversé (branches bloquées dans un cycle).');
  };
  App.basculerZE = function () {
    const mol = App.doc.mol;
    const d = M.stereo.doublesLiaisons(mol);
    if (!d.length) return UI.message('Aucune double liaison stéréogène.');
    const sel = [...App.doc.selBonds][0];
    const cible = d.find(x => x.bond === sel) || d[0];
    App.doc.snapshot('Isomérisation Z/E');
    if (M.stereo.basculerZE(mol, cible.bond)) {
      M.geo.optimiser(mol, { steps: 350 });
      App.doc.changed('ze');
      const n = M.stereo.doublesLiaisons(mol).find(x => x.bond === cible.bond);
      UI.message('Double liaison isomérisée' + (n ? ' — configuration ' + n.config : '') + '.');
    }
  };
  App.inverserChaise = function (ring) {
    const mol = App.doc.mol;
    const r = ring || mol.rings().find(x => x.length === 6);
    if (!r) return UI.message('Aucun cycle à six atomes.');
    App.doc.snapshot('Inversion de cycle');
    M.proj.inverserChaise(mol, r);
    App.doc.changed('chaise');
    UI.message('Cycle inversé : les positions axiales et équatoriales sont échangées.');
  };
  App.poserDihedre = function (a, b, c, d, val) {
    App.doc.snapshot('Angle dièdre');
    M.geo.setDihedral(App.doc.mol, a, b, c, d, val);
    App.doc.changed('dihedre');
  };
  App.imposerMesure = function (ids, val) {
    if (!isFinite(val)) return;
    App.doc.snapshot('Modification géométrique');
    const mol = App.doc.mol;
    let ok = false;
    if (ids.length === 2) { M.geo.setDistance(mol, ids[0], ids[1], val); ok = true; }
    else if (ids.length === 3) ok = M.geo.setAngle(mol, ids[0], ids[1], ids[2], val);
    else if (ids.length === 4) ok = M.geo.setDihedral(mol, ids[0], ids[1], ids[2], ids[3], val);
    App.doc.changed('mesure');
    UI.message(ok ? 'Géométrie modifiée.' : 'Modification impossible : les atomes appartiennent à un cycle.');
  };
  App.changerElement = function (id) {
    const a = App.doc.mol.atom(id);
    if (!a) return;
    App.doc.snapshot('Changement d’élément');
    a.el = App.element;
    App.doc.mol.touch();
    App.doc.changed('element');
    UI.message('Atome ' + App.doc.mol.etiquette(id) + ' changé en ' + App.element + '.');
  };
  App.changerCharge = function (id, d) {
    const a = App.doc.mol.atom(id);
    if (!a) return;
    App.doc.snapshot('Changement de charge');
    a.charge = (a.charge || 0) + d;
    App.doc.mol.touch();
    App.doc.changed('charge');
  };
  App.completerAtome = function (id) {
    App.doc.snapshot('Complétion des valences');
    M.geo.ajouterHydrogenes(App.doc.mol, [id]);
    M.geo.optimiser(App.doc.mol, { steps: 250 });
    App.doc.changed('hydrogenes');
  };
  App.supprimerSelection = function () {
    const ids = [...App.doc.selection], bonds = [...App.doc.selBonds];
    if (!ids.length && !bonds.length) return;
    App.doc.snapshot('Suppression');
    bonds.forEach(b => App.doc.mol.removeBond(b));
    ids.forEach(i => App.doc.mol.removeAtomDeep(i));
    App.doc.selection.clear(); App.doc.selBonds.clear();
    App.doc.changed('suppression');
    UI.message('Sélection supprimée.');
  };
  App.lierSelection = function () {
    const ids = [...App.doc.selection];
    if (ids.length < 2) return UI.message('Sélectionnez au moins deux atomes.');
    App.doc.snapshot('Création de liaisons');
    for (let i = 0; i < ids.length - 1; i++) App.doc.mol.addBond(ids[i], ids[i + 1], App.ordre, { type: App.typeLiaison });
    App.doc.changed('liaison');
  };
  App.selectionner = function (ids) {
    App.doc.selection = new Set(ids.filter(i => App.doc.mol.atom(i)));
    App.doc.selBonds.clear();
    App.viewer.selection = App.doc.selection;
    App.viewer.reconstruire();
    UI.majInspecteur();
    qa('#ongletsDroite button').forEach(x => x.classList.toggle('actif', x.dataset.vue === 'inspecteur'));
    qa('#droite section[data-panneau]').forEach(s => s.classList.toggle('actif', s.dataset.panneau === 'inspecteur'));
  };
  App.basculerOption = function (k, v) {
    const val = v == null ? !App.viewer.opts[k] : v;
    App.viewer.opts[k] = val;
    const c = q('#vueOptions [data-opt="' + k + '"]');
    if (c && c.type === 'checkbox') c.checked = val;
    App.viewer.reconstruire();
  };

  /* ══════════ Interaction avec la vue 3D ══════════ */
  function brancherVue() {
    M.bus.on('vue:clic', ({ cible, event }) => {
      const mol = App.doc.mol;
      switch (App.outil) {
        case 'selection':
          if (!cible) { if (!event.shiftKey) { App.doc.selection.clear(); App.doc.selBonds.clear(); } }
          else if (cible.type === 'atome') {
            if (!event.shiftKey) App.doc.selection.clear();
            App.doc.selection.has(cible.id) ? App.doc.selection.delete(cible.id) : App.doc.selection.add(cible.id);
          } else {
            if (!event.shiftKey) App.doc.selBonds.clear();
            App.doc.selBonds.has(cible.id) ? App.doc.selBonds.delete(cible.id) : App.doc.selBonds.add(cible.id);
          }
          App.viewer.selection = App.doc.selection;
          App.viewer.reconstruire();
          UI.majInspecteur();
          break;
        case 'element': {
          App.doc.snapshot('Ajout d’un atome');
          if (cible && cible.type === 'atome') mol.atom(cible.id).el = App.element;
          else {
            const p = App.viewer.pointDansPlan();
            const a = mol.addAtom(App.element, p);
            const proche = [...App.doc.selection][0];
            if (proche != null && mol.atom(proche)) mol.addBond(proche, a.id, App.ordre, { type: App.typeLiaison });
            App.doc.selection = new Set([a.id]);
            App.viewer.selection = App.doc.selection;
          }
          App.doc.changed('ajout');
          break;
        }
        case 'lier':
          if (!cible || cible.type !== 'atome') { App.lierDepuis = null; break; }
          if (App.lierDepuis == null) { App.lierDepuis = cible.id; UI.message('Premier atome choisi — cliquez le second.'); }
          else if (App.lierDepuis !== cible.id) {
            App.doc.snapshot('Création d’une liaison');
            mol.addBond(App.lierDepuis, cible.id, App.ordre, { type: App.typeLiaison });
            App.lierDepuis = null;
            App.doc.changed('liaison');
          }
          break;
        case 'supprimer':
          if (!cible) break;
          App.doc.snapshot('Suppression');
          if (cible.type === 'atome') mol.removeAtomDeep(cible.id); else mol.removeBond(cible.id);
          App.doc.selection.delete(cible.id);
          App.doc.changed('suppression');
          break;
        case 'mesurer': {
          if (!cible || cible.type !== 'atome') { App.viewer.mesure = []; App.viewer.reconstruire(); break; }
          const l = App.viewer.mesure;
          if (l.includes(cible.id)) l.splice(l.indexOf(cible.id), 1);
          else { if (l.length >= 4) l.length = 0; l.push(cible.id); }
          App.viewer.reconstruire();
          App.selectionner(l);
          const m = M.analyse.mesures(mol, l);
          if (m) UI.message(m.type + ' : ' + U.num(m.valeur, m.type === 'distance' ? 3 : 1) + ' ' + m.unite, 8000);
          break;
        }
        default:
          if (cible && cible.type === 'atome') App.selectionner([cible.id]);
          break;
      }
    });

    M.bus.on('vue:atome-deplace', () => { App.doc.changed('déplacement'); });

    M.bus.on('vue:survol', c => {
      const info = q('#vueInfo');
      if (!c) { info.classList.remove('visible'); return; }
      const mol = App.doc.mol;
      if (c.type === 'atome') {
        const a = mol.atom(c.id);
        if (!a) return;
        const e = M.elements.get(a.el) || {};
        const v = M.geo.vsepr(mol, a.id);
        info.innerHTML = '<b>' + U.esc(mol.etiquette(a.id)) + '</b> — ' + U.esc(e.name || '')
          + '<br>' + v.code + ' · ' + v.forme + ' · ' + v.hyb
          + '<br>Charge formelle : ' + M.geo.chargeFormelle(mol, a.id)
          + ' · Doublets libres : ' + v.lp;
      } else {
        const b = mol.bond(c.id);
        if (!b) return;
        info.innerHTML = '<b>Liaison ' + U.esc(mol.etiquette(b.a) + ' — ' + mol.etiquette(b.b)) + '</b>'
          + '<br>Ordre : ' + nomOrdre(b.order)
          + '<br>Longueur : ' + U.num(M.V.dist(mol.atom(b.a), mol.atom(b.b)), 3) + ' Å';
      }
      info.classList.add('visible');
    });
  }
  const nomOrdre = o => o === 1 ? 'simple' : o === 2 ? 'double' : o === 3 ? 'triple' : 'aromatique';

  /* ══════════ Exercices : chargement de la molécule d'énoncé ══════════ */
  App.chargerPourExercice = function (qs) {
    try {
      const mol = typeof qs.molecule === 'string' ? M.biblio.charger(qs.molecule) : M.Molecule.fromJSON(qs.molecule);
      App.doc.setMolecule(mol, 'exercice');
      App.viewer.setDocument(App.doc);
      const v = qs.vue || {};
      if (v.mode) { App.viewer.mode = v.mode; q('#selMode').value = v.mode; }
      ['doublets', 'charges', 'dipole'].forEach(k => App.basculerOption(k, !!v[k]));
      if (v.projection) {
        App.projection = v.projection;
        qa('#ongletsProj button[data-proj]').forEach(x => x.classList.toggle('actif', x.dataset.proj === v.projection));
      }
      App.rafraichir();
    } catch (e) { /* une question sans molécule reste parfaitement utilisable */ }
  };

  /* ══════════ Fichiers ══════════ */
  function brancherFichiers() {
    q('#fichierEntree').addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const txt = await f.text();
        const mol = M.io.lireAuto(f.name, txt);
        mol.name = mol.name && mol.name !== 'Sans titre' ? mol.name : f.name.replace(/\.[^.]+$/, '');
        App.doc.setMolecule(mol, 'fichier');
        App.cheminFichier = null;
        App.viewer.setDocument(App.doc);
        App.rafraichir();
        UI.message('Fichier importé : ' + f.name);
      } catch (err) {
        UI.dialogue('Import impossible', '<p>Le fichier <b>' + U.esc(f.name) + '</b> n’a pas pu être lu.</p><p class="mono">' + U.esc(err.message) + '</p>');
      }
      e.target.value = '';
    });
    /* Glisser-déposer */
    const zone = q('#centre');
    zone.addEventListener('dragover', e => { e.preventDefault(); });
    zone.addEventListener('drop', async e => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (!f) return;
      const txt = await f.text();
      try {
        const mol = M.io.lireAuto(f.name, txt);
        App.doc.setMolecule(mol, 'fichier');
        App.viewer.setDocument(App.doc);
        App.rafraichir();
        UI.message('Fichier importé : ' + f.name);
      } catch (err) { UI.message('Fichier non reconnu : ' + err.message, 6000); }
    });
  }

  App.ouvrir = async function () {
    if (App.bureau) {
      const r = await App.bureau.open();
      if (!r) return;
      try {
        const mol = M.io.lireAuto(r.name, r.text);
        App.doc.setMolecule(mol, 'fichier');
        App.cheminFichier = r.path;
        App.viewer.setDocument(App.doc);
        App.rafraichir();
        UI.message('Ouvert : ' + r.name);
      } catch (e) { UI.dialogue('Import impossible', '<p>' + U.esc(e.message) + '</p>'); }
      return;
    }
    q('#fichierEntree').click();
  };

  App.enregistrer = async function (sousNom) {
    const nom = (App.doc.mol.name || 'molecule').replace(/[\\/:*?"<>|]/g, '-') + '.lmc';
    const data = M.io.versLmc(App.doc, etatVue());
    if (App.bureau) {
      const r = await App.bureau.save({ path: App.cheminFichier, name: nom, data, saveAs: !!sousNom });
      if (!r) return;
      App.cheminFichier = r.path;
      App.doc.dirty = false;
      UI.message('Enregistré : ' + r.name);
      return;
    }
    M.io.telecharger(nom, data, 'application/json');
    App.doc.dirty = false;
    UI.message('Fichier téléchargé : ' + nom);
  };
  function etatVue() {
    return { mode: App.viewer.mode, opts: App.viewer.opts, projection: App.projection,
      camera: { theta: App.viewer.theta, phi: App.viewer.phi, distance: App.viewer.distance } };
  }

  App.exporter = async function (format) {
    const mol = App.doc.mol;
    const base = (mol.name || 'molecule').replace(/[\\/:*?"<>|]/g, '-');
    try {
      if (format === 'png') {
        const url = App.viewer.image(2);
        if (App.bureau) {
          const blob = M.io.depuisDataUrl(url);
          const buf = new Uint8Array(await blob.arrayBuffer());
          await App.bureau.exportFile(base + '.png', Array.from(buf));
        } else M.io.telecharger(base + '.png', M.io.depuisDataUrl(url));
        return UI.message('Image exportée.');
      }
      if (format === 'svg') {
        const svg = App.dernierSvg || q('#projZone').innerHTML;
        if (!svg.trim()) return UI.message('Aucune projection à exporter.');
        const style = '<style>.proj-svg{color:#101828;} </style>';
        const contenu = svg.replace('>', ' style="--fond-proj:#ffffff">').replace('</svg>', style + '</svg>');
        return ecrire(base + '-' + App.projection + '.svg', contenu, 'image/svg+xml');
      }
      if (format === 'latex-formule') {
        const t = '\\ce{' + M.analyse.formuleLatex(mol) + '}';
        UI.dialogue('Formule brute au format mhchem',
          '<p>Collez ce code dans un document LaTeX utilisant le paquet <span class="mono">mhchem</span> :</p>'
          + '<p class="mono" style="background:var(--panneau2);padding:10px;border-radius:8px;user-select:all">' + U.esc(t) + '</p>');
        try { await navigator.clipboard.writeText(t); UI.message('Code copié dans le presse-papiers.'); } catch (e) { /* copie facultative */ }
        return;
      }
      const f = M.io.FORMATS.find(x => x.ext === format);
      if (!f) return;
      const contenu = f.ecrire(mol, App.doc, etatVue());
      await ecrire(base + '.' + format, contenu, 'text/plain;charset=utf-8');
      UI.message('Exporté au format ' + f.nom + '.');
    } catch (e) {
      UI.dialogue('Export impossible', '<p>' + U.esc(e.message) + '</p>');
    }
  };
  async function ecrire(nom, contenu, mime) {
    if (App.bureau) {
      const buf = new TextEncoder().encode(contenu);
      await App.bureau.exportFile(nom, Array.from(buf));
    } else M.io.telecharger(nom, contenu, mime);
  }

  /* ══════════ Clavier ══════════ */
  function brancherClavier() {
    window.addEventListener('keydown', e => {
      const dansChamp = /input|textarea|select/i.test((e.target.tagName || ''));
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 's') { e.preventDefault(); return App.enregistrer(); }
        if (k === 'o') { e.preventDefault(); return App.ouvrir(); }
        if (k === 'n') { e.preventDefault(); return App.nouveau(); }
        if (k === 'z') { e.preventDefault(); return App.doc.undo(); }
        if (k === 'y') { e.preventDefault(); return App.doc.redo(); }
        if (k === 'a' && !dansChamp) {
          e.preventDefault();
          App.doc.selection = new Set(App.doc.mol.atoms.map(a => a.id));
          App.viewer.selection = App.doc.selection;
          App.viewer.reconstruire(); UI.majInspecteur();
          return;
        }
        return;
      }
      if (dansChamp) return;
      if (e.key === 'Escape') {
        fermerMenus();
        if (!q('#voile').hidden) return UI.fermerDialogue();
        App.doc.selection.clear(); App.doc.selBonds.clear(); App.lierDepuis = null;
        App.viewer.mesure = []; App.viewer.selection = App.doc.selection;
        App.viewer.reconstruire(); UI.majInspecteur();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return App.supprimerSelection(); }
      const outils = { v: 'orbite', s: 'selection', g: 'deplacer', a: 'element', b: 'lier', d: 'supprimer', m: 'mesurer' };
      const k = e.key.toLowerCase();
      if (outils[k]) return App.setOutil(outils[k]);
      if (k === 'f') return App.viewer.cadrer();
      if (k === 'h') return App.completerHydrogenes();
      if (k === 'o') return App.optimiser();
      if (k === '?') return UI.aide();
    });
  }

  /* ══════════ Mises à jour automatiques ══════════ */
  function brancherMisesAJour() {
    if (!App.bureau || !App.bureau.onUpdate) return;
    const zone = q('#majEtat');
    App.bureau.onUpdate(info => {
      if (!info) return;
      zone.hidden = false;
      switch (info.state) {
        case 'checking': zone.textContent = 'Recherche de mises à jour…'; break;
        case 'none': zone.textContent = 'Application à jour (v' + info.version + ')'; setTimeout(() => { zone.hidden = true; }, 4000); break;
        case 'downloading': zone.textContent = 'Téléchargement de la mise à jour… ' + (info.percent || 0) + ' %'; break;
        case 'installing': zone.textContent = 'Installation de la version ' + info.version + '…'; App.autosaveNow(); break;
        case 'dev': zone.textContent = 'Mises à jour inactives en développement'; setTimeout(() => { zone.hidden = true; }, 4000); break;
        case 'error': zone.textContent = 'Mise à jour indisponible'; zone.title = info.message || ''; setTimeout(() => { zone.hidden = true; }, 6000); break;
        default: zone.hidden = true;
      }
    });
    if (App.bureau.onOpenFile) App.bureau.onOpenFile(f => {
      try {
        const mol = M.io.lireAuto(f.name, f.text);
        App.doc.setMolecule(mol, 'fichier');
        App.cheminFichier = f.path;
        App.viewer.setDocument(App.doc);
        App.rafraichir();
      } catch (e) { UI.message('Fichier illisible : ' + e.message, 6000); }
    });
    if (App.bureau.pendingFile) App.bureau.pendingFile().then(f => {
      if (!f) return;
      try {
        const mol = M.io.lireAuto(f.name, f.text);
        App.doc.setMolecule(mol, 'fichier');
        App.cheminFichier = f.path;
        App.viewer.setDocument(App.doc);
        App.rafraichir();
      } catch (e) { /* fichier d'ouverture invalide : on garde le document courant */ }
    });
  }

  /* ══════════ Lancement ══════════ */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', App.init);
  else App.init();
})();
