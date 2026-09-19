/* Banque de sujets : niveaux, fabrication des documents (sujet / corrigé) et menus */
(function () {
  const B = L.newBlock;
  const M = latex => '<span class="imath" data-latex="' + L.escHtml(latex) + '"></span>';

  /* Texte enrichi compact : $formule$, **gras**, __italique__ */
  const fmt = s => L.escHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<i>$1</i>');
  const rt = function (s) {
    const parts = String(s == null ? '' : s).split(/\$([^$]*)\$/);
    return parts.map((p, i) => (i % 2 ? M(p) : fmt(p))).join('');
  };
  L.rt = rt;

  const P = (html, o) => B('paragraph', Object.assign({ html: rt(html) }, o || {}));
  const H = (level, html, numbered) => B('heading', { level, html: rt(html), numbered: !!numbered });
  const E = (latex, numbered) => B('equation', { latex, numbered: !!numbered });
  const LI = (style, items) => B('list', {
    style,
    items: items.map(s => {
      let t = String(s), lvl = 0;
      while (t[0] === '>') { lvl++; t = t.slice(1); }
      return { html: rt(t.trim()), level: Math.min(lvl, 2) };
    }),
  });
  const BOX = (kind, children, title) => B('box', {
    kind, title: title ? rt(title) : '',
    children: children.length ? children : [B('paragraph')],
  });

  /* Un « nœud » du contenu : chaîne = paragraphe, tableau = [type, …] */
  function nd(n, first) {
    if (n == null) return null;
    if (typeof n === 'string') return P(n, first ? { noindent: true } : null);
    const tag = n[0], a = n.slice(1);
    switch (tag) {
      case 'q': return LI('number', a);
      case 'a': return LI('alpha', a);
      case 'b': return LI('bullet', a);
      case '$': return E(a[0], false);
      case '$n': return E(a[0], true);
      case 'h': return H(2, a[0], false);
      case '!': return BOX('remarque', nds(a));
      case 'ind': return BOX('remarque', nds(a), 'Indication');
      case 'meth': return BOX('methode', nds(a.slice(1)), a[0]);
      case 'def': return BOX('definition', nds(a));
      case 'sol': return BOX('solution', nds(a));
      case 'rap': return BOX('propriete', nds(a.slice(1)), a[0]);
      case 'tab': return B('table', {
        head: true, style: 'pro', caption: a[1] ? rt(a[1]) : '',
        align: (a[0][0] || []).map(() => 'c'),
        rows: a[0].map(r => r.map(rt)),
      });
      case 'fig': return B('figure', { width: a[1] || 60, caption: a[0] ? rt(a[0]) : '' });
      case 'code': return B('code', { lang: a[0] || 'python', code: a[1] || '', numbers: false });
      case 'vs': return B('vspace', { size: a[0] || 'moyen' });
      case 'saut': return B('pagebreak', {});
      default: return P(String(tag));
    }
  }
  const nds = list => (list || []).map((n, i) => nd(n, i === 0)).filter(Boolean);

  /* ---------- Niveaux ---------- */
  L.NIVEAUX = [
    { id: '1re', nom: 'Première', ic: '1', sous: 'Spécialité mathématiques', long: 'Première — Spécialité mathématiques' },
    { id: 'tle', nom: 'Terminale', ic: '2', sous: 'Spécialité mathématiques', long: 'Terminale — Spécialité mathématiques' },
    { id: 'sup', nom: 'Sup — prépa 1re année', ic: 'S', sous: 'MPSI · PCSI · MP2I · PTSI', long: 'Prépa 1re année — MPSI/PCSI' },
    { id: 'spe', nom: 'Spé — prépa 2e année', ic: 'S²', sous: 'MP · PC · PSI · MPI', long: 'Prépa 2e année — MP/PC/PSI' },
  ];
  const niveau = id => L.NIVEAUX.find(n => n.id === id) || L.NIVEAUX[0];

  /* ---------- Registre ---------- */
  L.BANQUE = [];
  L.addSujets = function (niv, kind, list) {
    list.forEach((s, i) => L.BANQUE.push(Object.assign({ niv, kind, id: niv + '-' + kind + '-' + (i + 1) }, s)));
  };
  L.sujets = (niv, kind) => L.BANQUE.filter(s => s.niv === niv && s.kind === kind);
  L.sujetById = id => L.BANQUE.find(s => s.id === id);

  const duree = s => (s.h === 1 ? '1 h' : s.h + ' h');
  const exNom = (e, i) => (e.nom || 'Exercice') + ' ' + (e.num || i + 1) + (e.t ? ' — ' + e.t : '');
  const totalPts = s => s.ex.reduce((t, e) => t + (e.pts || 0), 0);

  /* ---------- Fabrication du document ---------- */
  L.sujetDoc = function (s, mode) {
    mode = mode || 'sujet';
    const n = niveau(s.niv), lycee = s.niv === '1re' || s.niv === 'tle';
    const corr = mode === 'corrige';
    const blocks = [];

    if (s.kind === 'ds') {
      if (!corr) {
        if (lycee) blocks.push(B('paragraph', {
          noindent: true,
          html: '<b>Nom :</b> .................................... <b>Prénom :</b> .................................... <b>Classe :</b> ..........',
        }));
        blocks.push(BOX('remarque', [
          P('Durée : **' + duree(s) + '**. Calculatrice ' + (s.calc || 'autorisée') + '. Les exercices sont indépendants et peuvent être traités dans l\'ordre de votre choix.'),
          P('La qualité de la rédaction, la clarté et la précision des raisonnements entrent pour une part importante dans l\'appréciation des copies. Barème indicatif : **'
            + totalPts(s) + ' points**.'),
        ]));
      }
      s.ex.forEach((e, i) => {
        blocks.push(H(1, exNom(e, i) + (!corr && e.pts ? '  (' + e.pts + ' points)' : ''), false));
        blocks.push.apply(blocks, corr ? solNodes(e) : nds(e.c));
        if (mode === 'both' && e.sol && e.sol.length) blocks.push(BOX('solution', nds(e.sol)));
      });
    } else {
      if (!corr && s.intro) blocks.push(BOX('resume', [P(s.intro)]));
      s.ex.forEach((e, i) => {
        if (corr) {
          blocks.push(H(1, exNom(e, i), false));
          blocks.push.apply(blocks, solNodes(e));
        } else {
          blocks.push(BOX('exercice', nds(e.c), e.t || ''));
          if (mode === 'both' && e.sol && e.sol.length) blocks.push(BOX('solution', nds(e.sol)));
        }
      });
    }

    const meta = {
      title: (corr ? 'Corrigé — ' : '') + s.t,
      subtitle: s.kind === 'ds'
        ? (corr ? 'Éléments de correction' : 'Durée : ' + duree(s) + ' — Calculatrice ' + (s.calc || 'autorisée'))
        : (corr ? 'Corrigé — ' + (s.st || '') : (s.st || '')),
      institution: 'Mathématiques — ' + n.long,
      author: '', titleStyle: 'fiche', date: L.todayFr(),
      numFormat: 'n/N', numPos: 'foot-c',
      sujet: s.id, sujetMode: mode === 'both' ? 'both' : (corr ? 'corrige' : 'sujet'),
    };
    if (mode === 'both') meta.title = s.t + ' (avec corrigé)';
    return { meta: Object.assign(L.defaultMeta(), meta), blocks, bib: [], assets: {} };
  };

  function solNodes(e) {
    if (!e.sol || !e.sol.length) return [P('À compléter.')];
    return nds(e.sol);
  }

  /* ---------- Chargement ---------- */
  function charger(doc) {
    if (App.dirty && !confirm('Le document actuel contient des modifications non enregistrées. Continuer quand même ?')) return false;
    App.load(doc, null);
    App.fileName = null; App.filePath = null; App.fileHandle = null;
    App.updateName();
    return true;
  }
  L.chargerSujet = function (s, mode) { return charger(L.sujetDoc(s, mode)); };

  /* ---------- Menu : choix du niveau ---------- */
  L.dlgBank = function (kind) {
    const ds = kind === 'ds';
    const grid = L.h('div', { class: 'niv-grid' });
    let dlg;
    L.NIVEAUX.forEach(n => {
      const list = L.sujets(n.id, kind);
      grid.appendChild(L.h('button', {
        class: 'niv', onclick: () => { dlg.close(); L.dlgSujets(kind, n.id); },
      },
      L.h('div', { class: 'niv-ic', text: n.ic }),
      L.h('div', null,
        L.h('b', { text: n.nom }),
        L.h('span', { text: n.sous }),
        L.h('em', { text: list.length + (ds ? ' sujets prêts à imprimer' : ' fiches d\'exercices') }))));
    });
    const body = L.h('div', null,
      L.h('p', { class: 'bank-hint', text: ds
        ? 'Choisissez un niveau : vous accéderez à dix sujets originaux (cinq contrôles d\'une heure et cinq devoirs de deux à trois heures), chacun avec son corrigé.'
        : 'Choisissez un niveau : dix fiches d\'exercices par thème, chacune avec son corrigé.' }),
      grid,
      L.h('div', { class: 'bank-foot' }, L.h('button', {
        class: 'lnk', text: ds ? 'Ou partir d\'un modèle de contrôle vierge' : 'Ou partir d\'une feuille d\'exercices vierge',
        onclick: () => {
          const t = L.TEMPLATES.find(x => x.id === (ds ? 'controle' : 'exos'));
          if (charger(t.make())) dlg.close();
        },
      })));
    dlg = L.modal({ title: ds ? 'Contrôles et évaluations' : 'Fiches d\'exercices de mathématiques', body, wide: true });
  };

  /* ---------- Menu : choix du sujet ---------- */
  L.dlgSujets = function (kind, niv) {
    const ds = kind === 'ds', n = niveau(niv), list = L.sujets(niv, kind);
    let dlg;
    const open = (s, mode) => { if (L.chargerSujet(s, mode)) dlg.close(); };
    const row = s => {
      const r = L.h('div', { class: 'suj' },
        L.h('button', { class: 'suj-main', onclick: () => open(s, 'sujet') },
          L.h('span', { class: 'suj-dur', text: ds ? duree(s) : (s.diff || 'Fiche') }),
          L.h('span', { class: 'suj-txt' },
            L.h('b', { text: s.t }),
            L.h('span', { text: s.st || '' }),
            s.desc ? L.h('em', { text: s.desc }) : null)),
        L.h('button', { class: 'suj-corr', title: 'Ouvrir directement le corrigé', text: 'Corrigé', onclick: () => open(s, 'corrige') }));
      return r;
    };
    const wrap = L.h('div', { class: 'suj-list' });
    if (ds) {
      const courts = list.filter(s => s.h <= 1), longs = list.filter(s => s.h > 1);
      if (courts.length) { wrap.appendChild(L.h('div', { class: 'set-h', text: 'Contrôles d\'une heure' })); courts.forEach(s => wrap.appendChild(row(s))); }
      if (longs.length) { wrap.appendChild(L.h('div', { class: 'set-h', text: 'Devoirs surveillés de 2 à 3 heures' })); longs.forEach(s => wrap.appendChild(row(s))); }
    } else {
      list.forEach(s => wrap.appendChild(row(s)));
    }
    if (!list.length) wrap.appendChild(L.h('p', { class: 'bank-hint', text: 'Aucun sujet pour ce niveau pour le moment.' }));

    const body = L.h('div', null,
      L.h('div', { class: 'bank-bar' },
        L.h('button', { class: 'lnk', text: '← Changer de niveau', onclick: () => { dlg.close(); L.dlgBank(kind); } }),
        L.h('span', { class: 'bank-lvl', text: n.long }),
        list.length ? L.h('button', { class: 'btn small', text: '🎲 Au hasard', onclick: () => open(list[Math.floor(Math.random() * list.length)], 'sujet') }) : null),
      wrap,
      L.h('p', { class: 'bank-hint small', text: 'Chaque sujet s\'ouvre comme un document normal : vous pouvez le modifier, l\'imprimer en PDF ou l\'exporter en LaTeX. Le corrigé reste accessible par le menu « Corrigé », en haut à droite.' }));
    dlg = L.modal({ title: (ds ? 'Contrôles' : 'Fiches') + ' — ' + n.nom, body, wide: true });
  };

  /* ---------- Menu « Corrigé » de la barre d'outils ---------- */
  L.updateCorrGroup = function () {
    const grp = L.$('#corrGrp');
    if (!grp) return;
    const m = (App.doc && App.doc.meta) || {};
    const s = m.sujet && L.sujetById(m.sujet);
    grp.hidden = !s;
    if (!s) return;
    const corr = m.sujetMode === 'corrige';
    const btn = L.$('#btnCorr span', grp);
    if (btn) btn.textContent = corr ? 'Sujet ▾' : 'Corrigé ▾';
    L.$$('#corrMenu button').forEach(b => {
      const a = b.dataset.act;
      b.classList.toggle('on', (a === 'corr-open' && corr) || (a === 'corr-back' && !corr)
        || (a === 'corr-both' && m.sujetMode === 'both'));
    });
  };
  L.corrAction = function (what) {
    const m = (App.doc && App.doc.meta) || {};
    const s = m.sujet && L.sujetById(m.sujet);
    if (!s) return;
    if (what === 'corr-open') L.chargerSujet(s, 'corrige');
    else if (what === 'corr-back') L.chargerSujet(s, 'sujet');
    else if (what === 'corr-both') L.chargerSujet(s, 'both');
  };
})();
