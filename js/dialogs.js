/* Fenêtres de dialogue */

L.modal = function ({ title, body, foot, wide, onClose }) {
  const wrap = L.$('#modal'), box = L.$('.modal-box', wrap);
  box.className = 'modal-box' + (wide ? ' wide' : '');
  box.innerHTML = '';
  const close = () => {
    wrap.hidden = true; box.innerHTML = '';
    document.removeEventListener('keydown', onKey, true);
    if (onClose) onClose();
  };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  box.append(
    L.h('div', { class: 'mb-head' }, L.h('h2', { text: title }), L.h('button', { class: 'x', title: 'Fermer', text: '×', onclick: close })),
    L.h('div', { class: 'mb-body' }, body));
  if (foot && foot.length) box.appendChild(L.h('div', { class: 'mb-foot' },
    foot.map(b => L.h('button', { class: 'btn ' + (b.cls || ''), text: b.text, onclick: () => b.onClick(close) }))));
  wrap.hidden = false;
  wrap.onmousedown = e => { if (e.target === wrap) close(); };
  const f = box.querySelector('input, textarea, select');
  if (f) setTimeout(() => f.focus(), 30);
  return { close, box };
};

/* ---------- Choix d'un modèle ---------- */
L.dlgTemplates = function (welcome) {
  const grid = L.h('div', { class: 'tpl-grid' });
  let dlg;
  L.TEMPLATES.forEach(t => grid.appendChild(L.h('button', {
    class: 'tpl', onclick: () => {
      if (!welcome && App.dirty && !confirm('Le document actuel contient des modifications non enregistrées. Continuer quand même ?')) return;
      dlg.close();
      App.load(t.make(), null);
      App.fileName = null;
      App.updateName();
    },
  }, L.h('div', { class: 'tpl-ic', text: t.icon }), L.h('b', { text: t.name }), L.h('span', { text: t.desc }))));
  const body = L.h('div', null,
    welcome ? L.h('div', { class: 'welcome-hero' },
      L.h('h3', { text: 'Bienvenue dans LaTeX Home Edition' }),
      L.h('p', { text: 'Écrivez vos comptes rendus, cours et exercices comme dans un traitement de texte : titres, formules, tableaux, figures et références se mettent en forme et se numérotent tout seuls, avec le rendu typographique de LaTeX. Aucun code à écrire.' })) : null,
    L.h('div', { class: 'set-h', text: 'Commencer à partir d\'un modèle' }), grid);
  dlg = L.modal({ title: welcome ? 'Nouveau document' : 'Nouveau document', body, wide: true });
};

/* ---------- Réglages du document ---------- */
L.dlgSettings = function (section) {
  const m = L.fixMeta(App.doc.meta);
  const apply = () => { App.commit(); App.render(); };
  const txt = (key, label, ph) => {
    const i = L.h('input', { type: 'text', value: L.plain(m[key]), placeholder: ph || '' });
    i.oninput = () => { m[key] = L.escHtml(i.value); App.render(); App.commitSoon(); };
    return L.h('div', { class: 'field' }, L.h('label', { text: label }), i);
  };
  const seg = (key, opts, label) => {
    const s = L.h('div', { class: 'seg' });
    opts.forEach(([v, t]) => {
      const b = L.h('button', { class: m[key] === v ? 'on' : '', text: t });
      b.onclick = () => { m[key] = v; s.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); apply(); };
      s.appendChild(b);
    });
    return L.h('div', { class: 'field' }, L.h('label', { text: label }), s);
  };
  const chk = (key, label) => {
    const i = L.h('input', { type: 'checkbox' });
    i.checked = !!m[key];
    i.onchange = () => { m[key] = i.checked; apply(); };
    return L.h('label', { class: 'chk' }, i, label);
  };
  const minis = {
    article: [[30, 10, 40, 4], [36, 18, 28, 3], [40, 25, 20, 3], [15, 36, 70, 2], [15, 42, 70, 2], [15, 48, 60, 2]],
    fiche: [[8, 8, 30, 2], [62, 8, 30, 2], [8, 14, 84, 1], [30, 20, 40, 4], [8, 32, 84, 2], [8, 38, 84, 2], [8, 44, 70, 2]],
    pagegarde: [[25, 8, 50, 2], [15, 24, 70, 1], [20, 28, 60, 5], [15, 37, 70, 1], [35, 44, 30, 2], [35, 55, 30, 2]],
    aucun: [[8, 8, 60, 3], [8, 16, 84, 2], [8, 22, 84, 2], [8, 28, 84, 2], [8, 34, 70, 2]],
  };
  const styles = L.h('div', { class: 'style-cards' });
  [['article', 'Article'], ['fiche', 'Fiche / devoir'], ['pagegarde', 'Page de garde'], ['aucun', 'Sans titre']].forEach(([v, t]) => {
    const mini = L.h('div', { class: 'mini' });
    minis[v].forEach(([x, y, w, hh]) => mini.appendChild(L.h('i', { style: { left: x + '%', top: y + 'px', width: w + '%', height: hh + 'px' } })));
    const c = L.h('button', { class: 'style-card' + (m.titleStyle === v ? ' on' : '') }, mini, t);
    c.onclick = () => { m.titleStyle = v; styles.querySelectorAll('.style-card').forEach(x => x.classList.remove('on')); c.classList.add('on'); apply(); };
    styles.appendChild(c);
  });
  const today = L.h('button', { class: 'btn', text: 'Aujourd\'hui', style: { marginTop: '4px' } });
  const dateField = txt('date', 'Date');
  today.onclick = () => { m.date = L.todayFr(m.lang); dateField.querySelector('input').value = m.date; apply(); };
  dateField.appendChild(today);

  const body = L.h('div', null,
    L.h('div', { class: 'set-h', text: 'Présentation du titre' }), styles,
    L.h('div', { class: 'set-h', text: 'Informations' }),
    L.h('div', { class: 'grid2' }, txt('title', 'Titre'), txt('subtitle', 'Sous-titre'), txt('author', 'Auteur(s)'), txt('institution', 'Établissement / matière'), txt('extra', 'Infos complémentaires (groupe, binôme…)'), dateField),
    L.h('div', { class: 'set-h', text: 'Mise en page' }),
    L.h('div', { class: 'grid2' },
      seg('fontSize', [[10, '10 pt'], [11, '11 pt'], [12, '12 pt']], 'Taille du texte'),
      seg('margins', [['latex', 'LaTeX standard'], ['normales', '2,5 cm'], ['etroites', '1,5 cm']], 'Marges'),
      seg('spacing', [[1, 'Simple'], [1.5, '1,5']], 'Interligne'),
      seg('lang', [['fr', 'Français'], ['en', 'English']], 'Langue (noms automatiques)')),
    L.h('div', { class: 'set-h', text: 'Options' }),
    chk('toc', 'Table des matières automatique après le titre'),
    chk('thmBySection', 'Numéroter théorèmes, définitions, exercices… par section (2.1, 2.2…)'),
    chk('boxedThm', 'Encadrer les théorèmes, définitions et exercices'));

  // ---- Légendes ----
  const nameField = (key, label, opts) => {
    const i = L.h('input', { type: 'text', value: m[key] || '', placeholder: opts[0] + ' (par défaut)' });
    i.oninput = () => { m[key] = i.value; App.render(); App.commitSoon(); };
    const chips = L.h('div', { class: 'btn-row', style: { marginTop: '4px' } }, ...opts.map((o, k) => L.h('button', { class: 'btn', text: o, onclick: () => { i.value = k ? o : ''; m[key] = i.value; apply(); } })));
    return L.h('div', { class: 'field' }, L.h('label', { text: label }), i, chips);
  };
  body.append(L.h('div', { class: 'set-h', text: 'Légendes des tableaux et figures' }),
    L.h('div', { class: 'grid2' },
      nameField('tableName', 'Mot devant le numéro des tableaux (« Table 1 – »)', ['Table', 'Tableau', 'Tab.']),
      nameField('figureName', 'Mot devant le numéro des figures (« Figure 1 – »)', ['Figure', 'Fig.', 'Illustration'])),
    L.h('p', { class: 'pp-help', text: 'Pour une légende sans numéro ou sans légende du tout, cliquez sur le tableau puis choisissez « Légende » dans le panneau de droite.' }));

  // ---- En-tête, pied de page et numérotation ----
  const hfSec = L.h('div', { class: 'set-h', text: 'En-tête, pied de page et numéros de page' });
  const hfInput = (obj, k, ph) => { const i = L.h('input', { type: 'text', value: obj[k] || '', placeholder: ph }); i.oninput = () => { obj[k] = i.value; App.render(); App.commitSoon(); }; return i; };
  const sel = (key, opts) => {
    const s = L.h('select', null, ...opts.map(([v, t]) => { const o = L.h('option', { value: v, text: t }); if (String(m[key]) === String(v)) o.selected = true; return o; }));
    s.onchange = () => { m[key] = s.value; apply(); };
    return s;
  };
  const start = L.h('input', { type: 'number', value: L.pageStart(m), style: { width: '90px' } });
  start.onchange = () => { m.pageStart = start.value === '' ? 1 : Math.trunc(+start.value); apply(); };
  body.append(hfSec,
    L.h('div', { class: 'hf-grid' },
      L.h('span'), L.h('span', { text: 'À gauche' }), L.h('span', { text: 'Au centre' }), L.h('span', { text: 'À droite' }),
      L.h('span', { text: 'En-tête' }), hfInput(m.header, 'l', 'ex. {titre}'), hfInput(m.header, 'c', ''), hfInput(m.header, 'r', 'ex. {auteur}'),
      L.h('span', { text: 'Pied de page' }), hfInput(m.footer, 'l', 'ex. Lycée…'), hfInput(m.footer, 'c', ''), hfInput(m.footer, 'r', 'ex. {date}')),
    L.h('p', { class: 'pp-help', html: 'Raccourcis utilisables : <b>{titre}</b>, <b>{auteur}</b>, <b>{date}</b>. Dans l\'éditeur, double-cliquez sur un en-tête ou un pied de page pour revenir ici.' }),
    L.h('div', { class: 'grid3' },
      L.h('div', { class: 'field' }, L.h('label', { text: 'Format des numéros' }), sel('numFormat', L.NUM_FORMATS)),
      L.h('div', { class: 'field' }, L.h('label', { text: 'Position du numéro' }), sel('numPos', [['foot-c', 'Pied, centre'], ['foot-r', 'Pied, droite'], ['foot-l', 'Pied, gauche'], ['head-r', 'En-tête, droite'], ['head-c', 'En-tête, centre'], ['head-l', 'En-tête, gauche']])),
      L.h('div', { class: 'field' }, L.h('label', { text: 'Premier numéro de page' }), start)),
    L.h('div', { class: 'grid3' },
      L.h('div', { class: 'field' }, L.h('label', { text: 'Style du numéro' }), sel('numStyle', [['normal', 'Normal'], ['gras', 'Gras'], ['cadre', 'Encadré']]))),
    chk('headRule', 'Trait sous l\'en-tête'),
    chk('footRule', 'Trait au-dessus du pied de page'),
    chk('hfFirst', 'Afficher l\'en-tête et le pied de page sur la première page'));

  const dlg = L.modal({ title: 'Document', body, wide: true, foot: [{ text: 'Terminé', cls: 'primary', onClick: c => c() }] });
  if (section === 'hf') setTimeout(() => hfSec.scrollIntoView({ block: 'start' }), 50);
  return dlg;
};

/* ---------- Référence croisée ---------- */
L.dlgXref = function (onPick) {
  const list = L.h('div', { class: 'ref-list' });
  const targets = L.refTargets(App.doc);
  let dlg;
  if (!targets.length) list.appendChild(L.h('div', { class: 'ref-empty', html: 'Rien à référencer pour l\'instant.<br>Ajoutez des sections, équations numérotées, figures, tableaux ou théorèmes : ils apparaîtront ici.' }));
  targets.forEach(t => {
    const txt = L.h('span', { class: 'rt2' });
    if (t.type === 'equation') txt.innerHTML = L.katex(t.text); else txt.textContent = t.text || '—';
    list.appendChild(L.h('div', { class: 'ref-item', onclick: () => { dlg.close(); onPick(t.id); } },
      L.h('span', { class: 'rk', text: t.label }), L.h('span', { class: 'rn', text: t.num }), txt));
  });
  dlg = L.modal({ title: 'Insérer une référence', body: L.h('div', null,
    L.h('p', { class: 'pp-help', text: 'Choisissez l\'élément à citer. Son numéro sera mis à jour automatiquement si vous réorganisez le document.' }), list) });
};

/* ---------- Citation bibliographique ---------- */
L.bibForm = function (e = {}) {
  const f = {};
  const mk = (k, label, ph) => { f[k] = L.h('input', { type: 'text', value: e[k] || '', placeholder: ph }); return L.h('div', { class: 'field' }, L.h('label', { text: label }), f[k]); };
  const el = L.h('div', null,
    L.h('div', { class: 'grid2' }, mk('authors', 'Auteur(s)', 'Ex. : M. Curie, P. Curie'), mk('title', 'Titre', 'Titre de l\'ouvrage ou de l\'article')),
    L.h('div', { class: 'grid3' }, mk('source', 'Revue / éditeur', 'Ex. : Dunod'), mk('year', 'Année', '2024'), mk('url', 'Lien (facultatif)', 'https://…')));
  el.values = () => Object.fromEntries(Object.entries(f).map(([k, i]) => [k, i.value.trim()]));
  return el;
};

L.dlgCite = function (onPick) {
  const bib = App.doc.bib || (App.doc.bib = []);
  let dlg;
  const list = L.h('div', { class: 'ref-list' });
  if (!bib.length) list.appendChild(L.h('div', { class: 'ref-empty', text: 'Aucune source pour l\'instant : ajoutez-en une ci-dessous.' }));
  bib.forEach((e, i) => list.appendChild(L.h('div', { class: 'ref-item', onclick: () => { dlg.close(); onPick(e.id); } },
    L.h('span', { class: 'rn', text: '[' + (i + 1) + ']' }), L.h('span', { class: 'rt2', html: L.bibHtml(e) }))));
  const form = L.bibForm();
  const body = L.h('div', null, list, L.h('div', { class: 'set-h', text: 'Nouvelle source' }), form);
  dlg = L.modal({
    title: 'Citer une source', body, wide: true,
    foot: [{ text: 'Ajouter et citer', cls: 'primary', onClick: close => {
      const v = form.values();
      if (!v.authors && !v.title) { L.toast('Indiquez au moins un auteur ou un titre.', 'err'); return; }
      const e = Object.assign({ id: 'ref' + L.uid('').slice(0, 6) }, v);
      bib.push(e);
      App.ensureBibliography();
      close(); onPick(e.id);
    } }],
  });
};

L.dlgBib = function () {
  const bib = App.doc.bib || (App.doc.bib = []);
  const body = L.h('div');
  const draw = () => {
    body.innerHTML = '';
    body.appendChild(L.h('p', { class: 'pp-help', text: 'Les sources sont numérotées dans l\'ordre de cette liste, comme avec la commande thebibliography de LaTeX.' }));
    bib.forEach((e, i) => {
      const inp = (k, ph) => { const x = L.h('input', { type: 'text', value: e[k] || '', placeholder: ph }); x.oninput = () => { e[k] = x.value; App.render(); App.commitSoon(); }; return x; };
      body.appendChild(L.h('div', { class: 'bib-row' },
        L.h('span', { class: 'n', text: '[' + (i + 1) + ']' }),
        L.h('div', { class: 'g' }, inp('authors', 'Auteur(s)'), inp('title', 'Titre'), inp('source', 'Revue / éditeur'), inp('year', 'Année'), inp('url', 'Lien')),
        L.h('div', { class: 'btn-row', style: { flexDirection: 'column' } },
          L.h('button', { class: 'btn', title: 'Monter', text: '↑', onclick: () => { if (i > 0) { bib.splice(i - 1, 0, bib.splice(i, 1)[0]); App.commit(); App.render(); draw(); } } }),
          L.h('button', { class: 'btn danger', title: 'Supprimer', text: '✕', onclick: () => { bib.splice(i, 1); App.commit(); App.render(); draw(); } }))));
    });
    const form = L.bibForm();
    body.append(L.h('div', { class: 'set-h', text: 'Ajouter une source' }), form,
      L.h('button', { class: 'btn primary', text: 'Ajouter', onclick: () => {
        const v = form.values();
        if (!v.authors && !v.title) return;
        bib.push(Object.assign({ id: 'ref' + L.uid('').slice(0, 6) }, v));
        App.ensureBibliography(); App.commit(); App.render(); draw();
      } }));
  };
  draw();
  L.modal({ title: 'Bibliographie', body, wide: true, foot: [{ text: 'Terminé', cls: 'primary', onClick: c => c() }] });
};

/* ---------- Note de bas de page ---------- */
L.dlgFootnote = function (initial, onOk, onDelete) {
  const ta = L.h('textarea', { rows: 3, placeholder: 'Texte de la note…' });
  ta.value = initial || '';
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dlg.box.querySelector('.mb-foot .primary').click(); } });
  const foot = [];
  if (onDelete) foot.push({ text: 'Supprimer la note', cls: 'danger', onClick: c => { c(); onDelete(); } });
  foot.push({ text: 'Annuler', onClick: c => c() });
  foot.push({ text: 'Valider', cls: 'primary', onClick: c => { const v = ta.value.trim(); c(); if (v) onOk(v); else if (onDelete) onDelete(); } });
  const dlg = L.modal({ title: 'Note de bas de page', body: L.h('div', { class: 'field' }, L.h('label', { text: 'La note apparaîtra en bas de la page, numérotée automatiquement.' }), ta), foot });
};

/* ---------- Code LaTeX généré ---------- */
L.dlgViewTex = function () {
  const r = L.docToLatex(App.doc);
  const pre = L.h('pre', { class: 'texview', text: r.tex });
  L.modal({
    title: 'Code LaTeX généré', wide: true,
    body: L.h('div', null,
      L.h('p', { class: 'pp-help', text: 'Vous n\'avez rien à écrire : ce code est produit automatiquement à partir de votre document. Il se compile avec n\'importe quelle installation LaTeX (TeX Live, MiKTeX, Overleaf).' }),
      r.warnings.length ? L.h('div', { class: 'note', text: r.warnings.join(' ') }) : null, pre),
    foot: [
      { text: 'Copier', onClick: () => { navigator.clipboard.writeText(r.tex).then(() => L.toast('Code copié')); } },
      { text: 'Télécharger .tex', cls: 'primary', onClick: c => { c(); App.exportTex(); } },
    ],
  });
};

/* ---------- Overleaf ---------- */
L.dlgOverleaf = function () {
  const r = L.docToLatex(App.doc);
  const body = L.h('div', { class: 'help-p' },
    L.h('p', { text: 'Le code LaTeX de votre document va être envoyé à overleaf.com (éditeur LaTeX en ligne, compte gratuit nécessaire) dans un nouvel onglet.' }),
    r.images.length ? L.h('div', { class: 'note', text: 'Votre document contient ' + r.images.length + ' image(s) : elles ne peuvent pas être transmises automatiquement. Préférez « Télécharger le projet complet (.zip) » puis, sur Overleaf, « Nouveau projet → Importer un projet ».' }) : null);
  L.modal({
    title: 'Ouvrir dans Overleaf', body,
    foot: [{ text: 'Annuler', onClick: c => c() }, { text: 'Envoyer vers Overleaf', cls: 'primary', onClick: c => {
      c();
      const f = L.h('form', { method: 'POST', action: 'https://www.overleaf.com/docs', target: '_blank', style: { display: 'none' } },
        L.h('input', { type: 'hidden', name: 'encoded_snip', value: encodeURIComponent(r.tex) }),
        L.h('input', { type: 'hidden', name: 'snip_name', value: L.slug(L.plain(App.doc.meta.title)) + '.tex' }),
        L.h('input', { type: 'hidden', name: 'engine', value: 'pdflatex' }));
      document.body.appendChild(f); f.submit(); f.remove();
    } }],
  });
};

/* ---------- Aide ---------- */
L.dlgHelp = function () {
  const k = [
    ['Nouveau paragraphe', 'Entrée'], ['Retour à la ligne', 'Maj + Entrée'], ['Menu d\'insertion', '/ en début de ligne'],
    ['Formule dans le texte', 'Ctrl + M  ou  $'], ['Équation centrée', 'Ctrl + Maj + M'], ['Gras / italique / souligné', 'Ctrl + B / I / U'],
    ['Titre de section', '#  puis espace'], ['Sous-section', '##  puis espace'], ['Liste à puces', '-  puis espace'],
    ['Liste numérotée', '1.  puis espace'], ['Décaler un élément de liste', 'Tab / Maj + Tab'], ['Annuler / rétablir', 'Ctrl + Z / Ctrl + Y'],
    ['Enregistrer', 'Ctrl + S'], ['Exporter en PDF', 'Ctrl + P'], ['Déplacer un bloc', 'Alt + ↑ / ↓'], ['Supprimer le bloc sélectionné', 'Ctrl + Maj + Suppr'],
  ];
  const body = L.h('div', null,
    L.h('div', { class: 'help-p' },
      L.h('h4', { text: 'Le principe' }),
      L.h('p', { text: 'Votre document est une suite de blocs : paragraphes, titres, équations, listes, tableaux, figures, encadrés (théorème, définition, exercice…). Ajoutez-les avec la colonne « Insérer », le bouton + qui apparaît à gauche d\'un bloc au survol, ou en tapant « / » sur une ligne vide. Cliquez sur un bloc pour voir ses réglages à droite.' }),
      L.h('h4', { text: 'Les formules' }),
      L.h('p', { text: 'Cliquez sur « Formule » (ou tapez $) : un éditeur visuel s\'ouvre en bas. Utilisez les boutons (fractions, racines, intégrales, matrices, lettres grecques…) ou tapez directement : « / » crée une fraction, « ^ » un exposant, « _ » un indice, « sqrt » une racine, « int » une intégrale. L\'onglet « Chimie » écrit les équations de réaction.' }),
      L.h('h4', { text: 'Numérotation et références' }),
      L.h('p', { text: 'Sections, équations, figures, tableaux, théorèmes et exercices sont numérotés automatiquement. Le bouton « Référence » insère un numéro qui reste toujours juste, même si vous déplacez les éléments.' }),
      L.h('h4', { text: 'Le résultat' }),
      L.h('p', { text: '« Aperçu » montre les pages exactement comme dans le PDF. « PDF » ouvre la fenêtre d\'impression : choisissez « Enregistrer au format PDF ». « LaTeX » produit un vrai fichier .tex (ou un projet .zip avec les images) compilable avec LaTeX ou sur Overleaf.' })),
    L.h('div', { class: 'set-h', text: 'Raccourcis clavier' }),
    L.h('div', { class: 'help-grid' }, k.map(([a, b]) => L.h('div', null, L.h('span', { text: a }), L.h('kbd', { text: b })))));
  if (window.lheDesktop) {
    const ver = L.h('span', { text: '…' });
    lheDesktop.version().then(v => { ver.textContent = v; });
    body.append(L.h('div', { class: 'set-h', text: 'À propos' }),
      L.h('div', { class: 'btn-row', style: { alignItems: 'center' } },
        L.h('span', { class: 'pp-help' }, 'LaTeX Home Edition, version ', ver, ' — mises à jour automatiques via GitHub.'),
        L.h('button', { class: 'btn', text: 'Rechercher des mises à jour', onclick: () => lheDesktop.checkUpdates() })));
  }
  L.modal({ title: 'Aide', body, wide: true });
};
